import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.CHAT_TEST_BASE_URL || 'http://localhost:8000';

async function postChat(message, sessionId, userRole = 'parent') {
  const res = await fetch(`${BASE}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, context: { userRole } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function uniqSession(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The frontend ChatModal renders the highlighted "Helpful video — take a moment
 * to watch" tile (and the "Would you like a moment before we continue?" line)
 * iff the API response carries `sensitive: true` AND a non-empty
 * `videoSuggestions` array. These tests exercise each of the four newly
 * added sensitive counsellor branches end-to-end through the Express route
 * and assert the contract that drives the highlighted UI.
 */

const CASES = [
  {
    name: 'betterment / failed board exam branch returns a sensitive highlight',
    message: 'My child failed the 12th board exam and needs the betterment exam.',
    expectInResponse: 'Betterment',
  },
  {
    name: 'coaching / tuition dependency branch returns a sensitive highlight',
    message: 'My child cannot study without tuition coaching and is weak in basics.',
    expectInResponse: 'Coaching Dependency',
  },
  {
    name: 'stream selection branch returns a sensitive highlight',
    message: 'Should my child take PCM or PCB stream after 10th?',
    expectInResponse: 'Stream',
  },
  {
    name: 'phone / digital distraction branch returns a sensitive highlight',
    message: "Phone addiction is hurting my child's board exam preparation.",
    expectInResponse: 'Digital Distraction',
  },
  {
    name: 'topper-pressure / comparative-anxiety branch returns a sensitive highlight',
    message: "We keep comparing my child to the neighbour's kid who is the class topper.",
    expectInResponse: 'Topper Pressure',
  },
  {
    name: 'burnout / overwhelm branch returns a sensitive highlight',
    message: 'My child is completely overwhelmed and burnt out from board exam pressure.',
    expectInResponse: 'Academic Burnout',
  },
];

for (const c of CASES) {
  test(c.name, async () => {
    const data = await postChat(c.message, uniqSession('sens'));

    assert.equal(
      data.sensitive,
      true,
      `expected sensitive=true so the chat highlight renders; got ${data.sensitive}. response="${data.response?.slice(0, 120)}"`,
    );

    assert.ok(
      Array.isArray(data.videoSuggestions) && data.videoSuggestions.length > 0,
      `expected at least one videoSuggestion so the highlighted video tile renders; got ${JSON.stringify(data.videoSuggestions)}`,
    );

    for (const v of data.videoSuggestions) {
      assert.ok(v.id && v.title && v.embedUrl, `videoSuggestion missing required fields: ${JSON.stringify(v)}`);
    }

    assert.ok(
      typeof data.response === 'string' && data.response.includes(c.expectInResponse),
      `expected counsellor reply to mention "${c.expectInResponse}"; got: ${data.response?.slice(0, 200)}`,
    );
  });
}

test('non-sensitive factual branch does NOT trigger the highlight', async () => {
  const data = await postChat('What is the LBI assessment?', uniqSession('plain'));
  assert.equal(data.sensitive, false, 'factual product question should not be flagged sensitive');
});
