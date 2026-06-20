/**
 * Phase 3.11 — Progression Engine (progression_engine deliverable).
 *
 * COMPOSES the EI History (3.11) and the Trend Engine (3.11) to describe how a
 * subject is progressing over captured snapshots — overall and per-dimension —
 * classified into Growth / Improvement / Decline / Stable.
 *
 * Honesty / discipline:
 *   - Recompute NOTHING: overall + per-dimension series come from buildEiHistory;
 *     direction/delta math comes from computeMetricTrend. This engine only
 *     classifies and rolls up.
 *   - >=2 MEASURED points are required (overall AND per-dimension) or the result
 *     is status 'insufficient_history' — a slope is never fabricated.
 *   - NULL scores stay NULL (never 0). A dimension measured fewer than twice is
 *     reported as insufficient, not silently dropped or zero-filled.
 *   - Read-only & never-throws.
 */

import type { Pool } from 'pg';
import { buildEiHistory, type EiHistory, type DimensionHistorySeries } from './ei-history-engine.js';
import { computeMetricTrend, STABLE_BAND, type MetricTrend } from './trend-engine.js';

export const PROGRESSION_ENGINE_VERSION = '3.11.0';

export type ProgressionDirection = 'growth' | 'decline' | 'stable';

export interface StepTransition {
  from_at: string;
  to_at: string;
  from_score: number;
  to_score: number;
  delta: number;
  direction: ProgressionDirection;
}

export interface OverallProgression {
  status: 'ready' | 'insufficient_history';
  direction: ProgressionDirection | null;
  net_delta: number | null; // first measured → latest measured
  first: { captured_at: string; ei_score: number } | null;
  latest: { captured_at: string; ei_score: number } | null;
  snapshots_total: number;
  snapshots_measured: number;
  transitions: StepTransition[]; // consecutive measured steps
  trend: MetricTrend;
  message: string;
}

export interface DimensionProgression {
  ei_dimension_id: string;
  dimension_name: string | null;
  status: 'ready' | 'insufficient_history';
  direction: ProgressionDirection | null;
  net_delta: number | null;
  measured_count: number;
  first_score: number | null;
  latest_score: number | null;
}

