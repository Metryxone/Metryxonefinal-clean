/**
 * WC-L0E — Behaviour Signal Capture Backfill (flag-gated, idempotent, never-throws).
 *
 * ROOT CAUSE (WC-L0E audit): the construct-feeding behaviour signals (`career_confusion`,
 * `placement_anxiety`, `social_withdrawal`, `emotional_overload`, … — the `SIGNAL_DEFICIT_MAP` keys,
 * `signal_type='activated'`, populated `strength`) are produced by the **Signal Activation Runtime**
 * (`services/signal-activation-runtime.ts` → `runEvidenceRuntime`), which runs live on the
 * `/api/capadex/session/:id/respond` path. The historical zero-signal completed sessions all finished
 * BEFORE that runtime was live, so it never ran for them. The runtime is idempotent and recomputes the
 * complete signal state from a session's responses, so we can re-run it OFFLINE over the persisted
 * `capadex_responses` (which already snapshot `concern_bucket`) to activate the signals that the live
 * path would have written.
 *
 * HONESTY GUARANTEES (do not weaken):
 *   - REUSE ONLY. This script introduces NO new engine / signal / construct / ontology. It calls the
 *     EXISTING `runEvidenceRuntime` and the EXISTING `persistUserIntelligence` (WC-L0 projection).
 *   - NO FABRICATED TELEMETRY. The reconstructed EvidenceInput batch carries ONLY persisted answer
 *     data (`response_value` + snapshotted `concern_bucket`). `response_time_ms` and `answer_changed`
 *     are OMITTED — so sessions with no stored telemetry honestly get NO rapid/hesitation/volatility
 *     evidence (those signals require real telemetry we do not have and will not invent).
 *   - PROVENANCE. Every backfilled activation row is stamped `signal_value.wcl0e_backfill = true` so it
 *     is distinguishable from a live capture.
 *   - PERMANENTLY UN-BACKFILLABLE sessions (0 responses → no evidence) are reported as such, never
 *     conjured into a graph.
 *
 * REVERSIBILITY: the script REFUSES to write unless `FF_BEHAVIOUR_SIGNAL_BACKFILL=1`. Flag OFF →
 * no run → byte-identical legacy state. `--dry-run` is read-only and runs without the flag (it only
 * reports the target set + reconstructable evidence, writing nothing).
 *
 * Usage:
 *   cd backend && npx tsx scripts/wc3/wcl0e-backfill.ts --dry-run
 *   cd backend && FF_BEHAVIOUR_SIGNAL_BACKFILL=1 FF_BEHAVIOUR_NAMESPACE_ALIGNMENT=1 \
 *     npx tsx scripts/wc3/wcl0e-backfill.ts --apply
 */
import { Pool } from 'pg';
import { runEvidenceRuntime } from '../../services/signal-activation-runtime';
import type { EvidenceInput } from '../../services/evidence-engine';
import { buildBehaviorGraph } from '../../services/behavior-graph-service';
import { persistUserIntelligence } from '../../services/wc3/user-intelligence-foundation';
import { isBehaviourSignalBackfillEnabled } from '../../config/feature-flags';

interface SessionRow {
  id: string;
  primary_construct_key: string | null;
  concern_name: string | null;
  master_concern_pk: number | null;
  n_responses: number;
  n_activated: number;
  has_graph: boolean;
}

interface BackfillOutcome {
  sid: string;
  concern: string | null;
  responses: number;
  evidenceBuilt: number;
  activatedAfter: number;
  dimsPresent: number;
  status: 'activated' | 'no_evidence' | 'no_signal' | 'skipped_has_signals';
}

/**
 * Resolve evidence `kind` by MIRRORING the live `/respond` route exactly: probe `sdi_items` by
 * `id::text` first (→ 'assessment'); if absent and the id is a pure integer, probe
 * `short_assessment_questions` (→ 'short_assessment'); otherwise 'unknown'. `capadex_responses.item_id`
 * is UUID-typed, so in practice every item resolves to 'assessment' or 'unknown' — but we keep the full
 * cascade so the reconstruction is functionally identical to the live path, not an ID-regex shortcut.
 */
