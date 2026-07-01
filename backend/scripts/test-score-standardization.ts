/**
 * CAPADEX 3.8 — Enterprise Score Standardization & Interpretation test suite.
 *
 * Covers the pure, deterministic standardization mechanisms (UNIT) and the read-only
 * certification composers against the live DB (INTEGRATION):
 *   - standardization transforms (z / percentile / T / standard / stanine / sten / deviation)
 *   - structured-AST formula validation + evaluation (NO eval / new Function)
 *   - performance-band classification (default + custom band sets) + per-cohort heat map
 *   - deterministic interpretation-rule verdicts (band / custom-verdict override)
 *   - validation checks (distribution / range / boundary / statistical / regression version-diff)
 *   - config-scope precedence + governance order invariants
 *   - engine composition (composeDimensions / composeSummary) certifies without throwing
 *
 * Performance / accessibility / full-HTTP-API tests stay a follow-on (PARTIAL) — this suite is
 * unit + integration/composer. It persists NOTHING (pure mechanisms + read-only composers).
 *
 * Run:  cd backend && FF_SCORE_STANDARDIZATION=1 npx tsx scripts/test-score-standardization.ts
 */
import { Pool } from 'pg';
import {
  computeStandardScoreSet,
  validateFormula,
  evaluateFormula,
  classifyBand,
  computeHeatmap,
  bandFromPercentile,
  readinessFromPercentile,
  evaluateInterpretationRule,
  validateDistribution,
  validateRange,
  validateBoundary,
  validateStatistical,
  validateRegression,
  CONFIG_SCOPE_PRECEDENCE,
  GOVERNANCE_ORDER,
  DEFAULT_BAND_SET,
  type FormulaNode,
  type BandDef,
} from '../services/score-standardization-mechanisms';
import { composeDimensions, composeSummary } from '../services/score-standardization-engine';
import { STD_K_MIN } from '../config/score-standardization';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: unknown): void {
  if (cond) { passed += 1; return; }
  failed += 1;
  const d = detail === undefined ? '' : ` — ${JSON.stringify(detail)}`;
  failures.push(`${name}${d}`);
  console.error(`  ✗ ${name}${d}`);
}
function eq(name: string, actual: unknown, expected: unknown): void {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}
function approx(name: string, actual: number | null, expected: number, tol = 0.5): void {
  ok(name, actual != null && Math.abs(actual - expected) <= tol, { actual, expected, tol });
}

