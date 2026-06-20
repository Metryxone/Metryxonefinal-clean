/**
 * PHASE 4.5 — Career Roadmap Engine.
 *
 * A pure, read-only, never-throws layer that COMPOSES the already-built Career
 * Gap engine (Phase 4.4) and the Career Readiness aggregator (Phase 4.3) into
 * ONE Current → Target career roadmap:
 *
 *   - Milestones            — the prioritized gaps grouped into phased milestones
 *                             (Immediate / Near-Term / Longer-Term) derived from
 *                             the 4.4 now / next / later priority bands.
 *   - Competencies Required — the gapped competencies the target role needs,
 *                             re-shaped from the 4.4 gap envelope (never recomputed).
 *   - Development Plan      — a priority-ordered set of development TARGETS derived
 *                             from each gap (competency + level delta + type). It is
 *                             NEVER a fabricated course/resource (no learning
 *                             catalogue is integrated) — only the gap data, re-shaped.
 *   - Estimated Timeline    — a TRANSPARENT deterministic heuristic
 *                             (gap-points × a published weeks-per-level constant).
 *                             Clearly an ESTIMATE, never a prediction.
 *
 * Honesty contract (non-negotiable, carried from Phase 3/4):
 *   - COMPOSES already-computed gaps + readiness — it NEVER recomputes a score,
 *     never fabricates a milestone, a competency, or a course.
 *   - Coverage (how much we could classify / measure) and Confidence (how
 *     trustworthy the underlying measurement is) are reported as TWO SEPARATE
 *     axes (inherited unchanged from the 4.4 gap envelope), never composited.
 *   - The timeline is a deterministic, fully-disclosed estimate — its basis and a
 *     "not a prediction" disclaimer travel with the number.
 *   - Read-only & never-throws: every source call is guarded; one failing source
 *     degrades its part to an honest empty/unmeasured, never the whole envelope.
 *     ZERO DDL in the compose path — the composed role-readiness path is gated by
 *     a competency-runtime probe so a GET can never trigger schema-creating DDL;
 *     persistence is an explicit POST.
 *   - Outputs are DEVELOPMENTAL SIGNALS ONLY — never hiring/promotion/suitability
 *     predictions (the composed engines' language_policy is surfaced unchanged).
 *
 * Byte-identical flag-OFF is enforced by the route gate (503 before any call here).
 */

import type { Pool } from 'pg';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';
import {
  buildCareerGap,
  prioritizeCareerGaps,
  COMPETENCY_RUNTIME_RELATIONS,
  type CareerGapEnvelope,
  type CareerGapPrioritization,
  type PrioritizedGap,
  type PriorityBand,
  type GapTypeKey,
  type FutureOutlook,
  type CoverageConfidence,
} from './career-gap-engine.js';
import {
  buildCareerReadiness,
  type CareerReadinessEnvelope,
} from './career-readiness-aggregator.js';

export const CAREER_ROADMAP_VERSION = '4.5.0';

/**
 * Transparent timeline heuristic. A one-level competency gap is estimated at this
 * many weeks of focused development. This is a DISCLOSED planning constant, NOT a
 * learned/predicted duration — it travels with every estimate so the number can
 * never be mistaken for a forecast.
 */
export const WEEKS_PER_GAP_LEVEL = 4;

/** Phased milestone ordering — mirrors the 4.4 priority bands. */
export const MILESTONE_BANDS: PriorityBand[] = ['now', 'next', 'later'];

export const MILESTONE_LABELS: Record<PriorityBand, string> = {
  now: 'Immediate Focus',
  next: 'Near-Term Development',
  later: 'Longer-Term Growth',
};

export const MILESTONE_HORIZONS: Record<PriorityBand, string> = {
  now: 'address first',
  next: 'after immediate gaps close',
  later: 'sustained, lower-urgency growth',
};

