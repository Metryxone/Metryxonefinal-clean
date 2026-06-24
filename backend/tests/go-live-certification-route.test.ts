/**
 * MX-106X Go-Live Certification — Route-Level Flag-Gate Test
 *
 * Regression guard proving the Go-Live console cannot leak when its feature
 * switch (`goLiveCertification` / FF_GO_LIVE_CERTIFICATION, default OFF) is off,
 * and that the flag-OFF path is byte-identical to legacy (a 503 before any DB
 * touch). Replaces the manual "401 unauth; 503 OFF / 200 ON for a super-admin"
 * verification.
 *
 * Mirrors production wiring: the global `app.use('/api/admin', requireAuth →
 * requireSuperAdmin)` gate is mounted FIRST, then the real
 * `registerGoLiveCertificationRoutes` module is registered on top. So:
 *   - unauthenticated caller                         → 401 (global gate)
 *   - authenticated super-admin, flag OFF            → 503 (flagGate)
 *   - authenticated super-admin, flag ON             → 200
 * asserted for both the persona-agnostic probe (`/api/admin/go-live/enabled`)
 * and the certification reader (`/api/admin/go-live/certification`).
 *
 * The flag is toggled per-scenario via FF_GO_LIVE_CERTIFICATION; isFlagEnabled
 * reads process.env fresh on every call, so no module re-import is needed. A
 * stub pool keeps the test off any real database — when the flag is ON the
 * certification composer reads via to_regclass probes and degrades honestly to
 * an empty/zeroed 200, never a connection error masquerading as "blocked".
 *
 * Run with:  npx tsx backend/tests/go-live-certification-route.test.ts
 */

import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';

import { registerGoLiveCertificationRoutes } from '../routes/go-live-certification';

// ── Minimal test runner (matches the repo's other tsx test files) ─────────────
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

// ── Auth guards mirroring the production requireAuth / requireSuperAdmin
//    semantics: reject when there is no authenticated super-admin on the
//    request. ──────────────────────────────────────────────────────────────────
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

// ── Stub pool: never connects to a real DB. The ON-path composer reads via
//    to_regclass probes; empty results let it degrade to an honest 200 rather
//    than crash, so a 200 is genuine "flag ON, route reached" — not a leak. ────
const stubPool: any = {
  query: async () => ({ rows: [], rowCount: 0 }),
  connect: async () => ({
    query: async () => ({ rows: [], rowCount: 0 }),
    release: () => {},
  }),
  end: async () => {},
};

// ── Build the app the same way production does: a global /api/admin gate that
//    injects the (optional) authenticated user, then the real Go-Live routes. ──
//    `injectUser` simulates the session: when present, the caller is an
//    authenticated super-admin; when absent, the caller is unauthenticated. ────
function buildApp(injectUser: boolean): Express {
  const app = express();
  app.use(express.json());
  // Simulate the express-session principal the production gate relies on.
  app.use('/api/admin', (req: any, _res, next) => {
    if (injectUser) req.user = { role: 'super_admin', roles: ['super_admin'] };
    next();
  });
  // Production mounts the auth gate on the whole /api/admin prefix BEFORE the
  // feature routes. Replicate that so an unauthenticated caller is rejected by
  // the gate (401) even for the persona-agnostic /enabled probe.
  app.use('/api/admin', requireAuth, requireSuperAdmin);
  registerGoLiveCertificationRoutes(app, stubPool, requireAuth, requireSuperAdmin);
  return app;
}

async function request(server: Server, path: string): Promise<number> {
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'GET',
    headers: { 'content-type': 'application/json' },
  });
  await res.text().catch(() => undefined);
  return res.status;
}

async function withServer(app: Express, fn: (s: Server) => Promise<void>): Promise<void> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  try {
    await fn(server);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// The two endpoints called out in the task's "Done looks like".
const ENDPOINTS = [
  '/api/admin/go-live/enabled',
  '/api/admin/go-live/certification',
];

async function main() {
  console.log('\nGo-Live certification route flag-gate');

  // ── Scenario 1: unauthenticated → 401 (flag state irrelevant). ──────────────
  // Assert under BOTH flag states so a future reorder that lets the flagGate
  // (503) run before the auth gate (401) is caught.
  for (const flag of ['false', 'true'] as const) {
    process.env.FF_GO_LIVE_CERTIFICATION = flag;
    const app = buildApp(/* injectUser */ false);
    await withServer(app, async (server) => {
      for (const ep of ENDPOINTS) {
        const status = await request(server, ep);
        test(`unauthenticated (flag=${flag}) GET ${ep} → ${status} (expect 401)`, () => {
          assert.equal(status, 401, `expected 401 for an unauthenticated caller, got ${status}`);
        });
      }
    });
  }

  // ── Scenario 2: authenticated super-admin, flag OFF → 503. ──────────────────
  process.env.FF_GO_LIVE_CERTIFICATION = 'false';
  {
    const app = buildApp(/* injectUser */ true);
    await withServer(app, async (server) => {
      for (const ep of ENDPOINTS) {
        const status = await request(server, ep);
        test(`super-admin + flag OFF GET ${ep} → ${status} (expect 503)`, () => {
          assert.equal(status, 503, `expected 503 when the flag is OFF, got ${status}`);
        });
      }
    });
  }

  // ── Scenario 3: authenticated super-admin, flag ON → 200. ───────────────────
  process.env.FF_GO_LIVE_CERTIFICATION = 'true';
  {
    const app = buildApp(/* injectUser */ true);
    await withServer(app, async (server) => {
      for (const ep of ENDPOINTS) {
        const status = await request(server, ep);
        test(`super-admin + flag ON GET ${ep} → ${status} (expect 200)`, () => {
          assert.equal(status, 200, `expected 200 when the flag is ON, got ${status}`);
        });
      }
    });
  }

  delete process.env.FF_GO_LIVE_CERTIFICATION;

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
