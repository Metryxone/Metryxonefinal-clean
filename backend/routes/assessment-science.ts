/**
 * CAPADEX 3.0 — Program 3 · Phase 3.6 Assessment Science / Psychometrics / Item Intelligence routes.
 *
 * A read-only certification composer over the ONE canonical Assessment Science model + the
 * reuse-before-build engineering-closure mechanisms. EIGHT INDEPENDENT dimensions certified SEPARATELY:
 *   item_analysis · reliability · validity · quality_governance · blueprint_validation · frontend · ux · apis.
 * Scope is INSTRUMENT / QUESTION QUALITY ONLY — it measures how GOOD the assessment/question is and
 * NEVER scores or interprets a candidate. Norms / standardization / benchmarking / AI-interpretation /
 * recommendations / report intelligence / candidate performance analytics are Phase 3.7 (reported in-line
 * as boundaries, NOT gaps).
 *
 * READ (certification):
 *   - GET /api/assessment-science/enabled                       flag probe (503 when OFF)
 *   - GET /api/admin/assessment-science/model                   canonical registry
 *   - GET /api/admin/assessment-science/dimensions              the 8 dimensions, evidence VERIFIED vs live FS+DB
 *   - GET /api/admin/assessment-science/item-metrics            9-metric item-analysis catalog
 *   - GET /api/admin/assessment-science/quality-checks          6 question-quality checks
 *   - GET /api/admin/assessment-science/reliability-types       7 reliability types, evidence-verified
 *   - GET /api/admin/assessment-science/validity-types          8 validity types, evidence-verified
 *   - GET /api/admin/assessment-science/governance-stages       7 governance stages, evidence-verified
 *   - GET /api/admin/assessment-science/blueprint-coverage      8 blueprint-coverage checks, evidence-verified
 *   - GET /api/admin/assessment-science/mapping                 10-step authored-item→science-artefact mapping
 *   - GET /api/admin/assessment-science/repository-alignment    evidence rollup vs live FS+DB
 *   - GET /api/admin/assessment-science/adoption                SEPARATE usage axis (never a gap)
 *   - GET /api/admin/assessment-science/gaps                    OPEN + RESOLVED gaps
 *   - GET /api/admin/assessment-science/summary                 8 dimensions reported SEPARATELY + verdict + 3.7 readiness
 *
 * MECHANISMS (reuse-before-build; the ONLY DDL sites — run behind flag + super-admin → OFF creates 0 tables):
 *   compute/{item-analysis,reliability,validity,item-information,item-dif} (PURE, no DB — reuse existing engines) ·
 *   validate/{question-quality,blueprint} (PURE) ·
 *   item-stats/{save,list} · reliability/{save,list} · validity/{save,list} · quality-flags/{save,list} ·
 *   blueprints/{save,list} · governance/{save,list} · repository/{save,list}.
 *
 * Strictly additive + reversible + flag-gated (`assessmentScience`, FF_ASSESSMENT_SCIENCE, default OFF):
 * OFF → every route 503 (503-before-auth) → byte-identical legacy incl. schema (no table touched).
 * Never throws: unexpected errors degrade to a 200 honest-degraded JSON. Coverage⟂Confidence⟂Adoption; null≠0.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  ASCI_AXES, ASCI_DIMENSIONS, ITEM_ANALYSIS_METRICS, QUALITY_CHECKS,
  RELIABILITY_TYPES, VALIDITY_TYPES, GOVERNANCE_STAGES, BLUEPRINT_COVERAGE,
  MAPPING_MODEL, ASCI_DECISIONS, ASCI_K_MIN,
} from '../config/assessment-science';
import {
  composeDimensions, composeItemMetrics, composeQualityChecks, composeReliabilityTypes,
  composeValidityTypes, composeGovernanceStages, composeBlueprintCoverageControls,
  composeMapping, composeRepositoryAlignment, composeAdoption, classifiedGaps, composeSummary,
} from '../services/assessment-science-engine';
import {
  computeItemAnalysis, computeReliability, computeValidity, itemInformation, itemDif,
  validateQuestionQuality, validateBlueprint,
  saveItemStat, listItemStats, saveReliability, listReliability, saveValidity, listValidity,
  saveQualityFlag, listQualityFlags, saveBlueprintRecord, listBlueprints,
  saveGovernance, listGovernance, saveRepositoryArtefact, listRepository,
} from '../services/assessment-science-mechanisms';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('assessmentScience')) {
    return res.status(503).json({ ok: false, error: 'assessment_science_disabled' });
  }
  next();
}

function degraded(res: Response, tag: string, err: unknown) {
  console.error(`[assessment-science] ${tag} error:`, err);
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
}

export function registerAssessmentScienceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const g = [flagGate, requireAuth, requireSuperAdmin];

  // Flag probe (flag STATE is not sensitive). 503 when OFF; res.ok=true only when ON.
  app.get('/api/assessment-science/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // Canonical model (static registry — no DB read).
  app.get('/api/admin/assessment-science/model', ...g, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true, platform_frozen: true, k_min: ASCI_K_MIN,
        axes: ASCI_AXES, dimensions: ASCI_DIMENSIONS,
        item_analysis_metrics: ITEM_ANALYSIS_METRICS, quality_checks: QUALITY_CHECKS,
        reliability_types: RELIABILITY_TYPES, validity_types: VALIDITY_TYPES,
        governance_stages: GOVERNANCE_STAGES, blueprint_coverage: BLUEPRINT_COVERAGE,
        mapping_model: MAPPING_MODEL, decisions: ASCI_DECISIONS,
      });
    } catch (err) { degraded(res, 'model', err); }
  });

  app.get('/api/admin/assessment-science/dimensions', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, dimensions: await composeDimensions(pool) }); }
    catch (err) { degraded(res, 'dimensions', err); }
  });

  app.get('/api/admin/assessment-science/item-metrics', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, item_metrics: composeItemMetrics() }); }
    catch (err) { degraded(res, 'item-metrics', err); }
  });

  app.get('/api/admin/assessment-science/quality-checks', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, quality_checks: composeQualityChecks() }); }
    catch (err) { degraded(res, 'quality-checks', err); }
  });

  app.get('/api/admin/assessment-science/reliability-types', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, reliability_types: await composeReliabilityTypes(pool) }); }
    catch (err) { degraded(res, 'reliability-types', err); }
  });

  app.get('/api/admin/assessment-science/validity-types', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, validity_types: await composeValidityTypes(pool) }); }
    catch (err) { degraded(res, 'validity-types', err); }
  });

  app.get('/api/admin/assessment-science/governance-stages', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, governance_stages: await composeGovernanceStages(pool) }); }
    catch (err) { degraded(res, 'governance-stages', err); }
  });

  app.get('/api/admin/assessment-science/blueprint-coverage', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, blueprint_coverage: await composeBlueprintCoverageControls(pool) }); }
    catch (err) { degraded(res, 'blueprint-coverage', err); }
  });

  app.get('/api/admin/assessment-science/mapping', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, mapping: await composeMapping(pool) }); }
    catch (err) { degraded(res, 'mapping', err); }
  });

  app.get('/api/admin/assessment-science/repository-alignment', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, repository_alignment: await composeRepositoryAlignment(pool) }); }
    catch (err) { degraded(res, 'repository-alignment', err); }
  });

  app.get('/api/admin/assessment-science/adoption', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, adoption: await composeAdoption(pool) }); }
    catch (err) { degraded(res, 'adoption', err); }
  });

  app.get('/api/admin/assessment-science/gaps', ...g, async (_req: Request, res: Response) => {
    try {
      const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();
      res.json({ ok: true, gaps, gap_counts, gap_total: gaps.length, resolved_gaps, resolved_gap_counts, resolved_gap_count });
    } catch (err) { degraded(res, 'gaps', err); }
  });

  app.get('/api/admin/assessment-science/summary', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, summary: await composeSummary(pool) }); }
    catch (err) { degraded(res, 'summary', err); }
  });

  // ── PURE COMPUTE / VALIDATE mechanisms — no DB, no DDL, no eval. Reuse the existing
  // psychometric engines. Item-level statistics ABSTAIN below k_min real responses (never
  // fabricated). Persist ONLY when persist=true (write path → DDL behind flag). ──

  app.post('/api/admin/assessment-science/compute/item-analysis', ...g, async (req: Request, res: Response) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      const options = (req.body?.options && typeof req.body.options === 'object') ? req.body.options : {};
      const result = computeItemAnalysis(items, options);
      const saved: unknown[] = [];
      if (req.body?.persist === true) {
        const slug = req.body?.assessment_slug ? String(req.body.assessment_slug) : '';
        for (const it of result.items) {
          saved.push(await saveItemStat(pool, {
            item_key: it.ref, assessment_slug: slug, n_responses: it.n_responses,
            difficulty: it.difficulty, discrimination: it.discrimination, facility: it.facility,
            quality_score: it.quality_score, distractor: it.distractor, flags: it.flags,
            retire_recommended: it.retire_recommended, abstained: it.abstained,
          }));
        }
      }
      res.json({ ok: true, result, saved: saved.length ? saved : null });
    } catch (err) { degraded(res, 'compute-item-analysis', err); }
  });

  app.post('/api/admin/assessment-science/compute/reliability', ...g, async (req: Request, res: Response) => {
    try {
      const matrix = Array.isArray(req.body?.matrix) ? req.body.matrix : [];
      const options = (req.body?.options && typeof req.body.options === 'object') ? req.body.options : {};
      const result = computeReliability(matrix, options);
      let saved: unknown = null;
      if (req.body?.persist === true && req.body?.rel_key) {
        const primary = result.methods[0];
        saved = await saveReliability(pool, {
          rel_key: String(req.body.rel_key), assessment_slug: req.body?.assessment_slug,
          method: primary?.method, coefficient: primary?.coefficient ?? null, tier: primary?.tier ?? null,
          sem: result.sem, ci_low: result.ci?.low ?? null, ci_high: result.ci?.high ?? null,
          n_respondents: result.n_respondents, k_items: result.k_items,
          abstained: result.abstained, detail: result,
        });
      }
      res.json({ ok: true, result, saved });
    } catch (err) { degraded(res, 'compute-reliability', err); }
  });

  app.post('/api/admin/assessment-science/compute/validity', ...g, async (req: Request, res: Response) => {
    try {
      const result = computeValidity((req.body?.input && typeof req.body.input === 'object') ? req.body.input : req.body || {});
      const saved: unknown[] = [];
      if (req.body?.persist === true && req.body?.val_key) {
        const key = String(req.body.val_key);
        for (const e of result.evidence) {
          saved.push(await saveValidity(pool, {
            val_key: key, assessment_slug: req.body?.assessment_slug, validity_type: e.validity_type,
            coefficient: e.coefficient, n: e.n, abstained: e.abstained, evidence: { note: e.note ?? null },
          }));
        }
      }
      res.json({ ok: true, result, saved: saved.length ? saved : null });
    } catch (err) { degraded(res, 'compute-validity', err); }
  });

  app.post('/api/admin/assessment-science/compute/item-information', ...g, async (req: Request, res: Response) => {
    try {
      const { theta, a, b, c } = req.body || {};
      res.json({ ok: true, information: itemInformation(Number(theta), Number(a), Number(b), Number(c)) });
    } catch (err) { degraded(res, 'compute-item-information', err); }
  });

  app.post('/api/admin/assessment-science/compute/item-dif', ...g, async (req: Request, res: Response) => {
    try {
      const { groupAPositive, groupATotal, groupBPositive, groupBTotal } = req.body || {};
      res.json({ ok: true, dif: itemDif(Number(groupAPositive), Number(groupATotal), Number(groupBPositive), Number(groupBTotal)) });
    } catch (err) { degraded(res, 'compute-item-dif', err); }
  });

  app.post('/api/admin/assessment-science/validate/question-quality', ...g, async (req: Request, res: Response) => {
    try {
      const result = validateQuestionQuality((req.body?.question && typeof req.body.question === 'object') ? req.body.question : req.body || {});
      let saved: unknown = null;
      if (req.body?.persist === true && req.body?.flag_key) {
        const key = String(req.body.flag_key);
        saved = [];
        for (const chk of result.checks) {
          (saved as unknown[]).push(await saveQualityFlag(pool, {
            flag_key: `${key}:${chk.check_type}`, item_key: result.ref,
            check_type: chk.check_type, passed: chk.passed, severity: chk.severity, detail: { detail: chk.detail },
          }));
        }
      }
      res.json({ ok: true, result, saved });
    } catch (err) { degraded(res, 'validate-question-quality', err); }
  });

  app.post('/api/admin/assessment-science/validate/blueprint', ...g, async (req: Request, res: Response) => {
    try {
      const result = validateBlueprint((req.body?.input && typeof req.body.input === 'object') ? req.body.input : req.body || {});
      let saved: unknown = null;
      if (req.body?.persist === true && req.body?.blueprint_key) {
        saved = await saveBlueprintRecord(pool, {
          blueprint_key: String(req.body.blueprint_key), version: req.body?.version,
          assessment_slug: req.body?.assessment_slug, valid: result.valid,
          coverage: result.coverage, distribution: result.distribution, gaps: result.gaps,
          status: req.body?.status,
        });
      }
      res.json({ ok: true, result, saved });
    } catch (err) { degraded(res, 'validate-blueprint', err); }
  });

  // ── OVERLAY WRITES + LISTS — the ONLY DDL sites (behind flag + super-admin). ──
  // Literal /save routes are distinct paths (no /:param collision).

  app.post('/api/admin/assessment-science/item-stats/save', ...g, async (req: Request, res: Response) => {
    try {
      const item_key = String(req.body?.item_key || '').trim();
      if (!item_key) return res.status(400).json({ ok: false, error: 'item_key_required' });
      res.json({ ok: true, result: await saveItemStat(pool, { ...req.body, item_key }) });
    } catch (err) { degraded(res, 'item-stats-save', err); }
  });

  app.get('/api/admin/assessment-science/item-stats', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, item_stats: await listItemStats(pool, req.query.assessment_slug ? String(req.query.assessment_slug) : undefined) }); }
    catch (err) { degraded(res, 'item-stats-list', err); }
  });

  app.post('/api/admin/assessment-science/reliability/save', ...g, async (req: Request, res: Response) => {
    try {
      const rel_key = String(req.body?.rel_key || '').trim();
      if (!rel_key) return res.status(400).json({ ok: false, error: 'rel_key_required' });
      res.json({ ok: true, result: await saveReliability(pool, { ...req.body, rel_key }) });
    } catch (err) { degraded(res, 'reliability-save', err); }
  });

  app.get('/api/admin/assessment-science/reliability/list', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, reliability: await listReliability(pool, req.query.assessment_slug ? String(req.query.assessment_slug) : undefined) }); }
    catch (err) { degraded(res, 'reliability-list', err); }
  });

  app.post('/api/admin/assessment-science/validity/save', ...g, async (req: Request, res: Response) => {
    try {
      const val_key = String(req.body?.val_key || '').trim();
      if (!val_key) return res.status(400).json({ ok: false, error: 'val_key_required' });
      res.json({ ok: true, result: await saveValidity(pool, { ...req.body, val_key }) });
    } catch (err) { degraded(res, 'validity-save', err); }
  });

  app.get('/api/admin/assessment-science/validity/list', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, validity: await listValidity(pool, req.query.assessment_slug ? String(req.query.assessment_slug) : undefined) }); }
    catch (err) { degraded(res, 'validity-list', err); }
  });

  app.post('/api/admin/assessment-science/quality-flags/save', ...g, async (req: Request, res: Response) => {
    try {
      const flag_key = String(req.body?.flag_key || '').trim();
      if (!flag_key) return res.status(400).json({ ok: false, error: 'flag_key_required' });
      res.json({ ok: true, result: await saveQualityFlag(pool, { ...req.body, flag_key }) });
    } catch (err) { degraded(res, 'quality-flags-save', err); }
  });

  app.get('/api/admin/assessment-science/quality-flags', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, quality_flags: await listQualityFlags(pool, req.query.item_key ? String(req.query.item_key) : undefined) }); }
    catch (err) { degraded(res, 'quality-flags-list', err); }
  });

  app.post('/api/admin/assessment-science/blueprints/save', ...g, async (req: Request, res: Response) => {
    try {
      const blueprint_key = String(req.body?.blueprint_key || '').trim();
      if (!blueprint_key) return res.status(400).json({ ok: false, error: 'blueprint_key_required' });
      res.json({ ok: true, result: await saveBlueprintRecord(pool, { ...req.body, blueprint_key }) });
    } catch (err) { degraded(res, 'blueprints-save', err); }
  });

  app.get('/api/admin/assessment-science/blueprints', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, blueprints: await listBlueprints(pool) }); }
    catch (err) { degraded(res, 'blueprints-list', err); }
  });

  app.post('/api/admin/assessment-science/governance/save', ...g, async (req: Request, res: Response) => {
    try {
      const gov_key = String(req.body?.gov_key || '').trim();
      if (!gov_key) return res.status(400).json({ ok: false, error: 'gov_key_required' });
      res.json({ ok: true, result: await saveGovernance(pool, { ...req.body, gov_key }) });
    } catch (err) { degraded(res, 'governance-save', err); }
  });

  app.get('/api/admin/assessment-science/governance', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, governance: await listGovernance(pool) }); }
    catch (err) { degraded(res, 'governance-list', err); }
  });

  app.post('/api/admin/assessment-science/repository/save', ...g, async (req: Request, res: Response) => {
    try {
      const artefact_key = String(req.body?.artefact_key || '').trim();
      if (!artefact_key) return res.status(400).json({ ok: false, error: 'artefact_key_required' });
      res.json({ ok: true, result: await saveRepositoryArtefact(pool, { ...req.body, artefact_key }) });
    } catch (err) { degraded(res, 'repository-save', err); }
  });

  app.get('/api/admin/assessment-science/repository', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, repository: await listRepository(pool) }); }
    catch (err) { degraded(res, 'repository-list', err); }
  });
}
