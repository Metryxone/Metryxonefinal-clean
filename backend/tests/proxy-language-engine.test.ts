/**
 * Proxy / perspective language engine — pure unit fixtures
 *
 * Locks in the Phase-3 hardening of `backend/services/proxy-language-engine.ts`
 * against the runtime defects surfaced by the Phase-1 question-intelligence
 * audit. Pure + in-memory: requires NO live DATABASE_URL.
 *
 *   • "inside Abhi"        — subject injected mid-sentence after an unrecognised
 *                            preposition.
 *   • "your child they"    — double substitution / repeated referent.
 *   • broken subject-verb  — named singular subject + bare present verb.
 *   • embedded first person — stray "I"/"my" with no antecedent.
 *
 * Run with:  npx tsx backend/tests/proxy-language-engine.test.ts
 */

import assert from 'node:assert/strict';
import {
  proxySubjectNoun,
  normalizeSelfReport,
  rephraseForProxy,
} from '../services/proxy-language-engine';

let passed = 0;
let failed = 0;

function test(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  \u2713  ${label}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717  ${label}`);
    console.error(err);
    failed++;
  }
}

// Helper: a rewritten proxy stem must never contain a second-person token, never
// repeat the subject noun back-to-back, and never strand a first-person token.
function assertClean(out: string, subject: string) {
  const esc = subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // The subject noun itself may legitimately contain "your" (e.g. "your child"),
  // so scrub it out before scanning for leaked perspective pronouns.
  const scrubbed = out.replace(new RegExp(esc, 'gi'), '\u27e6S\u27e7');
  assert.ok(!/\b(you|your|yours|yourself|yourselves)\b/i.test(scrubbed), `2nd-person leaked: "${out}"`);
  assert.ok(!/\b(i|my|me|mine|myself|we|our|us)\b/i.test(scrubbed), `1st-person leaked: "${out}"`);
  assert.ok(!new RegExp(`\\b${esc}\\s+${esc}\\b`, 'i').test(out), `repeated subject: "${out}"`);
  assert.ok(!/\b(\w+)\s+\1\b/i.test(scrubbed), `repeated word: "${out}"`);
}

console.log('proxy-language-engine');

// ── proxySubjectNoun ──────────────────────────────────────────────────────────
test('proxySubjectNoun: explicit name wins over persona', () => {
  assert.equal(proxySubjectNoun('parent', 'Abhi'), 'Abhi');
});
test('proxySubjectNoun: parent → your child', () => {
  assert.equal(proxySubjectNoun('parent', ''), 'your child');
});
test('proxySubjectNoun: teacher/counsellor → your student', () => {
  assert.equal(proxySubjectNoun('teacher', null), 'your student');
  assert.equal(proxySubjectNoun('counsellor', null), 'your student');
});
test('proxySubjectNoun: founder → your team member', () => {
  assert.equal(proxySubjectNoun('founder', ''), 'your team member');
});
test('proxySubjectNoun: unknown → this person', () => {
  assert.equal(proxySubjectNoun('', ''), 'this person');
});

// ── normalizeSelfReport ───────────────────────────────────────────────────────
test('normalizeSelfReport: embedded first person → second person', () => {
  assert.equal(
    normalizeSelfReport('When you feel I cannot focus'),
    'When you feel you cannot focus',
  );
});
test('normalizeSelfReport: my → your', () => {
  assert.equal(normalizeSelfReport('how often do you doubt my ability'), 'how often do you doubt your ability');
});

// ── rephraseForProxy: named-bug regressions ───────────────────────────────────
test('bug "inside Abhi": preposition object → them, subject anchored up front', () => {
  const out = rephraseForProxy('How much tension do you feel inside you during exams?', 'Abhi');
  assert.ok(!/inside Abhi/i.test(out), `subject injected after prep: "${out}"`);
  assert.ok(/inside them/i.test(out), `prep object not degraded: "${out}"`);
  assertClean(out, 'Abhi');
});

test('bug "inside Abhi" (no aux): prep-object kept as them, name lands on the subject verb', () => {
  const out = rephraseForProxy('What actually happens inside you when you lose focus?', 'Abhi');
  assert.ok(!/inside Abhi/i.test(out), `subject injected after prep: "${out}"`);
  assert.ok(/inside them/i.test(out), `prep object not degraded: "${out}"`);
  assert.ok(/Abhi loses/i.test(out), `subject verb not conjugated: "${out}"`);
  assertClean(out, 'Abhi');
});

test('bug "your child they": no double substitution / repeated referent', () => {
  const out = rephraseForProxy('Do you think your effort matters?', 'your child');
  assert.ok(!/your child they|they your child/i.test(out), `double substitution: "${out}"`);
  assert.ok(/their effort/i.test(out), `possessive not degraded: "${out}"`);
  assertClean(out, 'your child');
});

test('bug broken subject-verb: bare subject conjugates following present verb', () => {
  const out = rephraseForProxy('When you face a setback, how do you react?', 'Abhi');
  assert.ok(/Abhi faces/i.test(out), `verb not conjugated: "${out}"`);
  assert.ok(!/Abhi face\b/i.test(out), `bare verb left: "${out}"`);
  assertClean(out, 'Abhi');
});

test('bug embedded first person flows through proxy rewrite cleanly', () => {
  const out = rephraseForProxy('Do you feel I cannot finish what I start?', 'Abhi');
  assertClean(out, 'Abhi');
});

// ── rephraseForProxy: grammatical anchors ─────────────────────────────────────
test('inverted auxiliary: "are you" → "is <subject>"', () => {
  const out = rephraseForProxy('How confident are you about deadlines?', 'Abhi');
  assert.ok(/is Abhi/i.test(out), `inverted aux not conjugated: "${out}"`);
  assertClean(out, 'Abhi');
});

test('subject+aux: "you are" → "<subject> is"', () => {
  const out = rephraseForProxy('When you are stressed, what happens?', 'Abhi');
  assert.ok(/Abhi is/i.test(out), `subject+aux not conjugated: "${out}"`);
  assertClean(out, 'Abhi');
});

test('reflexive "yourself" → themselves (kept natural, not butchered)', () => {
  const out = rephraseForProxy('How often do you calm yourself before a test?', 'Abhi');
  assert.ok(/themselves/i.test(out), `reflexive not degraded: "${out}"`);
  assertClean(out, 'Abhi');
});

test('contraction "you\'re" expands and anchors', () => {
  const out = rephraseForProxy("How sure are you that you're ready?", 'Abhi');
  assertClean(out, 'Abhi');
});

test('trailing tag question keeps auxiliary, swaps pronoun only', () => {
  const out = rephraseForProxy('You can handle pressure, can you?', 'Abhi');
  assert.ok(/can they\b/i.test(out), `tag not swapped to they: "${out}"`);
  assertClean(out, 'Abhi');
});

test('possessive "your" → their', () => {
  const out = rephraseForProxy('How do you rate your focus?', 'your student');
  assert.ok(/their focus/i.test(out), `possessive not degraded: "${out}"`);
  assertClean(out, 'your student');
});

test('output begins capitalised even when subject lands first', () => {
  const out = rephraseForProxy('you avoid difficult tasks often', 'abhi');
  assert.ok(/^[A-Z]/.test(out.trim()), `not capitalised: "${out}"`);
});

test('empty / whitespace input is a no-op', () => {
  assert.equal(rephraseForProxy('', 'Abhi'), '');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
