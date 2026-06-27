/**
 * Student WRITE-surface IDOR regression — self-only persistence sweep
 * ----------------------------------------------------------------------------
 * Companion to launchpad-dashboard-privacy.test.ts (which locks the MX-302C
 * `/tracker` WRITE). This sweep locks in the SAME guarantee for the remaining
 * student-facing WRITE surfaces that persist into `career_seeker_profiles.data`
 * (or a sibling per-seeker namespace), so a future server refactor cannot
 * silently let an authenticated student A steer a write toward student B by
 * passing B's id in the URL or body:
 *
 *   • behavioural-memory.ts  POST /api/career/behavioural-memory/snapshot
 *       → writes `career_memory_snapshots` + `capadex_behavioural_memory`.
 *         Subject resolved by `resolveEffectiveUserId` (self only; super-admin
 *         may target another; everyone else's cross-user request is rejected).
 *   • employability-passport.ts  POST/DELETE /api/career/passport/:userId/share
 *       → writes `career_seeker_profiles.data.passport`. Same guard, keyed on
 *         the URL :userId which must equal the session principal.
 *   • career-seeker.ts  PUT/PATCH /api/cv/profile/:userId
 *       → writes `career_seeker_profiles.data`. Guard `resolveUserId` rejects a
 *         cross-user :userId (403) BEFORE any DB touch.
 *
 * Each surface ALREADY keys correctly on the session principal today; this test
 * is the regression that keeps it that way. It mounts the REAL route registrars
 * onto throwaway Express servers with a stub auth + stub DB layer that records
 * every query, so the assertions exercise production gate + handler code
 * headlessly without a real database.
 *
 * Run with:  npx tsx backend/tests/student-write-idor.test.ts
 */
import http, { type Server } from 'node:http';
import assert from 'node:assert/strict';
import express, { type Request, type Response, type NextFunction } from 'express';
import { registerBehaviouralMemoryRoutes, resolveEffectiveUserId } from '../routes/behavioural-memory';
import { registerEmployabilityPassportRoutes } from '../routes/employability-passport';
import { registerCareerSeekerRoutes, resolveUserId } from '../routes/career-seeker';
import { pool as storagePool, db as storageDb } from '../storage';

const SESSION_UID = 'session-self-001';
const ATTACKER_UID = 'victim-other-999';

