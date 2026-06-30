/**
 * Phase 2 — Demographic Normalisation & k-Anonymity Gating
 *
 * Intercepts every cohort-comparison payload before it reaches the UI and
 * applies the canonical 3-rule k-anonymity gate:
 *
 *   Rule A (n < 30)    → 'masked'      — suppress raw benchmarks, return nulls
 *   Rule B (30 ≤ n<100)→ 'provisional' — return exact n + amber-band signal
 *   Rule C (n ≥ 100)   → 'verified'    — full disclosure + trend overlay
 *
 * Cohort source: `capadex_user_profiles(persona, age_band)`.
 * Trend reconciliation: `p4_competency_history` (append-only, never mutated
 * in place) gates the longitudinal overlay so only verified cohorts get a
 * stable trend line.
 *
 * Pure + side-effect-free apart from two read-only SELECTs. Failures degrade
 * to 'masked' so the UI never leaks unsafe peer data.
 */

import type { Pool } from 'pg';
import { isPersonaModelAlignmentEnabled, isPersonaModelExpansionEnabled } from '../config/feature-flags';

// ─── Canonical age bands (source of truth: replit.md IntroPhase) ─────────────
export const AGE_BANDS = ['6-14', '14-17', '17-24', '24-45', '45+'] as const;
export type AgeBand = typeof AGE_BANDS[number];

const AGE_BAND_BOUNDS: ReadonlyArray<{ band: AgeBand; min: number; max: number }> = [
  { band: '6-14',  min: 6,  max: 13 },
  { band: '14-17', min: 14, max: 16 },
  { band: '17-24', min: 17, max: 23 },
  { band: '24-45', min: 24, max: 44 },
  { band: '45+',   min: 45, max: 200 },
];

// ─── Canonical personas (collapsed from 11 sub-personas to 3 macro tracks) ───
export const PERSONA_TRACKS = ['learner', 'professional', 'proxy'] as const;
export type PersonaTrack = typeof PERSONA_TRACKS[number];

const SUB_PERSONA_TO_TRACK: Record<string, PersonaTrack> = {
  campus_student: 'learner', competitive_aspirant: 'learner',
  career_explorer: 'learner', skill_development_learner: 'learner',
  early_career_learner: 'learner', student: 'learner',
  early_career_professional: 'professional', mid_career_professional: 'professional',
  senior_professional: 'professional', professional: 'professional',
  professional_employee: 'professional', jobseeker: 'professional',
  parent: 'proxy', teacher: 'proxy', mentor: 'proxy', proxy: 'proxy',
};

// ─── CAPADEX 3.0 Phase 1.2 — additive sub-persona → track mappings (G-M2) ────
// These IntroPhase sub-persona ids exist in the runtime but were absent from the
// base map above, so cohort COUNTS silently under-counted them (the k-anon
// ANY-list omitted them). Folded in ONLY when `personaModelAlignment` is ON →
// flag-OFF cohort counts stay byte-identical to legacy. resolveCohort() is
// unaffected either way (unknown sub-personas already default to their correct
// track via normalisePersonaTrack), so the only change is the count's ANY-list.
const ALIGNMENT_SUB_PERSONA_TO_TRACK: Record<string, PersonaTrack> = {
  // exam-aspirant split (legacyKey 'student' → learner)
  jee_aspirant: 'learner', neet_aspirant: 'learner',
  cuet_aspirant: 'learner', upsc_aspirant: 'learner',
  // school sub-personas (legacyKey 'student' → learner)
  school_primary: 'learner', school_middle: 'learner', school_high: 'learner',
  // career-transition (legacyKey 'jobseeker' → professional) — the headline G-M2 drift
  career_transition_professional: 'professional',
  // proxy sub-personas (legacyKey 'teacher' → proxy)
  teacher_educator: 'proxy', academic_counsellor: 'proxy', placement_career_cell: 'proxy',
};

