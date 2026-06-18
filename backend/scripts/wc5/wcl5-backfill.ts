/**
 * WC-L5 — Memory Intelligence: BACKFILL (snapshot-only, idempotent, UPSERT-only).
 *
 * Realises the WC-L5 Memory layer over the EXISTING completed-session base by REPLAYING the same
 * snapshot-and-persist the live post-completion hook runs (item 20), for every completed session. It
 * SNAPSHOTS only already-computed intelligence — Stage / Outcome / Journey / Decision / User+Trend
 * (folded into behaviour_memory) / Forecast / persisted Intervention. An absent / UNCLASSIFIED / empty
 * layer ⇒ NO memory row for that type (fail-closed, never fabricated). It introduces no new ontology /
 * construct / scoring / AI model and writes nothing beyond `wcl5_memory`.
 *
 * UPSERT-ONLY (no destructive write, no stale-prune) on (session_id, memory_type, memory_key) → safe to
 * re-run; `created_at` is preserved on conflict and distinct session_ids preserve history.
 *
 * ORDERING: run this AFTER `scripts/wc3/wcl4-backfill.ts` — `intervention_memory` reads the
 * already-PERSISTED `wcl4_interventions`; if WC-L4 has not been backfilled, intervention_memory is
 * honestly 0 (reported explicitly below, never silently zeroed).
 *
 * SAFETY: DRY RUN by default — it composes + tallies but writes NOTHING. Pass `--apply` to persist.
 * Flags are forced ON for THIS process only (read live by isFlagEnabled → envOverride), mirroring the
 * live Backend API workflow's flag set + Forecast + Intervention + the WC-L5 flag itself, so the
 * snapshotted rows match what the live hook would produce.
 *
 * Usage:  cd backend && npx tsx scripts/wc5/wcl5-backfill.ts            # dry run
 *         cd backend && npx tsx scripts/wc5/wcl5-backfill.ts --apply    # write
 */

// Flags ON for THIS process only — mirror the live Backend API workflow, + Forecast + Intervention + WC-L5.
process.env.FF_RUNTIME_INTELLIGENCE_ACTIVATION = '1';
process.env.FF_RUNTIME_INTELLIGENCE_PIPELINE = '1';
process.env.FF_WC3_STAGE = '1';
process.env.FF_WC3_OUTCOME = '1';
process.env.FF_WC3_JOURNEY = '1';
process.env.FF_WC3_PERSONALIZATION = '1';
process.env.FF_WC3_LONGITUDINAL = '1';
process.env.FF_DECISION_ORCHESTRATOR = '1';
process.env.FF_DECISION_PERSISTENCE = '1';
process.env.FF_BEHAVIOUR_NAMESPACE_ALIGNMENT = '1';
process.env.FF_FORECAST_INTELLIGENCE = '1';
process.env.FF_INTERVENTION_INTELLIGENCE = '1';
process.env.FF_MEMORY_INTELLIGENCE = '1';

