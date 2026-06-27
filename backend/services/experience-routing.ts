/**
 * MX-302A — Career Launchpad & Experience Routing (backend, pure + persistence)
 * ----------------------------------------------------------------------------
 * A pure, deterministic Career Stage → Experience routing map plus a
 * backward-compat deriver for users who have no stored stage. Mirrors the
 * frontend engine (frontend/src/lib/career/experienceRouting.ts) one-for-one.
 *
 * All four experiences now map to REAL dedicated surfaces: Career Launchpad
 * (fresher-hub), Command Center (dashboard), Leadership Studio
 * (leadership-studio) and Executive Studio (executive-studio). Each is flagged
 * `available: true`. The senior/executive studios are unlocked only for the
 * stages that map to them (see `allowedExperiences`).
 *
 * Persistence: the canonical career_stage lives on the EXISTING
 * career_seeker_profiles table (one user = one record). The lazy ensure-schema
 * mirror below applies the additive column ONLY on the flag-ON code path, so
 * flag-OFF is byte-identical incl. schema.
 */
import type { Pool } from 'pg';

export type CareerStage =
  | 'student'
  | 'graduate'
  | 'postgraduate'
  | 'internship-seeker'
  | 'early-career'
  | 'mid-career'
  | 'senior-leadership'
  | 'executive';

export type ExperienceId =
  | 'launchpad'
  | 'command-center'
  | 'leadership-studio'
  | 'executive-studio';

export const CAREER_STAGES: { id: CareerStage; label: string }[] = [
  { id: 'student', label: 'Student' },
  { id: 'graduate', label: 'Graduate' },
  { id: 'postgraduate', label: 'Postgraduate' },
  { id: 'internship-seeker', label: 'Internship Seeker' },
  { id: 'early-career', label: 'Early-Career' },
  { id: 'mid-career', label: 'Mid-Career' },
  { id: 'senior-leadership', label: 'Senior / Leadership' },
  { id: 'executive', label: 'Executive' },
];

const STAGE_IDS = new Set<string>(CAREER_STAGES.map((s) => s.id));
export function isCareerStage(v: unknown): v is CareerStage {
  return typeof v === 'string' && STAGE_IDS.has(v);
}

export interface ExperienceConfig {
  id: ExperienceId;
  label: string;
  /** Tab id within CareerBuilderPage this experience lands on. */
  targetTab: string;
  /** True when a dedicated real surface exists; false → routes to nearest surface. */
  available: boolean;
  note?: string;
}

export const EXPERIENCES: Record<ExperienceId, ExperienceConfig> = {
  'launchpad': {
    id: 'launchpad',
    label: 'Career Launchpad',
    targetTab: 'fresher-hub',
    available: true,
  },
  'command-center': {
    id: 'command-center',
    label: 'Career Command Center',
    targetTab: 'dashboard',
    available: true,
  },
  'leadership-studio': {
    id: 'leadership-studio',
    label: 'Leadership Studio',
    targetTab: 'leadership-studio',
    available: true,
  },
  'executive-studio': {
    id: 'executive-studio',
    label: 'Executive Studio',
    targetTab: 'executive-studio',
    available: true,
  },
};

/** Pure, deterministic Career Stage → Experience map. */
export const STAGE_TO_EXPERIENCE: Record<CareerStage, ExperienceId> = {
  'student': 'launchpad',
  'graduate': 'launchpad',
  'postgraduate': 'launchpad',
  'internship-seeker': 'launchpad',
  'early-career': 'launchpad',
  'mid-career': 'command-center',
  'senior-leadership': 'leadership-studio',
  'executive': 'executive-studio',
};

/** A representative canonical stage for an experience, used when the switcher
 *  updates the stored stage to reflect a deliberately-chosen experience. */
export const EXPERIENCE_TO_STAGE: Record<ExperienceId, CareerStage> = {
  'launchpad': 'early-career',
  'command-center': 'mid-career',
  'leadership-studio': 'senior-leadership',
  'executive-studio': 'executive',
};

