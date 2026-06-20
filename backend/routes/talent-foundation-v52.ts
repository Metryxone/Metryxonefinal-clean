/**
 * PHASE 5.1 + 5.2 — Talent Foundation v5.2 routes (additive, flag-gated, super-admin).
 *
 * NOTE: this is a NEW, separate surface from the pre-existing `routes/talent-foundation.ts`
 * (which owns `/api/talent/*` and `/api/admin/talent/*` role-family/blueprint CRUD). This
 * file ONLY adds the read-only Phase 5.1/5.2 consolidation rollup under the distinct
 * `/api/talent-foundation/*` namespace — it never touches the legacy routes.
 *
 * Exposes the read-only Talent Foundation aggregator behind the `talentFoundation`
 * flag (env `FF_TALENT_FOUNDATION`, default OFF). Strictly additive: flag OFF =>
 * every route returns 503 `feature_disabled` BEFORE any DB touch => byte-identical
 * legacy behaviour (no schema, no read, no write).
 *
 * Access control: `employerId` is OPERATOR-supplied (not the caller's identity), so
 * every route is super-admin gated to prevent IDOR — mirrors the Phase-5 talent
 * intelligence routes.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET /api/talent-foundation/_meta/status          — lightweight flag probe
 *   GET /api/talent-foundation/overview              — platform-wide deliverable rollup
 *   GET /api/talent-foundation/employer/:employerId  — employer-scoped rollup
 *
 * GET is strictly read-only (NEVER triggers DDL — to_regclass probes + SELECT only).
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isTalentFoundationEnabled } from '../config/feature-flags.js';
import {
  TALENT_FOUNDATION_VERSION,
  buildTalentFoundationOverview,
} from '../services/talent-foundation-aggregator.js';

export function registerTalentFoundationV52Routes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isTalentFoundationEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'talentFoundation' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: TALENT_FOUNDATION_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[talent-foundation-v52]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) --------------------------
  // Literal path registered FIRST so a param handler can't swallow it.
  app.get(
    '/api/talent-foundation/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: TALENT_FOUNDATION_VERSION, enabled: true, flag: 'talentFoundation' });
    },
  );

  // ---- Platform-wide rollup (read-only) -------------------------------------
  app.get(
    '/api/talent-foundation/overview',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const employer = typeof req.query.employer === 'string' ? req.query.employer : null;
      return buildTalentFoundationOverview(pool, employer);
    }),
  );

  // ---- Employer-scoped rollup (read-only) -----------------------------------
  app.get(
    '/api/talent-foundation/employer/:employerId',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildTalentFoundationOverview(pool, String(req.params.employerId ?? ''))),
  );
}
