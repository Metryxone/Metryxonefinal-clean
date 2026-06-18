/**
 * Phase 5 — Enterprise Workforce Intelligence.
 *
 * Builds on Phase 4 workforce analytics + governance methodology registry.
 * Strategic rollups: leadership pipeline, succession readiness, capability heatmaps,
 * mobility intelligence, capability gap analytics, org maturity, strategic planning.
 *
 * Language policy: succession bands are DEVELOPMENTAL, not hiring/promotion predictions.
 */
import type { Pool } from 'pg';

export const ENTERPRISE_VERSION = '5.0.0';

const CACHE_TTL_MS = 120_000;
const cache = new Map<string, { at: number; value: unknown }>();
const cached = async <T>(k: string, get: () => Promise<T>): Promise<T> => {
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const v = await get();
  cache.set(k, { at: Date.now(), value: v });
  return v;
};

// ---- workforce intelligence rollups ----------------------------------------

export interface WorkforceIntelligenceMetric {
  id: string; dimension: string; metric: string;
  value: number; band: string | null;
  dimensions: Record<string, unknown>;
  period: string; computed_at: string;
}

export async function getWorkforceIntelligence(pool: Pool, tenantId = 'global'): Promise<WorkforceIntelligenceMetric[]> {
  return cached(`p5:wi:${tenantId}`, async () => {
    const { rows } = await pool.query<WorkforceIntelligenceMetric>(
      `SELECT id, dimension, metric, value::float AS value, band,
              dimensions, period::text, computed_at::text
         FROM p5_workforce_intelligence
        WHERE tenant_id = $1
        ORDER BY dimension, metric`, [tenantId]);
    return rows;
  });
}

// ---- succession readiness --------------------------------------------------

export interface SuccessionReadinessRow {
  user_id: string; target_role_id: string; target_role_title: string;
  readiness_band: 'developing' | 'progressing' | 'aligned' | 'developmentally_ready';
  readiness_score: number;
  contributing_strengths: { competency: string }[];
  development_gaps: { competency: string; gap: number }[];
  recommended_horizon_months: number | null;
  language_safe: boolean;
}

export async function getSuccessionReadiness(pool: Pool, params: { target_role_id?: string; user_id?: string }):
  Promise<SuccessionReadinessRow[]> {
  const { rows } = await pool.query<SuccessionReadinessRow>(
    `SELECT s.user_id, s.target_role_id, r.title AS target_role_title,
            s.readiness_band, s.readiness_score::float AS readiness_score,
            s.contributing_strengths, s.development_gaps,
            s.recommended_horizon_months, s.language_safe
       FROM p5_succession_models s
       JOIN onto_roles r ON r.id = s.target_role_id
      WHERE ($1::text IS NULL OR s.target_role_id = $1)
        AND ($2::text IS NULL OR s.user_id = $2)
      ORDER BY s.readiness_score DESC`,
    [params.target_role_id ?? null, params.user_id ?? null]);
  return rows;
}

// ---- organizational capabilities -------------------------------------------

export interface OrgCapabilityRow {
  layer_id: string; layer_name: string;
  competency_id: string; canonical_name: string;
  capability_index: number;
  maturity_distribution: Record<string, number>;
  gap_indicator: 'aligned' | 'development_opportunity' | 'strategic_gap';
}

export async function getOrganizationalCapabilities(pool: Pool, tenantId = 'global'): Promise<OrgCapabilityRow[]> {
  return cached(`p5:oc:${tenantId}`, async () => {
    const { rows } = await pool.query<OrgCapabilityRow>(
      `SELECT o.layer_id, l.name AS layer_name,
              o.competency_id, c.canonical_name,
              o.capability_index::float AS capability_index,
              o.maturity_distribution, o.gap_indicator
         FROM p5_organizational_capabilities o
         JOIN onto_layers l ON l.id = o.layer_id
         JOIN onto_competencies c ON c.id = o.competency_id
        WHERE o.tenant_id = $1
        ORDER BY l.display_order, c.canonical_name`, [tenantId]);
    return rows;
  });
}

// ---- enterprise overview ---------------------------------------------------

export interface EnterpriseOverview {
  snapshot_name: string;
  payload: Record<string, unknown>;
  freshness_days: number;
  computed_at: string;
}

export async function getEnterpriseOverview(pool: Pool, tenantId = 'global'):
  Promise<EnterpriseOverview | null> {
  return cached(`p5:eo:${tenantId}`, async () => {
    const { rows } = await pool.query<EnterpriseOverview>(
      `SELECT snapshot_name, payload, freshness_days, computed_at::text
         FROM p5_enterprise_analytics
        WHERE tenant_id = $1 AND snapshot_name = 'enterprise_overview'
        ORDER BY computed_at DESC LIMIT 1`, [tenantId]);
    return rows[0] ?? null;
  });
}

// ---- strategic workforce planning ------------------------------------------

export interface StrategicCapabilityGap {
  competency_id: string; canonical_name: string;
  enterprise_index: number;
  strategic_band_pct: number;
  gap_indicator: 'aligned' | 'development_opportunity' | 'strategic_gap';
  affected_layers: string[];
}

export async function getStrategicCapabilityGaps(pool: Pool, tenantId = 'global'): Promise<StrategicCapabilityGap[]> {
  const caps = await getOrganizationalCapabilities(pool, tenantId);
  const byComp = new Map<string, { sum: number; count: number; strategic: number; layers: Set<string>; gap: string; name: string }>();
  for (const c of caps) {
    const cur = byComp.get(c.competency_id) ?? { sum: 0, count: 0, strategic: 0, layers: new Set(), gap: c.gap_indicator, name: c.canonical_name };
    cur.sum += c.capability_index; cur.count += 1;
    cur.layers.add(c.layer_name);
    const lvl5 = c.maturity_distribution.level_5 ?? 0;
    const lvl4 = c.maturity_distribution.level_4 ?? 0;
    cur.strategic += lvl5 + lvl4;
    if (c.gap_indicator === 'strategic_gap') cur.gap = 'strategic_gap';
    byComp.set(c.competency_id, cur);
  }
  const out: StrategicCapabilityGap[] = [];
  for (const [competency_id, v] of byComp) {
    const enterprise_index = v.count ? v.sum / v.count : 0;
    out.push({
      competency_id, canonical_name: v.name,
      enterprise_index: Math.round(enterprise_index * 10) / 10,
      strategic_band_pct: Math.round((v.strategic / v.count) * 10) / 10,
      gap_indicator: v.gap as StrategicCapabilityGap['gap_indicator'],
      affected_layers: [...v.layers],
    });
  }
  return out.sort((a, b) => a.enterprise_index - b.enterprise_index);
}
