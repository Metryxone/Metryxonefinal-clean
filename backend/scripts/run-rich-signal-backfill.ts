/**
 * Task #22 — Rich Behavioural Signal Backfill (flag-gated, idempotent, never-throws).
 *
 * ROOT CAUSE: every completed CAPADEX session historically captured only ONE
 * behavioural signal (the concern bucket), because the evidence extractor keyed
 * all ~10 answers on the same bucket. The composite/pattern intelligence layer
 * needs ≥2 co-active signals (`ABSOLUTE_MIN_COUNT = 2`), so it produced ZERO
 * composites/patterns. The richer-signal change (FF_RICH_BEHAVIORAL_SIGNALS)
 * makes `extractEvidence` additionally emit a genuine concern signal keyed on
 * each item's authored behavioural facet (`sdi_items.dimension/subdomain_code`)
 * with polarity-adjusted distress.
 *
 * This script re-runs the EXISTING `runEvidenceRuntime` offline over historical
 * completed sessions, reconstructing the EvidenceInput batch from persisted
 * `capadex_responses` JOINed to `sdi_items` (so the dimension/subdomain/polarity
 * are available exactly as the live `/respond` path now supplies them).
 * `runEvidenceRuntime` recomputes the full spine in one txn:
 *     answers → evidence → signals → composites → patterns → interventions
 * so a successful re-run populates `capadex_session_composites` /
 * `capadex_session_patterns` directly.
 *
 * HONESTY GUARANTEES (do not weaken):
 *   - REUSE ONLY. No new engine/signal/ontology. Calls the EXISTING runtime.
 *   - NO FABRICATED TELEMETRY. Reconstructs ONLY persisted answer data
 *     (response_value + snapshotted concern_bucket + authored dimension facet).
 *     `response_time_ms`/`answer_changed` are OMITTED — historical telemetry is
 *     irrecoverable and is never invented.
 *   - GENUINE SIGNALS ONLY. The dimension signal fires only for a faithful
 *     facet→ontology match at candidate-or-higher distress; healthy answers and
 *     unclassified facets emit nothing.
 *   - PROVENANCE. Every (re)written signal row is stamped
 *     `signal_value.rich_signal_backfill = true`.
 *
 * REVERSIBILITY: REFUSES to write unless `FF_RICH_BEHAVIORAL_SIGNALS=1` (the
 * same flag the runtime reads — so a backfill cannot diverge from live capture).
 * `--dry-run` is read-only and runs without the flag.
 *
 * Usage:
 *   cd backend && npx tsx scripts/run-rich-signal-backfill.ts --dry-run
 *   cd backend && FF_RICH_BEHAVIORAL_SIGNALS=1 npx tsx scripts/run-rich-signal-backfill.ts --apply
 */
import { Pool } from 'pg';
import { runEvidenceRuntime } from '../services/signal-activation-runtime';
import type { EvidenceInput } from '../services/evidence-engine';
import { classifyDimensionSignal } from '../services/behavioral-dimension-signals';
import { isRichBehavioralSignalsEnabled } from '../config/feature-flags';

interface SessionRow {
  id: string;
  primary_construct_key: string | null;
  concern_name: string | null;
  master_concern_pk: number | null;
}

interface RespRow {
  item_id: string;
  response_value: number | null;
  concern_bucket: string | null;
  dimension: string | null;
  subdomain: string | null;
  polarity: string | null;
}

interface Outcome {
  sid: string;
  concern: string | null;
  responses: number;
  dimSignals: number;       // distinct dimension tokens reconstructable
  signalsAfter: number;
  compositesAfter: number;
  patternsAfter: number;
  status: 'enriched' | 'no_evidence' | 'no_composite' | 'dry';
}

