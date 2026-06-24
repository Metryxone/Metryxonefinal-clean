/**
 * MX-74X — Career Path routes (additive, flag-gated, super-admin, read-only).
 *
 * Exposes the Career Path engine (the first missing link: Career Intelligence →
 * Career Path generation) behind the `careerPath` flag, which INHERITS the
 * `careerBuilderSuite` master switch (env `FF_CAREER_PATH` / `FF_CAREER_BUILDER_SUITE`).
 * Flag OFF (and suite OFF) => every route returns 503 `feature_disabled` BEFORE any
 * DB touch => byte-identical legacy (no schema, no read, no write).
 *
 * `subject` is an OPERATOR-supplied identifier for any assessed person (not the
 * caller's identity), so every route is super-admin gated to prevent IDOR —
 * mirrors /api/career-match/*, /api/career-gap/* etc. GET is strictly read-only.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET /api/career-path/_meta/status   — lightweight flag probe (no DB touch)
 *   GET /api/career-path/:subject       — composed graph-backed career path (read-only)
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCareerPathEnabled } from '../config/feature-flags.js';
import { buildCareerPath, CAREER_PATH_VERSION } from '../services/career-path-engine.js';

export function registerCareerPathRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCareerPathEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'careerPath' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: CAREER_PATH_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[career-path]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // Literal path registered FIRST so the `/:subject` param handler can't swallow it.
  app.get(
    '/api/career-path/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: CAREER_PATH_VERSION, enabled: true, flag: 'careerPath' });
    },
  );

  app.get(
    '/api/career-path/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildCareerPath(pool, String(req.params.subject))),
  );
}
