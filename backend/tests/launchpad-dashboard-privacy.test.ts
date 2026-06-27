/**
 * Launchpad Dashboard + Career Discovery — Privacy / Flag-Gate / Self-Only
 * Regression Test
 * ----------------------------------------------------------------------------
 * Two flag-gated student-facing read surfaces resolve their subject from the
 * authenticated SESSION principal only — never a client-supplied id — so there
 * is no IDOR surface:
 *
 *   • MX-302C  `/api/launchpad-dashboard/*`  (`launchpadDashboard` /
 *              FF_LAUNCHPAD_DASHBOARD, default OFF) — reads a seeker's OWN
 *              placement-readiness profile.
 *   • MX-302B  `/api/career-discovery/*`     (`careerDiscovery` /
 *              FF_CAREER_DISCOVERY, default OFF) — composes a seeker's OWN
 *              discovery profile + AI guidance.
 *
 * This test locks in the privacy guarantees so a future server refactor (e.g.
 * one that "refactors the dashboard reads to take an id") cannot silently open
 * the surface or introduce an IDOR that the frontend regression alone (task
 * #266) would not catch:
 *
 *   (a) flag OFF  → data routes 503 BEFORE any auth/DB touch (byte-identical
 *                   legacy: requireAuth never runs, pool never queried), and
 *                   /enabled → 200 {enabled:false}
 *   (b) flag ON   → /enabled → 200 {enabled:true}; the data routes fall through
 *                   the gate to requireAuth (401 without a session)
 *   (c) flag ON   → the read resolves the subject from the SESSION principal
 *                   ONLY — a client-supplied id/user_id/subject in the query or
 *                   body is NEVER honored. The DB layer is keyed by the SESSION
 *                   uid, and an attacker's id NEVER reaches a query param — so
 *                   an authenticated student A cannot retrieve student B's
 *                   readiness (/summary) or AI guidance (/guidance) by passing
 *                   B's id. This is asserted for BOTH surfaces.
 *   (d) flag ON   → the SAME self-only guarantee is locked across the OTHER
 *                   Career Discovery composing reads (`/status`, `/battery`,
 *                   `/profile`, `/explorer`, `/explorer/market`,
 *                   `/explorer/role/:roleId`). Task #268 covered `/guidance`;
 *                   these reads also expose a seeker's private discovery status,
 *                   compatibility score and role matches, so each is asserted to
 *                   scope every composed DB read to the SESSION uid and to keep
 *                   an attacker's id out of every query param.
 *
 * It mounts the REAL `registerLaunchpadDashboardRoutes` +
 * `registerCareerDiscoveryRoutes` onto a throwaway Express server (listen(0))
 * with a stub requireAuth and a stub pool that record whether they were touched
 * and with what params — so the assertions exercise the actual production gate +
 * handler code (and, for guidance, the real composing engines), headlessly,
 * without a real database. The flags are read from process.env at request time
 * (`envOverride`), so a single server can be driven through OFF and ON states
 * deterministically.
 *
 * Run with:  npx tsx backend/tests/launchpad-dashboard-privacy.test.ts
 */
import http, { type Server } from 'node:http';
import assert from 'node:assert/strict';
import express, { type Request, type Response } from 'express';
import { registerLaunchpadDashboardRoutes } from '../routes/launchpad-dashboard';
import { registerCareerDiscoveryRoutes } from '../routes/career-discovery';

// Force the AI coach down its DETERMINISTIC rule-based path so the guidance
// composition never attempts a network call (no LLM key/base URL in the test).
delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_BASE_URL;
delete process.env.EMERGENT_LLM_KEY;

const FF = 'FF_LAUNCHPAD_DASHBOARD';
const FF_CD = 'FF_CAREER_DISCOVERY';
const SESSION_UID = 'session-self-001';
const ATTACKER_UID = 'victim-other-999';

// ── Tiny assert harness (mirrors the repo's other headless tests). ───────────
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS — ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`FAIL — ${name}\n       ${String(e?.message ?? e)}`);
  }
}

