/**
 * Phase 6.4 — Entitlement Engine · `access_control_engine` deliverable.
 *
 * Per-module access-control middleware. Converts the module-ownership resolver
 * (`deriveModuleAccess`) into route ENFORCEMENT for the 7 product surfaces. Introduces NO new
 * entitlement model and NO schema — it only GATES using already-derived module access.
 *
 * DESIGN (approved decision: individual-level keying by authenticated email; super-admins bypass):
 *  • FLAG-FIRST + SYNCHRONOUS — the very first statement is the flag check; OFF → `next()` BEFORE any
 *    `await` → byte-identical legacy behaviour at every protected surface. (Express 4 has no async
 *    auto-catch, so everything after the flag check is wrapped in try/catch ending in a response or
 *    `next()`.)
 *  • SUPER-ADMIN BYPASS — a super_admin principal always passes (operates the platform; never billed).
 *  • PUBLIC ALLOWLIST — declared public sub-paths (e.g. competency question selection, passport shared
 *    links) pass through even when unauthenticated — they are intentionally open surfaces.
 *  • SERVER-SIDE IDENTITY — billing identity is read from the authenticated principal
 *    (`req.user.email`), NEVER a client-supplied `?email=` / body email (that would be the bypass).
 *  • FAIL-CLOSED on infrastructure, OPEN on "nothing to protect":
 *      unauthenticated (no principal)   → 401 (the surfaces all sit behind auth already; an
 *                                              unauthenticated request to a gated module is rejected,
 *                                              never silently entitled)
 *      no billing email on principal    → 402 `module_access_required` (no identity to entitle)
 *      ledger degraded / lookup error   → 503 `module_access_unavailable` (a fault is NOT "unentitled")
 *      module owned                     → next()
 *      module not owned                 → 402 `module_access_required`
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { deriveModuleAccess, type ModuleCode } from './module-access-engine';
import { isModuleAccessControlEnabled } from '../../config/feature-flags';

export interface RequireModuleAccessOptions {
  /** Module being protected by this gate. */
  module: ModuleCode;
  /** Sub-paths (relative to the mount prefix) that stay public — exact match OR prefix match when
   *  the entry ends in '/'. Compared against `req.path` after the Express mount strips the prefix. */
  publicPaths?: string[];
}

function isSuperAdmin(req: Request): boolean {
  const u = (req as any).user;
  if (!u) return false;
  const roles: unknown = u.roles;
  if (Array.isArray(roles) && roles.includes('super_admin')) return true;
  return u.role === 'super_admin';
}

function principalEmail(req: Request): string | null {
  const raw = (req as any).user?.email;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function isPublic(path: string, publicPaths: string[] | undefined): boolean {
  if (!publicPaths || publicPaths.length === 0) return false;
  for (const p of publicPaths) {
    if (p.endsWith('/')) {
      if (path === p.slice(0, -1) || path.startsWith(p)) return true;
    } else if (path === p) {
      return true;
    }
  }
  return false;
}

/**
 * Pure decision helper. The CALLER owns the flag check + identity extraction so it can be unit-tested
 * and reused. Identity must be SERVER-derived (the authenticated principal), never client-asserted.
 *
 *   email null/empty   → 402 (no billing identity; fail closed)
 *   ledger degraded    → 503 (a ledger fault is NOT "unentitled")
 *   module owned       → allowed
 *   module not owned   → 402
 */
export async function evaluateModuleAccess(
  pool: Pool,
  email: string | null,
  module: ModuleCode,
): Promise<{ allowed: true } | { allowed: false; status: 402 | 503; body: Record<string, unknown> }> {
  if (!email) {
    return {
      allowed: false,
      status: 402,
      body: { error: 'module_access_required', module, reason: 'no_billing_identity' },
    };
  }
  const access = await deriveModuleAccess(pool, email);
  if (access.degraded) {
    return { allowed: false, status: 503, body: { error: 'module_access_unavailable', reason: access.reason } };
  }
  if (access.modules.includes(module)) return { allowed: true };
  return {
    allowed: false,
    status: 402,
    body: { error: 'module_access_required', module, reason: 'no_entitlement' },
  };
}

/**
 * Build an Express middleware enforcing ownership of a product MODULE on the authenticated principal.
 * FLAG-FIRST + SYNCHRONOUS: when the flag is OFF the returned handler is a synchronous pass-through.
 */
export function requireModuleAccess(pool: Pool, opts: RequireModuleAccessOptions): RequestHandler {
  const { module, publicPaths } = opts;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // FLAG-FIRST, SYNCHRONOUS: OFF → byte-identical pass-through (no await executes before this).
    if (!isModuleAccessControlEnabled()) return next();

    try {
      // Declared public surfaces stay open (intentionally unauthenticated endpoints).
      if (isPublic(req.path, publicPaths)) return next();

      // Super-admins operate the platform — always bypass (never billed).
      if (isSuperAdmin(req)) return next();

      // An unauthenticated request to a gated module is rejected, never silently entitled.
      if (!(req as any).user) {
        res.status(401).json({ error: 'authentication_required', module });
        return;
      }

      const email = principalEmail(req);
      const verdict = await evaluateModuleAccess(pool, email, module);
      if (verdict.allowed) return next();
      res.status(verdict.status).json(verdict.body);
    } catch (err) {
      // Lookup / unexpected failure → fail closed (do NOT next() into the protected handler).
      // eslint-disable-next-line no-console
      console.warn(
        '[require-module-access] gate failed closed:',
        err instanceof Error ? err.message : String(err),
      );
      if (!res.headersSent) {
        res.status(503).json({ error: 'module_access_unavailable', reason: 'gate_error' });
      }
    }
  };
}
