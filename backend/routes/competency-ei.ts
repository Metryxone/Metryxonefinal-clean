/**
 * Phase 3 — Competency Employability Intelligence (CEI) routes.
 *
 * Exposes the competency-anchored Employability Intelligence engine behind the
 * `competencyEi` flag (env `FF_COMPETENCY_EI`, default OFF). Strictly additive:
 * flag OFF => every route returns 503 `feature_disabled` BEFORE any DB touch =>
 * byte-identical legacy behaviour (no schema, no read, no write).
 *
 * COMPOSES the Phase 2 competency-runtime outputs (never recomputes scores,
 * never fabricates). DISTINCT from the legacy profile-based /api/ei/* engine.
 *
 * Access control: `subject` is an OPERATOR-supplied identifier for any assessed
 * person (not the caller's identity), so every route is super-admin gated to
 * prevent IDOR — mirrors /api/competency-runtime/*.
 *
 * Routes (all requireAuth + requireSuperAdmin):
 *   GET  /api/competency-ei/intelligence/:subject          — compute (read-only)
 *   POST /api/competency-ei/intelligence/:subject/snapshot — compute + append snapshot
 *   GET  /api/competency-ei/intelligence/:subject/history  — snapshot history
 *   GET  /api/competency-ei/validation/:subject            — chain validation
 *   GET  /api/competency-ei/admin/overview                 — platform overview
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCompetencyEiEnabled } from '../config/feature-flags.js';
import {
  COMPETENCY_EI_VERSION,
  computeEmployabilityIntelligence,
  persistEmployabilitySnapshot,
  listSnapshotHistory,
  computeEiValidation,
  computeAdminOverview,
} from '../services/competency-employability-engine.js';

export function registerCompetencyEiRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCompetencyEiEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'competencyEi' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: COMPETENCY_EI_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[competency-ei]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Compute (read-only) ---------------------------------------------------
  // Literal sub-paths (/snapshot, /history) are registered as distinct routes;
  // both carry an extra segment so they never collide with the param route.
  app.get(
    '/api/competency-ei/intelligence/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => computeEmployabilityIntelligence(pool, String(req.params.subject))),
  );

  // ---- Compute + append snapshot (explicit write path) -----------------------
  app.post(
    '/api/competency-ei/intelligence/:subject/snapshot',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => persistEmployabilitySnapshot(pool, String(req.params.subject))),
  );

  // ---- Snapshot history ------------------------------------------------------
  app.get(
    '/api/competency-ei/intelligence/:subject/history',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => listSnapshotHistory(pool, String(req.params.subject))),
  );

  // ---- Chain validation ------------------------------------------------------
  app.get(
    '/api/competency-ei/validation/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => computeEiValidation(pool, String(req.params.subject))),
  );

  // ---- Admin overview --------------------------------------------------------
  app.get(
    '/api/competency-ei/admin/overview',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => computeAdminOverview(pool)),
  );
}
