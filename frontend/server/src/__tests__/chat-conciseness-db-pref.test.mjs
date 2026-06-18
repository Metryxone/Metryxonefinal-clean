/**
 * Verifies that the DB-stored response_style preference takes precedence over
 * the client-sent responseStyle for authenticated users.
 *
 * Three cases:
 *   1. DB = 'concise', client sends responseStyle='standard' (header auth)
 *      → response must be trimmed (concise), proving the DB preference wins.
 *   2. DB = 'standard', client sends responseStyle='concise' (header auth)
 *      → response must NOT be shortened (standard), proving the DB preference wins.
 *   3. DB = 'concise', client sends responseStyle='standard' (JWT bearer token auth)
 *      → same outcome as case 1, but exercises the JWT parsing path in optionalAuth.
 *
 * Cases 1 & 2 use the x-user-id header fallback accepted by optionalAuth.
 * Case 3 mints a real HS256 JWT signed with the server's default dev secret so
 * the bearer-token verification path in auth.ts is covered.
 *
 * Because chat_preferences.user_id references users(id), test users are
 * inserted directly via pg before each case and cleaned up afterwards.
 * The chat_preferences table is created automatically by runMigrations() on
 * server startup, so no manual table-creation is needed here.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import jwt from 'jsonwebtoken';

const BASE = process.env.CHAT_TEST_BASE_URL || 'http://localhost:8000';
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@helium/heliumdb?sslmode=disable';

const pool = new pg.Pool({ connectionString: DB_URL });

const TEST_USER_IDS = [];

function uniqUserId(prefix) {
  return `test_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function uniqSession(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function createTestUser(userId) {
  await pool.query(
    `INSERT INTO users (id, role, roles, is_active, is_verified)
     VALUES ($1, 'parent', '["parent"]'::jsonb, true, false)
     ON CONFLICT (id) DO NOTHING`,
    [userId],
  );
  TEST_USER_IDS.push(userId);
}

async function setPref(userId, responseStyle) {
  const res = await fetch(`${BASE}/api/chat-preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-role': 'user',
    },
    body: JSON.stringify({ responseStyle }),
  });
  if (!res.ok) throw new Error(`PUT /api/chat-preferences HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function setLangPref(userId, preferredLanguage) {
  const res = await fetch(`${BASE}/api/chat-preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-role': 'user',
    },
    body: JSON.stringify({ preferredLanguage }),
  });
  if (!res.ok) throw new Error(`PUT /api/chat-preferences (lang) HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function setPausePref(userId, pausePref) {
  const res = await fetch(`${BASE}/api/chat-preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-role': 'user',
    },
    body: JSON.stringify({ pausePref }),
  });
  if (!res.ok) throw new Error(`PUT /api/chat-preferences (pause) HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Mint a signed JWT for a test user using the server's default dev secret.
 * This exercises the bearer-token verification path in optionalAuth/requireAuth.
 */
const JWT_SECRET = process.env.JWT_SECRET ?? 'metryx-dev-secret-change-in-production';
function mintToken(userId) {
  return jwt.sign({ userId, role: 'parent', roles: ['parent'] }, JWT_SECRET, { expiresIn: '1h' });
}

