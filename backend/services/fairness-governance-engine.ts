/**
 * Fairness Governance Engine — pure-function fairness metrics computation.
 * Implements demographic parity, equal opportunity, disparate impact, and
 * scoring-imbalance audits across cohorts.
 */
import type { Pool } from 'pg';
export const FAIRNESS_ENGINE_VERSION = '7.0.0';

export type Cohort = { group: string; positives: number; total: number; meanScore?: number };
export type FairnessResult = {
  metric: string; protected_group: string; reference_group: string;
  score: number; threshold: number; status: 'pass' | 'warn' | 'fail';
  details: Record<string, unknown>;
};

function rate(c: Cohort): number {
  return c.total > 0 ? c.positives / c.total : 0;
}

/** Demographic parity = P(positive|protected) / P(positive|reference); ideal ≈ 1. */
export function demographicParity(protectedC: Cohort, referenceC: Cohort): FairnessResult {
  const pr = rate(protectedC); const rr = rate(referenceC);
  const score = rr > 0 ? pr / rr : 0;
  const status = score >= 0.8 && score <= 1.25 ? 'pass' : score >= 0.6 ? 'warn' : 'fail';
  return {
    metric: 'demographic_parity', protected_group: protectedC.group, reference_group: referenceC.group,
    score: Math.round(score * 1000) / 1000, threshold: 0.8, status,
    details: { protected_rate: pr, reference_rate: rr, protected_n: protectedC.total, reference_n: referenceC.total },
  };
}

/** Disparate impact = same as parity but tagged separately for clarity (4/5 rule). */
export function disparateImpact(protectedC: Cohort, referenceC: Cohort): FairnessResult {
  const r = demographicParity(protectedC, referenceC);
  return { ...r, metric: 'disparate_impact', threshold: 0.8 };
}

/** Equal opportunity = TPR_protected / TPR_reference. Requires positives among truly-qualified. */
export function equalOpportunity(protectedTPR: number, referenceTPR: number, ns: { protected_n: number; reference_n: number }): FairnessResult {
  const score = referenceTPR > 0 ? protectedTPR / referenceTPR : 0;
  const status = score >= 0.85 && score <= 1.18 ? 'pass' : score >= 0.65 ? 'warn' : 'fail';
  return {
    metric: 'equal_opportunity', protected_group: 'protected', reference_group: 'reference',
    score: Math.round(score * 1000) / 1000, threshold: 0.85, status,
    details: { protected_tpr: protectedTPR, reference_tpr: referenceTPR, ...ns },
  };
}

/** Scoring imbalance = abs(meanScore_protected - meanScore_reference) / max(meanScore_reference, 1). */
export function scoringImbalance(protectedC: Cohort, referenceC: Cohort): FairnessResult {
  const pm = protectedC.meanScore ?? 0;
  const rm = referenceC.meanScore ?? 0;
  const denom = Math.max(rm, 1);
  const delta = Math.abs(pm - rm) / denom;
  const status = delta <= 0.1 ? 'pass' : delta <= 0.2 ? 'warn' : 'fail';
  return {
    metric: 'scoring_imbalance', protected_group: protectedC.group, reference_group: referenceC.group,
    score: Math.round(delta * 1000) / 1000, threshold: 0.1, status,
    details: { protected_mean: pm, reference_mean: rm, protected_n: protectedC.total, reference_n: referenceC.total },
  };
}

export async function persistFairness(pool: Pool, cohortKey: string, results: FairnessResult[]) {
  for (const r of results) {
    try {
      await pool.query(
        `INSERT INTO fairness_evaluations (cohort_key, metric, protected_group, reference_group, score, threshold, status, details)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
        [cohortKey, r.metric, r.protected_group, r.reference_group, r.score, r.threshold, r.status, JSON.stringify(r.details)],
      );
    } catch (e) { console.warn('[fairness] persist failed:', (e as Error).message); }
  }
}
