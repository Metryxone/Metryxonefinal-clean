/**
 * MX-101B — Assessment Readiness Acceleration admin routes.
 *
 * Flag-gated by `assessmentReadiness` (default OFF). With the flag OFF every route returns 503
 * BEFORE any auth/DB touch and the ensure-schema is never reached, so the new
 * `question_certifications` / `qf_review_audit` / `qf_coverage_snapshots` tables are never created
 * → byte-identical legacy behaviour incl. schema. `/enabled` is a persona-agnostic flag probe so
 * the admin UI can gate its sections without leaking 403s. All other routes are super-admin gated.
 *
 * Certification ≠ approval. Approve is the ONLY coverage-changing op (delegated to the existing
 * reviewQuestion state machine) and is applied ONLY to the explicit ids a human selects — nothing
 * is ever auto-approved and coverage is never inflated.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isAssessmentReadinessEnabled } from '../config/feature-flags';
import {
  certifyQuestion,
  certifyDrafts,
  getCertificationSummary,
  getCertificationForQuestion,
} from '../services/question-certification';
import {
  bulkReview,
  getSmeQueue,
  getReviewBacklog,
  getReviewerProductivity,
} from '../services/review-workbench';
import {
  getAssessmentReadiness,
  getCompetencyReadiness,
  captureSnapshot,
  getCoverageTrends,
} from '../services/assessment-readiness';
import { getFounderDashboard } from '../services/question-factory-population';

export function registerAssessmentReadinessRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/assessment-readiness';
  const reviewerOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;
  const fail = (res: Response, e: any) => res.status(500).json({ ok: false, error: e?.message ? String(e.message).slice(0, 300) : 'internal_error' });
  // never-throws: reject a malformed id with a structured 400 BEFORE it reaches a uuid cast (which 500s).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = (s: unknown) => typeof s === 'string' && UUID_RE.test(s.trim());

  // Persona-agnostic flag probe (no auth) so the UI can hide the sections when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isAssessmentReadinessEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isAssessmentReadinessEnabled()) return res.status(503).json({ ok: false, error: 'assessment_readiness_disabled' });
    next();
  };
  app.use(BASE, gate, requireAuth, requireSuperAdmin);

  /* ----------------------------- certification ----------------------------- */
  app.get(`${BASE}/certification/summary`, async (_req, res) => {
    try { res.json(await getCertificationSummary(pool)); } catch (e) { fail(res, e); }
  });
  app.get(`${BASE}/certification/question/:id`, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ ok: false, error: 'invalid_id', note: 'question id must be a uuid' });
    try { res.json(await getCertificationForQuestion(pool, String(req.params.id))); } catch (e) { fail(res, e); }
  });
  app.post(`${BASE}/certification/certify/:id`, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ ok: false, error: 'invalid_id', note: 'question id must be a uuid' });
    try {
      const r = await certifyQuestion(pool, String(req.params.id), reviewerOf(req));
      res.status(r.ok ? 200 : 404).json(r);
    } catch (e) { fail(res, e); }
  });
  app.post(`${BASE}/certification/certify-drafts`, async (req, res) => {
    try {
      const b = req.body || {};
      res.json(await certifyDrafts(pool, {
        competencyId: b.competencyId ? String(b.competencyId) : undefined,
        reCertify: Boolean(b.reCertify),
        limit: b.limit != null ? Number(b.limit) : undefined,
        certifiedBy: reviewerOf(req),
      }));
    } catch (e) { fail(res, e); }
  });

  /* ------------------------------- workbench ------------------------------- */
  app.get(`${BASE}/workbench/backlog`, async (_req, res) => {
    try { res.json(await getReviewBacklog(pool)); } catch (e) { fail(res, e); }
  });
  app.get(`${BASE}/workbench/reviewers`, async (_req, res) => {
    try { res.json(await getReviewerProductivity(pool)); } catch (e) { fail(res, e); }
  });
  app.get(`${BASE}/workbench/queue`, async (req, res) => {
    try {
      res.json(await getSmeQueue(pool, {
        competencyId: req.query.competencyId ? String(req.query.competencyId) : undefined,
        reviewStatus: req.query.reviewStatus ? String(req.query.reviewStatus) : undefined,
        certStatus: req.query.certStatus ? String(req.query.certStatus) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      }));
    } catch (e) { fail(res, e); }
  });
  // Bulk review — EXPLICIT ids only, NEVER an "approve all" selector. Approve is the only
  // coverage-changing op and is delegated to the existing human approval state machine.
  app.post(`${BASE}/workbench/bulk-review`, async (req, res) => {
    try {
      const b = req.body || {};
      const r = await bulkReview(pool, {
        ids: Array.isArray(b.ids) ? b.ids : [],
        action: b.action,
        reviewerId: reviewerOf(req),
        certifiedOnly: Boolean(b.certifiedOnly),
      });
      res.status(r.ok ? 200 : 400).json(r);
    } catch (e) { fail(res, e); }
  });

  /* ------------------------------- readiness ------------------------------- */
  app.get(`${BASE}/readiness`, async (_req, res) => {
    try { res.json(await getAssessmentReadiness(pool)); } catch (e) { fail(res, e); }
  });
  app.get(`${BASE}/readiness/competencies`, async (req, res) => {
    try {
      res.json(await getCompetencyReadiness(pool, {
        onlyLevel: req.query.level ? String(req.query.level) : undefined,
        competencyId: req.query.competencyId ? String(req.query.competencyId) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      }));
    } catch (e) { fail(res, e); }
  });
  app.get(`${BASE}/readiness/trends`, async (req, res) => {
    try { res.json(await getCoverageTrends(pool, req.query.limit ? Number(req.query.limit) : 60)); } catch (e) { fail(res, e); }
  });
  app.post(`${BASE}/readiness/snapshot`, async (req, res) => {
    try { res.json(await captureSnapshot(pool, (req.body || {}).label ?? null)); } catch (e) { fail(res, e); }
  });

  /* --------------------------- founder dashboard --------------------------- */
  // Phase 5 — one composed surface: founder coverage counts + readiness breakdown + certification
  // summary + review backlog + coverage/readiness trends. Read-only composition (never recompute).
  app.get(`${BASE}/dashboard`, async (_req, res) => {
    try {
      const [founder, readiness, certification, backlog, trends] = await Promise.all([
        getFounderDashboard(pool),
        getAssessmentReadiness(pool),
        getCertificationSummary(pool),
        getReviewBacklog(pool),
        getCoverageTrends(pool),
      ]);
      res.json({
        ok: true,
        founder,
        readiness: readiness.readiness_breakdown,
        coverage_axes: readiness.coverage_axes,
        certification,
        backlog,
        trends,
        note: 'Composed read-only view. ready_assured is a Confidence axis (<= base_ready). Live assessment-ready coverage only changes when a human approves questions in the workbench.',
      });
    } catch (e) { fail(res, e); }
  });
}