export interface RoadmapCompetency {
  competency_id: string;
  competency_name: string | null;
  type_key: GapTypeKey | 'unclassified';
  type_label: string;
  required_level: number;
  actual_level: number | null;
  gap: number;
  criticality: string;
  blocking: boolean;
  priority_rank: number;
  priority_band: PriorityBand;
  /** Deterministic development TARGET derived from the gap — never a fabricated course. */
  development_action: string;
  /** gap × WEEKS_PER_GAP_LEVEL (disclosed heuristic). */
  estimated_weeks: number;
}

export interface RoadmapMilestone {
  sequence: number;
  band: PriorityBand;
  label: string;
  horizon: string;
  competencies_required: RoadmapCompetency[];
  competency_count: number;
  total_gap_points: number;
  estimated_weeks: number | null;
  focus: string;
}

export interface RoadmapTimeline {
  measurable: boolean;
  total_estimated_weeks: number | null;
  total_estimated_months: number | null;
  per_band: Record<PriorityBand, number | null>;
  basis: string;
  disclaimer: string;
}

export interface CareerProgression {
  measurable: boolean;
  current: {
    score: number | null;
    band: string | null;
    basis: string;
  };
  target: {
    role_id: string | null;
    role_title: string | null;
    readiness_score: number | null;
    fit_band: string | null;
  };
  /** How ready the subject already is for the target role (role-readiness score). */
  progression_pct: number | null;
  stage: string;
  /** The single highest-priority next move (top prioritized gap), or null. */
  next_step: {
    competency_id: string;
    competency_name: string | null;
    gap: number;
    rationale: string;
  } | null;
  estimated_time_to_target: { weeks: number | null; months: number | null };
  basis: string;
}

