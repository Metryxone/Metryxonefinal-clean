/**
 * Task #331 — Career Discovery creates NO database tables while switched off
 * (end-to-end, against a REAL Postgres).
 *
 * Background: Task #270 already proved every Career Discovery DATA route
 * short-circuits (503) at the flag gate BEFORE touching auth or the DB when
 * FF_CAREER_DISCOVERY is OFF — but it did so with an in-memory FAKE pg.Pool.
 * A fake pool can only see the queries the handler chose to issue; it is blind
 * to a module-load / import-time DDL side effect, or to a refactor that runs the
 * lazy ensure-schema on a path the fake pool never models. This test closes that
 * gap with a REAL database assertion: it drives the ACTUAL registered route
 * chain (gate + requireAuth + handler) against a live Postgres and asserts that
 * the module's lazy ensure-schema (`career_discovery_results` + its index) NEVER
 * runs while the flag is OFF — and that it DOES run on the first gated request
 * when the flag is ON (so the OFF assertion has teeth, not a vacuous pass).
 *
 * Isolation contract (NO prod/dev pollution):
 *   - `public.career_discovery_results` already exists in the shared dev DB and
 *     may hold real rows; we must never touch it. So every query the route chain
 *     issues runs through a dedicated pool pinned to a per-run SCRATCH schema via
 *     `search_path=<scratch>,public`. The orchestrator's
 *     `CREATE TABLE IF NOT EXISTS career_discovery_results ...` uses an
 *     UNqualified name, so it resolves to the FIRST search_path schema (scratch)
 *     — verified empirically that IF NOT EXISTS still creates the scratch copy
 *     even when public.career_discovery_results exists. Its FK
 *     `REFERENCES users(id)` resolves to public.users (also on the path).
 *   - The scratch schema is created before the run and DROPped CASCADE after, so
 *     nothing survives and the real public table is never read or written.
 *
 * The flag is read from process.env at CALL time (no caching — see
 * config/feature-flags.ts `envOverride`), so a single process can exercise both
 * the OFF and ON phases by flipping FF_CAREER_DISCOVERY between them. The
 * ensure-schema `_schemaReady` latch stays false through the OFF phase (it is
 * never reached), so the ON phase genuinely executes the CREATE TABLE.
 *
 * Run with:  cd backend && npx tsx --test tests/career-discovery-no-schema-when-off.test.ts
 */

// Start OFF so the module import + route registration happen with the flag OFF
// (the byte-identical-OFF contract includes schema).
process.env.FF_CAREER_DISCOVERY = '0';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';

import { registerCareerDiscoveryRoutes } from '../routes/career-discovery';

const HAS_DB = !!process.env.DATABASE_URL;

// A unique scratch schema so concurrent runs never collide.
const SCRATCH = `cd_offcheck_${process.pid}_${Date.now().toString(36)}`;

let adminPool: Pool | null = null; // creates/drops the scratch schema + probes it
let scratchPool: Pool | null = null; // pinned to search_path=<scratch>,public

