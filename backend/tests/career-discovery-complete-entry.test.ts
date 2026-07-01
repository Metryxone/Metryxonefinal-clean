/**
 * Career Discovery "complete / skip" entry-path regression guard (Task #263).
 *
 * Background: a fresh student who clicks "Skip to Career Builder" hits
 * POST /api/career-discovery/complete. Task #258 fixed a Postgres NOT NULL
 * violation (`null value in column "profile"`) that left such students stuck on
 * the Career Discovery screen and crashed CareerBuilderPage/DashboardTab into
 * its error boundary. Because the Career Builder mount gate runs
 * UNCONDITIONALLY, a regression here silently makes the ENTIRE Career Builder
 * workspace (incl. the MX-302I Mentor Connect tab) unreachable for incomplete
 * students. There was no automated check guarding this path until now.
 *
 * What this test locks:
 *   1. The "skip" path persists status='skipped' with NO NOT NULL violation —
 *      the omitted profile is COALESCEd to the '{}' default, never left null.
 *   2. The "complete" path persists status='completed' with the composed
 *      profile snapshot, also without a NOT NULL violation.
 *   3. A re-skip AFTER a prior completed run PRESERVES the previously
 *      snapshotted profile (the ON CONFLICT COALESCE intent), rather than
 *      clobbering it with '{}'.
 *
 * The test drives the real POST /complete route handler chain (gate +
 * requireAuth + handler) with the flag FF_CAREER_DISCOVERY forced ON, against a
 * tiny fake pg.Pool that faithfully simulates ONLY the career_discovery_results
 * table: it enforces the NOT NULL constraint on `profile` and evaluates the
 * INSERT ... ON CONFLICT DO UPDATE (incl. COALESCE / EXCLUDED / table-qualified
 * column references). A meta-test proves the fake pool actually rejects a null
 * profile, so the guard is not a tautology.
 *
 * Run with:  cd backend && FF_CAREER_DISCOVERY=true npx tsx --test tests/career-discovery-complete-entry.test.ts
 */

// The flag is read from process.env at call time (no caching) — force it ON
// BEFORE importing the route module so isCareerDiscoveryEnabled() returns true.
process.env.FF_CAREER_DISCOVERY = 'true';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';

import { registerCareerDiscoveryRoutes } from '../routes/career-discovery';

// ── A focused fake pg.Pool for career_discovery_results ──────────────────────
// Anything that is NOT a career_discovery_results op returns an empty result so
// the composed engines (match / MEI / LBI) degrade honestly to nulls. The
// career_discovery_results INSERT/SELECT are evaluated faithfully, including the
// NOT NULL constraint on `profile` (and values_responses) so a regression that
// passes a null profile (the original #258 bug) throws like Postgres.

const NOT_NULL_COLUMNS = new Set(['user_id', 'profile', 'values_responses', 'status']);

/** Split on top-level commas, respecting nested parentheses. */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** Extract the balanced-paren content starting at the '(' found at/after `from`. */
function extractParen(text: string, from: number): { inner: string; end: number } {
  const open = text.indexOf('(', from);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return { inner: text.slice(open + 1, i), end: i };
    }
  }
  throw new Error('unbalanced parens in fake-pool SQL parse');
}

interface EvalCtx {
  params: any[];
  excluded: Record<string, any>;
  existing: Record<string, any> | null;
}