// ─── CAPADEX 3.0 — Persona Model EXPANSION sub-persona → track (G-F1/G-F2) ────
// Enterprise (legacyKey 'professional' → professional) + higher-ed faculty
// (legacyKey 'teacher' → proxy). Folded into the k-anon COUNT ANY-list ONLY when
// `personaModelExpansion` is ON → flag-OFF counts stay byte-identical to legacy.
const EXPANSION_SUB_PERSONA_TO_TRACK: Record<string, PersonaTrack> = {
  people_manager: 'professional', senior_leadership: 'professional',
  learning_development: 'professional',
  higher_ed_faculty: 'proxy',
};

/**
 * The list of stored `persona` tokens belonging to a track, for the k-anon
 * COUNT ANY-list. Base map always; alignment extensions only when the
 * personaModelAlignment flag is ON (→ flag-OFF list byte-identical to legacy).
 */
function personasForTrack(track: PersonaTrack): string[] {
  const entries = Object.entries(SUB_PERSONA_TO_TRACK);
  if (isPersonaModelAlignmentEnabled()) {
    entries.push(...Object.entries(ALIGNMENT_SUB_PERSONA_TO_TRACK));
  }
  if (isPersonaModelExpansionEnabled()) {
    entries.push(...Object.entries(EXPANSION_SUB_PERSONA_TO_TRACK));
  }
  return entries.filter(([, t]) => t === track).map(([k]) => k);
}

// ─── k-anonymity thresholds (locked) ─────────────────────────────────────────
export const K_MIN = 30;        // Rule A threshold
export const K_VERIFIED = 100;  // Rule C threshold

export type CohortStatus = 'masked' | 'provisional' | 'verified';

export interface CohortProfile {
  age?: number | null;
  age_band?: string | null;
  persona?: string | null;
}

export interface ResolvedCohort {
  age_band: AgeBand;
  persona_track: PersonaTrack;
}

export interface CohortGateResult {
  cohort: ResolvedCohort;
  cohort_status: CohortStatus;
  n: number;
  k_min: number;
  k_verified: number;
  /** Benchmarks reaching the UI — null when masked. */
  benchmarks: unknown | null;
  /** Trend overlay reaches UI only when cohort is verified AND history rows ≥ K_MIN. */
  trend_available: boolean;
  /** Audit copy surfaced verbatim in the UI gating pill. */
  privacy_notice: string;
}

// ─── Normalisation ───────────────────────────────────────────────────────────

/**
 * Map a raw `(age, age_band, persona)` profile into the canonical
 * `(AgeBand, PersonaTrack)` cohort key. Prefers explicit `age_band` when
 * supplied (already canonical from the IntroPhase picker), otherwise
 * derives from numeric `age`. Falls back to `'24-45'` × `'professional'`
 * for empty inputs — the safest, widest default cohort.
 */
export function resolveCohort(profile: CohortProfile): ResolvedCohort {
  const band = normaliseAgeBand(profile.age_band, profile.age);
  const track = normalisePersonaTrack(profile.persona);
  return { age_band: band, persona_track: track };
}

export function normaliseAgeBand(rawBand: string | null | undefined, age: number | null | undefined): AgeBand {
  if (typeof rawBand === 'string') {
    const norm = rawBand.replace(/[\u2010-\u2015\u2212]/g, '-').trim();
    if ((AGE_BANDS as readonly string[]).includes(norm)) return norm as AgeBand;
  }
  const n = Number(age);
  if (Number.isFinite(n)) {
    const hit = AGE_BAND_BOUNDS.find(b => n >= b.min && n <= b.max);
    if (hit) return hit.band;
  }
  return '24-45';
}

export function normalisePersonaTrack(raw: string | null | undefined): PersonaTrack {
  if (typeof raw !== 'string') return 'professional';
  const key = raw.toLowerCase().trim().replace(/[\s-]+/g, '_');
  if ((PERSONA_TRACKS as readonly string[]).includes(key)) return key as PersonaTrack;
  return SUB_PERSONA_TO_TRACK[key] ?? 'professional';
}

// ─── k-anonymity counter ─────────────────────────────────────────────────────

/**
 * Count active cohort members. Read-only — safe to call on any pool.
 * Returns 0 on missing pool / query error so the gate degrades to 'masked'.
 */
