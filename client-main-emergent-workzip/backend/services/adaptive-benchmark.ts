/**
 * Phase 2 — Adaptive Benchmark Engine (orchestrator).
 *
 * Wires together: cohort lookup → empirical percentile → confidence tier →
 * dynamic weighting → role/family/domain alignment → explainability stamping.
 *
 * All reads run against `bench_*` and `onto_*` tables. NEVER returns peer
 * identities, raw user rows, or anything that would break k-anonymity.
 */

import { Pool } from 'pg';
import { empiricalPercentile, confidenceTier, PercentileResult } from './empirical-percentile.js';
import {
  computeWeights, alignmentScore, fitBand,
  WEIGHTING_VERSION, ContextFactors, WeightingResult,
} from './weighting-engine.js';

export const BENCH_METHODOLOGY_VERSION = '2.0.0';

// In-process caches — small, TTL-bound, k-anonymous (no PII).
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
function cached<T>(key: string, get: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Promise.resolve(hit.value as T);
  return get().then(v => { cache.set(key, { at: Date.now(), value: v }); return v; });
}

// ---- cohort resolution -----------------------------------------------------

export interface CohortRef { id: string; cohort_type: string; name: string; k_min: number }

export async function resolveCohort(pool: Pool, ctx: ContextFactors & { role_id?: string }, prefer: 'role'|'function'|'industry'|'layer'|'global' = 'global'): Promise<CohortRef | null> {
  // Resolve a single best cohort matching the requested level.
  const where: string[] = ['is_active = true'];
  const params: unknown[] = [];
  const add = (col: string, val?: string | null) => {
    if (val) { params.push(val); where.push(`${col} = $${params.length}`); }
  };
  if (prefer === 'role')     { where.push(`cohort_type = 'role'`);     add('role_id',     ctx.role_id); }
  if (prefer === 'function') { where.push(`cohort_type = 'function'`); add('function_id', ctx.function_id); }
  if (prefer === 'industry') { where.push(`cohort_type = 'industry'`); add('industry_id', ctx.industry_id); }
  if (prefer === 'layer')    { where.push(`cohort_type = 'layer'`);    add('layer_id',    ctx.layer_id); }
  if (prefer === 'global')   { where.push(`cohort_type = 'global'`); }
  const sql = `SELECT id, cohort_type, name, k_min FROM bench_cohorts WHERE ${where.join(' AND ')} LIMIT 1`;
  const { rows } = await pool.query<CohortRef>(sql, params);
  return rows[0] ?? null;
}

// ---- benchmark lookups -----------------------------------------------------

interface BenchmarkRow {
  cohort_id: string; competency_id: string;
  n_samples: number; mean: number; stddev: number; median: number;
  p10: number; p25: number; p50: number; p75: number; p90: number; p95: number; p99: number;
  min_score: number; max_score: number;
  sorted_samples: number[]; version: string; refreshed_at: string;
}

export async function getBenchmark(pool: Pool, cohortId: string, competencyId: string): Promise<BenchmarkRow | null> {
  return cached(`bm:${cohortId}:${competencyId}`, async () => {
    const { rows } = await pool.query<BenchmarkRow>(
      `SELECT cohort_id, competency_id, n_samples,
              mean::float AS mean, stddev::float AS stddev, median::float AS median,
              p10::float AS p10, p25::float AS p25, p50::float AS p50,
              p75::float AS p75, p90::float AS p90, p95::float AS p95, p99::float AS p99,
              min_score::float AS min_score, max_score::float AS max_score,
              sorted_samples, version, refreshed_at
         FROM bench_competency_benchmarks
        WHERE cohort_id = $1 AND competency_id = $2
        ORDER BY refreshed_at DESC LIMIT 1`,
      [cohortId, competencyId]);
    return rows[0] ?? null;
  });
}

export async function getCohortStats(pool: Pool, cohortId: string) {
  return cached(`cs:${cohortId}`, async () => {
    const { rows } = await pool.query(
      `SELECT s.*, c.name AS cohort_name, c.cohort_type, c.k_min
         FROM bench_cohort_statistics s JOIN bench_cohorts c ON c.id = s.cohort_id
        WHERE s.cohort_id = $1`, [cohortId]);
    return rows[0] ?? null;
  });
}

// ---- explainability scaffold ----------------------------------------------

export function buildExplainability(opts: {
  cohort: CohortRef; n: number; freshnessDays: number;
  weighting?: WeightingResult;
}) {
  const tier = confidenceTier(opts.n);
  return {
    methodology: 'empirical_percentile_v2',
    methodology_version: BENCH_METHODOLOGY_VERSION,
    weighting_version: opts.weighting?.version ?? WEIGHTING_VERSION,
    percentile_method: 'empirical (count(samples <= score) / n)',
    cohort: { id: opts.cohort.id, type: opts.cohort.cohort_type, name: opts.cohort.name },
    confidence: {
      tier,
      n: opts.n,
      k_anonymous: opts.n >= opts.cohort.k_min,
      freshness_days: opts.freshnessDays,
    },
    privacy: {
      k_anonymity_min: opts.cohort.k_min,
      aggregate_only: true,
      raw_peer_records_exposed: false,
    },
    notes: tier === 'provisional'
      ? 'Below k-anonymity threshold — treat as provisional.'
      : tier === 'D'
        ? 'k-anonymous but small sample — interpret with care.'
        : 'Robust empirical benchmark.',
  };
}