before(async () => {
  if (!HAS_DB) return;
  adminPool = new Pool({ connectionString: process.env.DATABASE_URL });
  await adminPool.query(`DROP SCHEMA IF EXISTS ${SCRATCH} CASCADE`);
  await adminPool.query(`CREATE SCHEMA ${SCRATCH}`);
  // Every query the route handlers issue runs with the scratch schema FIRST on
  // the search_path, so any CREATE TABLE from ensure-schema lands in scratch,
  // never in public.
  scratchPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${SCRATCH},public`,
  });
});

after(async () => {
  if (adminPool) {
    await adminPool.query(`DROP SCHEMA IF EXISTS ${SCRATCH} CASCADE`).catch(() => {});
  }
  if (scratchPool) await scratchPool.end().catch(() => {});
  if (adminPool) await adminPool.end().catch(() => {});
});

/** to_regclass of a scratch-qualified relation → true when it exists. */
async function scratchTableExists(name: string): Promise<boolean> {
  const r = await adminPool!.query(`SELECT to_regclass($1) AS reg`, [`${SCRATCH}.${name}`]);
  return !!r.rows?.[0]?.reg;
}

/** Names of ALL tables the run created in the scratch schema whose name starts
 *  with `career_discovery` (the module's namespace) — so a NEW sibling table
 *  added by a future refactor is caught too, not just the one we know today. */
async function scratchCareerDiscoveryTables(): Promise<string[]> {
  const r = await adminPool!.query(
    `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_name LIKE 'career_discovery%'
       ORDER BY table_name`,
    [SCRATCH],
  );
  return r.rows.map((x: any) => String(x.table_name));
}

// ── Capture every registered route into a { "METHOD path": handlers[] } map ──
interface CapturedRoutes {
  routes: Map<string, any[]>;
  authCalls: () => number;
}

function captureAllRoutes(pool: Pool): CapturedRoutes {
  const routes = new Map<string, any[]>();
  let authCalls = 0;
  const record = (method: string) => (path: string, ...handlers: any[]) => {
    routes.set(`${method} ${path}`, handlers);
  };
  const fakeApp: any = { use: () => {}, get: record('GET'), post: record('POST') };
  const requireAuth = (req: any, _res: any, next: () => void) => {
    authCalls++;
    if (!req.user) req.user = { id: req._testUserId ?? 'off-check-user' };
    next();
  };
  registerCareerDiscoveryRoutes(fakeApp, pool, requireAuth);
  return { routes, authCalls: () => authCalls };
}

/** Drive a captured middleware chain like Express would, awaiting each layer. */
async function runChain(chain: any[], req: any): Promise<{ status: number; body: any }> {
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
    if (!nexted) break; // a layer ended the response (gate 503 / handler json)
  }
  return { status: statusCode, body: payload };
}

// The full gate-protected DATA surface of the module (the ungated /enabled probe
// is intentionally excluded — it never touches the DB). Each entry carries a
// minimal request shape so the handler body can run when the flag is ON.
const GATED_ROUTES: Array<{ key: string; req: any }> = [
  { key: 'GET /api/career-discovery/values/questions', req: {} },
  { key: 'GET /api/career-discovery/status', req: {} },
  { key: 'GET /api/career-discovery/battery', req: {} },
  { key: 'POST /api/career-discovery/values', req: { body: { responses: {} } } },
  { key: 'GET /api/career-discovery/profile', req: {} },
  { key: 'POST /api/career-discovery/complete', req: { body: { skip: true } } },
  { key: 'GET /api/career-discovery/explorer', req: { query: { limit: '12' } } },
  { key: 'GET /api/career-discovery/explorer/market', req: { query: { region: 'IN' } } },
  { key: 'POST /api/career-discovery/explorer/simulate', req: { body: { changes: [] } } },
  { key: 'GET /api/career-discovery/explorer/role/:roleId', req: { params: { roleId: 'r1' } } },
  { key: 'GET /api/career-discovery/guidance', req: {} },
];

// ── 1. Import + route registration alone create NO schema (real DB) ──────────
test('module import + route registration create no career_discovery_* table (flag OFF)', { skip: !HAS_DB && 'no DATABASE_URL' }, async () => {
  process.env.FF_CAREER_DISCOVERY = '0';
  // Registering the routes with the real scratch pool must not, by itself, run
  // any DDL (registration-time side effect guard).
  captureAllRoutes(scratchPool as unknown as Pool);
  const tables = await scratchCareerDiscoveryTables();
  assert.deepEqual(tables, [], 'no career_discovery_* table exists after import + registration');
});

// ── 2. Driving EVERY gated route with the flag OFF creates NO schema ─────────
test('flag OFF → every gated route 503s and creates no career_discovery_* table on a REAL db', { skip: !HAS_DB && 'no DATABASE_URL' }, async () => {
  process.env.FF_CAREER_DISCOVERY = '0';
  const { routes, authCalls } = captureAllRoutes(scratchPool as unknown as Pool);

  for (const { key, req } of GATED_ROUTES) {
    const chain = routes.get(key);
    assert.ok(chain, `route ${key} is registered`);
    const { status, body } = await runChain(chain!, { ...req, _testUserId: 'off-check-user' });
    assert.equal(status, 503, `${key} is 503ed by the flag gate when OFF`);
    assert.equal(body?.enabled, false, `${key} 503 envelope reports the flag is disabled`);
  }

  // The gate short-circuits BEFORE requireAuth on every route (no auth touch)…
  assert.equal(authCalls(), 0, 'requireAuth was never reached on any gated route when OFF');
  // …and — the crux of this task — the lazy ensure-schema NEVER ran against the
  // real database: the scratch schema has no career_discovery_* table.
  const tables = await scratchCareerDiscoveryTables();
  assert.deepEqual(tables, [], 'no career_discovery_* table created by any gated route when OFF');
  assert.equal(
    await scratchTableExists('career_discovery_results'),
    false,
    'career_discovery_results does NOT exist (to_regclass IS NULL) after the full OFF surface is exercised',
  );
});

// ── 3. Flag ON → the FIRST gated request creates the schema (teeth) ──────────
// If the OFF assertions above passed only because the scratch pool could not
// create tables at all, this would fail — proving the OFF result is meaningful.
test('flag ON → the first gated request creates career_discovery_results on the REAL db', { skip: !HAS_DB && 'no DATABASE_URL' }, async () => {
  // Precondition: still absent from the OFF phase.
  assert.equal(
    await scratchTableExists('career_discovery_results'),
    false,
    'precondition: no schema before the flag is turned ON',
  );

  process.env.FF_CAREER_DISCOVERY = '1';
  const { routes } = captureAllRoutes(scratchPool as unknown as Pool);

  // GET /status → readDiscoveryStatus → ensureCareerDiscoverySchema (CREATE
  // TABLE) then a SELECT (no INSERT, so no users FK row is required).
  const chain = routes.get('GET /api/career-discovery/status');
  assert.ok(chain, 'GET /status is registered');
  const { status, body } = await runChain(chain!, { _testUserId: 'off-check-user' });

  assert.equal(status, 200, 'a flag-ON /status request succeeds (passes the gate)');
  assert.equal(body?.ok, true);

  // The lazy ensure-schema ran: the table now exists in the scratch schema.
  assert.equal(
    await scratchTableExists('career_discovery_results'),
    true,
    'career_discovery_results exists (to_regclass NOT NULL) after the first gated request with the flag ON',
  );
  // And the accompanying index the ensure-schema declares was created too.
  const idx = await adminPool!.query(
    `SELECT to_regclass($1) AS reg`,
    [`${SCRATCH}.idx_cdr_status`],
  );
  assert.ok(idx.rows?.[0]?.reg, 'the ensure-schema status index was also created');
});
