import type { Pool } from 'pg';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BenchmarkResult {
  metric: string;
  user_score: number | null;
  peer_mean: number | null;
  peer_median: number | null;
  p25: number | null;
  p75: number | null;
  percentile: number | null;
  cohort_size: number;
  suppressed: boolean;
  min_cohort_size: number;
  note?: string;
}

export interface CohortDefinition {
  same_age_band?: boolean;
  same_stage_code?: boolean;
  same_persona?: boolean;
  same_concern?: boolean;
  same_institution?: boolean;
  same_industry?: boolean;
  same_education_level?: boolean;
  same_domain?: boolean;
  same_role_family?: boolean;
  same_programme?: boolean;
}

// ── Per-metric SQL resolvers ───────────────────────────────────────────────

type MetricQuery = (
  pool: Pool,
  userContextRow: Record<string, unknown>,
  cohortWhere: string,
  cohortParams: unknown[],
) => Promise<{ values: number[]; userValue: number | null }>;

const METRIC_RESOLVERS: Record<string, MetricQuery> = {
  // CAPADEX session score
  capadex_score: async (pool, ctx, where, params) => {
    const { rows } = await pool.query(
      `SELECT score::numeric FROM capadex_sessions
       WHERE status='complete' AND score IS NOT NULL ${where ? 'AND ' + where : ''}
       LIMIT 500`,
      params,
    ).catch(() => ({ rows: [] as any[] }));
    const userValue = ctx.capadex_score != null ? Number(ctx.capadex_score) : null;
    return { values: rows.map(r => Number(r.score)), userValue };
  },

  // Career passport readiness score (any score_type)
  readiness_score: async (pool, ctx, where, params) => {
    const { rows } = await pool.query(
      `SELECT crs.score::numeric
       FROM cp_readiness_scores crs
       JOIN cp_passport cp ON cp.id = crs.passport_id
       WHERE crs.is_visible = true
         AND crs.score IS NOT NULL
       LIMIT 500`,
      params.filter((_, i) => !['age_band', 'stage_code', 'persona', 'concern'].includes(String(i))),
    ).catch(() => ({ rows: [] as any[] }));
    const userValue = ctx.readiness_score != null ? Number(ctx.readiness_score) : null;
    return { values: rows.map(r => Number(r.score)), userValue };
  },

  // Behavioural dimension: motivation
  motivation: async (pool, ctx, where, params) => {
    const { rows } = await pool.query(
      `SELECT motivation::numeric FROM wcl0_user_intelligence
       WHERE motivation IS NOT NULL
       LIMIT 500`,
      [],
    ).catch(() => ({ rows: [] as any[] }));
    const userValue = ctx.motivation != null ? Number(ctx.motivation) : null;
    return { values: rows.map(r => Number(r.motivation)), userValue };
  },

  confidence: async (pool, ctx) => {
    const { rows } = await pool.query(
      `SELECT confidence::numeric FROM wcl0_user_intelligence WHERE confidence IS NOT NULL LIMIT 500`, [],
    ).catch(() => ({ rows: [] as any[] }));
    return { values: rows.map(r => Number(r.confidence)), userValue: ctx.confidence != null ? Number(ctx.confidence) : null };
  },

  risk: async (pool, ctx) => {
    const { rows } = await pool.query(
      `SELECT risk::numeric FROM wcl0_user_intelligence WHERE risk IS NOT NULL LIMIT 500`, [],
    ).catch(() => ({ rows: [] as any[] }));
    return { values: rows.map(r => Number(r.risk)), userValue: ctx.risk != null ? Number(ctx.risk) : null };
  },

  engagement: async (pool, ctx) => {
    const { rows } = await pool.query(
      `SELECT engagement::numeric FROM wcl0_user_intelligence WHERE engagement IS NOT NULL LIMIT 500`, [],
    ).catch(() => ({ rows: [] as any[] }));
    return { values: rows.map(r => Number(r.engagement)), userValue: ctx.engagement != null ? Number(ctx.engagement) : null };
  },

  adaptability: async (pool, ctx) => {
    const { rows } = await pool.query(
      `SELECT adaptability::numeric FROM wcl0_user_intelligence WHERE adaptability IS NOT NULL LIMIT 500`, [],
    ).catch(() => ({ rows: [] as any[] }));
    return { values: rows.map(r => Number(r.adaptability)), userValue: ctx.adaptability != null ? Number(ctx.adaptability) : null };
  },

  // Career passport: average competency proficiency score
  competency_score: async (pool, ctx) => {
    const { rows } = await pool.query(
      `SELECT AVG(proficiency_score)::numeric AS avg_score
       FROM cp_competencies
       WHERE proficiency_score IS NOT NULL
       GROUP BY passport_id
       LIMIT 500`,
      [],
    ).catch(() => ({ rows: [] as any[] }));
    return {
      values: rows.map(r => Number(r.avg_score)).filter(Number.isFinite),
      userValue: ctx.competency_score != null ? Number(ctx.competency_score) : null,
    };
  },

  // Career passport: completeness percentage
  completeness_score: async (pool, ctx) => {
    const { rows } = await pool.query(
      `SELECT (data->>'completeness')::numeric AS pct FROM cp_passport WHERE data->>'completeness' IS NOT NULL LIMIT 500`, [],
    ).catch(() => ({ rows: [] as any[] }));
    return {
      values: rows.map(r => Number(r.pct)).filter(Number.isFinite),
      userValue: ctx.completeness_score != null ? Number(ctx.completeness_score) : null,
    };
  },

  // Verified item count from passport
  verified_count: async (pool, ctx) => {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM cp_competencies WHERE third_party_verified = true GROUP BY passport_id LIMIT 500`, [],
    ).catch(() => ({ rows: [] as any[] }));
    return {
      values: rows.map(r => Number(r.cnt)),
      userValue: ctx.verified_count != null ? Number(ctx.verified_count) : null,
    };
  },

  // Intervention readiness (proxied from CAPADEX score)
  intervention_readiness: async (pool, ctx) => {
    const { rows } = await pool.query(
      `SELECT score::numeric FROM capadex_sessions WHERE status='complete' AND score IS NOT NULL LIMIT 500`, [],
    ).catch(() => ({ rows: [] as any[] }));
    return { values: rows.map(r => Number(r.score)), userValue: ctx.intervention_readiness != null ? Number(ctx.intervention_readiness) : null };
  },

  // Generic fallback: concern_count (answered items per session)
  concern_count: async (pool, ctx) => {
    const { rows } = await pool.query(
      `SELECT answered_items::numeric FROM capadex_sessions WHERE status='complete' LIMIT 500`, [],
    ).catch(() => ({ rows: [] as any[] }));
    return { values: rows.map(r => Number(r.answered_items)), userValue: ctx.concern_count != null ? Number(ctx.concern_count) : null };
  },

  // Composite behavioural score — average of all non-null wcl0 behavioural dimensions per session
  behaviour_score: async (pool, ctx) => {
    const { rows } = await pool.query(
      `SELECT ROUND((
         COALESCE(motivation,0) + COALESCE(confidence,0) + COALESCE(risk,0) +
         COALESCE(engagement,0) + COALESCE(adaptability,0)
       )::numeric / NULLIF(
         (CASE WHEN motivation IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN confidence IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN risk IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN engagement IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN adaptability IS NOT NULL THEN 1 ELSE 0 END), 0
       ), 3) AS bscore
       FROM wcl0_user_intelligence
       WHERE behaviour_dims_present > 0
       LIMIT 500`, [],
    ).catch(() => ({ rows: [] as any[] }));
    return {
      values: rows.map(r => Number(r.bscore)).filter(Number.isFinite),
      userValue: ctx.behaviour_score != null ? Number(ctx.behaviour_score) : null,
    };
  },

  // Gap score — average proficiency gap (100 - proficiency) across competencies
  gap_score: async (pool, ctx) => {
    const { rows } = await pool.query(
      `SELECT ROUND(AVG(100 - proficiency_score)::numeric, 1) AS gap
       FROM cp_competencies
       WHERE proficiency_score IS NOT NULL
       GROUP BY passport_id
       LIMIT 500`, [],
    ).catch(() => ({ rows: [] as any[] }));
    return {
      values: rows.map(r => Number(r.gap)).filter(Number.isFinite),
      userValue: ctx.gap_score != null ? Number(ctx.gap_score) : null,
    };
  },

  // Strength score — average proficiency score of top-rated competencies (>=70)
  strength_score: async (pool, ctx) => {
    const { rows } = await pool.query(
      `SELECT ROUND(AVG(proficiency_score)::numeric, 1) AS strength
       FROM cp_competencies
       WHERE proficiency_score >= 70
       GROUP BY passport_id
       LIMIT 500`, [],
    ).catch(() => ({ rows: [] as any[] }));
    return {
      values: rows.map(r => Number(r.strength)).filter(Number.isFinite),
      userValue: ctx.strength_score != null ? Number(ctx.strength_score) : null,
    };
  },
};

// ── Statistics helpers ─────────────────────────────────────────────────────

function percentileRank(values: number[], userScore: number): number {
  if (!values.length || userScore == null) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  const below = sorted.filter(v => v < userScore).length;
  return Math.round((below / sorted.length) * 100);
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function statsFromArray(values: number[]): { mean: number; median: number; p25: number; p75: number } {
  if (!values.length) return { mean: 0, median: 0, p25: 0, p75: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  return {
    mean: Math.round(mean * 10) / 10,
    median: Math.round(quantile(sorted, 0.5) * 10) / 10,
    p25:    Math.round(quantile(sorted, 0.25) * 10) / 10,
    p75:    Math.round(quantile(sorted, 0.75) * 10) / 10,
  };
}

// ── Cohort WHERE clause builder ────────────────────────────────────────────

function buildCohortClause(
  cohort: CohortDefinition,
  context: Record<string, unknown>,
  tablePrefix: 'cs' | '' = '',
): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const col = (c: string) => tablePrefix ? `${tablePrefix}.${c}` : c;

  if (cohort.same_age_band && context.age_band) {
    params.push(context.age_band);
    conditions.push(`${col('age_band')} = $${params.length}`);
  }
  if (cohort.same_stage_code && context.stage_code) {
    params.push(context.stage_code);
    conditions.push(`${col('stage_code')} = $${params.length}`);
  }

  return { where: conditions.join(' AND '), params };
}

// ── Main compute function ──────────────────────────────────────────────────

export async function computeBenchmark(
  pool: Pool,
  configKey: string,
  userContext: Record<string, unknown>,
): Promise<BenchmarkResult[]> {
  // Fetch config
  const cfgRes = await pool.query(
    `SELECT * FROM rf_benchmark_configs WHERE config_key=$1 AND is_active=true`, [configKey],
  ).catch(() => ({ rows: [] as any[] }));

  if (!cfgRes.rows.length) return [];
  const config = cfgRes.rows[0];
  const metrics: string[] = config.metrics ?? [];
  const cohort: CohortDefinition = config.cohort_definition ?? {};
  const minK: number = config.min_cohort_size ?? 30;

  const { where, params } = buildCohortClause(cohort, userContext, '');
  const results: BenchmarkResult[] = [];

  for (const metric of metrics) {
    const resolver = METRIC_RESOLVERS[metric];
    if (!resolver) {
      results.push({
        metric, user_score: null, peer_mean: null, peer_median: null,
        p25: null, p75: null, percentile: null, cohort_size: 0,
        suppressed: true, min_cohort_size: minK,
        note: `No resolver for metric '${metric}'`,
      });
      continue;
    }

    try {
      const { values, userValue } = await resolver(pool, userContext, where, params);
      const finiteValues = values.filter(Number.isFinite);
      const cohortSize = finiteValues.length;

      if (cohortSize < minK) {
        results.push({
          metric, user_score: userValue, peer_mean: null, peer_median: null,
          p25: null, p75: null, percentile: null, cohort_size: cohortSize,
          suppressed: true, min_cohort_size: minK,
          note: `Cohort size ${cohortSize} below k=${minK} (k-anonymity enforced)`,
        });
        continue;
      }

      const stats = statsFromArray(finiteValues);
      const pctRank = userValue != null ? percentileRank(finiteValues, userValue) : null;

      results.push({
        metric,
        user_score: userValue,
        peer_mean:   stats.mean,
        peer_median: stats.median,
        p25: stats.p25,
        p75: stats.p75,
        percentile: pctRank,
        cohort_size: cohortSize,
        suppressed: false,
        min_cohort_size: minK,
      });
    } catch (err: any) {
      results.push({
        metric, user_score: null, peer_mean: null, peer_median: null,
        p25: null, p75: null, percentile: null, cohort_size: 0,
        suppressed: true, min_cohort_size: minK,
        note: `Query error: ${err.message ?? err}`,
      });
    }
  }

  return results;
}

// ── Direct endpoint for ad-hoc compute ────────────────────────────────────

export async function computeBenchmarkForReport(
  pool: Pool,
  benchmarkKey: string,
  reportDataSnapshot: Record<string, unknown>,
): Promise<BenchmarkResult[]> {
  return computeBenchmark(pool, benchmarkKey, reportDataSnapshot);
}
