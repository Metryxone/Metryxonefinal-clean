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
