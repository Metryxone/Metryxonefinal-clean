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
  submitSingleResponse,
  nextAdaptiveQuestion,
  getInstance,
  getProfile,
  computeGapAnalysis,
  computeTypeProfile,
  listProfileHistory,
  computeProfileTrends,
  computeRoleReadinessForSubject,
  computeDashboard,
  computeCompetencyGapEngine,
  computeGapDashboard,
  computeCompetencySignalEngine,
  SIGNAL_LIBRARY,
  SIGNAL_RULES,
  SIGNAL_LOW_LEVEL_MAX,
  SIGNAL_HIGH_LEVEL_MIN,
  computeBenchmarkEngine,
  computeBenchmarkComparison,
  computeBenchmarkDashboard,
  computeRuntimeValidation,
  computeItemPsychometrics,
} from '../services/competency-runtime.js';
import {
  runCompetencyTypeSeed,
  getClassificationReport,
} from '../services/competency-type-classification.js';
import {
  buildBlueprint,
  getDimensionMix,
  validateDimensionMix,
} from '../services/blueprint-builder.js';
import {
  getDifficultyFramework,
  validateQuestionBlueprintInput,
  mapQuestion,
  getQuestionMapping,
  getQuestionPool,
  buildQuestionBlueprint,
  getQuestionBlueprint,
} from '../services/question-blueprint.js';
import {
  generateAssembledAssessment,
  buildAssessment,
  validateAssessment,
  getAssembledAssessment,
  type AssembledQuestion,
} from '../services/assessment-assembly.js';
import {
  scoreAssessmentRun,
  getScoreRun,
  type ScoreResponseInput,
  type CohortRef,
} from '../services/competency-scoring.js';
import {
  getBlueprints,
  getMappingGrid,
  bulkMapCompetencyQuestions,
  getCompetencyQuestionMap,
} from '../services/assessment-foundation-mapping.js';

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

  // ---- 3b. Adaptive: capture ONE response incrementally (T5) ---------------
  //   Literal /:id sub-paths — registered alongside /score (same param depth).
  app.post('/api/competency-runtime/assessment-instances/:id/respond', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const b = req.body ?? {};
    const result = await submitSingleResponse(pool, {
      instanceId: String(req.params.id),
      index: Number(b.index),
      selected_index: Number(b.selected_index ?? b.selectedIndex),
    });
    if (!result.ok) {
      const code = result.error === 'instance_not_found' || result.error === 'question_not_found' ? 404
        : result.error === 'invalid_option' || result.error === 'instance_required' ? 400
        : 400;
      res.status(code).json({ ok: false, error: result.error });
      return undefined;
    }
    return result;
  }));

  // ---- 3c. Adaptive: decide + serve the NEXT question (T5) ------------------
  //   Pure re-ordering of the already-generated pool; never throws; degrades to
  //   sequential (batch order) on any internal failure.
  app.get('/api/competency-runtime/assessment-instances/:id/next', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const result = await nextAdaptiveQuestion(pool, String(req.params.id));
    if (!result.ok) {
      const code = result.error === 'instance_not_found' ? 404 : 400;
      res.status(code).json({ ok: false, error: result.error });
      return undefined;
    }
    return result;
  }));

  // ---- T6. Item-level psychometrics (read-only; classical test theory) ------
  // Distinct literal prefix (`item-psychometrics`) — no collision with /:id.
  app.get('/api/competency-runtime/item-psychometrics/:blueprintId', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const result = await computeItemPsychometrics(pool, String(req.params.blueprintId));
    if (!result.ok) {
      res.status(400).json({ ok: false, error: result.error });
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

  // ===== Phase 2.7 — Competency Gap Engine + Prioritization ==================
  // Additive composition over gap-analysis: Required/Current/Gap/Priority/Need.
  // ---- 5.1 Prioritized gap engine -------------------------------------------
  app.get('/api/competency-runtime/gap-engine/:subjectId', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const result = await computeCompetencyGapEngine(pool, String(req.params.subjectId));
    if (!result.ok) {
      const code = result.error === 'blueprint_not_found' ? 404 : 400;
      res.status(code).json({ ok: false, error: result.error });
      return undefined;
    }
    return result;
  }));

  // ---- 5.2 Gap dashboard (composed read) ------------------------------------
  app.get('/api/competency-runtime/gap-dashboard/:subjectId', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const result = await computeGapDashboard(pool, String(req.params.subjectId));
    if (!result.ok) {
      const code = result.error === 'blueprint_not_found' ? 404 : 400;
      res.status(code).json({ ok: false, error: result.error });
      return undefined;
    }
    return result;
  }));

  // ===== Phase 2.8 — Competency Signal Engine ===============================
  // Derives behavioural signals (risk/potential) from MEASURED competency
  // combinations via a curated signal_library + deterministic signal_rules.
  // ---- 6.1 Signal library + rules (catalog transparency) --------------------
  // Literal path — registered BEFORE /signal-engine/:subjectId (distinct segment).
  app.get('/api/competency-runtime/signal-library', gate, requireAuth, requireSuperAdmin, wrap(async (_req, _res) => {
    return {
      thresholds: { low_level_max: SIGNAL_LOW_LEVEL_MAX, high_level_min: SIGNAL_HIGH_LEVEL_MIN },
      library: SIGNAL_LIBRARY,
      rules: SIGNAL_RULES,
    };
  }));

  // ---- 6.2 Signal engine (per-subject evaluation) ---------------------------
  app.get('/api/competency-runtime/signal-engine/:subjectId', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const result = await computeCompetencySignalEngine(pool, String(req.params.subjectId));
    if (!result.ok) {
      const code = result.error === 'blueprint_not_found' ? 404 : 400;
      res.status(code).json({ ok: false, error: result.error });
      return undefined;
    }
    return result;
  }));

  // ===== Phase 2.9 — Competency Benchmark Foundation =======================
  // Candidate vs Role / Department / Function / Industry / Institution.
  // COMPOSES the existing benchmark substrate (bench_cohorts /
  // bench_competency_benchmarks via adaptive-benchmark) + computeGapAnalysis.
  // Read-only, honesty-preserving (dimension/comparison statuses never fabricated).
  // ---- 7.1 Benchmark engine (which dimensions are honestly available) -------
  app.get('/api/competency-runtime/benchmark-engine/:subjectId', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const result = await computeBenchmarkEngine(pool, String(req.params.subjectId));
    if (!result.ok) { res.status(400).json({ ok: false, error: result.error }); return undefined; }
    return result;
  }));

  // ---- 7.2 Comparison engine (per-competency candidate vs cohort) -----------
  app.get('/api/competency-runtime/benchmark-comparison/:subjectId', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const result = await computeBenchmarkComparison(pool, String(req.params.subjectId));
    if (!result.ok) { res.status(400).json({ ok: false, error: result.error }); return undefined; }
    return result;
  }));

  // ---- 7.3 Benchmark dashboard (composed read + rollup) ---------------------
  app.get('/api/competency-runtime/benchmark-dashboard/:subjectId', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const result = await computeBenchmarkDashboard(pool, String(req.params.subjectId));
    if (!result.ok) { res.status(400).json({ ok: false, error: result.error }); return undefined; }
    return result;
  }));

  // ===== Phase 2.10 — Super-Admin Runtime Validation ======================
  // Read-only, never-throws end-to-end validator across the full chain
  // (blueprint → mapping → generation → scoring → profile → readiness → gap →
  // signal → benchmark) + audit-log coverage + permission posture. COMPOSES the
  // live engines; never mutates; reports honest pass/gap/fail per stage.
  // ---- 8.1 Runtime validation (per-subject chain validation) ----------------
  app.get('/api/competency-runtime/validation/:subjectId', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const result = await computeRuntimeValidation(pool, String(req.params.subjectId));
    if (!result.ok) { res.status(400).json({ ok: false, error: result.error }); return undefined; }
    return result;
  }));

  // ===== Phase 2.5 — Competency Profile Engine (5-TYPE view · history · dashboard)
  // Literal sub-paths (/type-profile, /history, /dashboard) are distinct segment
  // counts from /profiles/:subjectId so route order is unambiguous.

  // ---- 5a. Type-bucketed profile (behavioral/cognitive/functional/technical/future_skills)
  app.get('/api/competency-runtime/profiles/:subjectId/type-profile', gate, requireAuth, requireSuperAdmin, wrap(async (req) =>
    computeTypeProfile(pool, String(req.params.subjectId)),
  ));

  // ---- 5b. Append-only profile history --------------------------------------
  app.get('/api/competency-runtime/profiles/:subjectId/history', gate, requireAuth, requireSuperAdmin, wrap(async (req) =>
    listProfileHistory(pool, String(req.params.subjectId)),
  ));

  // ---- T7. Longitudinal growth trends (read-only over append-only snapshots) -
  app.get('/api/competency-runtime/profiles/:subjectId/trends', gate, requireAuth, requireSuperAdmin, wrap(async (req) =>
    computeProfileTrends(pool, String(req.params.subjectId)),
  ));

  // ---- 5c. Composed profile dashboard ---------------------------------------
  app.get('/api/competency-runtime/profiles/:subjectId/dashboard', gate, requireAuth, requireSuperAdmin, wrap(async (req) =>
    computeDashboard(pool, String(req.params.subjectId)),
  ));

  // ---- 5d. Competency-type classification: seed + report --------------------
  // Seed classifies the genome (onto_competencies) into the 5 TYPES and persists
  // onto_competency_type_map (needs_review per classifier). Idempotent upsert.
  app.post('/api/competency-runtime/competency-types/seed', gate, requireAuth, requireSuperAdmin, wrap(async () =>
    runCompetencyTypeSeed(pool),
  ));
  app.get('/api/competency-runtime/competency-types/report', gate, requireAuth, requireSuperAdmin, wrap(async () =>
    getClassificationReport(pool),
  ));

  // ===== Phase 2.6 — Role Readiness Engine (candidate profile vs role profile)
  // ---- 5e. Role readiness for a subject (readiness % · strengths · gaps · fit)
  app.get('/api/competency-runtime/role-readiness/:subjectId', gate, requireAuth, requireSuperAdmin, wrap(async (req) =>
    computeRoleReadinessForSubject(pool, String(req.params.subjectId)),
  ));

  // ===== Phase 2.1 — Assessment Blueprint Engine (dimension mix) =============
  // Role -> Assessment Blueprint: the 5-dimension % allocation (= onto_competency_types).

  // ---- 5b. Blueprint catalogue (read-only list for dynamic UI) -------------
  // LITERAL /blueprints registered before any /blueprints/:blueprintId/* param routes.
  app.get('/api/competency-runtime/blueprints', gate, requireAuth, requireSuperAdmin, wrap(async (req) => {
    const search = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim() : undefined;
    const activeOnly = req.query.active === '1' || req.query.active === 'true';
    return getBlueprints(pool, { search, activeOnly });
  }));

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

  // ===== Phase 2.2 — Question Blueprint Engine =============================
  //   Competency → Question Pool · Question → Competency / Micro Competency
  //   / Difficulty Level / Question Type.

  // ---- 9. Difficulty framework + supported question types (reference) ------
  app.get('/api/competency-runtime/question-difficulty-framework', gate, requireAuth, requireSuperAdmin, wrap(async () =>
    getDifficultyFramework(pool),
  ));

  // ---- 10. Validate a candidate question blueprint (no persist; LITERAL) ---
  app.post('/api/competency-runtime/question-blueprints/validate', gate, requireAuth, requireSuperAdmin, wrap(async (req) => {
    const b = req.body ?? {};
    return validateQuestionBlueprintInput({
      pool_target: b.pool_target ?? b.poolTarget,
      difficulty_distribution: b.difficulty_distribution ?? b.difficultyDistribution,
      type_distribution: b.type_distribution ?? b.typeDistribution,
    });
  }));

  // ---- 11. Map a bank question → competency (+ micro / difficulty / type) --
  app.post('/api/competency-runtime/questions/:questionId/mapping', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const b = req.body ?? {};
    const result = await mapQuestion(pool, {
      questionId: String(req.params.questionId),
      competencyId: String(b.competency_id ?? b.competencyId ?? ''),
      microCompetencyId: b.micro_competency_id ?? b.microCompetencyId ?? null,
      difficultyLevel: b.difficulty_level ?? b.difficultyLevel ?? null,
      questionType: b.question_type ?? b.questionType ?? null,
      source: b.source,
    });
    if (!result.ok) {
      const code = result.error === 'question_not_found' || result.error === 'competency_not_found' ? 404
        : result.error === 'micro_competency_mismatch' ? 422
        : 400;
      res.status(code).json({ ok: false, error: result.error, detail: (result as any).detail });
      return undefined;
    }
    return result;
  }));

  // ---- 12. Read a question's competency mappings --------------------------
  app.get('/api/competency-runtime/questions/:questionId/mapping', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const row = await getQuestionMapping(pool, String(req.params.questionId));
    if (!row.question_found) { res.status(404).json({ ok: false, error: 'question_not_found' }); return undefined; }
    return row;
  }));

  // ---- 12b. Bulk-mapping grid data (question bank + competency catalogue) --
  //   LITERAL paths — registered before the /:questionId & /:competencyId params.
  app.get('/api/competency-runtime/mapping-grid', gate, requireAuth, requireSuperAdmin, wrap(async (req) =>
    getMappingGrid(pool, {
      search: req.query.search ? String(req.query.search) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    }),
  ));

  // ---- 12c. Read the current competency→question map (grouped) ------------
  app.get('/api/competency-runtime/competency-map', gate, requireAuth, requireSuperAdmin, wrap(async (req) =>
    getCompetencyQuestionMap(pool, {
      competencyId: req.query.competency_id ? String(req.query.competency_id) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      activeOnly: req.query.active_only === '1' || req.query.active_only === 'true',
    }),
  ));

  // ---- 12d. Bulk-map many question→competency pairs at once ---------------
  app.post('/api/competency-runtime/competency-map/bulk', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const b = req.body ?? {};
    const pairs = Array.isArray(b.pairs) ? b.pairs.map((p: any) => ({
      competency_id: String(p?.competency_id ?? p?.competencyId ?? ''),
      question_id: String(p?.question_id ?? p?.questionId ?? ''),
    })) : [];
    const result = await bulkMapCompetencyQuestions(pool, { pairs, source: b.source });
    if (!result.ok) { res.status(400).json(result); return undefined; }
    return result;
  }));

  // ---- 13. Competency → Question Pool -------------------------------------
  app.get('/api/competency-runtime/competencies/:competencyId/question-pool', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const result = await getQuestionPool(pool, String(req.params.competencyId));
    if (!result.competency_found) { res.status(404).json({ ok: false, error: 'competency_not_found' }); return undefined; }
    return result;
  }));

  // ---- 14. Build (derive or author) a competency's question blueprint -----
  app.post('/api/competency-runtime/competencies/:competencyId/question-blueprint', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const b = req.body ?? {};
    const result = await buildQuestionBlueprint(pool, String(req.params.competencyId), {
      poolTarget: b.pool_target ?? b.poolTarget,
      difficultyDistribution: b.difficulty_distribution ?? b.difficultyDistribution,
      typeDistribution: b.type_distribution ?? b.typeDistribution,
      source: b.source,
    });
    if (!result.ok) {
      const code = result.error === 'competency_not_found' ? 404
        : result.error === 'invalid_blueprint' ? 400
        : 400;
      res.status(code).json({ ok: false, error: result.error, validation: (result as any).validation });
      return undefined;
    }
    return result;
  }));

  // ---- 15. Read a competency's question blueprint -------------------------
  app.get('/api/competency-runtime/competencies/:competencyId/question-blueprint', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const row = await getQuestionBlueprint(pool, String(req.params.competencyId));
    if (!row.competency_found) { res.status(404).json({ ok: false, error: 'competency_not_found' }); return undefined; }
    return row;
  }));

  // ===== Phase 2.3 — Assessment Assembly Engine ===========================
  //   Role → Assessment Blueprint → Question Selection → Assessment Generation.
  //   No duplicate questions · competency coverage · blueprint coverage ·
  //   difficulty balancing · question randomization.

  // ---- 16. Assemble (build → validate → persist) an assessment ------------
  app.post('/api/competency-runtime/blueprints/:blueprintId/assemble', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const b = req.body ?? {};
    const result = await generateAssembledAssessment(pool, String(req.params.blueprintId), {
      total: b.total != null ? Number(b.total) : null,
      seed: b.seed != null ? Number(b.seed) : null,
      persist: b.persist !== false,
      tolerancePct: b.tolerance_pct != null ? Number(b.tolerance_pct) : undefined,
    });
    if (!result.ok) {
      const code = result.error === 'blueprint_not_found' ? 404 : 400;
      res.status(code).json({ ok: false, error: result.error });
      return undefined;
    }
    return result;
  }));

  // ---- 17. Preview an assessment (build + validate, NO persist) -----------
  app.post('/api/competency-runtime/blueprints/:blueprintId/assessment-preview', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const b = req.body ?? {};
    const result = await generateAssembledAssessment(pool, String(req.params.blueprintId), {
      total: b.total != null ? Number(b.total) : null,
      seed: b.seed != null ? Number(b.seed) : null,
      persist: false,
      tolerancePct: b.tolerance_pct != null ? Number(b.tolerance_pct) : undefined,
    });
    if (!result.ok) {
      const code = result.error === 'blueprint_not_found' ? 404 : 400;
      res.status(code).json({ ok: false, error: result.error });
      return undefined;
    }
    return result;
  }));

  // ---- 18. Read a stored assembled assessment ----------------------------
  app.get('/api/competency-runtime/assembled-assessments/:assessmentId', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const row = await getAssembledAssessment(pool, String(req.params.assessmentId));
    if (!row) { res.status(404).json({ ok: false, error: 'assessment_not_found' }); return undefined; }
    return row;
  }));

  // ---- 19. Re-validate a stored assembled assessment ---------------------
  app.post('/api/competency-runtime/assembled-assessments/:assessmentId/validate', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const b = req.body ?? {};
    const row = await getAssembledAssessment(pool, String(req.params.assessmentId));
    if (!row) { res.status(404).json({ ok: false, error: 'assessment_not_found' }); return undefined; }
    const questions: AssembledQuestion[] = Array.isArray(row.questions) ? row.questions : [];
    const result = await validateAssessment(pool, String(row.blueprint_id), questions, {
      tolerancePct: b.tolerance_pct != null ? Number(b.tolerance_pct) : undefined,
    });
    if (!result.ok) {
      const code = result.error === 'blueprint_not_found' ? 404 : 400;
      res.status(code).json({ ok: false, error: result.error });
      return undefined;
    }
    return { assessment_id: row.id, blueprint_id: row.blueprint_id, total_questions: questions.length, validation: result.validation };
  }));

  // ====================================================================
  // Phase 2.4 — Competency Scoring Engine
  //   Question -> Raw Score -> Competency Score -> Normalized Score -> Level
  // ====================================================================
  const parseScoreBody = (b: any): { responses: ScoreResponseInput[]; cohorts: Record<string, CohortRef> | undefined } => {
    const responses: ScoreResponseInput[] = Array.isArray(b?.responses) ? b.responses : [];
    let cohorts: Record<string, CohortRef> | undefined;
    if (b?.cohorts && typeof b.cohorts === 'object') {
      cohorts = {};
      for (const [k, v] of Object.entries(b.cohorts as Record<string, any>)) {
        if (v && Number.isFinite(Number(v.mean)) && Number.isFinite(Number(v.sd)) && Number.isFinite(Number(v.n))) {
          cohorts[k] = { mean: Number(v.mean), sd: Number(v.sd), n: Number(v.n) };
        }
      }
    }
    return { responses, cohorts };
  };

  // ---- 20. Score a set of responses (compute + persist) ------------------
  app.post('/api/competency-runtime/score', gate, requireAuth, requireSuperAdmin, wrap(async (req) => {
    const b = req.body ?? {};
    const { responses, cohorts } = parseScoreBody(b);
    return scoreAssessmentRun(pool, {
      responses,
      assessment_id: b.assessment_id != null ? String(b.assessment_id) : null,
      blueprint_id: b.blueprint_id != null ? String(b.blueprint_id) : null,
      subject_id: b.subject_id != null ? String(b.subject_id) : null,
      cohorts,
      persist: b.persist !== false,
      source: b.source != null ? String(b.source) : undefined,
    });
  }));

  // ---- 21. Score preview (compute, NO persist) ---------------------------
  app.post('/api/competency-runtime/score-preview', gate, requireAuth, requireSuperAdmin, wrap(async (req) => {
    const b = req.body ?? {};
    const { responses, cohorts } = parseScoreBody(b);
    return scoreAssessmentRun(pool, {
      responses,
      assessment_id: b.assessment_id != null ? String(b.assessment_id) : null,
      blueprint_id: b.blueprint_id != null ? String(b.blueprint_id) : null,
      subject_id: b.subject_id != null ? String(b.subject_id) : null,
      cohorts,
      persist: false,
    });
  }));

  // ---- 22. Read a stored scoring run -------------------------------------
  app.get('/api/competency-runtime/score-runs/:runId', gate, requireAuth, requireSuperAdmin, wrap(async (req, res) => {
    const row = await getScoreRun(pool, String(req.params.runId));
    if (!row) { res.status(404).json({ ok: false, error: 'score_run_not_found' }); return undefined; }
    return row;
  }));
}
