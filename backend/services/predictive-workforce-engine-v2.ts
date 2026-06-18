/**
 * Predictive Workforce V2 — scenario / what-if simulation engine.
 * Pure-function core: takes a workforce baseline + scenario knobs and
 * projects headcount, attrition, skill-supply gaps, and risk envelopes.
 */
import type { Pool } from 'pg';

export const PREDICTIVE_WORKFORCE_V2_VERSION = '2.0.0';

export type WorkforceBaseline = {
  headcount: number;
  attritionAnnual: number;       // 0–1
  hiringPerQuarter: number;
  skillCoverage: number;         // 0–100 % current skill demand met
};

export type ScenarioKnobs = {
  attritionShockPct?: number;    // additive % (e.g. +0.05)
  hiringScalePct?: number;       // multiplicative (e.g. 1.25)
  upskillProgramLift?: number;   // additive coverage % (e.g. 8)
  horizonQuarters?: number;      // default 4
};

export type ScenarioOutcome = {
  horizon_quarters: number;
  projected_headcount: number;
  projected_skill_coverage: number;
  projected_gap_pct: number;
  cumulative_attritions: number;
  cumulative_hires: number;
  risk_band: 'low' | 'medium' | 'high' | 'critical';
  rationale: string;
};

export function simulateScenario(base: WorkforceBaseline, knobs: ScenarioKnobs): ScenarioOutcome {
  const h = Math.max(1, Math.min(20, knobs.horizonQuarters ?? 4));
  const attrAnnual = Math.max(0, Math.min(0.95, base.attritionAnnual + (knobs.attritionShockPct ?? 0)));
  const attrPerQ = attrAnnual / 4;
  const hiresPerQ = base.hiringPerQuarter * (knobs.hiringScalePct ?? 1);
  let hc = base.headcount;
  let cumAttr = 0, cumHire = 0;
  for (let q = 0; q < h; q++) {
    const lost = hc * attrPerQ;
    cumAttr += lost;
    cumHire += hiresPerQ;
    hc = Math.max(0, hc - lost + hiresPerQ);
  }
  const coverage = Math.max(0, Math.min(100, base.skillCoverage + (knobs.upskillProgramLift ?? 0)));
  const gap = +(100 - coverage).toFixed(2);
  const riskScore = gap * 0.6 + (attrAnnual * 100) * 0.4;
  const band: ScenarioOutcome['risk_band'] =
    riskScore < 20 ? 'low' : riskScore < 40 ? 'medium' : riskScore < 65 ? 'high' : 'critical';
  return {
    horizon_quarters: h,
    projected_headcount: Math.round(hc),
    projected_skill_coverage: +coverage.toFixed(2),
    projected_gap_pct: gap,
    cumulative_attritions: Math.round(cumAttr),
    cumulative_hires: Math.round(cumHire),
    risk_band: band,
    rationale: `Over ${h} quarters: attrition ${(attrAnnual * 100).toFixed(1)}%/yr, hiring ${hiresPerQ.toFixed(0)}/Q, coverage ${coverage.toFixed(0)}% → ${band}.`,
  };
}

export async function persistScenario(
  pool: Pool, tenantId: number | null, name: string, inputs: object, outcome: ScenarioOutcome, createdBy: number | null,
): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO wos_v2_scenarios (tenant_id, scenario_name, inputs, outcomes, created_by)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5) RETURNING id`,
    [tenantId, name, JSON.stringify(inputs), JSON.stringify(outcome), createdBy],
  );
  return r.rows[0].id;
}
