/**
 * PHASE 4.6 — Career Development Engine.
 *
 * A pure, read-only, never-throws layer that COMPOSES the already-built Career
 * Roadmap engine (Phase 4.5 — which itself composes the 4.4 Career Gap engine and
 * the 4.3 Career Readiness aggregator) into a set of PERSONALIZED DEVELOPMENT
 * PLANS, organized into development STREAMS by competency TYPE, plus longitudinal
 * development TRACKING:
 *
 *   - Development streams (one per competency TYPE the product surfaces):
 *       · Behavioral Development     — competency TYPE `behavioral`
 *       · Technical Development      — competency TYPE `technical`
 *       · Cognitive Development      — competency TYPE `cognitive`
 *       · Functional Development     — competency TYPE `functional`
 *       · Future Skills Development  — competency TYPE `future_skills`
 *     Each stream re-shapes the roadmap's already-derived development plan items
 *     (competency + level delta + priority band + a derived development ACTION +
 *     a disclosed weeks estimate) — never recomputed, never fabricated.
 *   - Development tracking — append-only history-backed longitudinal trend per
 *     stream (gap-points closing / widening / stable) vs the most recent prior
 *     snapshot; `insufficient_history` when there is no prior baseline.
 *
 * Taxonomy honesty — "Leadership Development":
 *   The platform competency ontology (`onto_competency_types`) defines exactly five
 *   TYPES: behavioral, cognitive, functional, technical, future_skills. There is NO
 *   standalone `leadership` TYPE. Leadership-relevant competencies (e.g. decision
 *   making, accountability, collaboration) live WITHIN the behavioral / cognitive /
 *   functional types. Rather than fabricate a "Leadership" stream with no real data
 *   backing (which would violate the honesty contract), leadership development is
 *   represented THROUGH those streams; this divergence is surfaced explicitly in
 *   `taxonomy_note`. (Mirrors Phase 4.4, which surfaces the real `cognitive` type
 *   and documents `future_skills` as an honest content gap, never fabricated.)
 *
 * Honesty contract (non-negotiable, carried from Phase 3/4):
 *   - COMPOSES the already-computed roadmap/gaps/readiness — it NEVER recomputes a
 *     score and NEVER fabricates a competency, a development action, or a course.
 *   - Coverage and Confidence are reported as TWO SEPARATE axes (inherited
 *     unchanged from the 4.4/4.5 envelopes), never composited into one number.
 *   - Effort/timeline numbers are the SAME deterministic, fully-disclosed heuristic
 *     the roadmap publishes (gap level × a published weeks-per-level constant) — an
 *     ESTIMATE, never a prediction; the basis + disclaimer travel with the number.
 *   - Read-only & never-throws: the compose path reaches NO schema-creating DDL —
 *     it delegates to buildCareerRoadmap (which gates the competency-runtime path
 *     behind a probe) and reads history via a to_regclass probe; persistence is an
 *     explicit POST.
 *   - Outputs are DEVELOPMENTAL SIGNALS ONLY — never hiring/promotion/suitability
 *     predictions (the composed engines' language_policy is surfaced unchanged).
 *
 * Byte-identical flag-OFF is enforced by the route gate (503 before any call here).
 */

import type { Pool } from 'pg';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';
import {
  GAP_TYPE_ORDER,
  type GapTypeKey,
  type FutureOutlook,
  type CoverageConfidence,
} from './career-gap-engine.js';
import {
  buildCareerRoadmap,
  WEEKS_PER_GAP_LEVEL,
  CAREER_ROADMAP_VERSION,
  type CareerRoadmapEnvelope,
  type RoadmapCompetency,
  type RoadmapTimeline,
  type CareerProgression,
} from './career-roadmap-engine.js';

export const CAREER_DEVELOPMENT_VERSION = '4.6.0';

