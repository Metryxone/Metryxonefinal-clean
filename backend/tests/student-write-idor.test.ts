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
 *   • career-seeker.ts  POST /api/cv/save-profile, POST /api/cv/init-profile,
 *       PUT /api/career/studio-data, POST /api/career/experience
 *       → BODY-keyed writes into `career_seeker_profiles` that derive the subject
 *         SOLELY from the session principal (`u.id`) and never read an id out of
 *         the request body. There is no `:userId` URL guard here because there is
 *         no client-supplied id to guard — the subject is implicit. Section E is
 *         the regression that pins this: an attacker-supplied id in the body
 *         (`user_id` / `userId` / `id`) must NEVER become the user_id write param.
 *         A future refactor that starts trusting a body id would re-open a silent
 *         write IDOR; these tests would catch it.
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
import { PgDialect } from 'drizzle-orm/pg-core';
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
// Section E — career-seeker.ts BODY-keyed writes (no :userId in the URL).
//   POST /api/cv/save-profile, POST /api/cv/init-profile, PUT /api/career/studio-data
//   all persist into career_seeker_profiles keyed on the SESSION principal (u.id)
//   and never read an id from the request body. POST /api/career/experience does
//   the same via persistPreferredExperience(pool, u.id, …). These have no URL
//   guard because there is no client-supplied id to trust — so a future refactor
//   that begins reading body.user_id (etc.) would silently re-open a write IDOR
//   with no failing test. This section is that test.
//
//   Harness: career-seeker uses drizzle `db.execute(sql\`…\`)` for the three
//   /api/cv* + /api/career/studio-data writes — we stub `storageDb.execute` and
//   compile each drizzle SQL via PgDialect to recover the real ($1,$2,…) params,
//   so we can assert the user_id write param is the session uid (never the
//   attacker id from the body). The experience write goes through the module
//   `pool` (pg-style), so we stub `storagePool.query` and read params directly.
// ════════════════════════════════════════════════════════════════════════════
async function sectionCareerSeekerBodyKeyed() {
  console.log('\nCareer Seeker body-keyed writes — self-only WRITE (no :userId)');

  const dialect = new PgDialect();
  // Records every DB touch with REAL compiled SQL + params. The same probe backs
  // both the drizzle (db.execute) and pg (pool.query) stubs.
  const probe: { queries: Array<{ sql: string; params: any[] }> } = { queries: [] };

  // drizzle db.execute(sqlObj) — compile to { sql, params } so params are visible.
  (storageDb as any).execute = async (query: any) => {
    const compiled = dialect.sqlToQuery(query);
    probe.queries.push({ sql: compiled.sql, params: compiled.params as any[] });
    // init-profile / studio-data SELECT first; return empty so the INSERT path runs.
    return { rows: [] };
  };
  // pg pool.query(sql, params) — the experience write + any fire-and-forget side
  // effects (LBI / propagation) flow through here; record and answer benignly.
  (storagePool as any).query = async (sql: string, params?: any[]) => {
    probe.queries.push({ sql, params: params ?? [] });
    // readEffectiveStage SELECT: report a stored 'executive' stage so EVERY
    // experience is within allowedExperiences() and the persist path is reached.
    if (/FROM users u\s+LEFT JOIN career_seeker_profiles/i.test(sql)) {
      return { rows: [{ profile_user_id: SESSION_UID, career_stage: 'executive', data: {}, role: 'career_seeker', roles: ['career_seeker'] }] };
    }
    return { rows: [], rowCount: 0 };
  };

  process.env.FF_CAREER_LAUNCHPAD = '1'; // unlock studio-data + experience writes.

  const app = express();
  app.use(express.json());
  // career-seeker uses its OWN internal requireAuth (req.isAuthenticated() + req.user);
  // a career_seeker role is required by the experience write specifically.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.headers['x-test-auth'] === '1') {
      (req as any).user = {
        id: SESSION_UID,
        role: (req.headers['x-test-role'] as string) || undefined,
        email: 'self@example.com', username: 'self',
      };
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

  // Helper: the user_id write param for an INSERT/UPDATE into career_seeker_profiles
  // is $1 (the first bind in every write in this file). Returns it for assertion.
  const profileWrites = () =>
    probe.queries.filter((q) => /(INSERT INTO|UPDATE)\s+career_seeker_profiles/i.test(q.sql));

  // A body laced with the attacker's id under every key a naive refactor might read.
  const malice = { user_id: ATTACKER_UID, userId: ATTACKER_UID, id: ATTACKER_UID };
  const noAttackerLeak = (label: string) => {
    const leaked = probe.queries.filter((q) => (q.params ?? []).some((p) => String(p) === ATTACKER_UID));
    assert.equal(leaked.length, 0, `${label}: attacker id reached the DB layer (params)`);
  };

  // ── (1) POST /api/cv/save-profile ──────────────────────────────────────────
  probe.queries = [];
  const save = await call(base, 'POST', '/api/cv/save-profile', {
    auth: true,
    body: { ...malice, profile: { summary: 'mine', personal: { name: 'Self' } } },
  });
  await test('save-profile self → 200', () => {
    assert.equal(save.status, 200);
    assert.equal(save.json?.success, true);
  });
  await test('save-profile → user_id write param is the SESSION uid (body id ignored)', () => {
    const w = profileWrites();
    assert.ok(w.length > 0, 'expected a profile write');
    for (const q of w) assert.equal(q.params[0], SESSION_UID, `write keyed on a non-session id: ${q.params[0]}`);
  });
  await test('save-profile → attacker body id never reaches the DB (no write IDOR A→B)', () => noAttackerLeak('save-profile'));

  // ── (2) POST /api/cv/init-profile ──────────────────────────────────────────
  probe.queries = [];
  const init = await call(base, 'POST', '/api/cv/init-profile', {
    auth: true,
    body: { ...malice, name: 'Self', email: 'self@example.com' },
  });
  await test('init-profile self → 200', () => {
    assert.equal(init.status, 200);
    assert.equal(init.json?.success, true);
  });
  await test('init-profile → INSERT keyed on the SESSION uid (body id ignored)', () => {
    const w = profileWrites().filter((q) => /INSERT INTO/i.test(q.sql));
    assert.ok(w.length > 0, 'expected an init INSERT');
    for (const q of w) assert.equal(q.params[0], SESSION_UID, `INSERT keyed on a non-session id: ${q.params[0]}`);
  });
  await test('init-profile → attacker body id never reaches the DB (no write IDOR A→B)', () => noAttackerLeak('init-profile'));

  // ── (3) PUT /api/career/studio-data ────────────────────────────────────────
  probe.queries = [];
  const studio = await call(base, 'PUT', '/api/career/studio-data', {
    auth: true,
    body: { ...malice, leadership: { team: [{ name: 'A' }] } },
  });
  await test('studio-data self → 200', () => {
    assert.equal(studio.status, 200);
    assert.equal(studio.json?.success, true);
  });
  await test('studio-data → write keyed on the SESSION uid (body id ignored)', () => {
    const w = profileWrites();
    assert.ok(w.length > 0, 'expected a studio write');
    for (const q of w) assert.equal(q.params[0], SESSION_UID, `write keyed on a non-session id: ${q.params[0]}`);
  });
  await test('studio-data → attacker body id never reaches the DB (no write IDOR A→B)', () => noAttackerLeak('studio-data'));

  // ── (4) POST /api/career/experience (subject implicit; never from body) ─────
  probe.queries = [];
  const exp = await call(base, 'POST', '/api/career/experience', {
    auth: true,
    role: 'career_seeker',
    body: { ...malice, experience: 'command-center' },
  });
  await test('experience switch self → 200', () => {
    assert.equal(exp.status, 200);
    assert.equal(exp.json?.success, true);
  });
  await test('experience switch → persist keyed on the SESSION uid (body id ignored)', () => {
    // persistPreferredExperience: INSERT INTO career_seeker_profiles (...) VALUES ($1, …) — $1 is the user id.
    const w = probe.queries.filter((q) => /INSERT INTO career_seeker_profiles/i.test(q.sql));
    assert.ok(w.length > 0, 'expected a preferred-experience persist');
    for (const q of w) assert.equal(q.params[0], SESSION_UID, `persist keyed on a non-session id: ${q.params[0]}`);
  });
  await test('experience switch → attacker body id never reaches the DB (no write IDOR A→B)', () => noAttackerLeak('experience'));

  await new Promise<void>((resolve) => server.close(() => resolve()));
}

