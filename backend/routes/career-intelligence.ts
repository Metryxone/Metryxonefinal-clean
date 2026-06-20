/**
 * PHASE 4 — Career Intelligence routes.
 *
 * Exposes the additive, read-only Career Intelligence bridge behind the
 * `careerIntelligence` flag (env `FF_CAREER_INTELLIGENCE`, default OFF). Strictly
 * additive: flag OFF => every route returns 503 `feature_disabled` BEFORE any DB
 * touch => byte-identical legacy behaviour (no schema, no read, no write). The
 * bridge COMPOSES the Phase 3 Competency-EI engines into one career-intelligence
 * envelope across the six career deliverables — it never recomputes a score and
 * never fabricates.
 *
 * Access control: `subject` is an OPERATOR-supplied identifier for any assessed
 * person (not the caller's identity), so every route is super-admin gated to
 * prevent IDOR — mirrors /api/competency-ei/* (the engines it composes are all
 * super-admin scoped).
 *
 * Routes (all requireAuth + requireSuperAdmin):
 *   GET /api/career-intelligence/:subject                  — composed envelope
 *   GET /api/career-intelligence/:subject/validation       — Phase-4 validation
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCareerIntelligenceEnabled } from '../config/feature-flags.js';
import {
  CAREER_INTELLIGENCE_VERSION,
  buildCareerIntelligence,
} from '../services/career-intelligence-bridge.js';
import { runCareerIntelligenceValidation } from '../services/career-intelligence-validation.js';

export function registerCareerIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCareerIntelligenceEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'careerIntelligence' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: CAREER_INTELLIGENCE_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[career-intelligence]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) ---------------------------
  // The SuperAdmin nav probes this to decide whether to render the tab: flag OFF
  // => 503 (nav hides => byte-identical UI); flag ON + super-admin => 200. Literal
  // path registered FIRST so the `/:subject` param handler can't swallow it.
  app.get(
    '/api/career-intelligence/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: CAREER_INTELLIGENCE_VERSION, enabled: true, flag: 'careerIntelligence' });
    },
  );

  // ---- Super-admin validation (Phase 4 — mirrors Phase 3.12) -----------------
  // Literal sub-path carries an extra `validation` segment so it never collides
  // with the param route below. Registered FIRST (literal-before-param).
  app.get(
    '/api/career-intelligence/:subject/validation',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => runCareerIntelligenceValidation(pool, String(req.params.subject))),
  );

  // ---- Composed career-intelligence envelope (read-only) ---------------------
  app.get(
    '/api/career-intelligence/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildCareerIntelligence(pool, String(req.params.subject))),
  );
}