// ── Tiny assert harness (mirrors the repo's other headless tests). ───────────
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return (async () => {
    try {
      await fn();
      passed++;
      console.log(`PASS — ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`FAIL — ${name}\n       ${String(e?.message ?? e)}`);
    }
  })();
}

type Resp = { status: number; json: any };
async function call(
  base: string,
  method: string,
  path: string,
  opts: { auth?: boolean; role?: string; body?: any } = {},
): Promise<Resp> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.auth) headers['x-test-auth'] = '1';
  if (opts.role) headers['x-test-role'] = opts.role;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: ['GET', 'HEAD'].includes(method) ? undefined : JSON.stringify(opts.body ?? {}),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

// ── Stub auth: pins req.user to the SESSION principal, supports a role + a
//    passport-style isAuthenticated() (career-seeker uses req.isAuthenticated()). ─
function makeAuth() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.headers['x-test-auth'] === '1') {
      const role = (req.headers['x-test-role'] as string) || undefined;
      (req as any).user = { id: SESSION_UID, role, email: 'self@example.com', username: 'self' };
      (req as any).isAuthenticated = () => true;
      return next();
    }
    (req as any).isAuthenticated = () => false;
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Section A — behavioural-memory.ts (pool INJECTED → clean stub pool).
// ════════════════════════════════════════════════════════════════════════════
async function sectionBehaviouralMemory() {
  console.log('\nBehavioural Memory snapshot — self-only WRITE');

  const probe: { queries: Array<{ sql: string; params: any[] }> } = { queries: [] };
  const pool = {
    query: async (sql: string, params?: any[]) => {
      probe.queries.push({ sql, params: params ?? [] });
      // INSERT ... career_memory_snapshots ... RETURNING id, snapshot_at
      if (/INSERT INTO career_memory_snapshots/i.test(sql)) {
        return { rows: [{ id: 'snap-1', snapshot_at: new Date().toISOString() }] };
      }
      return { rows: [] };
    },
  } as any;

  const app = express();
  app.use(express.json());
  registerBehaviouralMemoryRoutes(app, pool, makeAuth());
  const server = http.createServer(app);
  const base: string = await new Promise((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve(`http://127.0.0.1:${port}`);
    });
  });

  // (1) Self write — body carries NO id → keyed on the session principal.
  probe.queries = [];
  const selfPut = await call(base, 'POST', '/api/career/behavioural-memory/snapshot', {
    auth: true,
    body: { signals: [{ key: 'focus', strength: 0.4 }] },
  });
  await test('snapshot self → 201 created', () => {
    assert.equal(selfPut.status, 201);
    assert.equal(selfPut.json?.ok, true);
  });
  await test('snapshot self → INSERT keyed on the SESSION uid', () => {
    const ins = probe.queries.find((q) => /INSERT INTO career_memory_snapshots/i.test(q.sql));
    assert.ok(ins, 'expected a snapshot INSERT');
    assert.equal(ins!.params[0], SESSION_UID, `snapshot INSERT used a non-session id: ${ins!.params[0]}`);
  });

  // (2) Cross-user write — non-admin A sends body.user_id = B → 403, NO write.
  probe.queries = [];
  const idorPut = await call(base, 'POST', '/api/career/behavioural-memory/snapshot', {
    auth: true,
    body: { user_id: ATTACKER_UID, signals: [{ key: 'focus', strength: 0.9 }] },
  });
  await test('snapshot cross-user (non-admin) → 403 forbidden_cross_user', () => {
    assert.equal(idorPut.status, 403);
    assert.equal(idorPut.json?.error, 'forbidden_cross_user');
  });
  await test("snapshot cross-user → attacker id NEVER reaches any INSERT (no write IDOR A→B)", () => {
    const wrote = probe.queries.filter(
      (q) => /INSERT INTO (career_memory_snapshots|capadex_behavioural_memory)/i.test(q.sql),
    );
    assert.equal(wrote.length, 0, 'a write ran despite the cross-user rejection');
    const leaked = probe.queries.filter((q) => (q.params ?? []).some((p) => String(p) === ATTACKER_UID));
    assert.equal(leaked.length, 0, "attacker's id reached the DB layer");
  });

  await new Promise<void>((resolve) => server.close(() => resolve()));
}