async function setPrefJwt(userId, responseStyle) {
  const token = mintToken(userId);
  const res = await fetch(`${BASE}/api/chat-preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ responseStyle }),
  });
  if (!res.ok) throw new Error(`PUT /api/chat-preferences (JWT) HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function postChat(message, sessionId, responseStyle, userId) {
  const headers = { 'Content-Type': 'application/json' };
  if (userId) {
    headers['x-user-id'] = userId;
    headers['x-user-role'] = 'user';
  }
  const res = await fetch(`${BASE}/api/chat/message`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, sessionId, responseStyle, context: { userRole: 'parent' } }),
  });
  if (!res.ok) throw new Error(`POST /api/chat/message HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function postChatJwt(message, sessionId, responseStyle, userId) {
  const token = mintToken(userId);
  const res = await fetch(`${BASE}/api/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ message, sessionId, responseStyle, context: { userRole: 'parent' } }),
  });
  if (!res.ok) throw new Error(`POST /api/chat/message (JWT) HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function postChatJwtWithLang(message, sessionId, preferredLanguage, userId) {
  const token = mintToken(userId);
  const res = await fetch(`${BASE}/api/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ message, sessionId, preferredLanguage, context: { userRole: 'parent' } }),
  });
  if (!res.ok) throw new Error(`POST /api/chat/message (JWT lang) HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

after(async () => {
  if (TEST_USER_IDS.length > 0) {
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [TEST_USER_IDS]);
  }
  await pool.end();
});

// Use a message known to reliably return a long multi-block standard response.
const TEST_MESSAGE = 'What is the LBI assessment?';

test('DB preference concise wins over client-sent standard for authenticated users', async () => {
  const userId = uniqUserId('db_concise');
  await createTestUser(userId);

  // Set DB preference to 'concise'
  await setPref(userId, 'concise');

  // Baseline: unauthenticated request with responseStyle='standard'
  const stdSession = uniqSession('std_baseline');
  const stdData = await postChat(TEST_MESSAGE, stdSession, 'standard', null);

  assert.ok(
    typeof stdData.response === 'string' && stdData.response.length > 0,
    `baseline standard response must be a non-empty string; got: ${JSON.stringify(stdData.response)}`,
  );

  // Auth request: DB=concise but client sends responseStyle='standard'
  // The DB preference must override → response should be shorter than standard baseline
  const authSession = uniqSession('auth_db_concise');
  const authData = await postChat(TEST_MESSAGE, authSession, 'standard', userId);

  assert.ok(
    typeof authData.response === 'string' && authData.response.length > 0,
    `authenticated (DB=concise) response must be a non-empty string; got: ${JSON.stringify(authData.response)}`,
  );

  const stdLen = stdData.response.length;
  const authLen = authData.response.length;

  assert.ok(
    authLen < stdLen,
    `DB preference 'concise' must override client 'standard': ` +
    `auth response (${authLen} chars) should be strictly shorter than standard baseline (${stdLen} chars)\n` +
    `standard: ${stdData.response.slice(0, 200)}\n` +
    `auth(DB=concise): ${authData.response.slice(0, 200)}`,
  );
});

test('DB preference standard wins over client-sent concise for authenticated users', async () => {
  const userId = uniqUserId('db_standard');
  await createTestUser(userId);

  // Set DB preference to 'standard'
  await setPref(userId, 'standard');

  // Baseline: unauthenticated request with responseStyle='concise'
  const cncSession = uniqSession('cnc_baseline');
  const cncData = await postChat(TEST_MESSAGE, cncSession, 'concise', null);

  assert.ok(
    typeof cncData.response === 'string' && cncData.response.length > 0,
    `baseline concise response must be a non-empty string; got: ${JSON.stringify(cncData.response)}`,
  );

  // Auth request: DB=standard but client sends responseStyle='concise'
  // The DB preference must override → response should be longer than concise baseline
  const authSession = uniqSession('auth_db_standard');
  const authData = await postChat(TEST_MESSAGE, authSession, 'concise', userId);

  assert.ok(
    typeof authData.response === 'string' && authData.response.length > 0,
    `authenticated (DB=standard) response must be a non-empty string; got: ${JSON.stringify(authData.response)}`,
  );

  const cncLen = cncData.response.length;
  const authLen = authData.response.length;

  assert.ok(
    authLen > cncLen,
    `DB preference 'standard' must override client 'concise': ` +
    `auth response (${authLen} chars) should be strictly longer than concise baseline (${cncLen} chars)\n` +
    `concise: ${cncData.response.slice(0, 200)}\n` +
    `auth(DB=standard): ${authData.response.slice(0, 200)}`,
  );
});

test('DB language preference is applied to chat responses for authenticated users', async () => {
  const userId = uniqUserId('db_lang_hindi');
  await createTestUser(userId);

  // Store preferredLanguage='hindi' in the DB via the preferences endpoint
  await setLangPref(userId, 'hindi');

  // Send a chat message WITHOUT specifying preferredLanguage in the body
  // The route must load it from the DB and apply it to the session
  const sessionId = uniqSession('lang_hindi_auth');
  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    'x-user-role': 'user',
  };
  const res = await fetch(`${BASE}/api/chat/message`, {
    method: 'POST',
    headers,
    // Deliberately omit preferredLanguage — only DB preference should apply
    body: JSON.stringify({ message: TEST_MESSAGE, sessionId, context: { userRole: 'parent' } }),
  });
  if (!res.ok) throw new Error(`POST /api/chat/message HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );

  // The route returns preferredLanguage in the JSON; it must reflect the DB value
  assert.strictEqual(
    data.preferredLanguage,
    'hindi',
    `DB-stored language 'hindi' must be reflected in the response; ` +
    `got preferredLanguage=${JSON.stringify(data.preferredLanguage)}`,
  );

  // languageInstruction must be non-null because the language is not 'english'
  assert.ok(
    typeof data.languageInstruction === 'string' && data.languageInstruction.length > 0,
    `languageInstruction must be a non-empty string when language is hindi; ` +
    `got: ${JSON.stringify(data.languageInstruction)}`,
  );
});

