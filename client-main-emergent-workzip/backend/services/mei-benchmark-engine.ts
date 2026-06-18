/**
 * MEI v2 Benchmark Engine
 * ────────────────────────
 * Computes cohort percentile rank for a given MEI score.
 * Cohort key = {industry_code}:{role_level_code}:{yoe_band}
 *
 * Design principles:
 *  - k-anonymity: suppress cohorts with sample_size < K_MIN (= 30)
 *  - Read-only over mei_benchmarks table
 *  - Graceful degradation: no cohort data → null percentile, not an error
 *  - Refresh is done by an offline script (never in the request path)
 */

import type { Pool } from 'pg';
import type { MEIScoreOutput } from './mei-scoring-engine';

const K_MIN = 10; // minimum cohort size to report percentile (relaxed from 30 while warming)

export interface BenchmarkResult {
  cohort_key:        string;
  industry_code:     string | null;
  role_level_code:   string | null;
  yoe_band:          string | null;
  sample_size:       number;
  percentile_rank:   number | null;   // null if cohort < K_MIN
  gap_to_median:     number | null;
  gap_to_p75:        number | null;
  p25:               number | null;
  p50:               number | null;
  p75:               number | null;
  p90:               number | null;
  mean:              number | null;
  std_dev:           number | null;
  dimension_gaps:    Array<{ dimension_code: string; user_score: number; cohort_p50: number; gap: number }>;
  suppressed:        boolean;
  suppression_reason?: string;
}

export function deriveYoeBand(totalMonths: number): string {
  const years = totalMonths / 12;
  if (years < 2)  return '0-2';
  if (years < 5)  return '2-5';
  if (years < 10) return '5-10';
  return '10+';
}

export function deriveCohortKey(
  industryCode: string | null,
  roleLevelCode: string | null,
  yoeBand: string | null
): string {
  return [industryCode ?? 'any', roleLevelCode ?? 'any', yoeBand ?? 'any'].join(':');
}

/**
 * Compute percentile rank from cohort statistics using normal approximation.
 * When we have full distribution (p25/p50/p75/p90) we interpolate.
 */
function estimatePercentile(score: number, p25: number, p50: number, p75: number, p90: number, mean: number, std_dev: number): number {
  if (score <= p25) return Math.max(1, Math.round(25 * (score - 0) / (p25 - 0)));
  if (score <= p50) return Math.round(25 + 25 * (score - p25) / (p50 - p25));
  if (score <= p75) return Math.round(50 + 25 * (score - p50) / (p75 - p50));
  if (score <= p90) return Math.round(75 + 15 * (score - p75) / (p90 - p75));
  return Math.min(99, Math.round(90 + 9 * (score - p90) / Math.max(1, 100 - p90)));
}

export async function computeBenchmark(
  pool: Pool,
  score: MEIScoreOutput,
  totalMonths: number
): Promise<BenchmarkResult> {
  const yoeBand = deriveYoeBand(totalMonths);
  const cohortKey = deriveCohortKey(score.industry_code, score.role_level_code, yoeBand);

  // Try exact cohort first, then progressively relax
  const fallbackKeys = [
    cohortKey,
    deriveCohortKey(score.industry_code, score.role_level_code, null),
    deriveCohortKey(score.industry_code, null, yoeBand),
    deriveCohortKey(null, score.role_level_code, yoeBand),
    deriveCohortKey(score.industry_code, null, null),
    deriveCohortKey(null, score.role_level_code, null),
    'any:any:any',
  ];

  let cohortRow: Record<string, unknown> | null = null;
  let usedKey = cohortKey;

  for (const key of fallbackKeys) {
    const res = await pool.query(
      'SELECT * FROM mei_benchmarks WHERE cohort_key = $1 AND sample_size >= $2 LIMIT 1',
      [key, K_MIN]
    );
    if (res.rows.length > 0) {
      cohortRow = res.rows[0] as Record<string, unknown>;
      usedKey = key;
      break;
    }
  }

  const base: BenchmarkResult = {
    cohort_key:     usedKey,
    industry_code:  score.industry_code,
    role_level_code: score.role_level_code,
    yoe_band:       yoeBand,
    sample_size:    0,
    percentile_rank: null,
    gap_to_median:  null,
    gap_to_p75:     null,
    p25: null, p50: null, p75: null, p90: null,
    mean: null, std_dev: null,
    dimension_gaps: [],
    suppressed: true,
    suppression_reason: 'no_cohort_data',
  };

  if (!cohortRow) return base;

  const sampleSize = cohortRow.sample_size as number ?? 0;
  if (sampleSize < K_MIN) {
    return { ...base, sample_size: sampleSize, suppressed: true, suppression_reason: `cohort_too_small(n=${sampleSize},min=${K_MIN})` };
  }

  const p25   = parseFloat(String(cohortRow.p25 ?? 0));
  const p50   = parseFloat(String(cohortRow.p50 ?? 0));
  const p75   = parseFloat(String(cohortRow.p75 ?? 0));
  const p90   = parseFloat(String(cohortRow.p90 ?? 0));
  const mean  = parseFloat(String(cohortRow.mean ?? 0));
  const stdDev = parseFloat(String(cohortRow.std_dev ?? 0));

  const pctRank = estimatePercentile(score.composite_score, p25, p50, p75, p90, mean, stdDev);
  const dimP50 = cohortRow.dimension_p50 as Record<string, number> ?? {};

  const dimensionGaps = score.dimensions.map(d => ({
    dimension_code: d.code,
    user_score: Math.round(d.score * 100),
    cohort_p50: Math.round((dimP50[d.code] ?? 0) * 100),
    gap: Math.round((d.score - (dimP50[d.code] ?? 0)) * 100),
  }));

  return {
    cohort_key:     usedKey,
    industry_code:  score.industry_code,
    role_level_code: score.role_level_code,
    yoe_band:       yoeBand,
    sample_size:    sampleSize,
    percentile_rank: pctRank,
    gap_to_median:  Math.round((score.composite_score - p50) * 10) / 10,
    gap_to_p75:     Math.round((score.composite_score - p75) * 10) / 10,
    p25, p50, p75, p90, mean, std_dev: stdDev,
    dimension_gaps: dimensionGaps,
    suppressed: false,
  };
}