import { Pool } from 'pg';
import { isMemoryIntelligenceEnabled } from '../../config/feature-flags';
import { composeMemory, persistMemoryForSession, type MemoryResult } from '../../services/wc5/memory-intelligence';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  if (!isMemoryIntelligenceEnabled()) {
    console.error(
      '[wcl5-backfill] REFUSED: requires FF_MEMORY_INTELLIGENCE=1 (flag is OFF). ' +
      'This script force-sets it — if you see this, the flag registry override path changed.',
    );
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // ── WC-L4 dependency check (honest, not silent) ──
    const wcl4 = await pool
      .query(`SELECT COUNT(*)::int AS n FROM wcl4_interventions`)
      .catch(() => ({ rows: [{ n: -1 }] }));
    const wcl4Count: number = wcl4.rows[0].n;
    if (wcl4Count < 0) {
      console.warn('[wcl5-backfill] ⚠ wcl4_interventions table ABSENT — intervention_memory will be 0. Run scripts/wc3/wcl4-backfill.ts --apply first.');
    } else if (wcl4Count === 0) {
      console.warn('[wcl5-backfill] ⚠ wcl4_interventions is EMPTY — intervention_memory will be 0. Run scripts/wc3/wcl4-backfill.ts --apply first.');
    } else {
      console.log(`[wcl5-backfill] wcl4_interventions has ${wcl4Count} persisted row(s) — intervention_memory can be snapshotted.`);
    }

    const { rows: sessions } = await pool.query(
      `SELECT id, LOWER(guest_email) AS email
         FROM capadex_sessions
        WHERE status = 'completed'
        ORDER BY created_at ASC`,
    );
    console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} — WC-L5 memory snapshot over ${sessions.length} completed sessions…\n`);

    let withMemory = 0, empty = 0, composeErrors = 0, totalRows = 0;
    let withStage = 0, withOutcome = 0, withJourney = 0, journeyDeg = 0;
    let withDecision = 0, decisionDeg = 0, withUser = 0, withTrend = 0, withForecast = 0;
    let withIntervention = 0, intvSourceEmpty = 0;
    const typeSet = new Set<string>();

    for (const s of sessions) {
      const sid = String(s.id);
      const res: MemoryResult | null = APPLY
        ? await persistMemoryForSession(pool, sid)
        : await composeMemory(pool, sid);
      if (!res) { composeErrors += 1; empty += 1; continue; }

      const m = res.meta;
      totalRows += m.rows;
      if (m.rows > 0) withMemory += 1; else empty += 1;
      if (m.compose_error) composeErrors += 1;
      if (m.has_stage) withStage += 1;
      if (m.outcome_models > 0) withOutcome += 1;
      if (m.journey_present) { withJourney += 1; if (m.journey_degraded) journeyDeg += 1; }
      if (m.decision_present) { withDecision += 1; if (m.decision_degraded) decisionDeg += 1; }
      if (m.has_user) withUser += 1;
      if (m.trend_count > 0) withTrend += 1;
      if (m.forecast_count > 0) withForecast += 1;
      if (m.intervention_count > 0) withIntervention += 1;
      if (m.intervention_source_empty) intvSourceEmpty += 1;
      res.records.forEach((r) => typeSet.add(r.memory_type));

      const tag = (s.email ?? '(anonymous)').padEnd(28);
      const jrn = m.journey_present ? (m.journey_degraded ? 'deg' : 'real') : '-';
      const dec = m.decision_present ? (m.decision_degraded ? 'deg' : 'real') : '-';
      console.log(
        `  • ${sid.slice(0, 8)}  ${tag}  ${m.rows} rows · types=${m.types_present} · ` +
        `stage=${m.has_stage ? 1 : 0} outcome=${m.outcome_models} journey=${jrn} decision=${dec} ` +
        `user=${m.has_user ? 1 : 0} trend=${m.trend_count} forecast=${m.forecast_count} intv=${m.intervention_count}` +
        (m.compose_error ? '  [COMPOSE_ERROR]' : ''),
      );
    }

    console.log(`\n${APPLY ? 'Persisted' : 'Would persist (dry run)'} — ${withMemory}/${sessions.length} sessions carry ≥1 memory row · ${empty} fail-closed empty · ${composeErrors} compose error(s). Total memory rows: ${totalRows}.`);
    console.log(`  Memory types present overall: ${Array.from(typeSet).sort().join(', ') || '(none)'}.`);
    console.log(`  Per type — stage ${withStage} · outcome ${withOutcome} · journey ${withJourney} (${journeyDeg} degraded) · decision ${withDecision} (${decisionDeg} degraded) · user ${withUser} · trend ${withTrend} · forecast ${withForecast} · intervention ${withIntervention}.`);
    console.log(`  Intervention source absent/empty for ${intvSourceEmpty}/${sessions.length} sessions (honest — bounded by WC-L4 persistence).`);
    console.log('\nMemory is a verbatim SNAPSHOT of already-computed intelligence: absent/UNCLASSIFIED layers contribute zero rows — by design, never fabricated.');
    if (!APPLY) console.log('\nDRY RUN — nothing written. Re-run with --apply to persist.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