test('DB language preference is not overridden by omitting preferredLanguage in body (unauthenticated defaults to english)', async () => {
  // Unauthenticated request without body preferredLanguage → session stays at 'english'
  const sessionId = uniqSession('lang_unauth_default');
  const res = await fetch(`${BASE}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: TEST_MESSAGE, sessionId, context: { userRole: 'parent' } }),
  });
  if (!res.ok) throw new Error(`POST /api/chat/message HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();

  assert.strictEqual(
    data.preferredLanguage,
    'english',
    `unauthenticated request with no preferredLanguage must default to 'english'; ` +
    `got: ${JSON.stringify(data.preferredLanguage)}`,
  );

  assert.strictEqual(
    data.languageInstruction,
    null,
    `languageInstruction must be null for english; got: ${JSON.stringify(data.languageInstruction)}`,
  );
});

test('DB pause preference is saved and returned correctly via GET', async () => {
  const userId = uniqUserId('db_pause');
  await createTestUser(userId);

  // Default should be 'none'
  const getRes1 = await fetch(`${BASE}/api/chat-preferences`, {
    headers: { 'x-user-id': userId, 'x-user-role': 'user' },
  });
  if (!getRes1.ok) throw new Error(`GET /api/chat-preferences HTTP ${getRes1.status}`);
  const prefs1 = await getRes1.json();
  assert.strictEqual(
    prefs1.pausePref,
    'none',
    `initial pausePref must be 'none'; got: ${JSON.stringify(prefs1.pausePref)}`,
  );

  // Set pausePref to 'always'
  await setPausePref(userId, 'always');

  // Confirm the stored value is returned correctly
  const getRes2 = await fetch(`${BASE}/api/chat-preferences`, {
    headers: { 'x-user-id': userId, 'x-user-role': 'user' },
  });
  if (!getRes2.ok) throw new Error(`GET /api/chat-preferences HTTP ${getRes2.status}`);
  const prefs2 = await getRes2.json();
  assert.strictEqual(
    prefs2.pausePref,
    'always',
    `pausePref must be 'always' after setting it; got: ${JSON.stringify(prefs2.pausePref)}`,
  );

  // Set pausePref back to 'none' and confirm
  await setPausePref(userId, 'none');
  const getRes3 = await fetch(`${BASE}/api/chat-preferences`, {
    headers: { 'x-user-id': userId, 'x-user-role': 'user' },
  });
  if (!getRes3.ok) throw new Error(`GET /api/chat-preferences HTTP ${getRes3.status}`);
  const prefs3 = await getRes3.json();
  assert.strictEqual(
    prefs3.pausePref,
    'none',
    `pausePref must revert to 'none' after update; got: ${JSON.stringify(prefs3.pausePref)}`,
  );
});

test("pausePref 'session' is accepted by PUT and returned correctly by GET", async () => {
  const userId = uniqUserId('db_pause_session');
  await createTestUser(userId);

  const headers = { 'Content-Type': 'application/json', 'x-user-id': userId, 'x-user-role': 'user' };
  const getHeaders = { 'x-user-id': userId, 'x-user-role': 'user' };

  // Default should be 'none'
  const defaultRes = await fetch(`${BASE}/api/chat-preferences`, { headers: getHeaders });
  assert.ok(defaultRes.ok, `GET default HTTP ${defaultRes.status}`);
  const defaultPrefs = await defaultRes.json();
  assert.strictEqual(
    defaultPrefs.pausePref,
    'none',
    `initial pausePref must be 'none'; got: ${JSON.stringify(defaultPrefs.pausePref)}`,
  );

  // PUT with pausePref='session' must succeed (HTTP 200)
  const putRes = await fetch(`${BASE}/api/chat-preferences`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ pausePref: 'session' }),
  });
  assert.ok(
    putRes.ok,
    `PUT pausePref='session' should succeed; got HTTP ${putRes.status}: ${await putRes.text()}`,
  );

  // GET must return 'session'
  const getRes = await fetch(`${BASE}/api/chat-preferences`, { headers: getHeaders });
  assert.ok(getRes.ok, `GET after setting 'session' HTTP ${getRes.status}`);
  const prefs = await getRes.json();
  assert.strictEqual(
    prefs.pausePref,
    'session',
    `pausePref must be 'session' after PUT; got: ${JSON.stringify(prefs.pausePref)}`,
  );

  // Switching back to 'none' still works
  const resetRes = await fetch(`${BASE}/api/chat-preferences`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ pausePref: 'none' }),
  });
  assert.ok(resetRes.ok, `PUT pausePref='none' (reset) HTTP ${resetRes.status}`);
  const finalRes = await fetch(`${BASE}/api/chat-preferences`, { headers: getHeaders });
  const finalPrefs = await finalRes.json();
  assert.strictEqual(
    finalPrefs.pausePref,
    'none',
    `pausePref must revert to 'none' after reset; got: ${JSON.stringify(finalPrefs.pausePref)}`,
  );
});

