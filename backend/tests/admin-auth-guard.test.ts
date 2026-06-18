/**
 * Admin Auth-Guard Coverage — Integration Test
 *
 * Regression guard for the recurring "per-framework admin gap" (see
 * .agents/memory/per-framework-admin-gate-gap.md). The global
 * `app.use('/api/admin', requireAuth→requireSuperAdmin)` mount only covers the
 * literal `/api/admin/*` prefix. Admin endpoints living under per-framework
 * prefixes — `/api/lbi/admin`, `/api/sdi/admin`, `/api/competency/admin`
 * (+ admin-only bare `/api/competency/*` reads), `/api/commercial/admin`,
 * `/api/concerns/admin`, `/api/invoice/admin`, `/api/short-assessments/admin`
 * — are NOT covered by that gate and must each declare their own
 * `requireAuth, requireSuperAdmin` guards inline. A single forgotten guard on a
 * GET read silently leaks admin data (the `/api/competency/cohorts` class of
 * bug).
 *
 * This test mounts the real framework route modules onto a throwaway Express
 * app — passing reject-guards (mirroring the production `requireAuth` /
 * `requireSuperAdmin` semantics: reject when there is no authenticated
 * super-admin) and a stub pool that never touches a real database — then
 * enumerates every registered route under the in-scope admin prefixes and
 * asserts each returns 401/403 when called WITHOUT a super-admin session.
 *
 * If a future admin route forgets its inline guard, the reject-guards never
 * run for it, the request reaches the handler, and the response is NOT 401/403
 * → this test fails.
 *
 * The intentionally-public framework reads (used by the assessment flow, not an
 * admin page) are listed in PUBLIC_ALLOWLIST and excluded.
 *
 * Run with:  npx tsx backend/tests/admin-auth-guard.test.ts
 */

// ── Enable the flag-gated framework surfaces so their 503 feature-gates fall
//    through to the auth layer (we are testing auth, not the feature flag). ──
process.env.FF_INVOICE_GST_ENGINE = 'true';
process.env.FF_COMMERCIAL_CATALOG = 'true';
process.env.FF_COMMERCIAL_SUBSCRIPTIONS = 'true';
process.env.FF_COMMERCIAL_RAZORPAY_RECURRING = 'true';

import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';

import { registerSdiRoutes } from '../routes/sdi';
import { registerFrameworkParityRoutes } from '../routes/framework-parity';
import { registerCommercialSpineRoutes } from '../routes/commercial-spine';
import { registerInvoiceRoutes } from '../routes/invoice-engine';
import { registerShortAssessmentRoutes } from '../routes/short-assessments';
import { registerCompetencyCohortRoutes } from '../routes/competency-cohorts';