// ════════════════════════════════════════════════════════════════════════════
// Section F — career-seeker.ts per-item JOBS + GOALS writes (URL :id, no subject
//   id read at all). Unlike the profile writes above, these handlers never
//   resolve a subject id from the body OR the URL — the row id comes from the URL
//   (`:id`) but every UPDATE/DELETE is scoped by `WHERE id = :id AND user_id =
//   u.id`, where `u.id` is the SESSION principal. That scoping is what stops
//   student A from editing/deleting student B's saved jobs or goals: a row owned
//   by B simply never matches A's session uid, so the UPDATE affects 0 rows
//   (→ 404 on the empty RETURNING) and the DELETE is a silent no-op.
//
//   There is no `:userId`/body-id guard here because there is no subject id to
//   guard — the subject is the session principal, implicit. So a future refactor
//   that drops the `AND user_id = u.id` clause, or starts binding the user_id
//   COLUMN from a body/param id, would silently re-open a write IDOR with NO
//   failing test. This section is that regression. (NB: these handlers DO merge
//   the request body into the item's `data` JSONB by design — so a body field
//   legitimately reaches the DB inside the data column; the invariant we pin is
//   narrower: the user_id COLUMN bind is always the session uid, and every
//   UPDATE/DELETE stays scoped by user_id.)
//
//   Harness: career-seeker uses drizzle `db.execute(sql\`…\`)`; we compile each
//   query via PgDialect to recover the real ($1,$2,…) params. The DB is
//   simulated to honour the scoping — a SELECT/UPDATE returns a row ONLY when the
//   URL id belongs to the session (own row); a FOREIGN id yields no row, exactly
//   as `AND user_id = u.id` would in Postgres.
// ════════════════════════════════════════════════════════════════════════════
async function sectionJobsGoalsPerItem() {
  console.log('\nCareer Seeker jobs + goals per-item writes — self-only scope (URL :id)');

  const dialect = new PgDialect();
  const probe: { queries: Array<{ sql: string; params: any[] }> } = { queries: [] };

  const OWN_JOB_ID = 'job-self-1';
  const FOREIGN_JOB_ID = 'job-victim-9';
  const OWN_GOAL_ID = 'goal-self-1';
  const FOREIGN_GOAL_ID = 'goal-victim-9';
  const OWNED = new Set([OWN_JOB_ID, OWN_GOAL_ID]);

  // Simulate `WHERE id = :id AND user_id = u.id`: a SELECT/UPDATE ... RETURNING
  // yields a row ONLY when the URL id belongs to the session principal. A foreign
  // id (a row owned by another student) never matches → empty rows, exactly as
  // the real scoped query would return for a non-owner.
  (storageDb as any).execute = async (query: any) => {
    const compiled = dialect.sqlToQuery(query);
    const params = compiled.params as any[];
    probe.queries.push({ sql: compiled.sql, params });
    const targetsOwnRow = params.some((p) => OWNED.has(String(p)));
    if (/RETURNING|SELECT/i.test(compiled.sql)) {
      if (targetsOwnRow) {
        const id = params.find((p) => OWNED.has(String(p)));
        return { rows: [{ id, data: {}, status: 'Saved', completed: false, updated_at: new Date().toISOString() }] };
      }
      return { rows: [] };
    }
    return { rows: [] };
  };
  // Fire-and-forget side effects (propagateModuleUpdate / onJobStageChanged /
  // onGoalCompleted / learning-passport) flow through the module pool — record
  // + answer benignly so they never throw and never confuse the assertions.
  (storagePool as any).query = async (sql: string, params?: any[]) => {
    probe.queries.push({ sql, params: params ?? [] });
    return { rows: [], rowCount: 0 };
  };

  const app = express();
  app.use(express.json());
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

  // Only the drizzle writes against the item tables (SELECT/UPDATE/DELETE) — the
  // pg-pool side effects are excluded.
  const jobWrites = () => probe.queries.filter((q) => /career_seeker_jobs/i.test(q.sql));
  const goalWrites = () => probe.queries.filter((q) => /career_seeker_goals/i.test(q.sql));

  // Every item write MUST scope by user_id, and the user_id COLUMN bind (always
  // the LAST param in these SELECT/UPDATE/DELETE statements) MUST be the session
  // uid — never an attacker-supplied id.
  const assertScopedToSession = (writes: Array<{ sql: string; params: any[] }>, label: string) => {
    assert.ok(writes.length > 0, `${label}: expected at least one item write`);
    for (const q of writes) {
      assert.ok(/where[\s\S]*user_id\s*=/i.test(q.sql), `${label}: a write was NOT scoped by user_id → ${q.sql}`);
      const uidBind = q.params[q.params.length - 1];
      assert.equal(uidBind, SESSION_UID, `${label}: user_id column bind was not the session uid (got ${uidBind})`);
      assert.ok(!q.params.some((p) => String(p) === ATTACKER_UID), `${label}: an attacker id reached a write param`);
    }
  };

  // A malicious body laced with the attacker's id under every key a naive
  // refactor might start binding the user_id column from.
  const malice = { user_id: ATTACKER_UID, userId: ATTACKER_UID, id: ATTACKER_UID };

  // ── JOBS: update own row → 200, scoped to session ──────────────────────────
  probe.queries = [];
  const jobSelf = await call(base, 'PUT', `/api/cv/jobs/${OWN_JOB_ID}`, { auth: true, body: { ...malice, status: 'Applied' } });
  await test('jobs update own → 200', () => {
    assert.equal(jobSelf.status, 200);
    assert.equal(jobSelf.json?.success, true);
  });
  await test('jobs update own → every write scoped to the SESSION uid (body id ignored for user_id column)', () => {
    assertScopedToSession(jobWrites(), 'jobs update own');
  });

  // ── JOBS: update a FOREIGN row → 404, no mutation of another student's row ──
  probe.queries = [];
  const jobForeign = await call(base, 'PUT', `/api/cv/jobs/${FOREIGN_JOB_ID}`, { auth: true, body: { status: 'Rejected' } });
  await test('jobs update foreign id → 404 (row owned by another student never matches)', () => {
    assert.equal(jobForeign.status, 404);
    assert.equal(jobForeign.json?.success, false);
  });
  await test('jobs update foreign id → the UPDATE was still scoped by session user_id (no cross-user write)', () => {
    assertScopedToSession(jobWrites(), 'jobs update foreign');
  });

  // ── JOBS: delete own → 200, scoped ─────────────────────────────────────────
  probe.queries = [];
  const jobDelSelf = await call(base, 'DELETE', `/api/cv/jobs/${OWN_JOB_ID}`, { auth: true });
  await test('jobs delete own → 200 and scoped to the SESSION uid', () => {
    assert.equal(jobDelSelf.status, 200);
    assertScopedToSession(jobWrites().filter((q) => /DELETE/i.test(q.sql)), 'jobs delete own');
  });

  // ── JOBS: delete a FOREIGN row → 200 no-op, but scoped by user_id (0 rows) ──
  probe.queries = [];
  const jobDelForeign = await call(base, 'DELETE', `/api/cv/jobs/${FOREIGN_JOB_ID}`, { auth: true });
  await test('jobs delete foreign id → 200 no-op, DELETE scoped by session user_id (another student unaffected)', () => {
    assert.equal(jobDelForeign.status, 200);
    assertScopedToSession(jobWrites().filter((q) => /DELETE/i.test(q.sql)), 'jobs delete foreign');
  });

  // ── GOALS: update own → 200, scoped ────────────────────────────────────────
  probe.queries = [];
  const goalSelf = await call(base, 'PUT', `/api/cv/goals/${OWN_GOAL_ID}`, { auth: true, body: { ...malice, completed: true } });
  await test('goals update own → 200', () => {
    assert.equal(goalSelf.status, 200);
    assert.equal(goalSelf.json?.success, true);
  });
  await test('goals update own → every write scoped to the SESSION uid (body id ignored for user_id column)', () => {
    assertScopedToSession(goalWrites(), 'goals update own');
  });

  // ── GOALS: update a FOREIGN row → 404 BEFORE any UPDATE runs ───────────────
  probe.queries = [];
  const goalForeign = await call(base, 'PUT', `/api/cv/goals/${FOREIGN_GOAL_ID}`, { auth: true, body: { completed: true } });
  await test('goals update foreign id → 404 (scoped SELECT finds no owned row)', () => {
    assert.equal(goalForeign.status, 404);
    assert.equal(goalForeign.json?.success, false);
  });
  await test('goals update foreign id → 404 fires BEFORE any UPDATE (no cross-user mutation)', () => {
    const updates = goalWrites().filter((q) => /UPDATE\s+career_seeker_goals/i.test(q.sql));
    assert.equal(updates.length, 0, 'an UPDATE ran despite the foreign row never matching');
    assertScopedToSession(goalWrites(), 'goals update foreign (SELECT scope)');
  });

  // ── GOALS: delete own → 200, scoped ────────────────────────────────────────
  probe.queries = [];
  const goalDelSelf = await call(base, 'DELETE', `/api/cv/goals/${OWN_GOAL_ID}`, { auth: true });
  await test('goals delete own → 200 and scoped to the SESSION uid', () => {
    assert.equal(goalDelSelf.status, 200);
    assertScopedToSession(goalWrites().filter((q) => /DELETE/i.test(q.sql)), 'goals delete own');
  });

  // ── GOALS: delete a FOREIGN row → 200 no-op, scoped by user_id ─────────────
  probe.queries = [];
  const goalDelForeign = await call(base, 'DELETE', `/api/cv/goals/${FOREIGN_GOAL_ID}`, { auth: true });
  await test('goals delete foreign id → 200 no-op, DELETE scoped by session user_id (another student unaffected)', () => {
    assert.equal(goalDelForeign.status, 200);
    assertScopedToSession(goalWrites().filter((q) => /DELETE/i.test(q.sql)), 'goals delete foreign');
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
  await sectionCareerSeekerBodyKeyed();
  await sectionJobsGoalsPerItem();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
