/**
 * PHASE 5.15 — Super Admin Validation routes (additive, flag-gated, super-admin).
 *
 * Exposes the read-only employer/talent Validation harness behind the
 * `employerValidation` flag (env `FF_EMPLOYER_VALIDATION`, default OFF). Strictly
 * additive: flag OFF => every route returns 503 `feature_disabled` BEFORE any DB
 * touch => byte-identical legacy behaviour (no schema, no read, no write).
 *
 * The engine COMPOSES already-recorded employer/talent data plus the two 0-DDL
 * pure engines (Notifications 5.14, Workforce 5.12) and asserts structural
 * invariants across fourteen areas. It performs NO new scoring.
 *
 * GET-never-writes: the harness runs ZERO DDL. Every table is probed with
 * to_regclass before being read; the only composed engines are 0-DDL pure read
 * composers. There is NO write path and NO history table for this phase.
 *
 * Access control: `employerId` is an OPERATOR-supplied identifier for any assessed
 * employer (not the caller's identity), so every route is super-admin gated to
 * prevent IDOR — mirrors /api/career-validation/*, /api/notifications/* etc.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET /api/employer-validation/_meta/status   — lightweight flag probe (no DB)
 *   GET /api/employer-validation/catalog        — static area catalog (no DB)
 *   GET /api/employer-validation/:employerId    — fourteen-area honesty/invariant report (read-only)
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isEmployerValidationEnabled } from '../config/feature-flags.js';
import {
  SUPER_ADMIN_EMPLOYER_VALIDATION_VERSION,
  runSuperAdminEmployerValidation,
  employerValidationCatalog,
} from '../services/super-admin-employer-validation-engine.js';

export function registerEmployerValidationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isEmployerValidationEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'employerValidation' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: SUPER_ADMIN_EMPLOYER_VALIDATION_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[employer-validation]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) --------------------------
  // Literal paths registered FIRST so the `/:employerId` param handler can't swallow them.
  app.get(
    '/api/employer-validation/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: SUPER_ADMIN_EMPLOYER_VALIDATION_VERSION, enabled: true, flag: 'employerValidation' });
    },
  );

  // ---- Static area catalog (no DB touch) ------------------------------------
  app.get(
    '/api/employer-validation/catalog',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: SUPER_ADMIN_EMPLOYER_VALIDATION_VERSION, data: employerValidationCatalog() });
    },
  );

  // ---- Fourteen-area honesty/invariant report (read-only) -------------------
  app.get(
    '/api/employer-validation/:employerId',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => runSuperAdminEmployerValidation(pool, String(req.params.employerId))),
  );
}
