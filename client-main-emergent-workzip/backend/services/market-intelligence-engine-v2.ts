/**
 * Market Intelligence V2 — predictive forecasting on top of Phase 5
 * `wos_market_signals`. Pure function core + thin DB helpers.
 */
import type { Pool } from 'pg';

export const MARKET_INTEL_V2_VERSION = '2.0.0';

export type ForecastInput = {
  signalKey: string;
  history: Array<{ value: number; observed_at: string | Date }>;
  horizonWeeks?: number;
};

export type ForecastResult = {
  signal_key: string;
  horizon_weeks: number;
  current_value: number;
  delta_per_week: number;
  projected_value: number;
  trend: 'accelerating' | 'stable' | 'cooling';
  confidence: number;
  rationale: string;
};

/** Linear OLS slope on weekly samples; resilient to short history. */
export function forecastSignal(input: ForecastInput): ForecastResult {
  const horizon = input.horizonWeeks ?? 12;
  const pts = (input.history ?? []).map((h, i) => ({ x: i, y: Number(h.value) || 0 }));
  if (pts.length < 2) {
    const cur = pts[0]?.y ?? 0;
    return {
      signal_key: input.signalKey, horizon_weeks: horizon,
      current_value: +cur.toFixed(3), delta_per_week: 0,
      projected_value: +cur.toFixed(3), trend: 'stable', confidence: 0.3,
      rationale: 'Insufficient history (<2 points); projection holds current value.',
    };
  }
  const n = pts.length;
  const xMean = pts.reduce((s, p) => s + p.x, 0) / n;
  const yMean = pts.reduce((s, p) => s + p.y, 0) / n;
  const num = pts.reduce((s, p) => s + (p.x - xMean) * (p.y - yMean), 0);
  const den = pts.reduce((s, p) => s + (p.x - xMean) ** 2, 0) || 1;
  const slope = num / den;
  const cur = pts[n - 1].y;
  const projected = cur + slope * horizon;
  // R² as confidence
  const ssTot = pts.reduce((s, p) => s + (p.y - yMean) ** 2, 0) || 1;
  const ssRes = pts.reduce((s, p) => s + (p.y - (yMean + slope * (p.x - xMean))) ** 2, 0);
  const r2 = Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  const trend: ForecastResult['trend'] = slope > 0.5 ? 'accelerating' : slope < -0.5 ? 'cooling' : 'stable';
  return {
    signal_key: input.signalKey,
    horizon_weeks: horizon,
    current_value: +cur.toFixed(3),
    delta_per_week: +slope.toFixed(3),
    projected_value: +Math.max(0, projected).toFixed(3),
    trend,
    confidence: +(0.4 + r2 * 0.55).toFixed(3),
    rationale: `OLS slope ${slope.toFixed(2)}/wk over ${n} samples (R²=${r2.toFixed(2)}); ${horizon}-wk projection ${projected.toFixed(1)}.`,
  };
}

export async function persistForecast(pool: Pool, tenantId: number | null, r: ForecastResult): Promise<void> {
  await pool.query(
    `INSERT INTO wos_v2_market_forecasts
       (tenant_id, signal_key, horizon_weeks, trend, current_value, projected_value, delta_per_week, confidence, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
    [tenantId, r.signal_key, r.horizon_weeks, r.trend, r.current_value, r.projected_value, r.delta_per_week, r.confidence, JSON.stringify({ rationale: r.rationale })],
  );
}

export async function fetchSignalHistory(pool: Pool, signalKey: string, tenantId: number | null): Promise<ForecastInput['history']> {
  try {
    const r = await pool.query<{ value: number; observed_at: string }>(
      `SELECT signal_value AS value, observed_at
       FROM wos_market_signals
       WHERE signal_key = $1 ${tenantId != null ? 'AND tenant_id = $2' : ''}
       ORDER BY observed_at ASC LIMIT 52`,
      tenantId != null ? [signalKey, tenantId] : [signalKey],
    );
    return r.rows.map((row) => ({ value: Number(row.value), observed_at: row.observed_at }));
  } catch {
    return [];
  }
}