export interface Progression {
  subject_id: string;
  overall: OverallProgression;
  dimensions: DimensionProgression[];
  rollup: {
    growth_areas: { ei_dimension_id: string; dimension_name: string | null; net_delta: number }[];
    decline_areas: { ei_dimension_id: string; dimension_name: string | null; net_delta: number }[];
    stable_areas: { ei_dimension_id: string; dimension_name: string | null }[];
    insufficient_dimensions: { ei_dimension_id: string; dimension_name: string | null }[];
    improvement_summary: string;
  };
  notes: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function classify(delta: number, band = STABLE_BAND): ProgressionDirection {
  if (delta > band) return 'growth';
  if (delta < -band) return 'decline';
  return 'stable';
}

/** Build the progression view for one subject. Read-only; never throws. */
export async function buildProgression(pool: Pool, subjectId: string): Promise<Progression> {
  const sid = String(subjectId ?? '').trim();
  const history: EiHistory = await buildEiHistory(pool, sid).catch(
    () =>
      ({
        subject_id: sid,
        assessment_history: { provisioned: false, count: 0, measured_count: 0, runs: [] },
        ei_history: { count: 0, measured_count: 0, snapshots: [] },
        dimension_history: [],
        notes: ['History composition failed — degraded to empty (honest, not fabricated).'],
      }) as EiHistory,
  );
  const notes = [...history.notes];

  const overall = computeOverall(history);
  const dimensions = history.dimension_history.map(computeDimension);

  const growth_areas = dimensions
    .filter((d) => d.status === 'ready' && d.direction === 'growth')
    .map((d) => ({ ei_dimension_id: d.ei_dimension_id, dimension_name: d.dimension_name, net_delta: d.net_delta as number }))
    .sort((a, b) => b.net_delta - a.net_delta);
  const decline_areas = dimensions
    .filter((d) => d.status === 'ready' && d.direction === 'decline')
    .map((d) => ({ ei_dimension_id: d.ei_dimension_id, dimension_name: d.dimension_name, net_delta: d.net_delta as number }))
    .sort((a, b) => a.net_delta - b.net_delta);
  const stable_areas = dimensions
    .filter((d) => d.status === 'ready' && d.direction === 'stable')
    .map((d) => ({ ei_dimension_id: d.ei_dimension_id, dimension_name: d.dimension_name }));
  const insufficient_dimensions = dimensions
    .filter((d) => d.status === 'insufficient_history')
    .map((d) => ({ ei_dimension_id: d.ei_dimension_id, dimension_name: d.dimension_name }));

  let improvement_summary: string;
  if (overall.status !== 'ready') {
    improvement_summary = 'Not enough measured snapshots to assess progression yet (at least two are required).';
  } else {
    const parts: string[] = [`Overall EI shows ${overall.direction} (${overall.net_delta! >= 0 ? '+' : ''}${overall.net_delta} pts).`];
    if (growth_areas.length) parts.push(`${growth_areas.length} dimension(s) improving.`);
    if (decline_areas.length) parts.push(`${decline_areas.length} dimension(s) declining.`);
    if (!growth_areas.length && !decline_areas.length) parts.push('Dimension scores are broadly stable.');
    improvement_summary = parts.join(' ');
  }

  return {
    subject_id: sid,
    overall,
    dimensions,
    rollup: { growth_areas, decline_areas, stable_areas, insufficient_dimensions, improvement_summary },
    notes,
  };
}

function computeOverall(history: EiHistory): OverallProgression {
  // ei_history.snapshots are newest-first; the trend engine sorts ascending.
  const snaps = history.ei_history.snapshots;
  const trend = computeMetricTrend(
    snaps.map((s) => ({ ts: s.created_at, value: s.ei_score })),
    { stableBand: STABLE_BAND, higherIsBetter: true },
  );

  if (trend.status !== 'ready') {
    return {
      status: 'insufficient_history',
      direction: null,
      net_delta: null,
      first: null,
      latest: null,
      snapshots_total: history.ei_history.count,
      snapshots_measured: history.ei_history.measured_count,
      transitions: [],
      trend,
      message:
        history.ei_history.measured_count === 0
          ? 'No measured EI snapshots yet — progression unavailable (not fabricated).'
          : 'Only one measured EI snapshot — at least two are required to show progression (not fabricated).',
    };
  }

  // Build consecutive-step transitions over measured points (ascending).
  const measured = trend.points.filter((p) => p.value != null) as { ts: string; value: number }[];
  const transitions: StepTransition[] = [];
  for (let i = 1; i < measured.length; i++) {
    const delta = round1(measured[i].value - measured[i - 1].value);
    transitions.push({
      from_at: measured[i - 1].ts,
      to_at: measured[i].ts,
      from_score: measured[i - 1].value,
      to_score: measured[i].value,
      delta,
      direction: classify(delta),
    });
  }

  return {
    status: 'ready',
    direction: classify(trend.delta as number),
    net_delta: trend.delta,
    first: trend.first ? { captured_at: trend.first.ts, ei_score: trend.first.value } : null,
    latest: trend.latest ? { captured_at: trend.latest.ts, ei_score: trend.latest.value } : null,
    snapshots_total: history.ei_history.count,
    snapshots_measured: history.ei_history.measured_count,
    transitions,
    trend,
    message: `Overall EI ${classify(trend.delta as number)} by ${Math.abs(trend.delta as number)} point(s) across ${measured.length} measured snapshot(s).`,
  };
}

function computeDimension(series: DimensionHistorySeries): DimensionProgression {
  const trend = computeMetricTrend(
    series.points.map((p) => ({ ts: p.captured_at, value: p.score })),
    { stableBand: STABLE_BAND, higherIsBetter: true },
  );
  if (trend.status !== 'ready') {
    return {
      ei_dimension_id: series.ei_dimension_id,
      dimension_name: series.dimension_name,
      status: 'insufficient_history',
      direction: null,
      net_delta: null,
      measured_count: series.measured_count,
      first_score: trend.first ? trend.first.value : null,
      latest_score: trend.latest ? trend.latest.value : null,
    };
  }
  return {
    ei_dimension_id: series.ei_dimension_id,
    dimension_name: series.dimension_name,
    status: 'ready',
    direction: classify(trend.delta as number),
    net_delta: trend.delta,
    measured_count: series.measured_count,
    first_score: trend.first!.value,
    latest_score: trend.latest!.value,
  };
}
