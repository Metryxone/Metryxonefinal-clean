/**
 * PHASE 4.11 — Career Progression Tracking Engine.
 *
 * A pure, read-only, never-throws layer that COMPOSES the already-accrued
 * append-only history of the prior phases (Phase-4.3 career_readiness_history)
 * plus this phase's own append-only snapshots (growth_tracking) and detected
 * movement events (career_history) into FIVE longitudinal progression
 * dimensions:
 *
 *   Numeric trajectories (Δ first → latest over the available time series):
 *     - Career Growth      — holistic career-index trajectory (readiness+competency+role)
 *     - Readiness Growth   — Δ in present career readiness (Phase-4.3 composite)
 *     - Competency Growth  — Δ in measured competency profile
 *   Event sequences (observed state transitions over time):
 *     - Career Movement    — readiness-band transitions (advancement / regression)
 *     - Role Evolution     — anchor-role transitions
 *
 * Honesty contract (non-negotiable, carried from Phase 3/4):
 *   - COMPOSES already-computed/persisted snapshots — it NEVER recomputes an
 *     upstream score and NEVER fabricates a trend. Growth is a longitudinal
 *     measure: a dimension with FEWER THAN TWO datapoints is honestly
 *     `measurable:false` (you cannot observe change from a single point).
 *   - Coverage (how many declared dimensions have ≥2 real datapoints) and
 *     Confidence (longitudinal strength = how many repeat snapshots back the
 *     series) are reported as TWO SEPARATE axes, never composited.
 *   - DEVELOPMENTAL SIGNALS ONLY — progression describes development over time,
 *     never a hiring/promotion/performance prediction. The composed engines'
 *     LANGUAGE_POLICY is surfaced unchanged.
 *
 * GET-never-writes (strict): the read path (buildCareerProgression + the list*
 * helpers) touches ONLY the three history tables via to_regclass probes and
 * pure SELECTs. It calls NO engine and runs NO DDL. The live engines
 * (buildCareerReadiness + getProfile) are composed ONLY on the explicit POST
 * snapshot write path, behind competencyRuntimeReady(), where ensure-schema is
 * permitted.
 *
 * Byte-identical flag-OFF is enforced by the route gate (503 before any call).
 */

import type { Pool } from 'pg';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';
import { competencyRuntimeReady } from './career-gap-engine.js';
import { getProfile } from './competency-runtime.js';
import { buildCareerReadiness } from './career-readiness-aggregator.js';

export const CAREER_PROGRESSION_VERSION = '4.11.0';

/** Δ threshold (points) below which a numeric trajectory is "stable" not a real
 *  move — keeps measurement noise from reading as growth/decline. */
export const STABLE_BAND = 2;

export type ProgressionKind = 'numeric' | 'event';
export type ProgressionDimensionKey =
  | 'career_growth'
  | 'readiness_growth'
  | 'competency_growth'
  | 'career_movement'
  | 'role_evolution';

export type TrendDirection = 'improving' | 'declining' | 'stable';
export type MovementDirection = 'advancement' | 'regression' | 'lateral';

/** Ordered readiness bands (high → low) for movement-direction adjudication. */
const BAND_RANK: Record<string, number> = {
  Advanced: 4,
  Proficient: 3,
  Developing: 2,
  Emerging: 1,
  Unmeasured: 0,
};

export interface TrendPoint {
  t: string;
  value: number;
}

export interface CoverageAxis {
  measurable: boolean;
  /** ≥2-datapoint coverage for this dimension (datapoints present). */
  datapoints: number;
  detail: string;
}

export interface ConfidenceAxis {
  band: 'None' | 'Low' | 'Moderate' | 'High';
  value: number | null;
  basis: string;
  caps: string[];
}

export interface NumericProgression {
  key: ProgressionDimensionKey;
  label: string;
  kind: 'numeric';
  description: string;
  measurable: boolean;
  first_score: number | null;
  last_score: number | null;
  delta: number | null;
  direction: TrendDirection | null;
  span_days: number | null;
  series: TrendPoint[];
  coverage: CoverageAxis;
  confidence: ConfidenceAxis;
  interpretation: string;
  notes: string[];
}