// ---- competency-level benchmark for a single user score -------------------

export async function benchmarkCompetency(pool: Pool, params: {
  cohort: CohortRef;
  competency_id: string;
  user_score: number;
}) {
  const bm = await getBenchmark(pool, params.cohort.id, params.competency_id);
  if (!bm) return null;

  // ---- Hard k-anonymity gate. If n < k_min, suppress percentile and detailed
  // distribution aggregates; return a provisional response only. -------------
  if (bm.n_samples < params.cohort.k_min) {
    return {
      competency_id: params.competency_id,
      user_score: params.user_score,
      percentile: null,
      band: null,
      confidence_interval_95: null,
      z_diagnostic: null,
      cohort_aggregates: { n: bm.n_samples, k_min: params.cohort.k_min, suppressed: true },
      suppressed: true,
      suppression_reason: 'insufficient_cohort_k_anonymity',
      explainability: buildExplainability({
        cohort: params.cohort, n: bm.n_samples,
        freshnessDays: Math.floor((Date.now() - new Date(bm.refreshed_at).getTime()) / 86400000),
      }),
    };
  }

  const pct: PercentileResult = empiricalPercentile(bm.sorted_samples, params.user_score);
  const freshDays = Math.floor((Date.now() - new Date(bm.refreshed_at).getTime()) / 86400000);
  return {
    competency_id: params.competency_id,
    user_score: params.user_score,
    percentile: pct.percentile,
    band: pct.band,
    confidence_interval_95: pct.confidence_interval_95,
    z_diagnostic: pct.z_diagnostic,
    cohort_aggregates: {
      n: bm.n_samples, mean: bm.mean, median: bm.median, stddev: bm.stddev,
      p10: bm.p10, p25: bm.p25, p50: bm.p50, p75: bm.p75, p90: bm.p90, p95: bm.p95,
    },
    explainability: buildExplainability({
      cohort: params.cohort, n: bm.n_samples, freshnessDays: freshDays,
    }),
  };
}

// ---- role / family / domain alignment -------------------------------------

export async function benchmarkRole(pool: Pool, params: {
  role_id: string;
  user_scores: Record<string, number>;
  context: ContextFactors;
}) {
  const weighting = await computeWeights(pool, params.role_id, params.context);
  const aligned = alignmentScore(weighting.weights, params.user_scores);

  // Resolve the role cohort if possible; else fall back to global.
  const cohort =
    (await resolveCohort(pool, { ...params.context, role_id: params.role_id }, 'role'))
    ?? (await resolveCohort(pool, params.context, 'global'))!;

  // Percentile of the alignment score within the role/global cohort, computed
  // by averaging per-competency empirical percentiles weighted by final_weight.
  // Per-entry k-anonymity gate: suppress any competency whose cohort row is
  // below k_min from the percentile aggregation (still listed but pct=null).
  let weightedPctSum = 0;
  let weightCovered = 0;
  let suppressedCompetencyCount = 0;
  const perComp: Array<{
    competency_id: string; canonical_name: string; user_score: number;
    percentile: number; weight: number; expected_level: number; contribution: number;
  }> = [];
  for (const w of weighting.weights) {
    const s = params.user_scores[w.competency_id];
    if (typeof s !== 'number') continue;
    const bm = await getBenchmark(pool, cohort.id, w.competency_id);
    if (!bm) continue;
    if (bm.n_samples < cohort.k_min) {
      suppressedCompetencyCount++;
      perComp.push({
        competency_id: w.competency_id, canonical_name: w.canonical_name,
        user_score: s, percentile: null as unknown as number,
        weight: w.final_weight, expected_level: w.expected_level,
        contribution: Math.round(s * w.final_weight * 100) / 100,
      });
      continue;
    }
    const p = empiricalPercentile(bm.sorted_samples, s).percentile;
    weightedPctSum += p * w.final_weight;
    weightCovered += w.final_weight;
    perComp.push({
      competency_id: w.competency_id,
      canonical_name: w.canonical_name,
      user_score: s,
      percentile: p,
      weight: w.final_weight,
      expected_level: w.expected_level,
      contribution: Math.round(s * w.final_weight * 100) / 100,
    });
  }
  const percentile = weightCovered > 0 ? Math.round(weightedPctSum / weightCovered) : null;

  // Cohort summary (mean reliability of the benchmark itself)
  const stats = await getCohortStats(pool, cohort.id);

  return {
    role_id: params.role_id,
    alignment_score: aligned.alignment,
    fit_band: fitBand(aligned.alignment),
    coverage: aligned.coverage,
    weighted_percentile_in_cohort: percentile,
    cohort: { id: cohort.id, name: cohort.name, type: cohort.cohort_type,
              n: stats?.n_total ?? null, tier: stats?.confidence_tier ?? 'provisional',
              k_anonymous: stats?.k_anonymous ?? false,
              k_min: cohort.k_min },
    suppressed_competency_count: suppressedCompetencyCount,
    competencies: perComp.sort((a, b) => b.weight - a.weight),
    weighting: {
      version: weighting.version,
      modifiers: weighting.weights.flatMap(w =>
        w.modifiers_applied.map(m => ({ competency: w.canonical_name, ...m }))),
    },
    explainability: buildExplainability({
      cohort, n: stats?.n_total ?? 0, freshnessDays: 0, weighting,
    }),
  };
}