export interface CareerRoadmapEnvelope {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  measurable: boolean;
  target_role: CareerGapEnvelope['target_career'];
  progression: CareerProgression;
  milestones: RoadmapMilestone[];
  /** Flat, priority-ordered development plan (every gap as a development target). */
  development_plan: RoadmapCompetency[];
  timeline: RoadmapTimeline;
  summary: {
    total_competencies: number;
    milestone_count: number;
    immediate_count: number;
    most_material: {
      competency_id: string;
      competency_name: string | null;
      gap: number;
    } | null;
  };
  future_outlook: FutureOutlook;
  axes: CoverageConfidence;
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

function bandFromScore(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return 'Unmeasured';
  if (score >= 80) return 'Advanced';
  if (score >= 60) return 'Proficient';
  if (score >= 40) return 'Developing';
  return 'Emerging';
}

/** Deterministic development TARGET — describes WHAT to close, never a course. */
function developmentAction(g: PrioritizedGap): string {
  const name = g.competency_name ?? g.competency_id;
  const effort = g.gap >= 3 ? 'substantial' : g.gap >= 2 ? 'moderate' : 'focused';
  const base = `Develop ${name} (${g.type_label}) — close a ${effort} ${g.gap}-level gap`;
  if (g.blocking) return `${base}; blocking for the target role, address first.`;
  return `${base}.`;
}

function competencyEstimatedWeeks(gap: number): number {
  return Math.max(0, Math.round(gap * WEEKS_PER_GAP_LEVEL));
}

function toRoadmapCompetency(g: PrioritizedGap): RoadmapCompetency {
  return {
    competency_id: g.competency_id,
    competency_name: g.competency_name,
    type_key: g.type_key,
    type_label: g.type_label,
    required_level: 0, // filled by caller from the gap item when available
    actual_level: null,
    gap: g.gap,
    criticality: g.criticality,
    blocking: g.blocking,
    priority_rank: g.rank,
    priority_band: g.priority_band,
    development_action: developmentAction(g),
    estimated_weeks: competencyEstimatedWeeks(g.gap),
  };
}

// ---------------------------------------------------------------------------
// roadmap_generator — milestones + development plan + estimated timeline.
// PURE: re-shapes the 4.4 gap envelope + prioritization; introduces NO new
// scores beyond the fully-disclosed timeline heuristic.
// ---------------------------------------------------------------------------

export function generateRoadmap(
  env: CareerGapEnvelope,
  prioritization?: CareerGapPrioritization,
): { milestones: RoadmapMilestone[]; development_plan: RoadmapCompetency[]; timeline: RoadmapTimeline } {
  const prio = prioritization ?? prioritizeCareerGaps(env);

  // Index the original gap items so we can enrich each prioritized gap with its
  // required/actual levels (re-shape, never recompute).
  const itemById = new Map<string, { required_level: number; actual_level: number | null }>();
  for (const t of Object.keys(env.buckets) as GapTypeKey[]) {
    for (const it of env.buckets[t].items) {
      itemById.set(it.competency_id, { required_level: it.required_level, actual_level: it.actual_level });
    }
  }
  for (const it of env.unclassified) {
    itemById.set(it.competency_id, { required_level: it.required_level, actual_level: it.actual_level });
  }

  const development_plan: RoadmapCompetency[] = prio.items.map((g) => {
    const rc = toRoadmapCompetency(g);
    const orig = itemById.get(g.competency_id);
    if (orig) {
      rc.required_level = orig.required_level;
      rc.actual_level = orig.actual_level;
    }
    return rc;
  });

  const milestones: RoadmapMilestone[] = MILESTONE_BANDS.map((band, idx) => {
    const comps = development_plan.filter((c) => c.priority_band === band);
    const totalGapPoints = round1(comps.reduce((a, c) => a + c.gap, 0));
    const weeks = comps.length ? comps.reduce((a, c) => a + c.estimated_weeks, 0) : null;
    return {
      sequence: idx + 1,
      band,
      label: MILESTONE_LABELS[band],
      horizon: MILESTONE_HORIZONS[band],
      competencies_required: comps,
      competency_count: comps.length,
      total_gap_points: totalGapPoints,
      estimated_weeks: weeks,
      focus:
        comps.length === 0
          ? 'No gaps in this milestone.'
          : band === 'now'
            ? 'Blocking / critical-criticality gaps for the target role.'
            : band === 'next'
              ? 'Sizeable gaps on standard requirements.'
              : 'Minor gaps — sustained, lower-urgency development.',
    };
  });

  // Sequential timeline: total = sum of every competency estimate (focused, one
  // milestone at a time). Fully disclosed heuristic; an estimate, not a prediction.
  const measurable = env.measurable && development_plan.length > 0;
  const totalWeeks = measurable ? development_plan.reduce((a, c) => a + c.estimated_weeks, 0) : null;
  const perBand: Record<PriorityBand, number | null> = {
    now: milestones[0]?.estimated_weeks ?? null,
    next: milestones[1]?.estimated_weeks ?? null,
    later: milestones[2]?.estimated_weeks ?? null,
  };

  const timeline: RoadmapTimeline = {
    measurable,
    total_estimated_weeks: totalWeeks,
    total_estimated_months: totalWeeks == null ? null : round1(totalWeeks / 4.345),
    per_band: perBand,
    basis: `Estimate = sum over gaps of (gap level × ${WEEKS_PER_GAP_LEVEL} weeks/level), assuming sequential, focused development.`,
    disclaimer:
      'A planning ESTIMATE derived from gap size only — NOT a prediction of time-to-readiness; actual effort varies by individual, support, and prior exposure.',
  };

  return { milestones, development_plan, timeline };
}

// ---------------------------------------------------------------------------
// career_progression_engine — Current → Target progression view.
// PURE: composes the 4.3 readiness blocks (current / role) with the 4.4 gap
// prioritization. Never recomputes a score.
// ---------------------------------------------------------------------------

export function assessCareerProgression(
  gapEnv: CareerGapEnvelope,
  prioritization: CareerGapPrioritization,
  readiness: CareerReadinessEnvelope | null,
  timeline: RoadmapTimeline,
): CareerProgression {
  const currentScore = readiness?.current.measurable ? (readiness.current.score ?? null) : null;
  const roleScore = readiness?.role.measurable ? (readiness.role.score ?? null) : null;

  // Progression toward the target = the role-readiness score (how much of the
  // role's requirements the subject already meets). Honest null when unmeasured.
  const progressionPct = roleScore;
  const measurable = gapEnv.measurable && progressionPct != null;

  const topGap = prioritization.items[0] ?? null;
  const next_step = topGap
    ? {
        competency_id: topGap.competency_id,
        competency_name: topGap.competency_name,
        gap: topGap.gap,
        rationale: topGap.rationale,
      }
    : null;

  return {
    measurable,
    current: {
      score: currentScore,
      band: currentScore != null ? bandFromScore(currentScore) : null,
      basis: readiness?.current.measurable
        ? 'present-state readiness (EI overall — composed, not recomputed)'
        : 'present-state readiness not measurable',
    },
    target: {
      role_id: gapEnv.target_career.role_id,
      role_title: gapEnv.target_career.role_title,
      readiness_score: roleScore,
      fit_band:
        (readiness?.role.measurable
          ? (readiness.role.detail as Record<string, unknown> | undefined)?.fit_band
          : null) as string | null ?? null,
    },
    progression_pct: progressionPct,
    stage: bandFromScore(progressionPct),
    next_step,
    estimated_time_to_target: {
      weeks: timeline.total_estimated_weeks,
      months: timeline.total_estimated_months,
    },
    basis: measurable
      ? 'progression = role-readiness score vs the target role (composed from role-readiness-v2); next step = highest-priority gap.'
      : 'progression not measurable — no scored role readiness for the target role.',
  };
}

// ---------------------------------------------------------------------------
// career_roadmap_engine — compose 4.4 gaps + 4.3 readiness for one subject.
// ---------------------------------------------------------------------------

/**
 * Read-only probe for the competency-runtime schema (reuses the 4.4 lockstep
 * relation list). Used to gate the composed readiness path so a GET can NEVER
 * trigger schema-creating DDL (`buildCareerReadiness` → `computeRoleReadinessV2`
 * → the shared Phase-2 engine ensures its schema unconditionally). Returns true
 * ONLY when EVERY runtime relation already exists, so the transitive ensure is a
 * complete no-op. Uses to_regclass so a missing relation degrades to `false`
 * instead of throwing — never DDLs. (`buildCareerGap` self-guards the same way.)
 */
async function competencyRuntimeReady(pool: Pool): Promise<boolean> {
  const probe = await pool
    .query(
      `SELECT count(*)::int AS n
         FROM unnest($1::text[]) AS rel
        WHERE to_regclass('public.' || rel) IS NOT NULL`,
      [COMPETENCY_RUNTIME_RELATIONS as unknown as string[]],
    )
    .catch(() => ({ rows: [{ n: 0 }] }));
  return Number(probe.rows[0]?.n ?? 0) === COMPETENCY_RUNTIME_RELATIONS.length;
}

export async function buildCareerRoadmap(pool: Pool, subjectId: string): Promise<CareerRoadmapEnvelope> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];

  // Compose the 4.4 gap envelope (self-guards the competency-runtime DDL).
  const gapEnv = await buildCareerGap(pool, sid).catch((e) => {
    notes.push(`Career gap composition unavailable: ${e?.message ?? 'error'} (honest empty).`);
    return null as CareerGapEnvelope | null;
  });

  // Compose the 4.3 readiness aggregator ONLY when the competency-runtime schema
  // already exists — buildCareerReadiness reaches computeRoleReadinessV2 which
  // ensures schema unconditionally; gating it keeps the GET path DDL-free.
  let readiness: CareerReadinessEnvelope | null = null;
  const runtimeReady = await competencyRuntimeReady(pool);
  if (!runtimeReady) {
    notes.push(
      'Present-state readiness not composed — competency runtime schema is not initialized (read-only; no schema created).',
    );
  } else {
    readiness = await buildCareerReadiness(pool, sid).catch((e) => {
      notes.push(`Readiness composition unavailable: ${e?.message ?? 'error'} (honest empty).`);
      return null as CareerReadinessEnvelope | null;
    });
  }

  // Degrade to a fully honest empty roadmap if the gap envelope is absent.
  if (!gapEnv) {
    const emptyTimeline: RoadmapTimeline = {
      measurable: false,
      total_estimated_weeks: null,
      total_estimated_months: null,
      per_band: { now: null, next: null, later: null },
      basis: `Estimate = sum over gaps of (gap level × ${WEEKS_PER_GAP_LEVEL} weeks/level).`,
      disclaimer:
        'A planning ESTIMATE derived from gap size only — NOT a prediction of time-to-readiness.',
    };
    return {
      ok: true,
      subject_id: sid,
      version: CAREER_ROADMAP_VERSION,
      generated_at: new Date().toISOString(),
      measurable: false,
      target_role: { role_id: null, role_title: null, source: 'role_readiness_v2 (subject anchor role)' },
      progression: {
        measurable: false,
        current: { score: null, band: null, basis: 'present-state readiness not measurable' },
        target: { role_id: null, role_title: null, readiness_score: null, fit_band: null },
        progression_pct: null,
        stage: 'Unmeasured',
        next_step: null,
        estimated_time_to_target: { weeks: null, months: null },
        basis: 'progression not measurable — no gap composition.',
      },
      milestones: MILESTONE_BANDS.map((band, idx) => ({
        sequence: idx + 1,
        band,
        label: MILESTONE_LABELS[band],
        horizon: MILESTONE_HORIZONS[band],
        competencies_required: [],
        competency_count: 0,
        total_gap_points: 0,
        estimated_weeks: null,
        focus: 'No gaps in this milestone.',
      })),
      development_plan: [],
      timeline: emptyTimeline,
      summary: {
        total_competencies: 0,
        milestone_count: 0,
        immediate_count: 0,
        most_material: null,
      },
      future_outlook: {
        measurable: false,
        composite: null,
        band: null,
        axes: null,
        development_areas: [],
        real_signal_count: 0,
        basis: 'no career-gap composition',
      },
      axes: {
        coverage: { measurable: false, classified_pct: null, detail: 'no measurable career gap' },
        confidence: { band: 'None', value: null, basis: 'not measurable', caps: ['not_measurable'] },
      },
      language_policy: LANGUAGE_POLICY,
      source_versions: { career_roadmap: CAREER_ROADMAP_VERSION },
      notes,
    };
  }

  const prioritization = prioritizeCareerGaps(gapEnv);
  const { milestones, development_plan, timeline } = generateRoadmap(gapEnv, prioritization);
  const progression = assessCareerProgression(gapEnv, prioritization, readiness, timeline);

  const measurable = gapEnv.measurable;
  const immediate_count = milestones.find((m) => m.band === 'now')?.competency_count ?? 0;
  const mm = gapEnv.summary.most_material;

  const source_versions: Record<string, string> = {
    career_roadmap: CAREER_ROADMAP_VERSION,
    ...gapEnv.source_versions,
  };
  if (readiness) source_versions.career_readiness = readiness.version;

  if (!measurable) {
    notes.push('Roadmap not measurable — no scored role gap for the target role (honest empty milestones).');
  }

  return {
    ok: true,
    subject_id: sid,
    version: CAREER_ROADMAP_VERSION,
    generated_at: new Date().toISOString(),
    measurable,
    target_role: gapEnv.target_career,
    progression,
    milestones,
    development_plan,
    timeline,
    summary: {
      total_competencies: development_plan.length,
      milestone_count: milestones.filter((m) => m.competency_count > 0).length,
      immediate_count,
      most_material: mm
        ? { competency_id: mm.competency_id, competency_name: mm.competency_name, gap: mm.gap }
        : null,
    },
    future_outlook: gapEnv.future_outlook,
    axes: gapEnv.axes,
    language_policy: gapEnv.language_policy,
    source_versions,
    notes: [...notes, ...gapEnv.notes],
  };
}

