/**
 * CAPADEX 3.0 — Program 3 · Phase 3.9 Enterprise Benchmark Intelligence routes.
 *
 * A read-only certification composer over the ONE canonical Benchmark Intelligence model + the
 * reuse-before-build engineering-closure mechanisms. NINE INDEPENDENT dimensions certified SEPARATELY:
 *   benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis ·
 *   testing · documentation.
 * Scope is BENCHMARKING & COMPARISON ONLY — it turns a STANDARDIZED score (3.8) into percentile / z /
 * delta / quartile against a reference group across multiple dimensions + time modes and NEVER re-scores,
 * re-standardizes or builds a norm. AI-interpretation / recommendation / report / dashboard /
 * candidate-analytics are OUT OF SCOPE (later phases) — reported in-line as boundaries, NOT gaps.
 *
 * READ (certification):
 *   - GET /api/benchmark-intelligence/enabled                     flag probe (503 when OFF)
 *   - GET /api/admin/benchmark-intelligence/model                 canonical registry
 *   - GET /api/admin/benchmark-intelligence/dimensions            the 9 dimensions, evidence VERIFIED vs live FS+DB
 *   - GET /api/admin/benchmark-intelligence/benchmark-types       17 reference-group types
 *   - GET /api/admin/benchmark-intelligence/comparison-dimensions 11 comparison dimensions
 *   - GET /api/admin/benchmark-intelligence/time-modes            8 benchmark time modes
 *   - GET /api/admin/benchmark-intelligence/benchmark-config      7 configuration capabilities, evidence-verified
 *   - GET /api/admin/benchmark-intelligence/governance-states     8 governance states, evidence-verified
 *   - GET /api/admin/benchmark-intelligence/super-admin-surfaces  7 super-admin surfaces, evidence-verified
 *   - GET /api/admin/benchmark-intelligence/frontend-surfaces     10 frontend surfaces, evidence-verified
 *   - GET /api/admin/benchmark-intelligence/ux-criteria           8 ux criteria, evidence-verified
 *   - GET /api/admin/benchmark-intelligence/api-groups            5 api groups, evidence-verified
 *   - GET /api/admin/benchmark-intelligence/traceability          5-link provenance chain, evidence-verified
 *   - GET /api/admin/benchmark-intelligence/repository-alignment  evidence rollup vs live FS+DB
 *   - GET /api/admin/benchmark-intelligence/adoption              SEPARATE usage axis (never a gap)
 *   - GET /api/admin/benchmark-intelligence/gaps                  OPEN + RESOLVED gaps
 *   - GET /api/admin/benchmark-intelligence/summary               9 dimensions reported SEPARATELY + verdict
 *
 * MECHANISMS (reuse-before-build; the ONLY DDL sites — run behind flag + super-admin → OFF creates 0 tables):
 *   compute/{reference-stats,benchmark,group-comparison,trend,distribution,percentile-rank,formula} (PURE, no
 *   DB — reuse the pure psychometric transforms zFromValue/zToPercentile + the 3.8 structured-AST engine — NO
 *   eval) · groups/{save,list} · configs/{save,list,resolve} · results/{save,list} ·
 *   governance/{transition,log} · audit/{save,list} · views/{save,list}.
 *
 * Strictly additive + reversible + flag-gated (`benchmarkIntelligence`, FF_BENCHMARK_INTELLIGENCE, default OFF):
 * OFF → every route 503 (503-before-auth) → byte-identical legacy incl. schema (no table touched).
 * Never throws: unexpected errors degrade to a 200 honest-degraded JSON. Coverage⟂Confidence⟂Adoption; null≠0.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  BMK_AXES, BMK_DIMENSIONS, BENCHMARK_TYPES, COMPARISON_DIMENSIONS, TIME_MODES,
  BENCHMARK_CONFIG, GOVERNANCE_STATES, SUPER_ADMIN_SURFACES, FRONTEND_SURFACES,
  UX_CRITERIA, API_GROUPS, TRACEABILITY_MODEL, BMK_DECISIONS, BMK_K_MIN,
} from '../config/benchmark-intelligence';
import {
  composeDimensions, composeBenchmarkTypes, composeComparisonDimensions, composeTimeModes,
  composeBenchmarkConfig, composeGovernanceStates, composeSuperAdminSurfaces,
  composeFrontendSurfaces, composeUxCriteria, composeApiGroups, composeTraceability,
  composeRepositoryAlignment, composeAdoption, classifiedGaps, composeSummary,
} from '../services/benchmark-intelligence-engine';
import {
  computeReferenceStats, computeBenchmarkComparison, computeGroupComparison, computeTrend,
  computeDistribution, computePercentileRank, evaluateBenchmarkFormula,
  saveGroup, listGroups, saveConfig, listConfigs, resolveConfig, saveResult, listResults,
  recordGovernanceTransition, listGovernanceLog, recordAudit, listAudit, saveView, listViews,
} from '../services/benchmark-intelligence-mechanisms';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('benchmarkIntelligence')) {
    return res.status(503).json({ ok: false, error: 'benchmark_intelligence_disabled' });
  }
  next();
}

function degraded(res: Response, tag: string, err: unknown) {
  console.error(`[benchmark-intelligence] ${tag} error:`, err);
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
}

function numOrNull(v: unknown): number | null {
  return v == null || !Number.isFinite(Number(v)) ? null : Number(v);
}
function numArray(v: unknown): Array<number | null | undefined> {
  return Array.isArray(v) ? (v as unknown[]).map((x) => (x == null ? null : Number(x))) : [];
}

export function registerBenchmarkIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const g = [flagGate, requireAuth, requireSuperAdmin];

  // Flag probe (flag STATE is not sensitive). 503 when OFF; res.ok=true only when ON.
  app.get('/api/benchmark-intelligence/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // Canonical model (static registry — no DB read).
  app.get('/api/admin/benchmark-intelligence/model', ...g, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true, platform_frozen: true, k_min: BMK_K_MIN,
        axes: BMK_AXES, dimensions: BMK_DIMENSIONS,
        benchmark_types: BENCHMARK_TYPES, comparison_dimensions: COMPARISON_DIMENSIONS,
        time_modes: TIME_MODES, benchmark_config: BENCHMARK_CONFIG,
        governance_states: GOVERNANCE_STATES, super_admin_surfaces: SUPER_ADMIN_SURFACES,
        frontend_surfaces: FRONTEND_SURFACES, ux_criteria: UX_CRITERIA, api_groups: API_GROUPS,
        traceability_model: TRACEABILITY_MODEL, decisions: BMK_DECISIONS,
      });
    } catch (err) { degraded(res, 'model', err); }
  });

  app.get('/api/admin/benchmark-intelligence/dimensions', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, dimensions: await composeDimensions(pool) }); }
    catch (err) { degraded(res, 'dimensions', err); }
  });

  app.get('/api/admin/benchmark-intelligence/benchmark-types', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, benchmark_types: composeBenchmarkTypes() }); }
    catch (err) { degraded(res, 'benchmark-types', err); }
  });

  app.get('/api/admin/benchmark-intelligence/comparison-dimensions', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, comparison_dimensions: composeComparisonDimensions() }); }
    catch (err) { degraded(res, 'comparison-dimensions', err); }
  });

  app.get('/api/admin/benchmark-intelligence/time-modes', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, time_modes: composeTimeModes() }); }
    catch (err) { degraded(res, 'time-modes', err); }
  });

  app.get('/api/admin/benchmark-intelligence/benchmark-config', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, benchmark_config: await composeBenchmarkConfig(pool) }); }
    catch (err) { degraded(res, 'benchmark-config', err); }
  });

  app.get('/api/admin/benchmark-intelligence/governance-states', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, governance_states: await composeGovernanceStates(pool) }); }
    catch (err) { degraded(res, 'governance-states', err); }
  });

  app.get('/api/admin/benchmark-intelligence/super-admin-surfaces', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, super_admin_surfaces: await composeSuperAdminSurfaces(pool) }); }
    catch (err) { degraded(res, 'super-admin-surfaces', err); }
  });

  app.get('/api/admin/benchmark-intelligence/frontend-surfaces', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, frontend_surfaces: await composeFrontendSurfaces(pool) }); }
    catch (err) { degraded(res, 'frontend-surfaces', err); }
  });

  app.get('/api/admin/benchmark-intelligence/ux-criteria', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ux_criteria: await composeUxCriteria(pool) }); }
    catch (err) { degraded(res, 'ux-criteria', err); }
  });

  app.get('/api/admin/benchmark-intelligence/api-groups', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, api_groups: await composeApiGroups(pool) }); }
    catch (err) { degraded(res, 'api-groups', err); }
  });

  app.get('/api/admin/benchmark-intelligence/traceability', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, traceability: await composeTraceability(pool) }); }
    catch (err) { degraded(res, 'traceability', err); }
  });

  app.get('/api/admin/benchmark-intelligence/repository-alignment', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, repository_alignment: await composeRepositoryAlignment(pool) }); }
    catch (err) { degraded(res, 'repository-alignment', err); }
  });

  app.get('/api/admin/benchmark-intelligence/adoption', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, adoption: await composeAdoption(pool) }); }
    catch (err) { degraded(res, 'adoption', err); }
  });

  app.get('/api/admin/benchmark-intelligence/gaps', ...g, async (_req: Request, res: Response) => {
    try {
      const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();
      res.json({ ok: true, gaps, gap_counts, gap_total: gaps.length, resolved_gaps, resolved_gap_counts, resolved_gap_count });
    } catch (err) { degraded(res, 'gaps', err); }
  });

  app.get('/api/admin/benchmark-intelligence/summary', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, summary: await composeSummary(pool) }); }
    catch (err) { degraded(res, 'summary', err); }
  });

  // ── PURE COMPUTE mechanisms — no DB, no DDL, no eval. Reuse the pure psychometric transforms
  // (zFromValue/zToPercentile) + the 3.8 structured-AST formula interpreter. Benchmarking ABSTAINS below
  // k_min real members in the reference group (never fabricated). Persist ONLY when persist=true (write path). ──

  app.post('/api/admin/benchmark-intelligence/compute/reference-stats', ...g, async (req: Request, res: Response) => {
    try {
      const kMin = req.body?.k_min == null ? undefined : Number(req.body.k_min);
      res.json({ ok: true, result: computeReferenceStats(numArray(req.body?.values), kMin) });
    } catch (err) { degraded(res, 'compute-reference-stats', err); }
  });

  app.post('/api/admin/benchmark-intelligence/compute/benchmark', ...g, async (req: Request, res: Response) => {
    try {
      const stats = (req.body?.stats && typeof req.body.stats === 'object' && !Array.isArray(req.body.stats))
        ? { n: numOrNull(req.body.stats.n) ?? undefined, mean: numOrNull(req.body.stats.mean), sd: numOrNull(req.body.stats.sd) }
        : undefined;
      const result = computeBenchmarkComparison({
        value: numOrNull(req.body?.value),
        reference: req.body?.reference == null ? undefined : numArray(req.body.reference),
        stats,
        kMin: req.body?.k_min == null ? undefined : Number(req.body.k_min),
      });
      let saved: unknown = null;
      if (req.body?.persist === true && req.body?.result_key) {
        saved = await saveResult(pool, {
          result_key: String(req.body.result_key), subject_ref: req.body?.subject_ref,
          assessment_slug: req.body?.assessment_slug, benchmark_type: req.body?.benchmark_type,
          dimension: req.body?.dimension, time_mode: req.body?.time_mode, group_key: req.body?.group_key,
          value: result.value, z: result.z, percentile: result.percentile, delta: result.delta,
          quartile: result.quartile, cohort_size: result.cohort_size, suppressed: result.suppressed, abstained: result.abstained,
          assessment_version: req.body?.assessment_version, norm_version: req.body?.norm_version,
          standardization_version: req.body?.standardization_version, benchmark_version: req.body?.benchmark_version,
          detail: result,
        });
      }
      res.json({ ok: true, result, saved });
    } catch (err) { degraded(res, 'compute-benchmark', err); }
  });

  app.post('/api/admin/benchmark-intelligence/compute/group-comparison', ...g, async (req: Request, res: Response) => {
    try {
      const groups = Array.isArray(req.body?.groups) ? req.body.groups.map((grp: Record<string, unknown>) => ({
        label: String(grp?.label ?? ''),
        benchmark_type: grp?.benchmark_type == null ? undefined : String(grp.benchmark_type),
        values: grp?.values == null ? undefined : numArray(grp.values),
        stats: (grp?.stats && typeof grp.stats === 'object' && !Array.isArray(grp.stats))
          ? { n: numOrNull((grp.stats as Record<string, unknown>).n) ?? undefined, mean: numOrNull((grp.stats as Record<string, unknown>).mean), sd: numOrNull((grp.stats as Record<string, unknown>).sd) }
          : undefined,
      })) : [];
      res.json({ ok: true, result: computeGroupComparison({ value: numOrNull(req.body?.value), groups, kMin: req.body?.k_min == null ? undefined : Number(req.body.k_min) }) });
    } catch (err) { degraded(res, 'compute-group-comparison', err); }
  });

  app.post('/api/admin/benchmark-intelligence/compute/trend', ...g, async (req: Request, res: Response) => {
    try {
      const series = Array.isArray(req.body?.series) ? req.body.series : [];
      const epsilon = req.body?.epsilon == null ? undefined : Number(req.body.epsilon);
      res.json({ ok: true, result: computeTrend(series, epsilon == null ? {} : { epsilon }) });
    } catch (err) { degraded(res, 'compute-trend', err); }
  });

  app.post('/api/admin/benchmark-intelligence/compute/distribution', ...g, async (req: Request, res: Response) => {
    try {
      const binCount = req.body?.bins == null ? undefined : Number(req.body.bins);
      res.json({ ok: true, result: computeDistribution(numArray(req.body?.values), binCount) });
    } catch (err) { degraded(res, 'compute-distribution', err); }
  });

  app.post('/api/admin/benchmark-intelligence/compute/percentile-rank', ...g, async (req: Request, res: Response) => {
    try {
      res.json({ ok: true, result: computePercentileRank(numOrNull(req.body?.value), numArray(req.body?.values)) });
    } catch (err) { degraded(res, 'compute-percentile-rank', err); }
  });

  // Composite benchmark index — structured-AST formula (validate + evaluate; NO eval).
  app.post('/api/admin/benchmark-intelligence/compute/formula', ...g, async (req: Request, res: Response) => {
    try {
      const vars = (req.body?.vars && typeof req.body.vars === 'object' && !Array.isArray(req.body.vars)) ? req.body.vars : {};
      const knownVars = Array.isArray(req.body?.knownVars) ? req.body.knownVars.map(String) : undefined;
      res.json({ ok: true, result: evaluateBenchmarkFormula(req.body?.ast, vars, knownVars) });
    } catch (err) { degraded(res, 'compute-formula', err); }
  });

  // ── OVERLAY WRITES + LISTS — the ONLY DDL sites (behind flag + super-admin). ──
  // Literal /save + /list routes are distinct paths (no /:param collision).

  app.post('/api/admin/benchmark-intelligence/groups/save', ...g, async (req: Request, res: Response) => {
    try {
      const group_key = String(req.body?.group_key || '').trim();
      if (!group_key) return res.status(400).json({ ok: false, error: 'group_key_required' });
      res.json({ ok: true, result: await saveGroup(pool, { ...req.body, group_key }) });
    } catch (err) { degraded(res, 'groups-save', err); }
  });

  app.get('/api/admin/benchmark-intelligence/groups', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, groups: await listGroups(pool, req.query.benchmark_type ? String(req.query.benchmark_type) : undefined) }); }
    catch (err) { degraded(res, 'groups-list', err); }
  });

  app.post('/api/admin/benchmark-intelligence/configs/save', ...g, async (req: Request, res: Response) => {
    try {
      const config_key = String(req.body?.config_key || '').trim();
      if (!config_key) return res.status(400).json({ ok: false, error: 'config_key_required' });
      res.json({ ok: true, result: await saveConfig(pool, { ...req.body, config_key }) });
    } catch (err) { degraded(res, 'configs-save', err); }
  });

  app.get('/api/admin/benchmark-intelligence/configs', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, configs: await listConfigs(pool, req.query.scope ? String(req.query.scope) : undefined) }); }
    catch (err) { degraded(res, 'configs-list', err); }
  });

  app.post('/api/admin/benchmark-intelligence/configs/resolve', ...g, async (req: Request, res: Response) => {
    try {
      const context = (req.body?.context && typeof req.body.context === 'object' && !Array.isArray(req.body.context))
        ? req.body.context
        : (req.body && typeof req.body === 'object' ? req.body : {});
      res.json({ ok: true, result: await resolveConfig(pool, context) });
    } catch (err) { degraded(res, 'configs-resolve', err); }
  });

  app.post('/api/admin/benchmark-intelligence/results/save', ...g, async (req: Request, res: Response) => {
    try {
      const result_key = String(req.body?.result_key || '').trim();
      if (!result_key) return res.status(400).json({ ok: false, error: 'result_key_required' });
      res.json({ ok: true, result: await saveResult(pool, { ...req.body, result_key }) });
    } catch (err) { degraded(res, 'results-save', err); }
  });

  app.get('/api/admin/benchmark-intelligence/results/list', ...g, async (req: Request, res: Response) => {
    try {
      const subjectRef = req.query.subject_ref ? String(req.query.subject_ref) : undefined;
      const dimension = req.query.dimension ? String(req.query.dimension) : undefined;
      res.json({ ok: true, results: await listResults(pool, subjectRef, dimension) });
    } catch (err) { degraded(res, 'results-list', err); }
  });

  app.post('/api/admin/benchmark-intelligence/governance/transition', ...g, async (req: Request, res: Response) => {
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

  app.get('/api/admin/benchmark-intelligence/governance', ...g, async (req: Request, res: Response) => {
    try {
      const artefactType = req.query.artefact_type ? String(req.query.artefact_type) : undefined;
      const artefactKey = req.query.artefact_key ? String(req.query.artefact_key) : undefined;
      res.json({ ok: true, governance: await listGovernanceLog(pool, artefactType, artefactKey) });
    } catch (err) { degraded(res, 'governance-list', err); }
  });

  app.post('/api/admin/benchmark-intelligence/audit/save', ...g, async (req: Request, res: Response) => {
    try {
      const action = String(req.body?.action || '').trim();
      if (!action) return res.status(400).json({ ok: false, error: 'action_required' });
      res.json({ ok: true, result: await recordAudit(pool, { ...req.body, action }) });
    } catch (err) { degraded(res, 'audit-save', err); }
  });

  app.get('/api/admin/benchmark-intelligence/audit', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, audit: await listAudit(pool, req.query.target_key ? String(req.query.target_key) : undefined) }); }
    catch (err) { degraded(res, 'audit-list', err); }
  });

  app.post('/api/admin/benchmark-intelligence/views/save', ...g, async (req: Request, res: Response) => {
    try {
      const view_key = String(req.body?.view_key || '').trim();
      if (!view_key) return res.status(400).json({ ok: false, error: 'view_key_required' });
      res.json({ ok: true, result: await saveView(pool, { ...req.body, view_key }) });
    } catch (err) { degraded(res, 'views-save', err); }
  });

  app.get('/api/admin/benchmark-intelligence/views', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, views: await listViews(pool, req.query.owner ? String(req.query.owner) : undefined) }); }
    catch (err) { degraded(res, 'views-list', err); }
  });
}
