/**
 * PHASE 7 — Validation Loop SMOKE.
 *
 *   npx tsx scripts/smoke-validation-loop.ts
 *
 * Asserts (NO DB writes):
 *  1. HTTP flag-OFF contract: every route is REGISTERED (not 404) and gated (∈ {401,403,503}).
 *     (The global auth gate + flag gate make the exact code env-dependent — the platform precedent
 *      is to accept the {401,403,503} set; 404 would mean the route never registered.)
 *  2. Engine: empty → cold_start + abstained (evidence_backed false, brier null).
 *  3. Engine: demo pairs < k_min → provisional, NEVER calibrated.
 *  4. Engine: ≥ k_min pairs → calibrated (the mechanism reaches calibrated only at the gate).
 *  5. Language policy disallows empirical-accuracy claims.
 *  6. Invalid outcome_type is rejected by the pure validator.
 */
import {
  toCalibrationPairs,
  isValidOutcomeType,
  evidenceVerdict,
  VALIDATION_K_MIN,
  VALIDATION_LANGUAGE_POLICY,
  OUTCOME_TYPES,
} from '../services/validation-loop-engine';
import { buildCalibrationModel } from '../routes/employer-tig';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:8080';
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
};

async function httpStatus(method: string, pathname: string, body?: any): Promise<number> {
  try {
    const res = await fetch(`${BASE}${pathname}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.status;
  } catch {
    return 0;
  }
}

async function main() {
  console.log('\n=== Phase 7 — Validation Loop smoke ===\n');

  // 1. HTTP flag-OFF / unauth contract
  console.log('[1] HTTP route contract (flag OFF in the live workflow)');
  const gated = new Set([401, 403, 503]);
  const sStatus = await httpStatus('GET', '/api/validation-loop/status');
  const sPost = await httpStatus('POST', '/api/validation-loop/outcomes', {});
  const sCalib = await httpStatus('GET', '/api/validation-loop/calibration');
  ok(`GET /status registered & gated (${sStatus})`, gated.has(sStatus), `got ${sStatus}`);
  ok(`POST /outcomes registered & gated (${sPost})`, gated.has(sPost), `got ${sPost}`);
  ok(`GET /calibration registered & gated (${sCalib})`, gated.has(sCalib), `got ${sCalib}`);
  ok('no route returns 404 (all registered)', ![sStatus, sPost, sCalib].includes(404));

  // 2. Empty → cold_start + abstain
  console.log('\n[2] Engine: empty → cold_start + abstained');
  const empty = buildCalibrationModel(toCalibrationPairs([]));
  ok('empty status === cold_start', empty.status === 'cold_start', empty.status);
  ok('empty brier === null', empty.brier === null);
  ok('empty evidence_backed === false', evidenceVerdict(0).evidence_backed === false);

  // 3. Demo < k_min → provisional, never calibrated
  console.log('\n[3] Engine: < k_min realized → provisional (never calibrated)');
  const fewRows = Array.from({ length: 5 }, (_, i) => ({
    outcome_kind: 'binary', outcome_value: i % 2, predicted_prob_at_decision: 0.4 + i * 0.05,
  }));
  const fewModel = buildCalibrationModel(toCalibrationPairs(fewRows));
  ok('5 pairs → provisional', fewModel.status === 'provisional', fewModel.status);
  ok('5 pairs → NOT calibrated', fewModel.status !== 'calibrated');
  ok('5 pairs → evidence_backed false', evidenceVerdict(5).evidence_backed === false);

  // 4. ≥ k_min → calibrated
  console.log('\n[4] Engine: ≥ k_min realized → calibrated');
  const manyRows = Array.from({ length: VALIDATION_K_MIN }, (_, i) => ({
    outcome_kind: 'binary', outcome_value: i % 2, predicted_prob_at_decision: (i % 10) / 10,
  }));
  const manyModel = buildCalibrationModel(toCalibrationPairs(manyRows));
  ok(`${VALIDATION_K_MIN} pairs → calibrated`, manyModel.status === 'calibrated', manyModel.status);
  ok(`${VALIDATION_K_MIN} pairs → evidence_backed true`, evidenceVerdict(VALIDATION_K_MIN).evidence_backed === true);

  // toCalibrationPairs honesty: continuous / null-prediction / non-0-1 excluded (never coerced)
  console.log('\n[4b] Engine: pair extraction excludes non-qualifying rows (no coercion)');
  const mixed = toCalibrationPairs([
    { outcome_kind: 'binary', outcome_value: 1, predicted_prob_at_decision: 0.6 },   // ✓
    { outcome_kind: 'binary', outcome_value: 1, predicted_prob_at_decision: null },   // ✗ no prediction
    { outcome_kind: 'continuous', outcome_value: 12, predicted_prob_at_decision: 0.5 }, // ✗ not binary
    { outcome_kind: 'binary', outcome_value: 2, predicted_prob_at_decision: 0.5 },   // ✗ not 0/1
  ]);
  ok('only the qualifying binary+prediction pair is used', mixed.length === 1, `got ${mixed.length}`);

  // 5. Language policy
  console.log('\n[5] Language policy disallows accuracy claims');
  const disallowed = VALIDATION_LANGUAGE_POLICY.disallowed.join(' ').toLowerCase();
  ok('disallows accuracy claims w/o outcomes', disallowed.includes('accuracy'));
  ok('disallows fabricated outcomes', disallowed.includes('fabricated') || disallowed.includes('synthesized'));

  // 6. Invalid outcome type
  console.log('\n[6] Outcome-type validation');
  ok('valid types accepted', OUTCOME_TYPES.every(isValidOutcomeType));
  ok('invalid type rejected', !isValidOutcomeType('bogus') && !isValidOutcomeType(''));

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
