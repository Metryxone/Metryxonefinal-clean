/**
 * Developmental Compliance Sanitizer — unit tests
 *
 * Run with:  npx tsx backend/tests/developmental-sanitizer.test.ts
 */

import assert from 'node:assert/strict';
import {
  sanitiseDevelopmentalText,
  sanitiseDevelopmentalPayload,
} from '../services/developmental-sanitizer';

let passed = 0;
let failed = 0;
function test(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓  ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${label}`);
    console.error(err);
    failed++;
  }
}

console.log('\n── Developmental Sanitizer ─────────────────────────────────────────────');

// ── 1. Null / empty handling ─────────────────────────────────────────────────
test('null input → empty result, not modified', () => {
  const r = sanitiseDevelopmentalText(null);
  assert.equal(r.text, '');
  assert.equal(r.modified, false);
});

test('whitespace-only input passes through untouched', () => {
  const r = sanitiseDevelopmentalText('   ');
  assert.equal(r.modified, false);
});

test('safe developmental text is not modified', () => {
  const safe = 'Your developmental focus area is metacognition. This is a signal, not a verdict.';
  const r = sanitiseDevelopmentalText(safe);
  assert.equal(r.modified, false);
  assert.equal(r.text, safe);
  assert.equal(r.removed_claims.length, 0);
});

// ── 2. Hiring / placement guarantees ─────────────────────────────────────────
test('strips "guaranteed job" claim', () => {
  const r = sanitiseDevelopmentalText('We give you a guaranteed job after this assessment.');
  assert.equal(r.modified, true);
  assert.ok(!/guaranteed\s+job/i.test(r.text), `still contains guarantee: ${r.text}`);
  assert.ok(r.removed_claims.includes('guaranteed_placement_claim'));
});

test('strips "will be hired" claim', () => {
  const r = sanitiseDevelopmentalText('You will be hired by top employers.');
  assert.equal(r.modified, true);
  assert.ok(!/will\s+be\s+hired/i.test(r.text));
  assert.ok(r.removed_claims.includes('predictive_hiring_claim'));
});

test('strips "you are employable" verdict', () => {
  const r = sanitiseDevelopmentalText('You are employable for software roles.');
  assert.equal(r.modified, true);
  assert.ok(!/are\s+employable/i.test(r.text));
});

// ── 3. Suitability verdicts ──────────────────────────────────────────────────
test('rewrites "suitable for this job" to developmental framing', () => {
  const r = sanitiseDevelopmentalText('You are suitable for this job in marketing.');
  assert.equal(r.modified, true);
  assert.ok(/aligned with developmental focus/i.test(r.text));
});

test('rewrites "not suitable for" to non-punitive framing', () => {
  const r = sanitiseDevelopmentalText('You are not suitable for this role.');
  assert.equal(r.modified, true);
  assert.ok(/developmental room to grow/i.test(r.text));
});

// ── 4. Outcome / salary prediction ───────────────────────────────────────────
test('strips "predicts career success" claim', () => {
  const r = sanitiseDevelopmentalText('This score predicts career success in management.');
  assert.equal(r.modified, true);
  assert.ok(!/predicts\s+career\s+success/i.test(r.text));
});

test('strips "salary prediction"', () => {
  const r = sanitiseDevelopmentalText('Salary prediction: ₹12 LPA.');
  assert.equal(r.modified, true);
  assert.ok(!/salary\s+prediction/i.test(r.text));
});

// ── 5. Recruitment directives ────────────────────────────────────────────────
test('rewrites "should hire" recruitment directive', () => {
  const r = sanitiseDevelopmentalText('Recruiters should hire this candidate immediately.');
  assert.equal(r.modified, true);
  assert.ok(!/should\s+hire/i.test(r.text));
});

// ── 6. Footnote behaviour ────────────────────────────────────────────────────
test('appends compliance footnote when modified', () => {
  const r = sanitiseDevelopmentalText('You will be hired.');
  assert.ok(/Developmental signal only/i.test(r.text), `missing footnote: ${r.text}`);
});

test('does not append footnote when nothing was modified', () => {
  const r = sanitiseDevelopmentalText('Your reflection skills are developing.');
  assert.ok(!/Developmental signal only/i.test(r.text));
});

test('does not double-append footnote', () => {
  const once = sanitiseDevelopmentalText('You will be hired.');
  const twice = sanitiseDevelopmentalText(once.text);
  const matches = (twice.text.match(/Developmental signal only/gi) || []).length;
  assert.ok(matches <= 1, `footnote appears ${matches} times`);
});

// ── 7. Multiple rules in one string ──────────────────────────────────────────
test('catches multiple distinct claims in one string', () => {
  const r = sanitiseDevelopmentalText(
    'You are employable and we offer a guaranteed job — recruiters should hire you.',
  );
  assert.equal(r.modified, true);
  assert.ok(r.removed_claims.length >= 2, `only ${r.removed_claims.length} fired`);
});

// ── 8. Deep payload walker ───────────────────────────────────────────────────
test('sanitiseDevelopmentalPayload walks nested objects + arrays', () => {
  const payload = {
    headline: 'You will be hired.',
    nested: {
      list: ['safe text', 'guaranteed job offered'],
      count: 3,
      flag: true,
    },
    safe: 'developmental focus area',
  };
  const { value, removed_claims } = sanitiseDevelopmentalPayload(payload);
  assert.ok(!/will\s+be\s+hired/i.test(value.headline));
  assert.ok(!/guaranteed\s+job/i.test(value.nested.list[1]));
  assert.equal(value.nested.list[0], 'safe text');
  assert.equal(value.nested.count, 3);
  assert.equal(value.nested.flag, true);
  assert.equal(value.safe, 'developmental focus area');
  assert.ok(removed_claims.length >= 2);
});

test('payload walker preserves null/undefined leaves', () => {
  const { value } = sanitiseDevelopmentalPayload({ a: null, b: undefined, c: 0, d: false });
  assert.equal(value.a, null);
  assert.equal(value.b, undefined);
  assert.equal(value.c, 0);
  assert.equal(value.d, false);
});

console.log(`\n  Result: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