/** Evaluate the small set of SQL value-expressions markDiscovery/persistValues emit. */
function evalExpr(rawExpr: string, ctx: EvalCtx): any {
  const expr = rawExpr.trim();
  const lower = expr.toLowerCase();

  if (lower.startsWith('coalesce(')) {
    const { inner } = extractParen(expr, lower.indexOf('coalesce') + 'coalesce'.length);
    for (const arg of splitTopLevel(inner)) {
      const v = evalExpr(arg, ctx);
      if (v !== null && v !== undefined) return v;
    }
    return null;
  }

  let m: RegExpMatchArray | null;
  if ((m = expr.match(/^\$(\d+)(::[a-z]+)?$/i))) {
    const v = ctx.params[Number(m[1]) - 1];
    return v === undefined ? null : v;
  }
  if (/^now\(\)$/i.test(expr)) return new Date();
  if ((m = expr.match(/^'([\s\S]*)'(::[a-z]+)?$/i))) return m[1]; // string/jsonb literal → raw text
  if ((m = expr.match(/^excluded\.(\w+)$/i))) {
    const v = ctx.excluded[m[1]];
    return v === undefined ? null : v;
  }
  if ((m = expr.match(/^career_discovery_results\.(\w+)$/i))) {
    const v = ctx.existing?.[m[1]];
    return v === undefined ? null : v;
  }
  return null;
}

function notNullViolation(col: string): Error {
  const err: any = new Error(
    `null value in column "${col}" of relation "career_discovery_results" violates not-null constraint`,
  );
  err.code = '23502';
  err.column = col;
  return err;
}

class FakeDiscoveryPool {
  /** in-memory career_discovery_results, keyed by user_id */
  store: Record<string, Record<string, any>> = {};
  /** every (text, params) the code issued — lets tests inspect what ran */
  captured: { text: string; params: any[] }[] = [];

  async query(text: string, params: any[] = []): Promise<any> {
    this.captured.push({ text, params });
    const norm = text.replace(/\s+/g, ' ').trim();
    const lower = norm.toLowerCase();

    // ensure-schema DDL → no-op.
    if (lower.startsWith('create table') || lower.startsWith('create index')) {
      return { rows: [], rowCount: 0 };
    }

    // INSERT ... ON CONFLICT (user_id) DO UPDATE on career_discovery_results.
    if (lower.startsWith('insert into career_discovery_results')) {
      return this.handleUpsert(norm, params);
    }

    // SELECT ... FROM career_discovery_results WHERE user_id = $1 — return the
    // stored row (callers pick whichever columns they need).
    if (lower.includes('from career_discovery_results') && lower.startsWith('select')) {
      const uid = String(params[0]);
      const row = this.store[uid];
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }

    // Everything else (career_seeker_profiles, users, match/MEI/LBI engines, …)
    // → empty so composed readers degrade honestly to nulls (never-throws).
    return { rows: [], rowCount: 0 };
  }

  private handleUpsert(norm: string, params: any[]): any {
    // Column list immediately after the table name.
    const colsMatch = norm.match(/insert into career_discovery_results\s*\(([^)]+)\)/i);
    assert.ok(colsMatch, 'fake pool could not parse the INSERT column list');
    const columns = colsMatch![1].split(',').map((c) => c.trim());

    // VALUES (...) — balanced-paren extraction (COALESCE/NOW() contain parens).
    const valuesIdx = norm.toLowerCase().indexOf('values', colsMatch!.index! + colsMatch![0].length);
    const { inner: valuesInner } = extractParen(norm, valuesIdx);
    const valueExprs = splitTopLevel(valuesInner);
    assert.equal(valueExprs.length, columns.length, 'VALUES arity must match the column list');

    const uid = String(params[0]);
    const existing = this.store[uid] ?? null;

    // Compute the proposed (EXCLUDED) row from the VALUES expressions.
    const excluded: Record<string, any> = {};
    columns.forEach((col, i) => {
      excluded[col] = evalExpr(valueExprs[i], { params, excluded, existing });
    });

    if (!existing) {
      // INSERT path — explicit NULL into a NOT NULL column violates (this is the
      // exact #258 failure mode for a skip that passes a null profile).
      for (const col of columns) {
        if (NOT_NULL_COLUMNS.has(col) && (excluded[col] === null || excluded[col] === undefined)) {
          throw notNullViolation(col);
        }
      }
      this.store[uid] = { ...excluded };
      return { rows: [{ ...this.store[uid] }], rowCount: 1 };
    }

