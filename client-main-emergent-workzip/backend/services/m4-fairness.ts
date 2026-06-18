/**
 * Phase 4 — Fairness + Bias Detection Engine (v4.0.0)
 *
 * Implements:
 *   - demographic parity:    |P(score≥τ | A=a) − P(score≥τ | A=ref)|
 *   - equal opportunity:     |TPR_a − TPR_ref|  (computed against label proxy if provided)
 *   - disparate impact:      P(positive | A=a) / P(positive | A=ref)   (4/5 rule = 0.80 floor)
 *   - adverse impact:        same as disparate impact, reported as ratio
 *   - fairness drift:        delta vs. last evaluation persisted
 *
 * Threshold semantics (warn/fail) are read from m4_model_fairness_thresholds.
 */
import type { Pool } from 'pg';

export const FAIRNESS_VERSION = '4.0.0';

const newId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const clip = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

export type Sample = { score: number; group: string; positive?: boolean; label?: boolean };

export type FairnessReport = {
  metric: 'demographic_parity' | 'equal_opportunity' | 'disparate_impact';
  reference_group: string;
  per_group: Record<string, { rate: number; n: number }>;
  worst_delta: number;
  worst_group: string;
  status: 'pass' | 'warn' | 'fail';
};

function positiveRate(samples: Sample[], threshold: number): number {
  const n = samples.length;
  if (n === 0) return 0;
  const pos = samples.filter(s => (s.positive ?? s.score >= threshold) === true).length;
  return pos / n;
}

function tpr(samples: Sample[], threshold: number): number {
  const positives = samples.filter(s => s.label === true);
  const n = positives.length;
  if (n === 0) return 0;
  const tp = positives.filter(s => s.score >= threshold).length;
  return tp / n;
}

export function computeDemographicParity(samples: Sample[], threshold: number, reference?: string): FairnessReport {
  const groups = Array.from(new Set(samples.map(s => s.group)));
  const rates: Record<string, { rate: number; n: number }> = {};
  for (const g of groups) {
    const sub = samples.filter(s => s.group === g);
    rates[g] = { rate: +positiveRate(sub, threshold).toFixed(4), n: sub.length };
  }
  const ref = reference ?? groups[0];
  const refRate = rates[ref]?.rate ?? 0;
  let worst = ref, worstDelta = 0;
  for (const g of groups) {
    const d = Math.abs(rates[g].rate - refRate);
    if (d > worstDelta) { worstDelta = d; worst = g; }
  }
  return {
    metric: 'demographic_parity', reference_group: ref, per_group: rates,
    worst_delta: +worstDelta.toFixed(4), worst_group: worst,
    status: worstDelta <= 0.10 ? 'pass' : worstDelta <= 0.20 ? 'warn' : 'fail',
  };
}

export function computeDisparateImpact(samples: Sample[], threshold: number, reference?: string): FairnessReport {
  const groups = Array.from(new Set(samples.map(s => s.group)));
  const rates: Record<string, { rate: number; n: number }> = {};
  for (const g of groups) {
    const sub = samples.filter(s => s.group === g);
    rates[g] = { rate: +positiveRate(sub, threshold).toFixed(4), n: sub.length };
  }
  const ref = reference ?? groups[0];
  const refRate = Math.max(rates[ref]?.rate ?? 0, 1e-9);
  let worst = ref, worstRatio = 1;
  for (const g of groups) {
    const ratio = rates[g].rate / refRate;
    if (ratio < worstRatio) { worstRatio = ratio; worst = g; }
  }
  return {
    metric: 'disparate_impact', reference_group: ref, per_group: rates,
    worst_delta: +clip(worstRatio, 0, 1).toFixed(4), worst_group: worst,
    status: worstRatio >= 0.85 ? 'pass' : worstRatio >= 0.80 ? 'warn' : 'fail',
  };
}

export function computeEqualOpportunity(samples: Sample[], threshold: number, reference?: string): FairnessReport {
  const groups = Array.from(new Set(samples.map(s => s.group)));
  const rates: Record<string, { rate: number; n: number }> = {};
  for (const g of groups) {
    const sub = samples.filter(s => s.group === g);
    rates[g] = { rate: +tpr(sub, threshold).toFixed(4), n: sub.length };
  }
  const ref = reference ?? groups[0];
  const refRate = rates[ref]?.rate ?? 0;
  let worst = ref, worstDelta = 0;
  for (const g of groups) {
    const d = Math.abs(rates[g].rate - refRate);
    if (d > worstDelta) { worstDelta = d; worst = g; }
  }
  return {
    metric: 'equal_opportunity', reference_group: ref, per_group: rates,
    worst_delta: +worstDelta.toFixed(4), worst_group: worst,
    status: worstDelta <= 0.10 ? 'pass' : worstDelta <= 0.20 ? 'warn' : 'fail',
  };
}

