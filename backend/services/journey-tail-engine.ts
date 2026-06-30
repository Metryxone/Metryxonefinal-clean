/**
 * Task #293 — Journey Tail Completion (engine).
 *
 * Gives three front-half-only persona journeys a real downstream step using EXISTING substrate, all behind
 * the single `journeyTailCompletion` flag (FF_JOURNEY_TAIL_COMPLETION, default OFF). Strictly additive,
 * reversible and honest:
 *   - Parent support-action loop — record a meaningful support action against an OWNED child after viewing
 *     their status, and read it back with status (jt_parent_support_actions). Ownership validated against the
 *     live `children` table by the route layer (children.parent_id = actor).
 *   - Mentor/Coach engagement tail — a post-match check-in / guidance / milestone / next-goal entry on the
 *     shared mentor substrate (jt_mentor_engagements; mentor_profile_id soft-refs the live mentor_profiles,
 *     booking_ref soft-refs mentor_bookings). Mentor and Coach are ONE substrate, two labels.
 *   - Teacher/Counsellor continuation — the stakeholder survey (which dead-ends in the live backend) is given
 *     a live capture (jt_stakeholder_observations) PLUS a downstream view/action: parents see shared
 *     observations for their child, counsellors get a follow-up queue, and follow_up_status transitions
 *     (open → acknowledged → actioned → resolved) surface the effect back.
 *
 * Discipline (mirrors close-the-loop-engine / ecosystem-community):
 *   - Lazy ensureSchema is reached ONLY on flag-ON write paths; every write fn re-asserts the flag BEFORE
 *     ensure-schema (defense in depth — a direct/tooling import cannot create a jt_* table while OFF).
 *   - Reads use a to_regclass PROBE and never run DDL; absent table / error → honest null (null ≠ 0), never 0.
 *   - Demo subjects (@example.com) are EXCLUDED from overview counts so engagement can't self-inflate.
 *   - Never throws on reads; unexpected errors degrade to an honest empty/degraded shape.
 *   - Engagement only. This engine does NOT capture realized outcomes / KPIs / re-measurement — that remains
 *     the Close-the-Loop (#292) machinery's responsibility; we neither rebuild nor duplicate it here.
 */

import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';

export const JOURNEY_TAIL_VERSION = '1.0.0';

// ── Vocabularies (the only authored constants; nothing here fabricates data) ──────────────────────────
export const JT_PARENT_ACTION_TYPES = [
  'acknowledge_status',   // parent has seen & acknowledges the child's current status
  'set_focus_area',       // parent flags a focus area to work on
  'request_mentor',       // parent wants a mentor/coach engagement
  'log_support',          // parent logs a real-world support action taken at home
  'schedule_review',      // parent schedules a follow-up review
] as const;
export type JtParentActionType = typeof JT_PARENT_ACTION_TYPES[number];

export const JT_PARENT_ACTION_STATUS = ['open', 'in_progress', 'done', 'cancelled'] as const;
export type JtParentActionStatus = typeof JT_PARENT_ACTION_STATUS[number];

export const JT_MENTOR_ENGAGEMENT_KINDS = [
  'check_in',         // lightweight post-match touchpoint
  'guidance_note',    // substantive guidance
  'milestone',        // a recognised progress milestone
  'next_session_goal',// goal set for the next session
] as const;
export type JtMentorEngagementKind = typeof JT_MENTOR_ENGAGEMENT_KINDS[number];

export const JT_MENTOR_PROGRESS = ['on_track', 'needs_work', 'stagnant'] as const;

export const JT_OBSERVER_TYPES = ['teacher', 'counsellor', 'school_admin'] as const;
export type JtObserverType = typeof JT_OBSERVER_TYPES[number];

export const JT_FOLLOWUP_STATUS = ['open', 'acknowledged', 'actioned', 'resolved'] as const;
export type JtFollowupStatus = typeof JT_FOLLOWUP_STATUS[number];

