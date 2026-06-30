/**
 * CAPADEX 3.0 — Persona Model EXPANSION engine (read-only composer).
 *
 * Scope (deliverable-10 gaps G-F5 + G-F6):
 *   - G-F5  Per-persona realized-OUTCOME breakdown. COMPOSES the EXISTING MX-102X
 *           Outcome Intelligence engine (`composeOverview`) for the platform
 *           rollup and reads `capadex_user_profiles(persona)` for the REAL
 *           per-persona assessment-coverage denominator. Realized outcomes are
 *           reported per persona ONLY when the substrate actually links an
 *           outcome to a persona; today the realized-outcome substrate carries
 *           NO persona dimension, so per-persona outcome counts are honest-NULL
 *           (`linkage_present:false`) — an empty-until-real-data pipeline, never
 *           fabricated. Confidence ABSTAINS below k_min=30 (inherited).
 *   - G-F6  NON-CLINICAL structural scaffold REGISTRY for the deferred
 *           Government / Healthcare / Clinical-Psychology verticals. Carries
 *           explicit "not validated / not for clinical or diagnostic use"
 *           disclaimers ONLY — NO clinical content, NO assessment persona, NO
 *           question bank, NO claim of clinical validity.
 *
 * Honesty contract (platform-wide):
 *   - Coverage ⟂ Confidence — never composited.
 *   - null ≠ 0 — an unmeasurable / unlinked value is null with a reason, not 0.
 *   - Never fabricate — abstain instead.
 *
 * Read-only: every query is a SELECT / to_regclass probe. NO DDL anywhere — the
 * owning flag (`personaModelExpansion`) keeps schema byte-identical when OFF, and
 * the routes 503 before this engine is ever reached.
 */

import type { Pool } from 'pg';
import { composeOverview, OI_K_MIN } from './outcome-intelligence-engine';

export const PERSONA_EXPANSION_VERSION = '1.0.0';

/** Inherit the platform k-anonymity / empirical floor (30). */
export const PE_K_MIN = OI_K_MIN;

/** Persona track (mirrors cohort-gating PERSONA_TRACKS — kept local to avoid coupling). */
type PersonaTrack = 'learner' | 'professional' | 'proxy';

/** One persona dimension entry for the per-persona outcome breakdown. */
interface PersonaDimEntry {
  /** stored `persona` token (normalised: lower-case, spaces/hyphens → underscore). */
  persona: string;
  label: string;
  track: PersonaTrack;
  /** true → first surfaced by the EXPANSION flag (G-F1/G-F2); false → pre-existing persona. */
  expansion: boolean;
}

/**
 * The persona dimension reported by the per-persona breakdown. Pre-existing
 * IntroPhase sub-personas + the four EXPANSION sub-personas (G-F1/G-F2). This is
 * a reporting dimension only — it neither creates nor mutates any data.
 */
const PERSONA_DIMENSION: PersonaDimEntry[] = [
  // learners
  { persona: 'campus_student',             label: 'College / university student', track: 'learner',      expansion: false },
  { persona: 'skill_development_learner',  label: 'Building new skills',          track: 'learner',      expansion: false },
  { persona: 'career_explorer',            label: 'Exploring next move',          track: 'learner',      expansion: false },
  // professionals
  { persona: 'early_career_professional',  label: 'Early career (0–3 yrs)',       track: 'professional', expansion: false },
  { persona: 'mid_career_professional',    label: 'Mid career (3–10 yrs)',        track: 'professional', expansion: false },
  { persona: 'career_transition_professional', label: 'Changing roles / industry', track: 'professional', expansion: false },
  // enterprise expansion (G-F1)
  { persona: 'people_manager',             label: 'People manager',               track: 'professional', expansion: true },
  { persona: 'senior_leadership',          label: 'Senior leadership',            track: 'professional', expansion: true },
  { persona: 'learning_development',       label: 'Learning & development',       track: 'professional', expansion: true },
  // proxies
  { persona: 'parent',                     label: 'Parent',                       track: 'proxy',        expansion: false },
  { persona: 'teacher_educator',           label: 'Teacher / educator',           track: 'proxy',        expansion: false },
  { persona: 'academic_counsellor',        label: 'Academic counsellor',          track: 'proxy',        expansion: false },
  { persona: 'placement_career_cell',      label: 'Placement / TPO cell',         track: 'proxy',        expansion: false },
  // faculty expansion (G-F2)
  { persona: 'higher_ed_faculty',          label: 'Higher-education faculty',     track: 'proxy',        expansion: true },
];

async function tablePresent(pool: Pool, qualified: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS t', [qualified]);
    return !!r.rows?.[0]?.t;
  } catch {
    return false;
  }
}

/**
 * Per-persona assessment-coverage counts from `capadex_user_profiles`.
 * Returns a Map<normalised-persona, count>. On any error or absent table the
 * map is empty → callers report null (NOT 0) for every persona.
 */
async function coverageByPersona(pool: Pool): Promise<Map<string, number> | null> {
  if (!(await tablePresent(pool, 'public.capadex_user_profiles'))) return null;
  try {
    const { rows } = await pool.query(
      `SELECT LOWER(REGEXP_REPLACE(COALESCE(persona, ''), '[\\s-]+', '_', 'g')) AS persona,
              COUNT(*)::int AS n
         FROM capadex_user_profiles
        GROUP BY 1`,
    );
    const m = new Map<string, number>();
    for (const r of rows) if (r.persona) m.set(String(r.persona), Number(r.n));
    return m;
  } catch {
    return null;
  }
}

