/**
 * Workforce Simulation V2 — apply organisational interventions on an
 * aggregated competency profile and project the result. Pure-function.
 */
import type { Pool } from 'pg';
export const WORKFORCE_SIM_V2_VERSION = '6.0.0';

const CANON = ['COG','COM','LEA','EXE','ADP','TEC','EIQ'] as const;
type Distribution = Partial<Record<typeof CANON[number], { mean: number; size: number }>>;

export type Intervention =
  | { type: 'training'; competency: string; uplift: number; reach: number }   // reach = number of people
  | { type: 'mentorship'; competency: string; uplift: number; reach: number }
  | { type: 'hire'; competency: string; level: number; count: number }
  | { type: 'restructure'; reach: number; leadershipBoost: number };

export type SimResult = {
  scenario_key: string;
  baseline: Distribution;
  projected: Distribution;
  deltas: Array<{ competency: string; mean_delta: number; size_delta: number }>;
  affected_population: number;
};

function clone(d: Distribution): Distribution {
  const out: Distribution = {};
  for (const k of CANON) if (d[k]) out[k] = { mean: d[k]!.mean, size: d[k]!.size };
  return out;
}

export function simulateInterventions(scenarioKey: string, baseline: Distribution, interventions: Intervention[]): SimResult {
  const projected = clone(baseline);
  let affected = 0;
  for (const iv of interventions) {
    if (iv.type === 'training' || iv.type === 'mentorship') {
      const k = iv.competency as typeof CANON[number];
      if (!projected[k]) projected[k] = { mean: 0, size: 0 };
      const entry = projected[k]!;
      const cohort = Math.min(iv.reach, entry.size || iv.reach);
      // Weighted mean shift: (size * mean + reach * (mean + uplift)) / (size + reach) [if no new size]
      const oldMean = entry.mean;
      const blended = entry.size > 0
        ? (entry.mean * (entry.size - cohort) + (entry.mean + iv.uplift) * cohort) / entry.size
        : entry.mean + iv.uplift;
      entry.mean = Math.max(0, Math.min(100, blended));
      affected += cohort;
      void oldMean;
    } else if (iv.type === 'hire') {
      const k = iv.competency as typeof CANON[number];
      if (!projected[k]) projected[k] = { mean: 0, size: 0 };
      const entry = projected[k]!;
      const newSize = entry.size + iv.count;
      entry.mean = (entry.mean * entry.size + iv.level * iv.count) / Math.max(1, newSize);
      entry.size = newSize;
      affected += iv.count;
    } else if (iv.type === 'restructure') {
      if (projected.LEA) projected.LEA.mean = Math.min(100, projected.LEA.mean + iv.leadershipBoost);
      affected += iv.reach;
    }
  }
  const deltas = CANON.map((k) => {
    const b = baseline[k]; const p = projected[k];
    return {
      competency: k,
      mean_delta: Math.round(((p?.mean ?? 0) - (b?.mean ?? 0)) * 100) / 100,
      size_delta: (p?.size ?? 0) - (b?.size ?? 0),
    };
  }).filter((d) => d.mean_delta !== 0 || d.size_delta !== 0);
  return { scenario_key: scenarioKey, baseline, projected, deltas, affected_population: affected };
}

export function projectLeadershipPipeline(currentEmergenceMean: number, growthPerQuarter: number, quarters: number) {
  const points = Array.from({ length: quarters + 1 }, (_, q) => ({
    quarter: q,
    expected_emergence_mean: Math.max(0, Math.min(100, Math.round((currentEmergenceMean + growthPerQuarter * q) * 100) / 100)),
  }));
  return { quarters, growth_per_quarter: growthPerQuarter, points };
}

export function projectWorkforceResilience(distribution: Distribution): { resilience_score: number; drivers: Array<{ k: string; contribution: number }> } {
  const drivers: Array<{ k: string; contribution: number }> = [];
  let sum = 0;
  for (const k of CANON) {
    const m = distribution[k]?.mean ?? 0;
    const sz = distribution[k]?.size ?? 0;
    const w = k === 'ADP' ? 0.25 : k === 'EIQ' ? 0.20 : k === 'COG' ? 0.20 : k === 'LEA' ? 0.15 : 0.05;
    const contrib = (m / 100) * w * Math.min(1, sz / 50);
    sum += contrib;
    drivers.push({ k, contribution: Math.round(contrib * 1000) / 1000 });
  }
  return { resilience_score: Math.round(sum * 100), drivers: drivers.sort((a, b) => b.contribution - a.contribution) };
}

export async function persistSimulation(pool: Pool, ranBy: string | null, result: SimResult) {
  try {
    await pool.query(
      `INSERT INTO simulation_forecast_history (scenario_key, inputs, outputs, ran_by) VALUES ($1,$2::jsonb,$3::jsonb,$4)`,
      [result.scenario_key, JSON.stringify({ baseline: result.baseline }), JSON.stringify({ projected: result.projected, deltas: result.deltas, affected: result.affected_population }), ranBy],
    );
  } catch (e) { console.warn('[sim] persist failed:', (e as Error).message); }
}