/** User-facing development-stream labels — keyed on the canonical competency TYPES. */
export const DEV_STREAM_LABELS: Record<GapTypeKey, string> = {
  behavioral: 'Behavioral Development',
  technical: 'Technical Development',
  cognitive: 'Cognitive Development',
  functional: 'Functional Development',
  future_skills: 'Future Skills Development',
};

/** Short, stable purpose line per stream (re-shape only — no scoring). */
export const DEV_STREAM_PURPOSE: Record<GapTypeKey, string> = {
  behavioral:
    'How you work with others and regulate yourself — interpersonal, attitudinal and self-management behaviours.',
  technical: 'Tool, technology and domain-specific technical proficiency.',
  cognitive: 'Reasoning, analysis, judgement and decision-making capabilities.',
  functional: 'Role and process execution capabilities that deliver work outcomes.',
  future_skills: 'Emerging AI / digital-era capabilities (sparsely represented today — an honest content gap).',
};

/**
 * Stable, user-facing ordering of the development streams. Mirrors the product's
 * requested framing (Behavioral, Technical, Functional, Future Skills) and keeps
 * the real `cognitive` TYPE visible. "Leadership" is intentionally absent — it is
 * not a competency TYPE in the ontology (see `taxonomy_note`).
 */
export const DEV_STREAM_ORDER: GapTypeKey[] = [
  'behavioral',
  'technical',
  'functional',
  'cognitive',
  'future_skills',
];

export const TAXONOMY_NOTE =
  'The competency ontology defines five TYPES (behavioral, cognitive, functional, technical, future_skills) — there is NO standalone "Leadership" TYPE. Leadership-relevant competencies live within the behavioral / cognitive / functional streams, so Leadership Development is represented THROUGH those streams rather than fabricated as a separate, unbacked stream.';

export type StreamTrend = 'improving' | 'stable' | 'widening' | 'insufficient_history';

export interface DevelopmentStream {
  type_key: GapTypeKey;
  label: string;
  purpose: string;
  measurable: boolean;
  /** The personalized development plan for this stream (priority-ordered). */
  competencies: RoadmapCompetency[];
  competency_count: number;
  total_gap_points: number;
  estimated_weeks: number | null;
  bands: { now: number; next: number; later: number };
  focus: string;
}

export interface DevelopmentPlan {
  streams: DevelopmentStream[];
  /** Plan items whose competency could not be assigned a TYPE — honest, never forced. */
  unclassified: RoadmapCompetency[];
  summary: {
    total_competencies: number;
    unclassified_count: number;
    active_streams: number;
    total_estimated_weeks: number | null;
    most_material_stream: { type_key: GapTypeKey; label: string; total_gap_points: number } | null;
  };
}

export interface StreamTracking {
  type_key: GapTypeKey;
  label: string;
  current_gap_points: number;
  current_estimated_weeks: number | null;
  prior_gap_points: number | null;
  delta_gap_points: number | null;
  trend: StreamTrend;
}

export interface DevelopmentTracking {
  measurable: boolean;
  has_baseline: boolean;
  streams: StreamTracking[];
  overall: {
    current_gap_points: number;
    prior_gap_points: number | null;
    delta_gap_points: number | null;
    trend: StreamTrend;
  };
  basis: string;
}