async function detectKind(pool: Pool, itemId: string): Promise<EvidenceInput['kind']> {
  try {
    const sdi = await pool.query('SELECT 1 FROM sdi_items WHERE id::text = $1 LIMIT 1', [itemId]);
    if (sdi.rows.length) return 'assessment';
    if (/^\d+$/.test(itemId)) {
      const saq = await pool.query('SELECT 1 FROM short_assessment_questions WHERE id = $1 LIMIT 1', [parseInt(itemId, 10)]);
      if (saq.rows.length) return 'short_assessment';
    }
  } catch { /* degrade to unknown — never throws */ }
  return 'unknown';
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const dryRun = process.argv.includes('--dry-run') || !apply;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (apply && !isBehaviourSignalBackfillEnabled()) {
      console.error(
        '[wcl0e-backfill] REFUSED: --apply requires FF_BEHAVIOUR_SIGNAL_BACKFILL=1 (flag is OFF). ' +
        'Re-run with the flag, or use --dry-run for a read-only preview.',
      );
      process.exitCode = 1;
      return;
    }

    const mode = apply ? 'APPLY (writes)' : 'DRY-RUN (read-only, no writes)';
    console.log(`\n=== WC-L0E Behaviour Signal Capture Backfill — ${mode} ===\n`);

    const { rows: sessions } = await pool.query<SessionRow>(`
      SELECT s.id::text AS id,
             s.primary_construct_key,
             s.concern_name,
             s.master_concern_pk,
             (SELECT COUNT(*)::int FROM capadex_responses r WHERE r.session_id = s.id) AS n_responses,
             (SELECT COUNT(*)::int FROM capadex_session_signals g
                WHERE g.session_id = s.id AND g.lifecycle_state IS NOT NULL) AS n_activated,
             EXISTS (SELECT 1 FROM capadex_behavior_graph bg WHERE bg.session_id = s.id) AS has_graph
        FROM capadex_sessions s
       WHERE s.status = 'completed'
       ORDER BY s.created_at ASC
    `);

    // Target = completed sessions that have NO materialized behaviour graph row (the real coverage
    // gap). Sessions that already have a graph (e.g. the live post-activation session) are left
    // untouched so the backfill never disturbs live captures. Idempotent: re-running over a session
    // that has activation signals but no graph row will simply (re)activate + build the graph.
    const targets = sessions.filter((s) => !s.has_graph);
    console.log(
      `Completed sessions: ${sessions.length} · already-graphed (left untouched): ` +
      `${sessions.length - targets.length} · graph-gap targets: ${targets.length}\n`,
    );

    const outcomes: BackfillOutcome[] = [];

    for (const s of targets) {
      // Rebuild the EvidenceInput batch from persisted responses ONLY. No telemetry is reconstructed.
      const { rows: resp } = await pool.query<{
        item_id: string; response_value: number | null; concern_bucket: string | null;
      }>(
        `SELECT item_id::text AS item_id, response_value, concern_bucket
           FROM capadex_responses
          WHERE session_id::text = $1
          ORDER BY created_at ASC`,
        [s.id],
      );

      const inputs: EvidenceInput[] = [];
      for (const r of resp) {
        if (r.response_value == null) continue;
        inputs.push({
          item_id: r.item_id,
          response_value: Number(r.response_value),
          // Telemetry is irrecoverable for historical sessions → omitted, NEVER fabricated.
          response_time_ms: null,
          answer_changed: false,
          bucket: r.concern_bucket ?? null,
          kind: await detectKind(pool, r.item_id),
        });
      }

      const base: Omit<BackfillOutcome, 'activatedAfter' | 'dimsPresent' | 'status'> = {
        sid: s.id.slice(0, 8), concern: s.concern_name, responses: s.n_responses, evidenceBuilt: inputs.length,
      };

      if (inputs.length === 0) {
        outcomes.push({ ...base, activatedAfter: 0, dimsPresent: 0, status: 'no_evidence' });
        continue;
      }

      if (dryRun) {
        // Read-only preview: report what WOULD be reconstructed, write nothing.
        outcomes.push({ ...base, activatedAfter: -1, dimsPresent: -1, status: 'activated' });
        continue;
      }

      // ── APPLY ──────────────────────────────────────────────────────────────
      const result = await runEvidenceRuntime(
        pool,
        {
          id: s.id,
          primary_construct_key: s.primary_construct_key,
          concern_name: s.concern_name,
          master_concern_pk: s.master_concern_pk ?? null,
        },
        inputs,
      );

      // Count what actually landed (the engine recomputes the full set; result may be null).
      const { rows: [{ n }] } = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM capadex_session_signals
          WHERE session_id = $1 AND lifecycle_state IS NOT NULL`,
        [s.id],
      );
      const activatedAfter = Number(n);

      if (activatedAfter === 0) {
        outcomes.push({ ...base, activatedAfter: 0, dimsPresent: 0, status: 'no_signal' });
        continue;
      }

      // Provenance stamp: mark every activation row as a WC-L0E backfill (additive JSONB merge).
      await pool.query(
        `UPDATE capadex_session_signals
            SET signal_value = COALESCE(signal_value, '{}'::jsonb) || '{"wcl0e_backfill": true}'::jsonb
          WHERE session_id = $1 AND lifecycle_state IS NOT NULL`,
        [s.id],
      );

      // Aggregate the now-activated signals into the materialized Unified Behaviour Graph
      // (capadex_behavior_graph) via the EXISTING aggregator — this is the one-per-session row that
      // getBehaviorGraph / projectBehaviour read. Without it the activation rows exist but no graph
      // is materialized, so coverage would not move. buildBehaviorGraph self-persists.
      await buildBehaviorGraph(pool, s.id);

      // Project the construct dims from the now-populated behaviour graph via the EXISTING WC-L0
      // persistence (honours FF_BEHAVIOUR_NAMESPACE_ALIGNMENT for the deficit-coded construct dims).
      const ui = await persistUserIntelligence(pool, s.id);
      const dimsPresent = ui?.behaviour_dims_present ?? 0;

      outcomes.push({ ...base, activatedAfter, dimsPresent, status: 'activated' });
      void result;
    }

    // ── Report ───────────────────────────────────────────────────────────────
    console.log('Session  | concern                  | resp | evid | activated | dims | status');
    console.log('---------|--------------------------|------|------|-----------|------|------------------');
    for (const o of outcomes) {
      const concern = (o.concern ?? '(none)').slice(0, 24).padEnd(24);
      const act = o.activatedAfter < 0 ? ' (dry)' : String(o.activatedAfter).padStart(9);
      const dims = o.dimsPresent < 0 ? '(dry)' : String(o.dimsPresent).padStart(4);
      console.log(
        `${o.sid} | ${concern} | ${String(o.responses).padStart(4)} | ${String(o.evidenceBuilt).padStart(4)} | ${act} | ${dims} | ${o.status}`,
      );
    }

    const activated = outcomes.filter((o) => o.status === 'activated').length;
    const noEvidence = outcomes.filter((o) => o.status === 'no_evidence').length;
    const noSignal = outcomes.filter((o) => o.status === 'no_signal').length;
    console.log(
      `\nSummary: ${activated} ${dryRun ? 'would activate' : 'activated'} · ` +
      `${noEvidence} un-backfillable (0 responses → no evidence) · ` +
      `${noSignal} produced no signal (concern had no resolvable seed/bucket).`,
    );
    if (dryRun) {
      console.log('\nDRY-RUN only — nothing was written. Re-run with FF_BEHAVIOUR_SIGNAL_BACKFILL=1 --apply to persist.');
    }
  } catch (err) {
    console.error('[wcl0e-backfill] fatal:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