// ── Small helpers ─────────────────────────────────────────────────────────────────────────────────────
const s = (v: unknown, max = 4000): string => (v == null ? '' : String(v)).slice(0, max).trim();
const sOrNull = (v: unknown, max = 4000): string | null => {
  const t = s(v, max);
  return t === '' ? null : t;
};
const oneOf = <T extends readonly string[]>(v: unknown, allowed: T, fallback: T[number]): T[number] => {
  const t = s(v).toLowerCase();
  return (allowed as readonly string[]).includes(t) ? (t as T[number]) : fallback;
};
const intOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const isDemoEmail = (email: unknown): boolean => /@example\.com$/i.test(s(email));
const jsonOrEmpty = (v: unknown): Record<string, unknown> => {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
};

/** to_regclass probe — true only when the relation physically exists. Never creates anything. */
async function tableExists(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
    return !!r.rows?.[0]?.reg;
  } catch {
    return false;
  }
}

/** COUNT(*) that returns null on absent/unreadable (null ≠ 0). `where` is a trusted literal fragment. */
async function safeCount(pool: Pool, table: string, where = '', params: unknown[] = []): Promise<number | null> {
  if (!(await tableExists(pool, table))) return null;
  try {
    const r = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table} ${where}`, params);
    const n = r.rows?.[0]?.n;
    return typeof n === 'number' ? n : null;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Lazy schema — reached ONLY on flag-ON writes (routes are flagGate-first AND each write fn re-asserts).
// ────────────────────────────────────────────────────────────────────────────
let schemaReady = false;
export async function ensureJourneyTailSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jt_parent_support_actions (
      id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      parent_id            varchar NOT NULL,
      child_id             varchar NOT NULL,
      action_type          text NOT NULL,
      title                text,
      note                 text,
      status               text NOT NULL DEFAULT 'open',
      source_context       text,
      linked_observation_id uuid,
      is_demo              boolean NOT NULL DEFAULT false,
      created_at           timestamptz NOT NULL DEFAULT now(),
      updated_at           timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_jt_parent_actions_parent ON jt_parent_support_actions(parent_id);
    CREATE INDEX IF NOT EXISTS idx_jt_parent_actions_child  ON jt_parent_support_actions(child_id);

    CREATE TABLE IF NOT EXISTS jt_mentor_engagements (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      mentor_profile_id varchar NOT NULL,
      seeker_id         varchar,
      booking_ref       varchar,
      author_id         varchar NOT NULL,
      author_role       text NOT NULL,
      kind              text NOT NULL,
      note              text,
      progress          text,
      next_goal         text,
      visible_to_seeker boolean NOT NULL DEFAULT true,
      is_demo           boolean NOT NULL DEFAULT false,
      created_at        timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_jt_mentor_eng_mentor ON jt_mentor_engagements(mentor_profile_id);
    CREATE INDEX IF NOT EXISTS idx_jt_mentor_eng_seeker ON jt_mentor_engagements(seeker_id);

    CREATE TABLE IF NOT EXISTS jt_stakeholder_observations (
      id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      child_id           varchar NOT NULL,
      observer_id        varchar,
      observer_type      text NOT NULL,
      observer_name      text,
      organization       text,
      period             text,
      academic           jsonb NOT NULL DEFAULT '{}',
      emotional          jsonb NOT NULL DEFAULT '{}',
      social             jsonb NOT NULL DEFAULT '{}',
      overall_rating     integer,
      strengths          text,
      concerns           text,
      recommendations    text,
      follow_up_required boolean NOT NULL DEFAULT false,
      share_with_parent  boolean NOT NULL DEFAULT false,
      follow_up_status   text NOT NULL DEFAULT 'open',
      is_demo            boolean NOT NULL DEFAULT false,
      created_at         timestamptz NOT NULL DEFAULT now(),
      updated_at         timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_jt_observations_child   ON jt_stakeholder_observations(child_id);
    CREATE INDEX IF NOT EXISTS idx_jt_observations_followup ON jt_stakeholder_observations(follow_up_required);
  `);
  schemaReady = true;
}

type WriteResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; reason: string };

function assertFlag(): { ok: false; reason: string } | null {
  if (!isFlagEnabled('journeyTailCompletion')) return { ok: false, reason: 'flag_off' };
  return null;
}

