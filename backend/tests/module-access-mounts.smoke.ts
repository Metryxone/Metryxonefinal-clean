/**
 * Phase 6.4 Module Access Control — REAL-SERVER mount smoke check.
 *
 * WHY THIS EXISTS (the gap module-access-control.test.ts does NOT close):
 *   module-access-control.test.ts verifies the gate MIDDLEWARE against a throwaway
 *   Express app that mounts only the 7 gates. That proves the middleware is correct,
 *   but NOT that the 7 gates are actually WIRED into the real running server the right
 *   way. In the live workspace/prod the flag is default OFF, so if a mount were
 *   missing, ordered after its protected handler, or pointed at the wrong prefix, no
 *   automated check would notice — a paid module could be silently exposed.
 *
 * WHAT THIS DOES:
 *   Boots the REAL server by calling the actual `registerRoutes(...)` from
 *   backend/routes.ts (the same registration production uses — including the gate
 *   mounts at ~L13924), with FF_MODULE_ACCESS_CONTROL turned ON, and drives it over
 *   HTTP. It confirms, end-to-end against real route registration and real data, that
 *   each of the 7 gated prefixes ENFORCES:
 *     • unauthenticated on a gated path        → 401 authentication_required (gate ran)
 *     • authenticated but NOT entitled         → 402 module_access_required (real DB)
 *     • entitled (paying) identity             → gate passes through
 *     • super-admin principal                  → gate bypasses
 *     • declared public sub-paths              → open even unauthenticated
 *   The returned `module` code on each verdict also proves the mount matched the RIGHT
 *   prefix (no over-match, e.g. /api/competency vs /api/competency-ei).
 *
 * HOW IDENTITY IS INJECTED (harness only — NOT production code):
 *   The real gate reads the server-side authenticated principal `req.user`. To exercise
 *   paying / non-paying / super-admin against the real mounts without a full login +
 *   MFA dance, this harness installs a tiny identity shim BEFORE registerRoutes that
 *   sets req.user from x-smoke-* request headers. Passport's session strategy leaves a
 *   pre-set req.user intact when no session cookie is present (verified), so the shim
 *   deterministically controls the principal the gates see. This shim lives ONLY in
 *   this smoke harness; index.ts / routes.ts are untouched, so production is unchanged.
 *
 * The paying identity is backed by REAL data: a temporary comm_entitlement_grants row
 * per module for a unique smoke email, cleaned up at the end.
 *
 * Run with:  npx tsx backend/tests/module-access-mounts.smoke.ts
 */

// ── Environment MUST be set before importing routes (flag + secrets read at import/boot) ──
process.env.FF_MODULE_ACCESS_CONTROL = 'true';
process.env.CSRF_PROTECTION_DISABLED = '1'; // harness uses GETs; keep the /api surface open
process.env.DB_PREWARM_DISABLED = '1';
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run the smoke harness with NODE_ENV=production.');
  process.exit(1);
}
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'module-access-smoke-secret';

import { createServer, type Server } from 'node:http';
import express, { type Request, type Response, type NextFunction } from 'express';
import pg from 'pg';

import { registerRoutes } from '../routes';
import { MODULE_CODES, MODULE_REGISTRY, type ModuleCode } from '../services/wc7c/module-access-engine';
import { ensureEntitlementGrantsSchema } from '../services/commercial/entitlement-grants-schema';

// ── Minimal test runner (matches the repo's other tsx test files). ────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? `  — ${detail}` : ''}`);
    failures.push(label);
    failed++;
  }
}

// ── The real mount contract (mirrors backend/routes.ts ~L13924). ──────────────
interface GateSpec {
  prefix: string;
  module: ModuleCode;
  /** Sample public sub-paths that must stay OPEN even unauthenticated. */
  publicSamples: string[];
}
const GATE_SPECS: GateSpec[] = [
  { prefix: '/api/competency', module: 'competency_assessments', publicSamples: ['/api/competency/questions/select'] },
  { prefix: '/api/competency-ei', module: 'employability_index', publicSamples: [] },
  { prefix: '/api/career/intelligence', module: 'career_builder', publicSamples: [] },
  { prefix: '/api/passport', module: 'career_passport', publicSamples: ['/api/passport/shared/smoketoken'] },
  {
    prefix: '/api/employer',
    module: 'employer_portal',
    publicSamples: ['/api/employer/public/jobs', '/api/employer/register'],
  },
  { prefix: '/api/analytics', module: 'analytics', publicSamples: [] },
  { prefix: '/api/workforce-intelligence', module: 'workforce_intelligence', publicSamples: [] },
];

