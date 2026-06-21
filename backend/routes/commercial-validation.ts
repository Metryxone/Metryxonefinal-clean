/**
 * PHASE 6 — Commercial Platform Validation routes (additive, flag-gated, super-admin).
 *
 * Exposes the read-only commercial Validation harness behind the `commercialValidation`
 * flag (env `FF_COMMERCIAL_VALIDATION`, default OFF). Strictly additive: flag OFF =>
 * every route returns 503 `feature_disabled` BEFORE any DB touch => byte-identical legacy
 * behaviour (no schema, no read, no write).
 *
 * The engine COMPOSES the already-built pure read engines (revenue / recurring-revenue /
 * renewal / upsell / subscription-lifecycle / entitlement / enterprise-overview) and probes
 * the canonical comm_* / inv_* / rbac_* / gov_* / aig_* / anl_* / tenants / capadex_payments
 * tables. It asserts structural invariants across the EIGHT commercial subsystems and
 * performs NO new scoring.
 *
 * GET-never-writes: the harness runs ZERO DDL. Every table is probed with to_regclass
 * before being read; the composed engines are 0-DDL pure read composers. There is NO write
 * path and NO history table for this phase.
 *
 * Access control: super-admin gated to prevent IDOR (platform-wide report) — mirrors
 * /api/employer-validation/*, /api/career-validation/*.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET /api/commercial-validation/_meta/status — lightweight flag probe (no DB)
 *   GET /api/commercial-validation/catalog      — static subsystem catalog (no DB)
 *   GET /api/commercial-validation              — eight-subsystem honesty/invariant report (read-only)
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCommercialValidationEnabled } from '../config/feature-flags.js';
import {
  COMMERCIAL_PLATFORM_VALIDATION_VERSION,
  runCommercialPlatformValidation,
  commercialValidationCatalog,
} from '../services/commercial-platform-validation-engine.js';

export function registerCommercialValidationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCommercialValidationEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'commercialValidation' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: COMMERCIAL_PLATFORM_VALIDATION_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[commercial-validation]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) --------------------------
  // Literal paths registered FIRST so no param handler can swallow them.
  app.get(
    '/api/commercial-validation/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: COMMERCIAL_PLATFORM_VALIDATION_VERSION, enabled: true, flag: 'commercialValidation' });
    },
  );

  // ---- Static subsystem catalog (no DB touch) -------------------------------
  app.get(
    '/api/commercial-validation/catalog',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: COMMERCIAL_PLATFORM_VALIDATION_VERSION, data: commercialValidationCatalog() });
    },
  );

  // ---- Eight-subsystem honesty/invariant report (read-only) -----------------
  app.get(
    '/api/commercial-validation',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => runCommercialPlatformValidation(pool)),
  );
}
