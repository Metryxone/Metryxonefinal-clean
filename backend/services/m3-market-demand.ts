/**
 * Phase 3 — Market Demand Engine (v3.0.0)
 *
 * Market Demand = Hiring Frequency
 *               + Salary Velocity
 *               + Industry Growth
 *               + Future Skill Relevance
 *               − Automation Risk
 *
 * All terms 0..100 (clipped); composite clipped to 0..100.
 */
import type { Pool } from 'pg';
export const MARKET_DEMAND_VERSION = '3.0.0';

const W = { hiring: 0.30, salary: 0.20, industry: 0.20, future: 0.25, automation: 0.15 };
const clip = (x: number) => Math.max(0, Math.min(100, x));

export function computeDemand(c: {
  hiring_frequency: number; salary_velocity: number; industry_growth: number;
  future_relevance: number; automation_risk: number;
}): number {
  const m = W.hiring * c.hiring_frequency
          + W.salary * c.salary_velocity
          + W.industry * c.industry_growth
          + W.future * c.future_relevance
          - W.automation * c.automation_risk;
  return +clip(m).toFixed(2);
}

export function createMarketDemand(pool: Pool) {
  async function competencyDemand(competencyId?: string) {
    const { rows } = await pool.query(
      competencyId
        ? `SELECT * FROM m3_competency_market_scores WHERE ontology_competency_id = $1 ORDER BY computed_at DESC`
        : `SELECT * FROM m3_competency_market_scores ORDER BY market_demand DESC`,
      competencyId ? [competencyId] : []);
    return rows;
  }

  async function roleDemand() {
    return (await pool.query(`SELECT * FROM m3_role_market_scores ORDER BY market_score DESC`)).rows;
  }

  async function forecasts() {
    return (await pool.query(`SELECT * FROM m3_future_skill_forecasts ORDER BY forecast_score DESC`)).rows;
  }

  async function velocity() {
    return (await pool.query(`SELECT * FROM m3_market_velocity_scores ORDER BY velocity_score DESC`)).rows;
  }

  /** Recompute composite for a competency from inputs and persist. */
  async function recomputeCompetency(competencyId: string, inputs: Parameters<typeof computeDemand>[0]) {
    const demand = computeDemand(inputs);
    const id = `mcms_${competencyId.toLowerCase()}_${Date.now().toString(36)}`;
    await pool.query(
      `INSERT INTO m3_competency_market_scores(id, ontology_competency_id, hiring_frequency, salary_velocity,
        industry_growth, future_relevance, automation_risk, market_demand)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, competencyId, inputs.hiring_frequency, inputs.salary_velocity, inputs.industry_growth,
       inputs.future_relevance, inputs.automation_risk, demand]);
    return { id, ontology_competency_id: competencyId, ...inputs, market_demand: demand, formula_weights: W };
  }

  return { competencyDemand, roleDemand, forecasts, velocity, recomputeCompetency, computeDemand };
}