    // ON CONFLICT DO UPDATE SET ... — evaluate each assignment.
    const setMatch = norm.match(/do update\s+set\s+(.*)$/i);
    assert.ok(setMatch, 'fake pool could not parse the DO UPDATE SET clause');
    const next = { ...existing };
    for (const frag of splitTopLevel(setMatch![1])) {
      const eq = frag.indexOf('=');
      const col = frag.slice(0, eq).trim();
      const rhs = frag.slice(eq + 1).trim();
      const v = evalExpr(rhs, { params, excluded, existing });
      if (NOT_NULL_COLUMNS.has(col) && (v === null || v === undefined)) {
        throw notNullViolation(col);
      }
      next[col] = v;
    }
    this.store[uid] = next;
    return { rows: [{ ...next }], rowCount: 1 };
  }
}

// ── Capture the real POST /complete handler chain ────────────────────────────
function captureCompleteChain(pool: Pool): Array<any> {
  let chain: any[] | null = null;
  const fakeApp: any = {
    use: () => {},
    get: () => {},
    post: (path: string, ...handlers: any[]) => {
      if (path.endsWith('/career-discovery/complete')) chain = handlers;
    },
  };
  // requireAuth shim: pins the authenticated subject to a fixed test user so the
  // skip/complete/re-skip calls all target the SAME row (exercising ON CONFLICT).
  const requireAuth = (req: any, _res: any, next: () => void) => {
    if (!req.user) req.user = { id: req._testUserId ?? 'student-test' };
    next();
  };
  registerCareerDiscoveryRoutes(fakeApp, pool, requireAuth);
  assert.ok(chain, 'POST /api/career-discovery/complete route was registered');
  return chain!;
}

// ── Capture the POST /complete chain with a requireAuth SPY ──────────────────
// Lets the flag-OFF guard assert the gate short-circuits BEFORE requireAuth runs
// (no auth touch) in addition to before any DB touch.
function captureCompleteChainWithAuthSpy(pool: Pool): { chain: any[]; authCalls: () => number } {
  let chain: any[] | null = null;
  let authCalls = 0;
  const fakeApp: any = {
    use: () => {},
    get: () => {},
    post: (path: string, ...handlers: any[]) => {
      if (path.endsWith('/career-discovery/complete')) chain = handlers;
    },
  };
  const requireAuth = (req: any, _res: any, next: () => void) => {
    authCalls++;
    if (!req.user) req.user = { id: req._testUserId ?? 'student-test' };
    next();
  };
  registerCareerDiscoveryRoutes(fakeApp, pool, requireAuth);
  assert.ok(chain, 'POST /api/career-discovery/complete route was registered');
  return { chain: chain!, authCalls: () => authCalls };
}

// ── Capture the (ungated) GET /enabled probe handler ─────────────────────────
function captureEnabledProbe(pool: Pool): any {
  let handler: any = null;
  const fakeApp: any = {
    use: () => {},
    post: () => {},
    get: (path: string, ...handlers: any[]) => {
      if (path.endsWith('/career-discovery/enabled')) handler = handlers[handlers.length - 1];
    },
  };
  const requireAuth = (_req: any, _res: any, next: () => void) => next();
  registerCareerDiscoveryRoutes(fakeApp, pool, requireAuth);
  assert.ok(handler, 'GET /api/career-discovery/enabled route was registered');
  return handler;
}

function runEnabledProbe(handler: any): { status: number; body: any } {
  let statusCode = 200;
  let payload: any = null;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(p: any) {
      payload = p;
      return res;
    },
  };
  handler({}, res, () => {});
  return { status: statusCode, body: payload };
}

async function runComplete(chain: any[], userId: string, body: any) {
  const req: any = { body, _testUserId: userId };
  let statusCode = 200;
  let payload: any = null;
  let ended = false;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(p: any) {
      payload = p;
      ended = true;
      return res;
    },
  };
  for (const h of chain) {
    if (ended) break;
    let nexted = false;
    await h(req, res, () => {
      nexted = true;
    });
    if (!nexted) break; // a middleware ended the response (gate 503 / handler json)
  }
  return { status: statusCode, body: payload };
}

