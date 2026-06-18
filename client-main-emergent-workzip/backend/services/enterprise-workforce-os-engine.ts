/**
 * Enterprise Workforce OS Engine — organisational capability mapping,
 * tenant capability profiles, succession intelligence, capability risk.
 */
import type { Pool } from 'pg';
export const ENTERPRISE_WOS_VERSION = '8.0.0';

const CANON = ['COG','COM','LEA','EXE','ADP','TEC','EIQ'] as const;

export type TenantCapabilityProfile = {
  tenant_id: string;
  competency_key: string;
  mean_level: number;
  median_level: number;
  p25: number;
  p75: number;
  population_size: number;
};

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

/** Build tenant capability profiles from a flat list of per-user levels. */
export function buildTenantCapabilityProfiles(tenantId: string, levels: Array<{ competency_key: string; level: number }>): TenantCapabilityProfile[] {
  const byComp: Record<string, number[]> = {};
  for (const x of levels) (byComp[x.competency_key] ??= []).push(x.level);
  return Object.entries(byComp).map(([k, arr]) => {
    const sorted = arr.slice().sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    return {
      tenant_id: tenantId, competency_key: k,
      mean_level: Math.round(mean * 100) / 100,
      median_level: percentile(sorted, 50),
      p25: percentile(sorted, 25),
      p75: percentile(sorted, 75),
      population_size: sorted.length,
    };
  });
}

export type CapabilityRiskRow = { competency: string; mean: number; coverage: number; risk_band: 'low' | 'moderate' | 'high'; reason: string };
export function assessCapabilityRisk(profiles: TenantCapabilityProfile[], targetMean = 60, minCoverage = 0.6, populationTotal = 100): CapabilityRiskRow[] {
  return CANON.map((k) => {
    const p = profiles.find((x) => x.competency_key === k);
    const mean = p?.mean_level ?? 0;
    const coverage = p ? p.population_size / Math.max(1, populationTotal) : 0;
    const meanGap = targetMean - mean;
    const coverageGap = minCoverage - coverage;
    const band: CapabilityRiskRow['risk_band'] =
      meanGap > 15 || coverageGap > 0.25 ? 'high' :
      meanGap > 5 || coverageGap > 0.1 ? 'moderate' : 'low';
    const reason = band === 'high' ? `mean ${mean} vs target ${targetMean}; coverage ${(coverage * 100).toFixed(0)}%` : band === 'moderate' ? 'within tolerance but below comfort' : 'healthy';
    return { competency: k, mean, coverage: Math.round(coverage * 100) / 100, risk_band: band, reason };
  });
}

export function buildEnterpriseCapabilityGraph(tenantId: string, profiles: TenantCapabilityProfile[]) {
  const nodes = profiles.map((p) => ({
    id: `cap:${p.competency_key}`, type: 'capability' as const,
    label: p.competency_key, value: p.mean_level, meta: { p25: p.p25, p75: p.p75, n: p.population_size },
  }));
  // Edges: connect each capability to all others with weight = inverse of distance
  const edges: Array<{ from: string; to: string; relation: string; weight: number }> = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i].value ?? 0; const b = nodes[j].value ?? 0;
    const dist = Math.abs(a - b);
    edges.push({ from: nodes[i].id, to: nodes[j].id, relation: 'co_capability', weight: Math.round((1 / (1 + dist)) * 1000) / 1000 });
  }
  return { tenant_id: tenantId, graph: { nodes, edges }, node_count: nodes.length, edge_count: edges.length };
}

export function organizationalReadiness(profiles: TenantCapabilityProfile[]): { readiness_score: number; drivers: Array<{ k: string; contribution: number }>; bottlenecks: string[] } {
  if (!profiles.length) return { readiness_score: 0, drivers: [], bottlenecks: ['no_data'] };
  const drivers = profiles.map((p) => ({ k: p.competency_key, contribution: Math.round((p.mean_level / 100) * (1 / profiles.length) * 1000) / 1000 }));
  const score = Math.round(profiles.reduce((s, p) => s + p.mean_level, 0) / profiles.length);
  const bottlenecks = profiles.filter((p) => p.mean_level < 50).map((p) => p.competency_key);
  return { readiness_score: score, drivers: drivers.sort((a, b) => b.contribution - a.contribution), bottlenecks };
}

// ── persistence ──────────────────────────────────────────────────────────
export async function persistTenantProfiles(pool: Pool, profiles: TenantCapabilityProfile[]) {
  for (const p of profiles) {
    try {
      await pool.query(
        `INSERT INTO tenant_capability_profiles (tenant_id, competency_key, mean_level, median_level, p25, p75, population_size)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [p.tenant_id, p.competency_key, p.mean_level, p.median_level, p.p25, p.p75, p.population_size],
      );
    } catch (e) { console.warn('[wos] tenant profile persist failed:', (e as Error).message); }
  }
}

export async function persistEnterpriseGraph(pool: Pool, g: ReturnType<typeof buildEnterpriseCapabilityGraph>) {
  try {
    await pool.query(
      `INSERT INTO enterprise_capability_graphs (tenant_id, graph, node_count, edge_count) VALUES ($1,$2::jsonb,$3,$4)`,
      [g.tenant_id, JSON.stringify(g.graph), g.node_count, g.edge_count],
    );
  } catch (e) { console.warn('[wos] graph persist failed:', (e as Error).message); }
}

export async function persistOrgReadiness(pool: Pool, tenantId: string, r: ReturnType<typeof organizationalReadiness>) {
  try {
    await pool.query(
      `INSERT INTO organizational_readiness_models (tenant_id, readiness_score, drivers, bottlenecks)
       VALUES ($1,$2,$3::jsonb,$4::jsonb)`,
      [tenantId, r.readiness_score, JSON.stringify(r.drivers), JSON.stringify(r.bottlenecks)],
    );
  } catch (e) { console.warn('[wos] org readiness persist failed:', (e as Error).message); }
}