export interface PersonaOutcomeRow {
  persona: string;
  label: string;
  track: PersonaTrack;
  expansion: boolean;
  /** REAL assessment-coverage count for this persona; null when the source table is unreadable/absent (null ≠ 0). */
  assessment_coverage: number | null;
  /** Realized outcomes attributed to this persona. Honest-null until the substrate links outcomes to a persona. */
  realized_outcomes: number | null;
  /** Whether the realized-outcome substrate carries a persona linkage for this persona. */
  linkage_present: boolean;
  /** Confidence axis (separate from coverage). ABSTAINED until realized outcomes ≥ k_min. */
  confidence: { abstained: true; reason: string; k_min: number };
}

/**
 * G-F5 — per-persona realized-outcome breakdown. Composes the MX-102X overview
 * for the platform rollup; reports honest-null per-persona outcomes because the
 * realized-outcome substrate has no persona dimension yet. Never throws.
 */
export async function composePersonaOutcomes(pool: Pool) {
  let platform: Awaited<ReturnType<typeof composeOverview>> | { degraded: true; reason: string } | null = null;
  try {
    platform = await composeOverview(pool);
  } catch {
    platform = { degraded: true, reason: 'outcome_overview_unavailable' };
  }

  const coverage = await coverageByPersona(pool);
  const coverageReadable = coverage != null;

  const personas: PersonaOutcomeRow[] = PERSONA_DIMENSION.map((d) => ({
    persona: d.persona,
    label: d.label,
    track: d.track,
    expansion: d.expansion,
    assessment_coverage: coverageReadable ? (coverage!.get(d.persona) ?? 0) : null,
    // The realized-outcome substrate (validation_loop_outcomes / employer_candidates)
    // carries NO persona column → outcomes cannot be honestly attributed per persona.
    realized_outcomes: null,
    linkage_present: false,
    confidence: {
      abstained: true,
      reason: 'realized_outcomes_below_k_min_or_unlinked',
      k_min: PE_K_MIN,
    },
  }));

  return {
    ok: true,
    read_only: true,
    version: PERSONA_EXPANSION_VERSION,
    k_min: PE_K_MIN,
    notes: {
      coverage_source: 'capadex_user_profiles.persona (REAL assessment coverage)',
      coverage_readable: coverageReadable,
      outcome_linkage:
        'The realized-outcome substrate has no persona dimension; per-persona outcome counts are honest-null ' +
        '(linkage_present:false) — an empty-until-real-data pipeline, never fabricated.',
      axes: 'Coverage (assessments taken) ⟂ Outcomes (realized) ⟂ Confidence (≥ k_min). Never composited.',
    },
    platform_outcomes: platform,
    personas,
  };
}

export interface VerticalScaffold {
  id: string;
  label: string;
  status: 'scaffold';
  validated: false;
  clinical_use: false;
  assessment_persona: false;
  question_bank: false;
  summary: string;
  disclaimers: string[];
}

const NON_CLINICAL_DISCLAIMERS: string[] = [
  'This vertical is a NON-CLINICAL structural scaffold only.',
  'It is NOT validated and carries NO claim of clinical, diagnostic, or psychometric validity.',
  'It must NOT be used for clinical, diagnostic, screening, or treatment decisions.',
  'No clinical content, assessment persona, or question bank is provided or implied.',
  'Any future activation requires independent validation, qualified professional oversight, and applicable regulatory approval.',
];

/**
 * G-F6 — NON-CLINICAL scaffold registry for the deferred verticals. Pure static
 * registry + disclaimers. No DB read, no clinical content. Never throws.
 */
export function composeVerticalScaffolds() {
  const verticals: VerticalScaffold[] = [
    {
      id: 'government',
      label: 'Government & Public Sector',
      status: 'scaffold',
      validated: false,
      clinical_use: false,
      assessment_persona: false,
      question_bank: false,
      summary:
        'Placeholder for a future public-sector / civil-services workforce vertical. Not built, not validated, not active.',
      disclaimers: NON_CLINICAL_DISCLAIMERS,
    },
    {
      id: 'healthcare',
      label: 'Healthcare Workforce',
      status: 'scaffold',
      validated: false,
      clinical_use: false,
      assessment_persona: false,
      question_bank: false,
      summary:
        'Placeholder for a future healthcare-workforce (non-clinical) vertical. Not built, not validated, not active. ' +
        'Explicitly excludes any patient-facing, clinical, or diagnostic use.',
      disclaimers: NON_CLINICAL_DISCLAIMERS,
    },
    {
      id: 'clinical_psychology',
      label: 'Clinical Psychology (DEFERRED — non-clinical scaffold only)',
      status: 'scaffold',
      validated: false,
      clinical_use: false,
      assessment_persona: false,
      question_bank: false,
      summary:
        'Deliberately DEFERRED. Recorded ONLY as a non-clinical boundary marker so the platform never drifts into ' +
        'clinical or diagnostic claims. No clinical instrument, persona, or content exists or is planned here.',
      disclaimers: NON_CLINICAL_DISCLAIMERS,
    },
  ];

  return {
    ok: true,
    read_only: true,
    version: PERSONA_EXPANSION_VERSION,
    notice:
      'NON-CLINICAL scaffold registry. None of these verticals are validated, active, or fit for clinical / diagnostic use.',
    verticals,
  };
}
