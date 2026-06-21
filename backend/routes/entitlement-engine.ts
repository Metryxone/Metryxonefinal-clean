/**
 * Phase 6.4 — Entitlement Engine · `feature_control_engine` deliverable.
 *
 * Admin + self-service control surface for the per-module access system. Composes the
 * module-access resolver (`deriveModuleAccess` / `buildModuleAccessOverview`) and reuses the EXISTING
 * grant substrate (`comm_entitlement_grants`) for manual super-admin overrides. Introduces NO new
 * entitlement model; the only schema touched is the pre-existing grants table + the comm_features
 * registry seed, and ONLY on the explicit POST write paths.
 *
 * FLAG-GATED: when `moduleAccessControl` is OFF every route returns 503 `feature_disabled` BEFORE any
 * DB touch → byte-identical legacy (route exists but never reads / writes / DDLs). Distinct base
 * (`/api/entitlement/*`) from the legacy CAPADEX entitlement bridge (`routes/entitlement.ts`, which
 * owns `/api/entitlement/check` + `/api/admin/entitlement/*`) — no path collision.
 *
 * Routes:
 *   GET  /api/entitlement/modules                — module registry (catalog; read-only, no DB)
 *   GET  /api/entitlement/access                 — the caller's OWN module access (self; read-only)
 *   GET  /api/entitlement/admin/access/:email    — any identity's module access (admin; read-only)
 *   GET  /api/entitlement/admin/overview         — platform module-coverage overview (admin; read-only)
 *   POST /api/entitlement/admin/grant            — append a module grant (admin; write path)
 *   POST /api/entitlement/admin/revoke           — revoke an active module grant (admin; write path)
 *
 * GET-NEVER-WRITES: read handlers use to_regclass probes inside the resolver and NEVER create schema.
 * The idempotent registry seed + grants ensure-schema run ONLY on the POST handlers.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isModuleAccessControlEnabled } from '../config/feature-flags.js';
import {
  MODULE_REGISTRY,
  MODULE_CODES,
  isModuleCode,
  deriveModuleAccess,
  buildModuleAccessOverview,
  ensureModuleRegistry,
} from '../services/wc7c/module-access-engine.js';
import { ensureEntitlementGrantsSchema } from '../services/commercial/entitlement-grants-schema.js';

const VERSION = '6.4.0';

function principalEmail(req: Request): string | null {
  const raw = (req as any).user?.email;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

export function registerEntitlementEngineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isModuleAccessControlEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'moduleAccessControl' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) res.json({ ok: true, version: VERSION, data });
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[entitlement-engine]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ── GET /api/entitlement/modules — catalog (read-only, no DB) ─────────────────
  app.get(
    '/api/entitlement/modules',
    gate,
    requireAuth,
    wrap(async () => ({ modules: Object.values(MODULE_REGISTRY) })),
  );

  // ── GET /api/entitlement/access — the caller's OWN module access (self) ────────
  app.get(
    '/api/entitlement/access',
    gate,
    requireAuth,
    wrap(async (req) => deriveModuleAccess(pool, principalEmail(req))),
  );

  // ── GET /api/entitlement/admin/overview — platform coverage (admin) ───────────
  // Registered BEFORE the param route so the literal segment is not swallowed.
  app.get(
    '/api/entitlement/admin/overview',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => buildModuleAccessOverview(pool)),
  );

  // ── GET /api/entitlement/admin/access/:email — any identity (admin) ───────────
  app.get(
    '/api/entitlement/admin/access/:email',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const email = String(req.params.email || '').trim();
      if (!email) return { has_identity: false, modules: [], reason: 'no_email' };
      return deriveModuleAccess(pool, email);
    }),
  );

  // ── POST /api/entitlement/admin/grant — append a module grant (write path) ────
  app.post(
    '/api/entitlement/admin/grant',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const b = req.body ?? {};
      const email = String(b.email ?? '').trim();
      const moduleRaw = String(b.module ?? '').trim();
      const reason = typeof b.reason === 'string' && b.reason.trim() ? b.reason.trim().slice(0, 500) : null;
      if (!email) {
        res.status(400).json({ ok: false, error: 'email_required' });
        return undefined;
      }
      if (!isModuleCode(moduleRaw)) {
        res.status(400).json({ ok: false, error: 'invalid_module', valid_modules: MODULE_CODES });
        return undefined;
      }
      // Write path only: ensure the substrate + registry exist before inserting.
      await ensureEntitlementGrantsSchema(pool);
      await ensureModuleRegistry(pool);
      const grantedBy = principalEmail(req);
      const { rows } = await pool.query(
        `INSERT INTO comm_entitlement_grants (email, feature, status, reason, granted_by)
         VALUES ($1, $2, 'active', $3, $4)
         RETURNING id, email, feature, status, reason, granted_by, created_at`,
        [email, moduleRaw, reason, grantedBy],
      );
      return { grant: rows[0] };
    }),
  );

  // ── POST /api/entitlement/admin/revoke — revoke an active grant (write path) ──
  // Append-only model: we do not DELETE; we flip status='revoked' + stamp revoked_by/at.
  app.post(
    '/api/entitlement/admin/revoke',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const b = req.body ?? {};
      const grantId = typeof b.grantId === 'string' && b.grantId.trim() ? b.grantId.trim() : null;
      const email = String(b.email ?? '').trim();
      const moduleRaw = String(b.module ?? '').trim();
      await ensureEntitlementGrantsSchema(pool);
      const revokedBy = principalEmail(req);

      if (grantId) {
        const { rows } = await pool.query(
          `UPDATE comm_entitlement_grants
              SET status = 'revoked', revoked_by = $2, revoked_at = now(), updated_at = now()
            WHERE id = $1 AND status = 'active'
            RETURNING id, email, feature, status, revoked_by, revoked_at`,
          [grantId, revokedBy],
        );
        if (rows.length === 0) {
          res.status(404).json({ ok: false, error: 'grant_not_found_or_already_revoked' });
          return undefined;
        }
        return { revoked: rows.length, grants: rows };
      }

      // Fallback: revoke by (email, module) — all currently-active matching grants.
      if (!email || !isModuleCode(moduleRaw)) {
        res.status(400).json({ ok: false, error: 'grantId_or_email_and_module_required' });
        return undefined;
      }
      const { rows } = await pool.query(
        `UPDATE comm_entitlement_grants
            SET status = 'revoked', revoked_by = $3, revoked_at = now(), updated_at = now()
          WHERE lower(email) = lower($1) AND feature = $2 AND status = 'active'
          RETURNING id, email, feature, status, revoked_by, revoked_at`,
        [email, moduleRaw, revokedBy],
      );
      return { revoked: rows.length, grants: rows };
    }),
  );
}
