/**
 * PHASE 5 — Talent Intelligence routes (additive, flag-gated, super-admin).
 *
 * Exposes the additive, read-only Talent Intelligence aggregator behind the
 * `talentIntelligence` flag (env `FF_TALENT_INTELLIGENCE`, default OFF). Strictly
 * additive: flag OFF => every route returns 503 `feature_disabled` BEFORE any DB
 * touch => byte-identical legacy behaviour (no schema, no read, no write).
 *
 * The aggregator COMPOSES the already-built Phase-5 components (Employer /
 * Recruiter / Job-Architecture / Talent-Matching / Assessment-led-Hiring /
 * Hiring-Intelligence / Workforce-Intelligence) into ONE coherent read surface.
 * It never recomputes a score and never fabricates.
 *
 * Access control: `org`/`candidate` ids are OPERATOR-supplied (not the caller's
 * identity), so every route is super-admin gated to prevent IDOR — mirrors
 * /api/career-signal/*, /api/career-readiness/* etc.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET /api/talent-intelligence/_meta/status            — lightweight flag probe
 *   GET /api/talent-intelligence/overview                — platform-wide 7-component rollup
 *   GET /api/talent-intelligence/org/:orgId              — org-scoped rollup
 *   GET /api/talent-intelligence/candidate/:candidateId  — candidate-scoped composed view
 *
 * GET is strictly read-only (NEVER triggers DDL — to_regclass probes + SELECT
 * only). There are no write paths.
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isTalentIntelligenceEnabled } from '../config/feature-flags.js';
import {
  TALENT_INTELLIGENCE_VERSION,
  buildTalentIntelligenceOverview,
  buildCandidateTalentView,
} from '../services/talent-intelligence-aggregator.js';
import { buildTalentFunnel } from '../services/talent-funnel-intelligence.js';

export function registerTalentIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isTalentIntelligenceEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'talentIntelligence' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: TALENT_INTELLIGENCE_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[talent-intelligence]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) --------------------------
  // Literal path registered FIRST so a param handler can't swallow it.
  app.get(
    '/api/talent-intelligence/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: TALENT_INTELLIGENCE_VERSION, enabled: true, flag: 'talentIntelligence' });
    },
  );

  // ---- Platform-wide rollup (read-only) -------------------------------------
  app.get(
    '/api/talent-intelligence/overview',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const org = typeof req.query.org === 'string' ? req.query.org : null;
      return buildTalentIntelligenceOverview(pool, org);
    }),
  );

  // ---- Step 4: Talent Funnel Intelligence (read-only, composing) ------------
  // Literal `/funnel` registered BEFORE the `/org/:orgId` param handler so the
  // param route can't swallow it.
  app.get(
    '/api/talent-intelligence/funnel',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const org = typeof req.query.org === 'string' ? req.query.org : null;
      return buildTalentFunnel(pool, org);
    }),
  );

  app.get(
    '/api/talent-intelligence/funnel/org/:orgId',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildTalentFunnel(pool, String(req.params.orgId ?? ''))),
  );

  // ---- Org-scoped rollup (read-only) ----------------------------------------
  app.get(
    '/api/talent-intelligence/org/:orgId',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildTalentIntelligenceOverview(pool, String(req.params.orgId ?? ''))),
  );

  // ---- Candidate-scoped composed view (read-only) ---------------------------
  app.get(
    '/api/talent-intelligence/candidate/:candidateId',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildCandidateTalentView(pool, String(req.params.candidateId ?? ''))),
  );
}
