/**
 * Launchpad Dashboard — Privacy / Flag-Gate / Self-Only Regression Test
 * ----------------------------------------------------------------------------
 * MX-302C — the `/api/launchpad-dashboard/*` surface is flag-gated
 * (`launchpadDashboard` / FF_LAUNCHPAD_DASHBOARD, default OFF) and reads a
 * seeker's OWN profile (the subject is pinned to the authenticated principal —
 * there is no IDOR surface). This test locks in three privacy guarantees so a
 * future refactor cannot silently open the surface or introduce an IDOR:
 *
 *   (a) flag OFF  → /summary + /telemetry 503 BEFORE any auth/DB touch
 *                   (byte-identical legacy: requireAuth never runs, pool never
 *                   queried), and /enabled → 200 {enabled:false}
 *   (b) flag ON   → /enabled → 200 {enabled:true}; the data routes fall through
 *                   the gate to requireAuth (401 without a session)
 *   (c) flag ON   → /summary resolves the subject from the SESSION principal
 *                   ONLY — a client-supplied id/user_id/subject in the query or
 *                   body is NEVER honored (no other seeker's readiness can leak)
 *
 * It mounts the REAL `registerLaunchpadDashboardRoutes` onto a throwaway Express
 * server (listen(0)) with a stub requireAuth and a stub pool that record whether
 * they were touched and with what params — so the assertions exercise the actual
 * production gate + handler code, headlessly, without a real database. The flag
 * is read from process.env at request time (`envOverride`), so a single server
 * can be driven through both OFF and ON states deterministically.
 *
 * Run with:  npx tsx backend/tests/launchpad-dashboard-privacy.test.ts
 */
import http, { type Server } from 'node:http';
import assert from 'node:assert/strict';
import express, { type Request, type Response } from 'express';
import { registerLaunchpadDashboardRoutes } from '../routes/launchpad-dashboard';

const FF = 'FF_LAUNCHPAD_DASHBOARD';
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
    if (/to_regclass/i.test(sql)) {
      return { rows: [{ t: 'public.career_seeker_profiles' }] };
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

  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