test('DB language preference wins over client-sent preferredLanguage for authenticated users', async () => {
  const userId = uniqUserId('db_lang_override');
  await createTestUser(userId);

  // Store preferredLanguage='hindi' in the DB
  await setLangPref(userId, 'hindi');

  // Send a chat message explicitly supplying preferredLanguage='english' in the body
  // The DB preference must override the client-sent value → response must report 'hindi'
  const sessionId = uniqSession('lang_override_auth');
  const res = await fetch(`${BASE}/api/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-role': 'user',
    },
    body: JSON.stringify({
      message: TEST_MESSAGE,
      sessionId,
      preferredLanguage: 'english',
      context: { userRole: 'parent' },
    }),
  });
  if (!res.ok) throw new Error(`POST /api/chat/message HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );

  assert.strictEqual(
    data.preferredLanguage,
    'hindi',
    `DB-stored language 'hindi' must override client-sent 'english'; ` +
    `got preferredLanguage=${JSON.stringify(data.preferredLanguage)}`,
  );

  assert.ok(
    typeof data.languageInstruction === 'string' && data.languageInstruction.length > 0,
    `languageInstruction must be a non-empty string when DB language is hindi; ` +
    `got: ${JSON.stringify(data.languageInstruction)}`,
  );
});

test('GET /api/chat-preferences round-trips all three fields and partial PUT leaves others unchanged', async () => {
  const userId = uniqUserId('roundtrip_all');
  await createTestUser(userId);

  const headers = { 'Content-Type': 'application/json', 'x-user-id': userId, 'x-user-role': 'user' };
  const getHeaders = { 'x-user-id': userId, 'x-user-role': 'user' };

  // Step 1: Set all three fields in a single PUT
  const putRes = await fetch(`${BASE}/api/chat-preferences`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      responseStyle: 'concise',
      preferredLanguage: 'hindi',
      pausePref: 'always',
    }),
  });
  assert.ok(putRes.ok, `PUT all three fields HTTP ${putRes.status}: ${await putRes.text()}`);

  // Step 2: GET and confirm all three camelCase keys have the expected values
  const getRes1 = await fetch(`${BASE}/api/chat-preferences`, { headers: getHeaders });
  assert.ok(getRes1.ok, `GET after full PUT HTTP ${getRes1.status}`);
  const prefs1 = await getRes1.json();

  assert.strictEqual(
    prefs1.responseStyle,
    'concise',
    `responseStyle must be 'concise'; got: ${JSON.stringify(prefs1.responseStyle)}`,
  );
  assert.strictEqual(
    prefs1.preferredLanguage,
    'hindi',
    `preferredLanguage must be 'hindi'; got: ${JSON.stringify(prefs1.preferredLanguage)}`,
  );
  assert.strictEqual(
    prefs1.pausePref,
    'always',
    `pausePref must be 'always'; got: ${JSON.stringify(prefs1.pausePref)}`,
  );

  // Step 3: Partial PUT — update only responseStyle
  const partialPutRes = await fetch(`${BASE}/api/chat-preferences`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ responseStyle: 'standard' }),
  });
  assert.ok(partialPutRes.ok, `partial PUT HTTP ${partialPutRes.status}: ${await partialPutRes.text()}`);

  // Step 4: GET again — responseStyle must be updated; the other two must be unchanged
  const getRes2 = await fetch(`${BASE}/api/chat-preferences`, { headers: getHeaders });
  assert.ok(getRes2.ok, `GET after partial PUT HTTP ${getRes2.status}`);
  const prefs2 = await getRes2.json();

  assert.strictEqual(
    prefs2.responseStyle,
    'standard',
    `responseStyle must be updated to 'standard'; got: ${JSON.stringify(prefs2.responseStyle)}`,
  );
  assert.strictEqual(
    prefs2.preferredLanguage,
    'hindi',
    `preferredLanguage must still be 'hindi' after partial PUT; got: ${JSON.stringify(prefs2.preferredLanguage)}`,
  );
  assert.strictEqual(
    prefs2.pausePref,
    'always',
    `pausePref must still be 'always' after partial PUT; got: ${JSON.stringify(prefs2.pausePref)}`,
  );
});