export async function benchmarkFamilyOrDomain(pool: Pool, params: {
  level: 'family' | 'domain';
  scope_id: string;     // family_id or domain_id
  user_scores: Record<string, number>;
  cohort: CohortRef;
}) {
  const col = params.level === 'family' ? 'family_id' : 'domain_id';
  const { rows: comps } = await pool.query<{ id: string; canonical_name: string }>(
    `SELECT id, canonical_name FROM onto_competencies WHERE ${col} = $1`,
    [params.scope_id]);
  if (!comps.length) return null;

  const perComp: Array<{ competency_id: string; canonical_name: string; user_score: number; percentile: number; }> = [];
  let sumPct = 0; let count = 0;
  let suppressedCount = 0;
  for (const c of comps) {
    const s = params.user_scores[c.id];
    if (typeof s !== 'number') continue;
    const bm = await getBenchmark(pool, params.cohort.id, c.id);
    if (!bm) continue;
    // k-anonymity gate per cohort entry
    if (bm.n_samples < params.cohort.k_min) { suppressedCount++; continue; }
    const p = empiricalPercentile(bm.sorted_samples, s).percentile;
    perComp.push({ competency_id: c.id, canonical_name: c.canonical_name,
                   user_score: s, percentile: p });
    sumPct += p; count += 1;
  }
  if (!count) return { level: params.level, scope_id: params.scope_id,
                       suppressed: true, suppression_reason: 'insufficient_cohort_k_anonymity',
                       suppressed_competency_count: suppressedCount,
                       cohort: { id: params.cohort.id, type: params.cohort.cohort_type, name: params.cohort.name } };
  const aggregate = Math.round(sumPct / count);
  return {
    level: params.level,
    scope_id: params.scope_id,
    aggregate_percentile: aggregate,
    band: aggregate >= 75 ? 'upper' : aggregate >= 25 ? 'mid' : 'lower',
    competencies: perComp,
    cohort: { id: params.cohort.id, type: params.cohort.cohort_type, name: params.cohort.name },
    explainability: { method: 'mean of empirical percentiles', version: BENCH_METHODOLOGY_VERSION },
  };
}

// ---- audit ----------------------------------------------------------------

export async function auditLog(pool: Pool, evt: {
  event_type: string; endpoint: string;
  user_id?: string | null; session_id?: string | null; cohort_id?: string | null;
  request_summary?: Record<string, unknown>; response_summary?: Record<string, unknown>;
  k_check_passed: boolean;
}) {
  try {
    await pool.query(
      `INSERT INTO bench_audit_logs
         (event_type, user_id, session_id, cohort_id, endpoint,
          request_summary, response_summary, k_check_passed, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [evt.event_type, evt.user_id ?? null, evt.session_id ?? null, evt.cohort_id ?? null,
       evt.endpoint, evt.request_summary ?? {}, evt.response_summary ?? {},
       evt.k_check_passed, BENCH_METHODOLOGY_VERSION]);
  } catch { /* audit must not break the response */ }
}

// ---- synthetic user scores for demos --------------------------------------

export function demoUserScores(seed: string, competencyIds: string[]): Record<string, number> {
  // Deterministic 50..85 normal-ish scores per competency for the demo path.
  let a = 0; for (let i = 0; i < seed.length; i++) a = (a * 31 + seed.charCodeAt(i)) | 0;
  const out: Record<string, number> = {};
  for (const id of competencyIds) {
    a = (a + 0x9E3779B1) | 0;
    const r1 = (a >>> 0) / 4294967296;
    a = (a * 1664525 + 1013904223) | 0;
    const r2 = (a >>> 0) / 4294967296;
    const norm = Math.sqrt(-2 * Math.log(Math.max(1e-9, r1))) * Math.cos(2 * Math.PI * r2);
    out[id] = Math.max(20, Math.min(95, Math.round(65 + norm * 10)));
  }
  return out;
}