// ── 1. Skip path: no NOT NULL violation, status becomes 'skipped' ───────────

test('skip → status "skipped", no NOT NULL violation, profile defaults to {} (the #258 fix)', async () => {
  const pool = new FakeDiscoveryPool() as unknown as Pool;
  const chain = captureCompleteChain(pool);

  const { status, body } = await runComplete(chain, 'student-skip', { skip: true });

  assert.equal(status, 200, 'the skip request succeeds (no 500 from a NOT NULL violation)');
  assert.equal(body.ok, true);
  assert.equal(body.status, 'skipped', 'discovery status is recorded as skipped');
  assert.equal(body.hasCompletedDiscovery, true, 'a skipped user satisfies the Career Builder mount gate');

  // The omitted profile was COALESCEd to the '{}' default — never left null.
  const row = (pool as unknown as FakeDiscoveryPool).store['student-skip'];
  assert.ok(row, 'a row was persisted for the skipping student');
  assert.equal(row.profile, '{}', 'profile defaulted to the {} jsonb, not null');
});

test('skip via {status:"skipped"} body shape is also honored', async () => {
  const pool = new FakeDiscoveryPool() as unknown as Pool;
  const chain = captureCompleteChain(pool);

  const { status, body } = await runComplete(chain, 'student-skip2', { status: 'skipped' });
  assert.equal(status, 200);
  assert.equal(body.status, 'skipped');
  assert.equal(body.hasCompletedDiscovery, true);
});

// ── 2. Complete path: snapshots a profile, no NOT NULL violation ─────────────

test('complete → status "completed", persists a non-null composed profile snapshot', async () => {
  const pool = new FakeDiscoveryPool() as unknown as Pool;
  const chain = captureCompleteChain(pool);

  const { status, body } = await runComplete(chain, 'student-complete', {});

  assert.equal(status, 200, 'the complete request succeeds');
  assert.equal(body.ok, true);
  assert.equal(body.status, 'completed', 'discovery status is recorded as completed');
  assert.equal(body.hasCompletedDiscovery, true, 'a completed user satisfies the Career Builder mount gate');

  const row = (pool as unknown as FakeDiscoveryPool).store['student-complete'];
  assert.ok(row, 'a row was persisted for the completing student');
  assert.notEqual(row.profile, null, 'the snapshot profile is never null');
  assert.notEqual(row.profile, '{}', 'a completed run snapshots the real composed profile, not the empty default');
  const parsed = JSON.parse(row.profile);
  assert.equal(parsed.ok, true, 'the snapshot is the composed DiscoveryProfile envelope');
  assert.equal(parsed.user_id, 'student-complete');
});

// ── 3. Re-skip after a completed run PRESERVES the prior profile snapshot ─────

test('re-skip after a completed run preserves the prior profile (ON CONFLICT COALESCE), not {}', async () => {
  const pool = new FakeDiscoveryPool() as unknown as Pool;
  const chain = captureCompleteChain(pool);
  const fake = pool as unknown as FakeDiscoveryPool;

  // First complete → snapshots a real profile.
  const first = await runComplete(chain, 'student-both', {});
  assert.equal(first.body.status, 'completed');
  const snapshot = fake.store['student-both'].profile;
  assert.notEqual(snapshot, '{}', 'precondition: the completed run stored a real snapshot');

  // Then skip the SAME user → status flips, but the snapshot must survive.
  const second = await runComplete(chain, 'student-both', { skip: true });
  assert.equal(second.status, 200, 're-skip does not error');
  assert.equal(second.body.status, 'skipped', 'status updates to skipped');

  assert.equal(
    fake.store['student-both'].profile,
    snapshot,
    're-skip preserves the previously snapshotted profile (COALESCE intent), never clobbers it with {}',
  );
});

