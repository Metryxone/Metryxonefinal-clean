/**
 * Executive Workforce Intelligence — generates executive-grade summaries:
 * readiness, capability heatmaps, resilience, workforce risk.
 */
import type { Pool } from 'pg';
import type { TenantCapabilityProfile } from './enterprise-workforce-os-engine';
import { organizationalReadiness, assessCapabilityRisk } from './enterprise-workforce-os-engine';
import { projectWorkforceResilience } from './workforce-simulation-v2';
export const EXEC_INTEL_VERSION = '8.0.0';

const CANON = ['COG','COM','LEA','EXE','ADP','TEC','EIQ'] as const;

export type ExecutiveBrief = {
  tenant_id: string;
  org_readiness: ReturnType<typeof organizationalReadiness>;
  capability_risk: ReturnType<typeof assessCapabilityRisk>;
  resilience: ReturnType<typeof projectWorkforceResilience>;
  heatmap: Array<{ competency: string; mean: number; band: 'cold' | 'warm' | 'hot' }>;
  succession_signals: Array<{ competency: string; succession_strength: number }>;
  workforce_risk_index: number;
};

export function generateExecutiveBrief(tenantId: string, profiles: TenantCapabilityProfile[], populationTotal = 100): ExecutiveBrief {
  const readiness = organizationalReadiness(profiles);
  const risk = assessCapabilityRisk(profiles, 60, 0.6, populationTotal);

  // Heatmap from mean levels
  const heatmap = profiles.map((p) => ({
    competency: p.competency_key,
    mean: p.mean_level,
    band: (p.mean_level >= 70 ? 'hot' : p.mean_level >= 50 ? 'warm' : 'cold') as 'cold' | 'warm' | 'hot',
  }));

  // Distribution for resilience (mock {mean,size} from profiles)
  const dist: Record<string, { mean: number; size: number }> = {};
  for (const p of profiles) dist[p.competency_key] = { mean: p.mean_level, size: p.population_size };
  const resilience = projectWorkforceResilience(dist as Parameters<typeof projectWorkforceResilience>[0]);

  const succession = CANON.map((k) => {
    const p = profiles.find((x) => x.competency_key === k);
    const p75 = p?.p75 ?? 0;          // strength of the top quartile
    const size = p?.population_size ?? 0;
    const strength = Math.round((p75 / 100) * Math.min(1, size / 30) * 100);
    return { competency: k, succession_strength: strength };
  });

  // Workforce risk index = % of competencies in high risk
  const highCount = risk.filter((r) => r.risk_band === 'high').length;
  const workforceRiskIndex = Math.round((highCount / Math.max(1, risk.length)) * 100);

  return {
    tenant_id: tenantId, org_readiness: readiness, capability_risk: risk,
    resilience, heatmap, succession_signals: succession, workforce_risk_index: workforceRiskIndex,
  };
}

export async function persistExecutiveDecision(pool: Pool, args: {
  tenantId: string; decisionKey: string; options: unknown; recommended?: unknown; scores?: unknown; rationale?: string;
}) {
  try {
    await pool.query(
      `INSERT INTO executive_decision_models (tenant_id, decision_key, options, recommended, scores, rationale)
       VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6)`,
      [args.tenantId, args.decisionKey, JSON.stringify(args.options ?? []), JSON.stringify(args.recommended ?? null), JSON.stringify(args.scores ?? null), args.rationale ?? null],
    );
  } catch (e) { console.warn('[exec] persist failed:', (e as Error).message); }
}