/**
 * Refresh benchmark aggregate for a cohort from live score data.
 * Called by an admin-triggered endpoint or nightly cron — never in the hot path.
 */
export async function refreshCohortBenchmark(
  pool: Pool,
  industryCode: string | null,
  roleLevelCode: string | null,
  yoeBand: string | null
): Promise<{ cohort_key: string; sample_size: number; refreshed: boolean }> {
  const cohortKey = deriveCohortKey(industryCode, roleLevelCode, yoeBand);

  // Pull all scores matching this cohort
  const where: string[] = [];
  const params: unknown[] = [];
  if (industryCode)   { params.push(industryCode);   where.push(`industry_code = $${params.length}`); }
  if (roleLevelCode)  { params.push(roleLevelCode);   where.push(`role_level_code = $${params.length}`); }
  // yoe_band: derive from breakdown (not stored directly; apply in application layer)
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const res = await pool.query(
    `SELECT composite_score::float, breakdown FROM mei_scores ${whereClause}`,
    params
  );

  if (res.rows.length < K_MIN) {
    return { cohort_key: cohortKey, sample_size: res.rows.length, refreshed: false };
  }

  const scores = res.rows.map(r => r.composite_score as number).sort((a, b) => a - b);
  const n = scores.length;
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  function pct(p: number) {
    const idx = Math.min(Math.floor((p / 100) * n), n - 1);
    return scores[idx];
  }

  // Per-dimension median
  const dimScoreMap: Record<string, number[]> = {};
  for (const row of res.rows) {
    const breakdown = row.breakdown as { dimensions?: Array<{ code: string; score: number }> };
    for (const dim of breakdown.dimensions ?? []) {
      if (!dimScoreMap[dim.code]) dimScoreMap[dim.code] = [];
      dimScoreMap[dim.code].push(dim.score);
    }
  }
  const dimensionP50: Record<string, number> = {};
  for (const [code, arr] of Object.entries(dimScoreMap)) {
    arr.sort((a, b) => a - b);
    dimensionP50[code] = arr[Math.floor(arr.length / 2)];
  }

  await pool.query(
    `INSERT INTO mei_benchmarks
       (cohort_key, industry_code, role_level_code, yoe_band, sample_size,
        p25, p50, p75, p90, mean, std_dev, dimension_p50, refreshed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     ON CONFLICT (cohort_key) DO UPDATE SET
       sample_size=$5, p25=$6, p50=$7, p75=$8, p90=$9,
       mean=$10, std_dev=$11, dimension_p50=$12, refreshed_at=NOW()`,
    [cohortKey, industryCode, roleLevelCode, yoeBand, n,
     pct(25), pct(50), pct(75), pct(90), mean, stdDev,
     JSON.stringify(dimensionP50)]
  );

  return { cohort_key: cohortKey, sample_size: n, refreshed: true };
}
