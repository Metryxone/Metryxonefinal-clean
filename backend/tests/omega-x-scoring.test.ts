/**
 * OMEGA-X 3-Way Multiplier Matrix — unit tests
 *
 * Run with:  npx tsx backend/tests/omega-x-scoring.test.ts
 *
 * Mirrors the assert-based runner used by feature-flags.test.ts so no
 * additional test-framework dependency is required.
 */

import assert from 'node:assert/strict';
import {
  calculateOmegaXScore,
  hydrateAtomicWeights,
  IDENTITY_WEIGHTS,
  type OmegaXScorePayload,
} from '../services/omega-x-scoring';

let passed = 0;
let failed = 0;
function test(label: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try {
      await fn();
      console.log(`  ✓  ${label}`);
      passed++;
    } catch (err) {
      console.error(`  ✗  ${label}`);
      console.error(err);
      failed++;
    }
  };
  pending.push(run());
}
const pending: Promise<void>[] = [];

console.log('\n── OMEGA-X Scoring Engine ───────────────────────────────────────────────');

// ── 1. Pure multiplier formula ───────────────────────────────────────────────
test('identity weights → component_score equals response_value', () => {
  const r = calculateOmegaXScore({
    responses: [{ atomic_signal_id: 'as_1', response_value: 0.7, weights: IDENTITY_WEIGHTS }],
  });
  assert.equal(r.components.length, 1);
  assert.equal(r.components[0].component_score, 0.7);
  assert.equal(r.total_score, 0.7);
  assert.equal(r.normalised_score, 0.7);
});

test('3-way multiplier matrix: 0.8 × 1.2 × 0.9 × 1.5 = 1.296', () => {
  const r = calculateOmegaXScore({
    responses: [{
      atomic_signal_id: 'as_2',
      response_value: 0.8,
      weights: { severity_weight: 1.2, confidence_weight: 0.9, persistence_weight: 1.5 },
    }],
  });
  // 0.8 * 1.2 * 0.9 * 1.5 = 1.296
  assert.ok(Math.abs(r.components[0].component_score - 1.296) < 1e-9, `got ${r.components[0].component_score}`);
});

test('multi-response aggregation: total = Σ components', () => {
  const r = calculateOmegaXScore({
    responses: [
      { atomic_signal_id: 'a', response_value: 1, weights: { severity_weight: 1, confidence_weight: 1, persistence_weight: 1 } },
      { atomic_signal_id: 'b', response_value: 2, weights: { severity_weight: 2, confidence_weight: 1, persistence_weight: 1 } },
      { atomic_signal_id: 'c', response_value: 1, weights: { severity_weight: 1, confidence_weight: 0.5, persistence_weight: 2 } },
    ],
  });
  // 1*1*1*1 + 2*2*1*1 + 1*1*0.5*2 = 1 + 4 + 1 = 6
  assert.equal(r.total_score, 6);
  assert.equal(r.components.length, 3);
});

test('normalised_score = Σ component / Σ weight-product', () => {
  const r = calculateOmegaXScore({
    responses: [
      { atomic_signal_id: 'a', response_value: 2, weights: { severity_weight: 1, confidence_weight: 1, persistence_weight: 1 } }, // 2  / 1
      { atomic_signal_id: 'b', response_value: 4, weights: { severity_weight: 2, confidence_weight: 1, persistence_weight: 1 } }, // 8  / 2
    ],
  });
  // total = 10, weightSum = 3, normalised = 10/3
  assert.ok(Math.abs(r.normalised_score - (10 / 3)) < 1e-9, `got ${r.normalised_score}`);
});

// ── 2. Default weights fallback ──────────────────────────────────────────────
test('missing weights fall back to defaultWeights', () => {
  const r = calculateOmegaXScore({
    responses: [{ atomic_signal_id: 'orphan', response_value: 1 }],
    defaultWeights: { severity_weight: 0.5, confidence_weight: 0.5, persistence_weight: 0.5 },
  });
  // 1 * 0.5 * 0.5 * 0.5 = 0.125
  assert.equal(r.components[0].component_score, 0.125);
  assert.equal(r.meta.fallback_weighted_count, 1);
  assert.equal(r.meta.fully_weighted_count, 0);
});