// ---------------------------------------------------------------------------
// Append-only history persistence (explicit POST path only — NEVER on a GET).
// The DDL here is reached ONLY behind the careerRoadmap flag gate.
// ---------------------------------------------------------------------------

export async function ensureCareerRoadmapHistorySchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_roadmap_history (
      id                    BIGSERIAL PRIMARY KEY,
      subject_id            TEXT NOT NULL,
      role_id               TEXT,
      role_title            TEXT,
      measurable            BOOLEAN NOT NULL DEFAULT FALSE,
      progression_pct       NUMERIC,
      total_competencies    INTEGER NOT NULL DEFAULT 0,
      milestone_count       INTEGER NOT NULL DEFAULT 0,
      immediate_count       INTEGER NOT NULL DEFAULT 0,
      total_estimated_weeks INTEGER,
      snapshot              JSONB NOT NULL,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_career_roadmap_history_subject
       ON career_roadmap_history (subject_id, created_at DESC)`,
  );
}

export interface CareerRoadmapHistoryRow {
  id: number;
  subject_id: string;
  role_id: string | null;
  role_title: string | null;
  measurable: boolean;
  progression_pct: number | null;
  total_competencies: number;
  milestone_count: number;
  immediate_count: number;
  total_estimated_weeks: number | null;
  created_at: string;
}

/** Append-only — NEVER updates an existing row. */
export async function persistCareerRoadmapSnapshot(
  pool: Pool,
  env: CareerRoadmapEnvelope,
): Promise<CareerRoadmapHistoryRow> {
  await ensureCareerRoadmapHistorySchema(pool);
  const r = await pool.query(
    `INSERT INTO career_roadmap_history
       (subject_id, role_id, role_title, measurable, progression_pct,
        total_competencies, milestone_count, immediate_count, total_estimated_weeks, snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, subject_id, role_id, role_title, measurable, progression_pct,
               total_competencies, milestone_count, immediate_count,
               total_estimated_weeks, created_at`,
    [
      env.subject_id,
      env.target_role.role_id,
      env.target_role.role_title,
      env.measurable,
      env.progression.progression_pct,
      env.summary.total_competencies,
      env.summary.milestone_count,
      env.summary.immediate_count,
      env.timeline.total_estimated_weeks,
      JSON.stringify(env),
    ],
  );
  return r.rows[0] as CareerRoadmapHistoryRow;
}

/** Read-only history. Uses a to_regclass probe so a GET NEVER triggers DDL —
 *  if no snapshot has ever been taken the table is absent => honest empty. */
export async function listCareerRoadmapHistory(
  pool: Pool,
  subjectId: string,
  limit = 50,
): Promise<{ exists: boolean; count: number; items: CareerRoadmapHistoryRow[] }> {
  const sid = String(subjectId ?? '').trim();
  const probe = await pool
    .query(`SELECT to_regclass('public.career_roadmap_history') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { exists: false, count: 0, items: [] };
  const r = await pool
    .query(
      `SELECT id, subject_id, role_id, role_title, measurable, progression_pct,
              total_competencies, milestone_count, immediate_count,
              total_estimated_weeks, created_at
       FROM career_roadmap_history
       WHERE subject_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [sid, Math.max(1, Math.min(200, limit))],
    )
    .catch(() => ({ rows: [] as CareerRoadmapHistoryRow[] }));
  return { exists: true, count: r.rows.length, items: r.rows as CareerRoadmapHistoryRow[] };
}
