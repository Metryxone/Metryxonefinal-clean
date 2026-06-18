/**
 * Integration test: POST /api/chat/message returns correct video suggestions
 * when the request is authenticated (JWT bearer token or x-user-id header).
 *
 * Covers the authenticated branch in chat.ts that queries chat_preferences
 * from the DB before selecting videos.  pool.query is stubbed via mock.method
 * so no live database connection is required.
 *
 * Two auth mechanisms are exercised:
 *   1. x-user-id / x-user-role headers (optionalAuth header-fallback path)
 *   2. Authorization: Bearer <JWT> (optionalAuth token-verification path)
 *
 * Run:
 *   node --import tsx/esm --test src/__tests__/chat-video-integration-auth.test.ts
 */

import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db/client.js';
import chatRouter from '../routes/chat.js';

// ─── Stub pool.query before the server handles any requests ───────────────────
// The chat route queries: SELECT response_style, preferred_language
//                          FROM chat_preferences WHERE user_id = $1
// We return a standard/english preference row so the DB path executes fully
// and then falls through to the normal video-selection logic.
//
// prefQueryCalls records each (sql, userId) pair intercepted so tests can
// assert the branch was actually reached.
interface PrefQueryCall { sql: string; userId: unknown; }
export const prefQueryCalls: PrefQueryCall[] = [];

mock.method(
  pool,
  'query',
  async (sql: string, params: unknown[]) => {
    if (typeof sql === 'string' && sql.includes('chat_preferences')) {
      prefQueryCalls.push({ sql, userId: params?.[0] ?? null });
      return {
        rows: [{ response_style: 'standard', preferred_language: 'english' }],
        rowCount: 1,
      };
    }
    // Any other query should not be reached during these tests.
    throw new Error(`Unexpected DB query in auth test: ${String(sql).slice(0, 120)}`);
  },
);

// ─── JWT helper ───────────────────────────────────────────────────────────────
const JWT_SECRET =
  process.env.JWT_SECRET ?? 'metryx-dev-secret-change-in-production';

function mintToken(userId: string): string {
  return jwt.sign(
    { userId, role: 'parent', roles: ['parent'] },
    JWT_SECRET,
    { expiresIn: '1h' } as jwt.SignOptions,
  );
}

// ─── Server lifecycle ─────────────────────────────────────────────────────────

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
  await Promise.race([
    pool.end(),
    new Promise<void>((resolve) => setTimeout(resolve, 2000)),
  ]);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ChatResponse {
  response?: string;
  videoSuggestions?: Array<{ id: string; title: string; topics: string[] }>;
  intent?: string;
  userType?: string;
  [key: string]: unknown;
}

async function postMessageHeader(
  message: string,
  sessionId: string,
  userId: string,
): Promise<ChatResponse> {
  const res = await fetch(`${baseUrl}/api/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-role': 'user',
    },
    body: JSON.stringify({ message, sessionId }),
  });
  assert.equal(
    res.status,
    200,
    `Expected HTTP 200 for header-auth message "${message}"; got ${res.status}`,
  );
  return res.json() as Promise<ChatResponse>;
}

async function postMessageJwt(
  message: string,
  sessionId: string,
  userId: string,
): Promise<ChatResponse> {
  const token = mintToken(userId);
  const res = await fetch(`${baseUrl}/api/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message, sessionId }),
  });
  assert.equal(
    res.status,
    200,
    `Expected HTTP 200 for JWT-auth message "${message}"; got ${res.status}`,
  );
  return res.json() as Promise<ChatResponse>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('authenticated (header) — videoSuggestions is an array', async () => {
  const body = await postMessageHeader(
    'I need help with exams',
    `auth-header-exam-${Date.now()}`,
    'test-user-header-1',
  );

  assert.ok(
    Array.isArray(body.videoSuggestions),
    `Expected videoSuggestions to be an array; got: ${JSON.stringify(body.videoSuggestions)}`,
  );
});