// ── Minimal test runner (matches the repo's other tsx test files) ──────────────
let passed = 0;
let failed = 0;
function test(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓  ${label}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗  ${label}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// ── Reject-guards: mirror the production requireAuth / requireSuperAdmin
//    semantics. With no authenticated user on the request they reject, exactly
//    as the real guards do for an unauthenticated caller. The route modules use
//    whatever guards are passed in, so a route that FORGETS to wire a guard
//    never invokes these and is caught below. ──────────────────────────────────
const requireAuth = (req: any, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  next();
};
const requireSuperAdmin = (req: any, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  const roles = req.user.roles || [];
  if (!roles.includes('super_admin') && req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Super admin access required' });
  }
  next();
};

// ── Stub pool: never connects to a real DB. Lazy ensure-schema (DDL) and any
//    handler that DID leak past a missing guard both resolve to empty results
//    rather than crashing — so a missing guard surfaces as a NON-401/403 status
//    (200 / 500), never as a connection error masquerading as "blocked". ──────
const stubPool: any = {
  query: async () => ({ rows: [], rowCount: 0 }),
  connect: async () => ({
    query: async () => ({ rows: [], rowCount: 0 }),
    release: () => {},
  }),
  end: async () => {},
};

// ── In-scope admin prefixes (NOT covered by the global /api/admin gate). ───────
const ADMIN_PREFIXES = [
  '/api/lbi/admin',
  '/api/sdi/admin',
  '/api/competency/admin',
  '/api/commercial/admin',
  '/api/concerns/admin',
  '/api/invoice/admin',
  '/api/short-assessments/admin',
];

// ── Admin-only reads that live OUTSIDE an `/admin` segment (so the prefix scan
//    alone would miss them) but are still super-admin only. ───────────────────
const ADMIN_NON_PREFIXED = new Set([
  '/api/competency/cohorts',
  '/api/competency/versions',
  '/api/competency/engine-summary',
  '/api/competency/items/:id',
  // Admin-only payment endpoints under /api/commercial/razorpay (outside an
  // `/admin` segment, so the prefix scan alone would miss them). Both carry the
  // `...admin` = [requireAuth, requireSuperAdmin] guards; a forgotten guard here
  // would expose plan-creation / refund admin actions.
  '/api/commercial/razorpay/plan',
  '/api/commercial/razorpay/refund',
]);

// ── Intentionally-public framework reads (assessment flow, not an admin page).
//    Documented here so they are explicitly EXCLUDED from the guard assertion. ─
const PUBLIC_ALLOWLIST = new Set([
  '/api/sdi/domains',
  '/api/sdi/subdomains',
  '/api/sdi/items',
  '/api/lbi/clusters',
  '/api/sdi/clusters',
  // Buyer-facing Razorpay routes — public by design, gated only by rzpGate (the
  // commercial_razorpay_recurring feature flag), NOT by a super-admin guard.
  '/api/commercial/razorpay/subscribe',
  '/api/commercial/razorpay/payment-link',
  '/api/commercial/razorpay/verify',
  '/api/commercial/razorpay/webhook',
]);

function isInScope(path: string): boolean {
  if (PUBLIC_ALLOWLIST.has(path)) return false;
  if (ADMIN_NON_PREFIXED.has(path)) return true;
  return ADMIN_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}

// ── Build the app + register the real framework route modules. ────────────────
function buildApp(): Express {
  const app = express();
  app.use(express.json());
  registerSdiRoutes(app, stubPool, requireAuth, requireSuperAdmin);
  registerFrameworkParityRoutes(app, stubPool, requireAuth, requireSuperAdmin);
  registerCommercialSpineRoutes(app, stubPool, requireAuth, requireSuperAdmin);
  registerInvoiceRoutes(app, stubPool, requireAuth, requireSuperAdmin);
  registerShortAssessmentRoutes(app, stubPool, requireAuth, requireSuperAdmin);
  registerCompetencyCohortRoutes(app, stubPool, requireAuth, requireSuperAdmin);
  return app;
}

interface RouteEntry { method: string; path: string; }

// ── Walk the Express router stack and collect every (method, path) route. ─────
function collectRoutes(app: Express): RouteEntry[] {
  const router: any = (app as any).router || (app as any)._router;
  assert.ok(router && Array.isArray(router.stack), 'could not access the Express router stack');
  const out: RouteEntry[] = [];
  for (const layer of router.stack) {
    const route = layer?.route;
    if (!route || !route.path) continue;
    const paths: string[] = Array.isArray(route.path) ? route.path : [route.path];
    const methods = Object.keys(route.methods || {}).filter((m) => m !== '_all');
    for (const path of paths) {
      for (const method of methods) out.push({ method: method.toUpperCase(), path });
    }
  }
  return out;
}

// ── Replace :params with concrete segments so the request actually matches. ───
function concretePath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '1');
}

async function request(server: Server, method: string, path: string): Promise<number> {
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: ['GET', 'HEAD'].includes(method) ? undefined : '{}',
  });
  // Drain the body so the socket can be reused/closed.
  await res.text().catch(() => undefined);
  return res.status;
}

async function main() {
  const app = buildApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const allRoutes = collectRoutes(app);
  const adminRoutes = allRoutes.filter((r) => isInScope(r.path));

  console.log('\nAdmin auth-guard coverage');

  // Sanity: we must actually find admin routes — an empty set would make every
  // assertion below vacuously pass and silently disable the regression guard.
  test(`enumerated admin routes is non-empty (found ${adminRoutes.length})`, () => {
    assert.ok(adminRoutes.length >= 30, `expected ≥30 in-scope admin routes, found ${adminRoutes.length}`);
  });

  // Sanity: each in-scope prefix must contribute at least one route, so a future
  // refactor that drops/renames a whole framework's routes is noticed.
  for (const prefix of ADMIN_PREFIXES) {
    test(`prefix has at least one route: ${prefix}`, () => {
      const n = adminRoutes.filter((r) => r.path === prefix || r.path.startsWith(prefix + '/')).length;
      assert.ok(n >= 1, `no routes enumerated under ${prefix}`);
    });
  }

  // The core assertion: every in-scope admin route rejects an unauthenticated
  // caller with 401 or 403.
  const leaks: string[] = [];
  for (const r of adminRoutes) {
    const status = await request(server, r.method, concretePath(r.path));
    const blocked = status === 401 || status === 403;
    test(`${r.method} ${r.path} → ${status} (blocked)`, () => {
      assert.ok(blocked, `expected 401/403, got ${status} — admin data may be exposed without a super-admin session`);
    });
    if (!blocked) leaks.push(`${r.method} ${r.path} → ${status}`);
  }

  // The public allowlist must remain registered (so this exclusion stays
  // meaningful) but is NOT asserted to be guarded — it is public by design.
  test('public allowlist routes are still registered (and excluded)', () => {
    for (const p of PUBLIC_ALLOWLIST) {
      const exists = allRoutes.some((r) => r.path === p);
      assert.ok(exists, `expected public read ${p} to be registered`);
    }
  });

  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (leaks.length) {
    console.error('\nUNGUARDED admin routes (no 401/403 without a super-admin session):');
    for (const l of leaks) console.error(`  • ${l}`);
  }
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
