/**
 * Learning ROI V2 — longitudinal cohort attribution.
 * Pre/post score deltas with Cohen's d effect size + attribution share.
 */
import type { Pool } from 'pg';

export const LEARNING_ROI_V2_VERSION = '2.0.0';

export type CohortObservation = { pre: number; post: number };

export type AttributionResult = {
  intervention_key: string;
  cohort_label: string;
  cohort_size: number;
  pre_score_mean: number;
  post_score_mean: number;
  delta_mean: number;
  delta_sigma: number;
  cohen_d: number;
  attribution_share: number;
  observation_weeks: number;
  rationale: string;
};

export function computeAttribution(args: {
  interventionKey: string;
  cohortLabel: string;
  observations: CohortObservation[];
  baselineDelta?: number;
  observationWeeks?: number;
}): AttributionResult {
  const obs = (args.observations ?? []).filter((o) => Number.isFinite(o.pre) && Number.isFinite(o.post));
  const n = obs.length;
  if (n === 0) {
    return {
      intervention_key: args.interventionKey, cohort_label: args.cohortLabel,
      cohort_size: 0, pre_score_mean: 0, post_score_mean: 0,
      delta_mean: 0, delta_sigma: 0, cohen_d: 0, attribution_share: 0,
      observation_weeks: args.observationWeeks ?? 12,
      rationale: 'No observations; attribution null.',
    };
  }
  const preMean  = obs.reduce((s, o) => s + o.pre,  0) / n;
  const postMean = obs.reduce((s, o) => s + o.post, 0) / n;
  const deltas = obs.map((o) => o.post - o.pre);
  const deltaMean = deltas.reduce((s, d) => s + d, 0) / n;
  const deltaVar  = deltas.reduce((s, d) => s + (d - deltaMean) ** 2, 0) / Math.max(1, n - 1);
  const deltaSigma = Math.sqrt(deltaVar);
  const cohenD = deltaSigma > 0.001 ? deltaMean / deltaSigma : 0;
  const baseline = args.baselineDelta ?? 0;
  const incremental = Math.max(0, deltaMean - baseline);
  const attribution = Math.max(0, Math.min(1, deltaMean !== 0 ? incremental / Math.abs(deltaMean) : 0));
  return {
    intervention_key: args.interventionKey,
    cohort_label: args.cohortLabel,
    cohort_size: n,
    pre_score_mean: +preMean.toFixed(2),
    post_score_mean: +postMean.toFixed(2),
    delta_mean: +deltaMean.toFixed(2),
    delta_sigma: +deltaSigma.toFixed(3),
    cohen_d: +cohenD.toFixed(3),
    attribution_share: +attribution.toFixed(3),
    observation_weeks: args.observationWeeks ?? 12,
    rationale: `n=${n}, Δ=${deltaMean.toFixed(2)}±${deltaSigma.toFixed(2)}, d=${cohenD.toFixed(2)}; attribution ${(attribution * 100).toFixed(0)}% (baseline Δ=${baseline.toFixed(2)}).`,
  };
}

export async function persistAttribution(pool: Pool, tenantId: number | null, r: AttributionResult): Promise<void> {
  await pool.query(
    `INSERT INTO wos_v2_learning_attribution
       (tenant_id, intervention_key, cohort_label, cohort_size,
        pre_score_mean, post_score_mean, delta_mean, delta_sigma,
        attribution_share, cohen_d, observation_weeks, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
    [tenantId, r.intervention_key, r.cohort_label, r.cohort_size,
     r.pre_score_mean, r.post_score_mean, r.delta_mean, r.delta_sigma,
     r.attribution_share, r.cohen_d, r.observation_weeks, JSON.stringify({ rationale: r.rationale })],
  );
}