export interface CareerDevelopmentEnvelope {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  measurable: boolean;
  target_role: CareerRoadmapEnvelope['target_role'];
  progression: CareerProgression;
  development_plan: DevelopmentPlan;
  tracking: DevelopmentTracking;
  timeline: RoadmapTimeline;
  summary: {
    total_competencies: number;
    active_streams: number;
    total_estimated_weeks: number | null;
    most_material_stream: { type_key: GapTypeKey; label: string; total_gap_points: number } | null;
  };
  future_outlook: FutureOutlook;
  axes: CoverageConfidence;
  taxonomy_note: string;
  language_policy: typeof LANGUAGE_POLICY;
  source_versions: Record<string, string>;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function streamFocus(type: GapTypeKey, comps: RoadmapCompetency[]): string {
  if (comps.length === 0) return `No ${DEV_STREAM_LABELS[type].toLowerCase()} gaps — no development needed in this stream.`;
  const blocking = comps.filter((c) => c.blocking).length;
  const immediate = comps.filter((c) => c.priority_band === 'now').length;
  if (blocking > 0) return `${blocking} blocking gap(s) — prioritise this stream for the target role.`;
  if (immediate > 0) return `${immediate} immediate-focus gap(s) — address early.`;
  return 'Lower-urgency, sustained development.';
}

// ---------------------------------------------------------------------------
// development_plan_generator — organize the roadmap's development plan into the
// five competency-TYPE streams. PURE: re-shapes the 4.5 roadmap envelope; it
// introduces NO new scores (every number is inherited from the roadmap items).
// ---------------------------------------------------------------------------

export function generateDevelopmentPlan(roadmap: CareerRoadmapEnvelope): DevelopmentPlan {
  const plan = roadmap.development_plan ?? [];

  const streams: DevelopmentStream[] = DEV_STREAM_ORDER.map((type) => {
    const comps = plan.filter((c) => c.type_key === type);
    const total_gap_points = round1(comps.reduce((a, c) => a + c.gap, 0));
    const estimated_weeks = comps.length ? comps.reduce((a, c) => a + c.estimated_weeks, 0) : null;
    return {
      type_key: type,
      label: DEV_STREAM_LABELS[type],
      purpose: DEV_STREAM_PURPOSE[type],
      measurable: comps.length > 0,
      competencies: comps,
      competency_count: comps.length,
      total_gap_points,
      estimated_weeks,
      bands: {
        now: comps.filter((c) => c.priority_band === 'now').length,
        next: comps.filter((c) => c.priority_band === 'next').length,
        later: comps.filter((c) => c.priority_band === 'later').length,
      },
      focus: streamFocus(type, comps),
    };
  });

  const unclassified = plan.filter((c) => !GAP_TYPE_ORDER.includes(c.type_key as GapTypeKey));

  const activeStreams = streams.filter((s) => s.competency_count > 0);
  const totalWeeks = activeStreams.length
    ? streams.reduce((a, s) => a + (s.estimated_weeks ?? 0), 0)
    : null;
  const mostMaterial = activeStreams.length
    ? [...activeStreams].sort(
        (a, b) => b.total_gap_points - a.total_gap_points || a.type_key.localeCompare(b.type_key),
      )[0]
    : null;

  return {
    streams,
    unclassified,
    summary: {
      total_competencies: plan.length,
      unclassified_count: unclassified.length,
      active_streams: activeStreams.length,
      total_estimated_weeks: totalWeeks,
      most_material_stream: mostMaterial
        ? { type_key: mostMaterial.type_key, label: mostMaterial.label, total_gap_points: mostMaterial.total_gap_points }
        : null,
    },
  };
}

// ---------------------------------------------------------------------------
// development_tracking — longitudinal trend per stream vs the most recent prior
// snapshot. PURE: compares current stream gap-points against a prior baseline
// (passed in by the engine from append-only history). Honest `insufficient_history`
// when there is no baseline; NEVER fabricates progress.
// ---------------------------------------------------------------------------

function trendFromDelta(delta: number | null): StreamTrend {
  if (delta == null) return 'insufficient_history';
  if (delta < 0) return 'improving'; // gap points closing
  if (delta > 0) return 'widening';
  return 'stable';
}

export function trackDevelopment(
  plan: DevelopmentPlan,
  prior: { measurable: boolean; streams: Record<string, number> } | null,
): DevelopmentTracking {
  const hasBaseline = !!prior;
  const measurable = plan.streams.some((s) => s.measurable);

  const streams: StreamTracking[] = plan.streams.map((s) => {
    const priorPts = prior && Object.prototype.hasOwnProperty.call(prior.streams, s.type_key)
      ? Number(prior.streams[s.type_key])
      : null;
    const priorVal = priorPts != null && Number.isFinite(priorPts) ? priorPts : null;
    const delta = priorVal == null ? null : round1(s.total_gap_points - priorVal);
    return {
      type_key: s.type_key,
      label: s.label,
      current_gap_points: s.total_gap_points,
      current_estimated_weeks: s.estimated_weeks,
      prior_gap_points: priorVal,
      delta_gap_points: delta,
      trend: trendFromDelta(delta),
    };
  });

  const currentTotal = round1(plan.streams.reduce((a, s) => a + s.total_gap_points, 0));
  const priorTotal = prior
    ? round1(
        Object.values(prior.streams)
          .map((v) => Number(v))
          .filter((v) => Number.isFinite(v))
          .reduce((a, v) => a + v, 0),
      )
    : null;
  const overallDelta = priorTotal == null ? null : round1(currentTotal - priorTotal);

  return {
    measurable,
    has_baseline: hasBaseline,
    streams,
    overall: {
      current_gap_points: currentTotal,
      prior_gap_points: priorTotal,
      delta_gap_points: overallDelta,
      trend: trendFromDelta(overallDelta),
    },
    basis: hasBaseline
      ? 'Trend = change in open development gap-points per stream vs the most recent prior snapshot (improving = gaps closing). Developmental signal only.'
      : 'No prior snapshot — baseline only. Capture a snapshot to begin tracking development over time.',
  };
}

// ---------------------------------------------------------------------------
// career_development_engine — compose the 4.5 roadmap into development streams +
// tracking for one subject.
// ---------------------------------------------------------------------------

export async function buildCareerDevelopment(
  pool: Pool,
  subjectId: string,
): Promise<CareerDevelopmentEnvelope> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];

  // Compose the 4.5 roadmap (never-throws; self-gates the competency-runtime DDL
  // and reads readiness behind its own probe — this layer reaches NO DDL).
  const roadmap = await buildCareerRoadmap(pool, sid).catch((e) => {
    notes.push(`Career roadmap composition unavailable: ${e?.message ?? 'error'} (honest empty).`);
    return null as CareerRoadmapEnvelope | null;
  });

  if (!roadmap) {
    const empty = generateDevelopmentPlan(emptyRoadmap(sid));
    const tracking = trackDevelopment(empty, null);
    return {
      ok: true,
      subject_id: sid,
      version: CAREER_DEVELOPMENT_VERSION,
      generated_at: new Date().toISOString(),
      measurable: false,
      target_role: { role_id: null, role_title: null, source: 'role_readiness_v2 (subject anchor role)' },
      progression: emptyProgression(),
      development_plan: empty,
      tracking,
      timeline: emptyTimeline(),
      summary: {
        total_competencies: 0,
        active_streams: 0,
        total_estimated_weeks: null,
        most_material_stream: null,
      },
      future_outlook: emptyFutureOutlook(),
      axes: emptyAxes(),
      taxonomy_note: TAXONOMY_NOTE,
      language_policy: LANGUAGE_POLICY,
      source_versions: { career_development: CAREER_DEVELOPMENT_VERSION },
      notes,
    };
  }

  const development_plan = generateDevelopmentPlan(roadmap);

  // Tracking: read the most recent prior snapshot (read-only; to_regclass probe →
  // never DDL). Per-stream prior gap-points come from the persisted envelope.
  const prior = await fetchLatestDevelopmentBaseline(pool, sid);
  const tracking = trackDevelopment(development_plan, prior);

  const source_versions: Record<string, string> = {
    career_development: CAREER_DEVELOPMENT_VERSION,
    career_roadmap: CAREER_ROADMAP_VERSION,
    ...roadmap.source_versions,
  };

  if (!roadmap.measurable) {
    notes.push('Development plan not measurable — no scored role gap for the target role (honest empty streams).');
  }

  return {
    ok: true,
    subject_id: sid,
    version: CAREER_DEVELOPMENT_VERSION,
    generated_at: new Date().toISOString(),
    measurable: roadmap.measurable,
    target_role: roadmap.target_role,
    progression: roadmap.progression,
    development_plan,
    tracking,
    timeline: roadmap.timeline,
    summary: {
      total_competencies: development_plan.summary.total_competencies,
      active_streams: development_plan.summary.active_streams,
      total_estimated_weeks: development_plan.summary.total_estimated_weeks,
      most_material_stream: development_plan.summary.most_material_stream,
    },
    future_outlook: roadmap.future_outlook,
    axes: roadmap.axes,
    taxonomy_note: TAXONOMY_NOTE,
    language_policy: roadmap.language_policy,
    source_versions,
    notes: [...notes, ...roadmap.notes],
  };
}

