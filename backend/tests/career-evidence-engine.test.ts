/**
 * Career Evidence Engine — outcome-validation math unit tests
 *
 * Run with:  npx tsx backend/tests/career-evidence-engine.test.ts
 *
 * Locks the HONESTY gate of computeEvidence so a regression can never let
 * fabricated / under-powered data be presented as "validated":
 *   - VALIDATED requires isReal + n>=30 + both groups + computable r + p<0.05.
 *   - The SAME strong cohort marked demo (isReal=false) is never validated.
 *   - n<30, empty, and single-group inputs all return INSUFFICIENT_EVIDENCE.
 *   - Continuous outcomes validate on Pearson r without group gating.
 * Also asserts r and p-value bounds for each shape.
 */

import assert from 'node:assert/strict';
import {
  computeEvidence,
  MIN_VALIDATION_N,
  type OutcomePair,
} from '../services/career-evidence-engine';

let passed = 0; let failed = 0;
const pending: Promise<void>[] = [];
function test(label: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try { await fn(); console.log(`  ✓  ${label}`); passed++; }
    catch (err) { console.error(`  ✗  ${label}`); console.error(err); failed++; }
  };
  pending.push(run());
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
/**
 * A strong but imperfect binary cohort: 20 achievers with high prior scores and
 * 20 non-achievers with low prior scores. Within-group variance keeps |r| < 1
 * (so the Fisher-z p-value is computable) while the group separation makes the
 * point-biserial correlation large and highly significant.
 */
function strongBinaryPairs(): OutcomePair[] {
  const pairs: OutcomePair[] = [];
  for (let i = 0; i < 20; i++) pairs.push({ priorScore: 70 + i, outcomeValue: 1 }); // achievers 70..89
  for (let i = 0; i < 20; i++) pairs.push({ priorScore: 40 + i, outcomeValue: 0 }); // non      40..59
  return pairs;
}

/** A strong but imperfect continuous cohort (n=40, positive correlation, |r|<1). */
function strongContinuousPairs(): OutcomePair[] {
  const pairs: OutcomePair[] = [];
  for (let i = 0; i < 40; i++) {
    pairs.push({ priorScore: 40 + i, outcomeValue: (40 + i) + (i % 2 === 0 ? 2 : -2) });
  }
  return pairs;
}

console.log('\n── Career Evidence Engine — outcome validation ─────────────────────────');

// ── 1. Strong real binary cohort → VALIDATED ─────────────────────────────────
test('strong real binary cohort (n=40) → VALIDATED with sane r/p bounds', () => {
  const res = computeEvidence(strongBinaryPairs(), 'binary', true);
  assert.equal(res.kind, 'binary');
  assert.equal(res.n, 40);
  assert.equal(res.validated, true);
  assert.equal(res.status, 'VALIDATED');

  assert.ok(res.r != null && res.r > 0.5 && res.r < 1, `expected 0.5 < r < 1, got ${res.r}`);
  assert.ok(res.pValue != null && res.pValue >= 0 && res.pValue < 0.05, `expected p < 0.05, got ${res.pValue}`);
  assert.ok(res.ci95 != null && res.ci95[0] < res.ci95[1], 'CI must be an ordered interval');

  assert.ok(res.groups != null);
  assert.equal(res.groups!.achieved.n, 20);
  assert.equal(res.groups!.notAchieved.n, 20);
  assert.ok(res.groups!.meanScoreGap != null && res.groups!.meanScoreGap > 0, 'achievers should score higher on average');
});

// ── 2. Same data marked demo → never validated ───────────────────────────────
test('identical strong cohort marked demo (isReal=false) is never VALIDATED', () => {
  const res = computeEvidence(strongBinaryPairs(), 'binary', false);
  assert.equal(res.validated, false);
  assert.equal(res.status, 'PRELIMINARY'); // statistics still computed, but no claim
  // r / p are unchanged by the demo flag — only the validated verdict changes.
  assert.ok(res.r != null && res.r > 0.5 && res.r < 1);
  assert.ok(res.pValue != null && res.pValue < 0.05);
  assert.ok(
    res.caveats.some((c) => /synthetic|demonstration|not real/i.test(c)),
    'demo cohort must carry an explicit synthetic-data caveat',
  );
});

// ── 3. n < MIN_VALIDATION_N → INSUFFICIENT_EVIDENCE ──────────────────────────
test('under-powered real cohort (n<30) → INSUFFICIENT_EVIDENCE, not validated', () => {
  const small = strongBinaryPairs().slice(0, 10); // 5 achievers + 5 non
  assert.ok(small.length < MIN_VALIDATION_N);
  const res = computeEvidence(small, 'binary', true);
  assert.equal(res.n, 10);
  assert.equal(res.validated, false);
  assert.equal(res.status, 'INSUFFICIENT_EVIDENCE');
  assert.ok(
    res.caveats.some((c) => new RegExp(`minimum cohort size \\(${MIN_VALIDATION_N}\\)`).test(c)),
    'must explain the n is below the validation threshold',
  );
});

