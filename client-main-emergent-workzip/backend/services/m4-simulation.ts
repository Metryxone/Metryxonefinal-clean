/**
 * Phase 4 — Workforce Simulation Engine (v4.0.0)
 *
 * What-if simulations on top of m4_capability_trajectories.
 *
 *   uplift:     apply delta_pct or delta_pts to a target competency, recompute readiness
 *   promotion:  pull required levels from m4_future_capability_gaps, project gap closure
 *   pipeline:   roll up future readiness across a cohort
 *   intervention: same as uplift but with cost/time annotations
 *
 * Pure additive — never mutates trajectories table; results persisted to m4_simulation_results.
 */
import type { Pool } from 'pg';
import { forecastFutureCapability } from './m4-predictive';

export const SIMULATION_VERSION = '4.0.0';

const newId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const clip = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

export function createSimulation(pool: Pool) {
  async function scenarios() {
    const { rows } = await pool.query(
      `SELECT s.*, COALESCE(json_agg(json_build_object('competency_id', m.competency_id, 'delta', m.delta, 'weight', m.weight)
                                     ORDER BY m.competency_id) FILTER (WHERE m.id IS NOT NULL), '[]') AS capability_model
       FROM m4_simulation_scenarios s
       LEFT JOIN m4_simulation_capability_models m ON m.scenario_id = s.id
       GROUP BY s.id ORDER BY s.scenario_code`);
    return rows;
  }

  async function getScenario(idOrCode: string) {
    const { rows } = await pool.query(
      `SELECT * FROM m4_simulation_scenarios WHERE id = $1 OR scenario_code = $1 LIMIT 1`, [idOrCode]);
    if (!rows[0]) return null;
    const mods = await pool.query(`SELECT * FROM m4_simulation_capability_models WHERE scenario_id = $1`, [rows[0].id]);
    return { ...rows[0], capability_model: mods.rows };
  }

  /**
   * Run a scenario against a subject's current trajectories. Returns baseline_readiness,
   * projected_readiness, delta, and per-competency projection band.
   */
  async function runScenario(scenarioIdOrCode: string, subjectId: string, horizonMonths = 12) {
    const scenario = await getScenario(scenarioIdOrCode);
    if (!scenario) throw new Error('scenario_not_found');
    const trajR = await pool.query(
      `SELECT * FROM m4_capability_trajectories WHERE subject_id = $1 ORDER BY competency_id`, [subjectId]);
    const traj = trajR.rows;
    if (!traj.length) throw new Error('no_trajectories_for_subject');

    const baseline_readiness = +(traj.reduce((s: number, r: any) => s + +r.current, 0) / traj.length).toFixed(2);

    const upliftMap = new Map<string, number>();
    for (const m of (scenario.capability_model ?? [])) upliftMap.set(m.competency_id, +m.delta);

    const projected: any[] = [];
    let projectedSum = 0; let n = 0;
    for (const r of traj) {
      const upliftDelta = upliftMap.get(r.competency_id) ?? 0;
      const adjustedCurrent = clip(+r.current + upliftDelta);
      const f = forecastFutureCapability({
        current: adjustedCurrent,
        learning_velocity: +r.velocity,
        experience_momentum: 0.15,
        market_exposure: 0.30,
        capability_decay: 0.05,
        horizon_months: horizonMonths,
        consistency: 0.72,
      });
      projected.push({ competency_id: r.competency_id, baseline: +r.current, after_uplift: adjustedCurrent, ...f });
      projectedSum += f.projection; n += 1;
    }
    const projected_readiness = +(projectedSum / Math.max(1, n)).toFixed(2);
    const delta = +(projected_readiness - baseline_readiness).toFixed(2);

    const id = newId('m4sr');
    await pool.query(
      `INSERT INTO m4_simulation_results(id, scenario_id, subject_id, baseline_readiness, projected_readiness, delta, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, scenario.id, subjectId, baseline_readiness, projected_readiness, delta,
       JSON.stringify({ horizon_months: horizonMonths, per_competency: projected })]);

    return {
      id, scenario_id: scenario.id, scenario_code: scenario.scenario_code,
      subject_id: subjectId, horizon_months: horizonMonths,
      baseline_readiness, projected_readiness, delta,
      per_competency: projected,
      rationale: `Uplift of ${[...upliftMap.entries()].map(([k, v]) => `${k}+${v}`).join(', ') || 'baseline'} projects readiness change of ${delta >= 0 ? '+' : ''}${delta} pts over ${horizonMonths} months — capability alignment indicator, not a hiring or promotion prediction.`,
    };
  }

  async function results(scenarioId?: string, subjectId?: string) {
    const parts: string[] = []; const params: any[] = [];
    if (scenarioId) { params.push(scenarioId); parts.push(`scenario_id = $${params.length}`); }
    if (subjectId)  { params.push(subjectId);  parts.push(`subject_id = $${params.length}`); }
    const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
    return (await pool.query(`SELECT * FROM m4_simulation_results ${where} ORDER BY computed_at DESC LIMIT 50`, params)).rows;
  }

  return { scenarios, getScenario, runScenario, results };
}