// ════════════════════════════════════════════════════════════════════════════
// Section B — employability-passport.ts (module `pool` from storage → stub it).
// ════════════════════════════════════════════════════════════════════════════
async function sectionPassport() {
  console.log('\nEmployability Passport share — self-only WRITE');

  const probe: { queries: Array<{ sql: string; params: any[] }> } = { queries: [] };
  (storagePool as any).query = async (sql: string, params?: any[]) => {
    probe.queries.push({ sql, params: params ?? [] });
    if (/UPDATE career_seeker_profiles/i.test(sql)) return { rowCount: 1, rows: [] };
    return { rows: [], rowCount: 0 };
  };

  process.env.FF_EMPLOYABILITY_PASSPORT = 'true';

  const app = express();
  app.use(express.json());
  registerEmployabilityPassportRoutes(app, makeAuth());
  const server = http.createServer(app);
  const base: string = await new Promise((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve(`http://127.0.0.1:${port}`);
    });
  });

  // (1) Self share → 200, the UPDATE keys on the session principal.
  probe.queries = [];
  const selfShare = await call(base, 'POST', `/api/career/passport/${SESSION_UID}/share`, {
    auth: true,
    body: { snapshot: { header: {}, sections: {} } },
  });
  await test('passport share self → 200', () => {
    assert.equal(selfShare.status, 200);
    assert.equal(selfShare.json?.ok, true);
  });
  await test('passport share self → UPDATE keyed on the SESSION uid', () => {
    const upd = probe.queries.find((q) => /UPDATE career_seeker_profiles/i.test(q.sql));
    assert.ok(upd, 'expected a passport UPDATE');
    // UPDATE ... WHERE user_id = $2 with params [json, uid]
    assert.equal(upd!.params[1], SESSION_UID, `passport UPDATE used a non-session id: ${upd!.params[1]}`);
  });

  // (2) Cross-user share — A targets B's :userId → 403, NO write, no id leak.
  probe.queries = [];
  const idorShare = await call(base, 'POST', `/api/career/passport/${ATTACKER_UID}/share`, {
    auth: true,
    body: { snapshot: { header: {}, sections: {} } },
  });
  await test('passport share cross-user → 403 forbidden_cross_user', () => {
    assert.equal(idorShare.status, 403);
    assert.equal(idorShare.json?.error, 'forbidden_cross_user');
  });
  await test("passport share cross-user → attacker id NEVER reaches an UPDATE (no write IDOR A→B)", () => {
    const wrote = probe.queries.filter((q) => /UPDATE career_seeker_profiles/i.test(q.sql));
    assert.equal(wrote.length, 0, 'an UPDATE ran despite the cross-user rejection');
    const leaked = probe.queries.filter((q) => (q.params ?? []).some((p) => String(p) === ATTACKER_UID));
    assert.equal(leaked.length, 0, "attacker's id reached the DB layer");
  });

  // (3) Cross-user revoke (DELETE) is guarded the same way.
  probe.queries = [];
  const idorRevoke = await call(base, 'DELETE', `/api/career/passport/${ATTACKER_UID}/share`, { auth: true });
  await test('passport revoke cross-user → 403, no DELETE-side UPDATE runs', () => {
    assert.equal(idorRevoke.status, 403);
    assert.equal(probe.queries.filter((q) => /UPDATE career_seeker_profiles/i.test(q.sql)).length, 0);
  });

  await new Promise<void>((resolve) => server.close(() => resolve()));
}

// ════════════════════════════════════════════════════════════════════════════
// Section C — career-seeker.ts PUT/PATCH /api/cv/profile/:userId (db.execute).
//   The guard `resolveUserId` rejects a cross-user :userId (403) BEFORE any DB
//   touch; the self write reaches the DB keyed on the session principal.
// ════════════════════════════════════════════════════════════════════════════
async function sectionCareerSeeker() {
  console.log('\nCareer Seeker profile — self-only WRITE');

  const probe: { calls: number } = { calls: 0 };
  // career-seeker.ts uses drizzle `db.execute(sql\`…\`)`. Record every call so we
  // can prove a cross-user :userId 403s BEFORE any DB touch, and a self write does
  // reach the DB. Return a benign profile row so the self path completes.
  (storageDb as any).execute = async () => {
    probe.calls++;
    return { rows: [{ data: { personal: {} } }] };
  };

  const app = express();
  app.use(express.json());
  // career-seeker.ts uses its OWN internal requireAuth (reads req.isAuthenticated()
  // + req.user), so the session principal is established by app-level middleware
  // here rather than an injected auth stub.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.headers['x-test-auth'] === '1') {
      (req as any).user = { id: SESSION_UID, role: (req.headers['x-test-role'] as string) || undefined, email: 'self@example.com', username: 'self' };
      (req as any).isAuthenticated = () => true;
    } else {
      (req as any).isAuthenticated = () => false;
    }
    next();
  });
  registerCareerSeekerRoutes(app);
  const server = http.createServer(app);
  const base: string = await new Promise((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve(`http://127.0.0.1:${port}`);
    });
  });

  // (1) Self profile write → 200, DB reached.
  probe.calls = 0;
  const selfWrite = await call(base, 'PUT', `/api/cv/profile/${SESSION_UID}`, {
    auth: true,
    body: { summary: 'hi' },
  });
  await test('profile write self → 200', () => {
    assert.equal(selfWrite.status, 200);
    assert.equal(selfWrite.json?.success, true);
  });
  await test('profile write self → reaches the DB (write executed)', () => {
    assert.ok(probe.calls > 0, 'the self write never touched the DB');
  });

  // (2) Cross-user profile write — A targets B's :userId → 403 BEFORE any DB touch.
  probe.calls = 0;
  const idorWrite = await call(base, 'PUT', `/api/cv/profile/${ATTACKER_UID}`, {
    auth: true,
    body: { summary: 'pwned' },
  });
  await test('profile write cross-user → 403 Forbidden', () => {
    assert.equal(idorWrite.status, 403);
    assert.equal(idorWrite.json?.success, false);
  });
  await test('profile write cross-user → 403 fires BEFORE any DB touch (no write IDOR A→B)', () => {
    assert.equal(probe.calls, 0, 'the DB was touched on a cross-user write');
  });

  await new Promise<void>((resolve) => server.close(() => resolve()));
}