test('DB language preference wins over client-sent preferredLanguage when auth is via JWT bearer token', async () => {
  const userId = uniqUserId('jwt_lang_override');
  await createTestUser(userId);

  // Store preferredLanguage='hindi' in the DB
  await setLangPref(userId, 'hindi');

  // Send a chat message with preferredLanguage='english' in the body but authenticated via Bearer token
  // The DB preference must override the client-sent value → response must report 'hindi'
  const sessionId = uniqSession('jwt_lang_override');
  const data = await postChatJwtWithLang(TEST_MESSAGE, sessionId, 'english', userId);

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `JWT lang override: response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );

  assert.strictEqual(
    data.preferredLanguage,
    'hindi',
    `JWT bearer token: DB-stored language 'hindi' must override client-sent 'english'; ` +
    `got preferredLanguage=${JSON.stringify(data.preferredLanguage)}`,
  );

  assert.ok(
    typeof data.languageInstruction === 'string' && data.languageInstruction.length > 0,
    `JWT bearer token: languageInstruction must be a non-empty string when DB language is hindi; ` +
    `got: ${JSON.stringify(data.languageInstruction)}`,
  );
});

test('PUT /api/chat-preferences rejects invalid pausePref enum value with HTTP 400', async () => {
  const userId = uniqUserId('invalid_pause');
  await createTestUser(userId);

  const res = await fetch(`${BASE}/api/chat-preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-role': 'user',
    },
    body: JSON.stringify({ pausePref: 'weekly' }),
  });

  assert.strictEqual(
    res.status,
    400,
    `PUT with invalid pausePref='weekly' must return HTTP 400; got HTTP ${res.status}`,
  );
});

