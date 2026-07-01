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
import { ensureArchitectureSchema } from '../services/commercial/architecture-schema.js';
import { z } from 'zod';
import { validate } from '../lib/validate.js';

const VERSION = '6.4.0';

// Mirrors the grant handler's hard-required fields (email non-empty + module).
// `email` is the grant identity key (lower(email) matched) → `.email()` hardening.
// `module` validity (isModuleCode) stays in the handler so its rich {valid_modules}
// error is preserved. The revoke handler is conditional (grantId OR email+module),
// so its body is intentionally left to the handler (not a fixed schema).
const grantBody = z.object({
  email: z.string().trim().email(),
  module: z.string().trim().min(1),
});

function principalEmail(req: Request): string | null {
  const raw = (req as any).user?.email;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

async function tableExists(pool: Pool, qualifiedName: string): Promise<boolean> {
  const { rows } = await pool.query<{ t: string | null }>('SELECT to_regclass($1) AS t', [qualifiedName]);
  return !!rows[0]?.t;
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
    validate({ body: grantBody }),
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

  // ── GET /api/entitlement/admin/plans — plans + their mapped module codes (admin) ──
  // Composes the EXISTING commercial catalog (comm_plans) with the plan→module rows in
  // comm_plan_entitlements (feature_code = module code). Read-only: probes the entitlement
  // table with to_regclass and degrades to "no modules mapped" when it hasn't been
  // provisioned yet (never fabricates, never DDLs on a GET).
  app.get(
    '/api/entitlement/admin/plans',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => {
      const havePlans = await tableExists(pool, 'comm_plans');
      if (!havePlans) return { plans: [], modules: Object.values(MODULE_REGISTRY) };
      const { rows: planRows } = await pool.query<{
        id: string; code: string; name: string; billing_interval: string;
        price_paise: number; currency: string; is_active: boolean; product_name: string | null;
      }>(
        `SELECT p.id, p.code, p.name, p.billing_interval, p.price_paise, p.currency, p.is_active,
                pr.name AS product_name
           FROM comm_plans p
           LEFT JOIN comm_products pr ON pr.id = p.product_id
          ORDER BY p.sort_order, p.name`,
      );

      // Map plan_id → module codes (module-scoped entitlement rows only).
      const moduleMap = new Map<string, string[]>();
      if (await tableExists(pool, 'comm_plan_entitlements')) {
        const { rows: entRows } = await pool.query<{ plan_id: string; feature_code: string }>(
          `SELECT plan_id, feature_code
             FROM comm_plan_entitlements
            WHERE feature_code = ANY($1::text[])`,
          [MODULE_CODES as unknown as string[]],
        );
        for (const r of entRows) {
          if (!isModuleCode(r.feature_code)) continue;
          const list = moduleMap.get(r.plan_id) ?? [];
          list.push(r.feature_code);
          moduleMap.set(r.plan_id, list);
        }
      }

      return {
        plans: planRows.map((p) => ({ ...p, modules: (moduleMap.get(p.id) ?? []).slice().sort() })),
        modules: Object.values(MODULE_REGISTRY),
      };
    }),
  );

  // ── POST /api/entitlement/admin/plan-modules — attach a module to a plan (write path) ──
  // Writes a comm_plan_entitlements row (feature_code = module code) so the plan's active
  // subscribers inherit the module via deriveModuleAccess. Idempotent (ON CONFLICT DO NOTHING).
  app.post(
    '/api/entitlement/admin/plan-modules',
    gate,
    requireAuth,
    requireSuperAdmin,
    validate({ body: z.object({ plan_id: z.string().trim().min(1), module: z.string().trim().min(1) }) }),
    wrap(async (req, res) => {
      const b = req.body ?? {};
      const planId = String(b.plan_id ?? '').trim();
      const moduleRaw = String(b.module ?? '').trim();
      if (!isModuleCode(moduleRaw)) {
        res.status(400).json({ ok: false, error: 'invalid_module', valid_modules: MODULE_CODES });
        return undefined;
      }
      // Write path: ensure the catalog schema (comm_plans/comm_features/comm_plan_entitlements)
      // and the module registry rows (FK target for feature_code) exist before inserting.
      await ensureArchitectureSchema(pool);
      await ensureModuleRegistry(pool);
      try {
        const { rows } = await pool.query(
          `INSERT INTO comm_plan_entitlements (plan_id, feature_code, quota, quota_period)
           VALUES ($1, $2, NULL, 'monthly')
           ON CONFLICT (plan_id, feature_code) DO NOTHING
           RETURNING id, plan_id, feature_code`,
          [planId, moduleRaw],
        );
        return { attached: rows.length, mapping: rows[0] ?? null, plan_id: planId, module: moduleRaw };
      } catch (e: any) {
        if (e?.code === '23503') {
          res.status(400).json({ ok: false, error: 'plan_not_found' });
          return undefined;
        }
        throw e;
      }
    }),
  );

  // ── POST /api/entitlement/admin/plan-modules/remove — detach a module from a plan ──
  // Deletes the plan→module entitlement row. Removing a plan mapping never touches per-email
  // manual grants (a distinct source), so a granted identity keeps its module access.
  app.post(
    '/api/entitlement/admin/plan-modules/remove',
    gate,
    requireAuth,
    requireSuperAdmin,
    validate({ body: z.object({ plan_id: z.string().trim().min(1), module: z.string().trim().min(1) }) }),
    wrap(async (req, res) => {
      const b = req.body ?? {};
      const planId = String(b.plan_id ?? '').trim();
      const moduleRaw = String(b.module ?? '').trim();
      if (!isModuleCode(moduleRaw)) {
        res.status(400).json({ ok: false, error: 'invalid_module', valid_modules: MODULE_CODES });
        return undefined;
      }
      await ensureArchitectureSchema(pool);
      const { rows } = await pool.query(
        `DELETE FROM comm_plan_entitlements
          WHERE plan_id = $1 AND feature_code = $2
          RETURNING id, plan_id, feature_code`,
        [planId, moduleRaw],
      );
      return { removed: rows.length, plan_id: planId, module: moduleRaw };
    }),
  );
}
