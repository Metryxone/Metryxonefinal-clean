/**
 * CAPADEX 3.0 — Program 3 · Phase 3.7 Assessment Intelligence (Interpretation & Reporting) routes.
 *
 * A read-only certification composer over the ONE canonical Assessment Intelligence model + the
 * reuse-before-build engineering-closure mechanisms. EIGHT INDEPENDENT dimensions certified SEPARATELY:
 *   norms · standardization · benchmarking · ai_interpretation · report_intelligence ·
 *   candidate_performance · frontend · apis.
 * Scope is INTERPRETATION & REPORTING ONLY — it turns a SCORED + VALIDATED result into MEANING and
 * NEVER re-scores or re-validates the instrument. Realized outcomes & KPI roll-up are the downstream
 * Outcome/KPI scope (reported in-line as a boundary, NOT a gap).
 *
 * READ (certification):
 *   - GET /api/assessment-intelligence/enabled                    flag probe (503 when OFF)
 *   - GET /api/admin/assessment-intelligence/model               canonical registry
 *   - GET /api/admin/assessment-intelligence/dimensions          the 8 dimensions, evidence VERIFIED vs live FS+DB
 *   - GET /api/admin/assessment-intelligence/norm-types          7-type norm-reference catalog
 *   - GET /api/admin/assessment-intelligence/standard-score-types 8 standard-score types
 *   - GET /api/admin/assessment-intelligence/benchmark-scopes    6 benchmark scopes, evidence-verified
 *   - GET /api/admin/assessment-intelligence/ai-capabilities     6 AI-interpretation capabilities, evidence-verified
 *   - GET /api/admin/assessment-intelligence/report-sections     8 report sections, evidence-verified
 *   - GET /api/admin/assessment-intelligence/performance-metrics 8 candidate-performance metrics, evidence-verified
 *   - GET /api/admin/assessment-intelligence/mapping             9-step scored-result→intelligence-artefact mapping
 *   - GET /api/admin/assessment-intelligence/repository-alignment evidence rollup vs live FS+DB
 *   - GET /api/admin/assessment-intelligence/adoption            SEPARATE usage axis (never a gap)
 *   - GET /api/admin/assessment-intelligence/gaps                OPEN + RESOLVED gaps
 *   - GET /api/admin/assessment-intelligence/summary             8 dimensions reported SEPARATELY + verdict
 *
 * MECHANISMS (reuse-before-build; the ONLY DDL sites — run behind flag + super-admin → OFF creates 0 tables):
 *   compute/{standard-scores,norm-reference,benchmark,interpretation,report,performance} (PURE, no DB —
 *   reuse existing engines) ·
 *   norm-tables/{save,list} · standard-scores/{save,list} · benchmarks/{save,list} ·
 *   interpretations/{save,list} · reports/{save,list} · performance/{save,list} · repository/{save,list}.
 *
 * Strictly additive + reversible + flag-gated (`assessmentIntelligence`, FF_ASSESSMENT_INTELLIGENCE, default OFF):
 * OFF → every route 503 (503-before-auth) → byte-identical legacy incl. schema (no table touched).
 * Never throws: unexpected errors degrade to a 200 honest-degraded JSON. Coverage⟂Confidence⟂Adoption; null≠0.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  AINT_AXES, AINT_DIMENSIONS, NORM_TYPES, STANDARD_SCORE_TYPES,
  BENCHMARK_SCOPES, AI_INTERPRETATION_CAPABILITIES, REPORT_SECTIONS, PERFORMANCE_METRICS,
  MAPPING_MODEL, AINT_DECISIONS, AINT_K_MIN,
} from '../config/assessment-intelligence';
import {
  composeDimensions, composeNormTypes, composeStandardScoreTypes, composeBenchmarkScopes,
  composeAiCapabilities, composeReportSections, composePerformanceMetrics,
  composeMapping, composeRepositoryAlignment, composeAdoption, classifiedGaps, composeSummary,
} from '../services/assessment-intelligence-engine';
import {
  computeStandardScores, computeNormReference, computeBenchmark, computeInterpretation,
  computeReport, computePerformance,
  saveNormTable, listNormTables, saveStandardScore, listStandardScores,
  saveBenchmark, listBenchmarks, saveInterpretation, listInterpretations,
  saveReport, listReports, savePerformance, listPerformance,
  saveRepositoryArtefact, listRepository,
} from '../services/assessment-intelligence-mechanisms';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('assessmentIntelligence')) {
    return res.status(503).json({ ok: false, error: 'assessment_intelligence_disabled' });
  }
  next();
}

function degraded(res: Response, tag: string, err: unknown) {
  console.error(`[assessment-intelligence] ${tag} error:`, err);
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
}

export function registerAssessmentIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const g = [flagGate, requireAuth, requireSuperAdmin];

  // Flag probe (flag STATE is not sensitive). 503 when OFF; res.ok=true only when ON.
  app.get('/api/assessment-intelligence/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // Canonical model (static registry — no DB read).
  app.get('/api/admin/assessment-intelligence/model', ...g, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true, platform_frozen: true, k_min: AINT_K_MIN,
        axes: AINT_AXES, dimensions: AINT_DIMENSIONS,
        norm_types: NORM_TYPES, standard_score_types: STANDARD_SCORE_TYPES,
        benchmark_scopes: BENCHMARK_SCOPES, ai_capabilities: AI_INTERPRETATION_CAPABILITIES,
        report_sections: REPORT_SECTIONS, performance_metrics: PERFORMANCE_METRICS,
        mapping_model: MAPPING_MODEL, decisions: AINT_DECISIONS,
      });
    } catch (err) { degraded(res, 'model', err); }
  });

  app.get('/api/admin/assessment-intelligence/dimensions', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, dimensions: await composeDimensions(pool) }); }
    catch (err) { degraded(res, 'dimensions', err); }
  });

  app.get('/api/admin/assessment-intelligence/norm-types', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, norm_types: composeNormTypes() }); }
    catch (err) { degraded(res, 'norm-types', err); }
  });

  app.get('/api/admin/assessment-intelligence/standard-score-types', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, standard_score_types: composeStandardScoreTypes() }); }
    catch (err) { degraded(res, 'standard-score-types', err); }
  });

  app.get('/api/admin/assessment-intelligence/benchmark-scopes', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, benchmark_scopes: await composeBenchmarkScopes(pool) }); }
    catch (err) { degraded(res, 'benchmark-scopes', err); }
  });

  app.get('/api/admin/assessment-intelligence/ai-capabilities', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ai_capabilities: await composeAiCapabilities(pool) }); }
    catch (err) { degraded(res, 'ai-capabilities', err); }
  });

  app.get('/api/admin/assessment-intelligence/report-sections', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, report_sections: await composeReportSections(pool) }); }
    catch (err) { degraded(res, 'report-sections', err); }
  });

  app.get('/api/admin/assessment-intelligence/performance-metrics', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, performance_metrics: await composePerformanceMetrics(pool) }); }
    catch (err) { degraded(res, 'performance-metrics', err); }
  });

  app.get('/api/admin/assessment-intelligence/mapping', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, mapping: await composeMapping(pool) }); }
    catch (err) { degraded(res, 'mapping', err); }
  });

  app.get('/api/admin/assessment-intelligence/repository-alignment', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, repository_alignment: await composeRepositoryAlignment(pool) }); }
    catch (err) { degraded(res, 'repository-alignment', err); }
  });

  app.get('/api/admin/assessment-intelligence/adoption', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, adoption: await composeAdoption(pool) }); }
    catch (err) { degraded(res, 'adoption', err); }
  });

  app.get('/api/admin/assessment-intelligence/gaps', ...g, async (_req: Request, res: Response) => {
    try {
      const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();
      res.json({ ok: true, gaps, gap_counts, gap_total: gaps.length, resolved_gaps, resolved_gap_counts, resolved_gap_count });
    } catch (err) { degraded(res, 'gaps', err); }
  });

  app.get('/api/admin/assessment-intelligence/summary', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, summary: await composeSummary(pool) }); }
    catch (err) { degraded(res, 'summary', err); }
  });

  // ── PURE COMPUTE mechanisms — no DB, no DDL, no eval. Reuse the existing interpretation
  // engines. Norm-referenced statistics + benchmarks ABSTAIN below k_min real members (never
  // fabricated). Persist ONLY when persist=true (write path → DDL behind flag). ──

  app.post('/api/admin/assessment-intelligence/compute/standard-scores', ...g, async (req: Request, res: Response) => {
    try {
      const { value, mean, sd } = req.body || {};
      const result = computeStandardScores(
        value == null ? null : Number(value), mean == null ? null : Number(mean), sd == null ? null : Number(sd),
      );
      let saved: unknown = null;
      if (req.body?.persist === true && req.body?.score_key) {
        saved = await saveStandardScore(pool, {
          score_key: String(req.body.score_key), subject_ref: req.body?.subject_ref,
          assessment_slug: req.body?.assessment_slug, raw_value: result.input.value,
          z: result.z, percentile: result.percentile, t_score: result.t_score,
          stanine: result.stanine, sten: result.sten, deviation_score: result.deviation_score,
          norm_key: req.body?.norm_key, abstained: result.abstained, detail: result,
        });
      }
      res.json({ ok: true, result, saved });
    } catch (err) { degraded(res, 'compute-standard-scores', err); }
  });

  app.post('/api/admin/assessment-intelligence/compute/norm-reference', ...g, async (req: Request, res: Response) => {
    try {
      const value = req.body?.value == null ? null : Number(req.body.value);
      const reference = (req.body?.reference && typeof req.body.reference === 'object') ? req.body.reference : {};
      const options = (req.body?.options && typeof req.body.options === 'object') ? req.body.options : {};
      const result = computeNormReference(value, reference, options);
      let saved: unknown = null;
      if (req.body?.persist === true && req.body?.norm_key) {
        saved = await saveNormTable(pool, {
          norm_key: String(req.body.norm_key), norm_type: result.norm_type,
          label: result.reference_label ?? undefined, assessment_slug: req.body?.assessment_slug,
          reference_mean: reference?.mean ?? null, reference_sd: reference?.sd ?? null,
          n_members: result.n_members, abstained: result.abstained, detail: result,
        });
      }
      res.json({ ok: true, result, saved });
    } catch (err) { degraded(res, 'compute-norm-reference', err); }
  });

  app.post('/api/admin/assessment-intelligence/compute/benchmark', ...g, async (req: Request, res: Response) => {
    try {
      const value = req.body?.value == null ? null : Number(req.body.value);
      const groups = Array.isArray(req.body?.groups) ? req.body.groups : [];
      const options = (req.body?.options && typeof req.body.options === 'object') ? req.body.options : {};
      const result = computeBenchmark(value, groups, options);
      const saved: unknown[] = [];
      if (req.body?.persist === true && req.body?.benchmark_key) {
        const key = String(req.body.benchmark_key);
        for (const grp of result.groups) {
          saved.push(await saveBenchmark(pool, {
            benchmark_key: key, subject_ref: req.body?.subject_ref, scope: grp.scope,
            assessment_slug: req.body?.assessment_slug, value: result.value,
            percentile: grp.percentile, relative: grp.relative ?? undefined,
            n_members: grp.n_members, abstained: grp.abstained, detail: grp,
          }));
        }
      }
      res.json({ ok: true, result, saved: saved.length ? saved : null });
    } catch (err) { degraded(res, 'compute-benchmark', err); }
  });

  app.post('/api/admin/assessment-intelligence/compute/interpretation', ...g, async (req: Request, res: Response) => {
    try {
      const result = computeInterpretation((req.body?.input && typeof req.body.input === 'object') ? req.body.input : req.body || {});
      let saved: unknown = null;
      if (req.body?.persist === true && req.body?.interp_key) {
        saved = await saveInterpretation(pool, {
          interp_key: String(req.body.interp_key), subject_ref: req.body?.subject_ref,
          assessment_slug: req.body?.assessment_slug, narrative: result.narrative,
          strengths: result.strengths, development_areas: result.development_areas,
          reasoning: result.reasoning, recommendations: result.recommendations,
          confidence: result.confidence, source: result.source, abstained: result.abstained, detail: result,
        });
      }
      res.json({ ok: true, result, saved });
    } catch (err) { degraded(res, 'compute-interpretation', err); }
  });

  app.post('/api/admin/assessment-intelligence/compute/report', ...g, async (req: Request, res: Response) => {
    try {
      const result = computeReport((req.body?.input && typeof req.body.input === 'object') ? req.body.input : req.body || {});
      let saved: unknown = null;
      if (req.body?.persist === true && req.body?.report_key) {
        saved = await saveReport(pool, {
          report_key: String(req.body.report_key), subject_ref: req.body?.subject_ref,
          assessment_slug: req.body?.assessment_slug, sections: result.sections,
          section_count: result.section_count, status: req.body?.status, detail: result,
        });
      }
      res.json({ ok: true, result, saved });
    } catch (err) { degraded(res, 'compute-report', err); }
  });

  app.post('/api/admin/assessment-intelligence/compute/performance', ...g, async (req: Request, res: Response) => {
    try {
      const input = (req.body?.input && typeof req.body.input === 'object') ? req.body.input : req.body || {};
      const options = (req.body?.options && typeof req.body.options === 'object') ? req.body.options : {};
      const result = computePerformance(input, options);
      let saved: unknown = null;
      if (req.body?.persist === true && req.body?.perf_key) {
        saved = await savePerformance(pool, {
          perf_key: String(req.body.perf_key), subject_ref: req.body?.subject_ref,
          assessment_slug: req.body?.assessment_slug, overall_standing: result.overall_standing ?? undefined,
          overall_score: result.overall_score, percentile: result.percentile,
          readiness_band: result.readiness_band ?? undefined, peer_relative: result.peer_relative ?? undefined,
          growth_trajectory: result.growth_trajectory ?? undefined, dimension_profile: result.dimension_profile,
          abstained: result.percentile_abstained, detail: result,
        });
      }
      res.json({ ok: true, result, saved });
    } catch (err) { degraded(res, 'compute-performance', err); }
  });

  // ── OVERLAY WRITES + LISTS — the ONLY DDL sites (behind flag + super-admin). ──
  // Literal /save routes are distinct paths (no /:param collision).

  app.post('/api/admin/assessment-intelligence/norm-tables/save', ...g, async (req: Request, res: Response) => {
    try {
      const norm_key = String(req.body?.norm_key || '').trim();
      if (!norm_key) return res.status(400).json({ ok: false, error: 'norm_key_required' });
      res.json({ ok: true, result: await saveNormTable(pool, { ...req.body, norm_key }) });
    } catch (err) { degraded(res, 'norm-tables-save', err); }
  });

  app.get('/api/admin/assessment-intelligence/norm-tables', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, norm_tables: await listNormTables(pool, req.query.assessment_slug ? String(req.query.assessment_slug) : undefined) }); }
    catch (err) { degraded(res, 'norm-tables-list', err); }
  });

  app.post('/api/admin/assessment-intelligence/standard-scores/save', ...g, async (req: Request, res: Response) => {
    try {
      const score_key = String(req.body?.score_key || '').trim();
      if (!score_key) return res.status(400).json({ ok: false, error: 'score_key_required' });
      res.json({ ok: true, result: await saveStandardScore(pool, { ...req.body, score_key }) });
    } catch (err) { degraded(res, 'standard-scores-save', err); }
  });

  app.get('/api/admin/assessment-intelligence/standard-scores/list', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, standard_scores: await listStandardScores(pool, req.query.subject_ref ? String(req.query.subject_ref) : undefined) }); }
    catch (err) { degraded(res, 'standard-scores-list', err); }
  });

  app.post('/api/admin/assessment-intelligence/benchmarks/save', ...g, async (req: Request, res: Response) => {
    try {
      const benchmark_key = String(req.body?.benchmark_key || '').trim();
      if (!benchmark_key) return res.status(400).json({ ok: false, error: 'benchmark_key_required' });
      res.json({ ok: true, result: await saveBenchmark(pool, { ...req.body, benchmark_key }) });
    } catch (err) { degraded(res, 'benchmarks-save', err); }
  });

  app.get('/api/admin/assessment-intelligence/benchmarks', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, benchmarks: await listBenchmarks(pool, req.query.subject_ref ? String(req.query.subject_ref) : undefined) }); }
    catch (err) { degraded(res, 'benchmarks-list', err); }
  });

  app.post('/api/admin/assessment-intelligence/interpretations/save', ...g, async (req: Request, res: Response) => {
    try {
      const interp_key = String(req.body?.interp_key || '').trim();
      if (!interp_key) return res.status(400).json({ ok: false, error: 'interp_key_required' });
      res.json({ ok: true, result: await saveInterpretation(pool, { ...req.body, interp_key }) });
    } catch (err) { degraded(res, 'interpretations-save', err); }
  });

  app.get('/api/admin/assessment-intelligence/interpretations', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, interpretations: await listInterpretations(pool, req.query.subject_ref ? String(req.query.subject_ref) : undefined) }); }
    catch (err) { degraded(res, 'interpretations-list', err); }
  });

  app.post('/api/admin/assessment-intelligence/reports/save', ...g, async (req: Request, res: Response) => {
    try {
      const report_key = String(req.body?.report_key || '').trim();
      if (!report_key) return res.status(400).json({ ok: false, error: 'report_key_required' });
      res.json({ ok: true, result: await saveReport(pool, { ...req.body, report_key }) });
    } catch (err) { degraded(res, 'reports-save', err); }
  });

  app.get('/api/admin/assessment-intelligence/reports', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, reports: await listReports(pool, req.query.subject_ref ? String(req.query.subject_ref) : undefined) }); }
    catch (err) { degraded(res, 'reports-list', err); }
  });

  app.post('/api/admin/assessment-intelligence/performance/save', ...g, async (req: Request, res: Response) => {
    try {
      const perf_key = String(req.body?.perf_key || '').trim();
      if (!perf_key) return res.status(400).json({ ok: false, error: 'perf_key_required' });
      res.json({ ok: true, result: await savePerformance(pool, { ...req.body, perf_key }) });
    } catch (err) { degraded(res, 'performance-save', err); }
  });

  app.get('/api/admin/assessment-intelligence/performance', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, performance: await listPerformance(pool, req.query.subject_ref ? String(req.query.subject_ref) : undefined) }); }
    catch (err) { degraded(res, 'performance-list', err); }
  });

  app.post('/api/admin/assessment-intelligence/repository/save', ...g, async (req: Request, res: Response) => {
    try {
      const artefact_key = String(req.body?.artefact_key || '').trim();
      if (!artefact_key) return res.status(400).json({ ok: false, error: 'artefact_key_required' });
      res.json({ ok: true, result: await saveRepositoryArtefact(pool, { ...req.body, artefact_key }) });
    } catch (err) { degraded(res, 'repository-save', err); }
  });

  app.get('/api/admin/assessment-intelligence/repository', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, repository: await listRepository(pool) }); }
    catch (err) { degraded(res, 'repository-list', err); }
  });
}