async function main(): Promise<void> {
  console.log('── CAPADEX 3.8 Score Standardization test suite ──');

  // ── UNIT: standardization transforms ──
  const mid = computeStandardScoreSet(65, 65, 12, 100);
  approx('standardize: value==mean → z≈0', mid.z, 0, 0.001);
  approx('standardize: value==mean → percentile≈50', mid.percentile, 50, 0.5);
  approx('standardize: value==mean → T≈50', mid.t_score, 50, 0.5);
  approx('standardize: value==mean → standard_score≈100', mid.standard_score, 100, 0.5);
  eq('standardize: value==mean → not abstained', mid.abstained, false);

  const thin = computeStandardScoreSet(70, 65, 12, STD_K_MIN - 1);
  eq('standardize: below k_min → abstained', thin.abstained, true);
  eq('standardize: below k_min → z null (null≠0)', thin.z, null);

  const noRef = computeStandardScoreSet(70, 65, 0, 100);
  eq('standardize: sd=0 → abstained (no reference distribution)', noRef.abstained, true);

  // ── UNIT: structured-AST formula validation + evaluation (NO eval) ──
  const goodAst: FormulaNode = { type: 'op', op: '+', args: [{ type: 'var', name: 'a' }, { type: 'const', value: 5 }] };
  const gv = validateFormula(goodAst);
  eq('formula: valid AST', gv.valid, true);
  eq('formula: collects variables', gv.variables, ['a']);
  eq('formula: evaluate a+5 with a=10 → 15', evaluateFormula(goodAst, { a: 10 }), 15);
  eq('formula: null var → null (never fabricated)', evaluateFormula(goodAst, {}), null);

  const badAst = { type: 'exec', cmd: 'rm -rf' } as unknown;
  eq('formula: rejects non-whitelisted node type', validateFormula(badAst).valid, false);
  eq('formula: evaluate rejected node → null', evaluateFormula(badAst, {}), null);

  const weighted: FormulaNode = { type: 'weighted', terms: [{ node: { type: 'var', name: 'x' }, weight: 0.6 }, { node: { type: 'var', name: 'y' }, weight: 0.4 }] };
  approx('formula: weighted 0.6x+0.4y', evaluateFormula(weighted, { x: 100, y: 50 }), 80, 0.001);

  const clamp: FormulaNode = { type: 'clamp', arg: { type: 'const', value: 150 }, min: 0, max: 100 };
  eq('formula: clamp 150→100', evaluateFormula(clamp, {}), 100);

  // deep-nesting guard: an AST beyond MAX depth must not validate/evaluate to a number
  let deep: FormulaNode = { type: 'const', value: 1 };
  for (let i = 0; i < 40; i += 1) deep = { type: 'op', op: '+', args: [deep, { type: 'const', value: 1 }] };
  eq('formula: over-deep AST rejected', validateFormula(deep).valid, false);

  // ── UNIT: band classification (default + custom) + heat map ──
  eq('band: p=99 → outstanding', bandFromPercentile(99), 'outstanding');
  eq('band: p=95 → excellent (outstanding floor is 98)', bandFromPercentile(95), 'excellent');
  eq('band: p=null → null (abstain)', bandFromPercentile(null), null);
  const bcTop = classifyBand(99);
  eq('classifyBand: default set p=99 band', bcTop.band, 'outstanding');
  eq('classifyBand: default band_set tag', bcTop.band_set, 'default');
  eq('classifyBand: null → abstained', classifyBand(null).abstained, true);
  const customBands: BandDef[] = [
    { key: 'top', label: 'Top', min_percentile: 67 },
    { key: 'mid', label: 'Middle', min_percentile: 34 },
    { key: 'low', label: 'Low', min_percentile: 0 },
  ];
  const cc = classifyBand(72, customBands);
  eq('classifyBand: custom set p=72 → top', cc.band, 'top');
  eq('classifyBand: custom band_set tag', cc.band_set, 'custom');

  const heat = computeHeatmap({ A: [82, 55, 30, null], B: [90, 70] }, customBands);
  eq('heatmap: ignores non-finite (A n=3 not 4)', heat.rows.find(r => r.cohort === 'A')?.n, 3);
  eq('heatmap: total classified', heat.total, 5);
  ok('heatmap: bands mirror custom set', heat.bands.length === customBands.length, heat.bands);

  // ── UNIT: interpretation-rule verdicts ──
  const interp = evaluateInterpretationRule({ percentile: 95 });
  eq('interpret: p=95 verdict is band', interp.verdict, 'excellent');
  eq('interpret: p=95 readiness advanced', interp.readiness_category, 'advanced');
  eq('interpret: null → abstained (never fabricated)', evaluateInterpretationRule({ percentile: null }).abstained, true);
  eq('readiness: p=10 emerging', readinessFromPercentile(10), 'emerging');
  const overridden = evaluateInterpretationRule({ percentile: 40, verdicts: [{ min_percentile: 34, verdict: 'PASS' }, { min_percentile: 0, verdict: 'FAIL' }] });
  eq('interpret: custom verdict override', overridden.verdict, 'PASS');

  // ── UNIT: validation checks ──
  eq('validate: distribution n≥k_min & sd>0 passes', validateDistribution({ n: 40, mean: 65, sd: 12 }).passed, true);
  eq('validate: distribution below k_min fails', validateDistribution({ n: 5, mean: 65, sd: 12 }).passed, false);
  eq('validate: range in-bounds passes', validateRange(50, 0, 100).passed, true);
  eq('validate: range out-of-bounds fails', validateRange(150, 0, 100).passed, false);
  eq('validate: monotonic band boundaries pass', validateBoundary(DEFAULT_BAND_SET).passed, true);
  eq('validate: non-monotonic band boundaries fail', validateBoundary([{ key: 'a', min_percentile: 10 }, { key: 'b', min_percentile: 90 }]).passed, false);
  eq('validate: statistical sd>0 passes', validateStatistical({ mean: 65, sd: 12 }).passed, true);
  eq('validate: statistical sd=0 fails', validateStatistical({ mean: 65, sd: 0 }).passed, false);

  // ── UNIT: regression / version-diff (reuses validateFormula/evaluateFormula) ──
  const base: FormulaNode = { type: 'op', op: '+', args: [{ type: 'var', name: 'd' }, { type: 'var', name: 'b' }] };
  const sameCand: FormulaNode = { type: 'op', op: '+', args: [{ type: 'var', name: 'b' }, { type: 'var', name: 'd' }] };
  const eqReg = validateRegression({ mode: 'formula', baseline: base, candidate: sameCand, samples: [{ d: 70, b: 40 }, { d: 55, b: 60 }], tolerance: 0.001 });
  eq('regression: equivalent formulas pass', eqReg.passed, true);
  eq('regression: max_abs_delta 0 for equivalent', eqReg.detail.max_abs_delta, 0);

  const driftCand: FormulaNode = { type: 'op', op: '+', args: [{ type: 'var', name: 'd' }, { type: 'op', op: '*', args: [{ type: 'var', name: 'b' }, { type: 'const', value: 1.5 }] }] };
  const driftReg = validateRegression({ mode: 'formula', baseline: base, candidate: driftCand, samples: [{ d: 70, b: 40 }], tolerance: 0.5 });
  eq('regression: divergent formula beyond tolerance fails', driftReg.passed, false);
  ok('regression: divergence recorded', Number(driftReg.detail.divergence_count) >= 1, driftReg.detail);
  eq('regression: empty samples is an explicit error (never fabricated pass)', validateRegression({ mode: 'formula', baseline: base, candidate: base, samples: [] }).passed, false);

  // band-mode regression
  const wide: BandDef[] = [{ key: 'hi', min_percentile: 50 }, { key: 'lo', min_percentile: 0 }];
  const shifted: BandDef[] = [{ key: 'hi', min_percentile: 80 }, { key: 'lo', min_percentile: 0 }];
  eq('regression: band-mode divergence fails', validateRegression({ mode: 'band', baseline: wide, candidate: shifted, samples: [60] }).passed, false);

  // ── UNIT: invariants ──
  eq('precedence: organization is most specific', CONFIG_SCOPE_PRECEDENCE[0], 'organization');
  eq('precedence: 8 scopes', CONFIG_SCOPE_PRECEDENCE.length, 8);
  eq('governance: order starts draft ends retire', [GOVERNANCE_ORDER[0], GOVERNANCE_ORDER[GOVERNANCE_ORDER.length - 1]], ['draft', 'retire']);

  // ── INTEGRATION: read-only engine composition (live DB) ──
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const dims = await composeDimensions(pool);
      ok('compose: dimensions composed without throwing', Array.isArray(dims.dimensions) && dims.dimensions.length === 10, { count: dims.dimensions?.length });
      const summary = await composeSummary(pool);
      ok('compose: summary has enterprise_ready verdict', !!summary?.enterprise_ready?.verdict, summary?.enterprise_ready);
      eq('compose: verdict STRUCTURAL_COMPLETE_ADOPTION_PENDING', summary?.enterprise_ready?.verdict, 'STRUCTURAL_COMPLETE_ADOPTION_PENDING');
    } catch (err) {
      ok('compose: engine composition (integration)', false, String((err as Error).message));
    } finally {
      await pool.end();
    }
  } else {
    console.log('  · DATABASE_URL absent — integration composition tests skipped (unit-only run).');
  }

  console.log(`\n${failed === 0 ? '✓ PASS' : '✗ FAIL'} — ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('\nFailures:');
    failures.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('test suite crashed:', err);
  process.exit(1);
});
