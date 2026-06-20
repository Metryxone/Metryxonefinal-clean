/**
 * Phase 3.11 — Trend Engine (canonical, pure).
 *
 * The ONE home for trend math across the EI suite. Phase 3.10 originally defined
 * computeEiTrend inside the dashboard engine; it now lives here so the dashboard,
 * the History/Progression engines, and any future consumer share a single impl
 * (no drift). The dashboard re-exports computeEiTrend/EiTrend from this module.
 *
 * Honesty contract:
 *   - A trend anchors on MEASURED points only (value != null). NULL stays NULL —
 *     it is never coerced into a fake 0 datapoint.
 *   - Fewer than two measured points → status 'insufficient_history' with
 *     direction/delta null. A slope is never fabricated from one point.
 *   - Snapshots are user-captured (explicit POST), so a trend reflects captured
 *     history, not a continuous stream — disclosed in `message`.
 *   - Pure / never-throws: no I/O, deterministic over its input.
 */

import type { EiProfileSnapshotRow } from './ei-profile-history.js';

export const TREND_ENGINE_VERSION = '3.11.0';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Movement (in the metric's own units) at/under which a change is "stable". */
export const STABLE_BAND = 1.0;

// ---------------------------------------------------------------------------
// Generic metric trend (the primitive every EI-specific trend composes)
// ---------------------------------------------------------------------------

export interface MetricTrendPoint {
  ts: string;
  value: number | null;
}

export interface MetricTrend {
  available: boolean;
  status: 'ready' | 'insufficient_history' | 'unavailable';
  direction: 'improving' | 'declining' | 'stable' | null;
  delta: number | null; // latest measured - first measured
  slope_per_step: number | null; // delta / (measured steps) — directional only
  first: { ts: string; value: number } | null;
  latest: { ts: string; value: number } | null;
  total: number;
  measured: number;
  points: MetricTrendPoint[];
  message: string;
}

/**
 * computeMetricTrend — pure trend over a generic time series.
 * @param series points (any order; sorted ascending by ts internally)
 * @param stableBand movement (metric units) considered "no real change"
 * @param higherIsBetter when false, a rising value is reported as 'declining'
 *        (e.g. a risk count going up). Default true.
 */
export function computeMetricTrend(
  series: MetricTrendPoint[],
  opts: { stableBand?: number; higherIsBetter?: boolean } = {},
): MetricTrend {
  const stableBand = opts.stableBand ?? STABLE_BAND;
  const higherIsBetter = opts.higherIsBetter !== false;

  const all = Array.isArray(series) ? [...series] : [];
  all.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  const measured = all.filter((p) => p.value != null) as { ts: string; value: number }[];

  if (measured.length < 2) {
    return {
      available: false,
      status: 'insufficient_history',
      direction: null,
      delta: null,
      slope_per_step: null,
      first: measured[0] ? { ts: measured[0].ts, value: measured[0].value } : null,
      latest: measured[0] ? { ts: measured[0].ts, value: measured[0].value } : null,
      total: all.length,
      measured: measured.length,
      points: all,
      message:
        measured.length === 0
          ? 'No measured points yet — trend unavailable (not fabricated).'
          : 'Only one measured point — at least two are required to establish a trend (not fabricated).',
    };
  }

  const first = measured[0];
  const latest = measured[measured.length - 1];
  const delta = round1(latest.value - first.value);
  const steps = measured.length - 1;
  const slope = round1(delta / steps);

  // Raw movement classification, then orient by polarity.
  const rising = delta > stableBand;
  const falling = delta < -stableBand;
  const direction: MetricTrend['direction'] = rising
    ? higherIsBetter
      ? 'improving'
      : 'declining'
    : falling
      ? higherIsBetter
        ? 'declining'
        : 'improving'
      : 'stable';

  return {
    available: true,
    status: 'ready',
    direction,
    delta,
    slope_per_step: slope,
    first: { ts: first.ts, value: first.value },
    latest: { ts: latest.ts, value: latest.value },
    total: all.length,
    measured: measured.length,
    points: all,
    message: `${direction} by ${Math.abs(delta)} across ${measured.length} measured point(s) (captured history, not continuous).`,
  };
}

// ---------------------------------------------------------------------------
// EI-specific trend (overall EI + companion deltas) — used by the 3.10 dashboard
// ---------------------------------------------------------------------------

export interface EiTrendPoint {
  snapshot_id: number;
  captured_at: string;
  ei_score: number | null;
  band: string | null;
  confidence_score: number | null;
  strength_count: number;
  development_count: number;
  risk_count: number;
}

export interface EiTrend {
  available: boolean;
  status: 'ready' | 'insufficient_history' | 'unavailable';
  direction: 'improving' | 'declining' | 'stable' | null;
  delta: number | null; // latest.ei_score - first.ei_score (measured points only)
  confidence_delta: number | null;
  strength_delta: number | null;
  development_delta: number | null;
  risk_delta: number | null; // a rising risk count is a concern (raw, not inverted here)
  first: { captured_at: string; ei_score: number | null; band: string | null } | null;
  latest: { captured_at: string; ei_score: number | null; band: string | null } | null;
  snapshots_total: number;
  snapshots_measured: number;
  points: EiTrendPoint[];
  message: string;
}

/**
 * computeEiTrend — overall-EI trend over snapshot rows (delegates the core
 * direction/delta math to computeMetricTrend so there is ONE implementation).
 */
export function computeEiTrend(rows: EiProfileSnapshotRow[]): EiTrend {
  const all = Array.isArray(rows) ? [...rows] : [];
  all.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const points: EiTrendPoint[] = all.map((r) => ({
    snapshot_id: r.id,
    captured_at: r.created_at,
    ei_score: r.ei_score, // null-preserving (mapHeadline)
    band: r.ei_band,
    confidence_score: r.confidence_score,
    strength_count: r.strength_count,
    development_count: r.development_count,
    risk_count: r.risk_count,
  }));

  const core = computeMetricTrend(
    points.map((p) => ({ ts: p.captured_at, value: p.ei_score })),
    { stableBand: STABLE_BAND, higherIsBetter: true },
  );

  const measured = points.filter((p) => p.ei_score != null);

  if (core.status !== 'ready') {
    return {
      available: false,
      status: 'insufficient_history',
      direction: null,
      delta: null,
      confidence_delta: null,
      strength_delta: null,
      development_delta: null,
      risk_delta: null,
      first: measured[0]
        ? { captured_at: measured[0].captured_at, ei_score: measured[0].ei_score, band: measured[0].band }
        : null,
      latest: measured[0]
        ? { captured_at: measured[0].captured_at, ei_score: measured[0].ei_score, band: measured[0].band }
        : null,
      snapshots_total: points.length,
      snapshots_measured: measured.length,
      points,
      message:
        measured.length === 0
          ? 'No measured snapshots captured yet — trend is unavailable (not fabricated). Capture profile snapshots over time to build a trend.'
          : 'Only one measured snapshot captured — at least two are required to establish a trend (not fabricated).',
    };
  }

  const first = measured[0];
  const latest = measured[measured.length - 1];
  const confidence_delta =
    first.confidence_score != null && latest.confidence_score != null
      ? round1(latest.confidence_score - first.confidence_score)
      : null;

  return {
    available: true,
    status: 'ready',
    direction: core.direction,
    delta: core.delta,
    confidence_delta,
    strength_delta: latest.strength_count - first.strength_count,
    development_delta: latest.development_count - first.development_count,
    risk_delta: latest.risk_count - first.risk_count,
    first: { captured_at: first.captured_at, ei_score: first.ei_score, band: first.band },
    latest: { captured_at: latest.captured_at, ei_score: latest.ei_score, band: latest.band },
    snapshots_total: points.length,
    snapshots_measured: measured.length,
    points,
    message: `EI ${core.direction} by ${Math.abs(core.delta as number)} point(s) across ${measured.length} measured snapshot(s) (captured history, not continuous).`,
  };
}
