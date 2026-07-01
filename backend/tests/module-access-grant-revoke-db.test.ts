/**
 * Task #372 — Admin grant/revoke ACTUALLY changes what a user can access (ON-path, DB-backed).
 *
 * Task #16 locked the OFF-path (503 before auth/DB) for /api/entitlement/admin/grant and
 * /api/entitlement/admin/revoke. This suite locks the missing ON-path proof: with the
 * `moduleAccessControl` flag ON, driving the REAL grant/revoke handlers over HTTP against a
 * REAL database changes the resolver verdict end to end:
 *
 *   grant  → deriveModuleAccess / evaluateModuleAccess now returns ALLOWED (source = grant)
 *   revoke → access is REMOVED (evaluateModuleAccess → 402 no_entitlement)
 *
 * A regression in the write handlers (INSERT / status flip) or in the deriveModuleAccess join
 * (the `status='active'` + `expires_at` filter) would flip this test — so paid access can never
 * silently leak or silently vanish.
 *
 * Isolation contract (no prod pollution):
 *   - Runs ONLY against a purgeable @example.com identity with a unique per-run local part.
 *   - `after()` hard-DELETEs every comm_entitlement_grants row for that identity, so nothing
 *     survives even if an assertion throws mid-run.
 *   - Skips cleanly (no failure) when DATABASE_URL is absent.
 *
 * The flag env var is set BEFORE importing the routes/engine so the module-level flag read is ON.
 *
 * Run with:  cd backend && npx tsx --test tests/module-access-grant-revoke-db.test.ts
 */

process.env.FF_MODULE_ACCESS_CONTROL = '1'; // ON-path: the gate must let requests reach the DB writes

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import express, { type Request, type Response, type NextFunction } from 'express';
import { Pool } from 'pg';

import { registerEntitlementEngineRoutes } from '../routes/entitlement-engine';
import {
  deriveModuleAccess,
  type ModuleCode,
} from '../services/wc7c/module-access-engine';
import { evaluateModuleAccess } from '../services/wc7c/require-module-access';

const HAS_DB = !!process.env.DATABASE_URL;

// Purgeable identity + the module we grant/revoke. Unique local part so parallel runs / leftover
// rows never collide with this run.
const TEST_EMAIL = `mac-grant-revoke-${randomUUID().slice(0, 8)}@example.com`;
const TEST_MODULE: ModuleCode = 'career_builder';
const OTHER_MODULE: ModuleCode = 'analytics';
const SUPER_ADMIN = { email: 'root-372@example.com', roles: ['super_admin'] };

let pool: Pool | null = null;
let server: Server | null = null;
let baseUrl = '';

// Mount the REAL entitlement engine routes with an injected super-admin principal so the
// grant/revoke write handlers (which sit behind requireAuth + requireSuperAdmin) are exercised.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = SUPER_ADMIN;
    next();
  });
  const passAuth = (_req: Request, _res: Response, next: NextFunction) => next();
  registerEntitlementEngineRoutes(app, pool as unknown as Pool, passAuth, passAuth);
  return app;
}

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text().catch(() => '');
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

before(async () => {
  if (!HAS_DB) return;
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = buildApp();
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  // Hard-purge the test identity's grants regardless of pass/fail, then tear down.
  if (pool) {
    try {
      await pool.query(`DELETE FROM comm_entitlement_grants WHERE lower(email) = lower($1)`, [TEST_EMAIL]);
    } catch {
      /* table may not exist if the whole suite skipped — nothing to purge */
    }
  }
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (pool) await pool.end();
});