// --- honest-empty builders (pure) ------------------------------------------

function emptyTimeline(): RoadmapTimeline {
  return {
    measurable: false,
    total_estimated_weeks: null,
    total_estimated_months: null,
    per_band: { now: null, next: null, later: null },
    basis: `Estimate = sum over gaps of (gap level × ${WEEKS_PER_GAP_LEVEL} weeks/level).`,
    disclaimer: 'A planning ESTIMATE derived from gap size only — NOT a prediction of time-to-readiness.',
  };
}

function emptyProgression(): CareerProgression {
  return {
    measurable: false,
    current: { score: null, band: null, basis: 'present-state readiness not measurable' },
    target: { role_id: null, role_title: null, readiness_score: null, fit_band: null },
    progression_pct: null,
    stage: 'Unmeasured',
    next_step: null,
    estimated_time_to_target: { weeks: null, months: null },
    basis: 'progression not measurable — no development composition.',
  };
}

function emptyFutureOutlook(): FutureOutlook {
  return {
    measurable: false,
    composite: null,
    band: null,
    axes: null,
    development_areas: [],
    real_signal_count: 0,
    basis: 'no career development composition',
  };
}

function emptyAxes(): CoverageConfidence {
  return {
    coverage: { measurable: false, classified_pct: null, detail: 'no measurable career development' },
    confidence: { band: 'None', value: null, basis: 'not measurable', caps: ['not_measurable'] },
  };
}

