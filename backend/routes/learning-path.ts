/**
 * MX-74X — Learning Path routes (additive, flag-gated, super-admin, read-only).
 *
 * Exposes the Learning Path engine (the second missing link: Career Intelligence →
 * Learning Path sequencing) behind the `learningPath` flag, which INHERITS the
 * `careerBuilderSuite` master switch (env `FF_LEARNING_PATH` / `FF_CAREER_BUILDER_SUITE`).
 * Flag OFF (and suite OFF) => every route returns 503 `feature_disabled` BEFORE any
 * DB touch => byte-identical legacy (no schema, no read, no write).
 *
 * `subject` is an OPERATOR-supplied identifier for any assessed person, so every
 * route is super-admin gated to prevent IDOR. GET is strictly read-only.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET /api/learning-path/_meta/status  — lightweight flag probe (no DB touch)
 *   GET /api/learning-path/:subject      — composed ordered learning sequence (read-only)
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isLearningPathEnabled } from '../config/feature-flags.js';
import { buildLearningPath, LEARNING_PATH_VERSION } from '../services/learning-path-engine.js';

export function registerLearningPathRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  const gate: RequestHandler = (_req, res, next) => {
    if (!isLearningPathEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'learningPath' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: LEARNING_PATH_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[learning-path]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // Literal path registered FIRST so the `/:subject` param handler can't swallow it.
  app.get(
    '/api/learning-path/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: LEARNING_PATH_VERSION, enabled: true, flag: 'learningPath' });
    },
  );

  app.get(
    '/api/learning-path/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildLearningPath(pool, String(req.params.subject))),
  );
}