test('grant → access → revoke loop actually changes module access (DB-backed, flag ON)', async (t) => {
  if (!HAS_DB) {
    t.skip('DATABASE_URL not set — skipping DB-backed grant/revoke test');
    return;
  }
  const p = pool as Pool;

  // ── 0. Baseline — the fresh identity owns nothing. ──────────────────────────
  {
    const access = await deriveModuleAccess(p, TEST_EMAIL);
    assert.equal(access.degraded, false, 'baseline read must not be degraded');
    assert.equal(access.modules.includes(TEST_MODULE), false, 'identity must start with no module');
    const verdict = await evaluateModuleAccess(p, TEST_EMAIL, TEST_MODULE);
    assert.equal(verdict.allowed, false, 'baseline: access must be denied');
    if (!verdict.allowed) assert.equal(verdict.body.reason, 'no_entitlement');
  }

  // ── 1. GRANT via the real admin handler. ────────────────────────────────────
  let grantId: string;
  {
    const { status, body } = await api('POST', '/api/entitlement/admin/grant', {
      email: TEST_EMAIL,
      module: TEST_MODULE,
      reason: 'task-372 db test',
    });
    assert.equal(status, 200, `grant should succeed, got ${status}: ${JSON.stringify(body)}`);
    assert.equal(body?.ok, true);
    assert.equal(body?.data?.grant?.feature, TEST_MODULE);
    assert.equal(body?.data?.grant?.status, 'active');
    assert.equal(String(body?.data?.grant?.email).toLowerCase(), TEST_EMAIL.toLowerCase());
    grantId = String(body?.data?.grant?.id);
    assert.ok(grantId, 'grant must return an id');
  }

  // ── 2. Access is now ALLOWED, and it comes from the GRANT source. ────────────
  {
    const access = await deriveModuleAccess(p, TEST_EMAIL);
    assert.equal(access.degraded, false);
    assert.equal(access.modules.includes(TEST_MODULE), true, 'granted module must now be owned');
    assert.equal(access.sources.grants.includes(TEST_MODULE), true, 'ownership must come from the grant source');
    assert.equal(access.sources.plans.includes(TEST_MODULE), false, 'no plan should be involved');

    const verdict = await evaluateModuleAccess(p, TEST_EMAIL, TEST_MODULE);
    assert.equal(verdict.allowed, true, 'after grant, access must be allowed');

    // A DIFFERENT module the identity was never granted must stay denied (grant is scoped).
    const other = await evaluateModuleAccess(p, TEST_EMAIL, OTHER_MODULE);
    assert.equal(other.allowed, false, 'a non-granted module must stay denied');
  }

  // ── 3. REVOKE via the real admin handler (email + module path). ─────────────
  {
    const { status, body } = await api('POST', '/api/entitlement/admin/revoke', {
      email: TEST_EMAIL,
      module: TEST_MODULE,
    });
    assert.equal(status, 200, `revoke should succeed, got ${status}: ${JSON.stringify(body)}`);
    assert.equal(body?.ok, true);
    assert.equal(body?.data?.revoked, 1, 'exactly one active grant should have been revoked');
    assert.equal(body?.data?.grants?.[0]?.status, 'revoked');
  }

  // ── 4. Access is now REMOVED. ───────────────────────────────────────────────
  {
    const access = await deriveModuleAccess(p, TEST_EMAIL);
    assert.equal(access.degraded, false);
    assert.equal(access.modules.includes(TEST_MODULE), false, 'revoked module must no longer be owned');
    assert.equal(access.sources.grants.includes(TEST_MODULE), false, 'revoked grant must drop out of the grant source');

    const verdict = await evaluateModuleAccess(p, TEST_EMAIL, TEST_MODULE);
    assert.equal(verdict.allowed, false, 'after revoke, access must be denied again');
    if (!verdict.allowed) assert.equal(verdict.body.reason, 'no_entitlement');
  }

  // ── 5. Idempotent revoke — a second revoke finds nothing active to flip. ─────
  {
    const { status, body } = await api('POST', '/api/entitlement/admin/revoke', {
      email: TEST_EMAIL,
      module: TEST_MODULE,
    });
    assert.equal(status, 200, `second revoke should be a clean no-op, got ${status}`);
    assert.equal(body?.data?.revoked, 0, 'no active grant remains, so nothing is revoked');
  }
});

test('revoke-by-grantId path also removes access (DB-backed, flag ON)', async (t) => {
  if (!HAS_DB) {
    t.skip('DATABASE_URL not set — skipping DB-backed grantId revoke test');
    return;
  }
  const p = pool as Pool;

  // Grant, then revoke by the returned id (the alternate revoke branch).
  const grant = await api('POST', '/api/entitlement/admin/grant', {
    email: TEST_EMAIL,
    module: OTHER_MODULE,
    reason: 'task-372 grantId path',
  });
  assert.equal(grant.status, 200);
  const grantId = String(grant.body?.data?.grant?.id);
  assert.ok(grantId);

  let access = await deriveModuleAccess(p, TEST_EMAIL);
  assert.equal(access.modules.includes(OTHER_MODULE), true, 'grant must take effect');

  const revoke = await api('POST', '/api/entitlement/admin/revoke', { grantId });
  assert.equal(revoke.status, 200);
  assert.equal(revoke.body?.data?.revoked, 1);
  assert.equal(revoke.body?.data?.grants?.[0]?.id, grantId);

  access = await deriveModuleAccess(p, TEST_EMAIL);
  assert.equal(access.modules.includes(OTHER_MODULE), false, 'revoke-by-id must remove access');

  // Revoking a non-existent / already-revoked grant id → honest 404.
  const again = await api('POST', '/api/entitlement/admin/revoke', { grantId });
  assert.equal(again.status, 404, 'already-revoked grant id → 404');
  assert.equal(again.body?.error, 'grant_not_found_or_already_revoked');
});
