/**
 * Tests that applyConcisenessFilter() correctly handles two distinct response
 * shapes when responseStyle is 'concise':
 *
 *   1. Bullet-list response  — the filter must return the framing intro line
 *      AND exactly the first bullet item (no further bullets).
 *
 *   2. Plain-paragraph response — the filter must trim the reply to at most
 *      two sentences when there are no bullet lists present.
 *
 * Both assertions are made against live API responses so the full processing
 * pipeline (KB scripted reply → applyConcisenessFilter) is exercised.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.CHAT_TEST_BASE_URL || 'http://localhost:8000';

async function postChat(message, sessionId, responseStyle = 'standard', userRole = 'parent') {
  const res = await fetch(`${BASE}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, responseStyle, context: { userRole } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function uniqSession(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const BULLET_RE = /^\s*([-*•]|\d+[.)]) /m;
const BULLET_RE_GLOBAL = /^\s*([-*•]|\d+[.)]) /gm;

/**
 * "What is the LBI assessment?" maps to a scripted KB entry whose standard
 * response contains multiple bullet points (key domain list).  In concise mode
 * applyConcisenessFilter must keep:
 *   • the framing/intro text that precedes the first bullet
 *   • the first bullet item itself
 * — and nothing more from the bullet list.
 */
test('bullet-list response: concise reply preserves the framing line and exactly one bullet', async () => {
  const stdSession = uniqSession('std_bullet');
  const cncSession = uniqSession('cnc_bullet');

  const [stdData, cncData] = await Promise.all([
    postChat('What is the LBI assessment?', stdSession, 'standard', 'parent'),
    postChat('What is the LBI assessment?', cncSession, 'concise', 'parent'),
  ]);

  const std = stdData.response;
  const cnc = cncData.response;

  assert.ok(typeof std === 'string' && std.length > 0, 'standard response must be non-empty');
  assert.ok(typeof cnc === 'string' && cnc.length > 0, 'concise response must be non-empty');

  // The standard response for this KB entry must have multiple bullets.
  const stdBullets = (std.match(BULLET_RE_GLOBAL) ?? []).length;
  assert.ok(
    stdBullets > 1,
    `standard response must contain more than one bullet (got ${stdBullets}); ` +
    `this message may no longer map to the expected scripted KB entry.\nstandard: ${std.slice(0, 300)}`,
  );

  // The concise response must contain exactly one bullet — the first one.
  const cncBullets = (cnc.match(BULLET_RE_GLOBAL) ?? []).length;
  assert.equal(
    cncBullets,
    1,
    `concise response must contain exactly one bullet; got ${cncBullets}:\n${cnc}`,
  );

  // There must be at least one non-empty line BEFORE the bullet (the framing intro).
  const nonEmptyLines = cnc.split('\n').filter(l => l.trim().length > 0);
  const firstBulletLineIdx = nonEmptyLines.findIndex(l => BULLET_RE.test(l));
  assert.ok(
    firstBulletLineIdx > 0,
    `concise response must have a framing/intro line before the bullet item; got:\n${cnc}`,
  );
});

/**
 * An emotional/conversational message that does not match any KB entry is
 * handled by the counsellor AI, which returns plain prose (no bullets).
 * In concise mode the plain-paragraph branch of applyConcisenessFilter must
 * keep only the first one or two sentences.
 *
 * The test first confirms (via the standard response) that this message
 * reliably triggers a prose-only reply.  If the standard response unexpectedly
 * contains bullets the test fails with a diagnostic message so the chosen
 * message can be updated — this is preferable to silently skipping the
 * sentence-count assertion.
 */
test('plain-paragraph response: concise reply contains at most two sentences', async () => {
  const stdSession = uniqSession('std_para');
  const cncSession = uniqSession('cnc_para');

  // "Hello" triggers the counsellor greeting path which returns a 4-sentence
  // prose welcome — no KB match, no bullets.  Concise mode must trim it to
  // the first 1–2 sentences.
  const message = 'Hello';

  const [stdData, cncData] = await Promise.all([
    postChat(message, stdSession, 'standard', 'parent'),
    postChat(message, cncSession, 'concise', 'parent'),
  ]);

  const std = stdData.response;
  const cnc = cncData.response;

  assert.ok(typeof std === 'string' && std.length > 0, 'standard response must be non-empty');
  assert.ok(typeof cnc === 'string' && cnc.length > 0, 'concise response must be non-empty');

  // Precondition: the standard response for this emotional message must be
  // plain prose.  If it contains bullets the message has started matching a
  // KB entry and the chosen prompt must be updated to keep this test on the
  // plain-paragraph code path.
  assert.ok(
    !BULLET_RE.test(std),
    `precondition failed: standard response for the prose test message contains bullets; ` +
    `update the test prompt so it stays on the plain-paragraph path.\nstandard: ${std.slice(0, 300)}`,
  );

  // Concise response must also be plain prose (no bullets injected by the filter).
  assert.ok(
    !BULLET_RE.test(cnc),
    `concise plain-paragraph response must not contain bullets; ` +
    `the filter may have incorrectly switched branches.\nconcise: ${cnc}`,
  );

  // The plain-paragraph branch of applyConcisenessFilter keeps the first 2
  // sentences at most.
  const sentences = cnc.match(/[^.!?]+[.!?]+/g) ?? [];
  assert.ok(
    sentences.length <= 2,
    `concise plain-paragraph response must contain at most 2 sentences; ` +
    `got ${sentences.length}:\n${cnc}`,
  );
});
