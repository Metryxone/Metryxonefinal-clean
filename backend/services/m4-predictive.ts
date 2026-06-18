/**
 * Phase 4 — Predictive Intelligence Engine (v4.0.0)
 *
 * Future Capability = Current
 *                    + Learning Velocity × horizon_months
 *                    + Experience Momentum × horizon_months
 *                    + Market Exposure × horizon_months × 0.25
 *                    − Capability Decay × horizon_months
 *
 * Trajectory classification heuristic (per m4_trajectory_classifications):
 *   acceleration > +0.5       → accelerating
 *   velocity < 0              → declining
 *   |velocity| ≤ 0.05 (≥3mo)  → plateauing
 *   composite leadership ↑    → high_potential / leadership_emerging
 *   else                      → stable
 *
 * Confidence widens forecast band proportional to (1 − consistency).
 */
import type { Pool } from 'pg';

export const PREDICTIVE_VERSION = '4.0.0';
export const TRAJECTORY_VERSION = '4.0.0';
export const READINESS_VERSION = '4.0.0';
export const BURNOUT_VERSION = '4.0.0';
export const CAPABILITY_FORECAST_VERSION = '4.0.0';

const newId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const clip = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

export type TrajectoryCode = 'accelerating' | 'stable' | 'plateauing' | 'declining' | 'high_potential' | 'leadership_emerging';

export function classifyTrajectory(input: {
  velocity: number; acceleration: number; competency_id?: string;
  leadership_composite_velocity?: number;
}): TrajectoryCode {
  const { velocity, acceleration, leadership_composite_velocity = 0 } = input;
  if (leadership_composite_velocity > 1.5) return 'leadership_emerging';
  if (leadership_composite_velocity > 1.0 && acceleration > 0) return 'high_potential';
  if (acceleration > 0.5) return 'accelerating';
  if (velocity < -0.05) return 'declining';
  if (Math.abs(velocity) <= 0.05) return 'plateauing';
  return 'stable';
}

export function forecastFutureCapability(args: {
  current: number; learning_velocity: number; experience_momentum: number;
  market_exposure: number; capability_decay: number; horizon_months: number;
  consistency?: number;
}) {
  const h = args.horizon_months;
  const point = clip(
    args.current +
    args.learning_velocity * h +
    args.experience_momentum * h +
    args.market_exposure * h * 0.25 -
    args.capability_decay * h
  );
  const consistency = args.consistency ?? 0.7;
  const widen = (1 - consistency) * h * 1.2; // band widens with horizon and inconsistency
  return {
    projection: +point.toFixed(2),
    band_low: +clip(point - widen).toFixed(2),
    band_high: +clip(point + widen).toFixed(2),
    confidence: +clip(consistency, 0, 1).toFixed(3),
  };
}

export function createPredictive(pool: Pool) {
  async function trajectories(subjectId: string) {
    return (await pool.query(
      `SELECT * FROM m4_capability_trajectories WHERE subject_id = $1 ORDER BY competency_id`, [subjectId])).rows;
  }

  async function classify(subjectId: string) {
    const rows = await trajectories(subjectId);
    const leadComp = rows.filter((r: any) => ['LEA', 'STR', 'COM'].includes(r.competency_id));
    const leadVel = leadComp.reduce((s: number, r: any) => s + +r.velocity, 0) / Math.max(1, leadComp.length);
    return rows.map((r: any) => ({
      competency_id: r.competency_id,
      trajectory: classifyTrajectory({
        velocity: +r.velocity, acceleration: +r.acceleration,
        leadership_composite_velocity: leadVel,
      }),
      velocity: +r.velocity, acceleration: +r.acceleration,
    }));
  }

  async function futureReadiness(subjectId: string, horizonMonths: number) {
    const rows = await trajectories(subjectId);
    if (!rows || rows.length === 0) return null;
    const n = rows.length;
    const avgCurrent = rows.reduce((s: number, r: any) => s + +r.current, 0) / n;
    const learning_velocity = rows.reduce((s: number, r: any) => s + +r.velocity, 0) / n;
    const experience_momentum = 0.15;
    const market_exposure = 0.35;
    const decay = 0.05;
    const consistency = clip(1 - varianceOf(rows.map((r: any) => +r.velocity)) / 2, 0.3, 0.95);
    const f = forecastFutureCapability({
      current: avgCurrent, learning_velocity, experience_momentum,
      market_exposure, capability_decay: decay, horizon_months: horizonMonths,
      consistency,
    });
    return {
      ...f,
      contributors: {
        current: +avgCurrent.toFixed(2), learning_velocity, experience_momentum,
        market_exposure, capability_decay: decay,
      },
      horizon_months: horizonMonths,
    };
  }

  async function persistFutureReadiness(subjectId: string, horizon: number) {
    const f = await futureReadiness(subjectId, horizon);
    if (!f) return null;
    const id = newId('m4frs');
    await pool.query(
      `INSERT INTO m4_future_readiness_scores(id, subject_id, horizon_months, readiness, contributors, confidence)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, subjectId, horizon, f.projection, JSON.stringify(f.contributors), f.confidence]);
    return { id, subject_id: subjectId, readiness: f.projection, ...f };
  }

  async function readinessHistory(subjectId: string) {
    return (await pool.query(
      `SELECT * FROM m4_future_readiness_scores WHERE subject_id = $1 ORDER BY horizon_months ASC, computed_at DESC`,
      [subjectId])).rows;
  }

  async function promotionPredictions(subjectId: string) {
    return (await pool.query(
      `SELECT * FROM m4_promotion_readiness_predictions WHERE subject_id = $1 ORDER BY readiness DESC`, [subjectId])).rows;
  }

  async function leadershipPotential(subjectId: string) {
    return (await pool.query(
      `SELECT * FROM m4_leadership_potential_predictions WHERE subject_id = $1 ORDER BY computed_at DESC LIMIT 1`, [subjectId])).rows[0] ?? null;
  }

  async function skillDecay(subjectId: string) {
    return (await pool.query(
      `SELECT * FROM m4_skill_decay_forecasts WHERE subject_id = $1 ORDER BY decay_rate DESC`, [subjectId])).rows;
  }

  async function futureGaps(subjectId: string) {
    return (await pool.query(
      `SELECT * FROM m4_future_capability_gaps WHERE subject_id = $1 ORDER BY gap DESC`, [subjectId])).rows;
  }

  async function trajectoryClassifications() {
    return (await pool.query(`SELECT * FROM m4_trajectory_classifications ORDER BY label`)).rows;
  }

  // ---- Burnout risk -------------------------------------------------------
  async function burnoutRisk(subjectId: string, signals?: { workload?: number; recovery?: number; variance?: number }) {
    // Composite: 0.5 * workload + 0.25 * (1-recovery) + 0.25 * variance
    const s = signals ?? { workload: 0.45, recovery: 0.70, variance: 0.30 };
    const raw = 0.50 * (s.workload ?? 0.5) + 0.25 * (1 - (s.recovery ?? 0.7)) + 0.25 * (s.variance ?? 0.3);
    const risk = +clip(raw * 100).toFixed(2);
    const band = risk >= 70 ? 'high' : risk >= 50 ? 'elevated' : risk >= 30 ? 'moderate' : 'low';
    return { subject_id: subjectId, risk, band, drivers: s };
  }

  return {
    trajectories, classify, futureReadiness, persistFutureReadiness, readinessHistory,
    promotionPredictions, leadershipPotential, skillDecay, futureGaps,
    trajectoryClassifications, burnoutRisk,
    classifyTrajectory, forecastFutureCapability,
  };
}

function varianceOf(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  return xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
}