// ── 4. Empty input → explicit abstain ────────────────────────────────────────
test('empty input → INSUFFICIENT_EVIDENCE with all stats null', () => {
  const res = computeEvidence([], 'binary', true);
  assert.equal(res.n, 0);
  assert.equal(res.r, null);
  assert.equal(res.pValue, null);
  assert.equal(res.ci95, null);
  assert.equal(res.groups, null);
  assert.equal(res.validated, false);
  assert.equal(res.status, 'INSUFFICIENT_EVIDENCE');
  assert.ok(res.caveats.some((c) => /nothing to validate/i.test(c)));
});

test('non-finite pairs are filtered before counting', () => {
  const res = computeEvidence(
    [
      { priorScore: NaN, outcomeValue: 1 },
      { priorScore: 70, outcomeValue: Infinity },
    ],
    'binary',
    true,
  );
  assert.equal(res.n, 0);
  assert.equal(res.status, 'INSUFFICIENT_EVIDENCE');
});

// ── 5. Single-group cohort → INSUFFICIENT_EVIDENCE ───────────────────────────
test('single-group binary cohort (all achieved) → INSUFFICIENT_EVIDENCE', () => {
  const pairs: OutcomePair[] = [];
  for (let i = 0; i < 40; i++) pairs.push({ priorScore: 50 + (i % 30), outcomeValue: 1 });
  const res = computeEvidence(pairs, 'binary', true);
  assert.equal(res.n, 40); // n is large enough...
  assert.equal(res.validated, false); // ...but only one group exists
  assert.equal(res.status, 'INSUFFICIENT_EVIDENCE');
  assert.ok(res.groups != null && res.groups!.notAchieved.n === 0);
  assert.ok(
    res.caveats.some((c) => /one outcome group/i.test(c)),
    'must explain a correlation needs both groups',
  );
  assert.equal(res.r, null, 'no variance in the 0/1 outcome → r not computable');
});

// ── 6. Continuous outcomes → validate on Pearson r, no group gating ───────────
test('strong real continuous cohort (n=40) → VALIDATED via Pearson r', () => {
  const res = computeEvidence(strongContinuousPairs(), 'continuous', true);
  assert.equal(res.kind, 'continuous');
  assert.equal(res.n, 40);
  assert.equal(res.groups, null, 'continuous outcomes carry no binary groups');
  assert.equal(res.validated, true);
  assert.equal(res.status, 'VALIDATED');
  assert.ok(res.r != null && res.r > 0.9 && res.r < 1, `expected strong positive r, got ${res.r}`);
  assert.ok(res.pValue != null && res.pValue < 0.05);
});

test('continuous cohort marked demo is never VALIDATED', () => {
  const res = computeEvidence(strongContinuousPairs(), 'continuous', false);
  assert.equal(res.validated, false);
  assert.equal(res.status, 'PRELIMINARY');
});

test('continuous cohort with no outcome variance → r null, INSUFFICIENT_EVIDENCE', () => {
  const pairs: OutcomePair[] = [];
  for (let i = 0; i < 40; i++) pairs.push({ priorScore: 40 + i, outcomeValue: 5 });
  const res = computeEvidence(pairs, 'continuous', true);
  assert.equal(res.r, null);
  assert.equal(res.validated, false);
  assert.equal(res.status, 'INSUFFICIENT_EVIDENCE');
});

// ── 7. Real, both-groups, n>=30 but non-significant → PRELIMINARY ────────────
test('real cohort with weak/no separation (p>=0.05) → PRELIMINARY, not VALIDATED', () => {
  // Alternating outcomes across a flat score range → near-zero correlation.
  const pairs: OutcomePair[] = [];
  for (let i = 0; i < 40; i++) pairs.push({ priorScore: 50 + (i % 5), outcomeValue: i % 2 });
  const res = computeEvidence(pairs, 'binary', true);
  assert.equal(res.n, 40);
  assert.ok(res.groups != null && res.groups!.achieved.n > 0 && res.groups!.notAchieved.n > 0);
  assert.ok(res.pValue == null || res.pValue >= 0.05, `expected non-significant, got p=${res.pValue}`);
  assert.equal(res.validated, false);
  assert.equal(res.status, 'PRELIMINARY');
});

// ── Run ──────────────────────────────────────────────────────────────────────
void (async () => {
  await Promise.all(pending);
  console.log(`\n  Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
