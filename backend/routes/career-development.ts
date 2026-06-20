/**
 * PHASE 4.6 — Career Development routes (additive, flag-gated, super-admin).
 *
 * Exposes the additive, read-only Career Development engine behind the
 * `careerDevelopment` flag (env `FF_CAREER_DEVELOPMENT`, default OFF). Strictly
 * additive: flag OFF => every route returns 503 `feature_disabled` BEFORE any DB
 * touch => byte-identical legacy behaviour (no schema, no read, no write).
 *
 * The engine COMPOSES the already-built Career Roadmap engine (Phase 4.5 → 4.4
 * gaps → 4.3 readiness) into PERSONALIZED DEVELOPMENT PLANS organized into
 * development STREAMS by competency TYPE (Behavioral / Technical / Cognitive /
 * Functional / Future Skills Development) plus longitudinal development TRACKING.
 * It never recomputes a score and never fabricates a development action. The
 * platform ontology has no standalone "Leadership" TYPE, so leadership
 * development is represented through the behavioral/cognitive/functional streams
 * (see `taxonomy_note`).
 *
 * Access control: `subject` is an OPERATOR-supplied identifier for any assessed
 * person (not the caller's identity), so every route is super-admin gated to
 * prevent IDOR — mirrors /api/career-roadmap/* and /api/career-gap/*.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET  /api/career-development/_meta/status      — lightweight flag probe
 *   GET  /api/career-development/:subject/history   — append-only snapshot history (read-only)
 *   GET  /api/career-development/:subject/streams    — development streams + plan
 *   GET  /api/career-development/:subject/tracking   — longitudinal development tracking
 *   POST /api/career-development/:subject/snapshot   — capture an append-only snapshot
 *   GET  /api/career-development/:subject            — composed career-development envelope
 *
 * GET is strictly read-only (NEVER triggers DDL — the composition delegates the
 * competency-runtime DDL-gating to the roadmap engine; history/baseline use
 * to_regclass probes). The ONLY write path is the explicit POST snapshot, which
 * lazily ensures the append-only history schema behind the flag gate.
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCareerDevelopmentEnabled } from '../config/feature-flags.js';
import {
  CAREER_DEVELOPMENT_VERSION,
  buildCareerDevelopment,
  generateDevelopmentPlan,
  persistCareerDevelopmentSnapshot,
  listCareerDevelopmentHistory,
} from '../services/career-development-engine.js';
import { buildCareerRoadmap } from '../services/career-roadmap-engine.js';

export function registerCareerDevelopmentRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCareerDevelopmentEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'careerDevelopment' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: CAREER_DEVELOPMENT_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[career-development]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) ---------------------------
  // Literal path registered FIRST so the `/:subject` param handler can't swallow it.
  app.get(
    '/api/career-development/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: CAREER_DEVELOPMENT_VERSION, enabled: true, flag: 'careerDevelopment' });
    },
  );

  // ---- Append-only snapshot history (read-only, to_regclass probe) -----------
  // Registered BEFORE `/:subject` (literal-before-param).
  app.get(
    '/api/career-development/:subject/history',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
      return listCareerDevelopmentHistory(pool, String(req.params.subject), Number.isFinite(limit) ? limit : 50);
    }),
  );

  // ---- Development streams + plan (read-only) --------------------------------
  app.get(
    '/api/career-development/:subject/streams',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const roadmap = await buildCareerRoadmap(pool, String(req.params.subject));
      return generateDevelopmentPlan(roadmap);
    }),
  );

  // ---- Longitudinal development tracking (read-only) ------------------------
  app.get(
    '/api/career-development/:subject/tracking',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const env = await buildCareerDevelopment(pool, String(req.params.subject));
      return env.tracking;
    }),
  );

  // ---- Capture an append-only snapshot (the ONLY write path) -----------------
  app.post(
    '/api/career-development/:subject/snapshot',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const env = await buildCareerDevelopment(pool, String(req.params.subject));
      const row = await persistCareerDevelopmentSnapshot(pool, env);
      return { snapshot: row, envelope: env };
    }),
  );

  // ---- Composed career-development envelope (read-only) ---------------------
  app.get(
    '/api/career-development/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildCareerDevelopment(pool, String(req.params.subject))),
  );
}