// ── Meta-test: prove the guard has teeth (not a tautology) ───────────────────
// If a regression reintroduced the #258 bug by writing the profile column as a
// bare null (no COALESCE / no default), the fake pool must reject it like
// Postgres would — otherwise the tests above could pass against a broken fix.

test('fake pool rejects an explicit null profile with a NOT NULL violation (mirrors Postgres #258)', async () => {
  const pool = new FakeDiscoveryPool();
  await assert.rejects(
    () =>
      pool.query(
        `INSERT INTO career_discovery_results (user_id, status, completed_at, profile, compatibility_score)
           VALUES ($1, $2, NOW(), $3, $4)`,
        ['regression-user', 'skipped', null, null],
      ),
    (err: any) => err.code === '23502' && /column "profile"/.test(err.message),
    'a bare null profile (the original bug) must throw a NOT NULL violation',
  );
});

test('fake pool ACCEPTS the COALESCEd profile default (the shipped fix)', async () => {
  const pool = new FakeDiscoveryPool();
  await assert.doesNotReject(() =>
    pool.query(
      `INSERT INTO career_discovery_results (user_id, status, completed_at, profile, compatibility_score)
         VALUES ($1, $2, NOW(), COALESCE($3::jsonb, '{}'::jsonb), $4)`,
      ['fixed-user', 'skipped', null, null],
    ),
  );
  assert.equal(pool.store['fixed-user'].profile, '{}', 'COALESCE supplies the {} default for a null profile');
});

// ── 4. Flag-OFF byte-identical-OFF discipline (Task #267) ────────────────────
// The complement of the flag-ON skip/complete guard above: when
// FF_CAREER_DISCOVERY is OFF, POST /api/career-discovery/complete must 503 from
// the flag gate BEFORE any auth or DB touch, so flag-OFF is byte-identical incl.
// schema (the lazy ensure-schema is only reached on the flag-ON path). The
// /enabled probe stays UNGATED (200 {enabled:false}) so the SPA can cheaply
// detect the flag state without 503ing.
//
// The flag is read from process.env at call time (no caching), so each test here
// forces it OFF for the duration and restores the prior value afterwards (the
// module forced it ON at import for the flag-ON tests above).

/** Run `fn` with FF_CAREER_DISCOVERY forced OFF, restoring the prior value. */
async function withFlagOff(fn: () => void | Promise<void>): Promise<void> {
  const prev = process.env.FF_CAREER_DISCOVERY;
  process.env.FF_CAREER_DISCOVERY = '0';
  try {
    await fn();
  } finally {
    if (prev === undefined) delete process.env.FF_CAREER_DISCOVERY;
    else process.env.FF_CAREER_DISCOVERY = prev;
  }
}

test('flag OFF → POST /complete 503s from the gate BEFORE any auth or DB touch (no queries captured)', async () => {
  await withFlagOff(async () => {
    const pool = new FakeDiscoveryPool();
    const { chain, authCalls } = captureCompleteChainWithAuthSpy(pool as unknown as Pool);

    const { status, body } = await runComplete(chain, 'student-flag-off', { skip: true });

    assert.equal(status, 503, 'a flag-OFF request is 503ed by the gate');
    assert.equal(body.ok, false);
    assert.equal(body.enabled, false, 'the 503 envelope reports the flag is disabled');

    // Byte-identical-OFF: the gate short-circuited before requireAuth ran …
    assert.equal(authCalls(), 0, 'requireAuth was never reached (no auth touch when OFF)');
    // … and before the handler issued ANY query (no DB/ensure-schema touch).
    assert.equal(
      pool.captured.length,
      0,
      'no SQL was issued when OFF — the lazy ensure-schema/INSERT is never reached',
    );
    assert.equal(
      Object.keys(pool.store).length,
      0,
      'no career_discovery_results row was created on the inert flag-OFF path',
    );
  });
});

