/**
 * Integration test: POST /api/chat/message returns correct video suggestions
 * for authenticated requests, and proves that identity is established ONLY from
 * a cryptographically verified JWT.
 *
 * Covers the authenticated branch in chat.ts that queries chat_preferences
 * from the DB before selecting videos.  pool.query is stubbed via mock.method
 * so no live database connection is required.
 *
 * Auth is exercised via:
 *   - Authorization: Bearer <JWT>  (optionalAuth token-verification path)
 *
 * SECURITY REGRESSION GUARD: the former `x-user-id` / `x-user-role` header
 * fallback has been removed (it allowed trivial impersonation).  A dedicated
 * test asserts that supplying those headers alone does NOT authenticate the
 * request, so the user-scoped chat_preferences query is never reached.
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
    'videoSuggestions must be present and non-empty after the DB-preferences branch ran',
  );

  assert.ok(
    prefQueryCalls.length > callsBefore,
    `pool.query for chat_preferences was not called (callsBefore=${callsBefore}, callsAfter=${prefQueryCalls.length})`,
  );

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

// ─── Security regression guard ────────────────────────────────────────────────
// The removed `x-user-id` / `x-user-role` header fallback must NOT authenticate.
// optionalAuth lets the request through anonymously (HTTP 200), but req.user must
// be undefined, so the user-scoped chat_preferences query is never executed.

test('security — x-user-id / x-user-role headers do NOT authenticate (no user-scoped DB query)', async () => {
  const spoofedUserId = `attacker-spoof-${Date.now()}`;
  const callsBefore = prefQueryCalls.length;

  const res = await fetch(`${baseUrl}/api/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': spoofedUserId,
      'x-user-role': 'super_admin',
    },
    body: JSON.stringify({
      message: 'I need help with exams',
      sessionId: `spoof-${Date.now()}`,
    }),
  });

  // optionalAuth does not reject anonymous requests — the route still answers.
  assert.equal(
    res.status,
    200,
    `Expected HTTP 200 (anonymous) for header-spoofed message; got ${res.status}`,
  );

  // But identity must NOT have been established, so no user-scoped preferences
  // query may have run for the spoofed id.
  const spoofedCalls = prefQueryCalls
    .slice(callsBefore)
    .filter((c) => c.userId === spoofedUserId);

  assert.equal(
    spoofedCalls.length,
    0,
    `x-user-id header must not authenticate: a chat_preferences query ran for the ` +
      `spoofed id "${spoofedUserId}" (${spoofedCalls.length} call(s))`,
  );
});