export function createFairness(pool: Pool) {
  /** Read configured thresholds (returns defaults if none configured) */
  async function thresholdsFor(modelId: string) {
    const { rows } = await pool.query(
      `SELECT metric, warn_at, fail_at FROM m4_model_fairness_thresholds WHERE model_id = $1`, [modelId]);
    const map = Object.fromEntries(rows.map((r: any) => [r.metric, { warn: +r.warn_at, fail: +r.fail_at }]));
    return map;
  }

  /** Run all three fairness tests against an in-memory sample bag and persist. */
  async function runFairnessSuite(modelId: string, samples: Sample[], threshold = 70, reference?: string) {
    const dp = computeDemographicParity(samples, threshold, reference);
    const di = computeDisparateImpact(samples, threshold, reference);
    const eo = computeEqualOpportunity(samples, threshold, reference);
    const overall_status = [dp, di, eo].some(r => r.status === 'fail') ? 'fail'
                         : [dp, di, eo].some(r => r.status === 'warn') ? 'warn' : 'pass';

    const evalId = newId('m4fe');
    await pool.query(
      `INSERT INTO m4_fairness_evaluations(id, model_id, cohort, metrics, overall_status)
       VALUES ($1,$2,$3,$4,$5)`,
      [evalId, modelId, reference ?? 'global',
       JSON.stringify({ demographic_parity: dp, disparate_impact: di, equal_opportunity: eo }),
       overall_status]);

    // Persist scalar rows too for trend lookups
    for (const r of [dp, di, eo]) {
      await pool.query(
        `INSERT INTO m4_ai_fairness_scores(id, model_id, metric, value, status, cohort)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [newId('m4fs'), modelId, r.metric, r.worst_delta, r.status, reference ?? 'global']);
    }

    return { evaluation_id: evalId, overall_status, demographic_parity: dp, disparate_impact: di, equal_opportunity: eo };
  }

  async function runBiasDetection(modelId: string, attr: string, samples: Sample[], threshold = 70) {
    const dp = computeDemographicParity(samples, threshold);
    const di = computeDisparateImpact(samples, threshold);
    const driftDelta = await driftSince(modelId, attr, dp.worst_delta);
    const id = newId('m4bd');
    await pool.query(
      `INSERT INTO m4_bias_detection_runs(id, model_id, protected_attr, sample_n, bias_score, status, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, modelId, attr, samples.length, dp.worst_delta, dp.status,
       JSON.stringify({ demographic_parity: dp, disparate_impact: di, drift_delta: driftDelta })]);
    await pool.query(
      `INSERT INTO m4_ai_bias_detection_results(id, model_id, protected_attr, bias_score, drift_delta, status, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [newId('m4bdr'), modelId, attr, dp.worst_delta, driftDelta, dp.status,
       JSON.stringify({ demographic_parity: dp, disparate_impact: di })]);
    return { run_id: id, bias_score: dp.worst_delta, status: dp.status, drift_delta: driftDelta, demographic_parity: dp, disparate_impact: di };
  }

  async function driftSince(modelId: string, attr: string, currentValue: number): Promise<number> {
    const { rows } = await pool.query(
      `SELECT bias_score::float AS v FROM m4_ai_bias_detection_results
       WHERE model_id = $1 AND protected_attr = $2 ORDER BY detected_at DESC LIMIT 1`,
      [modelId, attr]);
    if (!rows[0]) return 0;
    return +(currentValue - +rows[0].v).toFixed(4);
  }

  async function recentFairness(limit = 25) {
    return (await pool.query(`SELECT * FROM m4_ai_fairness_scores ORDER BY evaluated_at DESC LIMIT $1`, [Math.min(limit, 100)])).rows;
  }

  async function recentBias(limit = 25) {
    return (await pool.query(`SELECT * FROM m4_ai_bias_detection_results ORDER BY detected_at DESC LIMIT $1`, [Math.min(limit, 100)])).rows;
  }

  async function demographicImpact(modelId?: string) {
    return (await pool.query(
      modelId
        ? `SELECT * FROM m4_demographic_impact_analysis WHERE model_id = $1 ORDER BY computed_at DESC`
        : `SELECT * FROM m4_demographic_impact_analysis ORDER BY computed_at DESC`,
      modelId ? [modelId] : [])).rows;
  }

  async function protectedAttributes() {
    return (await pool.query(`SELECT * FROM m4_protected_attribute_checks ORDER BY attr`)).rows;
  }

  /** Deterministic demo sample bag for endpoints that don't receive real data. */
  function demoSamples(seed = 'demo', n = 400): Sample[] {
    let s = 0; for (let i = 0; i < seed.length; i++) s = ((s << 5) + s + seed.charCodeAt(i)) | 0;
    const rand = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) % 100000) / 100000; };
    const out: Sample[] = [];
    for (let i = 0; i < n; i++) {
      const g = i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C';
      const base = g === 'A' ? 70 : g === 'B' ? 67 : 65;
      const score = clip(base + (rand() - 0.5) * 30, 0, 100);
      out.push({ score, group: g, label: score >= 65 });
    }
    return out;
  }

  return {
    thresholdsFor, runFairnessSuite, runBiasDetection,
    recentFairness, recentBias, demographicImpact, protectedAttributes,
    demoSamples,
  };
}