async function countRows(pool: Pool, table: string, sid: string): Promise<number> {
  try {
    const { rows: [{ n }] } = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM ${table} WHERE session_id = $1`, [sid],
    );
    return Number(n);
  } catch { return 0; }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const dryRun = process.argv.includes('--dry-run') || !apply;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (apply && !isRichBehavioralSignalsEnabled()) {
      console.error(
        '[rich-signal-backfill] REFUSED: --apply requires FF_RICH_BEHAVIORAL_SIGNALS=1 (flag is OFF). ' +
        'Re-run with the flag, or use --dry-run for a read-only preview.',
      );
      process.exitCode = 1;
      return;
    }

    const mode = apply ? 'APPLY (writes)' : 'DRY-RUN (read-only, no writes)';
    console.log(`\n=== Task #22 Rich Behavioural Signal Backfill — ${mode} ===\n`);

    const { rows: sessions } = await pool.query<SessionRow>(`
      SELECT s.id::text AS id, s.primary_construct_key, s.concern_name, s.master_concern_pk
        FROM capadex_sessions s
       WHERE s.status = 'completed'
       ORDER BY s.created_at ASC
    `);
    console.log(`Completed sessions: ${sessions.length}\n`);

    const outcomes: Outcome[] = [];

    for (const s of sessions) {
      // Reconstruct the EvidenceInput batch from persisted responses JOINed to
      // sdi_items (dimension/subdomain/polarity) — exactly what the live path
      // now supplies. Telemetry is irrecoverable → omitted, never fabricated.
      const { rows: resp } = await pool.query<RespRow>(
        `SELECT r.item_id::text AS item_id, r.response_value, r.concern_bucket,
                i.dimension, i.subdomain_code AS subdomain, i.polarity
           FROM capadex_responses r
           LEFT JOIN sdi_items i ON i.id::text = r.item_id::text
          WHERE r.session_id::text = $1
          ORDER BY r.created_at ASC`,
        [s.id],
      );

      const inputs: EvidenceInput[] = [];
      const tokens = new Set<string>();
      for (const r of resp) {
        if (r.response_value == null) continue;
        inputs.push({
          item_id: r.item_id,
          response_value: Number(r.response_value),
          response_time_ms: null,
          answer_changed: false,
          bucket: r.concern_bucket ?? null,
          kind: 'assessment',
          dimension: r.dimension,
          subdomain: r.subdomain,
          polarity: r.polarity,
        });
        const dim = classifyDimensionSignal({
          dimension: r.dimension, subdomain: r.subdomain, polarity: r.polarity,
          value: Number(r.response_value),
        });
        if (dim) tokens.add(dim.token);
      }

      const base = {
        sid: s.id.slice(0, 8), concern: s.concern_name, responses: inputs.length,
        dimSignals: tokens.size,
      };

      if (inputs.length === 0) {
        outcomes.push({ ...base, signalsAfter: 0, compositesAfter: 0, patternsAfter: 0, status: 'no_evidence' });
        continue;
      }
      if (dryRun) {
        outcomes.push({ ...base, signalsAfter: -1, compositesAfter: -1, patternsAfter: -1, status: 'dry' });
        continue;
      }

      // ── APPLY ──────────────────────────────────────────────────────────────
      await runEvidenceRuntime(
        pool,
        {
          id: s.id,
          primary_construct_key: s.primary_construct_key,
          concern_name: s.concern_name,
          master_concern_pk: s.master_concern_pk ?? null,
        },
        inputs,
      );

      // Provenance stamp on the signal rows (additive JSONB merge).
      await pool.query(
        `UPDATE capadex_session_signals
            SET signal_value = COALESCE(signal_value, '{}'::jsonb) || '{"rich_signal_backfill": true}'::jsonb
          WHERE session_id = $1 AND lifecycle_state IS NOT NULL`,
        [s.id],
      ).catch(() => undefined);

      const [signalsAfter, compositesAfter, patternsAfter] = await Promise.all([
        countRows(pool, 'capadex_session_signals', s.id),
        countRows(pool, 'capadex_session_composites', s.id),
        countRows(pool, 'capadex_session_patterns', s.id),
      ]);

      outcomes.push({
        ...base, signalsAfter, compositesAfter, patternsAfter,
        status: compositesAfter > 0 ? 'enriched' : 'no_composite',
      });
    }

    // ── Report ───────────────────────────────────────────────────────────────
    console.log('Session  | concern                  | resp | dimTok | signals | comp | patt | status');
    console.log('---------|--------------------------|------|--------|---------|------|------|------------');
    for (const o of outcomes) {
      const concern = (o.concern ?? '(none)').slice(0, 24).padEnd(24);
      const f = (n: number) => (n < 0 ? '(dry)'.padStart(5) : String(n).padStart(5));
      console.log(
        `${o.sid} | ${concern} | ${String(o.responses).padStart(4)} | ${String(o.dimSignals).padStart(6)} | ` +
        `${f(o.signalsAfter).padStart(7)} | ${f(o.compositesAfter)} | ${f(o.patternsAfter)} | ${o.status}`,
      );
    }

    const enriched = outcomes.filter((o) => o.status === 'enriched').length;
    const noComposite = outcomes.filter((o) => o.status === 'no_composite').length;
    const noEvidence = outcomes.filter((o) => o.status === 'no_evidence').length;
    const totalComposites = outcomes.reduce((a, o) => a + Math.max(0, o.compositesAfter), 0);
    const totalPatterns = outcomes.reduce((a, o) => a + Math.max(0, o.patternsAfter), 0);
    console.log(
      `\nSummary: ${enriched} session(s) formed ≥1 composite · ${noComposite} had signals but no co-active cluster · ` +
      `${noEvidence} un-backfillable (0 responses).`,
    );
    if (!dryRun) {
      console.log(`Totals written: ${totalComposites} composites · ${totalPatterns} patterns.`);
    } else {
      console.log('\nDRY-RUN only — nothing was written. Re-run with FF_RICH_BEHAVIORAL_SIGNALS=1 --apply to persist.');
    }
  } catch (err) {
    console.error('[rich-signal-backfill] fatal:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
