/**
 * TASK #261 — Realized-promotion capture validation.
 *
 * The talent engine PREDICTS promotion_probability (ti_outcome_predictions) but the platform had no
 * event that records a REALIZED employee promotion, so the promotion calibration axis could never
 * move past ABSTAIN without fabricating an outcome. Task #261 adds `recordRealizedPromotionOutcome`
 * (+ POST /api/admin/talent/predictions/:email/promotion-outcome) which turns a genuine promotion
 * decision into a durable validation_loop_outcomes row using the standing decision-time
 * promotion_probability as the prediction.
 *
 * What this proves (the task's "Done looks like"):
 *   1. Recording a realized promotion for a talent WITH a standing prediction snapshots that
 *      promotion_probability as predicted_prob_at_decision (outcome_type='promotion').
 *   2. Recording without a prediction row stores predicted_prob_at_decision=NULL (Coverage-only,
 *      never a fabricated pair).
 *   3. Idempotency: re-recording the same (email, rf_id, decision_ref) does NOT duplicate the row.
 *   4. A distinct decision_ref (new promotion cycle) IS a separate row.
 *   5. Demo (@example.com) rows record is_demo=true so calibration keeps EXCLUDING them → Confidence
 *      stays ABSTAINED (no non-demo pairs accrue from this test).
 *
 * All artifacts are @example.com and removed on exit. No engine output is fabricated.
 *
 * Run: cd backend && npx tsx scripts/task261-promotion-outcome-validate.ts
 * (validationLoop defaults ON; FF_CAREER_GRAPH is irrelevant here — we call the exported helper.)
 */

import { Pool } from 'pg';
import { recordRealizedPromotionOutcome } from '../routes/talent-outcome-prediction';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let failures = 0;
let stepNo = 0;
function step(name: string) { stepNo += 1; console.log(`\n[${String(stepNo).padStart(2, '0')}] ${name}`); }
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`     ✓ ${msg}`);
  else { failures += 1; console.error(`     ✗ FAIL: ${msg}`); }
}

const EMAIL = `task261.promo.${Date.now()}@example.com`;
const NOPRED_EMAIL = `task261.nopred.${Date.now()}@example.com`;
const RF_ID = 990261;
const PROMO_PROB = 0.7321;

async function countPromotionRows(email: string): Promise<{ total: number; pred: number | null; demo: boolean | null }[]> {
  const r = await pool.query(
    `SELECT predicted_prob_at_decision AS pred, is_demo AS demo, ref_id
       FROM validation_loop_outcomes
      WHERE subject_email=$1 AND outcome_type='promotion' ORDER BY ref_id`,
    [email],
  );
  return r.rows.map((x: any) => ({ total: 1, pred: x.pred == null ? null : Number(x.pred), demo: x.demo }));
}

async function cleanup() {
  await pool.query(`DELETE FROM validation_loop_outcomes WHERE subject_email IN ($1,$2)`, [EMAIL, NOPRED_EMAIL]).catch(() => {});
  await pool.query(`DELETE FROM ti_outcome_predictions WHERE user_email=$1`, [EMAIL]).catch(() => {});
}

async function main() {
  try {
    step('Seed a demo talent prediction with a known promotion_probability');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ti_outcome_predictions (
        id SERIAL PRIMARY KEY, user_email TEXT NOT NULL, rf_id INTEGER, rf_name TEXT, blueprint_key TEXT,
        promotion_probability NUMERIC(5,4), role_success_probability NUMERIC(5,4), leadership_potential NUMERIC(5,4),
        future_employability NUMERIC(5,4), career_velocity NUMERIC(5,4), talent_risk NUMERIC(5,4),
        prediction_confidence NUMERIC(5,4), prediction_basis JSONB DEFAULT '{}', key_drivers JSONB DEFAULT '[]',
        risk_factors JSONB DEFAULT '[]', predicted_at TIMESTAMPTZ DEFAULT NOW(),
        valid_until TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days', UNIQUE(user_email, rf_id));
    `);
    await pool.query(
      `INSERT INTO ti_outcome_predictions(user_email,rf_id,rf_name,promotion_probability)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(user_email,rf_id) DO UPDATE SET promotion_probability=$4`,
      [EMAIL, RF_ID, 'Task261 Role', PROMO_PROB],
    );
    console.log(`     seeded prediction ${PROMO_PROB} for ${EMAIL} (rf ${RF_ID})`);

    step('Record a realized promotion (promoted=1) — snapshots the decision-time prediction');
    const r1 = await recordRealizedPromotionOutcome(pool, { email: EMAIL, rfId: RF_ID, outcome: 1, decisionRef: 'cycle-2026-h1' });
    assert(r1.recorded === true, `recorded=true (got ${JSON.stringify(r1)})`);
    assert(r1.predicted_prob === PROMO_PROB, `prediction snapshot = ${PROMO_PROB} (got ${r1.predicted_prob})`);
    let rows = await countPromotionRows(EMAIL);
    assert(rows.length === 1, `exactly ONE promotion row (got ${rows.length})`);
    assert(rows[0]?.pred === PROMO_PROB, `predicted_prob_at_decision persisted = ${PROMO_PROB} (got ${rows[0]?.pred})`);
    assert(rows[0]?.demo === true, `is_demo=true for @example.com (got ${rows[0]?.demo})`);

    step('Idempotency: re-record the SAME cycle → still ONE row (no duplicate)');
    await recordRealizedPromotionOutcome(pool, { email: EMAIL, rfId: RF_ID, outcome: 1, decisionRef: 'cycle-2026-h1' });
    rows = await countPromotionRows(EMAIL);
    assert(rows.length === 1, `still ONE row after re-record (got ${rows.length})`);

    step('A NEW decision cycle (distinct decision_ref) IS a separate row');
    await recordRealizedPromotionOutcome(pool, { email: EMAIL, rfId: RF_ID, outcome: 0, decisionRef: 'cycle-2026-h2' });
    rows = await countPromotionRows(EMAIL);
    assert(rows.length === 2, `TWO rows across two cycles (got ${rows.length})`);

    step('No standing prediction → Coverage-only row with NULL prediction (never fabricated)');
    const r2 = await recordRealizedPromotionOutcome(pool, { email: NOPRED_EMAIL, outcome: 1, decisionRef: 'cycle-x' });
    assert(r2.recorded === true, `recorded=true even with no prediction (got ${JSON.stringify(r2)})`);
    assert(r2.predicted_prob === null, `prediction is NULL when none exists (got ${r2.predicted_prob})`);
    const npRows = await countPromotionRows(NOPRED_EMAIL);
    assert(npRows.length === 1 && npRows[0]?.pred === null, `one Coverage-only NULL-prediction row (got ${JSON.stringify(npRows)})`);

    step('Input guards: bad outcome value is rejected (no fabricated 0/1)');
    const bad = await recordRealizedPromotionOutcome(pool, { email: EMAIL, outcome: 2 as any, decisionRef: 'bad' });
    assert(bad.recorded === false && bad.reason === 'outcome_must_be_0_or_1', `rejected non-binary outcome (got ${JSON.stringify(bad)})`);

    console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`);
  } finally {
    step('Cleanup demo artifacts');
    await cleanup();
    console.log('     removed @example.com test rows');
    await pool.end();
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
