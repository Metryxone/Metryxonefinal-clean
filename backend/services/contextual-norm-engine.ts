/**
 * Contextual Norm Engine (Phase 3 V2).
 *
 * Multi-dimensional normative tables: role × layer × industry × geography ×
 * org maturity × team scale × seniority × experience. Produces percentile
 * distributions + readiness thresholds + contextual medians + confidence
 * intervals on demand. Reads existing benchmark data (`bench_*`) when
 * available, otherwise falls back to canonical defaults.
 */
import type { Pool } from 'pg';

export const CONTEXTUAL_NORM_VERSION = '3.0.0';

export type NormContext = {
  role_id?: string | null;
  layer?: string | null;
  industry?: string | null;
  geography?: string | null;
  org_maturity?: string | null;
  team_scale?: string | null;
  seniority_band?: string | null;
  experience_band?: string | null;
};

export type PercentileDistribution = {
  competency_code: string;
  sample_size: number;
  p10: number; p25: number; p50: number; p75: number; p90: number;
  mean: number; std: number;
  confidence_interval: { lower: number; upper: number; width: number };
  source: 'cohort' | 'fallback';
};

const CANONICAL_DEFAULTS: Record<string, PercentileDistribution> = canonicalSeed();

function canonicalSeed(): Record<string, PercentileDistribution> {
  const codes = ['COG','COM','LEA','EXE','ADP','TEC','EIQ'];
  const out: Record<string, PercentileDistribution> = {};
  for (const c of codes) {
    out[c] = {
      competency_code: c,
      sample_size: 0,
      p10: 38, p25: 50, p50: 62, p75: 74, p90: 84,
      mean: 62, std: 14,
      confidence_interval: { lower: 60, upper: 64, width: 4 },
      source: 'fallback',
    };
  }
  return out;
}

export function contextKey(ctx: NormContext): string {
  return [ctx.role_id ?? '*', ctx.layer ?? '*', ctx.industry ?? '*',
          ctx.geography ?? '*', ctx.org_maturity ?? '*', ctx.team_scale ?? '*',
          ctx.seniority_band ?? '*', ctx.experience_band ?? '*'].join(':');
}

export async function upsertNormContext(pool: Pool, ctx: NormContext): Promise<string> {
  const key = contextKey(ctx);
  const r = await pool.query<{ id: string }>(
    `INSERT INTO competency_norm_contexts
       (context_key, role_id, layer, industry, geography, org_maturity, team_scale, seniority_band, experience_band)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (context_key) DO UPDATE SET metadata = competency_norm_contexts.metadata
     RETURNING id`,
    [key, ctx.role_id ?? null, ctx.layer ?? null, ctx.industry ?? null,
     ctx.geography ?? null, ctx.org_maturity ?? null, ctx.team_scale ?? null,
     ctx.seniority_band ?? null, ctx.experience_band ?? null],
  );
  return r.rows[0].id;
}

export async function getDistribution(
  pool: Pool,
  ctxId: string,
  competencyCode: string,
): Promise<PercentileDistribution> {
  const r = await pool.query<{
    sample_size: number; p10: string; p25: string; p50: string; p75: string; p90: string;
    mean_value: string; std_value: string; confidence_interval: { lower?: number; upper?: number };
  }>(
    `SELECT d.sample_size, d.p10, d.p25, d.p50, d.p75, d.p90, d.mean_value, d.std_value, d.confidence_interval
     FROM competency_percentile_distributions_v2 d
     JOIN contextual_benchmark_cohorts c ON c.id = d.cohort_id
     WHERE c.context_id = $1::uuid AND d.competency_code = $2
     ORDER BY d.computed_at DESC LIMIT 1`,
    [ctxId, competencyCode],
  );
  if (r.rowCount === 0 || (r.rows[0].sample_size ?? 0) < 30) {
    return CANONICAL_DEFAULTS[competencyCode] ?? CANONICAL_DEFAULTS['COG'];
  }
  const x = r.rows[0];
  return {
    competency_code: competencyCode,
    sample_size: x.sample_size,
    p10: +x.p10, p25: +x.p25, p50: +x.p50, p75: +x.p75, p90: +x.p90,
    mean: +x.mean_value, std: +x.std_value,
    confidence_interval: {
      lower: Number(x.confidence_interval?.lower ?? +x.mean_value - 2),
      upper: Number(x.confidence_interval?.upper ?? +x.mean_value + 2),
      width: Number(x.confidence_interval?.upper ?? 0) - Number(x.confidence_interval?.lower ?? 0),
    },
    source: 'cohort',
  };
}

export function rankPercentile(value: number, dist: PercentileDistribution): number {
  // simple piecewise interpolation across the 5 anchor percentiles
  const anchors: Array<[number, number]> = [
    [dist.p10, 10], [dist.p25, 25], [dist.p50, 50], [dist.p75, 75], [dist.p90, 90],
  ];
  if (value <= anchors[0][0]) return Math.max(1, Math.round((value / anchors[0][0]) * 10));
  if (value >= anchors[4][0]) return Math.min(99, 90 + Math.round((value - anchors[4][0]) / (100 - anchors[4][0]) * 9));
  for (let i = 0; i < anchors.length - 1; i++) {
    const [v1, p1] = anchors[i];
    const [v2, p2] = anchors[i + 1];
    if (value >= v1 && value <= v2) {
      const t = (value - v1) / Math.max(0.0001, v2 - v1);
      return Math.round(p1 + t * (p2 - p1));
    }
  }
  return 50;
}
