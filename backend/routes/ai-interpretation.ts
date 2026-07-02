/**
 * CAPADEX 3.0 — Program 3 · Phase 3.10 Enterprise AI Interpretation & Explainability routes.
 *
 * A read-only certification composer over the ONE canonical AI Interpretation model + the
 * reuse-before-build engineering-closure mechanisms. ELEVEN INDEPENDENT dimensions certified SEPARATELY:
 *   ai_interpretation · explainability · confidence · hallucination_protection · rule_repository ·
 *   super_admin · frontend · ux · apis · testing · documentation.
 * Scope is INTERPRETATION, EXPLAINABILITY, CONFIDENCE & HALLUCINATION-PROTECTION ONLY — it turns a
 * STANDARDIZED score (3.8) + BENCHMARK result (3.9) into an interpreted, explainable, confidence-scored,
 * hallucination-protected result and NEVER re-scores, re-standardizes, re-benchmarks or builds a norm.
 * Recommendation / learning-path / growth-planning / report-generation / dashboard-intelligence are OUT OF
 * SCOPE (later phases) — reported in-line as boundaries, NOT gaps.
 *
 * READ (certification):
 *   - GET /api/ai-interpretation/enabled                         flag probe (503 when OFF)
 *   - GET /api/admin/ai-interpretation/model                     canonical registry
 *   - GET /api/admin/ai-interpretation/dimensions               the 11 dimensions, evidence VERIFIED vs live FS+DB
 *   - GET /api/admin/ai-interpretation/interpretation-kinds      10 interpretation kinds
 *   - GET /api/admin/ai-interpretation/explainability-criteria   8 explainability criteria
 *   - GET /api/admin/ai-interpretation/confidence-criteria       confidence criteria
 *   - GET /api/admin/ai-interpretation/hallucination-controls    hallucination-protection controls
 *   - GET /api/admin/ai-interpretation/rule-capabilities         rule-repository capabilities
 *   - GET /api/admin/ai-interpretation/persona-coverage          persona coverage
 *   - GET /api/admin/ai-interpretation/lifecycle-coverage        lifecycle coverage
 *   - GET /api/admin/ai-interpretation/super-admin-surfaces      super-admin surfaces, evidence-verified
 *   - GET /api/admin/ai-interpretation/frontend-surfaces         frontend surfaces, evidence-verified
 *   - GET /api/admin/ai-interpretation/ux-criteria               ux criteria, evidence-verified
 *   - GET /api/admin/ai-interpretation/api-groups                api groups, evidence-verified
 *   - GET /api/admin/ai-interpretation/testing-coverage          testing coverage, evidence-verified
 *   - GET /api/admin/ai-interpretation/doc-set                   documentation set, evidence-verified
 *   - GET /api/admin/ai-interpretation/traceability              9-link provenance chain, evidence-verified
 *   - GET /api/admin/ai-interpretation/repository-alignment      evidence rollup vs live FS+DB
 *   - GET /api/admin/ai-interpretation/adoption                  SEPARATE usage axis (never a gap)
 *   - GET /api/admin/ai-interpretation/gaps                      OPEN + RESOLVED gaps
 *   - GET /api/admin/ai-interpretation/summary                   11 dimensions reported SEPARATELY + verdict
 *
 * MECHANISMS (reuse-before-build; the ONLY DDL sites — run behind flag + super-admin → OFF creates 0 tables):
 *   compute/{interpret,explain,confidence,hallucination-scan,formula} (PURE, no DB — reuse the deterministic
 *   selectInterpretationRule / renderInterpretation / computeConfidence / composeExplanation /
 *   detectUnsupportedClaims + verifyReferences mechanisms + the OPTIONAL health-gated grounded-token narration +
 *   the 3.8 structured-AST engine — NO eval) · rules/{save,list} · prompts/{save,list} · policies/{save,list,
 *   resolve} · thresholds/{save,list,resolve} · runs/{save,list} · governance/{transition,log} ·
 *   audit/{save,list} · views/{save,list}.
 *
 * Strictly additive + reversible + flag-gated (`aiInterpretation`, FF_AI_INTERPRETATION, default OFF):
 * OFF → every route 503 (503-before-auth) → byte-identical legacy incl. schema (no table touched).
 * Never throws: unexpected errors degrade to a 200 honest-degraded JSON. Coverage⟂Confidence⟂Adoption; null≠0.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  AIXP_AXES, AIXP_DIMENSIONS, INTERPRETATION_KINDS, EXPLAINABILITY_CRITERIA, CONFIDENCE_CRITERIA,
  HALLUCINATION_CONTROLS, RULE_CAPABILITIES, PERSONA_COVERAGE, LIFECYCLE_COVERAGE, SUPER_ADMIN_SURFACES,
  FRONTEND_SURFACES, UX_CRITERIA, API_GROUPS, TESTING_COVERAGE, DOC_SET, TRACEABILITY_MODEL,
  AIXP_DECISIONS, INTERPRETATION_BOUNDARIES, AIXP_K_MIN,
} from '../config/ai-interpretation';
import {
  composeDimensions, composeInterpretationKinds, composeExplainabilityCriteria, composeConfidenceCriteria,
  composeHallucinationControls, composeRuleCapabilities, composePersonaCoverage, composeLifecycleCoverage,
  composeSuperAdminSurfaces, composeFrontendSurfaces, composeUxCriteria, composeApiGroups,
  composeTestingCoverage, composeDocSet, composeTraceability, composeRepositoryAlignment,
  composeAdoption, classifiedGaps, composeSummary,
} from '../services/ai-interpretation-engine';
import {
  selectInterpretationRule, renderInterpretation, computeConfidence, composeExplanation,
  detectUnsupportedClaims, verifyReferences, evaluateInterpretationFormula, narrateInterpretation,
  saveRule, listRules, savePromptLink, listPromptLinks, savePolicy, listPolicies, resolvePolicy,
  saveThreshold, listThresholds, resolveThreshold, saveRun, listRuns,
  recordGovernanceTransition, listGovernanceLog, recordAudit, listAudit, saveView, listViews,
  type InterpretationRule,
} from '../services/ai-interpretation-mechanisms';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('aiInterpretation')) {
    return res.status(503).json({ ok: false, error: 'ai_interpretation_disabled' });
  }
  next();
}

function degraded(res: Response, tag: string, err: unknown) {
  console.error(`[ai-interpretation] ${tag} error:`, err);
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
}

function objOrEmpty(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function strArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).map(String) : [];
}

export function registerAiInterpretationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const g = [flagGate, requireAuth, requireSuperAdmin];

  // Flag probe (flag STATE is not sensitive). 503 when OFF; res.ok=true only when ON.
  app.get('/api/ai-interpretation/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // Canonical model (static registry — no DB read).
  app.get('/api/admin/ai-interpretation/model', ...g, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true, platform_frozen: true, k_min: AIXP_K_MIN,
        axes: AIXP_AXES, dimensions: AIXP_DIMENSIONS,
        interpretation_kinds: INTERPRETATION_KINDS, explainability_criteria: EXPLAINABILITY_CRITERIA,
        confidence_criteria: CONFIDENCE_CRITERIA, hallucination_controls: HALLUCINATION_CONTROLS,
        rule_capabilities: RULE_CAPABILITIES, persona_coverage: PERSONA_COVERAGE,
        lifecycle_coverage: LIFECYCLE_COVERAGE, super_admin_surfaces: SUPER_ADMIN_SURFACES,
        frontend_surfaces: FRONTEND_SURFACES, ux_criteria: UX_CRITERIA, api_groups: API_GROUPS,
        testing_coverage: TESTING_COVERAGE, doc_set: DOC_SET,
        traceability_model: TRACEABILITY_MODEL, decisions: AIXP_DECISIONS, boundaries: INTERPRETATION_BOUNDARIES,
      });
    } catch (err) { degraded(res, 'model', err); }
  });

  app.get('/api/admin/ai-interpretation/dimensions', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, dimensions: await composeDimensions(pool) }); }
    catch (err) { degraded(res, 'dimensions', err); }
  });

  app.get('/api/admin/ai-interpretation/interpretation-kinds', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, interpretation_kinds: composeInterpretationKinds() }); }
    catch (err) { degraded(res, 'interpretation-kinds', err); }
  });

  app.get('/api/admin/ai-interpretation/explainability-criteria', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, explainability_criteria: composeExplainabilityCriteria() }); }
    catch (err) { degraded(res, 'explainability-criteria', err); }
  });

  app.get('/api/admin/ai-interpretation/confidence-criteria', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, confidence_criteria: composeConfidenceCriteria() }); }
    catch (err) { degraded(res, 'confidence-criteria', err); }
  });

  app.get('/api/admin/ai-interpretation/hallucination-controls', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, hallucination_controls: composeHallucinationControls() }); }
    catch (err) { degraded(res, 'hallucination-controls', err); }
  });

  app.get('/api/admin/ai-interpretation/rule-capabilities', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, rule_capabilities: composeRuleCapabilities() }); }
    catch (err) { degraded(res, 'rule-capabilities', err); }
  });

  app.get('/api/admin/ai-interpretation/persona-coverage', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, persona_coverage: composePersonaCoverage() }); }
    catch (err) { degraded(res, 'persona-coverage', err); }
  });

  app.get('/api/admin/ai-interpretation/lifecycle-coverage', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, lifecycle_coverage: composeLifecycleCoverage() }); }
    catch (err) { degraded(res, 'lifecycle-coverage', err); }
  });

  app.get('/api/admin/ai-interpretation/super-admin-surfaces', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, super_admin_surfaces: await composeSuperAdminSurfaces(pool) }); }
    catch (err) { degraded(res, 'super-admin-surfaces', err); }
  });

  app.get('/api/admin/ai-interpretation/frontend-surfaces', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, frontend_surfaces: await composeFrontendSurfaces(pool) }); }
    catch (err) { degraded(res, 'frontend-surfaces', err); }
  });

  app.get('/api/admin/ai-interpretation/ux-criteria', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ux_criteria: await composeUxCriteria(pool) }); }
    catch (err) { degraded(res, 'ux-criteria', err); }
  });

  app.get('/api/admin/ai-interpretation/api-groups', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, api_groups: await composeApiGroups(pool) }); }
    catch (err) { degraded(res, 'api-groups', err); }
  });

  app.get('/api/admin/ai-interpretation/testing-coverage', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, testing_coverage: await composeTestingCoverage(pool) }); }
    catch (err) { degraded(res, 'testing-coverage', err); }
  });

  app.get('/api/admin/ai-interpretation/doc-set', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, doc_set: await composeDocSet(pool) }); }
    catch (err) { degraded(res, 'doc-set', err); }
  });

  app.get('/api/admin/ai-interpretation/traceability', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, traceability: await composeTraceability(pool) }); }
    catch (err) { degraded(res, 'traceability', err); }
  });

  app.get('/api/admin/ai-interpretation/repository-alignment', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, repository_alignment: await composeRepositoryAlignment(pool) }); }
    catch (err) { degraded(res, 'repository-alignment', err); }
  });

  app.get('/api/admin/ai-interpretation/adoption', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, adoption: await composeAdoption(pool) }); }
    catch (err) { degraded(res, 'adoption', err); }
  });

  app.get('/api/admin/ai-interpretation/gaps', ...g, async (_req: Request, res: Response) => {
    try {
      const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();
      res.json({ ok: true, gaps, gap_counts, gap_total: gaps.length, resolved_gaps, resolved_gap_counts, resolved_gap_count });
    } catch (err) { degraded(res, 'gaps', err); }
  });

  app.get('/api/admin/ai-interpretation/summary', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, summary: await composeSummary(pool) }); }
    catch (err) { degraded(res, 'summary', err); }
  });

  // ── PURE COMPUTE mechanisms — no DB, no DDL, no eval. Deterministic FIRST; the OPTIONAL LLM narration is
  // health-gated + grounded-token-constrained + output-validated and falls back to deterministic + source-tag.
  // Interpretation ABSTAINS below the confidence / k_min evidence floor (never fabricated). Persist ONLY when
  // persist=true (write path — flag-gated DDL site). ──

  // The canonical interpret seam: rule select (3.8 AST condition) → grounded render → confidence + abstention →
  // 8-facet explanation → OPTIONAL grounded narration → deterministic fallback + source tag.
  app.post('/api/admin/ai-interpretation/compute/interpret', ...g, async (req: Request, res: Response) => {
    try {
      const vars = objOrEmpty(req.body?.vars);
      const rules = (Array.isArray(req.body?.rules) ? req.body.rules : []) as InterpretationRule[];
      const rule = selectInterpretationRule(rules, vars);
      const groundedTokens = req.body?.grounded_tokens != null
        ? strArray(req.body.grounded_tokens)
        : (rule?.grounded_tokens ?? []);
      const template = req.body?.template != null ? String(req.body.template) : (rule?.template ?? '');
      const rendered = renderInterpretation(template, vars, groundedTokens);
      const requiredFacets = strArray(req.body?.required_facets);
      const evidencePresent = objOrEmpty(req.body?.evidence_present) as Record<string, boolean>;
      const confidence = computeConfidence(evidencePresent, requiredFacets, {
        cohortSize: req.body?.cohort_size == null ? null : Number(req.body.cohort_size),
        kMin: req.body?.k_min == null ? undefined : Number(req.body.k_min),
        confidenceMin: req.body?.confidence_min == null ? undefined : Number(req.body.confidence_min),
        reviewMin: req.body?.review_min == null ? undefined : Number(req.body.review_min),
      });
      const explanation = composeExplanation({
        why: req.body?.why != null ? String(req.body.why)
          : (rule ? `Interpretation rule ${rule.rule_key} matched for ${String(vars.kind ?? 'overall')}` : 'No matching interpretation rule'),
        evidence_basis: Array.isArray(req.body?.evidence_basis) ? req.body.evidence_basis : [],
        data_sources: strArray(req.body?.data_sources),
        rule_reference: rule ? { key: rule.rule_key, version: rule.version } : null,
        score_reference: req.body?.score_reference ?? null,
        benchmark_reference: req.body?.benchmark_reference ?? null,
        assessment_reference: req.body?.assessment_reference ?? null,
        confidence,
      });
      let narration = null;
      if (req.body?.narrate === true && !confidence.abstained && rendered.text) {
        narration = await narrateInterpretation({
          deterministicText: rendered.text, vars, groundedTokens,
          audience: req.body?.audience ? String(req.body.audience) : undefined,
          model: req.body?.model ? String(req.body.model) : undefined,
        });
      }
      const result = {
        matched_rule: rule ? { key: rule.rule_key, version: rule.version ?? 1, kind: rule.kind ?? null } : null,
        deterministic_text: rendered.text,
        tokens_used: rendered.tokens_used,
        text: narration?.source === 'ai' ? narration.text : rendered.text,
        source: narration ? narration.source : ('deterministic' as const),
        ai_available: narration ? narration.ai_available : false,
        unsupported_claims: narration ? narration.unsupported_claims : 0,
        confidence,
        explanation,
        abstained: confidence.abstained,
        human_review: confidence.human_review,
        reason: confidence.abstained ? confidence.reason : (narration?.reason ?? 'deterministic_only'),
      };
      let saved: unknown = null;
      if (req.body?.persist === true && req.body?.run_key) {
        saved = await saveRun(pool, {
          run_key: String(req.body.run_key), subject_ref: req.body?.subject_ref, assessment_slug: req.body?.assessment_slug,
          kind: req.body?.kind ?? (vars.kind == null ? undefined : String(vars.kind)),
          persona: req.body?.persona ?? (vars.persona == null ? undefined : String(vars.persona)),
          lifecycle: req.body?.lifecycle ?? (vars.lifecycle == null ? undefined : String(vars.lifecycle)),
          interpretation: result.text, confidence: confidence.score, confidence_band: confidence.band,
          evidence: { present: confidence.present, missing: confidence.missing },
          source: result.source, ai_available: result.ai_available, abstained: result.abstained,
          human_review: confidence.human_review, unsupported_claims: result.unsupported_claims,
          rule_key: rule ? rule.rule_key : null, rule_version: rule ? String(rule.version ?? 1) : null,
          assessment_version: req.body?.assessment_version, norm_version: req.body?.norm_version,
          standardization_version: req.body?.standardization_version, benchmark_version: req.body?.benchmark_version,
          interpretation_version: req.body?.interpretation_version, detail: result,
        });
      }
      res.json({ ok: true, result, saved });
    } catch (err) { degraded(res, 'compute-interpret', err); }
  });

  app.post('/api/admin/ai-interpretation/compute/explain', ...g, async (req: Request, res: Response) => {
    try {
      const ref = objOrEmpty(req.body?.rule_reference);
      res.json({
        ok: true, result: composeExplanation({
          why: req.body?.why != null ? String(req.body.why) : '',
          evidence_basis: Array.isArray(req.body?.evidence_basis) ? req.body.evidence_basis : [],
          data_sources: strArray(req.body?.data_sources),
          rule_reference: ref.key ? { key: String(ref.key), version: ref.version as number | string | undefined } : null,
          score_reference: req.body?.score_reference ?? null,
          benchmark_reference: req.body?.benchmark_reference ?? null,
          assessment_reference: req.body?.assessment_reference ?? null,
          confidence: req.body?.confidence ?? null,
        }),
      });
    } catch (err) { degraded(res, 'compute-explain', err); }
  });

  app.post('/api/admin/ai-interpretation/compute/confidence', ...g, async (req: Request, res: Response) => {
    try {
      res.json({
        ok: true, result: computeConfidence(
          objOrEmpty(req.body?.evidence_present) as Record<string, boolean>,
          strArray(req.body?.required_facets),
          {
            cohortSize: req.body?.cohort_size == null ? null : Number(req.body.cohort_size),
            kMin: req.body?.k_min == null ? undefined : Number(req.body.k_min),
            confidenceMin: req.body?.confidence_min == null ? undefined : Number(req.body.confidence_min),
            reviewMin: req.body?.review_min == null ? undefined : Number(req.body.review_min),
          },
        ),
      });
    } catch (err) { degraded(res, 'compute-confidence', err); }
  });

  // Hallucination guard — scan narration for unsupported numeric claims + verify cited references resolve.
  app.post('/api/admin/ai-interpretation/compute/hallucination-scan', ...g, async (req: Request, res: Response) => {
    try {
      const vars = objOrEmpty(req.body?.vars);
      const groundedTokens = strArray(req.body?.grounded_tokens);
      const claims = detectUnsupportedClaims(String(req.body?.text ?? ''), vars, groundedTokens);
      const refs = req.body?.references != null ? verifyReferences(objOrEmpty(req.body.references)) : null;
      res.json({ ok: true, result: { unsupported: claims, references: refs, protected: claims.count === 0 } });
    } catch (err) { degraded(res, 'compute-hallucination-scan', err); }
  });

  // Composite interpretation index — structured-AST formula (validate + evaluate; NO eval).
  app.post('/api/admin/ai-interpretation/compute/formula', ...g, async (req: Request, res: Response) => {
    try {
      const vars = objOrEmpty(req.body?.vars) as Record<string, number>;
      res.json({ ok: true, result: evaluateInterpretationFormula(req.body?.ast ?? req.body?.formula, vars) });
    } catch (err) { degraded(res, 'compute-formula', err); }
  });

  // ── OVERLAY WRITES + LISTS — the ONLY DDL sites (behind flag + super-admin). ──
  // Literal /save + /list + /resolve routes are distinct paths (no /:param collision).

  app.post('/api/admin/ai-interpretation/rules/save', ...g, async (req: Request, res: Response) => {
    try {
      const rule_key = String(req.body?.rule_key || '').trim();
      if (!rule_key) return res.status(400).json({ ok: false, error: 'rule_key_required' });
      res.json({ ok: true, result: await saveRule(pool, { ...req.body, rule_key }) });
    } catch (err) { degraded(res, 'rules-save', err); }
  });

  app.get('/api/admin/ai-interpretation/rules', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, rules: await listRules(pool, req.query.kind ? String(req.query.kind) : undefined) }); }
    catch (err) { degraded(res, 'rules-list', err); }
  });

  app.post('/api/admin/ai-interpretation/prompts/save', ...g, async (req: Request, res: Response) => {
    try {
      const prompt_key = String(req.body?.prompt_key || '').trim();
      if (!prompt_key) return res.status(400).json({ ok: false, error: 'prompt_key_required' });
      res.json({ ok: true, result: await savePromptLink(pool, { ...req.body, prompt_key }) });
    } catch (err) { degraded(res, 'prompts-save', err); }
  });

  app.get('/api/admin/ai-interpretation/prompts', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, prompts: await listPromptLinks(pool, req.query.rule_key ? String(req.query.rule_key) : undefined) }); }
    catch (err) { degraded(res, 'prompts-list', err); }
  });

  app.post('/api/admin/ai-interpretation/policies/save', ...g, async (req: Request, res: Response) => {
    try {
      const policy_key = String(req.body?.policy_key || '').trim();
      if (!policy_key) return res.status(400).json({ ok: false, error: 'policy_key_required' });
      res.json({ ok: true, result: await savePolicy(pool, { ...req.body, policy_key }) });
    } catch (err) { degraded(res, 'policies-save', err); }
  });

  app.get('/api/admin/ai-interpretation/policies', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, policies: await listPolicies(pool, req.query.scope ? String(req.query.scope) : undefined) }); }
    catch (err) { degraded(res, 'policies-list', err); }
  });

  app.post('/api/admin/ai-interpretation/policies/resolve', ...g, async (req: Request, res: Response) => {
    try {
      const context = objOrEmpty(req.body?.context && typeof req.body.context === 'object' ? req.body.context : req.body);
      res.json({ ok: true, result: await resolvePolicy(pool, context) });
    } catch (err) { degraded(res, 'policies-resolve', err); }
  });

  app.post('/api/admin/ai-interpretation/thresholds/save', ...g, async (req: Request, res: Response) => {
    try {
      const threshold_key = String(req.body?.threshold_key || '').trim();
      if (!threshold_key) return res.status(400).json({ ok: false, error: 'threshold_key_required' });
      res.json({ ok: true, result: await saveThreshold(pool, { ...req.body, threshold_key }) });
    } catch (err) { degraded(res, 'thresholds-save', err); }
  });

  app.get('/api/admin/ai-interpretation/thresholds', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, thresholds: await listThresholds(pool, req.query.scope ? String(req.query.scope) : undefined) }); }
    catch (err) { degraded(res, 'thresholds-list', err); }
  });

  app.post('/api/admin/ai-interpretation/thresholds/resolve', ...g, async (req: Request, res: Response) => {
    try {
      const context = objOrEmpty(req.body?.context && typeof req.body.context === 'object' ? req.body.context : req.body);
      res.json({ ok: true, result: await resolveThreshold(pool, context) });
    } catch (err) { degraded(res, 'thresholds-resolve', err); }
  });

  app.post('/api/admin/ai-interpretation/runs/save', ...g, async (req: Request, res: Response) => {
    try {
      const run_key = String(req.body?.run_key || '').trim();
      if (!run_key) return res.status(400).json({ ok: false, error: 'run_key_required' });
      res.json({ ok: true, result: await saveRun(pool, { ...req.body, run_key }) });
    } catch (err) { degraded(res, 'runs-save', err); }
  });

  app.get('/api/admin/ai-interpretation/runs/list', ...g, async (req: Request, res: Response) => {
    try {
      const subjectRef = req.query.subject_ref ? String(req.query.subject_ref) : undefined;
      const kind = req.query.kind ? String(req.query.kind) : undefined;
      res.json({ ok: true, runs: await listRuns(pool, subjectRef, kind) });
    } catch (err) { degraded(res, 'runs-list', err); }
  });

  app.post('/api/admin/ai-interpretation/governance/transition', ...g, async (req: Request, res: Response) => {
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

  app.get('/api/admin/ai-interpretation/governance', ...g, async (req: Request, res: Response) => {
    try {
      const artefactType = req.query.artefact_type ? String(req.query.artefact_type) : undefined;
      const artefactKey = req.query.artefact_key ? String(req.query.artefact_key) : undefined;
      res.json({ ok: true, governance: await listGovernanceLog(pool, artefactType, artefactKey) });
    } catch (err) { degraded(res, 'governance-list', err); }
  });

  app.post('/api/admin/ai-interpretation/audit/save', ...g, async (req: Request, res: Response) => {
    try {
      const action = String(req.body?.action || '').trim();
      if (!action) return res.status(400).json({ ok: false, error: 'action_required' });
      res.json({ ok: true, result: await recordAudit(pool, { ...req.body, action }) });
    } catch (err) { degraded(res, 'audit-save', err); }
  });

  app.get('/api/admin/ai-interpretation/audit', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, audit: await listAudit(pool, req.query.target_key ? String(req.query.target_key) : undefined) }); }
    catch (err) { degraded(res, 'audit-list', err); }
  });

  app.post('/api/admin/ai-interpretation/views/save', ...g, async (req: Request, res: Response) => {
    try {
      const view_key = String(req.body?.view_key || '').trim();
      if (!view_key) return res.status(400).json({ ok: false, error: 'view_key_required' });
      res.json({ ok: true, result: await saveView(pool, { ...req.body, view_key }) });
    } catch (err) { degraded(res, 'views-save', err); }
  });

  app.get('/api/admin/ai-interpretation/views', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, views: await listViews(pool, req.query.owner ? String(req.query.owner) : undefined) }); }
    catch (err) { degraded(res, 'views-list', err); }
  });
}