test('partial weights merge with defaults', () => {
  const r = calculateOmegaXScore({
    responses: [{
      atomic_signal_id: 'partial',
      response_value: 1,
      weights: { severity_weight: 2 }, // confidence/persistence fall through to default
    }],
    defaultWeights: { severity_weight: 1, confidence_weight: 0.5, persistence_weight: 1 },
  });
  // 1 * 2 * 0.5 * 1 = 1
  assert.equal(r.components[0].component_score, 1);
  assert.equal(r.meta.fallback_weighted_count, 1);
});

// ── 3. Edge cases ────────────────────────────────────────────────────────────
test('empty responses array → 0 score, no crash', () => {
  const r = calculateOmegaXScore({ responses: [] });
  assert.equal(r.total_score, 0);
  assert.equal(r.normalised_score, 0);
  assert.equal(r.components.length, 0);
  assert.equal(r.meta.response_count, 0);
});

test('NaN / Infinity response values are skipped', () => {
  const r = calculateOmegaXScore({
    responses: [
      { atomic_signal_id: 'nan', response_value: Number.NaN, weights: IDENTITY_WEIGHTS },
      { atomic_signal_id: 'inf', response_value: Number.POSITIVE_INFINITY, weights: IDENTITY_WEIGHTS },
      { atomic_signal_id: 'ok', response_value: 1, weights: IDENTITY_WEIGHTS },
    ],
  });
  assert.equal(r.components.length, 1);
  assert.equal(r.meta.skipped_count, 2);
  assert.equal(r.total_score, 1);
});

test('zero weight collapses component to 0 without divide-by-zero', () => {
  const r = calculateOmegaXScore({
    responses: [{
      atomic_signal_id: 'zero',
      response_value: 5,
      weights: { severity_weight: 0, confidence_weight: 1, persistence_weight: 1 },
    }],
  });
  assert.equal(r.components[0].component_score, 0);
  assert.equal(r.total_score, 0);
  assert.equal(r.normalised_score, 0);
});

test('output framing is always developmental_signal_only', () => {
  const r = calculateOmegaXScore({ responses: [{ atomic_signal_id: 'x', response_value: 1 }] });
  assert.equal(r.framing, 'developmental_signal_only');
});

// ── 4. DB hydration — guards (no real DB) ────────────────────────────────────
test('hydrateAtomicWeights(null pool) returns empty map', async () => {
  const m = await hydrateAtomicWeights(null, ['a', 'b']);
  assert.equal(m.size, 0);
});

test('hydrateAtomicWeights([]) returns empty map', async () => {
  const fakePool = { query: () => { throw new Error('should not query'); } } as never;
  const m = await hydrateAtomicWeights(fakePool, []);
  assert.equal(m.size, 0);
});

test('hydrateAtomicWeights normalises ids (LOWER+TRIM) before querying', async () => {
  let observedIds: string[] | null = null;
  const fakePool = {
    query: async (_sql: string, params: unknown[]) => {
      observedIds = params[0] as string[];
      return { rows: [] };
    },
  } as unknown as Parameters<typeof hydrateAtomicWeights>[0];
  await hydrateAtomicWeights(fakePool, [' AS_001 ', 'as_001', 'AS_002']);
  assert.deepEqual(observedIds, ['as_001', 'as_002']);
});

test('hydrateAtomicWeights tolerates query error and returns empty map', async () => {
  const fakePool = { query: async () => { throw new Error('db down'); } } as unknown as Parameters<typeof hydrateAtomicWeights>[0];
  const m = await hydrateAtomicWeights(fakePool, ['a']);
  assert.equal(m.size, 0);
});

// ── Run ──────────────────────────────────────────────────────────────────────
void (async () => {
  await Promise.all(pending);
  console.log(`\n  Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
