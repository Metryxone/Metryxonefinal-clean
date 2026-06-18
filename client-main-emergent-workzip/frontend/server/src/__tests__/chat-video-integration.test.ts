/**
 * Integration test: POST /api/chat/message returns correct video suggestions.
 *
 * Spins up a minimal Express server (port 0), fires a POST with a clear
 * exam-related message, and asserts that the `videoSuggestions` array in the
 * JSON response contains at least one exam-related video.
 *
 * The request is unauthenticated, so no real DB queries are made.
 * A fresh sessionId is used each time to avoid cross-test state leakage.
 *
 * Run:
 *   node --import tsx/esm --test src/__tests__/chat-video-integration.test.ts
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import express from 'express';
import { pool } from '../db/client.js';
import chatRouter from '../routes/chat.js';

let server: Server;
let baseUrl: string;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', chatRouter);

  await new Promise<void>((resolve) => {
    server = createServer(app).listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  // End the pool with a short timeout so the process can exit cleanly even
  // if no DB connection was ever established during the test run.
  await Promise.race([
    pool.end(),
    new Promise<void>((resolve) => setTimeout(resolve, 2000)),
  ]);
});

// ─── Helper ───────────────────────────────────────────────────────────────────

interface ChatResponse {
  response?: string;
  videoSuggestions?: Array<{ id: string; title: string; topics: string[] }>;
  intent?: string;
  userType?: string;
  [key: string]: unknown;
}

async function postMessage(message: string, sessionId: string): Promise<ChatResponse> {
  const res = await fetch(`${baseUrl}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });
  assert.equal(res.status, 200, `Expected HTTP 200 for message "${message}"; got ${res.status}`);
  return res.json() as Promise<ChatResponse>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('exam message — response includes videoSuggestions array', async () => {
  const body = await postMessage('I need help with exams', `test-exam-${Date.now()}`);

  assert.ok(
    Array.isArray(body.videoSuggestions),
    `Expected videoSuggestions to be an array; got: ${JSON.stringify(body.videoSuggestions)}`,
  );
});

test('exam message — at least one exam-related video is returned', async () => {
  const body = await postMessage('I need help with exams', `test-exam2-${Date.now()}`);

  assert.ok(Array.isArray(body.videoSuggestions), 'videoSuggestions must be an array');
  assert.ok(
    body.videoSuggestions!.length > 0,
    'Expected at least one video suggestion for an exam-related message',
  );

  const ids = body.videoSuggestions!.map((v) => v.id);
  const examVideoIds = ['v_exam_ready', 'v_board_prep'];
  const hasExamVideo = ids.some((id) => examVideoIds.includes(id));

  assert.ok(
    hasExamVideo,
    `Expected at least one of [${examVideoIds.join(', ')}] in videoSuggestions; got: [${ids.join(', ')}]`,
  );
});

test('exam message — response JSON shape contains all required fields', async () => {
  const body = await postMessage('I need help with exams', `test-exam3-${Date.now()}`);

  for (const field of ['response', 'intent', 'userType', 'videoSuggestions']) {
    assert.ok(field in body, `Response is missing required field: "${field}"`);
  }
});

test('fresh sessionId per request — no cross-session state leakage', async () => {
  const ts = Date.now();
  const body1 = await postMessage('I need help with exams', `test-session-a-${ts}`);
  const body2 = await postMessage('I need help with exams', `test-session-b-${ts}`);

  assert.ok(Array.isArray(body1.videoSuggestions), 'session-a: videoSuggestions must be array');
  assert.ok(Array.isArray(body2.videoSuggestions), 'session-b: videoSuggestions must be array');

  const ids1 = body1.videoSuggestions!.map((v) => v.id).sort().join(',');
  const ids2 = body2.videoSuggestions!.map((v) => v.id).sort().join(',');

  assert.equal(ids1, ids2, 'Identical messages on fresh sessions should return identical video sets');
});

test('non-exam message — exam-specific videos are not returned', async () => {
  const body = await postMessage(
    'Tell me about hiring and HR culture fit',
    `test-hr-${Date.now()}`,
  );

  assert.ok(Array.isArray(body.videoSuggestions), 'videoSuggestions must be an array');

  const ids = body.videoSuggestions!.map((v) => v.id);
  const examOnlyIds = ['v_exam_ready', 'v_board_prep'];
  const hasExamVideo = ids.some((id) => examOnlyIds.includes(id));

  assert.ok(
    !hasExamVideo,
    `An HR-focused message should not return exam-specific videos; got: [${ids.join(', ')}]`,
  );
});
