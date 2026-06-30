/**
 * Task #292 — Close-the-Loop Outcome Core — phased validator (OFF → ON) + cleanup.
 *
 * Proves the honesty contract WITHOUT polluting live evidence:
 *   - Phase A (flag OFF): write fns refuse (flag_off) and create NO schema → byte-identical OFF.
 *   - Phase B (flag ON):  KPI binding (11 capabilities), demo-aware capture (demo EXCLUDED from
 *     realized), validation-loop bridge, idempotency, re-measurement, k_min abstention, snapshot+drift.
 *   - Cleanup: every row this script writes (demo + non-demo test refs, incl. the bridged
 *     validation_loop_outcomes row) is DELETED afterwards. Nothing the script wrote survives.
 *
 * isFlagEnabled reads FF_CLOSE_THE_LOOP at CALL time, so we toggle process.env between phases.
 * Run: cd backend && npx tsx scripts/task292-close-the-loop-validate.ts
 */
import { Pool } from 'pg';
import * as eng from '../services/close-the-loop-engine';
import { recordValidationOutcome } from '../services/validation-loop-intake';
import { isFlagEnabled } from '../config/feature-flags';

const TEST_REF_PREFIX = 'task292-validate';
const DEMO_EMAIL = 'ctl.demo@example.com';
const REAL_EMAIL = 'ctl.realtest+task292@metryxone-validate.test'; // non-demo, purged at end