// A non-public, definitely-not-a-real-endpoint probe path per prefix. The gate runs
// BEFORE any handler, so what matters is the gate verdict, not a real handler existing.
function gatedProbe(prefix: string): string {
  return `${prefix}/__module_access_smoke_probe__`;
}

const PAYING_EMAIL = `smoke-paying-${Date.now()}@example.com`;
const NON_PAYING_EMAIL = `smoke-nonpaying-${Date.now()}@example.com`;

// ── HTTP helper. ──────────────────────────────────────────────────────────────
type Identity = 'none' | 'superadmin' | { email: string };
async function request(
  server: Server,
  method: string,
  path: string,
  identity: Identity,
): Promise<{ status: number; body: any }> {
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (identity === 'superadmin') {
    headers['x-smoke-role'] = 'superadmin';
    headers['x-smoke-email'] = 'smoke-root@example.com';
  } else if (identity !== 'none') {
    headers['x-smoke-role'] = 'user';
    headers['x-smoke-email'] = identity.email;
  }
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers,
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

// True when the response is the GATE's own block (authentication_required / module_access_required).
function isGateBlock(status: number, body: any): boolean {
  if (status === 401 && body?.error === 'authentication_required') return true;
  if (status === 402 && body?.error === 'module_access_required') return true;
  return false;
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  // ── Seed a REAL paying identity: grant every module to PAYING_EMAIL. ─────────
  // The paying case is a REQUIRED part of the enforcement contract, so a seed
  // failure is FATAL by default — otherwise CI could silently drop the "entitled
  // identity passes the gate" check and give false confidence. A developer running
  // locally without a reachable DB can opt into an honest skip with
  // MODULE_ACCESS_SMOKE_ALLOW_SKIP=1 (never set in the validation workflow).
  const allowSkipPaying = /^(1|true|yes|on)$/i.test(String(process.env.MODULE_ACCESS_SMOKE_ALLOW_SKIP ?? ''));
  let payingSeeded = false;
  try {
    await ensureEntitlementGrantsSchema(pool);
    for (const m of MODULE_CODES) {
      await pool.query(
        `INSERT INTO comm_entitlement_grants (email, feature, status, reason, granted_by)
         VALUES ($1, $2, 'active', 'module-access mount smoke', 'smoke-harness')`,
        [PAYING_EMAIL, m],
      );
    }
    payingSeeded = true;
  } catch (e: any) {
    if (!allowSkipPaying) {
      console.error(
        `[smoke] FATAL: could not seed paying grants (${e?.message ?? e}). ` +
          `The paying-identity gate check is required. Re-run with MODULE_ACCESS_SMOKE_ALLOW_SKIP=1 ` +
          `only if you intentionally have no DB access.`,
      );
      await pool.end().catch(() => {});
      process.exit(1);
    }
    console.warn(`[smoke] could not seed paying grants (${e?.message ?? e}); paying scenario skipped (opt-in).`);
  }

  // ── Boot the REAL server with the identity shim in front of registerRoutes. ──
  const app = express();
  // Harness-only identity shim (NOT production). Runs before session/passport; the
  // session strategy leaves a pre-set req.user intact when no session cookie exists.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const role = req.headers['x-smoke-role'];
    const email = req.headers['x-smoke-email'];
    if (role === 'superadmin') {
      (req as any).user = {
        id: 'smoke-sa',
        email: typeof email === 'string' ? email : 'smoke-root@example.com',
        role: 'super_admin',
        roles: ['super_admin'],
      };
    } else if (role === 'user' && typeof email === 'string') {
      (req as any).user = { id: 'smoke-user', email, role: 'job_seeker', roles: ['job_seeker'] };
    }
    next();
  });

  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);

  const server = await new Promise<Server>((resolve) => {
    const s = httpServer.listen(0, () => resolve(s));
  });

  try {
    // ── Sanity: the mount contract still describes all 7 modules. ─────────────
    console.log('\nMount contract sanity');
    check(
      'GATE_SPECS covers all 7 module codes exactly once',
      JSON.stringify(GATE_SPECS.map((g) => g.module).sort()) === JSON.stringify([...MODULE_CODES].sort()),
    );
    for (const spec of GATE_SPECS) {
      check(
        `${spec.module} prefix matches registry route_prefix`,
        spec.prefix === MODULE_REGISTRY[spec.module].route_prefix,
        `spec=${spec.prefix} registry=${MODULE_REGISTRY[spec.module].route_prefix}`,
      );
    }

    // ── 1) Unauthenticated on a gated path → 401 authentication_required. ──────
    console.log('\nFlag ON — unauthenticated on a gated path → 401 (gate ran, right module)');
    for (const spec of GATE_SPECS) {
      const { status, body } = await request(server, 'GET', gatedProbe(spec.prefix), 'none');
      check(
        `unauth ${gatedProbe(spec.prefix)} → 401 authentication_required module=${spec.module}`,
        status === 401 && body?.error === 'authentication_required' && body?.module === spec.module,
        `got status=${status} body=${JSON.stringify(body)}`,
      );
    }

    // ── 2) Authenticated but NOT entitled → 402 module_access_required (real DB). ─
    console.log('\nFlag ON — authenticated non-entitled → 402 module_access_required (real data, right module)');
    for (const spec of GATE_SPECS) {
      const { status, body } = await request(server, 'GET', gatedProbe(spec.prefix), { email: NON_PAYING_EMAIL });
      check(
        `non-entitled ${gatedProbe(spec.prefix)} → 402 module_access_required module=${spec.module}`,
        status === 402 && body?.error === 'module_access_required' && body?.module === spec.module,
        `got status=${status} body=${JSON.stringify(body)}`,
      );
    }

    // ── 3) Paying (entitled) identity → gate passes through (real grant data). ──
    if (payingSeeded) {
      console.log('\nFlag ON — entitled paying identity → gate passes through (real grant data)');
      for (const spec of GATE_SPECS) {
        const { status, body } = await request(server, 'GET', gatedProbe(spec.prefix), { email: PAYING_EMAIL });
        check(
          `paying ${gatedProbe(spec.prefix)} → gate does NOT block`,
          !isGateBlock(status, body),
          `gate blocked: status=${status} body=${JSON.stringify(body)}`,
        );
      }
    } else {
      console.log('\nFlag ON — entitled paying identity → SKIPPED (grants table unavailable)');
    }

    // ── 4) Super-admin principal → gate bypasses every prefix. ────────────────
    console.log('\nFlag ON — super-admin bypasses every gate');
    for (const spec of GATE_SPECS) {
      const { status, body } = await request(server, 'GET', gatedProbe(spec.prefix), 'superadmin');
      check(
        `super-admin ${gatedProbe(spec.prefix)} → gate does NOT block`,
        !isGateBlock(status, body),
        `gate blocked: status=${status} body=${JSON.stringify(body)}`,
      );
    }

    // ── 5) Declared public sub-paths stay OPEN even unauthenticated. ──────────
    console.log('\nFlag ON — declared public sub-paths stay open (unauthenticated)');
    for (const spec of GATE_SPECS) {
      for (const p of spec.publicSamples) {
        const { status, body } = await request(server, 'GET', p, 'none');
        check(
          `public unauth ${p} → gate does NOT block`,
          !isGateBlock(status, body),
          `gate blocked: status=${status} body=${JSON.stringify(body)}`,
        );
      }
    }
  } finally {
    // ── Cleanup: remove the seeded paying grants + close resources. ───────────
    try {
      await pool.query(`DELETE FROM comm_entitlement_grants WHERE email = $1`, [PAYING_EMAIL]);
    } catch {
      /* table may not exist if seeding was skipped */
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end().catch(() => {});
  }

  // ── Summary. ────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  ${passed} passed   ${failed > 0 ? failed + ' FAILED' : 'all green'}`);
  if (failed > 0) console.log(`  failing: ${failures.join(', ')}`);
  console.log('');
  // The process holds open pools/servers from registerRoutes; exit explicitly.
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
