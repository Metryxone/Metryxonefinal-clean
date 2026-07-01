/**
 * MX-102X — per-type abstain semantics guard.
 *
 * Regression: platform empirical accuracy is PER TYPE. Pairs must NEVER be summed across
 * heterogeneous outcome types to clear k_min — three types with 10 pairs each (sum 30) while EACH
 * is < k_min must still leave the platform ABSTAINED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizePlatform, median, OI_K_MIN } from '../services/outcome-intelligence-engine';

type Blk = Parameters<typeof summarizePlatform>[0][number];

const block = (realized: number | null, pairs: number, evidenceBacked: boolean): Blk => ({
  coverage: { realized, demo: null, table_present: true, detail: {} } as any,
  calibration: { method_applies: pairs > 0, pairs_used: pairs, summary: null } as any,
  validation: { evidence_backed: evidenceBacked } as any,
});

test('distributed pairs across types summing to k_min do NOT clear the per-type threshold', () => {
  // 3 types × 10 pairs = 30 (== k_min) but NO single type reached k_min individually.
  const blocks = [
    block(10, 10, false),
    block(10, 10, false),
    block(10, 10, false),
  ];
  const p = summarizePlatform(blocks);
  assert.equal(p.evidence_pairs, 30, 'aggregate pairs are still surfaced (informational)');
  assert.equal(p.max_type_pairs, 10, 'strongest single type is what gates k_min');
  assert.equal(p.types_evidence_backed, 0);
  assert.equal(p.evidence_backed, false, 'platform must NOT be evidence-backed via cross-type sum');
  assert.equal(p.abstained, true, 'platform must stay ABSTAINED');
});

test('a single type reaching k_min makes the platform evidence-backed', () => {
  const blocks = [
    block(OI_K_MIN, OI_K_MIN, true),
    block(2, 2, false),
  ];
  const p = summarizePlatform(blocks);
  assert.equal(p.max_type_pairs, OI_K_MIN);
  assert.equal(p.types_evidence_backed, 1);
  assert.equal(p.evidence_backed, true);
  assert.equal(p.abstained, false);
});

test('realized coverage stays null when every substrate is unreadable (never coerced to 0)', () => {
  const blocks = [block(null, 0, false), block(null, 0, false)];
  const p = summarizePlatform(blocks);
  assert.equal(p.realized_coverage, null, 'null (unreadable) must never become 0');
  assert.equal(p.abstained, true);
});

test('mixed null + real coverage sums only the readable substrates', () => {
  const blocks = [block(null, 0, false), block(7, 0, false)];
  const p = summarizePlatform(blocks);
  assert.equal(p.realized_coverage, 7);
  assert.equal(p.types_with_coverage, 1);
});

test('median returns null for an empty array (never coerced to 0)', () => {
  assert.equal(median([]), null);
});

test('median of an odd-length array is the middle value', () => {
  assert.equal(median([3, 1, 2]), 2);
});

test('median of an even-length array averages the two middle values', () => {
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test('median does not mutate its input and is order-agnostic', () => {
  const input = [9, 1, 5];
  assert.equal(median(input), 5);
  assert.deepEqual(input, [9, 1, 5], 'input array must not be sorted in place');
});