test('flag OFF → the /complete handler never executes (meta: prove the gate, not the handler, ended it)', async () => {
  // A defense against a future refactor that moves the 503 INTO the handler (which
  // would have already touched auth/DB). With the spy at 0 auth calls AND 0 queries
  // above, the only middleware that could have ended the response is the gate.
  await withFlagOff(async () => {
    const pool = new FakeDiscoveryPool();
    const chain = captureCompleteChain(pool as unknown as Pool);
    const { status } = await runComplete(chain, 'student-flag-off-2', {});
    assert.equal(status, 503);
    assert.equal((pool as unknown as FakeDiscoveryPool).captured.length, 0, 'still no DB touch when OFF');
  });
});

test('flag OFF → GET /enabled stays UNGATED: 200 {ok:true, enabled:false}', async () => {
  await withFlagOff(async () => {
    const pool = new FakeDiscoveryPool();
    const handler = captureEnabledProbe(pool as unknown as Pool);

    const { status, body } = runEnabledProbe(handler);

    assert.equal(status, 200, 'the probe is never 503ed (it is intentionally ungated)');
    assert.equal(body.ok, true);
    assert.equal(body.enabled, false, 'the probe honestly reports the flag is OFF');
    assert.equal(pool.captured.length, 0, 'the probe reads no DB (pure flag check)');
  });
});

test('flag ON → GET /enabled reports 200 {enabled:true} (probe tracks the live flag state)', async () => {
  // Sanity counterpart to the OFF probe: with the flag ON (module default) the
  // SAME ungated probe flips to enabled:true, proving it reflects the live flag.
  const pool = new FakeDiscoveryPool();
  const handler = captureEnabledProbe(pool as unknown as Pool);

  const { status, body } = runEnabledProbe(handler);

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.enabled, true, 'flag ON (module default) → probe reports enabled:true');
});

// ── 5. Flag-OFF byte-identical-OFF discipline for the REST of the module (Task #270) ─
// Task #267 (section 4 above) only locked POST /complete + the /enabled probe.
// Every OTHER gate-protected DATA route in this module shares the exact SAME
// `gate` middleware, but had no standing flag-OFF test. A future refactor that
// reordered the chain on any of them (e.g. moved a 503 INTO the handler, or
// registered requireAuth before the gate) would let a flag-OFF request reach
// auth/DB — potentially running the lazy ensure-schema on a path meant to be
// inert — with no test catching it. This parameterizes the same guard over the
// full remaining surface so "the rest of Career Discovery stays silent when
// switched off" is enforced route-by-route.

/** Every remaining gate-protected route (POST /complete + the ungated /enabled probe are covered above). */
const GATED_ROUTES: Array<{ method: 'GET' | 'POST'; path: string; run: { body?: any; params?: any; query?: any } }> = [
  { method: 'GET', path: '/api/career-discovery/values/questions', run: {} },
  { method: 'GET', path: '/api/career-discovery/status', run: {} },
  { method: 'GET', path: '/api/career-discovery/battery', run: {} },
  { method: 'POST', path: '/api/career-discovery/values', run: { body: { responses: {} } } },
  { method: 'GET', path: '/api/career-discovery/profile', run: {} },
  { method: 'GET', path: '/api/career-discovery/explorer', run: { query: { limit: '12' } } },
  { method: 'GET', path: '/api/career-discovery/explorer/market', run: { query: { region: 'IN' } } },
  { method: 'POST', path: '/api/career-discovery/explorer/simulate', run: { body: { changes: [] } } },
  { method: 'GET', path: '/api/career-discovery/explorer/role/:roleId', run: { params: { roleId: 'r1' } } },
  { method: 'GET', path: '/api/career-discovery/guidance', run: {} },
];

/** Capture EVERY registered route chain (GET + POST), keyed by `${METHOD} ${path}`, with the supplied requireAuth. */
function captureGatedRoutes(pool: Pool, requireAuth: RequireAuthShim): Record<string, any[]> {
  const routes: Record<string, any[]> = {};
  const fakeApp: any = {
    use: () => {},
    get: (path: string, ...handlers: any[]) => {
      routes[`GET ${path}`] = handlers;
    },
    post: (path: string, ...handlers: any[]) => {
      routes[`POST ${path}`] = handlers;
    },
  };
  registerCareerDiscoveryRoutes(fakeApp, pool, requireAuth);
  return routes;
}