export async function countCohort(
  pool: Pool | null | undefined,
  cohort: ResolvedCohort,
): Promise<number> {
  if (!pool) return 0;
  try {
    // Cohort match: persona maps through SUB_PERSONA_TO_TRACK on the SQL side
    // via a row-side ANY against the list of sub-personas belonging to this
    // track. Age band is matched verbatim (canonical).
    const personas = personasForTrack(cohort.persona_track);
    const rs = await pool.query<{ n: string }>(
      `SELECT COUNT(DISTINCT user_id)::text AS n
         FROM capadex_user_profiles
        WHERE age_band = $1
          AND LOWER(REGEXP_REPLACE(COALESCE(persona, ''), '[\\s-]+', '_', 'g')) = ANY($2::text[])`,
      [cohort.age_band, personas],
    );
    return Number(rs.rows[0]?.n ?? 0);
  } catch (err) {
    console.error('[cohort-gating] countCohort failed — degrading to masked:', err);
    return 0;
  }
}

// ─── Reconciliation against p4_competency_history (append-only) ──────────────

/**
 * Count distinct historical samples for this competency that originated
 * from cohort-matching users. Used only to decide whether the trend overlay
 * is stable enough to surface (gate: ≥ K_MIN distinct users with history).
 *
 * Read-only against `p4_competency_history` (append-only by contract).
 */
export async function countCohortHistory(
  pool: Pool | null | undefined,
  cohort: ResolvedCohort,
  competencyId: string | null | undefined,
): Promise<number> {
  if (!pool || !competencyId) return 0;
  try {
    const personas = personasForTrack(cohort.persona_track);
    const rs = await pool.query<{ n: string }>(
      `SELECT COUNT(DISTINCT h.user_id)::text AS n
         FROM p4_competency_history h
         JOIN capadex_user_profiles p
           ON p.user_id::text = h.user_id
        WHERE h.competency_id = $1
          AND p.age_band      = $2
          AND LOWER(REGEXP_REPLACE(COALESCE(p.persona, ''), '[\\s-]+', '_', 'g')) = ANY($3::text[])`,
      [competencyId, cohort.age_band, personas],
    );
    return Number(rs.rows[0]?.n ?? 0);
  } catch (err) {
    console.error('[cohort-gating] countCohortHistory failed:', err);
    return 0;
  }
}

// ─── Gate evaluator (pure, no DB) ────────────────────────────────────────────

/**
 * Apply the 3-rule k-anonymity gate to a raw benchmark payload. Pure +
 * side-effect-free — safe to unit-test without DB or fixtures.
 */
export function applyKAnonymity<T>(
  n: number,
  rawBenchmarks: T,
  opts: { historyN?: number } = {},
): Omit<CohortGateResult, 'cohort'> {
  const status: CohortStatus =
    n >= K_VERIFIED ? 'verified'
    : n >= K_MIN    ? 'provisional'
    : 'masked';

  const trend_available = status === 'verified' && (opts.historyN ?? 0) >= K_MIN;

  const benchmarks = status === 'masked' ? null : rawBenchmarks;
  const privacy_notice =
    status === 'masked'
      ? `Peer comparison locked — building a privacy-safe cohort (n<${K_MIN}).`
      : status === 'provisional'
      ? `Provisional — cohort building (n=${n}). Developmental signal only.`
      : `Verified cohort norm (n=${n}, k-anonymity met). Developmental signal only.`;

  return {
    cohort_status: status,
    n,
    k_min: K_MIN,
    k_verified: K_VERIFIED,
    benchmarks,
    trend_available,
    privacy_notice,
  };
}

// ─── Public orchestrator ─────────────────────────────────────────────────────

/**
 * One-shot helper: resolve cohort → count members → reconcile history → gate.
 * Use this from any route that surfaces peer benchmarks (CompetencyDashboard,
 * Fitment panel, CAPADEX report). Always returns a safe envelope — never throws.
 */
export async function gateCohortPayload<T>(
  pool: Pool | null | undefined,
  profile: CohortProfile,
  rawBenchmarks: T,
  competencyId?: string | null,
): Promise<CohortGateResult> {
  const cohort = resolveCohort(profile);
  const n = await countCohort(pool, cohort);
  const historyN = competencyId ? await countCohortHistory(pool, cohort, competencyId) : 0;
  const gated = applyKAnonymity(n, rawBenchmarks, { historyN });
  return { cohort, ...gated };
}
