/**
 * Phase 6.4 Module Access Control — Access-Control Regression Suite
 *
 * Permanent regression coverage for the per-module access gates (`moduleAccessControl` flag).
 * Replaces the removed one-off smoke script. Locks three contracts that must never silently
 * regress:
 *
 *   1. BYTE-IDENTICAL-OFF — with the flag OFF:
 *        • the `/api/entitlement/*` control surface returns 503 `feature_disabled` BEFORE
 *          auth or any DB touch (the gate runs first);
 *        • every one of the 7 gated route prefixes is a synchronous pass-through — the gate
 *          calls next() before any await, so an unauthenticated request reaches the legacy
 *          handler and the pool is NEVER queried.
 *
 *   2. MOUNT / PUBLIC-PATH EDGES — with the flag ON:
 *        • declared public sub-paths stay open even unauthenticated
 *          (/api/competency/questions/select, /api/passport/shared/:token,
 *           /api/employer/public/*, /api/employer/register);
 *        • the /api/competency mount does NOT over-match /api/competency-ei (segment-boundary
 *          matching — a request to competency-ei is gated by employability_index, never
 *          competency_assessments).
 *
 *   3. FAIL-CLOSED VERDICTS — the pure `evaluateModuleAccess` decision helper:
 *        • null / empty email                → 402 (no billing identity)
 *        • ledger read error on an EXISTING table → 503 (a fault is NOT "unentitled")
 *        • authenticated but no entitlement  → 402
 *        • module owned                      → allowed
 *      and the middleware `requireModuleAccess`:
 *        • super-admin principal             → bypass (next())
 *        • unauthenticated on a gated path   → 401
 *
 * Run with:  npx tsx backend/tests/module-access-control.test.ts
 */

import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';

import {
  requireModuleAccess,
  evaluateModuleAccess,
} from '../services/wc7c/require-module-access';
import { MODULE_REGISTRY, MODULE_CODES, type ModuleCode } from '../services/wc7c/module-access-engine';
import { registerEntitlementEngineRoutes } from '../routes/entitlement-engine';

// ── Minimal test runner (matches the repo's other tsx test files). ────────────
let passed = 0;
let failed = 0;
function test(label: string, fn: () => void | Promise<void>): Promise<void> {
  return (async () => {
    try {
      await fn();
      console.log(`  ✓  ${label}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗  ${label}`);
      console.error(`     ${err?.message ?? err}`);
      failed++;
    }
  })();
}

// ── The gate mount contract (mirrors backend/routes.ts ~L13924). Encoding it here
//    locks the mount prefixes + public allowlists as the regression surface. ────
interface GateSpec {
  prefix: string;
  module: ModuleCode;
  publicPaths?: string[];
}
const GATE_SPECS: GateSpec[] = [
  { prefix: '/api/competency', module: 'competency_assessments', publicPaths: ['/questions/select'] },
  { prefix: '/api/competency-ei', module: 'employability_index' },
  { prefix: '/api/career/intelligence', module: 'career_builder' },
  { prefix: '/api/passport', module: 'career_passport', publicPaths: ['/shared/'] },
  { prefix: '/api/employer', module: 'employer_portal', publicPaths: ['/public/', '/register'] },
  { prefix: '/api/analytics', module: 'analytics' },
  { prefix: '/api/workforce-intelligence', module: 'workforce_intelligence' },
];

const FLAG_ENV = 'FF_MODULE_ACCESS_CONTROL';
function setFlag(on: boolean): void {
  process.env[FLAG_ENV] = on ? 'true' : 'false';
}

// ── Pools ─────────────────────────────────────────────────────────────────────

// A pool that THROWS on any use — proves the flag-OFF path never touches the DB.
const throwingPool: any = {
  query: async () => {
    throw new Error('DB must not be queried');
  },
  connect: async () => {
    throw new Error('DB must not be connected');
  },
};

