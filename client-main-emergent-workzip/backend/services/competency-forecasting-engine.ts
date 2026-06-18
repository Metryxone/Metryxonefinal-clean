/**
 * Competency Forecasting Engine — time-series growth projection with
 * optional intervention boost. Pure-function + DB persistence helper.
 */
import type { Pool } from 'pg';
export const FORECASTING_ENGINE_VERSION = '6.0.0';

export type ForecastInput = {
  userId: string;
  competencyKey: string;
  currentLevel: number;
  historyDeltas?: number[];           // recent monthly deltas (e.g., +1.2, +0.8)
  interventionBoost?: number;         // additive monthly bump from active interventions
  horizonMonths: number;
};

export type Forecast = {
  user_id: string; competency_key: string; horizon_months: number;
  predicted_level: number; confidence: number;
  method: string; inputs: Record<string, unknown>;
};

const cap = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function forecastCompetency(input: ForecastInput): Forecast {
  const hist = input.historyDeltas ?? [];
  // Trailing-mean monthly delta with mild floor
  const trailing = hist.length
    ? hist.slice(-6).reduce((a, b) => a + b, 0) / Math.min(6, hist.length)
    : 0.8;
  const monthlyDelta = trailing + (input.interventionBoost ?? 0);
  const projected = cap(input.currentLevel + monthlyDelta * input.horizonMonths);
  // Confidence shrinks with horizon length and grows with history depth
  const histRichness = Math.min(1, hist.length / 6);
  const horizonPenalty = Math.max(0, 1 - input.horizonMonths / 18);
  const confidence = Math.round(cap(0.35 + 0.4 * histRichness + 0.25 * horizonPenalty, 0, 0.95) * 1000) / 1000;
  return {
    user_id: input.userId,
    competency_key: input.competencyKey,
    horizon_months: input.horizonMonths,
    predicted_level: Math.round(projected * 100) / 100,
    confidence,
    method: 'trailing_mean_plus_intervention',
    inputs: { trailing_mean: Math.round(trailing * 100) / 100, intervention_boost: input.interventionBoost ?? 0, history_n: hist.length },
  };
}

export function forecastReadinessProgression(currentReadiness: number, monthsForward: number, growthPerMonth = 0.03) {
  const cap01 = (n: number) => Math.max(0, Math.min(1, n));
  const points = Array.from({ length: monthsForward + 1 }, (_, i) => ({
    month: i,
    readiness: Math.round(cap01(currentReadiness + i * growthPerMonth) * 1000) / 1000,
  }));
  return { current: currentReadiness, horizon_months: monthsForward, growth_per_month: growthPerMonth, points };
}

export function forecastInterventionImpact(baselineGrowth: number, interventionPotency: number, durationMonths: number) {
  const totalUplift = Math.round(interventionPotency * durationMonths * 100) / 100;
  const acceleratedRate = baselineGrowth + interventionPotency;
  return { baseline_growth: baselineGrowth, intervention_potency: interventionPotency, duration_months: durationMonths, total_uplift: totalUplift, accelerated_monthly_rate: acceleratedRate };
}

export function forecastOrganizationalMaturity(currentMean: number, populationSize: number, monthlyGrowth: number, horizonMonths: number) {
  // Population-weighted projection; larger orgs move slower
  const inertia = Math.min(1, populationSize / 500);
  const effectiveGrowth = monthlyGrowth * (1 - 0.3 * inertia);
  const projectedMean = Math.max(0, Math.min(100, currentMean + effectiveGrowth * horizonMonths));
  return {
    current_mean: currentMean, population_size: populationSize,
    effective_monthly_growth: Math.round(effectiveGrowth * 100) / 100,
    horizon_months: horizonMonths,
    projected_mean: Math.round(projectedMean * 100) / 100,
  };
}

export async function persistForecast(pool: Pool, f: Forecast) {
  try {
    await pool.query(
      `INSERT INTO competency_forecasts (user_id, competency_key, horizon_months, predicted_level, confidence, method, inputs)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [f.user_id, f.competency_key, f.horizon_months, f.predicted_level, f.confidence, f.method, JSON.stringify(f.inputs)],
    );
  } catch (e) { console.warn('[forecast] persist failed:', (e as Error).message); }
}
