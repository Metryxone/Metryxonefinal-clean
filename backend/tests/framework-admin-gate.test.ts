/**
 * Structural per-framework admin gate — Integration Test
 *
 * Companion to admin-auth-guard.test.ts. That test proves each framework admin
 * route currently carries its inline guards. THIS test proves the *structural*
 * mount gate (routes.ts STEP 11b, classifier in lib/admin-path-gate.ts) blocks
 * even a route that FORGOT its inline guards — the exact "a new sub-route that
 * forgets the guard ships public" failure mode.
 *
 * It reconstructs the production mount gate over a throwaway app, registers
 * deliberately GUARD-LESS canary routes under every in-scope admin path, and
 * asserts they return 401 without a super-admin session. It also asserts that
 * intentionally-public and non-admin paths pass straight through (200).
 *
 * Run with:  npx tsx backend/tests/framework-admin-gate.test.ts
 */

import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import express, { type Express, type Response, type NextFunction } from 'express';

import {
  isFrameworkAdminPath,
  FRAMEWORK_ADMIN_PREFIXES,
  FRAMEWORK_ADMIN_EXACT,
  FRAMEWORK_ADMIN_PUBLIC_EXEMPT,
} from '../lib/admin-path-gate';

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

// ── Production-equivalent guards: reject when there is no super-admin user. ────
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

// ── Build an app whose ONLY protection is the structural mount gate. Canary
//    routes carry NO inline guards, mirroring a developer who forgot them. ─────
function buildApp(): Express {
  const app = express();
  app.use(express.json());

  // The production STEP 11b mount gate, reconstructed verbatim.
  app.use('/api', (req: any, res: any, next: any) => {
    if (!isFrameworkAdminPath(req.path)) return next();
    requireAuth(req, res, () => requireSuperAdmin(req, res, next));
  });

  const ok = (_req: any, res: Response) => res.status(200).json({ ok: true });

  // GUARD-LESS canary admin routes — one per prefix and per exact path.
  for (const pre of FRAMEWORK_ADMIN_PREFIXES) {
    app.get(`/api${pre}/canary-forgot-guard`, ok);
    app.post(`/api${pre}/canary-forgot-guard`, ok);
  }
  for (const exact of FRAMEWORK_ADMIN_EXACT) app.get(`/api${exact}`, ok);
  app.patch('/api/competency/items/:id', ok); // prefix-path family

  // Public-exempt + non-admin canaries (must pass through unguarded).
  for (const pub of FRAMEWORK_ADMIN_PUBLIC_EXEMPT) app.get(`/api${pub}`, ok);
  app.get('/api/lbi/clusters/extra', ok); // non-admin nested under a framework
  app.get('/api/career/profile', ok);     // unrelated public route

  return app;
}

async function request(server: Server, method: string, path: string): Promise<number> {
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: ['GET', 'HEAD'].includes(method) ? undefined : '{}',
  });
  await res.text().catch(() => undefined);
  return res.status;
}

async function main() {
  console.log('\nStructural per-framework admin gate');

  // ── Unit coverage of the shared classifier. ────────────────────────────────
  test('classifier blocks every framework /admin prefix', () => {
    for (const pre of FRAMEWORK_ADMIN_PREFIXES) {
      assert.ok(isFrameworkAdminPath(`${pre}/anything`), `${pre} not classified admin`);
      assert.ok(isFrameworkAdminPath(pre), `${pre} (exact) not classified admin`);
    }
  });
  test('classifier blocks non-prefixed admin exact paths', () => {
    for (const exact of FRAMEWORK_ADMIN_EXACT) {
      assert.ok(isFrameworkAdminPath(exact), `${exact} not classified admin`);
    }
  });
  test('classifier blocks /competency/items/:id but NOT bare /competency/items', () => {
    assert.ok(isFrameworkAdminPath('/competency/items/42'));
    assert.ok(!isFrameworkAdminPath('/competency/items'));
  });
  test('classifier exempts intentionally-public reads', () => {
    for (const pub of FRAMEWORK_ADMIN_PUBLIC_EXEMPT) {
      assert.ok(!isFrameworkAdminPath(pub), `${pub} should be public`);
    }
  });
  test('classifier ignores unrelated paths', () => {
    assert.ok(!isFrameworkAdminPath('/career/profile'));
    assert.ok(!isFrameworkAdminPath('/sdi/domains'));
    assert.ok(!isFrameworkAdminPath('/'));
  });
  test('classifier is case-insensitive (Express routing is too)', () => {
    // Express matches /api/LBI/admin/foo to a lowercase-registered route, so a
    // mixed-case URL must NOT evade the gate.
    assert.ok(isFrameworkAdminPath('/LBI/admin/foo'));
    assert.ok(isFrameworkAdminPath('/Competency/Admin/Anything'));
    assert.ok(isFrameworkAdminPath('/Competency/Items/42'));
    assert.ok(isFrameworkAdminPath('/COMMERCIAL/RAZORPAY/REFUND'));
    // ...but a mixed-case public read stays public.
    assert.ok(!isFrameworkAdminPath('/SDI/Domains'));
  });

  // ── Integration: the mount gate blocks guard-less admin canaries. ──────────
  const app = buildApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const leaks: string[] = [];
  for (const pre of FRAMEWORK_ADMIN_PREFIXES) {
    for (const method of ['GET', 'POST']) {
      const path = `/api${pre}/canary-forgot-guard`;
      const status = await request(server, method, path);
      const blocked = status === 401 || status === 403;
      test(`guard-less ${method} ${path} → ${status} (blocked by mount gate)`, () => {
        assert.ok(blocked, `expected 401/403, got ${status} — structural gate did not catch a guard-less admin route`);
      });
      if (!blocked) leaks.push(`${method} ${path} → ${status}`);
    }
  }
  for (const exact of FRAMEWORK_ADMIN_EXACT) {
    const path = `/api${exact}`;
    const status = await request(server, 'GET', path);
    test(`guard-less GET ${path} → ${status} (blocked)`, () => {
      assert.ok(status === 401 || status === 403, `expected 401/403, got ${status}`);
    });
    if (!(status === 401 || status === 403)) leaks.push(`GET ${path} → ${status}`);
  }
  {
    const status = await request(server, 'PATCH', '/api/competency/items/7');
    test(`guard-less PATCH /api/competency/items/:id → ${status} (blocked)`, () => {
      assert.ok(status === 401 || status === 403, `expected 401/403, got ${status}`);
    });
  }

  // Public-exempt + non-admin canaries must pass straight through (200).
  for (const pub of FRAMEWORK_ADMIN_PUBLIC_EXEMPT) {
    const path = `/api${pub}`;
    const status = await request(server, 'GET', path);
    test(`public ${path} → ${status} (passes through)`, () => {
      assert.equal(status, 200, `expected 200 for public read, got ${status}`);
    });
  }
  for (const path of ['/api/lbi/clusters/extra', '/api/career/profile']) {
    const status = await request(server, 'GET', path);
    test(`non-admin ${path} → ${status} (passes through)`, () => {
      assert.equal(status, 200, `expected 200 for non-admin route, got ${status}`);
    });
  }

  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (leaks.length) {
    console.error('\nUNGUARDED admin canaries (structural gate failed to block):');
    for (const l of leaks) console.error(`  • ${l}`);
  }
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