// A pool where every table EXISTS but the entitlement SELECTs fail — a ledger fault.
const ledgerFaultPool: any = {
  query: async (sql: string) => {
    if (/to_regclass/i.test(sql)) return { rows: [{ t: 'public.some_table' }], rowCount: 1 };
    throw new Error('simulated ledger read failure');
  },
};

// A pool where tables exist and the identity owns nothing (all SELECTs empty).
const unentitledPool: any = {
  query: async (sql: string) => {
    if (/to_regclass/i.test(sql)) return { rows: [{ t: 'public.some_table' }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  },
};

// A pool where the identity owns a specific module via a grant row.
function entitledPool(module: ModuleCode): any {
  return {
    query: async (sql: string) => {
      if (/to_regclass/i.test(sql)) return { rows: [{ t: 'public.some_table' }], rowCount: 1 };
      if (/comm_entitlement_grants/i.test(sql)) return { rows: [{ feature: module }], rowCount: 1 };
      return { rows: [], rowCount: 0 }; // plan source empty
    },
  };
}

// ── HTTP helper. ───────────────────────────────────────────────────────────────
async function request(
  server: Server,
  method: string,
  path: string,
): Promise<{ status: number; body: any }> {
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: ['GET', 'HEAD'].includes(method) ? undefined : '{}',
  });
  let body: any = null;
  const text = await res.text().catch(() => '');
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

// ── App builders ────────────────────────────────────────────────────────────

// Mount the 7 real gates exactly as production does, followed by a terminal handler
// per prefix that echoes which mount served the request. The `injectUser` factory
// lets each scenario control the authenticated principal.
function buildGatedApp(pool: any, injectUser: (req: Request) => void): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    injectUser(req);
    next();
  });
  for (const spec of GATE_SPECS) {
    app.use(spec.prefix, requireModuleAccess(pool, { module: spec.module, publicPaths: spec.publicPaths }));
  }
  // Terminal handlers — reached only when a gate calls next(). Echo the mount so we
  // can prove which gate matched (over-match detection).
  for (const spec of GATE_SPECS) {
    app.use(spec.prefix, (_req: Request, res: Response) => {
      res.status(200).json({ reached: true, prefix: spec.prefix, module: spec.module });
    });
  }
  return app;
}

// Reject-guards mirroring production requireAuth / requireSuperAdmin.
const rejectingAuth = (req: any, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  next();
};
const rejectingSuperAdmin = (req: any, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  const roles = req.user.roles || [];
  if (!roles.includes('super_admin') && req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Super admin access required' });
  }
  next();
};