// ── 1) Parent support-action loop ─────────────────────────────────────────────────────────────────────
export async function recordParentSupportAction(
  pool: Pool,
  input: {
    parentId: string;
    parentEmail?: string | null;
    childId: string;
    actionType: string;
    title?: string | null;
    note?: string | null;
    sourceContext?: string | null;
    linkedObservationId?: string | null;
  },
): Promise<WriteResult<{ id: string; is_demo: boolean }>> {
  const off = assertFlag();
  if (off) return off;
  if (!s(input.parentId) || !s(input.childId)) return { ok: false, reason: 'missing_subject' };
  await ensureJourneyTailSchema(pool);
  const r = await pool.query(
    `INSERT INTO jt_parent_support_actions
       (parent_id, child_id, action_type, title, note, status, source_context, linked_observation_id, is_demo)
     VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$8)
     RETURNING id`,
    [
      s(input.parentId), s(input.childId),
      oneOf(input.actionType, JT_PARENT_ACTION_TYPES, 'log_support'),
      sOrNull(input.title, 200), sOrNull(input.note), sOrNull(input.sourceContext, 120),
      sOrNull(input.linkedObservationId, 64), isDemoEmail(input.parentEmail),
    ],
  );
  return { ok: true, id: r.rows[0].id, is_demo: isDemoEmail(input.parentEmail) };
}

export async function updateParentSupportActionStatus(
  pool: Pool,
  input: { parentId: string; actionId: string; status: string },
): Promise<WriteResult<{ updated: boolean }>> {
  const off = assertFlag();
  if (off) return off;
  await ensureJourneyTailSchema(pool);
  const r = await pool.query(
    `UPDATE jt_parent_support_actions SET status=$1, updated_at=now()
       WHERE id=$2 AND parent_id=$3`,
    [oneOf(input.status, JT_PARENT_ACTION_STATUS, 'open'), s(input.actionId), s(input.parentId)],
  );
  return { ok: true, updated: (r.rowCount ?? 0) > 0 };
}

export async function listParentSupportActions(
  pool: Pool,
  parentId: string,
  childId?: string | null,
): Promise<{ ok: true; actions: any[]; available: boolean }> {
  if (!(await tableExists(pool, 'jt_parent_support_actions'))) {
    return { ok: true, actions: [], available: false };
  }
  try {
    const params: unknown[] = [s(parentId)];
    let where = 'WHERE parent_id=$1';
    if (s(childId)) { params.push(s(childId)); where += ` AND child_id=$${params.length}`; }
    const r = await pool.query(
      `SELECT id, child_id, action_type, title, note, status, source_context, linked_observation_id,
              created_at, updated_at
         FROM jt_parent_support_actions ${where} ORDER BY created_at DESC LIMIT 200`,
      params,
    );
    return { ok: true, actions: r.rows, available: true };
  } catch {
    return { ok: true, actions: [], available: false };
  }
}

