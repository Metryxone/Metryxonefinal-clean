/**
 * MX-101X — Question Factory admin routes.
 *
 * Flag-gated by `questionFactory` (default OFF). With the flag OFF every route
 * returns 503 BEFORE any auth/DB touch and the ensure-schema is never reached, so
 * the new columns/ledger are never created → byte-identical legacy behaviour incl.
 * schema. `/enabled` is a persona-agnostic flag probe so the admin UI can gate its
 * tab without leaking 403s. All other routes are super-admin gated.
 *
 * Generation NEVER auto-approves and NEVER inflates live coverage — see
 * services/question-factory.ts for the guarantees.
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isQuestionFactoryEnabled } from '../config/feature-flags';
import {
  ensureQuestionFactorySchema,
  generateDraftPack,
  generateAIPack,
  importQuestions,
  reviewQuestion,
  retireQuestion,
  getFactoryCoverage,
  listDrafts,
  listBatches,
  listGenomeCompetencies,
  REVIEW_VALUES,
} from '../services/question-factory';

export function registerQuestionFactoryRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/question-factory';
  const reviewerOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isQuestionFactoryEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isQuestionFactoryEnabled()) return res.status(503).json({ ok: false, error: 'question_factory_disabled' });
    next();
  };

  // Lightweight flag probe the admin UI gates its tab on (res.ok). 503 when OFF (tab hidden,
  // byte-identical UI), 200 when ON. No DDL — mirrors the competency-coverage-matrices convention.
  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- reads (GET-never-writes: NO ensure-schema; the service probes via to_regclass and degrades) ----
  app.get(`${BASE}/coverage`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getFactoryCoverage(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/drafts`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      res.json(await listDrafts(pool, {
        competencyId: req.query.competency_id ? String(req.query.competency_id) : undefined,
        provenance: req.query.provenance ? String(req.query.provenance) : undefined,
        reviewStatus: req.query.review_status ? String(req.query.review_status) : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
      }));
    } catch (e) { next(e); }
  });

  app.get(`${BASE}/competencies`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      res.json(await listGenomeCompetencies(pool, {
        q: req.query.q ? String(req.query.q) : undefined,
        gapOnly: req.query.gap_only === '1' || req.query.gap_only === 'true',
        min: req.query.min ? parseInt(String(req.query.min), 10) : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
      }));
    } catch (e) { next(e); }
  });

  app.get(`${BASE}/batches`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      res.json(await listBatches(pool, req.query.limit ? parseInt(String(req.query.limit), 10) : 50));
    } catch (e) { next(e); }
  });

  // ---- generation ----
  app.post(`${BASE}/generate`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const b = req.body || {};
      if (!b.competency_id) return res.status(400).json({ ok: false, error: 'competency_id required' });
      await ensureQuestionFactorySchema(pool);
      const cells = Array.isArray(b.cells) ? b.cells : undefined;
      const out = await generateDraftPack(pool, { competencyId: String(b.competency_id), cells, createdBy: reviewerOf(req) ? String(reviewerOf(req)) : null });
      res.status(out.ok ? 200 : 400).json(out);
    } catch (e) { next(e); }
  });

  app.post(`${BASE}/generate-ai`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const b = req.body || {};
      if (!b.competency_id) return res.status(400).json({ ok: false, error: 'competency_id required' });
      await ensureQuestionFactorySchema(pool);
      const out = await generateAIPack(pool, { competencyId: String(b.competency_id), createdBy: reviewerOf(req) ? String(reviewerOf(req)) : null });
      res.status(out.ok ? 200 : 422).json(out);
    } catch (e) { next(e); }
  });

  app.post(`${BASE}/import`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : null;
      if (!items) return res.status(400).json({ ok: false, error: 'items[] required' });
      await ensureQuestionFactorySchema(pool);
      res.json(await importQuestions(pool, items, reviewerOf(req) ? String(reviewerOf(req)) : null));
    } catch (e) { next(e); }
  });

  // ---- review workflow (literal :id/<action> — param :id only appears with a literal suffix) ----
  app.post(`${BASE}/:id/review`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const action = String(req.body?.action || '');
      if (!['start_review', 'request_changes', 'reject', 'approve'].includes(action)) {
        return res.status(400).json({ ok: false, error: 'invalid_action', allowed: ['start_review', 'request_changes', 'reject', 'approve'] });
      }
      await ensureQuestionFactorySchema(pool);
      const out = await reviewQuestion(pool, String(req.params.id), action as any, reviewerOf(req) ? String(reviewerOf(req)) : null);
      res.status(out.ok ? 200 : 404).json(out);
    } catch (e) { next(e); }
  });

  app.post(`${BASE}/:id/approve`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      await ensureQuestionFactorySchema(pool);
      const out = await reviewQuestion(pool, String(req.params.id), 'approve', reviewerOf(req) ? String(reviewerOf(req)) : null);
      res.status(out.ok ? 200 : 404).json(out);
    } catch (e) { next(e); }
  });

  app.post(`${BASE}/:id/retire`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      await ensureQuestionFactorySchema(pool);
      const out = await retireQuestion(pool, String(req.params.id), reviewerOf(req) ? String(reviewerOf(req)) : null);
      res.status(out.ok ? 200 : 404).json(out);
    } catch (e) { next(e); }
  });

  // Surface the allowed review vocabulary for the admin UI (static, flag-gated).
  app.get(`${BASE}/review-vocabulary`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, review_status: REVIEW_VALUES });
  });
}
