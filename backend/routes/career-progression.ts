/**
 * PHASE 4.11 — Career Progression Tracking routes (additive, flag-gated, super-admin).
 *
 * Exposes the additive, read-only Career Progression engine behind the
 * `careerProgression` flag (env `FF_CAREER_PROGRESSION`, default OFF). Strictly
 * additive: flag OFF => every route returns 503 `feature_disabled` BEFORE any DB
 * touch => byte-identical legacy behaviour (no schema, no read, no write).
 *
 * The engine COMPOSES the already-accrued Phase-4.3 readiness history plus this
 * phase's own append-only growth_tracking / career_history tables into five
 * longitudinal progression dimensions (Career/Readiness/Competency Growth +
 * Career Movement + Role Evolution) — it never recomputes a score and never
 * fabricates a trend (growth needs ≥2 datapoints over time).
 *
 * Access control: `subject` is an OPERATOR-supplied identifier for any assessed
 * person (not the caller's identity), so every route is super-admin gated to
 * prevent IDOR — mirrors /api/career-readiness/*, /api/career-signal/* etc.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET  /api/career-progression/_meta/status        — lightweight flag probe (no DB)
 *   GET  /api/career-progression/:subject            — five composed progression dimensions (read-only)
 *   GET  /api/career-progression/:subject/timeline   — raw growth_tracking + career_history (read-only)
 *   GET  /api/career-progression/:subject/growth      — growth_tracking snapshots (read-only)
 *   GET  /api/career-progression/:subject/history     — detected career_history events (read-only)
 *   POST /api/career-progression/:subject/snapshot    — capture a progression snapshot (write)
 *
 * GET is strictly read-only — it touches only the history tables via to_regclass
 * probes and runs NO engine + NO DDL. The POST snapshot is the ONLY write/DDL
 * path: it composes the live Phase-4.3 readiness + competency runtime to capture
 * a new point and append movement events.
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCareerProgressionEnabled } from '../config/feature-flags.js';
import {
  CAREER_PROGRESSION_VERSION,
  buildCareerProgression,
  buildCareerProgressionTimeline,
  listGrowthTracking,
  listCareerHistory,
  persistCareerProgressionSnapshot,
} from '../services/career-progression-engine.js';

export function registerCareerProgressionRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCareerProgressionEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'careerProgression' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: CAREER_PROGRESSION_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[career-progression]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) --------------------------
  // Literal path registered FIRST so the `/:subject` param handler can't swallow it.
  app.get(
    '/api/career-progression/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: CAREER_PROGRESSION_VERSION, enabled: true, flag: 'careerProgression' });
    },
  );

  // ---- Raw timeline: growth_tracking + career_history (read-only) -----------
  // Two-segment literal sub-paths registered BEFORE `/:subject` (literal-before-param).
  app.get(
    '/api/career-progression/:subject/timeline',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildCareerProgressionTimeline(pool, String(req.params.subject))),
  );

  app.get(
    '/api/career-progression/:subject/growth',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => listGrowthTracking(pool, String(req.params.subject))),
  );

  app.get(
    '/api/career-progression/:subject/history',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => listCareerHistory(pool, String(req.params.subject))),
  );

  // ---- Capture a progression snapshot (write path — ensures schema) ---------
  app.post(
    '/api/career-progression/:subject/snapshot',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => persistCareerProgressionSnapshot(pool, String(req.params.subject))),
  );

  // ---- Five composed progression dimensions (read-only) --------------------
  app.get(
    '/api/career-progression/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildCareerProgression(pool, String(req.params.subject))),
  );
}