/** Minimal honest-empty roadmap envelope used only to derive empty streams. */
function emptyRoadmap(sid: string): CareerRoadmapEnvelope {
  return {
    ok: true,
    subject_id: sid,
    version: CAREER_ROADMAP_VERSION,
    generated_at: new Date().toISOString(),
    measurable: false,
    target_role: { role_id: null, role_title: null, source: 'role_readiness_v2 (subject anchor role)' },
    progression: emptyProgression(),
    milestones: [],
    development_plan: [],
    timeline: emptyTimeline(),
    summary: { total_competencies: 0, milestone_count: 0, immediate_count: 0, most_material: null },
    future_outlook: emptyFutureOutlook(),
    axes: emptyAxes(),
    language_policy: LANGUAGE_POLICY,
    source_versions: { career_roadmap: CAREER_ROADMAP_VERSION },
    notes: [],
  };
}

// ---------------------------------------------------------------------------
// Append-only history persistence (explicit POST path only — NEVER on a GET).
// The DDL here is reached ONLY behind the careerDevelopment flag gate.
// ---------------------------------------------------------------------------

export async function ensureCareerDevelopmentHistorySchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_development_history (
      id                    BIGSERIAL PRIMARY KEY,
      subject_id            TEXT NOT NULL,
      role_id               TEXT,
      role_title            TEXT,
      measurable            BOOLEAN NOT NULL DEFAULT FALSE,
      total_competencies    INTEGER NOT NULL DEFAULT 0,
      active_streams        INTEGER NOT NULL DEFAULT 0,
      total_estimated_weeks INTEGER,
      snapshot              JSONB NOT NULL,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_career_development_history_subject
       ON career_development_history (subject_id, created_at DESC)`,
  );
}

export interface CareerDevelopmentHistoryRow {
  id: number;
  subject_id: string;
  role_id: string | null;
  role_title: string | null;
  measurable: boolean;
  total_competencies: number;
  active_streams: number;
  total_estimated_weeks: number | null;
  created_at: string;
}

/** Append-only — NEVER updates an existing row. */
export async function persistCareerDevelopmentSnapshot(
  pool: Pool,
  env: CareerDevelopmentEnvelope,
): Promise<CareerDevelopmentHistoryRow> {
  await ensureCareerDevelopmentHistorySchema(pool);
  const r = await pool.query(
    `INSERT INTO career_development_history
       (subject_id, role_id, role_title, measurable,
        total_competencies, active_streams, total_estimated_weeks, snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, subject_id, role_id, role_title, measurable,
               total_competencies, active_streams, total_estimated_weeks, created_at`,
    [
      env.subject_id,
      env.target_role.role_id,
      env.target_role.role_title,
      env.measurable,
      env.summary.total_competencies,
      env.summary.active_streams,
      env.summary.total_estimated_weeks,
      JSON.stringify(env),
    ],
  );
  return r.rows[0] as CareerDevelopmentHistoryRow;
}

/** Read-only history. Uses a to_regclass probe so a GET NEVER triggers DDL —
 *  if no snapshot has ever been taken the table is absent => honest empty. */
export async function listCareerDevelopmentHistory(
  pool: Pool,
  subjectId: string,
  limit = 50,
): Promise<{ exists: boolean; count: number; items: CareerDevelopmentHistoryRow[] }> {
  const sid = String(subjectId ?? '').trim();
  const probe = await pool
    .query(`SELECT to_regclass('public.career_development_history') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { exists: false, count: 0, items: [] };
  const r = await pool
    .query(
      `SELECT id, subject_id, role_id, role_title, measurable,
              total_competencies, active_streams, total_estimated_weeks, created_at
       FROM career_development_history
       WHERE subject_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [sid, Math.max(1, Math.min(200, limit))],
    )
    .catch(() => ({ rows: [] as CareerDevelopmentHistoryRow[] }));
  return { exists: true, count: r.rows.length, items: r.rows as CareerDevelopmentHistoryRow[] };
}

/**
 * Read-only — the most recent prior snapshot's per-stream gap-points, used as the
 * tracking baseline. to_regclass probe so a GET NEVER triggers DDL; absent table
 * or no prior row => null (honest `insufficient_history`). Reads only the stored
 * envelope JSONB (already-computed) — recomputes nothing.
 */
async function fetchLatestDevelopmentBaseline(
  pool: Pool,
  subjectId: string,
): Promise<{ measurable: boolean; streams: Record<string, number> } | null> {
  const sid = String(subjectId ?? '').trim();
  const probe = await pool
    .query(`SELECT to_regclass('public.career_development_history') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return null;
  const r = await pool
    .query(
      `SELECT measurable, snapshot
         FROM career_development_history
        WHERE subject_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [sid],
    )
    .catch(() => ({ rows: [] as Array<{ measurable: boolean; snapshot: unknown }> }));
  const row = r.rows[0];
  if (!row) return null;
  const snap = (typeof row.snapshot === 'string' ? safeParse(row.snapshot) : row.snapshot) as
    | CareerDevelopmentEnvelope
    | null;
  const streams: Record<string, number> = {};
  for (const s of snap?.development_plan?.streams ?? []) {
    if (s && typeof s.total_gap_points === 'number') streams[s.type_key] = s.total_gap_points;
  }
  return { measurable: !!row.measurable, streams };
}

function safeParse(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