// ── Instrumentation: did the auth layer / DB get touched, and with what id? ───
const probe = {
  authCalls: 0,
  dbQueries: [] as Array<{ sql: string; params: any[] }>,
  reset() {
    this.authCalls = 0;
    this.dbQueries = [];
  },
};

// Stub requireAuth mirroring production semantics: reject (401) without a
// session, otherwise pin req.user to the SESSION principal and continue. It
// increments a counter so we can prove the flag gate runs BEFORE auth when OFF.
const requireAuth = (req: Request, res: Response, next: () => void) => {
  probe.authCalls++;
  if (req.headers['x-test-auth'] === '1') {
    (req as any).user = { id: SESSION_UID };
    return next();
  }
  return res.status(401).json({ ok: false, message: 'Unauthorized' });
};

// Stub pg Pool: records every query (so we can assert "DB untouched when OFF"
// and "the data read used the SESSION uid, not a client id"). Returns a present
// table + a populated profile so the summary handler reaches its full read path.
const pool = {
  query: async (sql: string, params?: any[]) => {
    probe.dbQueries.push({ sql, params: params ?? [] });
    // competencyRuntimeReady() probe: count how many of the supplied relations
    // exist. Report ALL present so the composed career-match engine proceeds to
    // its subject-keyed signal composition (instead of short-circuiting) — this
    // lets the explorer reads exercise their real self-scoped DB path.
    if (/unnest\(\$1::text\[\]\)/i.test(sql) && /to_regclass/i.test(sql)) {
      const arr = Array.isArray(params?.[0]) ? params![0] : [];
      return { rows: [{ n: arr.length }] };
    }
    if (/to_regclass/i.test(sql)) {
      // Both shapes used in the codebase: `... AS t` (launchpad) and
      // `to_regclass($1) AS reg` (career-discovery tableExists).
      return { rows: [{ t: 'public.career_seeker_profiles', reg: params?.[0] ?? 'public.career_seeker_profiles' }] };
    }
    if (/career_seeker_profiles\s+WHERE\s+user_id/i.test(sql)) {
      return {
        rows: [
          {
            data: {
              education: [{ degree: 'BSc' }],
              skills: { technical: ['ts', 'sql'] },
              targetRole: 'Engineer',
            },
          },
        ],
      };
    }
    return { rows: [] };
  },
} as any;

