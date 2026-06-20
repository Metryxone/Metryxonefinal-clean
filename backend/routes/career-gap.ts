/**
 * PHASE 4.4 — Career Gap routes (additive, flag-gated, super-admin).
 *
 * Exposes the additive, read-only Career Gap engine behind the `careerGap` flag
 * (env `FF_CAREER_GAP`, default OFF). Strictly additive: flag OFF => every route
 * returns 503 `feature_disabled` BEFORE any DB touch => byte-identical legacy
 * behaviour (no schema, no read, no write).
 *
 * The engine COMPOSES the already-built role readiness gaps (role-readiness-v2)
 * and the competency-TYPE classification (onto_competency_type_map) into the five
 * gap TYPES (Skill / Behavioral / Cognitive / Functional / Future Skill) — it
 * never recomputes a gap and never fabricates a TYPE assignment.
 *
 * Access control: `subject` is an OPERATOR-supplied identifier for any assessed
 * person (not the caller's identity), so every route is super-admin gated to
 * prevent IDOR — mirrors /api/career-readiness/* and /api/career-intelligence/*.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET  /api/career-gap/_meta/status                — lightweight flag probe
 *   GET  /api/career-gap/:subject/history            — append-only snapshot history (read-only)
 *   GET  /api/career-gap/:subject/dashboard          — UI-ready dashboard projection
 *   GET  /api/career-gap/:subject/prioritization     — deterministic gap prioritization
 *   POST /api/career-gap/:subject/snapshot           — capture an append-only snapshot
 *   GET  /api/career-gap/:subject                    — composed career-gap envelope
 *
 * GET is strictly read-only (NEVER triggers DDL — history uses a to_regclass
 * probe; the type-map read also probes). The ONLY write path is the explicit POST
 * snapshot, which lazily ensures the append-only history schema behind the flag gate.
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCareerGapEnabled } from '../config/feature-flags.js';
import {
  CAREER_GAP_VERSION,
  buildCareerGap,
  buildCareerGapDashboard,
  prioritizeCareerGaps,
  persistCareerGapSnapshot,
  listCareerGapHistory,
} from '../services/career-gap-engine.js';

export function registerCareerGapRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCareerGapEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'careerGap' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: CAREER_GAP_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[career-gap]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) ---------------------------
  // Literal path registered FIRST so the `/:subject` param handler can't swallow it.
  app.get(
    '/api/career-gap/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: CAREER_GAP_VERSION, enabled: true, flag: 'careerGap' });
    },
  );

  // ---- Append-only snapshot history (read-only, to_regclass probe) -----------
  // Registered BEFORE `/:subject` (literal-before-param).
  app.get(
    '/api/career-gap/:subject/history',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
      return listCareerGapHistory(pool, String(req.params.subject), Number.isFinite(limit) ? limit : 50);
    }),
  );

  // ---- Dashboard projection (read-only) -------------------------------------
  app.get(
    '/api/career-gap/:subject/dashboard',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const env = await buildCareerGap(pool, String(req.params.subject));
      return buildCareerGapDashboard(env);
    }),
  );

  // ---- Deterministic prioritization (read-only) -----------------------------
  app.get(
    '/api/career-gap/:subject/prioritization',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const env = await buildCareerGap(pool, String(req.params.subject));
      return prioritizeCareerGaps(env);
    }),
  );

  // ---- Capture an append-only snapshot (the ONLY write path) -----------------
  app.post(
    '/api/career-gap/:subject/snapshot',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const env = await buildCareerGap(pool, String(req.params.subject));
      const row = await persistCareerGapSnapshot(pool, env);
      return { snapshot: row, envelope: env };
    }),
  );

  // ---- Composed career-gap envelope (read-only) -----------------------------
  app.get(
    '/api/career-gap/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildCareerGap(pool, String(req.params.subject))),
  );
}