test('authenticated (header) — at least one exam-related video is returned', async () => {
  const body = await postMessageHeader(
    'I need help with exams',
    `auth-header-exam2-${Date.now()}`,
    'test-user-header-2',
  );

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

test('authenticated (header) — response JSON shape contains all required fields', async () => {
  const body = await postMessageHeader(
    'I need help with exams',
    `auth-header-shape-${Date.now()}`,
    'test-user-header-3',
  );

  for (const field of ['response', 'intent', 'userType', 'videoSuggestions']) {
    assert.ok(field in body, `Response is missing required field: "${field}"`);
  }
});

test('authenticated (JWT) — videoSuggestions is an array', async () => {
  const body = await postMessageJwt(
    'I need help with exams',
    `auth-jwt-exam-${Date.now()}`,
    'test-user-jwt-1',
  );

  assert.ok(
    Array.isArray(body.videoSuggestions),
    `Expected videoSuggestions to be an array; got: ${JSON.stringify(body.videoSuggestions)}`,
  );
});

test('authenticated (JWT) — at least one exam-related video is returned', async () => {
  const body = await postMessageJwt(
    'I need help with exams',
    `auth-jwt-exam2-${Date.now()}`,
    'test-user-jwt-2',
  );

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

test('authenticated (JWT) — response JSON shape contains all required fields', async () => {
  const body = await postMessageJwt(
    'I need help with exams',
    `auth-jwt-shape-${Date.now()}`,
    'test-user-jwt-3',
  );

  for (const field of ['response', 'intent', 'userType', 'videoSuggestions']) {
    assert.ok(field in body, `Response is missing required field: "${field}"`);
  }
});

test('authenticated (JWT) — non-exam message does not return exam-specific videos', async () => {
  const body = await postMessageJwt(
    'Tell me about hiring and HR culture fit',
    `auth-jwt-hr-${Date.now()}`,
    'test-user-jwt-4',
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

test('authenticated (header) — pool.query is invoked with chat_preferences SQL and correct user ID', async () => {
  const userId = `test-user-db-branch-${Date.now()}`;
  const callsBefore = prefQueryCalls.length;

  const body = await postMessageHeader(
    'I need help with exams',
    `auth-header-db-branch-${Date.now()}`,
    userId,
  );

  // Assert the response still contains video suggestions.
  assert.ok(
    Array.isArray(body.videoSuggestions) && body.videoSuggestions.length > 0,
    'videoSuggestions must be present and non-empty after the DB-preferences branch ran',
  );

  // Assert pool.query was actually called at least once more after this request.
  assert.ok(
    prefQueryCalls.length > callsBefore,
    `pool.query for chat_preferences was not called for the authenticated request (callsBefore=${callsBefore}, callsAfter=${prefQueryCalls.length})`,
  );

  // Assert the most-recent call used the chat_preferences table and passed the user ID.
  const lastCall = prefQueryCalls[prefQueryCalls.length - 1];
  assert.ok(
    lastCall.sql.includes('chat_preferences'),
    `Expected pool.query SQL to mention chat_preferences; got: ${lastCall.sql}`,
  );
  assert.equal(
    lastCall.userId,
    userId,
    `Expected pool.query to be called with user ID "${userId}"; got: ${String(lastCall.userId)}`,
  );
});

test('authenticated (JWT) — pool.query is invoked with chat_preferences SQL and correct user ID', async () => {
  const userId = `test-user-jwt-db-branch-${Date.now()}`;
  const callsBefore = prefQueryCalls.length;

  const body = await postMessageJwt(
    'I need help with exams',
    `auth-jwt-db-branch-${Date.now()}`,
    userId,
  );

  assert.ok(
    Array.isArray(body.videoSuggestions) && body.videoSuggestions.length > 0,
    'JWT: videoSuggestions must be present and non-empty after the DB-preferences branch ran',
  );

  assert.ok(
    prefQueryCalls.length > callsBefore,
    `JWT: pool.query for chat_preferences was not called (callsBefore=${callsBefore}, callsAfter=${prefQueryCalls.length})`,
  );

  const lastCall = prefQueryCalls[prefQueryCalls.length - 1];
  assert.ok(
    lastCall.sql.includes('chat_preferences'),
    `JWT: Expected pool.query SQL to mention chat_preferences; got: ${lastCall.sql}`,
  );
  assert.equal(
    lastCall.userId,
    userId,
    `JWT: Expected pool.query to be called with user ID "${userId}"; got: ${String(lastCall.userId)}`,
  );
});