function buildServer(): Promise<{ server: Server; base: string }> {
  const app = express();
  app.use(express.json());
  registerLaunchpadDashboardRoutes(app, pool, requireAuth);
  registerCareerDiscoveryRoutes(app, pool, requireAuth);
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

type Resp = { status: number; json: any };
async function call(
  base: string,
  method: string,
  path: string,
  opts: { auth?: boolean; body?: any } = {},
): Promise<Resp> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.auth) headers['x-test-auth'] = '1';
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: ['GET', 'HEAD'].includes(method) ? undefined : JSON.stringify(opts.body ?? {}),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function main() {
  const { server, base } = await buildServer();

  console.log('\nLaunchpad Dashboard privacy / flag-gate / self-only');

  // ── (a) Flag OFF: data routes 503 BEFORE auth/DB; /enabled honest false. ──
  delete process.env[FF];
  process.env[FF] = 'false';

  probe.reset();
  const offSummary = await call(base, 'GET', '/api/launchpad-dashboard/summary', { auth: true });
  test('flag OFF → GET /summary returns 503', () => {
    assert.equal(offSummary.status, 503);
    assert.equal(offSummary.json?.enabled, false);
  });
  test('flag OFF → /summary 503 fires BEFORE auth (requireAuth not reached)', () => {
    assert.equal(probe.authCalls, 0, 'requireAuth ran before the flag gate');
  });
  test('flag OFF → /summary 503 fires BEFORE any DB touch (pool not queried)', () => {
    assert.equal(probe.dbQueries.length, 0, 'the DB was queried while the flag was OFF');
  });

  probe.reset();
  const offTelemetry = await call(base, 'POST', '/api/launchpad-dashboard/telemetry', { auth: true, body: {} });
  test('flag OFF → POST /telemetry returns 503', () => {
    assert.equal(offTelemetry.status, 503);
    assert.equal(offTelemetry.json?.enabled, false);
  });
  test('flag OFF → /telemetry 503 fires BEFORE auth (requireAuth not reached)', () => {
    assert.equal(probe.authCalls, 0, 'requireAuth ran before the flag gate');
  });

  const offEnabled = await call(base, 'GET', '/api/launchpad-dashboard/enabled');
  test('flag OFF → GET /enabled returns 200 {enabled:false}', () => {
    assert.equal(offEnabled.status, 200);
    assert.equal(offEnabled.json?.ok, true);
    assert.equal(offEnabled.json?.enabled, false);
  });

  // ── (b) Flag ON: probe true; data routes pass the gate to requireAuth. ──
  process.env[FF] = 'true';

  const onEnabled = await call(base, 'GET', '/api/launchpad-dashboard/enabled');
  test('flag ON → GET /enabled returns 200 {enabled:true}', () => {
    assert.equal(onEnabled.status, 200);
    assert.equal(onEnabled.json?.enabled, true);
  });

  probe.reset();
  const onNoAuth = await call(base, 'GET', '/api/launchpad-dashboard/summary');
  test('flag ON → GET /summary without a session returns 401 (gate fell through to auth)', () => {
    assert.equal(onNoAuth.status, 401);
    assert.ok(probe.authCalls >= 1, 'requireAuth should run once the flag is ON');
  });

  // ── (c) Flag ON: subject resolved from the SESSION only — no client id. ──
  probe.reset();
  const idor = await call(
    base,
    'GET',
    `/api/launchpad-dashboard/summary?id=${ATTACKER_UID}&user_id=${ATTACKER_UID}&subject=${ATTACKER_UID}`,
    { auth: true, body: { id: ATTACKER_UID, user_id: ATTACKER_UID, subject: ATTACKER_UID } },
  );
  test('flag ON → /summary 200 for an authenticated seeker', () => {
    assert.equal(idor.status, 200);
    assert.equal(idor.json?.ok, true);
  });
  test('flag ON → /summary subject is the SESSION principal, NOT the client-supplied id', () => {
    assert.equal(idor.json?.subject, SESSION_UID, `subject leaked: got ${idor.json?.subject}`);
    assert.notEqual(idor.json?.subject, ATTACKER_UID);
  });
  test('flag ON → the profile read was keyed by the SESSION uid (no IDOR at the DB layer)', () => {
    const read = probe.dbQueries.find((q) => /career_seeker_profiles\s+WHERE\s+user_id/i.test(q.sql));
    assert.ok(read, 'expected a profile read query');
    assert.equal(read!.params[0], SESSION_UID, `DB read used a client-supplied id: ${read!.params[0]}`);
    assert.ok(
      !probe.dbQueries.some((q) => (q.params ?? []).includes(ATTACKER_UID)),
      'a client-supplied id reached the DB layer',
    );
  });

  // ── Tracker (WRITE surface): the higher-impact IDOR. PUT /tracker persists
  //    campus-drive / project / checklist data into
  //    `career_seeker_profiles.data.fresherHub`. Lock in that BOTH the read AND
  //    the UPDATE key on the SESSION principal — a client-supplied id in the
  //    query OR body must NEVER reach the WHERE clause, so student A cannot
  //    overwrite student B's profile data. ──

  // (a) Flag OFF: the WRITE surface 503s BEFORE any auth/DB touch (byte-identical).
  process.env[FF] = 'false';
  probe.reset();
  const trackerOffPut = await call(base, 'PUT', '/api/launchpad-dashboard/tracker', {
    auth: true,
    body: { drives: [{ company: 'Acme' }] },
  });
  test('flag OFF → PUT /tracker returns 503', () => {
    assert.equal(trackerOffPut.status, 503);
    assert.equal(trackerOffPut.json?.enabled, false);
  });
  test('flag OFF → PUT /tracker 503 fires BEFORE auth (requireAuth not reached)', () => {
    assert.equal(probe.authCalls, 0, 'requireAuth ran before the flag gate');
  });
  test('flag OFF → PUT /tracker 503 fires BEFORE any DB touch (pool not queried)', () => {
    assert.equal(probe.dbQueries.length, 0, 'the DB was queried while the flag was OFF');
  });

  // (b) Flag ON again for the IDOR assertions.
  process.env[FF] = 'true';

  // GET /tracker — read keyed by the SESSION uid; attacker id never reaches DB.
  probe.reset();
  const trackerGet = await call(
    base,
    'GET',
    `/api/launchpad-dashboard/tracker?id=${ATTACKER_UID}&user_id=${ATTACKER_UID}&subject=${ATTACKER_UID}`,
    { auth: true },
  );
  test('flag ON → GET /tracker 200 for an authenticated seeker', () => {
    assert.equal(trackerGet.status, 200);
    assert.equal(trackerGet.json?.ok, true);
  });
  test('flag ON → GET /tracker subject is the SESSION principal, NOT the client-supplied id', () => {
    assert.equal(trackerGet.json?.subject, SESSION_UID, `subject leaked: got ${trackerGet.json?.subject}`);
    assert.notEqual(trackerGet.json?.subject, ATTACKER_UID);
  });
  test('flag ON → GET /tracker read was keyed by the SESSION uid (no IDOR at the DB layer)', () => {
    const read = probe.dbQueries.find((q) => /career_seeker_profiles\s+WHERE\s+user_id/i.test(q.sql));
    assert.ok(read, 'expected a profile read query');
    assert.equal(read!.params[0], SESSION_UID, `DB read used a client-supplied id: ${read!.params[0]}`);
    assert.ok(
      !probe.dbQueries.some((q) => (q.params ?? []).some((p) => String(p) === ATTACKER_UID)),
      "a client-supplied id reached the DB layer on the tracker read",
    );
  });

  // PUT /tracker — the WRITE. Both the SELECT and the UPDATE must key on the
  // SESSION uid; the attacker's id (query OR body) must NEVER appear in any
  // query param, so the UPDATE's WHERE can only ever target the session row.
  probe.reset();
  const trackerPut = await call(
    base,
    'PUT',
    `/api/launchpad-dashboard/tracker?id=${ATTACKER_UID}&user_id=${ATTACKER_UID}&subject=${ATTACKER_UID}`,
    {
      auth: true,
      body: {
        // A real slice so the handler reaches its UPDATE (not the 400 no-op),
        // alongside attacker ids the handler must ignore for subject resolution.
        drives: [{ company: 'Acme', stage: 'applied' }],
        id: ATTACKER_UID,
        user_id: ATTACKER_UID,
        subject: ATTACKER_UID,
      },
    },
  );
  test('flag ON → PUT /tracker 200 for an authenticated seeker', () => {
    assert.equal(trackerPut.status, 200);
    assert.equal(trackerPut.json?.ok, true);
  });
  test('flag ON → PUT /tracker subject is the SESSION principal, NOT the client-supplied id', () => {
    assert.equal(trackerPut.json?.subject, SESSION_UID, `subject leaked: got ${trackerPut.json?.subject}`);
    assert.notEqual(trackerPut.json?.subject, ATTACKER_UID);
  });
  test('flag ON → PUT /tracker SELECT was keyed by the SESSION uid', () => {
    const read = probe.dbQueries.find((q) => /SELECT\s+data\s+FROM\s+career_seeker_profiles\s+WHERE\s+user_id/i.test(q.sql));
    assert.ok(read, 'expected a pre-update profile read query');
    assert.equal(read!.params[0], SESSION_UID, `pre-update read used a client-supplied id: ${read!.params[0]}`);
  });
  test("flag ON → PUT /tracker UPDATE's WHERE keys on the SESSION uid (cannot target student B's row)", () => {
    const update = probe.dbQueries.find((q) => /UPDATE\s+career_seeker_profiles\s+SET/i.test(q.sql));
    assert.ok(update, 'expected an UPDATE query');
    // The UPDATE is `... WHERE user_id = $2` with params [json, uid].
    assert.equal(update!.params[1], SESSION_UID, `UPDATE WHERE used a client-supplied id: ${update!.params[1]}`);
    assert.notEqual(update!.params[1], ATTACKER_UID);
  });
  test("flag ON → PUT /tracker: an attacker's id NEVER reaches ANY DB query param (no write IDOR A→B)", () => {
    assert.ok(probe.dbQueries.length > 0, 'expected the tracker write to query the DB');
    const leaked = probe.dbQueries.filter((q) => (q.params ?? []).some((p) => String(p).includes(ATTACKER_UID)));
    assert.equal(
      leaked.length,
      0,
      `a client-supplied id reached the DB layer in ${leaked.length} quer${leaked.length === 1 ? 'y' : 'ies'}: ` +
        leaked.map((q) => q.sql.replace(/\s+/g, ' ').trim().slice(0, 80)).join(' | '),
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Career Discovery (MX-302B) — same self-only guarantee on /guidance.
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\nCareer Discovery privacy / flag-gate / self-only');

  // ── (a) Flag OFF: /guidance 503 BEFORE auth/DB; /enabled honest false. ──
  delete process.env[FF_CD];
  process.env[FF_CD] = 'false';

  probe.reset();
  const cdOff = await call(base, 'GET', '/api/career-discovery/guidance', { auth: true });
  test('CD flag OFF → GET /guidance returns 503', () => {
    assert.equal(cdOff.status, 503);
    assert.equal(cdOff.json?.enabled, false);
  });
  test('CD flag OFF → /guidance 503 fires BEFORE auth (requireAuth not reached)', () => {
    assert.equal(probe.authCalls, 0, 'requireAuth ran before the flag gate');
  });
  test('CD flag OFF → /guidance 503 fires BEFORE any DB touch (pool not queried)', () => {
    assert.equal(probe.dbQueries.length, 0, 'the DB was queried while the flag was OFF');
  });

  const cdOffEnabled = await call(base, 'GET', '/api/career-discovery/enabled');
  test('CD flag OFF → GET /enabled returns 200 {enabled:false}', () => {
    assert.equal(cdOffEnabled.status, 200);
    assert.equal(cdOffEnabled.json?.ok, true);
    assert.equal(cdOffEnabled.json?.enabled, false);
  });

  // ── (b) Flag ON: probe true; /guidance passes the gate to requireAuth. ──
  process.env[FF_CD] = 'true';

  const cdOnEnabled = await call(base, 'GET', '/api/career-discovery/enabled');
  test('CD flag ON → GET /enabled returns 200 {enabled:true}', () => {
    assert.equal(cdOnEnabled.status, 200);
    assert.equal(cdOnEnabled.json?.enabled, true);
  });

  probe.reset();
  const cdNoAuth = await call(base, 'GET', '/api/career-discovery/guidance');
  test('CD flag ON → GET /guidance without a session returns 401 (gate fell through to auth)', () => {
    assert.equal(cdNoAuth.status, 401);
    assert.ok(probe.authCalls >= 1, 'requireAuth should run once the flag is ON');
  });

  // ── (c) Flag ON: subject resolved from the SESSION only — no client id. The
  //    guidance envelope has no client-facing `subject` field, so the IDOR
  //    guarantee is proven at the DB layer: every composed read is keyed by the
  //    SESSION uid and the attacker's id NEVER reaches a query param. ──
  probe.reset();
  const cdIdor = await call(
    base,
    'GET',
    `/api/career-discovery/guidance?id=${ATTACKER_UID}&user_id=${ATTACKER_UID}&subject=${ATTACKER_UID}`,
    { auth: true, body: { id: ATTACKER_UID, user_id: ATTACKER_UID, subject: ATTACKER_UID } },
  );
  test('CD flag ON → /guidance 200 for an authenticated seeker', () => {
    assert.equal(cdIdor.status, 200);
    assert.equal(cdIdor.json?.ok, true);
  });
  test('CD flag ON → /guidance composed reads are keyed by the SESSION uid (the profile substrate was read for self)', () => {
    const read = probe.dbQueries.find((q) => /career_seeker_profiles\s+WHERE\s+user_id/i.test(q.sql));
    assert.ok(read, 'expected a profile read query during guidance composition');
    assert.equal(read!.params[0], SESSION_UID, `DB read used a client-supplied id: ${read!.params[0]}`);
  });
  test("CD flag ON → an attacker's id NEVER reaches any DB query param (no IDOR student A→B)", () => {
    assert.ok(probe.dbQueries.length > 0, 'expected the guidance composition to query the DB');
    const leaked = probe.dbQueries.filter((q) => (q.params ?? []).some((p) => String(p) === ATTACKER_UID));
    assert.equal(
      leaked.length,
      0,
      `a client-supplied id reached the DB layer in ${leaked.length} quer${leaked.length === 1 ? 'y' : 'ies'}: ` +
        leaked.map((q) => q.sql.replace(/\s+/g, ' ').trim().slice(0, 80)).join(' | '),
    );
  });

  // ── (d) Flag ON: the OTHER self-only Career Discovery reads are scoped the
  //    SAME way. Task #268 locked `/guidance`; this composes a seeker's private
  //    data through several MORE self-only reads (`/status`, `/battery`,
  //    `/profile`, `/explorer`, `/explorer/market`, `/explorer/role/:roleId`).
  //    Each resolves its subject from `selfId(req)` (the SESSION principal) — so
  //    a future refactor that added an id parameter to any of them would leak one
  //    student's discovery status / compatibility score / role matches to
  //    another. Each route is hit with an attacker's id planted in EVERY
  //    client-controllable channel (?id / ?user_id / ?subject in the query string
  //    AND the JSON body). The guarantee is proven at the DB layer: every
  //    composed read is keyed by the SESSION uid and the attacker's id NEVER
  //    reaches a query param, so student A can never pull student B's data. ──
  const ATTACK_QS = `id=${ATTACKER_UID}&user_id=${ATTACKER_UID}&subject=${ATTACKER_UID}`;
  const selfOnlyReads: Array<{ name: string; path: string }> = [
    { name: '/status', path: `/api/career-discovery/status?${ATTACK_QS}` },
    { name: '/battery', path: `/api/career-discovery/battery?${ATTACK_QS}` },
    { name: '/profile', path: `/api/career-discovery/profile?${ATTACK_QS}` },
    { name: '/explorer', path: `/api/career-discovery/explorer?${ATTACK_QS}` },
    { name: '/explorer/market', path: `/api/career-discovery/explorer/market?${ATTACK_QS}` },
    { name: '/explorer/role/:roleId', path: `/api/career-discovery/explorer/role/42?${ATTACK_QS}` },
  ];

  for (const route of selfOnlyReads) {
    probe.reset();
    const r = await call(base, 'GET', route.path, {
      auth: true,
      body: { id: ATTACKER_UID, user_id: ATTACKER_UID, subject: ATTACKER_UID },
    });
    test(`CD flag ON → GET ${route.name} 200 for an authenticated seeker`, () => {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.json?.ok, true);
    });
    test(`CD flag ON → ${route.name} composed reads ran keyed by the SESSION uid`, () => {
      assert.ok(probe.dbQueries.length > 0, 'expected the read to query the DB');
      assert.ok(
        probe.dbQueries.some((q) => (q.params ?? []).some((p) => String(p) === SESSION_UID)),
        'no composed DB read was keyed by the SESSION uid',
      );
    });
    test(`CD flag ON → ${route.name} attacker id NEVER reaches any DB query param (no IDOR A→B)`, () => {
      const leaked = probe.dbQueries.filter((q) => (q.params ?? []).some((p) => String(p) === ATTACKER_UID));
      assert.equal(
        leaked.length,
        0,
        `a client-supplied id reached the DB layer in ${leaked.length} quer${leaked.length === 1 ? 'y' : 'ies'}: ` +
          leaked.map((q) => q.sql.replace(/\s+/g, ' ').trim().slice(0, 80)).join(' | '),
      );
    });
  }

  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
