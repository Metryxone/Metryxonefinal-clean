import assert from 'node:assert';
import {
  isAttributedOrThirdPersonSelfTalk,
  planRewrite,
} from '../scripts/audit/proxy-language-cleanup.mjs';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log('  \u2713 ', name);
  } catch (e) {
    failed++;
    console.log('  \u2717 ', name);
    console.log('      ', (e as Error).message);
  }
}

// ── isAttributedOrThirdPersonSelfTalk ──
test('literal-quoted self-talk is deferred', () => {
  assert.ok(isAttributedOrThirdPersonSelfTalk('how often do you feel "I am not ready yet"?'));
  assert.ok(isAttributedOrThirdPersonSelfTalk('stuck thinking about "what if I fail in my career"?'));
});

test('attributed-thought signal ("thoughts like") is deferred', () => {
  assert.ok(isAttributedOrThirdPersonSelfTalk('recognize thoughts like I\'ll do it later as a trigger'));
});

test('explicit third-person subject is deferred', () => {
  assert.ok(isAttributedOrThirdPersonSelfTalk('How often does the child feel I cannot focus while studying alone?'));
  assert.ok(isAttributedOrThirdPersonSelfTalk('Does the student think their effort matters?'));
});

test('Windows-1252 mojibake-quoted self-talk (U+0093/U+0094) is deferred', () => {
  // real dataset encoding: inner-speech wrapped in C1 control smart quotes, NOT ASCII/Unicode
  assert.ok(isAttributedOrThirdPersonSelfTalk('how often do you feel \u0093I am not good enough\u0094 during preparation?'));
  assert.ok(isAttributedOrThirdPersonSelfTalk('how often do you feel \u0093you are not good enough\u0094?')); // already-flipped form still deferred
});

test('what-if / thoughts-about attribution is deferred (unquoted)', () => {
  assert.ok(isAttributedOrThirdPersonSelfTalk('how often do thoughts about what if I never succeed affect you?'));
  assert.ok(isAttributedOrThirdPersonSelfTalk('how often do what if I fail thoughts stop you?'));
});

test('plain mis-authored first-person stem is NOT deferred', () => {
  assert.ok(!isAttributedOrThirdPersonSelfTalk('How often do you feel I am not good enough during preparation?'));
});

// ── planRewrite routing ──
test('quoted self-talk routes to manual-review, no auto-rewrite', () => {
  const p = planRewrite('When you see job descriptions, how often do you feel "I am not ready yet"?');
  assert.ok(p, 'should be flagged');
  assert.strictEqual(p!.classification, 'manual-review');
  assert.strictEqual(p!.rule, 'quoted_or_attributed_self_talk_needs_authoring');
  assert.strictEqual(p!.rewritten, '');
});

test('third-person-subject stem routes to manual-review, no auto-rewrite', () => {
  const p = planRewrite('How often does the child feel I cannot focus properly while studying alone?');
  assert.ok(p);
  assert.strictEqual(p!.classification, 'manual-review');
  assert.strictEqual(p!.rule, 'quoted_or_attributed_self_talk_needs_authoring');
});

test('plain first-person stem still auto-rewrites to second person', () => {
  const p = planRewrite('How often do you feel I am not good enough during preparation?');
  assert.ok(p);
  assert.strictEqual(p!.rule, 'first_person_to_second');
  assert.ok(/you are not good enough/i.test(p!.rewritten), `got: ${p!.rewritten}`);
  assert.ok(!/\bI\b/.test(p!.rewritten), `residual first-person: ${p!.rewritten}`);
});

test('natural reflexive stem is a confirmed no-op (engine handles proxy)', () => {
  const p = planRewrite('When stress increases, how effectively can you calm yourself?');
  assert.ok(p);
  assert.strictEqual(p!.rule, 'no_change_engine_handles_reflexive');
  assert.strictEqual(p!.rewritten, p!.original);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
