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

/**
 * Verifies that when responseStyle='concise' is sent, the reply is
 * genuinely shorter than its standard counterpart for the same message.
 *
 * Covers three distinct message types:
 *   1. Greeting — multi-block response; conciseness keeps only the first block.
 *   2. Product / informational question (LBI, MetryxOne) — kbLookup returns a
 *      long multi-block response; conciseness keeps only the first block, making
 *      the concise reply strictly shorter.
 *   3. Diagnostic question — emotional/counsellor message (burnout) triggers a
 *      long multi-block response; conciseness keeps only the first block.
 *
 * A fourth advisory case is included with a lenient (<=) assertion because
 * the counsellor deliberately produces a short single-sentence probe question
 * that cannot be shortened further — that is the correct product behaviour and
 * should not be forced shorter.
 *
 * Each pair uses its own sessionId to avoid cross-test session state.
 */

// Cases where the standard response spans multiple blocks or sentences and
// must be strictly shorter in concise mode.
const STRICT_CASES = [
  {
    name: 'greeting: concise reply is strictly shorter than standard reply',
    message: 'Hello, I need some help please.',
    userRole: 'parent',
  },
  {
    name: 'product question — What is LBI: concise reply is strictly shorter than standard reply',
    message: 'What is the LBI assessment?',
    userRole: 'parent',
  },
  {
    name: 'product question — About MetryxOne: concise reply is strictly shorter than standard reply',
    message: 'What is MetryxOne?',
    userRole: 'guest',
  },
  {
    name: 'diagnostic question — burnout: concise reply is strictly shorter than standard reply',
    message: 'My child is completely overwhelmed and burnt out from board exam pressure.',
    userRole: 'parent',
  },
];

// Cases where the counsellor intentionally returns a short single-sentence
// probe and conciseness cannot reduce it further — the reply may be equal.
const LENIENT_CASES = [
  {
    name: 'advisory question — exam stress: concise reply is no longer than standard reply',
    message: 'My child has board exams coming up and is very stressed. What should I do?',
    userRole: 'parent',
  },
];

for (const c of STRICT_CASES) {
  test(c.name, async () => {
    const stdSession = uniqSession('std');
    const cncSession = uniqSession('cnc');

    const [stdData, cncData] = await Promise.all([
      postChat(c.message, stdSession, 'standard', c.userRole),
      postChat(c.message, cncSession, 'concise', c.userRole),
    ]);

    assert.ok(
      typeof stdData.response === 'string' && stdData.response.length > 0,
      `standard response must be a non-empty string; got: ${JSON.stringify(stdData.response)}`,
    );

    assert.ok(
      typeof cncData.response === 'string' && cncData.response.length > 0,
      `concise response must be a non-empty string; got: ${JSON.stringify(cncData.response)}`,
    );

    const stdLen = stdData.response.length;
    const cncLen = cncData.response.length;

    assert.ok(
      cncLen < stdLen,
      `concise response (${cncLen} chars) must be strictly shorter than standard response (${stdLen} chars)\n` +
      `standard: ${stdData.response.slice(0, 200)}\n` +
      `concise:  ${cncData.response.slice(0, 200)}`,
    );
  });
}

for (const c of LENIENT_CASES) {
  test(c.name, async () => {
    const stdSession = uniqSession('std');
    const cncSession = uniqSession('cnc');

    const [stdData, cncData] = await Promise.all([
      postChat(c.message, stdSession, 'standard', c.userRole),
      postChat(c.message, cncSession, 'concise', c.userRole),
    ]);

    assert.ok(
      typeof stdData.response === 'string' && stdData.response.length > 0,
      `standard response must be a non-empty string; got: ${JSON.stringify(stdData.response)}`,
    );

    assert.ok(
      typeof cncData.response === 'string' && cncData.response.length > 0,
      `concise response must be a non-empty string; got: ${JSON.stringify(cncData.response)}`,
    );

    const stdLen = stdData.response.length;
    const cncLen = cncData.response.length;

    // The counsellor returns a short single-sentence probe that cannot be
    // shortened further; concise mode must not make it longer.
    assert.ok(
      cncLen <= stdLen,
      `concise response (${cncLen} chars) must be no longer than standard response (${stdLen} chars)\n` +
      `standard: ${stdData.response.slice(0, 200)}\n` +
      `concise:  ${cncData.response.slice(0, 200)}`,
    );
  });
}

test('conciseness persists across multiple turns in the same session', async () => {
  // Two long-lived sessions that accumulate context across turns — one always
  // sends responseStyle='standard', the other always sends 'concise'. All three
  // messages hit the kbLookup path and return long multi-block responses, so
  // each concise turn must be strictly shorter than its standard counterpart.
  const stdSessionId = uniqSession('std_persist');
  const cncSessionId = uniqSession('cnc_persist');

  const turns = [
    { message: 'Hello, I need some help please.', userRole: 'parent' },
    { message: 'What is the LBI assessment?', userRole: 'parent' },
    { message: 'What is MetryxOne?', userRole: 'parent' },
  ];

  for (let i = 0; i < turns.length; i++) {
    const { message, userRole } = turns[i];

    // Send to both sessions sequentially so each session builds matching
    // conversational context turn-by-turn.
    const stdData = await postChat(message, stdSessionId, 'standard', userRole);
    const cncData = await postChat(message, cncSessionId, 'concise', userRole);

    assert.ok(
      typeof stdData.response === 'string' && stdData.response.length > 0,
      `turn ${i + 1} standard response must be a non-empty string`,
    );

    assert.ok(
      typeof cncData.response === 'string' && cncData.response.length > 0,
      `turn ${i + 1} concise response must be a non-empty string`,
    );

    const stdLen = stdData.response.length;
    const cncLen = cncData.response.length;

    assert.ok(
      cncLen < stdLen,
      `turn ${i + 1} "${message.slice(0, 40)}": concise (${cncLen} chars) must be strictly shorter than standard (${stdLen} chars)\n` +
      `standard: ${stdData.response.slice(0, 200)}\n` +
      `concise:  ${cncData.response.slice(0, 200)}`,
    );
  }
});
