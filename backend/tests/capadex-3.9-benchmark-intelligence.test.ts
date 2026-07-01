/**
 * CAPADEX 3.0 — Program 3 · Phase 3.9 Enterprise Benchmark Intelligence — TEST SUITE
 * ───────────────────────────────────────────────────────────────────────────
 * The runnable suite backing the `testing` dimension of the Phase-3.9 certification
 * (config/benchmark-intelligence.ts). It exercises the PURE reuse-before-build
 * mechanisms + the read-only composer against the live DB.
 *
 * UNIT (no DB): computeReferenceStats · computeBenchmarkComparison (percentile / z /
 *   delta / quartile + ABSTAIN below k_min) · computeGroupComparison (per-group
 *   suppression) · computeTrend (improving / declining / stable, <2 pts → null) ·
 *   computeDistribution (binning, empty → 0 bins) · computePercentileRank
 *   ((below + 0.5·equal)/n · 100) · evaluateBenchmarkFormula (structured-AST
 *   composite index — NO eval; valid + invalid) · a source-level no-eval guard.
 *
 * INTEGRATION (needs DATABASE_URL): composeSummary / composeDimensions read-only
 *   composition — 9 dimensions all SUPPORTED, verdict STRUCTURAL_COMPLETE_ADOPTION_PENDING.
 *   Skipped honestly when DATABASE_URL is absent (never fabricated as passing).
 *
 * Run with:  npx tsx --test backend/tests/capadex-3.9-benchmark-intelligence.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  computeReferenceStats,
  computeBenchmarkComparison,
  computeGroupComparison,
  computeTrend,
  computeDistribution,
  computePercentileRank,
  evaluateBenchmarkFormula,
} from '../services/benchmark-intelligence-mechanisms';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// A sufficient reference cohort (n ≥ k_min=30) with a known mean/sd via pre-aggregated stats.
const SUFFICIENT_STATS = { n: 100, mean: 50, sd: 10 };

// ── computeReferenceStats ────────────────────────────────────────────────────
test('computeReferenceStats: descriptive stats, population SD, honest sufficiency', () => {
  const s = computeReferenceStats([1, 2, 3, 4, 5]);
  assert.equal(s.n, 5);
  assert.equal(s.mean, 3);
  assert.ok(s.sd !== null && Math.abs(s.sd - Math.sqrt(2)) < 1e-3, `sd=${s.sd}`);
  assert.equal(s.min, 1);
  assert.equal(s.max, 5);
  assert.equal(s.median, 3);
  assert.equal(s.sufficient, false); // 5 < 30
  assert.equal(s.k_min, 30);
});

test('computeReferenceStats: empty set → all null, never fabricated', () => {
  const s = computeReferenceStats([]);
  assert.equal(s.n, 0);
  assert.equal(s.mean, null);
  assert.equal(s.sd, null);
  assert.equal(s.sufficient, false);
});

test('computeReferenceStats: nulls / NaN / Infinity dropped, never coerced to 0', () => {
  const s = computeReferenceStats([10, null, NaN, Infinity, undefined, 20]);
  assert.equal(s.n, 2);
  assert.equal(s.mean, 15);
});

// ── computeBenchmarkComparison — percentile / z / delta / quartile ────────────
test('computeBenchmarkComparison: sufficient cohort → z / percentile / delta / quartile', () => {
  const r = computeBenchmarkComparison({ value: 60, stats: SUFFICIENT_STATS });
  assert.equal(r.suppressed, false);
  assert.equal(r.abstained, false);
  assert.equal(r.reason, 'benchmarked');
  assert.equal(r.z, 1); // (60-50)/10
  assert.ok(r.percentile !== null && Math.abs(r.percentile - 84.13) < 0.5, `pct=${r.percentile}`);
  assert.equal(r.delta, 10); // 60-50
  assert.equal(r.quartile, 4); // percentile ≥ 75
  assert.equal(r.cohort_size, 100);
});

test('computeBenchmarkComparison: ABSTAINS below k_min (suppressed, no fabricated percentile)', () => {
  const r = computeBenchmarkComparison({ value: 60, reference: [1, 2, 3, 4, 5] });
  assert.equal(r.suppressed, true);
  assert.equal(r.abstained, true);
  assert.match(r.reason, /cohort_below_k_min/);
  assert.equal(r.z, null);
  assert.equal(r.percentile, null);
  assert.equal(r.delta, null);
  assert.equal(r.quartile, null);
  assert.equal(r.cohort_size, 5);
});

test('computeBenchmarkComparison: no value → abstained no_value', () => {
  const r = computeBenchmarkComparison({ value: null, stats: SUFFICIENT_STATS });
  assert.equal(r.abstained, true);
  assert.equal(r.reason, 'no_value');
  assert.equal(r.percentile, null);
});

// ── computeGroupComparison — per-group suppression ────────────────────────────
test('computeGroupComparison: each group ABSTAINS independently below k_min', () => {
  const g = computeGroupComparison({
    value: 60,
    groups: [
      { label: 'thin', values: [1, 2, 3] },
      { label: 'big', stats: SUFFICIENT_STATS },
    ],
  });
  assert.equal(g.value, 60);
  assert.equal(g.k_min, 30);
  assert.equal(g.groups.length, 2);
  const thin = g.groups.find((x) => x.label === 'thin')!;
  const big = g.groups.find((x) => x.label === 'big')!;
  assert.equal(thin.comparison.suppressed, true);
  assert.equal(thin.comparison.percentile, null);
  assert.equal(big.comparison.suppressed, false);
  assert.equal(big.comparison.z, 1);
});

// ── computeTrend — improving / declining / stable, <2 pts → null ──────────────
test('computeTrend: improving series', () => {
  const t = computeTrend([1, 2, 3, 4, 5]);
  assert.equal(t.direction, 'improving');
  assert.equal(t.delta, 4);
  assert.equal(t.n, 5);
});

test('computeTrend: declining series', () => {
  assert.equal(computeTrend([5, 4, 3, 2, 1]).direction, 'declining');
});

test('computeTrend: flat series is stable', () => {
  assert.equal(computeTrend([3, 3, 3, 3]).direction, 'stable');
});

test('computeTrend: fewer than 2 points → direction null (never fabricated)', () => {
  assert.equal(computeTrend([5]).direction, null);
  assert.equal(computeTrend([]).direction, null);
  assert.equal(computeTrend([]).n, 0);
});

test('computeTrend: accepts {value} rows', () => {
  assert.equal(computeTrend([{ value: 1 }, { value: 5 }]).direction, 'improving');
});

// ── computeDistribution — binning, empty → 0 bins ─────────────────────────────
test('computeDistribution: equal-width binning preserves total count', () => {
  const d = computeDistribution([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
  assert.equal(d.n, 10);
  assert.equal(d.bins.length, 5);
  assert.equal(d.bins.reduce((a, b) => a + b.count, 0), 10);
});

test('computeDistribution: empty set → 0 bins, null stats (never fabricated)', () => {
  const d = computeDistribution([]);
  assert.equal(d.n, 0);
  assert.equal(d.bins.length, 0);
  assert.equal(d.mean, null);
});

// ── computePercentileRank — (below + 0.5·equal)/n · 100 ───────────────────────
test('computePercentileRank: empirical rank with tie handling', () => {
  const r = computePercentileRank(3, [1, 2, 3, 4, 5]);
  assert.equal(r.below, 2);
  assert.equal(r.equal, 1);
  assert.equal(r.percentile, 50); // (2 + 0.5)/5 · 100
});

test('computePercentileRank: empty set → null (never fabricated)', () => {
  assert.equal(computePercentileRank(3, []).percentile, null);
});

// ── evaluateBenchmarkFormula — structured AST composite index, NO eval ────────
test('evaluateBenchmarkFormula: valid canonical AST evaluates deterministically', () => {
  // 70 + (x * 0.5) with x=40 → 90 — canonical FormulaNode shape (op/var/const).
  const ast = {
    type: 'op', op: '+',
    args: [
      { type: 'const', value: 70 },
      { type: 'op', op: '*', args: [{ type: 'var', name: 'x' }, { type: 'const', value: 0.5 }] },
    ],
  };
  const r = evaluateBenchmarkFormula(ast, { x: 40 });
  assert.equal(r.valid, true);
  assert.equal(r.value, 90);
  assert.equal(r.errors.length, 0);
  assert.ok(r.variables.includes('x'));
});

test('evaluateBenchmarkFormula: invalid AST → valid:false / value:null (never fabricated)', () => {
  const r = evaluateBenchmarkFormula({ type: 'bogus_node' }, {});
  assert.equal(r.valid, false);
  assert.equal(r.value, null);
  assert.ok(r.errors.length > 0);
});

test('no-eval guard: mechanism sources contain NO eval / new Function', () => {
  for (const rel of [
    '../services/benchmark-intelligence-mechanisms.ts',
    '../services/score-standardization-mechanisms.ts',
  ]) {
    const src = readFileSync(path.resolve(__dirname, rel), 'utf8');
    assert.ok(!/\beval\s*\(/.test(src), `${rel} must not call eval()`);
    assert.ok(!/new\s+Function\s*\(/.test(src), `${rel} must not use new Function()`);
  }
});

// ── INTEGRATION — read-only engine composition against the live DB ────────────
test('composeSummary / composeDimensions: 9 dimensions SUPPORTED, honest verdict', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL absent — integration composition skipped (honest, not a pass)');
    return;
  }
  const { Pool } = await import('pg');
  const { composeSummary, composeDimensions } = await import('../services/benchmark-intelligence-engine');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const dims = await composeDimensions(pool);
    assert.equal(dims.dimension_count, 9);
    assert.equal(dims.status_counts.SUPPORTED, 9);
    assert.equal(dims.dimensions.length, 9);

    const summary = await composeSummary(pool);
    assert.equal(summary.flag, 'benchmarkIntelligence');
    assert.equal(summary.k_min, 30);
    assert.equal(summary.dimensions.dimension_count, 9);
    assert.equal(summary.dimensions.status_counts.SUPPORTED, 9);
    assert.equal(summary.enterprise_ready.verdict, 'STRUCTURAL_COMPLETE_ADOPTION_PENDING');
    assert.equal(summary.gap_counts['Launch-Critical'], 0);
    assert.equal(summary.ready_for_certification.ready, true);
  } finally {
    await pool.end();
  }
});
