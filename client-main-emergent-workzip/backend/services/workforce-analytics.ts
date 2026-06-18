/**
 * Phase 4 — Workforce Analytics Engine.
 * Reads p4_organizational_heatmaps, p4_workforce_analytics, p4_benchmark_trends.
 * Org-level rollups: capability heatmaps, distribution analysis, mobility & maturity indicators.
 */
import type { Pool } from 'pg';

export const WORKFORCE_ANALYTICS_VERSION = '4.0.0';

const CACHE_TTL_MS = 90_000;
const cache = new Map<string, { at: number; value: unknown }>();
const cached = async <T>(k: string, get: () => Promise<T>): Promise<T> => {
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const v = await get();
  cache.set(k, { at: Date.now(), value: v });
  return v;
};

export interface HeatmapCell {
  layer_id: string; layer_name: string;
  competency_id: string; canonical_name: string;
  mean_score: number; sample_size: number;
  maturity_distribution: Record<string, number>;
  intensity: number;
  capability_band: 'foundational' | 'developing' | 'aligned' | 'strategic';
}

function bandForScore(s: number): HeatmapCell['capability_band'] {
  if (s >= 75) return 'strategic';
  if (s >= 60) return 'aligned';
  if (s >= 45) return 'developing';
  return 'foundational';
}

export async function getOrganizationalHeatmap(pool: Pool, tenantId = 'global'): Promise<HeatmapCell[]> {
  return cached(`p4:heat:${tenantId}`, async () => {
    const { rows } = await pool.query(`
      SELECT h.layer_id, l.name AS layer_name,
             h.competency_id, c.canonical_name,
             h.mean_score::float AS mean_score,
             h.sample_size, h.maturity_distribution, h.intensity::float AS intensity
        FROM p4_organizational_heatmaps h
        JOIN onto_layers l ON l.id = h.layer_id
        JOIN onto_competencies c ON c.id = h.competency_id
       WHERE h.tenant_id = $1
       ORDER BY l.display_order, c.canonical_name
    `, [tenantId]);
    return rows.map((r: any) => ({
      ...r, capability_band: bandForScore(r.mean_score),
    })) as HeatmapCell[];
  });
}

export interface WorkforceMetric {
  metric_name: string; metric_value: number;
  dimensions: Record<string, unknown>;
  period_start: string; period_end: string;
  sample_size: number;
  band: string;
  trend_30d: number | null;
}

function metricBand(name: string, value: number): string {
  if (name.endsWith('_pct') || name.endsWith('_index') || name.endsWith('_readiness') || name.endsWith('_density')) {
    if (value >= 70) return 'aligned';
    if (value >= 50) return 'progressing';
    if (value >= 35) return 'developing';
    return 'foundational';
  }
  return 'n/a';
}

export async function getWorkforceMetrics(pool: Pool, tenantId = 'global'): Promise<WorkforceMetric[]> {
  return cached(`p4:wm:${tenantId}`, async () => {
    const { rows } = await pool.query(`
      SELECT metric_name, metric_value::float AS metric_value, dimensions,
             period_start, period_end, sample_size
        FROM p4_workforce_analytics
       WHERE tenant_id = $1
       ORDER BY metric_name
    `, [tenantId]);
    return rows.map((r: any) => ({
      ...r,
      band: metricBand(r.metric_name, r.metric_value),
      trend_30d: null,
    })) as WorkforceMetric[];
  });
}

/**
 * Capability distribution: aggregates by competency across the org.
 */
export interface CapabilityDistribution {
  competency_id: string; canonical_name: string;
  layers: number;                       // distinct layers contributing
  weighted_mean: number;                // sample-size weighted mean
  spread: number;                       // max - min across layers
  total_sample: number;
}
export async function getCapabilityDistribution(pool: Pool, tenantId = 'global'): Promise<CapabilityDistribution[]> {
  return cached(`p4:cdist:${tenantId}`, async () => {
    const { rows } = await pool.query(`
      SELECT competency_id,
             (SELECT canonical_name FROM onto_competencies WHERE id = h.competency_id) AS canonical_name,
             COUNT(DISTINCT layer_id) AS layers,
             SUM(mean_score * sample_size)::float / NULLIF(SUM(sample_size), 0) AS weighted_mean,
             (MAX(mean_score) - MIN(mean_score))::float AS spread,
             SUM(sample_size)::int AS total_sample
        FROM p4_organizational_heatmaps h
       WHERE tenant_id = $1
       GROUP BY competency_id
       ORDER BY weighted_mean DESC
    `, [tenantId]);
    return rows.map((r: any) => ({
      competency_id: r.competency_id,
      canonical_name: r.canonical_name,
      layers: Number(r.layers),
      weighted_mean: Math.round((r.weighted_mean ?? 0) * 100) / 100,
      spread: Math.round((r.spread ?? 0) * 100) / 100,
      total_sample: Number(r.total_sample),
    })) as CapabilityDistribution[];
  });
}

/**
 * Leadership pipeline indicator — strategic-band density at upper layers.
 */
export interface LeadershipPipeline {
  layer_id: string; layer_name: string;
  strategic_density: number; aligned_density: number;
  developmental_density: number;
  sample_size: number;
}
export async function getLeadershipPipeline(pool: Pool, tenantId = 'global'): Promise<LeadershipPipeline[]> {
  return cached(`p4:lp:${tenantId}`, async () => {
    const cells = await getOrganizationalHeatmap(pool, tenantId);
    const byLayer = new Map<string, HeatmapCell[]>();
    for (const c of cells) {
      const arr = byLayer.get(c.layer_id) ?? [];
      arr.push(c); byLayer.set(c.layer_id, arr);
    }
    const out: LeadershipPipeline[] = [];
    for (const [layer_id, arr] of byLayer) {
      const total = arr.length || 1;
      const strategic = arr.filter(c => c.capability_band === 'strategic').length / total * 100;
      const aligned = arr.filter(c => c.capability_band === 'aligned').length / total * 100;
      const developmental = arr.filter(c => c.capability_band === 'developing' || c.capability_band === 'foundational').length / total * 100;
      out.push({
        layer_id, layer_name: arr[0].layer_name,
        strategic_density: Math.round(strategic * 10) / 10,
        aligned_density: Math.round(aligned * 10) / 10,
        developmental_density: Math.round(developmental * 10) / 10,
        sample_size: arr.reduce((s, c) => s + c.sample_size, 0),
      });
    }
    return out.sort((a, b) => b.strategic_density - a.strategic_density);
  });
}

/**
 * Benchmark trends — last N months per competency for a cohort.
 */
export interface BenchmarkTrendPoint {
  period: string; mean_score: number; median_score: number;
  p25: number; p75: number; p90: number; sample_size: number;
  delta_vs_prior: number | null;
}
export async function getBenchmarkTrends(pool: Pool, params: {
  cohort_id: string; competency_id: string; months?: number;
}): Promise<BenchmarkTrendPoint[]> {
  const months = params.months ?? 6;
  const { rows } = await pool.query(`
    SELECT period::text, mean_score::float, median_score::float,
           p25::float, p75::float, p90::float, sample_size,
           delta_vs_prior::float
      FROM p4_benchmark_trends
     WHERE cohort_id = $1 AND competency_id = $2
     ORDER BY period DESC
     LIMIT $3
  `, [params.cohort_id, params.competency_id, months]);
  return rows.reverse() as BenchmarkTrendPoint[];
}
