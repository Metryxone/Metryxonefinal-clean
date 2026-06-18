/**
 * WC-L4 — Intervention Intelligence: BACKFILL (real data, idempotent, compose-only).
 *
 * Realises the WC-L4 Intervention Intelligence layer over the EXISTING completed-session base by
 * REPLAYING the same compose-and-persist the live post-completion hook runs (item 19), for every
 * completed session. It COMPOSES only already-computed intelligence — the ONLY generator is the L2
 * Outcome layer's library-backed actions (real `intervention_library` rows surfaced via
 * `getSessionOutcomes`); Stage / Journey / Decision / User / Trend / Forecast are priority/context
 * ANNOTATIONS only, and degraded journey/decision contribute ZERO. An empty / UNCLASSIFIED spine or
 * no library-backed action ⇒ ZERO interventions for that session (fail-closed, never fabricated).
 *
 * UPSERT + stale-prune per session → safe to re-run. This is the EXPLICIT/manual realisation path for
 * already-persisted sessions (the live hook only fires for newly-completed sessions). It introduces no
 * new ontology / construct / scoring / AI model and writes nothing beyond `wcl4_interventions`.
 *
 * Flags are forced ON for THIS process only (read live by isFlagEnabled → envOverride), mirroring the
 * live Backend API workflow's flag set so the backfilled rows match what the live hook would produce,
 * PLUS the WC-L4 flag itself and the Forecast flag (so forecast concern annotations realise wherever a
 * user actually has the ≥2-session trend they extrapolate from — otherwise absent, never invented).
 *
 * Usage:  cd backend && npx tsx scripts/wc3/wcl4-backfill.ts
 */

// Flags ON for THIS process only — mirror the live Backend API workflow, + WC-L4 + Forecast.
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

import { Pool } from 'pg';
import { isInterventionIntelligenceEnabled } from '../../config/feature-flags';
import { persistInterventionsForSession } from '../../services/wc3/intervention-intelligence';

async function main(): Promise<void> {
  if (!isInterventionIntelligenceEnabled()) {
    console.error(
      '[wcl4-backfill] REFUSED: requires FF_INTERVENTION_INTELLIGENCE=1 (flag is OFF). ' +
      'This script force-sets it — if you see this, the flag registry override path changed.',
    );
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows: sessions } = await pool.query(
      `SELECT id, LOWER(guest_email) AS email
         FROM capadex_sessions
        WHERE status = 'completed'
        ORDER BY created_at ASC`,
    );
    console.log(`WC-L4 backfill — composing interventions over ${sessions.length} completed sessions…\n`);

    let withInterventions = 0;
    let emptySpine = 0;
    let composeErrors = 0;
    let totalInterventions = 0;
    let journeyDegraded = 0;
    let decisionDegraded = 0;
    let withTrendConcern = 0;
    let withForecastConcern = 0;
    let priorityElevated = 0;

    for (const s of sessions) {
      const sessionId = String(s.id);
      const res = await persistInterventionsForSession(pool, sessionId);
      const n = res?.interventions.length ?? 0;
      totalInterventions += n;
      if (n > 0) withInterventions += 1; else emptySpine += 1;
      if (res?.meta.compose_error) composeErrors += 1;
      if (res?.meta.journey_degraded) journeyDegraded += 1;
      if (res?.meta.decision_degraded) decisionDegraded += 1;
      if ((res?.meta.trend_concern_count ?? 0) > 0) withTrendConcern += 1;
      if ((res?.meta.forecast_concern_count ?? 0) > 0) withForecastConcern += 1;
      if (res?.interventions.some((i) => i.priority_elevated)) priorityElevated += 1;

      const tag = (s.email ?? '(anonymous)').padEnd(28);
      const detail = n === 0
        ? `0 interventions (${res?.meta.outcome_unclassified ? 'unclassified/empty spine' : 'no library-backed action'})`
        : `${n} interventions · models=${res?.meta.outcome_models} · trendConcern=${res?.meta.trend_concern_count} · forecastConcern=${res?.meta.forecast_concern_count}`;
      console.log(`  • ${sessionId.slice(0, 8)}  ${tag}  ${detail}`);
    }

    console.log(`\nDone. ${withInterventions}/${sessions.length} sessions carry ≥1 library-backed intervention · ${emptySpine} fail-closed (honest empty state) · ${composeErrors} compose error(s).`);
    console.log(`  Total interventions persisted: ${totalInterventions}.`);
    console.log(`  Annotation context — journey degraded (zero-contribution): ${journeyDegraded}/${sessions.length} · decision degraded (zero-contribution): ${decisionDegraded}/${sessions.length}.`);
    console.log(`  Priority elevation — sessions with concern trend: ${withTrendConcern} · with concern forecast: ${withForecastConcern} · any priority-elevated intervention: ${priorityElevated}.`);
    console.log('\nReal coverage is bounded by the generator: only sessions whose outcome models carry ≥1 library-backed action can produce an intervention. Degraded journey/decision and absent trend/forecast contribute ZERO — by design, never fabricated.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