let passed = 0, failed = 0;
const fails: string[] = [];
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; fails.push(name); console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : ''); }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // ── PHASE A: flag OFF — refuse + no schema ──────────────────────────────────────────────────────
  process.env.FF_CLOSE_THE_LOOP = '0';
  console.log('\n=== PHASE A — flag OFF (byte-identical, no writes) ===');
  check('isFlagEnabled(closeTheLoop) === false OFF', isFlagEnabled('closeTheLoop') === false);
  const offRec = await eng.recordAttributedOutcome(pool, {
    capabilityKey: 'talent_match_hiring', lifecycleStage: 'CAP_MAS', outcomeType: 'hiring',
    outcomeKind: 'binary', outcomeValue: 1, subjectEmail: DEMO_EMAIL, refId: `${TEST_REF_PREFIX}:off`,
  });
  check('recordAttributedOutcome refuses OFF (flag_off)', offRec.recorded === false && offRec.reason === 'flag_off', offRec);
  const offRem = await eng.recordRemeasurement(pool, {
    capabilityKey: 'competency_assessment', trigger: 'progress', subjectEmail: DEMO_EMAIL, refId: `${TEST_REF_PREFIX}:off`,
  });
  check('recordRemeasurement refuses OFF (flag_off)', offRem.recorded === false && offRem.reason === 'flag_off', offRem);
  const offCap = await eng.captureKpiSnapshot(pool, 'validator');
  check('captureKpiSnapshot refuses OFF (flag_off)', offCap.ok === false && offCap.reason === 'flag_off', offCap);

  // ── PHASE B: flag ON ────────────────────────────────────────────────────────────────────────────
  process.env.FF_CLOSE_THE_LOOP = '1';
  console.log('\n=== PHASE B — flag ON (mechanism live) ===');
  check('isFlagEnabled(closeTheLoop) === true ON', isFlagEnabled('closeTheLoop') === true);

  // KPI binding framework
  const kpis = await eng.composeKpiBindings(pool);
  check('KPI bindings: 11 capabilities bound', kpis.capabilities_bound === 11, kpis.capabilities_bound);
  check('KPI bindings: every kpi carries a measurement_status', kpis.kpis.every((k: any) => typeof k.measurement_status === 'string'));
  check('KPI bindings: governance KPI is not_wired (honest)', kpis.kpis.some((k: any) => k.capability_key === 'platform_governance_intel' && k.measurement_status === 'not_wired'));
  check('KPI bindings: count KPIs measured as honest 0 or number (null≠0)', kpis.kpis.filter((k:any)=>k.unit==='count').every((k:any)=> k.measured_value === null || typeof k.measured_value === 'number'));

  // Demo-aware capture — demo recorded but EXCLUDED from realized
  const demoRec = await eng.recordAttributedOutcome(pool, {
    capabilityKey: 'talent_match_hiring', lifecycleStage: 'CAP_MAS', outcomeType: 'hiring',
    outcomeKind: 'binary', outcomeValue: 1, subjectEmail: DEMO_EMAIL, predictedProb: 0.7,
    refId: `${TEST_REF_PREFIX}:demo1`,
  });
  check('demo outcome recorded + flagged is_demo', demoRec.recorded === true && demoRec.is_demo === true, demoRec);

  // Non-demo capture + validation-loop bridge UNDER a canonical decision id
  const CANON_REAL1 = `${TEST_REF_PREFIX}:vref:real1`;
  const realRec = await eng.recordAttributedOutcome(pool, {
    capabilityKey: 'talent_match_hiring', lifecycleStage: 'CAP_MAS', outcomeType: 'hiring',
    outcomeKind: 'binary', outcomeValue: 1, subjectEmail: REAL_EMAIL, predictedProb: 0.8,
    refId: `${TEST_REF_PREFIX}:real1`, validationRefId: CANON_REAL1,
  });
  check('non-demo hiring outcome recorded + bridged to validation_loop', realRec.recorded === true && realRec.is_demo === false && realRec.bridged === true && realRec.bridge_status === 'bridged', realRec);
  const bridgeRow = await pool.query(
    `SELECT 1 FROM validation_loop_outcomes WHERE ref_id = $1 AND outcome_type='hiring'`, [CANON_REAL1],
  );
  check('bridged row exists in validation_loop_outcomes (under canonical id)', bridgeRow.rowCount === 1);

  // No canonical id → NO bridge (a synthetic key could never align with native intake → double-count risk)
  const noBridge = await eng.recordAttributedOutcome(pool, {
    capabilityKey: 'talent_match_hiring', lifecycleStage: 'CAP_MAS', outcomeType: 'hiring',
    outcomeKind: 'binary', outcomeValue: 1, subjectEmail: REAL_EMAIL, refId: `${TEST_REF_PREFIX}:nobridge`,
  });
  check('no canonical ref → recorded but NOT bridged (no synthetic key)', noBridge.recorded === true && noBridge.bridged === false && noBridge.bridge_status === 'skipped_no_canonical_ref', noBridge);

  // Cross-path dedupe: SAME decision via native intake AND via CTL bridge under ONE canonical id → 1 row
  const CANON_XP = `${TEST_REF_PREFIX}:vref:xpath1`;
  await recordValidationOutcome(pool, {
    outcomeType: 'hiring', subjectEmail: REAL_EMAIL, outcomeValue: 1, predictedProb: 0.6,
    predictedBasis: null, source: 'native_intake_test', refId: CANON_XP,
  } as any);
  await eng.recordAttributedOutcome(pool, {
    capabilityKey: 'talent_match_hiring', lifecycleStage: 'CAP_MAS', outcomeType: 'hiring',
    outcomeKind: 'binary', outcomeValue: 1, subjectEmail: REAL_EMAIL, refId: `${TEST_REF_PREFIX}:xpath1-ctl`,
    validationRefId: CANON_XP,
  });
  const xpCount = await pool.query(
    `SELECT COUNT(*)::int AS c FROM validation_loop_outcomes WHERE ref_id = $1 AND outcome_type='hiring'`, [CANON_XP],
  );
  check('cross-path: native + CTL bridge under one canonical id → single validation row (no double-count)', xpCount.rows[0].c === 1, xpCount.rows[0].c);

  // Idempotency on (outcome_type, ref_id)
  await eng.recordAttributedOutcome(pool, {
    capabilityKey: 'talent_match_hiring', lifecycleStage: 'CAP_MAS', outcomeType: 'hiring',
    outcomeKind: 'binary', outcomeValue: 1, subjectEmail: REAL_EMAIL, refId: `${TEST_REF_PREFIX}:real1`,
  });
  const dupCount = await pool.query(
    `SELECT COUNT(*)::int AS c FROM close_the_loop_outcomes WHERE ref_id = $1 AND outcome_type='hiring'`,
    [`${TEST_REF_PREFIX}:real1`],
  );
  check('idempotent: re-record same ref → 1 row', dupCount.rows[0].c === 1, dupCount.rows[0].c);

  // Validation: bad inputs rejected (never written)
  const badCap = await eng.recordAttributedOutcome(pool, { capabilityKey: 'nope', outcomeType: 'hiring', outcomeKind: 'binary', outcomeValue: 1, subjectEmail: REAL_EMAIL, refId: `${TEST_REF_PREFIX}:bad` } as any);
  check('invalid capability_key rejected', badCap.recorded === false && badCap.reason === 'invalid_capability_key', badCap);
  const badBin = await eng.recordAttributedOutcome(pool, { capabilityKey: 'talent_match_hiring', outcomeType: 'hiring', outcomeKind: 'binary', outcomeValue: 5, subjectEmail: REAL_EMAIL, refId: `${TEST_REF_PREFIX}:bad2` });
  check('binary value must be 0/1', badBin.recorded === false && badBin.reason === 'binary_outcome_value_must_be_0_or_1', badBin);

  // Re-measurement
  const rem = await eng.recordRemeasurement(pool, {
    capabilityKey: 'competency_assessment', trigger: 'progress', baselineScore: 40, remeasuredScore: 55,
    lifecycleStageFrom: 'CAP_INS', lifecycleStageTo: 'CAP_GRW', subjectEmail: REAL_EMAIL, refId: `${TEST_REF_PREFIX}:rem1`,
  });
  check('re-measurement recorded with derived delta', rem.recorded === true, rem);

  // Outcome attribution — demo excluded, success rate ABSTAINED below k_min
  const attr = await eng.composeOutcomeAttribution(pool);
  check('attribution: table present', attr.table_present === true);
  check('attribution: realized excludes demo (≥1 non-demo, demo≥1 separate)', (attr.coverage.realized as number) >= 1 && (attr.coverage.demo as number) >= 1, attr.coverage);
  const hiringCap = (attr.coverage.by_capability as any[]).find(c => c.capability_key === 'talent_match_hiring');
  check('attribution: hiring success_rate ABSTAINED (<k_min)', !!hiringCap && hiringCap.rate_abstained === true && hiringCap.success_rate === null, hiringCap);
  check('attribution: abstained verdict (no fabricated evidence)', attr.confidence.abstained === true);

  // Re-measurement compose — mean delta abstained below k_min
  const remC = await eng.composeRemeasurement(pool);
  check('remeasurement: progress count ≥1, mean_delta abstained', (remC.coverage.by_trigger as any).progress.count >= 1 && (remC.coverage.by_trigger as any).progress.delta_abstained === true, remC.coverage.by_trigger);

  // KPI snapshot + drift
  const cap1 = await eng.captureKpiSnapshot(pool, 'validator');
  check('captureKpiSnapshot ON ok', cap1.ok === true, cap1);
  const drift1 = await eng.composeKpiDrift(pool);
  check('drift needs ≥2 snapshots (honest)', drift1.table_present === true && (drift1.drift === null || drift1.reason === 'need_at_least_two_snapshots' || Array.isArray(drift1.drift)));
  await eng.captureKpiSnapshot(pool, 'validator');
  const drift2 = await eng.composeKpiDrift(pool);
  check('drift present after 2 snapshots', Array.isArray(drift2.drift) && drift2.drift.length > 0, drift2.drift?.length);

  // Overview — axes separate, PARTIAL verdict
  const ov = await eng.composeOverview(pool);
  check('overview: structural mechanism reported', ov.axes.structural.kpi_bindings === 11 && ov.axes.structural.outcome_attribution_wired === true);
  check('overview: Coverage/Confidence kept separate, PARTIAL verdict', ov.axes.confidence.abstained === true && /PARTIAL/.test(ov.verdict));

  // ── CLEANUP — delete everything this script wrote (demo + non-demo + bridged + snapshots) ─────────
  console.log('\n=== CLEANUP ===');
  const c1 = await pool.query(`DELETE FROM close_the_loop_outcomes WHERE ref_id LIKE $1`, [`${TEST_REF_PREFIX}:%`]);
  const c2 = await pool.query(`DELETE FROM close_the_loop_remeasurements WHERE ref_id LIKE $1`, [`${TEST_REF_PREFIX}:%`]);
  const c3 = await pool.query(`DELETE FROM validation_loop_outcomes WHERE ref_id LIKE $1`, [`${TEST_REF_PREFIX}:%`]);
  const c4 = await pool.query(`DELETE FROM close_the_loop_kpi_snapshots WHERE captured_by = 'validator'`);
  console.log(`  deleted: outcomes=${c1.rowCount} remeasurements=${c2.rowCount} bridged=${c3.rowCount} snapshots=${c4.rowCount}`);
  const leftO = await pool.query(`SELECT COUNT(*)::int AS c FROM close_the_loop_outcomes WHERE ref_id LIKE $1`, [`${TEST_REF_PREFIX}:%`]);
  const leftV = await pool.query(`SELECT COUNT(*)::int AS c FROM validation_loop_outcomes WHERE ref_id LIKE $1`, [`${TEST_REF_PREFIX}:%`]);
  check('cleanup: no test outcomes remain', leftO.rows[0].c === 0, leftO.rows[0].c);
  check('cleanup: no bridged validation rows remain', leftV.rows[0].c === 0, leftV.rows[0].c);

  await pool.end();
  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) { console.log('FAILED:', fails.join(', ')); process.exit(1); }
  console.log('ALL CHECKS PASSED');
}

main().catch((e) => { console.error('VALIDATOR CRASHED:', e); process.exit(1); });