test('PUT /api/chat-preferences rejects invalid responseStyle enum value with HTTP 400', async () => {
  const userId = uniqUserId('invalid_style');
  await createTestUser(userId);

  const res = await fetch(`${BASE}/api/chat-preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-role': 'user',
    },
    body: JSON.stringify({ responseStyle: 'verbose' }),
  });

  assert.strictEqual(
    res.status,
    400,
    `PUT with invalid responseStyle='verbose' must return HTTP 400; got HTTP ${res.status}`,
  );
});

test('PUT /api/chat-preferences rejects invalid preferredLanguage enum value with HTTP 400', async () => {
  const userId = uniqUserId('invalid_lang');
  await createTestUser(userId);

  const res = await fetch(`${BASE}/api/chat-preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-role': 'user',
    },
    body: JSON.stringify({ preferredLanguage: 'klingon' }),
  });

  assert.strictEqual(
    res.status,
    400,
    `PUT with invalid preferredLanguage='klingon' must return HTTP 400; got HTTP ${res.status}`,
  );
});

test('PUT /api/chat-preferences rejects body with no recognised preference field with HTTP 400', async () => {
  const userId = uniqUserId('no_fields');
  await createTestUser(userId);

  const res = await fetch(`${BASE}/api/chat-preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-role': 'user',
    },
    body: JSON.stringify({ unknownField: 'value' }),
  });

  assert.strictEqual(
    res.status,
    400,
    `PUT with no recognised preference fields must return HTTP 400; got HTTP ${res.status}`,
  );
});

test('DB preference concise wins over client-sent standard when auth is via JWT bearer token', async () => {
  const userId = uniqUserId('jwt_concise');
  await createTestUser(userId);

  // Set DB preference to 'concise' using a JWT bearer token (exercises requireAuth JWT path)
  await setPrefJwt(userId, 'concise');

  // Baseline: unauthenticated request with responseStyle='standard'
  const stdSession = uniqSession('jwt_std_baseline');
  const stdData = await postChat(TEST_MESSAGE, stdSession, 'standard', null);

  assert.ok(
    typeof stdData.response === 'string' && stdData.response.length > 0,
    `JWT test: baseline standard response must be a non-empty string; got: ${JSON.stringify(stdData.response)}`,
  );

  // JWT-authenticated request: DB=concise but client sends responseStyle='standard'
  // Bearer-token path in optionalAuth must resolve the user and DB preference must win
  const jwtSession = uniqSession('jwt_auth_concise');
  const jwtData = await postChatJwt(TEST_MESSAGE, jwtSession, 'standard', userId);

  assert.ok(
    typeof jwtData.response === 'string' && jwtData.response.length > 0,
    `JWT test: authenticated (DB=concise, bearer token) response must be non-empty; got: ${JSON.stringify(jwtData.response)}`,
  );

  const stdLen = stdData.response.length;
  const jwtLen = jwtData.response.length;

  assert.ok(
    jwtLen < stdLen,
    `JWT bearer token: DB preference 'concise' must override client 'standard': ` +
    `JWT auth response (${jwtLen} chars) should be strictly shorter than standard baseline (${stdLen} chars)\n` +
    `standard: ${stdData.response.slice(0, 200)}\n` +
    `JWT auth(DB=concise): ${jwtData.response.slice(0, 200)}`,
  );
});
