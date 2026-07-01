/**
 * CAPADEX 3.0 — Program 3 · Phase 3.8 Enterprise Score Standardization & Interpretation routes.
 *
 * A read-only certification composer over the ONE canonical Score Standardization model + the
 * reuse-before-build engineering-closure mechanisms. TEN INDEPENDENT dimensions certified SEPARATELY:
 *   standardization · formula · interpretation · governance · super_admin · frontend · ux · apis ·
 *   testing · documentation.
 * Scope is STANDARDIZATION & INTERPRETATION ONLY — it turns a SCORED + VALIDATED result + norm
 * reference into standard scores, performance bands and deterministic interpretation-rule verdicts and
 * NEVER re-scores, re-validates the instrument or builds a norm. Benchmark / AI-interpretation /
 * recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases) —
 * reported in-line as boundaries, NOT gaps.
 *
 * READ (certification):
 *   - GET /api/score-standardization/enabled                     flag probe (503 when OFF)
 *   - GET /api/admin/score-standardization/model                 canonical registry
 *   - GET /api/admin/score-standardization/dimensions            the 10 dimensions, evidence VERIFIED vs live FS+DB
 *   - GET /api/admin/score-standardization/standard-score-types  12 standard-score types
 *   - GET /api/admin/score-standardization/performance-bands     9 performance bands
 *   - GET /api/admin/score-standardization/interpretation-rule-types 9 interpretation rule types
 *   - GET /api/admin/score-standardization/config-scopes         8 standardization config scopes
 *   - GET /api/admin/score-standardization/formula-capabilities  6 formula-engine capabilities, evidence-verified
 *   - GET /api/admin/score-standardization/governance-states     10 governance states, evidence-verified
 *   - GET /api/admin/score-standardization/validation-checks     7 validation checks, evidence-verified
 *   - GET /api/admin/score-standardization/super-admin-surfaces  8 super-admin surfaces, evidence-verified
 *   - GET /api/admin/score-standardization/frontend-surfaces     10 frontend surfaces, evidence-verified
 *   - GET /api/admin/score-standardization/ux-criteria           12 ux criteria, evidence-verified
 *   - GET /api/admin/score-standardization/traceability          6-link provenance chain, evidence-verified
 *   - GET /api/admin/score-standardization/repository-alignment  evidence rollup vs live FS+DB
 *   - GET /api/admin/score-standardization/adoption              SEPARATE usage axis (never a gap)
 *   - GET /api/admin/score-standardization/gaps                  OPEN + RESOLVED gaps
 *   - GET /api/admin/score-standardization/summary               10 dimensions reported SEPARATELY + verdict
 *
 * MECHANISMS (reuse-before-build; the ONLY DDL sites — run behind flag + super-admin → OFF creates 0 tables):
 *   compute/{standard-scores,formula/validate,formula/evaluate,band,interpretation,validation} (PURE, no
 *   DB — reuse the pure psychometric-standardization functions + structured-AST engine — NO eval) ·
 *   formulas/{save,list} · standard-scores/{save,list} · bands/{save,list} ·
 *   interpretation-rules/{save,list} · configs/{save,list} · governance/{transition,log} · validations/{save,list}.
 *
 * Strictly additive + reversible + flag-gated (`scoreStandardization`, FF_SCORE_STANDARDIZATION, default OFF):
 * OFF → every route 503 (503-before-auth) → byte-identical legacy incl. schema (no table touched).
 * Never throws: unexpected errors degrade to a 200 honest-degraded JSON. Coverage⟂Confidence⟂Adoption; null≠0.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  STD_AXES, STD_DIMENSIONS, STANDARD_SCORE_TYPES, PERFORMANCE_BANDS,
  INTERPRETATION_RULE_TYPES, STANDARDIZATION_CONFIG_SCOPES, FORMULA_CAPABILITIES,
  GOVERNANCE_STATES, VALIDATION_CHECKS, SUPER_ADMIN_SURFACES, FRONTEND_SURFACES,
  UX_CRITERIA, TRACEABILITY_MODEL, STD_DECISIONS, STD_K_MIN,
} from '../config/score-standardization';
import {
  composeDimensions, composeStandardScoreTypes, composePerformanceBands,
  composeInterpretationRuleTypes, composeConfigScopes, composeFormulaCapabilities,
  composeGovernanceStates, composeValidationChecks, composeSuperAdminSurfaces,
  composeFrontendSurfaces, composeUxCriteria, composeTraceability,
  composeRepositoryAlignment, composeAdoption, classifiedGaps, composeSummary,
} from '../services/score-standardization-engine';
import {
  computeStandardScoreSet, validateFormula, evaluateFormula, classifyBand,
  evaluateInterpretationRule, validateDistribution, validateRange, validateBoundary, validateStatistical,
  saveFormula, listFormulas, saveStandardScore, listStandardScores,
  saveBandSet, listBandSets, saveInterpretationRule, listInterpretationRules,
  saveConfig, listConfigs, recordGovernanceTransition, listGovernanceLog,
  saveValidation, listValidations,
} from '../services/score-standardization-mechanisms';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('scoreStandardization')) {
    return res.status(503).json({ ok: false, error: 'score_standardization_disabled' });
  }
  next();
}

function degraded(res: Response, tag: string, err: unknown) {
  console.error(`[score-standardization] ${tag} error:`, err);
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
}

export function registerScoreStandardizationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const g = [flagGate, requireAuth, requireSuperAdmin];

  // Flag probe (flag STATE is not sensitive). 503 when OFF; res.ok=true only when ON.
  app.get('/api/score-standardization/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // Canonical model (static registry — no DB read).
  app.get('/api/admin/score-standardization/model', ...g, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true, platform_frozen: true, k_min: STD_K_MIN,
        axes: STD_AXES, dimensions: STD_DIMENSIONS,
        standard_score_types: STANDARD_SCORE_TYPES, performance_bands: PERFORMANCE_BANDS,
        interpretation_rule_types: INTERPRETATION_RULE_TYPES, config_scopes: STANDARDIZATION_CONFIG_SCOPES,
        formula_capabilities: FORMULA_CAPABILITIES, governance_states: GOVERNANCE_STATES,
        validation_checks: VALIDATION_CHECKS, super_admin_surfaces: SUPER_ADMIN_SURFACES,
        frontend_surfaces: FRONTEND_SURFACES, ux_criteria: UX_CRITERIA,
        traceability_model: TRACEABILITY_MODEL, decisions: STD_DECISIONS,
      });
    } catch (err) { degraded(res, 'model', err); }
  });

  app.get('/api/admin/score-standardization/dimensions', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, dimensions: await composeDimensions(pool) }); }
    catch (err) { degraded(res, 'dimensions', err); }
  });

  app.get('/api/admin/score-standardization/standard-score-types', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, standard_score_types: composeStandardScoreTypes() }); }
    catch (err) { degraded(res, 'standard-score-types', err); }
  });

  app.get('/api/admin/score-standardization/performance-bands', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, performance_bands: composePerformanceBands() }); }
    catch (err) { degraded(res, 'performance-bands', err); }
  });

  app.get('/api/admin/score-standardization/interpretation-rule-types', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, interpretation_rule_types: composeInterpretationRuleTypes() }); }
    catch (err) { degraded(res, 'interpretation-rule-types', err); }
  });

  app.get('/api/admin/score-standardization/config-scopes', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, config_scopes: composeConfigScopes() }); }
    catch (err) { degraded(res, 'config-scopes', err); }
  });

  app.get('/api/admin/score-standardization/formula-capabilities', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, formula_capabilities: await composeFormulaCapabilities(pool) }); }
    catch (err) { degraded(res, 'formula-capabilities', err); }
  });

  app.get('/api/admin/score-standardization/governance-states', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, governance_states: await composeGovernanceStates(pool) }); }
    catch (err) { degraded(res, 'governance-states', err); }
  });

  app.get('/api/admin/score-standardization/validation-checks', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, validation_checks: await composeValidationChecks(pool) }); }
    catch (err) { degraded(res, 'validation-checks', err); }
  });

  app.get('/api/admin/score-standardization/super-admin-surfaces', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, super_admin_surfaces: await composeSuperAdminSurfaces(pool) }); }
    catch (err) { degraded(res, 'super-admin-surfaces', err); }
  });

  app.get('/api/admin/score-standardization/frontend-surfaces', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, frontend_surfaces: await composeFrontendSurfaces(pool) }); }
    catch (err) { degraded(res, 'frontend-surfaces', err); }
  });

  app.get('/api/admin/score-standardization/ux-criteria', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ux_criteria: await composeUxCriteria(pool) }); }
    catch (err) { degraded(res, 'ux-criteria', err); }
  });

  app.get('/api/admin/score-standardization/traceability', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, traceability: await composeTraceability(pool) }); }
    catch (err) { degraded(res, 'traceability', err); }
  });

  app.get('/api/admin/score-standardization/repository-alignment', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, repository_alignment: await composeRepositoryAlignment(pool) }); }
    catch (err) { degraded(res, 'repository-alignment', err); }
  });

  app.get('/api/admin/score-standardization/adoption', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, adoption: await composeAdoption(pool) }); }
    catch (err) { degraded(res, 'adoption', err); }
  });

  app.get('/api/admin/score-standardization/gaps', ...g, async (_req: Request, res: Response) => {
    try {
      const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();
      res.json({ ok: true, gaps, gap_counts, gap_total: gaps.length, resolved_gaps, resolved_gap_counts, resolved_gap_count });
    } catch (err) { degraded(res, 'gaps', err); }
  });

  app.get('/api/admin/score-standardization/summary', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, summary: await composeSummary(pool) }); }
    catch (err) { degraded(res, 'summary', err); }
  });

  // ── PURE COMPUTE mechanisms — no DB, no DDL, no eval. Reuse the pure psychometric-standardization
  // functions + the structured-AST formula interpreter. Norm-referenced standardization ABSTAINS below
  // k_min real members (never fabricated). Persist ONLY when persist=true (write path → DDL behind flag). ──

  app.post('/api/admin/score-standardization/compute/standard-scores', ...g, async (req: Request, res: Response) => {
    try {
      const { value, mean, sd, n } = req.body || {};
      const kMin = req.body?.k_min == null ? undefined : Number(req.body.k_min);
      const result = computeStandardScoreSet(
        value == null ? null : Number(value), mean == null ? null : Number(mean), sd == null ? null : Number(sd),
        n == null ? STD_K_MIN : Number(n), kMin == null ? {} : { k_min: kMin },
      );
      let saved: unknown = null;
      if (req.body?.persist === true && req.body?.score_key) {
        saved = await saveStandardScore(pool, {
          score_key: String(req.body.score_key), subject_ref: req.body?.subject_ref,
          assessment_slug: req.body?.assessment_slug, score_type: req.body?.score_type,
          raw_value: result.input.value, z: result.z, percentile: result.percentile,
          t_score: result.t_score, standard_score: result.standard_score, stanine: result.stanine,
          sten: result.sten, band: result.band, assessment_version: req.body?.assessment_version,
          formula_key: req.body?.formula_key, norm_key: req.body?.norm_key,
          config_key: req.body?.config_key, rule_key: req.body?.rule_key,
          abstained: result.abstained, detail: result,
        });
      }
      res.json({ ok: true, result, saved });
    } catch (err) { degraded(res, 'compute-standard-scores', err); }
  });

  app.post('/api/admin/score-standardization/compute/formula/validate', ...g, async (req: Request, res: Response) => {
    try {
      const knownVars = Array.isArray(req.body?.knownVars) ? req.body.knownVars.map(String) : undefined;
      res.json({ ok: true, result: validateFormula(req.body?.ast, knownVars) });
    } catch (err) { degraded(res, 'compute-formula-validate', err); }
  });

  app.post('/api/admin/score-standardization/compute/formula/evaluate', ...g, async (req: Request, res: Response) => {
    try {
      const vars = (req.body?.vars && typeof req.body.vars === 'object') ? req.body.vars : {};
      const validation = validateFormula(req.body?.ast);
      const value = validation.valid ? evaluateFormula(req.body?.ast, vars) : null;
      res.json({ ok: true, result: { value, validation } });
    } catch (err) { degraded(res, 'compute-formula-evaluate', err); }
  });

  app.post('/api/admin/score-standardization/compute/band', ...g, async (req: Request, res: Response) => {
    try {
      const percentile = req.body?.percentile == null ? null : Number(req.body.percentile);
      const customBands = Array.isArray(req.body?.bands) ? req.body.bands : undefined;
      res.json({ ok: true, result: classifyBand(percentile, customBands) });
    } catch (err) { degraded(res, 'compute-band', err); }
  });

  app.post('/api/admin/score-standardization/compute/interpretation', ...g, async (req: Request, res: Response) => {
    try {
      const input = (req.body?.input && typeof req.body.input === 'object') ? req.body.input : req.body || {};
      const result = evaluateInterpretationRule({
        ref: input?.ref, rule_type: input?.rule_type,
        percentile: input?.percentile == null ? null : Number(input.percentile),
        customBands: Array.isArray(input?.customBands) ? input.customBands : undefined,
        verdicts: Array.isArray(input?.verdicts) ? input.verdicts : undefined,
      });
      let saved: unknown = null;
      if (req.body?.persist === true && req.body?.interp_key) {
        saved = await saveInterpretationRule(pool, {
          rule_key: String(req.body.interp_key), rule_type: result.rule_type,
          verdicts: Array.isArray(input?.verdicts) ? input.verdicts : undefined, detail: result,
        });
      }
      res.json({ ok: true, result, saved });
    } catch (err) { degraded(res, 'compute-interpretation', err); }
  });

  app.post('/api/admin/score-standardization/compute/validation', ...g, async (req: Request, res: Response) => {
    try {
      const checkType = String(req.body?.check_type || 'distribution');
      const input = (req.body?.input && typeof req.body.input === 'object') ? req.body.input : req.body || {};
      let result;
      if (checkType === 'formula') {
        const v = validateFormula(input?.ast, Array.isArray(input?.knownVars) ? input.knownVars.map(String) : undefined);
        result = { check_type: 'formula', passed: v.valid, errors: v.errors, detail: v };
      } else if (checkType === 'range') {
        result = validateRange(input?.value == null ? null : Number(input.value), Number(input?.min ?? 0), Number(input?.max ?? 100));
      } else if (checkType === 'boundary') {
        result = validateBoundary(Array.isArray(input?.bands) ? input.bands : []);
      } else if (checkType === 'statistical') {
        result = validateStatistical({ mean: input?.mean == null ? null : Number(input.mean), sd: input?.sd == null ? null : Number(input.sd) });
      } else {
        const kMin = input?.k_min == null ? undefined : Number(input.k_min);
        result = validateDistribution(
          { n: input?.n == null ? null : Number(input.n), mean: input?.mean == null ? null : Number(input.mean), sd: input?.sd == null ? null : Number(input.sd) },
          kMin == null ? {} : { k_min: kMin },
        );
      }
      let saved: unknown = null;
      if (req.body?.persist === true && req.body?.validation_key) {
        saved = await saveValidation(pool, {
          validation_key: String(req.body.validation_key), artefact_type: req.body?.artefact_type,
          artefact_key: req.body?.artefact_key, check_type: result.check_type, passed: result.passed,
          errors: result.errors, detail: result.detail,
        });
      }
      res.json({ ok: true, result, saved });
    } catch (err) { degraded(res, 'compute-validation', err); }
  });

  // ── OVERLAY WRITES + LISTS — the ONLY DDL sites (behind flag + super-admin). ──
  // Literal /save + /list routes are distinct paths (no /:param collision).

  app.post('/api/admin/score-standardization/formulas/save', ...g, async (req: Request, res: Response) => {
    try {
      const formula_key = String(req.body?.formula_key || '').trim();
      if (!formula_key) return res.status(400).json({ ok: false, error: 'formula_key_required' });
      res.json({ ok: true, result: await saveFormula(pool, { ...req.body, formula_key }) });
    } catch (err) { degraded(res, 'formulas-save', err); }
  });

  app.get('/api/admin/score-standardization/formulas', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, formulas: await listFormulas(pool, req.query.formula_key ? String(req.query.formula_key) : undefined) }); }
    catch (err) { degraded(res, 'formulas-list', err); }
  });

  app.post('/api/admin/score-standardization/standard-scores/save', ...g, async (req: Request, res: Response) => {
    try {
      const score_key = String(req.body?.score_key || '').trim();
      if (!score_key) return res.status(400).json({ ok: false, error: 'score_key_required' });
      res.json({ ok: true, result: await saveStandardScore(pool, { ...req.body, score_key }) });
    } catch (err) { degraded(res, 'standard-scores-save', err); }
  });

  app.get('/api/admin/score-standardization/standard-scores/list', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, standard_scores: await listStandardScores(pool, req.query.subject_ref ? String(req.query.subject_ref) : undefined) }); }
    catch (err) { degraded(res, 'standard-scores-list', err); }
  });

  app.post('/api/admin/score-standardization/bands/save', ...g, async (req: Request, res: Response) => {
    try {
      const band_set_key = String(req.body?.band_set_key || '').trim();
      if (!band_set_key) return res.status(400).json({ ok: false, error: 'band_set_key_required' });
      res.json({ ok: true, result: await saveBandSet(pool, { ...req.body, band_set_key }) });
    } catch (err) { degraded(res, 'bands-save', err); }
  });

  app.get('/api/admin/score-standardization/bands', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, bands: await listBandSets(pool, req.query.band_set_key ? String(req.query.band_set_key) : undefined) }); }
    catch (err) { degraded(res, 'bands-list', err); }
  });

  app.post('/api/admin/score-standardization/interpretation-rules/save', ...g, async (req: Request, res: Response) => {
    try {
      const rule_key = String(req.body?.rule_key || '').trim();
      if (!rule_key) return res.status(400).json({ ok: false, error: 'rule_key_required' });
      res.json({ ok: true, result: await saveInterpretationRule(pool, { ...req.body, rule_key }) });
    } catch (err) { degraded(res, 'interpretation-rules-save', err); }
  });

  app.get('/api/admin/score-standardization/interpretation-rules', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, interpretation_rules: await listInterpretationRules(pool, req.query.rule_type ? String(req.query.rule_type) : undefined) }); }
    catch (err) { degraded(res, 'interpretation-rules-list', err); }
  });

  app.post('/api/admin/score-standardization/configs/save', ...g, async (req: Request, res: Response) => {
    try {
      const config_key = String(req.body?.config_key || '').trim();
      if (!config_key) return res.status(400).json({ ok: false, error: 'config_key_required' });
      res.json({ ok: true, result: await saveConfig(pool, { ...req.body, config_key }) });
    } catch (err) { degraded(res, 'configs-save', err); }
  });

  app.get('/api/admin/score-standardization/configs', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, configs: await listConfigs(pool, req.query.scope ? String(req.query.scope) : undefined) }); }
    catch (err) { degraded(res, 'configs-list', err); }
  });

  app.post('/api/admin/score-standardization/governance/transition', ...g, async (req: Request, res: Response) => {
    try {
      const artefact_type = String(req.body?.artefact_type || '').trim();
      const artefact_key = String(req.body?.artefact_key || '').trim();
      const to_state = String(req.body?.to_state || '').trim();
      if (!artefact_type || !artefact_key || !to_state) {
        return res.status(400).json({ ok: false, error: 'artefact_type_key_and_to_state_required' });
      }
      res.json({ ok: true, result: await recordGovernanceTransition(pool, { ...req.body, artefact_type, artefact_key, to_state }) });
    } catch (err) { degraded(res, 'governance-transition', err); }
  });

  app.get('/api/admin/score-standardization/governance', ...g, async (req: Request, res: Response) => {
    try {
      const artefactType = req.query.artefact_type ? String(req.query.artefact_type) : undefined;
      const artefactKey = req.query.artefact_key ? String(req.query.artefact_key) : undefined;
      res.json({ ok: true, governance: await listGovernanceLog(pool, artefactType, artefactKey) });
    } catch (err) { degraded(res, 'governance-list', err); }
  });

  app.post('/api/admin/score-standardization/validations/save', ...g, async (req: Request, res: Response) => {
    try {
      const validation_key = String(req.body?.validation_key || '').trim();
      if (!validation_key) return res.status(400).json({ ok: false, error: 'validation_key_required' });
      res.json({ ok: true, result: await saveValidation(pool, { ...req.body, validation_key }) });
    } catch (err) { degraded(res, 'validations-save', err); }
  });

  app.get('/api/admin/score-standardization/validations', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, validations: await listValidations(pool, req.query.artefact_key ? String(req.query.artefact_key) : undefined) }); }
    catch (err) { degraded(res, 'validations-list', err); }
  });
}