export interface MovementEvent {
  t: string;
  from: string | null;
  to: string;
  direction: MovementDirection;
}

export interface EventProgression {
  key: ProgressionDimensionKey;
  label: string;
  kind: 'event';
  description: string;
  measurable: boolean;
  transitions: MovementEvent[];
  transition_count: number;
  net_direction: MovementDirection | 'none' | null;
  datapoints: number;
  span_days: number | null;
  coverage: CoverageAxis;
  confidence: ConfidenceAxis;
  interpretation: string;
  notes: string[];
}

export type ProgressionDimension = NumericProgression | EventProgression;

export interface CareerProgressionEnvelope {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  measurable: boolean;
  dimensions: ProgressionDimension[];
  summary: {
    dimensions_total: number;
    dimensions_measurable: number;
    coverage_pct: number;
    overall_trajectory: TrendDirection | 'insufficient_data';
    total_snapshots: number;
    span_days: number | null;
  };
  sources: {
    readiness_history: number;
    growth_tracking: number;
    career_history: number;
  };
  language_policy: typeof LANGUAGE_POLICY;
  notes: string[];
}

const INTERPRETATION = {
  numeric:
    'Developmental trajectory only — describes measured change over time, not a hiring/promotion/performance prediction.',
  event:
    'Developmental movement only — describes observed transitions over time, not a suitability or future-movement prediction.',
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function num(n: unknown): number | null {
  if (n === null || n === undefined || n === '') return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function daysBetween(a: string, b: string): number | null {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return Math.round(Math.abs(tb - ta) / 86_400_000);
}

/** Longitudinal confidence from repeat-snapshot count (NOT a re-derived score).
 *  This is evidence STRENGTH of the trend, surfaced as a separate axis. */
function longitudinalConfidence(datapoints: number): ConfidenceAxis {
  if (datapoints < 2) {
    return {
      band: 'None',
      value: null,
      basis: 'longitudinal confidence requires ≥2 repeat snapshots',
      caps: ['single_datapoint'],
    };
  }
  const band = datapoints >= 5 ? 'High' : datapoints >= 3 ? 'Moderate' : 'Low';
  return {
    band,
    value: null,
    basis: `longitudinal confidence from ${datapoints} repeat snapshot(s)`,
    caps: datapoints < 3 ? ['shallow_history'] : [],
  };
}

/** Build a numeric trajectory dimension from a time-ordered value series. */
function buildNumeric(
  key: ProgressionDimensionKey,
  label: string,
  description: string,
  rawSeries: TrendPoint[],
): NumericProgression {
  const series = [...rawSeries]
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  const datapoints = series.length;
  const measurable = datapoints >= 2;
  const notes: string[] = [];

  if (datapoints === 0) {
    notes.push(`${label} not measurable — no snapshots recorded (honest absence).`);
  } else if (datapoints === 1) {
    notes.push(
      `${label} not measurable — only one snapshot exists; growth needs ≥2 datapoints over time (no trend fabricated).`,
    );
  }

  let first: number | null = null;
  let last: number | null = null;
  let delta: number | null = null;
  let direction: TrendDirection | null = null;
  let spanDays: number | null = null;

  if (measurable) {
    first = round1(series[0].value);
    last = round1(series[series.length - 1].value);
    delta = round1(last - first);
    direction = delta > STABLE_BAND ? 'improving' : delta < -STABLE_BAND ? 'declining' : 'stable';
    spanDays = daysBetween(series[0].t, series[series.length - 1].t);
  }

  return {
    key,
    label,
    kind: 'numeric',
    description,
    measurable,
    first_score: first,
    last_score: last,
    delta,
    direction,
    span_days: spanDays,
    series: series.map((p) => ({ t: p.t, value: round1(p.value) })),
    coverage: {
      measurable,
      datapoints,
      detail: measurable
        ? `${datapoints} datapoints over ${spanDays ?? 0} day(s)`
        : `${datapoints} datapoint(s) — needs ≥2 to measure change`,
    },
    confidence: longitudinalConfidence(datapoints),
    interpretation: INTERPRETATION.numeric,
    notes,
  };
}

/** Build an event dimension from a time-ordered sequence of categorical states.
 *  A transition is emitted only when the state actually changes. */
function buildEvent(
  key: ProgressionDimensionKey,
  label: string,
  description: string,
  states: Array<{ t: string; state: string | null; rank?: number | null }>,
  rankAware: boolean,
): EventProgression {
  const ordered = states
    .filter((s) => s.state != null && s.state !== '')
    .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  const datapoints = ordered.length;
  const measurable = datapoints >= 2;
  const notes: string[] = [];

  if (datapoints === 0) {
    notes.push(`${label} not measurable — no snapshots recorded (honest absence).`);
  } else if (datapoints === 1) {
    notes.push(
      `${label} not measurable — only one observation; a transition needs ≥2 datapoints (none fabricated).`,
    );
  }

  const transitions: MovementEvent[] = [];
  if (measurable) {
    for (let i = 1; i < ordered.length; i += 1) {
      const prev = ordered[i - 1];
      const cur = ordered[i];
      if (cur.state === prev.state) continue;
      let direction: MovementDirection = 'lateral';
      if (rankAware) {
        const rp = num(prev.rank);
        const rc = num(cur.rank);
        if (rp != null && rc != null) {
          direction = rc > rp ? 'advancement' : rc < rp ? 'regression' : 'lateral';
        }
      }
      transitions.push({ t: cur.t, from: prev.state, to: cur.state as string, direction });
    }
  }

  let net: MovementDirection | 'none' | null = null;
  if (measurable) {
    if (transitions.length === 0) {
      net = 'none';
    } else if (rankAware) {
      const adv = transitions.filter((x) => x.direction === 'advancement').length;
      const reg = transitions.filter((x) => x.direction === 'regression').length;
      net = adv > reg ? 'advancement' : reg > adv ? 'regression' : 'lateral';
    } else {
      net = 'lateral';
    }
  }

  const spanDays = measurable ? daysBetween(ordered[0].t, ordered[ordered.length - 1].t) : null;

  return {
    key,
    label,
    kind: 'event',
    description,
    measurable,
    transitions,
    transition_count: transitions.length,
    net_direction: net,
    datapoints,
    span_days: spanDays,
    coverage: {
      measurable,
      datapoints,
      detail: measurable
        ? `${datapoints} observations, ${transitions.length} transition(s) over ${spanDays ?? 0} day(s)`
        : `${datapoints} observation(s) — needs ≥2 to detect a transition`,
    },
    confidence: longitudinalConfidence(datapoints),
    interpretation: INTERPRETATION.event,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Read-only history loaders (to_regclass probe → pure SELECT; NEVER DDL).
// ---------------------------------------------------------------------------

interface ReadinessHistoryPoint {
  t: string;
  overall_score: number | null;
  overall_band: string | null;
  role_score: number | null;
  role_id: string | null;
  role_title: string | null;
}

async function readReadinessHistory(pool: Pool, sid: string): Promise<ReadinessHistoryPoint[]> {
  const probe = await pool
    .query(`SELECT to_regclass('public.career_readiness_history') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return [];
  const r = await pool
    .query(
      `SELECT created_at,
              overall_score,
              overall_band,
              role_score,
              snapshot->'role'->'detail'->>'role_id'    AS role_id,
              snapshot->'role'->'detail'->>'role_title' AS role_title
         FROM career_readiness_history
        WHERE subject_id = $1
        ORDER BY created_at ASC`,
      [sid],
    )
    .catch(() => ({ rows: [] as any[] }));
  return (r.rows as any[]).map((row) => ({
    t: new Date(row.created_at).toISOString(),
    overall_score: num(row.overall_score),
    overall_band: row.overall_band ?? null,
    role_score: num(row.role_score),
    role_id: row.role_id ?? null,
    role_title: row.role_title ?? null,
  }));
}

export interface GrowthTrackingRow {
  id: number;
  subject_id: string;
  career_index: number | null;
  readiness_score: number | null;
  competency_score: number | null;
  role_score: number | null;
  future_score: number | null;
  growth_headroom: number | null;
  overall_band: string | null;
  role_id: string | null;
  role_title: string | null;
  measurable: boolean;
  created_at: string;
}

export async function listGrowthTracking(
  pool: Pool,
  subjectId: string,
  limit = 200,
): Promise<{ exists: boolean; count: number; items: GrowthTrackingRow[] }> {
  const sid = String(subjectId ?? '').trim();
  const probe = await pool
    .query(`SELECT to_regclass('public.growth_tracking') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { exists: false, count: 0, items: [] };
  const r = await pool
    .query(
      `SELECT id, subject_id, career_index, readiness_score, competency_score,
              role_score, future_score, growth_headroom, overall_band,
              role_id, role_title, measurable, created_at
         FROM growth_tracking
        WHERE subject_id = $1
        ORDER BY created_at ASC
        LIMIT $2`,
      [sid, Math.max(1, Math.min(500, limit))],
    )
    .catch(() => ({ rows: [] as any[] }));
  const items = (r.rows as any[]).map((row) => ({
    id: Number(row.id),
    subject_id: String(row.subject_id),
    career_index: num(row.career_index),
    readiness_score: num(row.readiness_score),
    competency_score: num(row.competency_score),
    role_score: num(row.role_score),
    future_score: num(row.future_score),
    growth_headroom: num(row.growth_headroom),
    overall_band: row.overall_band ?? null,
    role_id: row.role_id ?? null,
    role_title: row.role_title ?? null,
    measurable: row.measurable === true,
    created_at: new Date(row.created_at).toISOString(),
  }));
  return { exists: true, count: items.length, items };
}

export interface CareerHistoryRow {
  id: number;
  subject_id: string;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  from_score: number | null;
  to_score: number | null;
  delta: number | null;
  direction: string | null;
  detail: Record<string, unknown> | null;
  detected_at: string;
  created_at: string;
}

export async function listCareerHistory(
  pool: Pool,
  subjectId: string,
  limit = 200,
): Promise<{ exists: boolean; count: number; items: CareerHistoryRow[] }> {
  const sid = String(subjectId ?? '').trim();
  const probe = await pool
    .query(`SELECT to_regclass('public.career_history') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { exists: false, count: 0, items: [] };
  const r = await pool
    .query(
      `SELECT id, subject_id, event_type, from_value, to_value, from_score,
              to_score, delta, direction, detail, detected_at, created_at
         FROM career_history
        WHERE subject_id = $1
        ORDER BY detected_at DESC, id DESC
        LIMIT $2`,
      [sid, Math.max(1, Math.min(500, limit))],
    )
    .catch(() => ({ rows: [] as any[] }));
  const items = (r.rows as any[]).map((row) => ({
    id: Number(row.id),
    subject_id: String(row.subject_id),
    event_type: String(row.event_type),
    from_value: row.from_value ?? null,
    to_value: row.to_value ?? null,
    from_score: num(row.from_score),
    to_score: num(row.to_score),
    delta: num(row.delta),
    direction: row.direction ?? null,
    detail: typeof row.detail === 'string' ? safeJson(row.detail) : (row.detail ?? null),
    detected_at: new Date(row.detected_at).toISOString(),
    created_at: new Date(row.created_at).toISOString(),
  }));
  return { exists: true, count: items.length, items };
}

function safeJson(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Engine — compose the history series into five progression dimensions.
// (READ-ONLY: history-table SELECTs only, no engine calls, no DDL.)
// ---------------------------------------------------------------------------

export async function buildCareerProgression(
  pool: Pool,
  subjectId: string,
): Promise<CareerProgressionEnvelope> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];

  const [readiness, growth, history] = await Promise.all([
    readReadinessHistory(pool, sid),
    listGrowthTracking(pool, sid, 200),
    listCareerHistory(pool, sid, 200),
  ]);

  // ----- Numeric series (merge accrued readiness history + growth snapshots) -
  const readinessSeries: TrendPoint[] = [
    ...readiness.filter((p) => p.overall_score != null).map((p) => ({ t: p.t, value: p.overall_score as number })),
    ...growth.items
      .filter((g) => g.readiness_score != null)
      .map((g) => ({ t: g.created_at, value: g.readiness_score as number })),
  ];
  const careerSeries: TrendPoint[] = growth.items
    .filter((g) => g.career_index != null)
    .map((g) => ({ t: g.created_at, value: g.career_index as number }));
  const competencySeries: TrendPoint[] = growth.items
    .filter((g) => g.competency_score != null)
    .map((g) => ({ t: g.created_at, value: g.competency_score as number }));

  const careerGrowth = buildNumeric(
    'career_growth',
    'Career Growth',
    'Holistic career-index trajectory (mean of present readiness, measured competency and role readiness) over time.',
    careerSeries,
  );
  const readinessGrowth = buildNumeric(
    'readiness_growth',
    'Readiness Growth',
    'Change in present career-readiness (Phase-4.3 composite) over the recorded snapshots.',
    readinessSeries,
  );
  const competencyGrowth = buildNumeric(
    'competency_growth',
    'Competency Growth',
    'Change in the measured competency profile over the recorded snapshots.',
    competencySeries,
  );

  // ----- Event series: band movement + role evolution -----------------------
  const bandStates = [
    ...readiness
      .filter((p) => p.overall_band)
      .map((p) => ({ t: p.t, state: p.overall_band, rank: BAND_RANK[p.overall_band as string] ?? null })),
    ...growth.items
      .filter((g) => g.overall_band)
      .map((g) => ({ t: g.created_at, state: g.overall_band, rank: BAND_RANK[g.overall_band as string] ?? null })),
  ];
  const careerMovement = buildEvent(
    'career_movement',
    'Career Movement',
    'Readiness-band transitions over time (advancement / regression / lateral).',
    bandStates,
    true,
  );

  const roleStates = [
    ...readiness
      .filter((p) => p.role_id)
      .map((p) => ({ t: p.t, state: p.role_id, label: p.role_title })),
    ...growth.items
      .filter((g) => g.role_id)
      .map((g) => ({ t: g.created_at, state: g.role_id, label: g.role_title })),
  ];
  // Role transitions are lateral by nature (no rank ordering across roles).
  const roleEvolution = buildEvent(
    'role_evolution',
    'Role Evolution',
    'Anchor-role transitions over time.',
    roleStates.map((r) => ({ t: r.t, state: r.state, rank: null })),
    false,
  );

  const dimensions: ProgressionDimension[] = [
    careerGrowth,
    readinessGrowth,
    competencyGrowth,
    careerMovement,
    roleEvolution,
  ];

  // Distinct timeline points across all sources.
  const allTimes = new Set<string>([
    ...readiness.map((p) => p.t),
    ...growth.items.map((g) => g.created_at),
  ]);
  const sortedTimes = [...allTimes].sort((a, b) => Date.parse(a) - Date.parse(b));
  const totalSnapshots = sortedTimes.length;
  const spanDays =
    sortedTimes.length >= 2 ? daysBetween(sortedTimes[0], sortedTimes[sortedTimes.length - 1]) : null;

  const measurableDims = dimensions.filter((d) => d.measurable);
  const overallTrajectory: TrendDirection | 'insufficient_data' = careerGrowth.measurable
    ? (careerGrowth.direction as TrendDirection)
    : readinessGrowth.measurable
      ? (readinessGrowth.direction as TrendDirection)
      : 'insufficient_data';

  if (totalSnapshots === 0) {
    notes.push(
      'No progression history exists for this subject — record snapshots over time to measure growth (nothing fabricated).',
    );
  } else if (totalSnapshots === 1) {
    notes.push(
      'Only one snapshot exists — progression is longitudinal and needs ≥2 datapoints; trajectories remain unmeasured (no trend fabricated).',
    );
  }

  return {
    ok: true,
    subject_id: sid,
    version: CAREER_PROGRESSION_VERSION,
    generated_at: new Date().toISOString(),
    measurable: measurableDims.length > 0,
    dimensions,
    summary: {
      dimensions_total: dimensions.length,
      dimensions_measurable: measurableDims.length,
      coverage_pct: dimensions.length
        ? Math.round((measurableDims.length / dimensions.length) * 100)
        : 0,
      overall_trajectory: overallTrajectory,
      total_snapshots: totalSnapshots,
      span_days: spanDays,
    },
    sources: {
      readiness_history: readiness.length,
      growth_tracking: growth.count,
      career_history: history.count,
    },
    language_policy: LANGUAGE_POLICY,
    notes,
  };
}

/** Read-only combined timeline view (merged + ordered points + events). */
export async function buildCareerProgressionTimeline(
  pool: Pool,
  subjectId: string,
): Promise<{
  subject_id: string;
  version: string;
  generated_at: string;
  growth_tracking: GrowthTrackingRow[];
  events: CareerHistoryRow[];
  readiness_history_points: number;
}> {
  const sid = String(subjectId ?? '').trim();
  const [growth, history, readiness] = await Promise.all([
    listGrowthTracking(pool, sid, 200),
    listCareerHistory(pool, sid, 200),
    readReadinessHistory(pool, sid),
  ]);
  return {
    subject_id: sid,
    version: CAREER_PROGRESSION_VERSION,
    generated_at: new Date().toISOString(),
    growth_tracking: growth.items,
    events: history.items,
    readiness_history_points: readiness.length,
  };
}

// ---------------------------------------------------------------------------
// Append-only persistence (explicit POST write path ONLY — never on a GET).
// The DDL here is reached ONLY behind the careerProgression flag gate.
// ---------------------------------------------------------------------------

export async function ensureCareerProgressionSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS growth_tracking (
      id              BIGSERIAL PRIMARY KEY,
      subject_id      TEXT NOT NULL,
      career_index    NUMERIC,
      readiness_score NUMERIC,
      competency_score NUMERIC,
      role_score      NUMERIC,
      future_score    NUMERIC,
      growth_headroom NUMERIC,
      overall_band    TEXT,
      role_id         TEXT,
      role_title      TEXT,
      measurable      BOOLEAN NOT NULL DEFAULT FALSE,
      snapshot        JSONB NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_growth_tracking_subject
       ON growth_tracking (subject_id, created_at DESC)`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_history (
      id          BIGSERIAL PRIMARY KEY,
      subject_id  TEXT NOT NULL,
      event_type  TEXT NOT NULL,
      from_value  TEXT,
      to_value    TEXT,
      from_score  NUMERIC,
      to_score    NUMERIC,
      delta       NUMERIC,
      direction   TEXT,
      detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
      detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_career_history_subject
       ON career_history (subject_id, detected_at DESC)`,
  );
}

export interface SnapshotResult {
  ok: boolean;
  subject_id: string;
  measurable: boolean;
  growth_tracking_id: number | null;
  events_detected: CareerHistoryRow[];
  point: {
    career_index: number | null;
    readiness_score: number | null;
    competency_score: number | null;
    role_score: number | null;
    future_score: number | null;
    growth_headroom: number | null;
    overall_band: string | null;
    role_id: string | null;
    role_title: string | null;
  };
  notes: string[];
}

/**
 * Capture a progression snapshot (WRITE path): composes the live Phase-4.3
 * readiness aggregator + competency runtime to compute the current career
 * point, appends ONE append-only growth_tracking row, and diffs against the
 * previous snapshot to append any career_history movement events (band change,
 * role evolution). Composes already-computed scores — never recomputes them.
 */
export async function persistCareerProgressionSnapshot(
  pool: Pool,
  subjectId: string,
): Promise<SnapshotResult> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];
  await ensureCareerProgressionSchema(pool);

  const runtimeReady = await competencyRuntimeReady(pool);
  let readinessOverall: number | null = null;
  let readinessBand: string | null = null;
  let currentScore: number | null = null;
  let futureScore: number | null = null;
  let roleScore: number | null = null;
  let growthHeadroom: number | null = null;
  let roleId: string | null = null;
  let roleTitle: string | null = null;
  let competencyScore: number | null = null;
  let envSnapshot: Record<string, unknown> = {};

  if (!runtimeReady) {
    notes.push(
      'Snapshot captured with no measurable point — competency runtime schema not initialized (honest empty; nothing fabricated).',
    );
  } else {
    const readiness = await buildCareerReadiness(pool, sid).catch((e) => {
      notes.push(`Career readiness unavailable: ${e?.message ?? 'error'} (honest empty).`);
      return null;
    });
    const profile = await getProfile(pool, sid).catch((e) => {
      notes.push(`Competency profile unavailable: ${e?.message ?? 'error'} (honest empty).`);
      return null;
    });

    if (readiness) {
      readinessOverall = readiness.overall?.measurable ? num(readiness.overall.score) : null;
      readinessBand = readiness.overall?.measurable ? (readiness.overall.band ?? null) : null;
      currentScore = readiness.current?.measurable ? num(readiness.current.score) : null;
      futureScore = readiness.future?.measurable ? num(readiness.future.score) : null;
      roleScore = readiness.role?.measurable ? num(readiness.role.score) : null;
      growthHeadroom = readiness.growth?.measurable ? num(readiness.growth.score) : null;
      const roleDetail = (readiness.role?.detail ?? {}) as Record<string, unknown>;
      roleId = roleDetail.role_id != null ? String(roleDetail.role_id) : null;
      roleTitle = roleDetail.role_title != null ? String(roleDetail.role_title) : null;
      envSnapshot = readiness as unknown as Record<string, unknown>;
    }
    if (profile) {
      competencyScore = profile.measured ? num(profile.overall_score) : null;
    }
  }

  // Career index = mean of the present-position measures that ARE measurable.
  const indexParts = [readinessOverall, competencyScore, roleScore].filter(
    (x): x is number => x != null,
  );
  const careerIndex = indexParts.length
    ? round1(indexParts.reduce((a, b) => a + b, 0) / indexParts.length)
    : null;

  const measurable =
    careerIndex != null ||
    readinessOverall != null ||
    competencyScore != null ||
    roleScore != null;

  // Previous snapshot (for diff). Read-only.
  const prev = await pool
    .query(
      `SELECT overall_band, role_id, role_title, readiness_score
         FROM growth_tracking WHERE subject_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [sid],
    )
    .catch(() => ({ rows: [] as any[] }));
  const prevRow = (prev.rows as any[])[0] ?? null;

  const ins = await pool.query(
    `INSERT INTO growth_tracking
       (subject_id, career_index, readiness_score, competency_score, role_score,
        future_score, growth_headroom, overall_band, role_id, role_title,
        measurable, snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id, created_at`,
    [
      sid,
      careerIndex,
      readinessOverall,
      competencyScore,
      roleScore,
      futureScore,
      growthHeadroom,
      readinessBand,
      roleId,
      roleTitle,
      measurable,
      JSON.stringify({
        career_index: careerIndex,
        readiness: { score: readinessOverall, band: readinessBand },
        current: currentScore,
        future: futureScore,
        role: { score: roleScore, role_id: roleId, role_title: roleTitle },
        growth_headroom: growthHeadroom,
        competency: competencyScore,
        source: envSnapshot,
      }),
    ],
  );
  const growthTrackingId = Number(ins.rows[0].id);
  const detectedAt = new Date(ins.rows[0].created_at).toISOString();

  // Diff vs previous snapshot → append career_history events (movement only).
  const events: CareerHistoryRow[] = [];
  if (prevRow) {
    // Readiness band change (Career Movement).
    if (readinessBand && prevRow.overall_band && readinessBand !== prevRow.overall_band) {
      const fromRank = BAND_RANK[prevRow.overall_band] ?? 0;
      const toRank = BAND_RANK[readinessBand] ?? 0;
      const direction =
        toRank > fromRank ? 'advancement' : toRank < fromRank ? 'regression' : 'lateral';
      events.push(
        await appendEvent(pool, sid, {
          event_type: 'readiness_band_change',
          from_value: prevRow.overall_band,
          to_value: readinessBand,
          from_score: num(prevRow.readiness_score),
          to_score: readinessOverall,
          delta:
            readinessOverall != null && num(prevRow.readiness_score) != null
              ? round1(readinessOverall - (num(prevRow.readiness_score) as number))
              : null,
          direction,
          detail: { dimension: 'career_movement' },
          detected_at: detectedAt,
        }),
      );
    }
    // Role evolution.
    if (roleId && prevRow.role_id && roleId !== prevRow.role_id) {
      events.push(
        await appendEvent(pool, sid, {
          event_type: 'role_evolution',
          from_value: prevRow.role_title ?? prevRow.role_id,
          to_value: roleTitle ?? roleId,
          from_score: null,
          to_score: null,
          delta: null,
          direction: 'lateral',
          detail: { dimension: 'role_evolution', from_role_id: prevRow.role_id, to_role_id: roleId },
          detected_at: detectedAt,
        }),
      );
    }
  } else if (measurable) {
    notes.push('First snapshot recorded — baseline established; growth will be measurable from the next snapshot.');
  }

  return {
    ok: true,
    subject_id: sid,
    measurable,
    growth_tracking_id: growthTrackingId,
    events_detected: events,
    point: {
      career_index: careerIndex,
      readiness_score: readinessOverall,
      competency_score: competencyScore,
      role_score: roleScore,
      future_score: futureScore,
      growth_headroom: growthHeadroom,
      overall_band: readinessBand,
      role_id: roleId,
      role_title: roleTitle,
    },
    notes,
  };
}

interface AppendEventInput {
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  from_score: number | null;
  to_score: number | null;
  delta: number | null;
  direction: string;
  detail: Record<string, unknown>;
  detected_at: string;
}

async function appendEvent(
  pool: Pool,
  sid: string,
  e: AppendEventInput,
): Promise<CareerHistoryRow> {
  const r = await pool.query(
    `INSERT INTO career_history
       (subject_id, event_type, from_value, to_value, from_score, to_score,
        delta, direction, detail, detected_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
     RETURNING id, subject_id, event_type, from_value, to_value, from_score,
               to_score, delta, direction, detail, detected_at, created_at`,
    [
      sid,
      e.event_type,
      e.from_value,
      e.to_value,
      e.from_score,
      e.to_score,
      e.delta,
      e.direction,
      JSON.stringify(e.detail ?? {}),
      e.detected_at,
    ],
  );
  const row = r.rows[0];
  return {
    id: Number(row.id),
    subject_id: String(row.subject_id),
    event_type: String(row.event_type),
    from_value: row.from_value ?? null,
    to_value: row.to_value ?? null,
    from_score: num(row.from_score),
    to_score: num(row.to_score),
    delta: num(row.delta),
    direction: row.direction ?? null,
    detail: typeof row.detail === 'string' ? safeJson(row.detail) : (row.detail ?? null),
    detected_at: new Date(row.detected_at).toISOString(),
    created_at: new Date(row.created_at).toISOString(),
  };
}
