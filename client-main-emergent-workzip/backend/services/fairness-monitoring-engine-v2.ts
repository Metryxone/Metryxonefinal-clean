/**
 * Fairness Monitoring V2 — drift detection + significance testing
 * on top of Phase 5 wos_fairness_results.
 */
import type { Pool } from 'pg';

export const FAIRNESS_MONITORING_V2_VERSION = '2.0.0';

export type DriftInput = {
  metric: string;
  baseline: number;
  current: number;
  baselineN: number;
  currentN: number;
};

export type DriftResult = {
  metric: string;
  baseline_value: number;
  current_value: number;
  delta: number;
  z_score: number;
  is_significant: boolean;
  rationale: string;
};

/** Two-proportion z-test approximation for rate-like fairness metrics. */
export function detectDrift(d: DriftInput): DriftResult {
  const p1 = clamp01(d.baseline);
  const p2 = clamp01(d.current);
  const n1 = Math.max(1, d.baselineN);
  const n2 = Math.max(1, d.currentN);
  const pPool = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(Math.max(1e-9, pPool * (1 - pPool) * (1 / n1 + 1 / n2)));
  const z = +((p2 - p1) / se).toFixed(3);
  const sig = Math.abs(z) >= 1.96;
  return {
    metric: d.metric,
    baseline_value: +p1.toFixed(3),
    current_value: +p2.toFixed(3),
    delta: +(p2 - p1).toFixed(3),
    z_score: z,
    is_significant: sig,
    rationale: `Δ=${(p2 - p1).toFixed(3)} on ${d.metric}; pooled SE ${se.toFixed(3)} → z=${z}, ${sig ? 'significant (α=0.05)' : 'not significant'}.`,
  };
}

function clamp01(n: number): number { return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0)); }

export async function persistDrift(
  pool: Pool, tenantId: number | null, suiteKey: string, groupLabel: string, r: DriftResult,
): Promise<void> {
  await pool.query(
    `INSERT INTO wos_v2_fairness_drift
       (tenant_id, suite_key, group_label, metric, baseline_value, current_value, delta, z_score, is_significant)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [tenantId, suiteKey, groupLabel, r.metric, r.baseline_value, r.current_value, r.delta, r.z_score, r.is_significant],
  );
}
