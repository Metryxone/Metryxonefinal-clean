/**
 * CAPADEX persona taxonomy — THE single source of truth for the assessment-taker
 * persona/sub-persona architecture (macro tracks × granular sub-personas × age bands).
 *
 * Extracted verbatim from IntroPhase so that BOTH the classic single-page selector
 * (IntroPhase) and the Phase 3.2A progressive onboarding wizard (PersonaJourneyWizard)
 * consume ONE taxonomy — no fork, no duplicate persona logic. The flag-gated spreads
 * (personaModelAlignment exam split · personaModelExpansion enterprise/faculty) are
 * preserved exactly, so with a given (alignment, expansion) pair `buildTrackGroups`
 * returns byte-identical data to the previous inline `TRACK_GROUPS`.
 *
 * Icons are intentionally NOT part of this data module (they are a UI concern) — each
 * consumer maps a track `id` to its own lucide icon.
 */
import type { PersonaKey } from '@/lib/behavioural-insights';

// ── Canonical age-band whitelist ────────────────────────────────────────────
// Single source of truth for the 5-bucket bracket model.
export const AGE_BANDS = ['6-14', '14-17', '17-24', '24-45', '45+'] as const;
export type AgeBand = typeof AGE_BANDS[number];

export const AGE_BAND_LABEL: Record<AgeBand, string> = {
  '6-14': 'School (6–14)',
  '14-17': 'Senior School (14–17)',
  '17-24': 'College / Early Adult (17–24)',
  '24-45': 'Working Professional (24–45)',
  '45+': 'Senior Professional (45+)',
};

export type SubPersona = {
  id: string;             // canonical primary_persona token, e.g. 'competitive_aspirant'
  label: string;          // user-facing chip label, e.g. 'Competitive Aspirant'
  legacyKey: PersonaKey;  // back-compat mapping into PersonaKey union
  ageBands: AgeBand[];    // allowed brackets for this sub-persona
};

export type MacroTrackId = 'school' | 'learner' | 'professional' | 'proxy';

export type MacroTrackData = {
  id: MacroTrackId;
  title: string;
  subtitle: string;
  isProxy: boolean;
  subPersonas: SubPersona[];
};

export interface BuildTrackGroupsOpts {
  /** CAPADEX 3.0 Phase 1.2 — personaModelAlignment: exam-aspirant split. */
  alignment: boolean;
  /** CAPADEX 3.0 Persona Model EXPANSION — personaModelExpansion: enterprise + faculty. */
  expansion: boolean;
}

/**
 * Build the canonical macro-track groups for the current flag state. Pure — same inputs
 * always yield the same data. Flag OFF (alignment=false, expansion=false) yields the
 * original legacy taxonomy byte-identically.
 */
export function buildTrackGroups({ alignment, expansion }: BuildTrackGroupsOpts): MacroTrackData[] {
  // Phase 1.2 — exam-aspirant split (each still legacyKey 'student').
  const competitiveAspirants: SubPersona[] = alignment
    ? [
        { id: 'jee_aspirant', label: 'JEE aspirant (Engineering)', legacyKey: 'student', ageBands: ['14-17', '17-24'] },
        { id: 'neet_aspirant', label: 'NEET aspirant (Medical)', legacyKey: 'student', ageBands: ['14-17', '17-24'] },
        { id: 'cuet_aspirant', label: 'CUET aspirant (University)', legacyKey: 'student', ageBands: ['14-17', '17-24'] },
        { id: 'upsc_aspirant', label: 'UPSC / civil-services aspirant', legacyKey: 'student', ageBands: ['17-24', '24-45'] },
      ]
    : [
        { id: 'competitive_aspirant', label: 'JEE / NEET / UPSC aspirant', legacyKey: 'student', ageBands: ['14-17', '17-24'] },
      ];

  // EXPANSION G-F1 — enterprise sub-personas (each still legacyKey 'professional').
  const enterprisePersonas: SubPersona[] = expansion
    ? [
        { id: 'people_manager', label: 'People manager (leads a team)', legacyKey: 'professional', ageBands: ['24-45', '45+'] },
        { id: 'senior_leadership', label: 'Senior leadership / executive', legacyKey: 'professional', ageBands: ['24-45', '45+'] },
        { id: 'learning_development', label: 'Learning & development (L&D)', legacyKey: 'professional', ageBands: ['24-45', '45+'] },
      ]
    : [];

  // EXPANSION G-F2 — higher-education faculty as a first-class proxy sub-persona (legacyKey 'teacher').
  const facultyPersonas: SubPersona[] = expansion
    ? [
        { id: 'higher_ed_faculty', label: 'Higher-education faculty', legacyKey: 'teacher', ageBands: ['17-24', '24-45'] },
      ]
    : [];

  return [
    {
      id: 'school', title: 'School children', subtitle: 'A school student taking this themselves',
      isProxy: false,
      subPersonas: [
        { id: 'school_primary', label: 'Primary school (Class 1–5)', legacyKey: 'student', ageBands: ['6-14'] },
        { id: 'school_middle', label: 'Middle school (Class 6–8)', legacyKey: 'student', ageBands: ['6-14'] },
        { id: 'school_high', label: 'High school (Class 9–12)', legacyKey: 'student', ageBands: ['14-17'] },
      ],
    },
    {
      id: 'learner', title: 'Students & learners', subtitle: 'School, college or competitive prep',
      isProxy: false,
      subPersonas: [
        { id: 'campus_student', label: 'College or university student', legacyKey: 'campus', ageBands: ['17-24'] },
        ...competitiveAspirants,
        { id: 'career_explorer', label: 'Exploring my next move', legacyKey: 'jobseeker', ageBands: ['17-24', '24-45'] },
        { id: 'skill_development_learner', label: 'Building new skills', legacyKey: 'student', ageBands: ['14-17', '17-24', '24-45'] },
      ],
    },
    {
      id: 'professional', title: 'Working professionals', subtitle: 'From first job to senior leadership',
      isProxy: false,
      subPersonas: [
        { id: 'early_career_professional', label: 'Early career (0–3 yrs)', legacyKey: 'professional', ageBands: ['17-24', '24-45'] },
        { id: 'mid_career_professional', label: 'Mid career (3–10 yrs)', legacyKey: 'professional', ageBands: ['24-45'] },
        ...enterprisePersonas,
        { id: 'career_transition_professional', label: 'Changing roles or industry', legacyKey: 'jobseeker', ageBands: ['24-45', '45+'] },
      ],
    },
    {
      id: 'proxy', title: 'Parents, teachers & counsellors', subtitle: 'Assessing someone in your care',
      isProxy: true,
      subPersonas: [
        { id: 'parent', label: 'Parent', legacyKey: 'parent', ageBands: ['6-14', '14-17'] },
        { id: 'teacher_educator', label: 'Teacher or educator', legacyKey: 'teacher', ageBands: ['6-14', '14-17', '17-24'] },
        ...facultyPersonas,
        { id: 'academic_counsellor', label: 'Academic counsellor', legacyKey: 'teacher', ageBands: ['14-17', '17-24'] },
        { id: 'placement_career_cell', label: 'Placement / TPO cell', legacyKey: 'teacher', ageBands: ['17-24'] },
      ],
    },
  ];
}

/** Typographical en-dash / em-dash → ASCII hyphen (age-band comparison normalisation). */
export const normaliseDash = (s: string): string => (s || '').replace(/[-–—]/g, '-');

/** Is a candidate string a recognised AgeBand after dash normalisation? */
export const isCanonicalAgeBand = (s: string): boolean =>
  (AGE_BANDS as readonly string[]).includes(normaliseDash(s));
