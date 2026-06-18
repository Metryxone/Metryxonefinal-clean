/**
 * CAPADEX WC-3 L6 — Longitudinal Consumption (Phase WC-P2, Lever D).
 *
 * PURE, READ-ONLY analytics over the already-captured longitudinal snapshots
 * (`getLongitudinalHistoryBySession`). Given a person's append-only snapshot
 * history (oldest→newest), it derives a per-metric TREND (direction + delta) and
 * a simple linear FORECAST of the next value. It computes NOTHING new about the
 * session itself, writes nothing, and never throws.
 *
 * CANON (strict):
 *   - ADDITIVE & READ-ONLY: no DB, no writes, no recompute of any session vector.
 *   - DETERMINISTIC: same snapshots → same trends/forecast.
 *   - HONEST DEGRADATION: <2 snapshots (or <2 readable points for a metric) →
 *     NO trend is fabricated — `consumed:false` with an honest "no trend yet" note.
 */
import type { LongitudinalHistory } from './longitudinal-foundation';

export type TrendDirection = 'improving' | 'declining' | 'stable';

export interface MetricTrend {
  metric: 'score' | 'csi_score';
  label: string;
  points: number;        // readable data points used
  first: number;         // oldest readable value
  last: number;          // newest readable value
  delta: number;         // last - first (rounded)
  slope_per_session: number; // least-squares slope per snapshot index
  direction: TrendDirection;
  forecast_next: number; // last + slope, clamped 0..100 (rounded)
}

export interface LongitudinalConsumption {
  consumed: boolean;
  snapshots: number;
  trends: MetricTrend[];
  note: string | null;
}

const METRICS: Array<{ key: 'score' | 'csi_score'; label: string }> = [
  { key: 'score', label: 'Assessment score' },
  { key: 'csi_score', label: 'Career Stage Index' },
];

/** Stable-trend deadband: |slope| below this (points/session) reads as 'stable'. */
export const STABLE_DEADBAND = 1;

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** Least-squares slope of y over its integer index 0..n-1 (n ≥ 2 guaranteed). */
export function leastSquaresSlope(ys: number[]): number {
  const n = ys.length;
  const meanX = (n - 1) / 2;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (ys[i] - meanY);
    den += (i - meanX) * (i - meanX);
  }
  return den === 0 ? 0 : num / den;
}

export function directionOf(slope: number): TrendDirection {
  if (slope > STABLE_DEADBAND) return 'improving';
  if (slope < -STABLE_DEADBAND) return 'declining';
  return 'stable';
}

/**
 * Derive per-metric trend + forecast from the snapshot history.
 * Pure: no DB, no side effects, never throws.
 */
export function computeLongitudinalConsumption(history: LongitudinalHistory | null): LongitudinalConsumption {
  const snaps = history?.snapshots ?? [];
  if (snaps.length < 2) {
    return {
      consumed: false,
      snapshots: snaps.length,
      trends: [],
      note: 'Not enough history to establish a trend yet — needs at least two completed sessions.',
    };
  }

  const trends: MetricTrend[] = [];
  for (const { key, label } of METRICS) {
    const series = snaps
      .map((s) => {
        const raw = (s as Record<string, unknown>)?.[key];
        // HONEST: null/undefined/'' are MISSING, not 0 — never coerce them into a datapoint.
        if (raw === null || raw === undefined || raw === '') return Number.NaN;
        const n = Number(raw);
        return Number.isFinite(n) ? n : Number.NaN;
      })
      .filter((n) => Number.isFinite(n));
    if (series.length < 2) continue; // honest: not enough readable points for THIS metric

    const first = series[0];
    const last = series[series.length - 1];
    const slope = leastSquaresSlope(series);
    trends.push({
      metric: key,
      label,
      points: series.length,
      first: Math.round(first),
      last: Math.round(last),
      delta: Math.round(last - first),
      slope_per_session: Number(slope.toFixed(2)),
      direction: directionOf(slope),
      forecast_next: Math.round(clamp01to100(last + slope)),
    });
  }

  const consumed = trends.length > 0;
  return {
    consumed,
    snapshots: snaps.length,
    trends,
    note: consumed
      ? null
      : 'History exists but no numeric score/CSI series could be read — no trend fabricated.',
  };
}
