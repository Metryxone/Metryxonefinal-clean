/**
 * WC-L1A · R2 — Journey state backfill (idempotent). RUN AFTER R3 (stage backfill).
 *
 * Populates `wc3_journey_state` for every completed session by re-running the EXISTING
 * `resolveSessionJourney`, which reads the session's stage (R3) and outcome read-only and ALWAYS routes
 * (deterministic Mentoring fallback). NO new engine/construct/ontology.
 *
 * ⚠️ HONESTY CAVEAT: because `wc3_outcome_state` is empty (Outcome is blocked at the source — that is
 * R4, intentionally NOT run here), every route falls back to the degraded floor (route_confidence ≈ 0.2,
 * degraded=true). This lifts journey COVERAGE, not journey QUALITY. Do not read the coverage gain as
 * routing readiness until Outcome is populated.
 *
 * Idempotency: `wc3_journey_state` is UPSERT on session_id and candidates are DELETE+re-INSERT — safe
 * to re-run.
 *
 * Usage:  cd backend && npx tsx scripts/wc3/wcl1a-r2-journey-backfill.ts
 */

process.env.FF_WC3_JOURNEY = '1'; // mirror workflow flag for this process

import { Pool } from 'pg';
import { resolveSessionJourney } from '../../services/wc3/journey-intelligence';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `SELECT id::text AS session_id, guest_email
         FROM capadex_sessions
        WHERE status = 'completed'
        ORDER BY updated_at`,
    );
    console.log(`WC-L1A R2 journey backfill over ${rows.length} completed sessions…`);

    let routed = 0, degraded = 0, failed = 0;
    for (const r of rows) {
      const res = await resolveSessionJourney(pool, {
        sessionId: r.session_id,
        userEmail: r.guest_email ? String(r.guest_email).toLowerCase().trim() : null,
        userId: null,
      });
      if (res) {
        routed += 1;
        if (res.degraded) degraded += 1;
        console.log(`  ✓ ${r.session_id.slice(0, 8)}…  route=${res.primary_route.route_key} conf=${res.route_confidence}${res.degraded ? ' [degraded]' : ''}`);
      } else { failed += 1; console.log(`  ✗ ${r.session_id.slice(0, 8)}…  (non-blocking failure)`); }
    }
    const total = (await pool.query(`SELECT count(*)::int n FROM wc3_journey_state`)).rows[0].n;
    console.log(`\nDone. routed=${routed} (of which degraded=${degraded}) failed=${failed}. wc3_journey_state total rows=${total}.`);
    if (degraded === routed && routed > 0) console.log('NOTE: ALL routes degraded — expected until Outcome (R4) is unblocked. Coverage ↑, quality unchanged.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
