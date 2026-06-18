import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.CHAT_TEST_BASE_URL || 'http://localhost:8000';

function uniqSession(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * POST /api/chat/message helper.
 * `preferredLanguage` is intentionally optional so individual tests can omit it
 * to exercise server-side defaults and session-persistence behaviour.
 */
async function postChat(message, sessionId, preferredLanguage) {
  const payload = { message, sessionId, context: { userRole: 'parent' } };
  if (preferredLanguage !== undefined) payload.preferredLanguage = preferredLanguage;
  const res = await fetch(`${BASE}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Verifies that POST /api/chat/message correctly handles the preferredLanguage
 * field end-to-end: the server stores it in the session, echoes it in the
 * response body, and constructs a non-empty languageInstruction for non-English
 * languages.
 */

test('server stores preferredLanguage and echoes it in the response for Hindi', async () => {
  const sessionId = uniqSession('lang_hindi');
  const data = await postChat('Hello, I need some help.', sessionId, 'hindi');

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );

  assert.strictEqual(
    data.preferredLanguage,
    'hindi',
    `response must echo preferredLanguage: 'hindi'; got: ${JSON.stringify(data.preferredLanguage)}`,
  );

  assert.ok(
    typeof data.languageInstruction === 'string' && data.languageInstruction.length > 0,
    `languageInstruction must be a non-empty string when preferredLanguage is 'hindi'; got: ${JSON.stringify(data.languageInstruction)}`,
  );
});

test('server defaults to english when preferredLanguage is omitted from the request body', async () => {
  const sessionId = uniqSession('lang_default');
  // Deliberately omit preferredLanguage to verify the server falls back to 'english'.
  const data = await postChat('Hello, I need some help.', sessionId);

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );

  assert.strictEqual(
    data.preferredLanguage,
    'english',
    `response must default to preferredLanguage: 'english' when field is omitted; got: ${JSON.stringify(data.preferredLanguage)}`,
  );
});

test('server persists preferredLanguage in session so clients need not re-send it', async () => {
  const sessionId = uniqSession('lang_persist');

  // Turn 1: explicitly declare Hindi preference.
  const turn1 = await postChat('Hello', sessionId, 'hindi');
  assert.strictEqual(
    turn1.preferredLanguage,
    'hindi',
    `turn 1 must echo preferredLanguage: 'hindi'; got: ${JSON.stringify(turn1.preferredLanguage)}`,
  );

  // Turn 2: omit preferredLanguage entirely — server must recall it from session.
  const turn2 = await postChat('Tell me more', sessionId);
  assert.strictEqual(
    turn2.preferredLanguage,
    'hindi',
    `turn 2 must return preferredLanguage: 'hindi' from session even when field is omitted; got: ${JSON.stringify(turn2.preferredLanguage)}`,
  );

  assert.ok(
    typeof turn2.languageInstruction === 'string' && turn2.languageInstruction.length > 0,
    `turn 2 languageInstruction must remain non-empty from session; got: ${JSON.stringify(turn2.languageInstruction)}`,
  );
});