export function isExperienceId(v: unknown): v is ExperienceId {
  return typeof v === 'string' && v in EXPERIENCES;
}

export function resolveExperience(stage: CareerStage): ExperienceConfig {
  return EXPERIENCES[STAGE_TO_EXPERIENCE[stage]];
}

/**
 * Experiences a user is ALLOWED to switch between, given their stage. Launchpad
 * and Command Center are universally accessible base surfaces; senior/executive
 * stages additionally unlock their named (coming-soon) experience.
 */
export function allowedExperiences(stage: CareerStage | null): ExperienceConfig[] {
  const base: ExperienceId[] = ['launchpad', 'command-center'];
  if (stage === 'senior-leadership' || stage === 'executive') base.push('leadership-studio');
  if (stage === 'executive') base.push('executive-studio');
  // Dedupe preserving order.
  const seen = new Set<ExperienceId>();
  return base.filter((id) => (seen.has(id) ? false : (seen.add(id), true))).map((id) => EXPERIENCES[id]);
}

export interface DeriveSignals {
  /** Years of professional experience, if known. */
  yearsExp?: number | null;
  /** Free-text seniority / title hint (e.g. "Senior Engineer", "VP"). */
  seniority?: string | null;
  /** Platform role (e.g. "student"). */
  role?: string | null;
  /** Whether the profile has any work-experience entries. */
  hasExperience?: boolean | null;
}

const SENIOR_HINT = /\b(senior|lead|principal|head|manager|director|architect)\b/i;
const EXEC_HINT = /\b(chief|c[etfo]o|cxo|vp|vice[\s-]?president|founder|partner|president|executive)\b/i;

/**
 * Backward-compat deriver: best-effort Career Stage from existing profile
 * signals. Returns null when nothing is derivable — callers then default to the
 * current Command Center landing (no regression).
 */
export function deriveStage(signals: DeriveSignals): CareerStage | null {
  const role = (signals.role ?? '').toLowerCase().trim();
  if (role === 'student') return 'student';

  const seniority = signals.seniority ?? '';
  if (EXEC_HINT.test(seniority)) return 'executive';
  if (SENIOR_HINT.test(seniority)) return 'senior-leadership';

  const y = typeof signals.yearsExp === 'number' && isFinite(signals.yearsExp) ? signals.yearsExp : null;
  if (y != null) {
    if (y >= 15) return 'executive';
    if (y >= 8) return 'senior-leadership';
    if (y >= 3) return 'mid-career';
    if (y >= 1) return 'early-career';
    return 'graduate';
  }

  // No years known: fall back to a coarse signal from experience presence.
  if (signals.hasExperience === true) return 'mid-career';
  if (signals.hasExperience === false) return 'graduate';

  return null;
}

// ── Lazy ensure-schema (flag-ON path only) ───────────────────────────────────
let _careerStageColumnReady = false;
export async function ensureCareerStageColumn(pool: Pool): Promise<void> {
  if (_careerStageColumnReady) return;
  await pool.query(`ALTER TABLE career_seeker_profiles ADD COLUMN IF NOT EXISTS career_stage TEXT`);
  _careerStageColumnReady = true;
}

/**
 * The experience a user effectively sees: their chosen navigation preference
 * when it is STILL allowed for their stage, otherwise the stage's default
 * experience (Command Center when no stage is derivable — no regression).
 *
 * Authorization note: a stale/forbidden preference is silently ignored here, so
 * even if a preference was somehow persisted out of band it can never widen what
 * the user sees beyond `allowedExperiences(stage)`.
 */
export function effectiveExperience(
  stage: CareerStage | null,
  preferred: ExperienceId | null,
): ExperienceConfig {
  if (preferred) {
    const allowed = allowedExperiences(stage);
    if (allowed.some((e) => e.id === preferred)) return EXPERIENCES[preferred];
  }
  return stage ? resolveExperience(stage) : EXPERIENCES['command-center'];
}