async function withServer<T>(app: Express, fn: (server: Server) => Promise<T>): Promise<T> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  try {
    return await fn(server);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function main() {
  // ══════════════════════════════════════════════════════════════════════════
  // Suite 0 — Sanity: the mount contract still covers all 7 modules.
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\nMount contract sanity');
  await test('GATE_SPECS covers all 7 module codes exactly once', () => {
    const specModules = GATE_SPECS.map((g) => g.module).sort();
    assert.deepEqual(specModules, [...MODULE_CODES].sort());
    assert.equal(GATE_SPECS.length, MODULE_CODES.length);
  });
  await test('every gate prefix matches its module registry route_prefix', () => {
    for (const spec of GATE_SPECS) {
      assert.equal(
        spec.prefix,
        MODULE_REGISTRY[spec.module].route_prefix,
        `mount prefix drifted from registry for ${spec.module}`,
      );
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Suite 1 — Fail-closed verdicts (pure evaluateModuleAccess).
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\nFail-closed verdicts (evaluateModuleAccess)');

  await test('null email → 402 no_billing_identity (no DB touch)', async () => {
    const v = await evaluateModuleAccess(throwingPool, null, 'competency_assessments');
    assert.equal(v.allowed, false);
    if (!v.allowed) {
      assert.equal(v.status, 402);
      assert.equal(v.body.error, 'module_access_required');
      assert.equal(v.body.reason, 'no_billing_identity');
    }
  });

  await test('empty/whitespace email → 402 no_billing_identity', async () => {
    const v = await evaluateModuleAccess(throwingPool, '', 'analytics');
    assert.equal(v.allowed, false);
    if (!v.allowed) assert.equal(v.status, 402);
  });

  await test('ledger read error on an EXISTING table → 503 (fault ≠ unentitled)', async () => {
    const v = await evaluateModuleAccess(ledgerFaultPool, 'user@example.com', 'analytics');
    assert.equal(v.allowed, false);
    if (!v.allowed) {
      assert.equal(v.status, 503);
      assert.equal(v.body.error, 'module_access_unavailable');
    }
  });

  await test('authenticated but owns nothing → 402 no_entitlement', async () => {
    const v = await evaluateModuleAccess(unentitledPool, 'user@example.com', 'career_builder');
    assert.equal(v.allowed, false);
    if (!v.allowed) {
      assert.equal(v.status, 402);
      assert.equal(v.body.reason, 'no_entitlement');
    }
  });

  await test('module owned via grant → allowed', async () => {
    const v = await evaluateModuleAccess(entitledPool('career_builder'), 'user@example.com', 'career_builder');
    assert.equal(v.allowed, true);
  });

  await test('owning a DIFFERENT module does not entitle the requested one → 402', async () => {
    const v = await evaluateModuleAccess(entitledPool('analytics'), 'user@example.com', 'career_builder');
    assert.equal(v.allowed, false);
    if (!v.allowed) assert.equal(v.status, 402);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Suite 2 — Byte-identical OFF: gated prefixes are synchronous pass-throughs.
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\nByte-identical OFF — gated prefixes pass through (no DB touch)');
  setFlag(false);
  await withServer(
    buildGatedApp(throwingPool, () => {
      /* NO user — unauthenticated */
    }),
    async (server) => {
      for (const spec of GATE_SPECS) {
        const { status, body } = await request(server, 'GET', `${spec.prefix}/anything`);
        await test(`OFF: ${spec.prefix}/anything → 200 pass-through (unauth, throwing pool)`, () => {
          assert.equal(status, 200, `expected legacy pass-through, got ${status}`);
          assert.equal(body?.reached, true);
          assert.equal(body?.prefix, spec.prefix);
        });
      }
    },
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Suite 3 — Byte-identical OFF: /api/entitlement/* returns 503 before auth/DB.
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\nByte-identical OFF — /api/entitlement/* → 503 before auth/DB');
  setFlag(false);
  {
    const app = express();
    app.use(express.json());
    // Auth guards that would 401 if the gate did NOT run first — proves gate-before-auth.
    registerEntitlementEngineRoutes(app, throwingPool, rejectingAuth, rejectingSuperAdmin);
    await withServer(app, async (server) => {
      const ENTITLEMENT_ROUTES: Array<[string, string]> = [
        ['GET', '/api/entitlement/modules'],
        ['GET', '/api/entitlement/access'],
        ['GET', '/api/entitlement/admin/overview'],
        ['GET', '/api/entitlement/admin/access/someone@example.com'],
        ['POST', '/api/entitlement/admin/grant'],
        ['POST', '/api/entitlement/admin/revoke'],
      ];
      for (const [method, path] of ENTITLEMENT_ROUTES) {
        const { status, body } = await request(server, method, path);
        await test(`OFF: ${method} ${path} → 503 feature_disabled (before auth/DB)`, () => {
          assert.equal(status, 503, `expected 503, got ${status}`);
          assert.equal(body?.error, 'feature_disabled');
          assert.equal(body?.flag, 'moduleAccessControl');
        });
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Suite 4 — Flag ON: public-path allowlist stays open even unauthenticated.
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\nFlag ON — declared public sub-paths stay open (unauthenticated)');
  setFlag(true);
  await withServer(
    buildGatedApp(throwingPool, () => {
      /* NO user — public paths must still pass without any DB touch */
    }),
    async (server) => {
      const PUBLIC_CASES: Array<[string, string]> = [
        ['/api/competency/questions/select', '/api/competency'],
        ['/api/passport/shared/abc123token', '/api/passport'],
        ['/api/employer/public/jobs', '/api/employer'],
        ['/api/employer/register', '/api/employer'],
      ];
      for (const [path, prefix] of PUBLIC_CASES) {
        const { status, body } = await request(server, 'GET', path);
        await test(`ON: public ${path} → 200 open (unauth)`, () => {
          assert.equal(status, 200, `expected public pass-through, got ${status}`);
          assert.equal(body?.prefix, prefix);
        });
      }
    },
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Suite 5 — Flag ON: unauthenticated on a NON-public gated path → 401.
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\nFlag ON — unauthenticated on gated path → 401');
  setFlag(true);
  await withServer(
    buildGatedApp(throwingPool, () => {
      /* NO user */
    }),
    async (server) => {
      for (const spec of GATE_SPECS) {
        const { status, body } = await request(server, 'GET', `${spec.prefix}/private-resource`);
        await test(`ON: unauth ${spec.prefix}/private-resource → 401`, () => {
          assert.equal(status, 401, `expected 401, got ${status}`);
          assert.equal(body?.error, 'authentication_required');
        });
      }
    },
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Suite 6 — Flag ON: super-admin bypasses every gate (no DB touch).
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\nFlag ON — super-admin bypasses every gate');
  setFlag(true);
  await withServer(
    buildGatedApp(throwingPool, (req) => {
      (req as any).user = { email: 'root@example.com', roles: ['super_admin'] };
    }),
    async (server) => {
      for (const spec of GATE_SPECS) {
        const { status, body } = await request(server, 'GET', `${spec.prefix}/whatever`);
        await test(`ON: super-admin ${spec.prefix}/whatever → 200 bypass`, () => {
          assert.equal(status, 200, `expected super-admin bypass, got ${status}`);
          assert.equal(body?.reached, true);
        });
      }
    },
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Suite 7 — Flag ON: mount does NOT over-match — competency vs competency-ei.
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\nFlag ON — /api/competency does not over-match /api/competency-ei');
  setFlag(true);
  await withServer(
    buildGatedApp(unentitledPool, (req) => {
      // Authenticated non-super-admin with no entitlement → each gate returns 402
      // carrying the module code of the gate that actually matched.
      (req as any).user = { email: 'plain@example.com' };
    }),
    async (server) => {
      const ei = await request(server, 'GET', '/api/competency-ei/profile');
      await test('ON: /api/competency-ei/profile is gated by employability_index (not competency)', () => {
        assert.equal(ei.status, 402, `expected 402, got ${ei.status}`);
        assert.equal(
          ei.body?.module,
          'employability_index',
          `over-match! competency-ei was gated as ${ei.body?.module}`,
        );
      });

      const comp = await request(server, 'GET', '/api/competency/items/1');
      await test('ON: /api/competency/items/1 is gated by competency_assessments', () => {
        assert.equal(comp.status, 402, `expected 402, got ${comp.status}`);
        assert.equal(comp.body?.module, 'competency_assessments');
      });

      // Every gated (non-public) prefix returns 402 with its OWN module code.
      for (const spec of GATE_SPECS) {
        const { status, body } = await request(server, 'GET', `${spec.prefix}/gated-x`);
        await test(`ON: ${spec.prefix}/gated-x → 402 module=${spec.module}`, () => {
          assert.equal(status, 402, `expected 402, got ${status}`);
          assert.equal(body?.module, spec.module);
        });
      }
    },
  );

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(52)}`);
  console.log(`  ${passed} passed   ${failed > 0 ? failed + ' FAILED' : 'all green'}`);
  console.log('');
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
