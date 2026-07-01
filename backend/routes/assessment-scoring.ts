/**
 * CAPADEX 3.0 — Program 3 · Phase 3.5 Assessment Measurement & Scoring Engine routes.
 *
 * A read-only certification composer over the ONE canonical Assessment Scoring model + the
 * reuse-before-build engineering-closure mechanisms. SEVEN INDEPENDENT dimensions certified SEPARATELY:
 *   measurement_engine · scoring_engine · formula_engine · rule_engine · validation · apis · frontend.
 * Scope is MEASUREMENT & SCORING ONLY — responses→measurable scores/indicators. NOT psychometrics/
 * item-analysis/reliability/validity/norms/standardization/benchmark/AI/reports (Phase 3.6+).
 *
 * READ (certification):
 *   - GET /api/assessment-scoring/enabled                     flag probe (503 when OFF)
 *   - GET /api/admin/assessment-scoring/model                 canonical registry
 *   - GET /api/admin/assessment-scoring/dimensions            the 7 dimensions, evidence VERIFIED vs live FS+DB
 *   - GET /api/admin/assessment-scoring/scoring-models        13-model scoring catalog
 *   - GET /api/admin/assessment-scoring/response-processing   response-processing catalog
 *   - GET /api/admin/assessment-scoring/measurement-types     9-type measurement catalog
 *   - GET /api/admin/assessment-scoring/rules                 8 scoring rules
 *   - GET /api/admin/assessment-scoring/configuration         5 scoring-config capabilities
 *   - GET /api/admin/assessment-scoring/validation            4 validation checks
 *   - GET /api/admin/assessment-scoring/mapping               10-dimension mapping model
 *   - GET /api/admin/assessment-scoring/repository-alignment  evidence rollup vs live FS+DB
 *   - GET /api/admin/assessment-scoring/adoption              SEPARATE usage axis (never a gap)
 *   - GET /api/admin/assessment-scoring/gaps                  OPEN + RESOLVED gaps
 *   - GET /api/admin/assessment-scoring/summary               7 dimensions reported SEPARATELY + verdict + 3.6 readiness
 *
 * MECHANISMS (reuse-before-build; the ONLY DDL sites — run behind flag + super-admin → OFF creates 0 tables):
 *   configs/{upsert,list,:key} · formulas/{upsert,list} · rules/{upsert,list} ·
 *   scores/{save,list} · measurements/{save,list} · validations/list ·
 *   compute/score · validate/{formula,rule,config,responses} (PURE, no DB — no eval).
 *
 * Strictly additive + reversible + flag-gated (`assessmentScoring`, FF_ASSESSMENT_SCORING, default OFF):
 * OFF → every route 503 (503-before-auth) → byte-identical legacy incl. schema (no table touched).
 * Never throws: unexpected errors degrade to a 200 honest-degraded JSON. Coverage⟂Confidence⟂Adoption; null≠0.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  AS_AXES, AS_DIMENSIONS, SCORING_MODELS, RESPONSE_PROCESSING, MEASUREMENT_TYPES,
  SCORING_RULES, SCORING_CONFIG, VALIDATION_CHECKS, MAPPING_MODEL, AS_DECISIONS,
} from '../config/assessment-scoring';
import {
  composeDimensions, composeScoringModels, composeResponseProcessing, composeMeasurementTypes,
  composeScoringRules, composeScoringConfig, composeValidationChecks, composeMapping,
  composeRepositoryAlignment, composeAdoption, classifiedGaps, composeSummary,
} from '../services/assessment-scoring-engine';
import {
  upsertConfig, listConfigs, getConfig,
  upsertFormula, listFormulas,
  upsertRule, listRules,
  saveScore, listScores,
  saveMeasurement, listMeasurements,
  recordValidation, listValidations,
  computeScore, validateFormula, validateRule, validateConfig, validateResponses,
} from '../services/assessment-scoring-mechanisms';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('assessmentScoring')) {
    return res.status(503).json({ ok: false, error: 'assessment_scoring_disabled' });
  }
  next();
}

function degraded(res: Response, tag: string, err: unknown) {
  console.error(`[assessment-scoring] ${tag} error:`, err);
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
}

function actorOf(req: Request): string | undefined {
  const u = (req as unknown as { user?: { email?: string; username?: string } }).user;
  return u?.email || u?.username || undefined;
}

export function registerAssessmentScoringRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const g = [flagGate, requireAuth, requireSuperAdmin];

  // Flag probe (flag STATE is not sensitive). 503 when OFF; res.ok=true only when ON.
  app.get('/api/assessment-scoring/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // Canonical model (static registry — no DB read).
  app.get('/api/admin/assessment-scoring/model', ...g, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true, platform_frozen: true,
        axes: AS_AXES, dimensions: AS_DIMENSIONS,
        scoring_models: SCORING_MODELS, response_processing: RESPONSE_PROCESSING,
        measurement_types: MEASUREMENT_TYPES, scoring_rules: SCORING_RULES,
        scoring_config: SCORING_CONFIG, validation_checks: VALIDATION_CHECKS,
        mapping_model: MAPPING_MODEL, decisions: AS_DECISIONS,
      });
    } catch (err) { degraded(res, 'model', err); }
  });

  app.get('/api/admin/assessment-scoring/dimensions', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, dimensions: await composeDimensions(pool) }); }
    catch (err) { degraded(res, 'dimensions', err); }
  });

  app.get('/api/admin/assessment-scoring/scoring-models', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, scoring_models: composeScoringModels() }); }
    catch (err) { degraded(res, 'scoring-models', err); }
  });

  app.get('/api/admin/assessment-scoring/response-processing', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, response_processing: composeResponseProcessing() }); }
    catch (err) { degraded(res, 'response-processing', err); }
  });

  app.get('/api/admin/assessment-scoring/measurement-types', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, measurement_types: await composeMeasurementTypes(pool) }); }
    catch (err) { degraded(res, 'measurement-types', err); }
  });

  app.get('/api/admin/assessment-scoring/rules', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, rules: await composeScoringRules(pool) }); }
    catch (err) { degraded(res, 'rules', err); }
  });

  app.get('/api/admin/assessment-scoring/configuration', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, configuration: await composeScoringConfig(pool) }); }
    catch (err) { degraded(res, 'configuration', err); }
  });

  app.get('/api/admin/assessment-scoring/validation', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, validation: await composeValidationChecks(pool) }); }
    catch (err) { degraded(res, 'validation', err); }
  });

  app.get('/api/admin/assessment-scoring/mapping', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, mapping: await composeMapping(pool) }); }
    catch (err) { degraded(res, 'mapping', err); }
  });

  app.get('/api/admin/assessment-scoring/repository-alignment', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, repository_alignment: await composeRepositoryAlignment(pool) }); }
    catch (err) { degraded(res, 'repository-alignment', err); }
  });

  app.get('/api/admin/assessment-scoring/adoption', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, adoption: await composeAdoption(pool) }); }
    catch (err) { degraded(res, 'adoption', err); }
  });

  app.get('/api/admin/assessment-scoring/gaps', ...g, async (_req: Request, res: Response) => {
    try {
      const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();
      res.json({ ok: true, gaps, gap_counts, gap_total: gaps.length, resolved_gaps, resolved_gap_counts, resolved_gap_count });
    } catch (err) { degraded(res, 'gaps', err); }
  });

  app.get('/api/admin/assessment-scoring/summary', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, summary: await composeSummary(pool) }); }
    catch (err) { degraded(res, 'summary', err); }
  });

  // ── MECHANISMS — reuse-before-build. The ONLY DDL sites (behind flag + super-admin). ──

  // Configurations — literal /upsert BEFORE the /:key param route.
  app.post('/api/admin/assessment-scoring/configs/upsert', ...g, async (req: Request, res: Response) => {
    try {
      const config_key = String(req.body?.config_key || '').trim();
      if (!config_key) return res.status(400).json({ ok: false, error: 'config_key_required' });
      res.json({ ok: true, result: await upsertConfig(pool, { ...req.body, config_key, owner: req.body?.owner ?? actorOf(req) }) });
    } catch (err) { degraded(res, 'configs-upsert', err); }
  });

  app.get('/api/admin/assessment-scoring/configs', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, configs: await listConfigs(pool) }); }
    catch (err) { degraded(res, 'configs-list', err); }
  });

  app.get('/api/admin/assessment-scoring/configs/:key', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, config: await getConfig(pool, String(req.params.key)) }); }
    catch (err) { degraded(res, 'config-get', err); }
  });

  // Formulas
  app.post('/api/admin/assessment-scoring/formulas/upsert', ...g, async (req: Request, res: Response) => {
    try {
      const formula_key = String(req.body?.formula_key || '').trim();
      if (!formula_key) return res.status(400).json({ ok: false, error: 'formula_key_required' });
      res.json({ ok: true, result: await upsertFormula(pool, { ...req.body, formula_key, owner: req.body?.owner ?? actorOf(req) }) });
    } catch (err) { degraded(res, 'formulas-upsert', err); }
  });

  app.get('/api/admin/assessment-scoring/formulas', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, formulas: await listFormulas(pool) }); }
    catch (err) { degraded(res, 'formulas-list', err); }
  });

  // Rules
  app.post('/api/admin/assessment-scoring/rules/upsert', ...g, async (req: Request, res: Response) => {
    try {
      const rule_key = String(req.body?.rule_key || '').trim();
      if (!rule_key) return res.status(400).json({ ok: false, error: 'rule_key_required' });
      res.json({ ok: true, result: await upsertRule(pool, { ...req.body, rule_key }) });
    } catch (err) { degraded(res, 'rules-upsert', err); }
  });

  app.get('/api/admin/assessment-scoring/rules/list', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, rules: await listRules(pool) }); }
    catch (err) { degraded(res, 'rules-list', err); }
  });

  // Scores — literal /save BEFORE the /:key param route.
  app.post('/api/admin/assessment-scoring/scores/save', ...g, async (req: Request, res: Response) => {
    try {
      const score_key = String(req.body?.score_key || '').trim();
      if (!score_key) return res.status(400).json({ ok: false, error: 'score_key_required' });
      res.json({ ok: true, result: await saveScore(pool, { ...req.body, score_key }) });
    } catch (err) { degraded(res, 'scores-save', err); }
  });

  app.get('/api/admin/assessment-scoring/scores', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, scores: await listScores(pool, req.query.subject_ref ? String(req.query.subject_ref) : undefined) }); }
    catch (err) { degraded(res, 'scores-list', err); }
  });

  // Measurements — literal /save BEFORE the list route.
  app.post('/api/admin/assessment-scoring/measurements/save', ...g, async (req: Request, res: Response) => {
    try {
      const measure_key = String(req.body?.measure_key || '').trim();
      if (!measure_key) return res.status(400).json({ ok: false, error: 'measure_key_required' });
      res.json({ ok: true, result: await saveMeasurement(pool, { ...req.body, measure_key }) });
    } catch (err) { degraded(res, 'measurements-save', err); }
  });

  app.get('/api/admin/assessment-scoring/measurements', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, measurements: await listMeasurements(pool, req.query.subject_ref ? String(req.query.subject_ref) : undefined) }); }
    catch (err) { degraded(res, 'measurements-list', err); }
  });

  app.get('/api/admin/assessment-scoring/validations', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, validations: await listValidations(pool) }); }
    catch (err) { degraded(res, 'validations-list', err); }
  });

  // ── PURE COMPUTE / VALIDATE mechanisms — no DB, no DDL, no eval. Power the score
  // preview + validation console. Flag-gated + super-admin like every other route.
  // These are read-only computations; they persist ONLY when persist=true is passed. ──

  app.post('/api/admin/assessment-scoring/compute/score', ...g, async (req: Request, res: Response) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      const options = (req.body?.options && typeof req.body.options === 'object') ? req.body.options : {};
      const result = computeScore(items, options);
      // Optional persistence: only when explicitly requested (write path → DDL behind flag).
      let saved: unknown = null;
      if (req.body?.persist === true && req.body?.score_key) {
        saved = await saveScore(pool, {
          score_key: String(req.body.score_key), assessment_slug: req.body?.assessment_slug,
          subject_ref: req.body?.subject_ref, scoring_model: result.model,
          raw: result.raw, value: result.value, maximum: result.maximum, breakdown: result,
        });
      }
      res.json({ ok: true, result, saved });
    } catch (err) { degraded(res, 'compute-score', err); }
  });

  app.post('/api/admin/assessment-scoring/validate/formula', ...g, async (req: Request, res: Response) => {
    try {
      const result = validateFormula(req.body?.formula);
      let recorded: unknown = null;
      if (req.body?.persist === true) recorded = await recordValidation(pool, 'formula', req.body?.target_ref ?? null, result);
      res.json({ ok: true, result, recorded });
    } catch (err) { degraded(res, 'validate-formula', err); }
  });

  app.post('/api/admin/assessment-scoring/validate/rule', ...g, async (req: Request, res: Response) => {
    try {
      const result = validateRule(req.body?.rule);
      let recorded: unknown = null;
      if (req.body?.persist === true) recorded = await recordValidation(pool, 'rule', req.body?.target_ref ?? null, result);
      res.json({ ok: true, result, recorded });
    } catch (err) { degraded(res, 'validate-rule', err); }
  });

  app.post('/api/admin/assessment-scoring/validate/config', ...g, async (req: Request, res: Response) => {
    try {
      const result = validateConfig(req.body?.config);
      let recorded: unknown = null;
      if (req.body?.persist === true) recorded = await recordValidation(pool, 'config', req.body?.target_ref ?? null, result);
      res.json({ ok: true, result, recorded });
    } catch (err) { degraded(res, 'validate-config', err); }
  });

  app.post('/api/admin/assessment-scoring/validate/responses', ...g, async (req: Request, res: Response) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : req.body?.responses;
      const result = validateResponses(items);
      let recorded: unknown = null;
      if (req.body?.persist === true) recorded = await recordValidation(pool, 'responses', req.body?.target_ref ?? null, result);
      res.json({ ok: true, result, recorded });
    } catch (err) { degraded(res, 'validate-responses', err); }
  });
}