/**
 * Read the user's effective stage: the stored career_stage if present, else a
 * derived stage from profile signals (never throws; returns null when no row).
 * Also surfaces the user's chosen experience preference (navigation only — it
 * never changes the canonical stage).
 */
export async function readEffectiveStage(
  pool: Pool,
  userId: string,
): Promise<{ stage: CareerStage | null; stored: boolean; derived: boolean; preferred: ExperienceId | null }> {
  await ensureCareerStageColumn(pool);
  const r = await pool.query(
    `SELECT career_stage, data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  const row = r.rows?.[0];
  const data = (row?.data ?? {}) as any;
  const cp = data.careerProfile ?? {};
  const preferred: ExperienceId | null = isExperienceId(cp.preferredExperience) ? cp.preferredExperience : null;

  const storedRaw = row?.career_stage;
  if (isCareerStage(storedRaw)) return { stage: storedRaw, stored: true, derived: false, preferred };

  const exp = Array.isArray(data.experience) ? data.experience : [];
  const latestTitle = exp.length ? (exp[0]?.title ?? exp[0]?.role ?? '') : '';
  const derived = deriveStage({
    yearsExp: typeof cp.yearsExperience === 'number' ? cp.yearsExperience : null,
    seniority: cp.currentRole || latestTitle || null,
    role: null,
    hasExperience: row ? exp.length > 0 : null,
  });
  return { stage: derived, stored: false, derived: derived != null, preferred };
}

/**
 * Upsert the canonical stage + structured career profile onto the EXISTING
 * career_seeker_profiles row (creating it if absent). Returns nothing; callers
 * handle audit + routing. Never widens to a new table.
 */
export async function persistCareerStage(
  pool: Pool,
  userId: string,
  stage: CareerStage,
  careerProfile?: Record<string, unknown> | null,
): Promise<void> {
  await ensureCareerStageColumn(pool);
  const dataPatch = careerProfile && Object.keys(careerProfile).length
    ? JSON.stringify({ careerProfile: { ...careerProfile, stage } })
    : JSON.stringify({ careerProfile: { stage } });
  await pool.query(
    `INSERT INTO career_seeker_profiles (user_id, data, completeness, career_stage)
       VALUES ($1, $2::jsonb, 0, $3)
     ON CONFLICT (user_id) DO UPDATE
       SET career_stage = EXCLUDED.career_stage,
           data = career_seeker_profiles.data || EXCLUDED.data,
           updated_at = NOW()`,
    [userId, dataPatch, stage],
  );
}

/**
 * Persist a chosen experience as a NAVIGATION PREFERENCE on the EXISTING
 * career_seeker_profiles row WITHOUT mutating the canonical career_stage. This
 * keeps the user's stage (their identity, set at registration / derived) as the
 * source of truth, so switching down can never demote a user or escalate them
 * into a stage they don't hold.
 *
 * Callers MUST validate the experience is within `allowedExperiences(stage)`
 * before calling — authorization is enforced at the route, never here. The
 * nested merge preserves any other careerProfile fields (a shallow `||` would
 * wipe them).
 */
export async function persistPreferredExperience(
  pool: Pool,
  userId: string,
  experienceId: ExperienceId,
): Promise<void> {
  await ensureCareerStageColumn(pool);
  await pool.query(
    `INSERT INTO career_seeker_profiles (user_id, data, completeness)
       VALUES ($1, jsonb_build_object('careerProfile', jsonb_build_object('preferredExperience', $2::text)), 0)
     ON CONFLICT (user_id) DO UPDATE
       SET data = COALESCE(career_seeker_profiles.data, '{}'::jsonb)
                  || jsonb_build_object('careerProfile',
                       COALESCE(career_seeker_profiles.data->'careerProfile', '{}'::jsonb)
                       || jsonb_build_object('preferredExperience', $2::text)),
           updated_at = NOW()`,
    [userId, experienceId],
  );
}
