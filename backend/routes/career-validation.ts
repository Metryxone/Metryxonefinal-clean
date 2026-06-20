/**
 * PHASE 4.12 — Super Admin Career Validation routes (additive, flag-gated, super-admin).
 *
 * Exposes the read-only Career Validation harness behind the `careerValidation`
 * flag (env `FF_CAREER_VALIDATION`, default OFF). Strictly additive: flag OFF =>
 * every route returns 503 `feature_disabled` BEFORE any DB touch => byte-identical
 * legacy behaviour (no schema, no read, no write).
 *
 * The engine COMPOSES every Phase-4.x career engine (Architecture / Matching /
 * Readiness / Gaps / Roadmaps / Development / Recommendations / Simulations /
 * Passport / Signals / Tracking) plus platform Audit-Log + Permission probes and
 * asserts structural invariants across thirteen areas. It performs NO new scoring.
 *
 * GET-never-writes: the harness runs zero DDL. Competency-runtime-composing engines
 * are gated behind competencyRuntimeReady() so a composed engine's lazy ensure-schema
 * never fires on a read; graph + history reads are pure SELECT. There is NO write
 * path and NO history table for this phase — it is a pure read-only harness.
 *
 * Access control: `subject` is an OPERATOR-supplied identifier for any assessed
 * person (not the caller's identity), so every route is super-admin gated to
 * prevent IDOR — mirrors /api/career-readiness/*, /api/career-signal/* etc.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET /api/career-validation/_meta/status   — lightweight flag probe (no DB)
 *   GET /api/career-validation/:subject        — thirteen-area honesty/invariant report (read-only)
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCareerValidationEnabled } from '../config/feature-flags.js';
import {
  SUPER_ADMIN_CAREER_VALIDATION_VERSION,
  runSuperAdminCareerValidation,
} from '../services/super-admin-career-validation-engine.js';

export function registerCareerValidationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCareerValidationEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'careerValidation' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: SUPER_ADMIN_CAREER_VALIDATION_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[career-validation]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) --------------------------
  // Literal path registered FIRST so the `/:subject` param handler can't swallow it.
  app.get(
    '/api/career-validation/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: SUPER_ADMIN_CAREER_VALIDATION_VERSION, enabled: true, flag: 'careerValidation' });
    },
  );

  // ---- Thirteen-area honesty/invariant report (read-only) -------------------
  app.get(
    '/api/career-validation/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => runSuperAdminCareerValidation(pool, String(req.params.subject))),
  );
}
