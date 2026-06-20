/**
 * PHASE 4.5 — Career Roadmap routes (additive, flag-gated, super-admin).
 *
 * Exposes the additive, read-only Career Roadmap engine behind the `careerRoadmap`
 * flag (env `FF_CAREER_ROADMAP`, default OFF). Strictly additive: flag OFF => every
 * route returns 503 `feature_disabled` BEFORE any DB touch => byte-identical legacy
 * behaviour (no schema, no read, no write).
 *
 * The engine COMPOSES the already-built Career Gap engine (Phase 4.4 —
 * competencies required + now/next/later prioritization) and the Career Readiness
 * aggregator (Phase 4.3 — current/target readiness) into ONE Current → Target
 * roadmap: Milestones, Competencies Required, Development Plan, Estimated Timeline.
 * It never recomputes a score and never fabricates a milestone or a course.
 *
 * Access control: `subject` is an OPERATOR-supplied identifier for any assessed
 * person (not the caller's identity), so every route is super-admin gated to
 * prevent IDOR — mirrors /api/career-gap/* and /api/career-readiness/*.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET  /api/career-roadmap/_meta/status         — lightweight flag probe
 *   GET  /api/career-roadmap/:subject/history     — append-only snapshot history (read-only)
 *   GET  /api/career-roadmap/:subject/milestones  — milestones + development plan + timeline
 *   GET  /api/career-roadmap/:subject/progression — Current → Target progression view
 *   POST /api/career-roadmap/:subject/snapshot    — capture an append-only snapshot
 *   GET  /api/career-roadmap/:subject             — composed career-roadmap envelope
 *
 * GET is strictly read-only (NEVER triggers DDL — history uses a to_regclass probe;
 * the composed role-readiness path is gated by a competency-runtime probe). The
 * ONLY write path is the explicit POST snapshot, which lazily ensures the
 * append-only history schema behind the flag gate.
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCareerRoadmapEnabled } from '../config/feature-flags.js';
import {
  CAREER_ROADMAP_VERSION,
  buildCareerRoadmap,
  generateRoadmap,
  assessCareerProgression,
  persistCareerRoadmapSnapshot,
  listCareerRoadmapHistory,
} from '../services/career-roadmap-engine.js';
import { buildCareerGap, prioritizeCareerGaps } from '../services/career-gap-engine.js';

export function registerCareerRoadmapRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCareerRoadmapEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'careerRoadmap' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: CAREER_ROADMAP_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[career-roadmap]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) ---------------------------
  // Literal path registered FIRST so the `/:subject` param handler can't swallow it.
  app.get(
    '/api/career-roadmap/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: CAREER_ROADMAP_VERSION, enabled: true, flag: 'careerRoadmap' });
    },
  );

  // ---- Append-only snapshot history (read-only, to_regclass probe) -----------
  // Registered BEFORE `/:subject` (literal-before-param).
  app.get(
    '/api/career-roadmap/:subject/history',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
      return listCareerRoadmapHistory(pool, String(req.params.subject), Number.isFinite(limit) ? limit : 50);
    }),
  );

  // ---- Milestones + development plan + timeline (read-only) ------------------
  app.get(
    '/api/career-roadmap/:subject/milestones',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const gapEnv = await buildCareerGap(pool, String(req.params.subject));
      return generateRoadmap(gapEnv, prioritizeCareerGaps(gapEnv));
    }),
  );

  // ---- Current → Target progression view (read-only) ------------------------
  app.get(
    '/api/career-roadmap/:subject/progression',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const env = await buildCareerRoadmap(pool, String(req.params.subject));
      return env.progression;
    }),
  );

  // ---- Capture an append-only snapshot (the ONLY write path) -----------------
  app.post(
    '/api/career-roadmap/:subject/snapshot',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const env = await buildCareerRoadmap(pool, String(req.params.subject));
      const row = await persistCareerRoadmapSnapshot(pool, env);
      return { snapshot: row, envelope: env };
    }),
  );

  // ---- Composed career-roadmap envelope (read-only) -------------------------
  app.get(
    '/api/career-roadmap/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildCareerRoadmap(pool, String(req.params.subject))),
  );
}
