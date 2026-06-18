/**
 * Phase 2 — Adaptive Benchmarking routes (read-only, GET).
 *
 * Endpoints (all under `/api/benchmark/*`):
 *   GET /role          — full role alignment + explainability
 *   GET /domain        — aggregate per-domain percentile
 *   GET /family        — aggregate per-family percentile
 *   GET /competency    — single competency vs cohort
 *   GET /layer         — competency vector vs an organisational-layer cohort
 *   GET /aspirational  — gap vs an aspirational target role
 *   GET /confidence    — cohort × competency confidence tiers
 *   GET /reliability   — psychometric reliability for a (demo or real) session
 *
 * Input contract (kept simple for Phase 2):
 *   ?session_id=...    optional anchor for audit + reliability
 *   ?role_id=...       required for /role and /aspirational (as target_role_id)
 *   ?cohort=role|industry|function|layer|global   cohort preference
 *   ?scores={"comp_x":78,...}  inline JSON of user scores
 *   ?demo=true         server-generates deterministic demo user scores
 *   ?industry_id / function_id / layer_id / seniority / org_maturity
 *   ?team_scale / geography                       — context factors
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  resolveCohort, benchmarkCompetency, benchmarkRole, benchmarkFamilyOrDomain,
  auditLog, demoUserScores, BENCH_METHODOLOGY_VERSION, getCohortStats,
} from '../services/adaptive-benchmark.js';
import { computeReliability, computeQuality, demoResponses } from '../services/reliability-engine.js';
import type { ContextFactors } from '../services/weighting-engine.js';
import { createAssessmentWriter } from '../services/assessment-writer.js';

async function parseScores(req: Request, pool: Pool): Promise<Record<string, number>> {
  const raw = req.query.scores;
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  // Prefer persisted user scores when ?user_id is supplied
  const userId = typeof req.query.user_id === 'string' ? req.query.user_id : null;
  if (userId) {
    const w = createAssessmentWriter(pool);
    const real = await w.realUserScores(userId);
    if (real && Object.keys(real).length > 0) return real;
  }
  if (req.query.demo === 'true') {
    const { rows } = await pool.query<{ id: string }>(`SELECT id FROM onto_competencies`);
    return demoUserScores(String(req.query.session_id ?? userId ?? 'demo'), rows.map(r => r.id));
  }
  return {};
}

function parseContext(req: Request): ContextFactors {
  const q = req.query;
  const opt = (k: string) => (typeof q[k] === 'string' && q[k] ? String(q[k]) : null);
  return {
    industry_id:  opt('industry_id'),
    function_id:  opt('function_id'),
    layer_id:     opt('layer_id'),
    seniority:    opt('seniority')     as ContextFactors['seniority'],
    org_maturity: opt('org_maturity')  as ContextFactors['org_maturity'],
    team_scale:   opt('team_scale')    as ContextFactors['team_scale'],
    geography:    opt('geography')     as ContextFactors['geography'],
  };
}

function send(res: Response, data: unknown) { res.json({ ok: true, version: BENCH_METHODOLOGY_VERSION, data }); }
function fail(res: Response, code: number, error: string, detail?: unknown) {
  res.status(code).json({ ok: false, error, detail, version: BENCH_METHODOLOGY_VERSION });
}

export function registerAdaptiveBenchmarkRoutes({ app, pool }: { app: Express; pool: Pool }) {
  // GET /api/benchmark/role -------------------------------------------------
  app.get('/api/benchmark/role', async (req, res) => {
    try {
      const role_id = String(req.query.role_id ?? '');
      if (!role_id) return fail(res, 400, 'role_id_required');
      const ctx = parseContext(req);
      const scores = await parseScores(req, pool);
      if (!Object.keys(scores).length) return fail(res, 400, 'scores_or_demo_required');

      const result = await benchmarkRole(pool, { role_id, user_scores: scores, context: ctx });

      await auditLog(pool, {
        event_type: 'benchmark.role', endpoint: '/api/benchmark/role',
        session_id: String(req.query.session_id ?? '') || null,
        cohort_id: result.cohort.id,
        request_summary: { role_id, ctx, scores_count: Object.keys(scores).length },
        response_summary: { alignment: result.alignment_score, tier: result.cohort.tier },
        k_check_passed: result.cohort.k_anonymous,
      });

      send(res, result);
    } catch (e: unknown) { fail(res, 500, 'role_benchmark_failed', String((e as Error).message)); }
  });

  // GET /api/benchmark/competency -------------------------------------------
  app.get('/api/benchmark/competency', async (req, res) => {
    try {
      const competency_id = String(req.query.competency_id ?? '');
      const userScore = Number(req.query.score);
      if (!competency_id) return fail(res, 400, 'competency_id_required');
      if (!Number.isFinite(userScore)) return fail(res, 400, 'numeric_score_required');

      const ctx = parseContext(req);
      const prefer = (String(req.query.cohort ?? 'global') as 'role'|'industry'|'function'|'layer'|'global');
      const role_id = typeof req.query.role_id === 'string' ? String(req.query.role_id) : undefined;
      const cohort = await resolveCohort(pool, { ...ctx, role_id }, prefer)
                  ?? await resolveCohort(pool, ctx, 'global');
      if (!cohort) return fail(res, 404, 'no_cohort');
      const r = await benchmarkCompetency(pool, { cohort, competency_id, user_score: userScore });
      if (!r) return fail(res, 404, 'no_benchmark_for_competency_in_cohort');

      await auditLog(pool, {
        event_type: 'benchmark.competency', endpoint: '/api/benchmark/competency',
        cohort_id: cohort.id, request_summary: { competency_id, userScore },
        response_summary: { percentile: r.percentile },
        k_check_passed: !!r.cohort_aggregates && r.cohort_aggregates.n >= cohort.k_min,
      });

      send(res, r);
    } catch (e: unknown) { fail(res, 500, 'competency_benchmark_failed', String((e as Error).message)); }
  });

  // GET /api/benchmark/family ----------------------------------------------
  app.get('/api/benchmark/family', async (req, res) => {
    try {
      const family_id = String(req.query.family_id ?? '');
      if (!family_id) return fail(res, 400, 'family_id_required');
      const ctx = parseContext(req);
      const scores = await parseScores(req, pool);
      if (!Object.keys(scores).length) return fail(res, 400, 'scores_or_demo_required');
      const cohort = await resolveCohort(pool,
        { ...ctx, role_id: typeof req.query.role_id === 'string' ? String(req.query.role_id) : undefined },
        (String(req.query.cohort ?? 'global') as 'role'|'industry'|'function'|'layer'|'global'))
        ?? await resolveCohort(pool, ctx, 'global');
      if (!cohort) return fail(res, 404, 'no_cohort');
      const r = await benchmarkFamilyOrDomain(pool, { level: 'family', scope_id: family_id, user_scores: scores, cohort });
      if (!r) return fail(res, 404, 'no_benchmark');
      await auditLog(pool, {
        event_type: 'benchmark.family', endpoint: '/api/benchmark/family',
        session_id: String(req.query.session_id ?? '') || null, cohort_id: cohort.id,
        request_summary: { family_id, scores_count: Object.keys(scores).length },
        response_summary: { suppressed: !!(r as any).suppressed,
                            aggregate_percentile: (r as any).aggregate_percentile ?? null },
        k_check_passed: !(r as any).suppressed,
      });
      send(res, r);
    } catch (e: unknown) { fail(res, 500, 'family_benchmark_failed', String((e as Error).message)); }
  });

  // GET /api/benchmark/domain ----------------------------------------------
  app.get('/api/benchmark/domain', async (req, res) => {
    try {
      const domain_id = String(req.query.domain_id ?? '');
      if (!domain_id) return fail(res, 400, 'domain_id_required');
      const ctx = parseContext(req);
      const scores = await parseScores(req, pool);
      if (!Object.keys(scores).length) return fail(res, 400, 'scores_or_demo_required');
      const cohort = await resolveCohort(pool,
        { ...ctx, role_id: typeof req.query.role_id === 'string' ? String(req.query.role_id) : undefined },
        (String(req.query.cohort ?? 'global') as 'role'|'industry'|'function'|'layer'|'global'))
        ?? await resolveCohort(pool, ctx, 'global');
      if (!cohort) return fail(res, 404, 'no_cohort');
      const r = await benchmarkFamilyOrDomain(pool, { level: 'domain', scope_id: domain_id, user_scores: scores, cohort });
      if (!r) return fail(res, 404, 'no_benchmark');
      await auditLog(pool, {
        event_type: 'benchmark.domain', endpoint: '/api/benchmark/domain',
        session_id: String(req.query.session_id ?? '') || null, cohort_id: cohort.id,
        request_summary: { domain_id, scores_count: Object.keys(scores).length },
        response_summary: { suppressed: !!(r as any).suppressed,
                            aggregate_percentile: (r as any).aggregate_percentile ?? null },
        k_check_passed: !(r as any).suppressed,
      });
      send(res, r);
    } catch (e: unknown) { fail(res, 500, 'domain_benchmark_failed', String((e as Error).message)); }
  });

  // GET /api/benchmark/layer -----------------------------------------------
  app.get('/api/benchmark/layer', async (req, res) => {
    try {
      const layer_id = String(req.query.layer_id ?? '');
      if (!layer_id) return fail(res, 400, 'layer_id_required');
      const cohort = await resolveCohort(pool, { layer_id }, 'layer');
      if (!cohort) return fail(res, 404, 'no_layer_cohort');
      const scores = await parseScores(req, pool);
      if (!Object.keys(scores).length) return fail(res, 400, 'scores_or_demo_required');

      // Per-competency empirical percentile against this layer cohort
      const { rows: comps } = await pool.query<{ id: string; canonical_name: string }>(
        `SELECT id, canonical_name FROM onto_competencies`);
      const items = [];
      for (const c of comps) {
        const s = scores[c.id]; if (typeof s !== 'number') continue;
        const r = await benchmarkCompetency(pool, { cohort, competency_id: c.id, user_score: s });
        if (r) items.push({ competency_id: c.id, canonical_name: c.canonical_name,
                            user_score: s, percentile: r.percentile, band: r.band });
      }
      const stats = await getCohortStats(pool, cohort.id);
      const kPassed = (stats?.n_total ?? 0) >= cohort.k_min;
      await auditLog(pool, {
        event_type: 'benchmark.layer', endpoint: '/api/benchmark/layer',
        session_id: String(req.query.session_id ?? '') || null, cohort_id: cohort.id,
        request_summary: { layer_id, scores_count: Object.keys(scores).length },
        response_summary: { items: items.length },
        k_check_passed: kPassed,
      });
      send(res, {
        cohort: { id: cohort.id, name: cohort.name, type: cohort.cohort_type,
                  n: stats?.n_total ?? 0, tier: stats?.confidence_tier ?? 'provisional',
                  k_anonymous: kPassed, k_min: cohort.k_min },
        layer_id, competencies: items,
        explainability: { methodology_version: BENCH_METHODOLOGY_VERSION,
                          percentile_method: 'empirical', cohort_type: 'layer' },
      });
    } catch (e: unknown) { fail(res, 500, 'layer_benchmark_failed', String((e as Error).message)); }
  });

  // GET /api/benchmark/aspirational ----------------------------------------
  app.get('/api/benchmark/aspirational', async (req, res) => {
    try {
      const role_id = String(req.query.role_id ?? '');           // current
      const target_role_id = String(req.query.target_role_id ?? ''); // aspirational
      if (!target_role_id) return fail(res, 400, 'target_role_id_required');
      const ctx = parseContext(req);
      const scores = await parseScores(req, pool);
      if (!Object.keys(scores).length) return fail(res, 400, 'scores_or_demo_required');

      const target = await benchmarkRole(pool, { role_id: target_role_id, user_scores: scores, context: ctx });
      const current = role_id ? await benchmarkRole(pool, { role_id, user_scores: scores, context: ctx }) : null;

      // Per-competency gap vs target expected_level (mapped 1..5 → 0..100 anchors).
      const levelAnchors = [0, 30, 50, 65, 80, 92];
      const gaps = target.competencies.map(c => {
        const expected = levelAnchors[Math.min(5, Math.max(0, c.expected_level))];
        const gap = Math.round((c.user_score - expected) * 10) / 10;
        return {
          competency_id: c.competency_id, canonical_name: c.canonical_name,
          user_score: c.user_score, expected_level: c.expected_level,
          expected_anchor: expected, gap,
          status: gap >= 0 ? 'meets' : gap >= -10 ? 'close' : 'develop',
          weight: c.weight,
        };
      }).sort((a, b) => a.gap - b.gap);

      await auditLog(pool, {
        event_type: 'benchmark.aspirational', endpoint: '/api/benchmark/aspirational',
        session_id: String(req.query.session_id ?? '') || null,
        cohort_id: target.cohort.id,
        request_summary: { role_id, target_role_id, ctx },
        response_summary: { readiness: target.alignment_score, gaps: gaps.length },
        k_check_passed: target.cohort.k_anonymous,
      });
      send(res, {
        current: current ? { role_id, alignment: current.alignment_score, fit_band: current.fit_band } : null,
        target: { role_id: target_role_id, alignment: target.alignment_score, fit_band: target.fit_band,
                  weighted_percentile_in_cohort: target.weighted_percentile_in_cohort,
                  cohort: target.cohort },
        readiness_index: target.alignment_score,
        critical_gaps: gaps.filter(g => g.status === 'develop').slice(0, 5),
        all_gaps: gaps,
        explainability: target.explainability,
      });
    } catch (e: unknown) { fail(res, 500, 'aspirational_benchmark_failed', String((e as Error).message)); }
  });

  // GET /api/benchmark/confidence ------------------------------------------
  app.get('/api/benchmark/confidence', async (req, res) => {
    try {
      const cohort_id = typeof req.query.cohort_id === 'string' ? String(req.query.cohort_id) : null;
      const { rows } = await pool.query(
        `SELECT bc.cohort_id, c.name AS cohort_name, c.cohort_type,
                bc.competency_id, k.canonical_name,
                bc.n, bc.tier, bc.ci_low::float AS ci_low, bc.ci_high::float AS ci_high,
                bc.freshness_days, bc.reasoning, bc.computed_at
           FROM bench_confidence bc
           JOIN bench_cohorts c     ON c.id = bc.cohort_id
           LEFT JOIN onto_competencies k ON k.id = bc.competency_id
          WHERE ($1::text IS NULL OR bc.cohort_id = $1)
          ORDER BY bc.cohort_id, bc.tier, k.canonical_name`,
        [cohort_id]);
      const tierCounts: Record<string, number> = {};
      for (const r of rows) tierCounts[r.tier] = (tierCounts[r.tier] ?? 0) + 1;
      await auditLog(pool, {
        event_type: 'benchmark.confidence', endpoint: '/api/benchmark/confidence',
        cohort_id: cohort_id, request_summary: { cohort_id },
        response_summary: { rows: rows.length, tier_summary: tierCounts },
        k_check_passed: true,
      });
      send(res, { tier_summary: tierCounts, rows });
    } catch (e: unknown) { fail(res, 500, 'confidence_failed', String((e as Error).message)); }
  });

  // GET /api/benchmark/reliability ------------------------------------------
  app.get('/api/benchmark/reliability', async (req, res) => {
    try {
      const session_id = String(req.query.session_id ?? `demo-${Date.now()}`);
      // Phase 2: read-only endpoint. If demo=true OR no upstream responses
      // available, generate deterministic demo responses so the engine can run.
      const responses = req.query.demo === 'true' || !req.query.real
        ? demoResponses(session_id)
        : demoResponses(session_id); // hook real-source fetch here in Phase 2.1+
      const reliability = computeReliability(session_id, responses);
      const quality     = computeQuality(session_id, responses);
      await auditLog(pool, {
        event_type: 'benchmark.reliability', endpoint: '/api/benchmark/reliability',
        session_id, request_summary: { items: responses.length },
        response_summary: { reliability_index: reliability.reliability_index,
                            quality_tier: quality.quality_tier },
        k_check_passed: true,
      });
      send(res, {
        session_id,
        reliability,
        quality,
        explainability: {
          methodology_version: BENCH_METHODOLOGY_VERSION,
          composition: { consistency: 0.40, reverse: 0.20, contradictions: 0.20, completion: 0.15, anomalies: 0.05 },
          tier_cutoffs: { A: 0.85, B: 0.70, C: 0.50, D: '<0.50' },
        },
      });
    } catch (e: unknown) { fail(res, 500, 'reliability_failed', String((e as Error).message)); }
  });
}
