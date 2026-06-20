/**
 * PHASE 4.3 — Career Readiness routes (additive, flag-gated, super-admin).
 *
 * Exposes the additive, read-only Career Readiness aggregator behind the
 * `careerReadiness` flag (env `FF_CAREER_READINESS`, default OFF). Strictly
 * additive: flag OFF => every route returns 503 `feature_disabled` BEFORE any DB
 * touch => byte-identical legacy behaviour (no schema, no read, no write).
 *
 * The aggregator COMPOSES the already-built readiness engines (EI overall /
 * FRP FRI / role-readiness-v2 / EI growth potential) into ONE unified envelope —
 * it never recomputes a score and never fabricates.
 *
 * Access control: `subject` is an OPERATOR-supplied identifier for any assessed
 * person (not the caller's identity), so every route is super-admin gated to
 * prevent IDOR — mirrors /api/career-intelligence/* and /api/competency-ei/*
 * (the engines it composes are super-admin scoped).
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET  /api/career-readiness/_meta/status          — lightweight flag probe
 *   GET  /api/career-readiness/:subject/history      — append-only snapshot history (read-only)
 *   POST /api/career-readiness/:subject/snapshot     — capture an append-only snapshot
 *   GET  /api/career-readiness/:subject              — composed readiness envelope
 *
 * GET is strictly read-only (NEVER triggers DDL — history uses a to_regclass
 * probe). The ONLY write path is the explicit POST snapshot, which lazily ensures
 * the append-only history schema behind the flag gate.
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCareerReadinessEnabled } from '../config/feature-flags.js';
import {
  CAREER_READINESS_VERSION,
  buildCareerReadiness,
  persistCareerReadinessSnapshot,
  listCareerReadinessHistory,
} from '../services/career-readiness-aggregator.js';

export function registerCareerReadinessRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCareerReadinessEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'careerReadiness' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: CAREER_READINESS_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[career-readiness]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) ---------------------------
  // Literal path registered FIRST so the `/:subject` param handler can't swallow it.
  app.get(
    '/api/career-readiness/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: CAREER_READINESS_VERSION, enabled: true, flag: 'careerReadiness' });
    },
  );

  // ---- Append-only snapshot history (read-only, to_regclass probe) -----------
  // Literal sub-path carries an extra `history` segment so it never collides with
  // the param route below. Registered BEFORE `/:subject` (literal-before-param).
  app.get(
    '/api/career-readiness/:subject/history',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
      return listCareerReadinessHistory(pool, String(req.params.subject), Number.isFinite(limit) ? limit : 50);
    }),
  );

  // ---- Capture an append-only snapshot (the ONLY write path) -----------------
  // Lazily ensures the history schema behind the flag gate, then appends. POST so
  // a read (GET) can NEVER mutate state or trigger DDL.
  app.post(
    '/api/career-readiness/:subject/snapshot',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const env = await buildCareerReadiness(pool, String(req.params.subject));
      const row = await persistCareerReadinessSnapshot(pool, env);
      return { snapshot: row, envelope: env };
    }),
  );

  // ---- Composed career-readiness envelope (read-only) ------------------------
  app.get(
    '/api/career-readiness/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildCareerReadiness(pool, String(req.params.subject))),
  );
}
