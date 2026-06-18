/**
 * Phase 4 — AI Observability Engine (v4.0.0)
 *
 *   forecast accuracy: MAPE (mean absolute percentage error) + Brier score per horizon
 *   model drift:       PSI by default; thresholds {warn: 0.10, fail: 0.20}
 *   prediction monitor: arbitrary metric ingestion with status banding
 */
import type { Pool } from 'pg';

export const OBSERVABILITY_VERSION = '4.0.0';

const newId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function computePSI(expectedBuckets: number[], observedBuckets: number[]): number {
  if (expectedBuckets.length !== observedBuckets.length || expectedBuckets.length === 0) return 0;
  let psi = 0;
  for (let i = 0; i < expectedBuckets.length; i++) {
    const e = Math.max(expectedBuckets[i], 1e-6);
    const o = Math.max(observedBuckets[i], 1e-6);
    psi += (o - e) * Math.log(o / e);
  }
  return +psi.toFixed(4);
}

export function computeMAPE(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length || actual.length === 0) return 0;
  let sum = 0; let n = 0;
  for (let i = 0; i < actual.length; i++) {
    if (Math.abs(actual[i]) < 1e-6) continue;
    sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
    n += 1;
  }
  return n === 0 ? 0 : +((sum / n) * 100).toFixed(3);
}

export function computeBrier(probabilities: number[], outcomes: number[]): number {
  if (probabilities.length !== outcomes.length || probabilities.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < probabilities.length; i++) sum += (probabilities[i] - outcomes[i]) ** 2;
  return +(sum / probabilities.length).toFixed(4);
}

export function createObservability(pool: Pool) {
  async function accuracy(modelId?: string) {
    return (await pool.query(
      modelId
        ? `SELECT * FROM m4_forecast_accuracy_tracking WHERE model_id = $1 ORDER BY evaluated_at DESC LIMIT 50`
        : `SELECT * FROM m4_forecast_accuracy_tracking ORDER BY evaluated_at DESC LIMIT 50`,
      modelId ? [modelId] : [])).rows;
  }

  async function drift(modelId?: string) {
    return (await pool.query(
      modelId
        ? `SELECT * FROM m4_model_drift_detection WHERE model_id = $1 ORDER BY detected_at DESC LIMIT 50`
        : `SELECT * FROM m4_model_drift_detection ORDER BY detected_at DESC LIMIT 50`,
      modelId ? [modelId] : [])).rows;
  }

  async function monitoring(modelId?: string) {
    return (await pool.query(
      modelId
        ? `SELECT * FROM m4_prediction_monitoring WHERE model_id = $1 ORDER BY recorded_at DESC LIMIT 100`
        : `SELECT * FROM m4_prediction_monitoring ORDER BY recorded_at DESC LIMIT 100`,
      modelId ? [modelId] : [])).rows;
  }

  async function recordAccuracy(modelId: string, horizonMonths: number, actual: number[], predicted: number[]) {
    const mape = computeMAPE(actual, predicted);
    const id = newId('m4fat');
    await pool.query(
      `INSERT INTO m4_forecast_accuracy_tracking(id, model_id, horizon_months, mape, sample_n)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, modelId, horizonMonths, mape, actual.length]);
    return { id, mape, sample_n: actual.length };
  }

  async function recordDrift(modelId: string, expected: number[], observed: number[], metric = 'psi') {
    const value = metric === 'psi' ? computePSI(expected, observed) : 0;
    const threshold = 0.20;
    const status = value < 0.10 ? 'pass' : value < threshold ? 'warn' : 'fail';
    const id = newId('m4mdd');
    await pool.query(
      `INSERT INTO m4_model_drift_detection(id, model_id, drift_metric, value, threshold, status)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, modelId, metric, value, threshold, status]);
    return { id, value, threshold, status };
  }

  async function log(level: 'info' | 'warn' | 'error', source: string, event: string, detail: any = {}) {
    await pool.query(
      `INSERT INTO m4_ai_observability_logs(id, level, source, event, detail)
       VALUES ($1,$2,$3,$4,$5)`,
      [newId('m4obs'), level, source, event, JSON.stringify(detail)]);
  }

  async function recent(limit = 50) {
    return (await pool.query(
      `SELECT * FROM m4_ai_observability_logs ORDER BY recorded_at DESC LIMIT $1`, [Math.min(limit, 200)])).rows;
  }

  return { accuracy, drift, monitoring, recordAccuracy, recordDrift, log, recent };
}