// ── 2) Mentor/Coach engagement tail ───────────────────────────────────────────────────────────────────
export async function recordMentorEngagement(
  pool: Pool,
  input: {
    mentorProfileId: string;
    seekerId?: string | null;
    bookingRef?: string | null;
    authorId: string;
    authorRole: string;
    authorEmail?: string | null;
    kind: string;
    note?: string | null;
    progress?: string | null;
    nextGoal?: string | null;
    visibleToSeeker?: boolean;
  },
): Promise<WriteResult<{ id: string; is_demo: boolean }>> {
  const off = assertFlag();
  if (off) return off;
  if (!s(input.mentorProfileId) || !s(input.authorId)) return { ok: false, reason: 'missing_subject' };
  await ensureJourneyTailSchema(pool);
  const r = await pool.query(
    `INSERT INTO jt_mentor_engagements
       (mentor_profile_id, seeker_id, booking_ref, author_id, author_role, kind, note, progress,
        next_goal, visible_to_seeker, is_demo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      s(input.mentorProfileId), sOrNull(input.seekerId, 64), sOrNull(input.bookingRef, 64),
      s(input.authorId), s(input.authorRole, 40) || 'mentor',
      oneOf(input.kind, JT_MENTOR_ENGAGEMENT_KINDS, 'check_in'),
      sOrNull(input.note), input.progress ? oneOf(input.progress, JT_MENTOR_PROGRESS, 'on_track') : null,
      sOrNull(input.nextGoal, 500), input.visibleToSeeker !== false, isDemoEmail(input.authorEmail),
    ],
  );
  return { ok: true, id: r.rows[0].id, is_demo: isDemoEmail(input.authorEmail) };
}

export async function listMentorEngagements(
  pool: Pool,
  input: { mentorProfileId?: string | null; seekerId?: string | null; visibleOnly?: boolean },
): Promise<{ ok: true; engagements: any[]; available: boolean }> {
  if (!(await tableExists(pool, 'jt_mentor_engagements'))) {
    return { ok: true, engagements: [], available: false };
  }
  try {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (s(input.mentorProfileId)) { params.push(s(input.mentorProfileId)); clauses.push(`mentor_profile_id=$${params.length}`); }
    if (s(input.seekerId)) { params.push(s(input.seekerId)); clauses.push(`seeker_id=$${params.length}`); }
    if (input.visibleOnly) clauses.push(`visible_to_seeker=true`);
    if (clauses.length === 0) return { ok: true, engagements: [], available: true };
    const r = await pool.query(
      `SELECT id, mentor_profile_id, seeker_id, booking_ref, author_id, author_role, kind, note,
              progress, next_goal, visible_to_seeker, created_at
         FROM jt_mentor_engagements WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 200`,
      params,
    );
    return { ok: true, engagements: r.rows, available: true };
  } catch {
    return { ok: true, engagements: [], available: false };
  }
}

// ── 3) Teacher/Counsellor continuation ────────────────────────────────────────────────────────────────
export async function recordStakeholderObservation(
  pool: Pool,
  input: {
    childId: string;
    observerId?: string | null;
    observerType: string;
    observerName?: string | null;
    observerEmail?: string | null;
    organization?: string | null;
    period?: string | null;
    academic?: unknown;
    emotional?: unknown;
    social?: unknown;
    overallRating?: unknown;
    strengths?: string | null;
    concerns?: string | null;
    recommendations?: string | null;
    followUpRequired?: boolean;
    shareWithParent?: boolean;
  },
): Promise<WriteResult<{ id: string; is_demo: boolean }>> {
  const off = assertFlag();
  if (off) return off;
  if (!s(input.childId)) return { ok: false, reason: 'missing_subject' };
  await ensureJourneyTailSchema(pool);
  const r = await pool.query(
    `INSERT INTO jt_stakeholder_observations
       (child_id, observer_id, observer_type, observer_name, organization, period,
        academic, emotional, social, overall_rating, strengths, concerns, recommendations,
        follow_up_required, share_with_parent, follow_up_status, is_demo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'open',$16)
     RETURNING id`,
    [
      s(input.childId), sOrNull(input.observerId, 64),
      oneOf(input.observerType, JT_OBSERVER_TYPES, 'teacher'),
      sOrNull(input.observerName, 200), sOrNull(input.organization, 200), sOrNull(input.period, 40),
      JSON.stringify(jsonOrEmpty(input.academic)), JSON.stringify(jsonOrEmpty(input.emotional)),
      JSON.stringify(jsonOrEmpty(input.social)), intOrNull(input.overallRating),
      sOrNull(input.strengths), sOrNull(input.concerns), sOrNull(input.recommendations),
      input.followUpRequired === true, input.shareWithParent === true, isDemoEmail(input.observerEmail),
    ],
  );
  return { ok: true, id: r.rows[0].id, is_demo: isDemoEmail(input.observerEmail) };
}

/** Update follow-up status (the downstream continuation). Caller (route) authorises who may transition. */
export async function updateObservationFollowupStatus(
  pool: Pool,
  input: { observationId: string; status: string; childIds?: string[] },
): Promise<WriteResult<{ updated: boolean }>> {
  const off = assertFlag();
  if (off) return off;
  await ensureJourneyTailSchema(pool);
  const params: unknown[] = [oneOf(input.status, JT_FOLLOWUP_STATUS, 'open'), s(input.observationId)];
  let where = 'WHERE id=$2';
  // Scope to a parent's own children when childIds is provided (parent acknowledging a shared observation).
  if (Array.isArray(input.childIds)) {
    if (input.childIds.length === 0) return { ok: true, updated: false };
    params.push(input.childIds.map((c) => s(c)));
    where += ` AND child_id = ANY($3) AND share_with_parent=true`;
  }
  const r = await pool.query(
    `UPDATE jt_stakeholder_observations SET follow_up_status=$1, updated_at=now() ${where}`,
    params,
  );
  return { ok: true, updated: (r.rowCount ?? 0) > 0 };
}

/** Parent view: observations explicitly shared with the parent, for children they own. */
export async function listObservationsForParent(
  pool: Pool,
  childIds: string[],
): Promise<{ ok: true; observations: any[]; available: boolean }> {
  if (!(await tableExists(pool, 'jt_stakeholder_observations'))) {
    return { ok: true, observations: [], available: false };
  }
  if (!Array.isArray(childIds) || childIds.length === 0) return { ok: true, observations: [], available: true };
  try {
    const r = await pool.query(
      `SELECT id, child_id, observer_type, observer_name, organization, period, academic, emotional, social,
              overall_rating, strengths, concerns, recommendations, follow_up_required, follow_up_status,
              created_at
         FROM jt_stakeholder_observations
        WHERE child_id = ANY($1) AND share_with_parent=true
        ORDER BY created_at DESC LIMIT 200`,
      [childIds.map((c) => s(c))],
    );
    return { ok: true, observations: r.rows, available: true };
  } catch {
    return { ok: true, observations: [], available: false };
  }
}

/** Counsellor follow-up queue: observations flagged for follow-up that are not yet resolved. */
export async function listFollowUpQueue(
  pool: Pool,
  opts: { includeResolved?: boolean } = {},
): Promise<{ ok: true; observations: any[]; available: boolean }> {
  if (!(await tableExists(pool, 'jt_stakeholder_observations'))) {
    return { ok: true, observations: [], available: false };
  }
  try {
    const where = opts.includeResolved
      ? `WHERE follow_up_required=true`
      : `WHERE follow_up_required=true AND follow_up_status <> 'resolved'`;
    const r = await pool.query(
      `SELECT id, child_id, observer_id, observer_type, observer_name, organization, period,
              overall_rating, concerns, recommendations, follow_up_status, share_with_parent, created_at
         FROM jt_stakeholder_observations ${where}
        ORDER BY created_at DESC LIMIT 200`,
    );
    return { ok: true, observations: r.rows, available: true };
  } catch {
    return { ok: true, observations: [], available: false };
  }
}

// ── Overview — honest counts per tail (null ≠ 0; demo excluded) ───────────────────────────────────────
export async function composeJourneyTailOverview(pool: Pool): Promise<any> {
  const notDemo = `WHERE is_demo=false`;
  const [
    parentActions, parentOpen,
    mentorEng,
    observations, followupOpen,
  ] = await Promise.all([
    safeCount(pool, 'jt_parent_support_actions', notDemo),
    safeCount(pool, 'jt_parent_support_actions', `WHERE is_demo=false AND status IN ('open','in_progress')`),
    safeCount(pool, 'jt_mentor_engagements', notDemo),
    safeCount(pool, 'jt_stakeholder_observations', notDemo),
    safeCount(pool, 'jt_stakeholder_observations', `WHERE is_demo=false AND follow_up_required=true AND follow_up_status <> 'resolved'`),
  ]);
  return {
    ok: true,
    version: JOURNEY_TAIL_VERSION,
    read_only: true,
    tails: {
      parent_support: { actions_total: parentActions, actions_open: parentOpen },
      mentor_engagement: { engagements_total: mentorEng },
      teacher_counsellor: { observations_total: observations, follow_up_open: followupOpen },
    },
    note: 'null = substrate absent or unreadable (≠ 0). Demo (@example.com) excluded. Engagement only — outcomes/KPIs remain the Close-the-Loop machinery.',
  };
}
