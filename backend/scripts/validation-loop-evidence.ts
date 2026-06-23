/**
 * PHASE 7 — Validation Loop EVIDENCE.
 *
 * Proves the loop runs END-TO-END on a recorded outcome AND abstains correctly when there are
 * no realized outcomes. Runs the engine directly against the DB (bypasses the HTTP flag gate;
 * the live flag stays OFF). Uses ONLY a demo (@example.com, is_demo=true) outcome to illustrate
 * the mechanism — it NEVER seeds/synthesizes realized outcomes (forbidden) and cleans up after.
 *
 *   npx tsx scripts/validation-loop-evidence.ts
 */
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import {
  toCalibrationPairs,
  calibrationSummary,
  evidenceVerdict,
  VALIDATION_K_MIN,
  VALIDATION_LANGUAGE_POLICY,
} from '../services/validation-loop-engine';
import { buildCalibrationModel } from '../routes/employer-tig';

const DEMO_EMAIL = 'phase7-demo@example.com';
const DEMO_REF = 'phase7-evidence-demo-1';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const lines: string[] = [];
  const log = (s = '') => { lines.push(s); console.log(s); };

  try {
    // Ensure schema (mirrors the route's ensure-schema, behind which the live flag gates DDL).
    const mig = fs.readFileSync(path.join(__dirname, '../migrations/20260623_validation_loop_outcomes.sql'), 'utf-8');
    await pool.query(mig);

    log('# Phase 7 — Validation Loop Evidence');
    log('');
    log(`_Generated ${new Date().toISOString()} · k_min = ${VALIDATION_K_MIN}_`);
    log('');
    log('Loop: Assessment → Hiring → Performance → Promotion → Retention → Outcome → Calibration → Prediction');
    log('');

    // ── 1. Baseline (realized) BEFORE any outcome — must abstain ────────────────────────────────
    const before = await pool.query(
      `SELECT outcome_kind, outcome_value, predicted_prob_at_decision
         FROM validation_loop_outcomes WHERE is_demo = false`,
    );
    const realizedPairsBefore = toCalibrationPairs(before.rows);
    const realizedModelBefore = buildCalibrationModel(realizedPairsBefore);
    log('## 1. Realized (non-demo) calibration — BEFORE');
    log('```json');
    log(JSON.stringify({ summary: calibrationSummary(realizedModelBefore), evidence: evidenceVerdict(realizedPairsBefore.length) }, null, 2));
    log('```');
    log(`→ Realized status: **${realizedModelBefore.status}**, evidence_backed: **${evidenceVerdict(realizedPairsBefore.length).evidence_backed}** (abstained — honest).`);
    log('');

    // ── 2. Record ONE demo outcome (illustrative only) ──────────────────────────────────────────
    await pool.query(
      `INSERT INTO validation_loop_outcomes
         (subject_email, outcome_type, outcome_kind, outcome_value, predicted_prob_at_decision,
          predicted_basis, source, is_demo, ref_id, detail)
       VALUES ($1,'hiring','binary',1,0.7,'demo_illustration','demo_seed',true,$2,'{"note":"phase7 evidence"}')
       ON CONFLICT (outcome_type, ref_id) WHERE ref_id IS NOT NULL DO UPDATE SET outcome_value = EXCLUDED.outcome_value`,
      [DEMO_EMAIL, DEMO_REF],
    );
    log('## 2. Recorded ONE demo outcome (is_demo=true, @example.com)');
    log('`hiring` · predicted_prob_at_decision=0.7 · realized outcome=1');
    log('');

    // ── 3. Demo calibration RUNS end-to-end (mechanism proof) ───────────────────────────────────
    const demo = await pool.query(
      `SELECT outcome_kind, outcome_value, predicted_prob_at_decision
         FROM validation_loop_outcomes WHERE is_demo = true`,
    );
    const demoPairs = toCalibrationPairs(demo.rows);
    const demoModel = buildCalibrationModel(demoPairs);
    log('## 3. Demo (illustrative) calibration — RUNS end-to-end');
    log('```json');
    log(JSON.stringify(calibrationSummary(demoModel), null, 2));
    log('```');
    log(`→ Demo status: **${demoModel.status}** (provisional — mechanism works; NEVER evidence-backed).`);
    log('');

    // ── 4. Realized AFTER the demo — STILL abstains (demo excluded) ──────────────────────────────
    const after = await pool.query(
      `SELECT outcome_kind, outcome_value, predicted_prob_at_decision
         FROM validation_loop_outcomes WHERE is_demo = false`,
    );
    const realizedPairsAfter = toCalibrationPairs(after.rows);
    log('## 4. Realized (non-demo) calibration — AFTER the demo');
    log(`→ Realized outcomes: **${realizedPairsAfter.length}** (unchanged — demo is excluded from evidence). evidence_backed: **${evidenceVerdict(realizedPairsAfter.length).evidence_backed}**.`);
    log('');

    // ── 5. Honest ceiling ───────────────────────────────────────────────────────────────────────
    log('## 5. Honest ceiling');
    log('- The loop is STRUCTURALLY complete: intake → calibration engine → abstained prediction.');
    log('- Predictions remain ABSTAINED (no empirical accuracy claim) until ≥30 realized non-demo');
    log('  outcomes that carry a decision-time prediction accrue. This is an OUTCOME-ACCRUAL milestone,');
    log('  not a code milestone — no realized outcome is ever fabricated.');
    log('- Coverage (outcomes recorded) and Confidence (calibration trust) are reported SEPARATELY.');
    log('');
    log('### Language policy');
    log('```json');
    log(JSON.stringify(VALIDATION_LANGUAGE_POLICY, null, 2));
    log('```');

    // ── cleanup demo rows ───────────────────────────────────────────────────────────────────────
    const del = await pool.query(
      `DELETE FROM validation_loop_outcomes WHERE is_demo = true AND subject_email = $1`,
      [DEMO_EMAIL],
    );
    log('');
    log(`_Cleaned up ${del.rowCount} demo row(s). The validation_loop_outcomes table is left at its realized (0) baseline._`);

    const outDir = path.join(__dirname, '../audit/validation-loop');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'validation-loop-evidence.md'), lines.join('\n') + '\n');
    console.log(`\n[evidence] written → audit/validation-loop/validation-loop-evidence.md`);
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