type RequireAuthShim = (req: any, res: any, next: () => void) => void;

/** Drive a captured chain with a minimal req/res, stopping when a middleware ends the response. */
async function runRoute(chain: any[], run: { body?: any; params?: any; query?: any }): Promise<{ status: number; body: any }> {
  const req: any = { body: run.body ?? {}, params: run.params ?? {}, query: run.query ?? {} };
  let statusCode = 200;
  let payload: any = null;
  let ended = false;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(p: any) {
      payload = p;
      ended = true;
      return res;
    },
  };
  for (const h of chain) {
    if (ended) break;
    let nexted = false;
    await h(req, res, () => {
      nexted = true;
    });
    if (!nexted) break; // a middleware ended the response (gate 503 / auth stop / handler json)
  }
  return { status: statusCode, body: payload };
}

for (const route of GATED_ROUTES) {
  test(`flag OFF → ${route.method} ${route.path} 503s from the gate BEFORE any auth or DB touch (no queries captured)`, async () => {
    await withFlagOff(async () => {
      const pool = new FakeDiscoveryPool();
      let authCalls = 0;
      const requireAuth: RequireAuthShim = (req, _res, next) => {
        authCalls++;
        if (!req.user) req.user = { id: 'student-test' };
        next();
      };
      const routes = captureGatedRoutes(pool as unknown as Pool, requireAuth);
      const chain = routes[`${route.method} ${route.path}`];
      assert.ok(chain, `${route.method} ${route.path} was registered`);

      const { status, body } = await runRoute(chain, route.run);

      assert.equal(status, 503, 'a flag-OFF request is 503ed by the gate');
      assert.equal(body.ok, false);
      assert.equal(body.enabled, false, 'the 503 envelope reports the flag is disabled');

      // Byte-identical-OFF: the gate short-circuited before requireAuth ran …
      assert.equal(authCalls, 0, 'requireAuth was never reached (no auth touch when OFF)');
      // … and before any handler issued a query (no DB / lazy ensure-schema touch).
      assert.equal(pool.captured.length, 0, 'no SQL was issued when OFF — the lazy ensure-schema is never reached');
      assert.equal(Object.keys(pool.store).length, 0, 'no career_discovery_results row was created on the inert flag-OFF path');
    });
  });
}

// ── Meta: prove the gate (not a broken/unregistered route) is what stops them ──
// Non-tautology guard for the parameterized OFF test above. With the flag ON
// (module default), the SAME routes must let the request THROUGH the gate and
// reach requireAuth. Here requireAuth is a spy that ends the response with 401
// so the heavy service handlers never run — we only assert the gate called
// next() into auth. If a route were simply always-503 (or unregistered), this
// would fail, proving the OFF assertions have teeth.
for (const route of GATED_ROUTES) {
  test(`flag ON → ${route.method} ${route.path} passes the gate through to requireAuth (proves OFF 503 is the gate)`, async () => {
    const pool = new FakeDiscoveryPool();
    let authCalls = 0;
    const requireAuthStop: RequireAuthShim = (_req, res) => {
      authCalls++;
      res.status(401).json({ ok: false, stopped_at: 'auth' }); // end before the handler runs
    };
    const routes = captureGatedRoutes(pool as unknown as Pool, requireAuthStop);
    const chain = routes[`${route.method} ${route.path}`];
    assert.ok(chain, `${route.method} ${route.path} was registered`);

    const { status } = await runRoute(chain, route.run);

    assert.equal(authCalls, 1, 'the gate allowed the request through to requireAuth when the flag is ON');
    assert.equal(status, 401, 'the auth spy — not the gate — ended the response when ON');
    assert.equal(pool.captured.length, 0, 'no handler DB work ran (we stopped at auth) — this test isolates the gate→auth handoff');
  });
}
