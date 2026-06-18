import type { Pool } from 'pg';

export const WORKFORCE_SIMULATION_VERSION = '5.0.0';

const newId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36).slice(-4)}`;
const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

type ScenarioInputs = {
  competencies?: string[];
  uplift_pct?: number;
  investment?: number;
  focus?: string[];
  layer?: string;
};

export function createWorkforceSimulation(pool: Pool) {
  async function scenarios(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_organizational_simulations WHERE org_id=$1 ORDER BY created_at DESC`, [orgId]);
    return r.rows;
  }

  async function runScenario(orgId: string, scenarioCode: string, horizonMonths = 12) {
    // Load current capability baselines.
    const caps = await pool.query(
      `SELECT * FROM m5_organizational_capabilities WHERE org_id=$1`, [orgId]);
    const existing = await pool.query(
      `SELECT * FROM m5_organizational_simulations WHERE org_id=$1 AND scenario_code=$2 LIMIT 1`,
      [orgId, scenarioCode]);
    const inputs: ScenarioInputs = existing.rows[0]?.inputs ?? { uplift_pct: 10 };
    const targetSet = new Set(inputs.competencies ?? inputs.focus ?? caps.rows.map((c: any) => c.competency_id));
    const upliftPct = +(inputs.uplift_pct ?? 10);

    const uplifts: any[] = [];
    for (const cap of caps.rows) {
      const baseline = +cap.current_level;
      const delta = targetSet.has(cap.competency_id) ? baseline * upliftPct / 100 : baseline * 0.02;
      const projected = +clip(baseline + delta, 0, 100).toFixed(2);
      const halfWidth = +clip(delta * 0.20, 1, 8).toFixed(2);
      uplifts.push({
        competency_id: cap.competency_id,
        baseline,
        uplift_pct: +(targetSet.has(cap.competency_id) ? upliftPct : 2).toFixed(2),
        projected,
        band_low: +clip(projected - halfWidth, 0, 100).toFixed(2),
        band_high: +clip(projected + halfWidth, 0, 100).toFixed(2),
      });
    }

    const baselineAvg = uplifts.reduce((s, x) => s + x.baseline, 0) / Math.max(1, uplifts.length);
    const projectedAvg = uplifts.reduce((s, x) => s + x.projected, 0) / Math.max(1, uplifts.length);
    const compositeDelta = +(projectedAvg - baselineAvg).toFixed(2);

    // Derived organizational outcomes
    const leadershipLift = compositeDelta * 1.2;
    const resilienceLift = compositeDelta * 0.65;
    const successionLift = compositeDelta * 0.85;

    // Learning ROI (if investment supplied)
    let learning_impact = null as any;
    if (inputs.investment && inputs.investment > 0) {
      const capabilityLift = compositeDelta;
      const expectedRoi = +clip((capabilityLift / 10) * 0.8, 0.3, 5).toFixed(3);
      const paybackMonths = Math.max(6, Math.round(24 / Math.max(0.5, expectedRoi)));
      learning_impact = {
        investment: inputs.investment,
        expected_roi: expectedRoi,
        capability_lift: +capabilityLift.toFixed(2),
        payback_months: paybackMonths,
      };
    }

    // Leadership pipeline projection (simple multiplier)
    const pipeline = ['executive', 'senior_management', 'middle_management'].map(layer => ({
      layer,
      baseline_ready: layer === 'executive' ? 1 : layer === 'senior_management' ? 4 : 9,
      projected_ready: Math.round((layer === 'executive' ? 1 : layer === 'senior_management' ? 4 : 9) * (1 + leadershipLift / 100)),
      improvement_pct: +leadershipLift.toFixed(2),
    }));

    return {
      org_id: orgId,
      scenario_code: scenarioCode,
      horizon_months: horizonMonths,
      baseline_avg: +baselineAvg.toFixed(2),
      projected_avg: +projectedAvg.toFixed(2),
      composite_delta: compositeDelta,
      derived: {
        leadership_capability_lift_pct: +leadershipLift.toFixed(2),
        succession_readiness_lift_pct: +successionLift.toFixed(2),
        organizational_resilience_lift_pct: +resilienceLift.toFixed(2),
      },
      capability_uplifts: uplifts,
      learning_impact,
      leadership_pipeline: pipeline,
      assumptions: {
        targeted_competencies: Array.from(targetSet),
        non_targeted_drift_pct: 2,
        band_half_width_factor: 0.20,
      },
    };
  }

  async function futureForecast(orgId: string, horizonMonths = 18) {
    const caps = await pool.query(
      `SELECT AVG(current_level)::numeric AS avg, COUNT(*)::int AS n FROM m5_organizational_capabilities WHERE org_id=$1`,
      [orgId]);
    const avg = +(caps.rows[0]?.avg ?? 60);
    const driftPct = 0.04 * (horizonMonths / 12);
    const projected = +clip(avg * (1 + driftPct), 0, 100).toFixed(2);
    const half = +clip(avg * 0.12, 3, 15).toFixed(2);
    return {
      org_id: orgId,
      horizon_months: horizonMonths,
      projected_capability: projected,
      projected_leadership: +clip(projected * 0.92, 0, 100).toFixed(2),
      projected_resilience: +clip(projected * 0.88, 0, 100).toFixed(2),
      band_low: +clip(projected - half, 0, 100).toFixed(2),
      band_high: +clip(projected + half, 0, 100).toFixed(2),
    };
  }

  async function transformationScenarios(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_workforce_transformation_scenarios WHERE org_id=$1`, [orgId]);
    return r.rows;
  }

  return { scenarios, runScenario, futureForecast, transformationScenarios };
}