// ════════════════════════════════════════════════════════════════════════════
// Section D — the shared guards, as pure functions (the single source of truth
//   both DB-backed write surfaces above resolve their subject through).
// ════════════════════════════════════════════════════════════════════════════
function sectionGuards() {
  console.log('\nShared subject-resolution guards (pure)');

  const reqAs = (id: string | null, role?: string, requested?: unknown): any => ({
    user: id ? { id, role } : undefined,
    params: requested !== undefined ? { userId: String(requested) } : {},
    isAuthenticated: () => !!id,
  });

  // resolveEffectiveUserId — behavioural-memory + employability-passport guard.
  void test('resolveEffectiveUserId: non-admin cross-user request → forbidden', () => {
    const r = resolveEffectiveUserId(reqAs(SESSION_UID), ATTACKER_UID);
    assert.equal(r.forbidden, true);
    assert.equal(r.userId, undefined);
  });
  void test('resolveEffectiveUserId: non-admin own/absent id → pinned to self', () => {
    assert.equal(resolveEffectiveUserId(reqAs(SESSION_UID), SESSION_UID).userId, SESSION_UID);
    assert.equal(resolveEffectiveUserId(reqAs(SESSION_UID), undefined).userId, SESSION_UID);
  });
  void test('resolveEffectiveUserId: super-admin MAY target another user (admin tooling)', () => {
    const r = resolveEffectiveUserId(reqAs(SESSION_UID, 'super_admin'), ATTACKER_UID);
    assert.equal(r.forbidden, undefined);
    assert.equal(r.userId, ATTACKER_UID);
  });
  void test('resolveEffectiveUserId: unauthenticated → neither id nor forbidden', () => {
    const r = resolveEffectiveUserId(reqAs(null), ATTACKER_UID);
    assert.equal(r.userId, undefined);
    assert.equal(r.forbidden, undefined);
  });

  // resolveUserId — career-seeker guard.
  void test('resolveUserId: cross-user :userId → null (caller 403s)', () => {
    assert.equal(resolveUserId(reqAs(SESSION_UID, undefined, ATTACKER_UID)), null);
  });
  void test('resolveUserId: matching / absent :userId → self id', () => {
    assert.equal(resolveUserId(reqAs(SESSION_UID, undefined, SESSION_UID)), SESSION_UID);
    assert.equal(resolveUserId(reqAs(SESSION_UID)), SESSION_UID);
  });
  void test('resolveUserId: unauthenticated → null', () => {
    assert.equal(resolveUserId(reqAs(null, undefined, ATTACKER_UID)), null);
  });
}

async function main() {
  sectionGuards();
  await sectionBehaviouralMemory();
  await sectionPassport();
  await sectionCareerSeeker();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
