/**
 * Competency Runtime (Phase 2) — operationalizes the live competency chain
 * behind the `competencyRuntime` flag (default OFF):
 *
 *   Role -> Assessment Blueprint -> Assessment Generation -> Competency Scoring
 *        -> Competency Profile -> Competency Gap Analysis
 *
 * Strictly additive. Flag OFF => every route returns 503 `feature_disabled`
 * BEFORE any DB touch => byte-identical legacy behaviour. Never fabricates
 * scores; reuses the existing blueprint maps, question bank, and readiness engine
 * (see services/competency-runtime.ts).
 *
 * Routes (all requireAuth + requireSuperAdmin):
 *   POST /api/competency-runtime/assessment-instances           — generate from a blueprint
 *   GET  /api/competency-runtime/assessment-instances/:id       — fetch an instance
 *   POST /api/competency-runtime/assessment-instances/:id/score — submit responses + score -> profile
 *   GET  /api/competency-runtime/profiles/:subjectId            — latest competency profile
 *   GET  /api/competency-runtime/gap-analysis/:subjectId        — required vs measured gaps
 *
 * Access control: `subject_id` is an OPERATOR-supplied identifier for any assessed
 * person (not the caller's own identity), so every route is super-admin gated to
 * prevent IDOR. Only trusted operators may generate/score/read arbitrary subjects.
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCompetencyRuntimeEnabled } from '../config/feature-flags.js';
import {
  COMPETENCY_RUNTIME_VERSION,
  generateAssessment,
  scoreAssessment,
  getInstance,
  getProfile,
  computeGapAnalysis,
} from '../services/competency-runtime.js';
import {
  buildBlueprint,
  getDimensionMix,
  validateDimensionMix,
} from '../services/blueprint-builder.js';

export function registerCompetencyRuntimeRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCompetencyRuntimeEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'competencyRuntime' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: COMPETENCY_RUNTIME_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[competency-runtime]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- 1. Assessment generation --------------------------------------------
  app.post('/api/competency-runtime/assessment-instances', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const b = req.body ?? {};
    const result = await generateAssessment(pool, {
      blueprintId: String(b.blueprint_id ?? b.blueprintId ?? ''),
      subjectId: String(b.subject_id ?? b.subjectId ?? ''),
      total: b.total != null ? Number(b.total) : undefined,
      roleId: b.role_id ?? b.roleId ?? null,
      context: b.context && typeof b.context === 'object' ? b.context : undefined,
    });
    if (!result.ok) {
      const code = result.error === 'blueprint_not_found' ? 404 : 400;
      res.status(code).json({ ok: false, error: result.error });
      return undefined;
    }
    return result;
  }));

  // ---- 2. Fetch an instance (literal /score registered separately below) ---
  app.get('/api/competency-runtime/assessment-instances/:id', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const inst = await getInstance(pool, String(req.params.id));
    if (!inst) { res.status(404).json({ ok: false, error: 'instance_not_found' }); return undefined; }
    return inst;
  }));

  // ---- 3. Score an instance -> profile -------------------------------------
  app.post('/api/competency-runtime/assessment-instances/:id/score', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const b = req.body ?? {};
    const responses = Array.isArray(b.responses) ? b.responses : [];
    const result = await scoreAssessment(pool, {
      instanceId: String(req.params.id),
      responses: responses.map((r: any) => ({ index: Number(r.index), selected_index: Number(r.selected_index ?? r.selectedIndex) })),
    });
    if (!result.ok) {
      const code = result.error === 'instance_not_found' ? 404 : 400;
      res.status(code).json({ ok: false, error: result.error });
      return undefined;
    }
    return result;
  }));

  // ---- 4. Competency profile -----------------------------------------------
  app.get('/api/competency-runtime/profiles/:subjectId', gate, requireAuth, requireSuperAdmin, wrap(async (req) =>
    getProfile(pool, String(req.params.subjectId)),
  ));

  // ---- 5. Gap analysis ------------------------------------------------------
  app.get('/api/competency-runtime/gap-analysis/:subjectId', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const result = await computeGapAnalysis(pool, String(req.params.subjectId));
    if (!result.ok) {
      const code = result.error === 'blueprint_not_found' ? 404 : 400;
      res.status(code).json({ ok: false, error: result.error });
      return undefined;
    }
    return result;
  }));

  // ===== Phase 2.1 — Assessment Blueprint Engine (dimension mix) =============
  // Role -> Assessment Blueprint: the 5-dimension % allocation (= onto_competency_types).

  // ---- 6. Validate a candidate mix (no persist; LITERAL before the :param) --
  app.post('/api/competency-runtime/blueprints/dimension-mix/validate', gate, requireAuth, requireSuperAdmin, wrap(async (req) =>
    validateDimensionMix((req.body ?? {}) as Record<string, unknown>),
  ));

  // ---- 7. Build (derive or author) a blueprint's dimension mix -------------
  app.post('/api/competency-runtime/blueprints/:blueprintId/dimension-mix', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const b = req.body ?? {};
    const weights = b.weights && typeof b.weights === 'object' ? b.weights : undefined;
    const result = await buildBlueprint(pool, String(req.params.blueprintId), weights);
    if (!result.ok) {
      const code = result.error === 'blueprint_not_found' ? 404
        : result.error === 'insufficient_typing' ? 422
        : 400;
      res.status(code).json({ ok: false, error: result.error, coverage: (result as any).coverage, validation: (result as any).validation });
      return undefined;
    }
    return result;
  }));

  // ---- 8. Read a blueprint's current dimension mix -------------------------
  app.get('/api/competency-runtime/blueprints/:blueprintId/dimension-mix', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const row = await getDimensionMix(pool, String(req.params.blueprintId));
    if (!row.blueprint_found) { res.status(404).json({ ok: false, error: 'blueprint_not_found' }); return undefined; }
    return row;
  }));
}
