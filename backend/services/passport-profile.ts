/**
 * PHASE 4.9 — Career Passport Foundation: Passport Profile (the stitcher).
 *
 * Pure, read-only helpers that STITCH the loaded passport context
 * (career-passport-engine.ts) into the six canonical passport components, each
 * carrying its own honesty axes — Coverage (does the data exist) and Confidence
 * (how trustworthy is it) — reported SEPARATELY and never composited:
 *
 *   1. Competency Profile  — measured domain-proxy levels (competency-runtime).
 *   2. EI Profile          — EI dimensions + growth potential (ei-profile-engine).
 *   3. Career Profile       — the subject's own career_seeker_profiles JSONB
 *                            (non-PII summary only; contact info NEVER surfaced).
 *   4. Career Readiness    — the 4-type readiness envelope (Phase 4.3).
 *   5. Achievements        — developmental milestones DERIVED from measured facts
 *                            (each item traces to a real measure; never an award).
 *   6. Career Journey      — append-only history timeline (4.3 / 4.4 / 4.8 / comp).
 *
 * Honesty contract: every section is built ONLY from already-computed source
 * outputs. A section with no underlying data is marked `present:false` with a
 * note — never zero-filled, never fabricated.
 */

import {
  CAREER_PASSPORT_ENGINE_VERSION,
  type PassportContext,
  type JourneyEvent,
} from './career-passport-engine.js';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';

export const PASSPORT_PROFILE_VERSION = '4.9.0';

export type PassportSectionKey =
  | 'competency_profile'
  | 'ei_profile'
  | 'career_profile'
  | 'career_readiness'
  | 'achievements'
  | 'career_journey';

/** The two honesty axes, surfaced together but NEVER composited into one number. */
export interface PassportAxes {
  coverage: { present: boolean; detail: string };
  confidence: { band: string; basis: string; caps: string[] };
}

export interface PassportSection<T = unknown> {
  key: PassportSectionKey;
  label: string;
  /** Coverage: does real source data exist for this component? */
  present: boolean;
  axes: PassportAxes;
  data: T | null;
  notes: string[];
}

export interface CareerPassportProfile {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  /** True when at least one component is present (has real data). */
  measurable: boolean;
  coverage: {
    sections_total: number;
    sections_present: number;
    coverage_pct: number;
    present_sections: PassportSectionKey[];
  };
  sections: {
    competency_profile: PassportSection;
    ei_profile: PassportSection;
    career_profile: PassportSection;
    career_readiness: PassportSection;
    achievements: PassportSection;
    career_journey: PassportSection;
  };
  source_versions: Record<string, string>;
  language_policy: typeof LANGUAGE_POLICY;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Pure section builders (each takes the already-loaded context).
// ---------------------------------------------------------------------------

const PROFICIENT_LEVEL = 4;

function competencySection(ctx: PassportContext): PassportSection {
  const p = ctx.competencyProfile;
  const domainScores = Array.isArray(p?.domain_scores) ? p!.domain_scores : [];
  const measured = !!p && (p.overall_level != null || domainScores.length > 0);
  const coveragePct =
    p?.coverage && typeof (p.coverage as any).coverage_pct === 'number'
      ? Number((p.coverage as any).coverage_pct)
      : null;
  const notes: string[] = [];
  if (!ctx.runtimeReady) notes.push('Competency runtime not initialized — no measured profile (honest absence).');
  else if (!measured) notes.push('No measured competency profile for this subject yet.');

  return {
    key: 'competency_profile',
    label: 'Competency Profile',
    present: measured,
    axes: {
      coverage: {
        present: measured,
        detail: measured
          ? `${domainScores.length} measured competency domain(s)`
          : 'no measured competency profile',
      },
      confidence: {
        band: measured ? (coveragePct != null && coveragePct >= 60 ? 'Provisional-High' : 'Provisional') : 'None',
        basis: 'domain-proxy measured levels (competency-runtime profile)',
        caps: measured ? ['domain_proxy'] : ['domain_proxy', 'not_measurable'],
      },
    },
    data: measured
      ? {
          measurement: p?.measurement ?? 'domain_proxy',
          overall_score: p?.overall_score ?? null,
          overall_level: p?.overall_level ?? null,
          coverage_pct: coveragePct,
          domains: domainScores.map((d) => ({
            onto_domain: d.onto_domain,
            label: d.label,
            level: d.level,
            scaled_score: d.scaled_score,
            question_count: d.question_count,
          })),
        }
      : null,
    notes,
  };
}

function eiSection(ctx: PassportContext): PassportSection {
  const ei = ctx.eiProfile;
  const measurable = ei?.overall_ei?.measurable ?? false;
  const notes: string[] = [];
  if (!ei) notes.push('EI profile unavailable (honest absence).');
  else if (!measurable) notes.push('EI profile not yet measurable — no measured competency profile.');

  return {
    key: 'ei_profile',
    label: 'EI Profile',
    present: measurable,
    axes: {
      coverage: {
        present: measurable,
        detail: measurable
          ? `${ei?.coverage.dimensions_measurable}/${ei?.coverage.dimensions_total} EI dimensions measured`
          : 'EI profile not provisioned',
      },
      confidence: {
        band: measurable ? (ei?.overall_ei.confidence?.band ?? 'None') : 'None',
        basis: ei?.overall_ei.confidence?.measurement || 'no measured competency profile',
        caps: Array.isArray(ei?.overall_ei.confidence?.caps) ? ei!.overall_ei.confidence!.caps : ['not_measurable'],
      },
    },
    data: measurable
      ? {
          overall_ei: ei?.overall_ei.ei_score ?? null,
          band: ei?.overall_ei.band ?? null,
          coverage_pct: ei?.overall_ei.coverage_pct ?? null,
          growth_potential: {
            score: ei?.growth_potential?.score ?? null,
            level: ei?.growth_potential?.level ?? null,
          },
          strength_areas: (ei?.strength_areas ?? []).map((s: any) => s.label ?? s.ei_dimension_id ?? s).slice(0, 8),
          development_areas: (ei?.development_areas ?? []).map((s: any) => s.label ?? s.ei_dimension_id ?? s).slice(0, 8),
          dimensions_total: ei?.coverage.dimensions_total ?? 0,
          dimensions_measurable: ei?.coverage.dimensions_measurable ?? 0,
        }
      : null,
    notes,
  };
}

/** Non-PII whitelist for the Career Profile summary. Contact fields (email,
 *  phone, address, etc.) are deliberately EXCLUDED — contact is never surfaced.
 *  Free-text fields (summary / bio) are intentionally NOT whitelisted: they can
 *  carry embedded contact details and add no structured value to a passport. */
const PROFILE_SCALAR_WHITELIST = [
  'headline',
  'title',
  'current_role',
  'currentRole',
  'target_role',
  'targetRole',
  'location',
  'industry',
  'experience_years',
  'experienceYears',
] as const;
const PROFILE_ARRAY_WHITELIST = ['skills', 'experiences', 'experience', 'education', 'projects', 'certifications'] as const;

/** Defense-in-depth: strip embedded contact details (email / phone) from any
 *  surfaced string value, so a user who stuffs contact info into a structured
 *  field (e.g. headline) still never leaks it through the passport. */
function redactContact<T>(v: T): T {
  if (typeof v !== 'string') return v;
  return v
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]')
    .replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, '[redacted-phone]') as unknown as T;
}

function careerProfileSection(ctx: PassportContext): PassportSection {
  const cp = ctx.careerProfile;
  const exists = cp.exists && cp.data != null;
  const notes: string[] = [];
  if (!exists) notes.push('No career profile record for this subject (honest absence).');

  let summary: Record<string, unknown> | null = null;
  const presentFields: string[] = [];
  if (exists && cp.data) {
    summary = {};
    for (const k of PROFILE_SCALAR_WHITELIST) {
      const v = redactContact((cp.data as any)[k]);
      if (v != null && (typeof v === 'string' ? v.trim() !== '' : true)) {
        (summary as any)[k] = v;
        presentFields.push(k);
      }
    }
    for (const k of PROFILE_ARRAY_WHITELIST) {
      const v = (cp.data as any)[k];
      if (Array.isArray(v) && v.length > 0) {
        (summary as any)[`${k}_count`] = v.length;
        presentFields.push(`${k}(${v.length})`);
      }
    }
  }
  const hasContent = exists && presentFields.length > 0;
  if (exists && !hasContent) notes.push('Career profile record exists but has no whitelisted summary fields populated.');

  return {
    key: 'career_profile',
    label: 'Career Profile',
    present: exists,
    axes: {
      coverage: {
        present: exists,
        detail: exists
          ? hasContent
            ? `career profile present (${presentFields.length} summary field(s))`
            : 'career profile present but empty'
          : 'no career profile record',
      },
      confidence: {
        band: hasContent ? 'Self-Reported' : 'None',
        basis: 'subject-supplied career_seeker_profiles record (self-reported; contact info excluded)',
        caps: hasContent ? ['self_reported'] : ['self_reported', 'no_content'],
      },
    },
    data: exists ? { summary, present_fields: presentFields } : null,
    notes,
  };
}

function readinessSection(ctx: PassportContext): PassportSection {
  const r = ctx.readiness;
  const measurable = r?.measurable ?? false;
  const notes: string[] = [];
  if (!r) notes.push('Career readiness unavailable (honest absence).');
  else if (!measurable) notes.push('Career readiness not yet measurable — no measurable readiness block.');

  return {
    key: 'career_readiness',
    label: 'Career Readiness',
    present: measurable,
    axes: {
      coverage: {
        present: measurable,
        detail: measurable
          ? `overall readiness from ${r?.overall.contributing.length ?? 0} measurable block(s)`
          : 'no measurable readiness block',
      },
      confidence: {
        band: r?.overall.measurable ? bandConfidence(r.overall.score) : 'None',
        basis: r?.overall.basis ?? 'no measurable present-readiness block',
        caps: r?.overall.measurable ? [] : ['not_measurable'],
      },
    },
    data: measurable
      ? {
          overall: r?.overall ?? null,
          current: blockSlim(r?.current),
          future: blockSlim(r?.future),
          role: blockSlim(r?.role),
          growth: blockSlim(r?.growth),
        }
      : null,
    notes,
  };
}

function blockSlim(b: any): Record<string, unknown> | null {
  if (!b) return null;
  return { type: b.type, label: b.label, measurable: b.measurable, score: b.score, band: b.band };
}

function bandConfidence(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return 'None';
  if (score >= 80) return 'Provisional-High';
  if (score >= 40) return 'Provisional';
  return 'Provisional-Low';
}

/** Achievements are DERIVED from already-measured facts (competency / EI /
 *  readiness). Each item traces to a real measure and is emitted ONLY when that
 *  measure exists — never a fabricated award and never user-entered. */
interface AchievementItem {
  key: string;
  label: string;
  basis: string;
  source: string;
  at?: string;
}

function achievementsSection(ctx: PassportContext): PassportSection {
  const items: AchievementItem[] = [];
  const compAt = ctx.competencyProfile?.created_at
    ? new Date(ctx.competencyProfile.created_at).toISOString()
    : undefined;

  // Competency milestones — proficient (level >= 4) measured domains.
  for (const d of ctx.competencyProfile?.domain_scores ?? []) {
    if (d.level != null && Number(d.level) >= PROFICIENT_LEVEL) {
      items.push({
        key: `competency_proficient_${d.onto_domain}`,
        label: `Proficient in ${d.label}`,
        basis: `measured competency level ${d.level}/5 (>= ${PROFICIENT_LEVEL})`,
        source: 'competency_profile',
        at: compAt,
      });
    }
  }
  if (ctx.competencyProfile?.overall_level != null && Number(ctx.competencyProfile.overall_level) >= PROFICIENT_LEVEL) {
    items.push({
      key: 'competency_overall_proficient',
      label: 'Proficient overall competency',
      basis: `measured overall competency level ${ctx.competencyProfile.overall_level}/5`,
      source: 'competency_profile',
      at: compAt,
    });
  }

  // EI milestone — measurable EI in a strong band.
  const eiBand = ctx.eiProfile?.overall_ei.band;
  if (
    (ctx.eiProfile?.overall_ei.measurable ?? false) &&
    typeof eiBand === 'string' &&
    /strong|excellent|advanced|high/i.test(eiBand)
  ) {
    items.push({
      key: 'ei_strong',
      label: `Strong emotional intelligence (${eiBand})`,
      basis: `measured overall EI band: ${eiBand}`,
      source: 'ei_profile',
    });
  }

  // Readiness milestones — Advanced/Proficient measurable readiness blocks.
  for (const b of [ctx.readiness?.current, ctx.readiness?.future, ctx.readiness?.role, ctx.readiness?.growth]) {
    if (b && b.measurable && typeof b.band === 'string' && /advanced|proficient/i.test(b.band)) {
      items.push({
        key: `readiness_${b.type}_${String(b.band).toLowerCase()}`,
        label: `${b.band} ${b.label}`,
        basis: `measured readiness band: ${b.band}`,
        source: 'career_readiness',
      });
    }
  }

  // A passport source is "present" once any measure exists to derive from, even
  // if no milestone was reached yet (honest "0 milestones" is not absence).
  // NOTE: getProfile returns a non-null EMPTY object for a missing subject, so
  // test for an actual measured profile (overall level or measured domains),
  // never mere non-nullness — otherwise an empty subject reads as measurable.
  const competencyMeasured =
    !!ctx.competencyProfile &&
    (ctx.competencyProfile.overall_level != null ||
      (Array.isArray(ctx.competencyProfile.domain_scores) && ctx.competencyProfile.domain_scores.length > 0));
  const sourcesMeasurable =
    competencyMeasured ||
    (ctx.eiProfile?.overall_ei.measurable ?? false) ||
    (ctx.readiness?.measurable ?? false);
  const notes: string[] = [];
  if (!sourcesMeasurable) notes.push('No measured sources to derive achievements from (honest absence).');
  else if (items.length === 0) notes.push('No developmental milestones reached yet (sources measured, thresholds not met).');

  return {
    key: 'achievements',
    label: 'Achievements',
    present: sourcesMeasurable,
    axes: {
      coverage: {
        present: sourcesMeasurable,
        detail: `${items.length} developmental milestone(s) derived from measured facts`,
      },
      confidence: {
        band: items.length > 0 ? 'Derived' : 'None',
        basis: 'developmental milestones derived from measured competency / EI / readiness facts (not user-entered awards)',
        caps: ['derived', 'developmental_signal'],
      },
    },
    data: sourcesMeasurable ? { count: items.length, items } : null,
    notes,
  };
}

function journeySection(ctx: PassportContext): PassportSection {
  const events: JourneyEvent[] = ctx.journeyEvents ?? [];
  const present = events.length > 0;
  const notes: string[] = [];
  if (!present) notes.push('No career-journey history yet (no snapshots/assessments recorded) — honest empty.');

  return {
    key: 'career_journey',
    label: 'Career Journey',
    present,
    axes: {
      coverage: { present, detail: `${events.length} timeline event(s) from append-only history` },
      confidence: {
        band: present ? 'Recorded' : 'None',
        basis: 'append-only history (readiness / gap / simulation snapshots + competency assessment)',
        caps: ['historical_record'],
      },
    },
    data: present ? { count: events.length, events } : null,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Stitch all six components into the canonical passport profile.
// ---------------------------------------------------------------------------

export function buildPassportProfile(ctx: PassportContext): CareerPassportProfile {
  const sections = {
    competency_profile: competencySection(ctx),
    ei_profile: eiSection(ctx),
    career_profile: careerProfileSection(ctx),
    career_readiness: readinessSection(ctx),
    achievements: achievementsSection(ctx),
    career_journey: journeySection(ctx),
  };

  const all = Object.values(sections);
  const presentSections = all.filter((s) => s.present).map((s) => s.key);
  const sectionsTotal = all.length;
  const sectionsPresent = presentSections.length;
  const coveragePct = sectionsTotal > 0 ? Math.round((sectionsPresent / sectionsTotal) * 100) : 0;

  const sourceVersions: Record<string, string> = {
    career_passport_foundation: PASSPORT_PROFILE_VERSION,
    career_passport_engine: CAREER_PASSPORT_ENGINE_VERSION,
  };
  if (ctx.readiness?.version) sourceVersions.career_readiness = ctx.readiness.version;
  if (ctx.eiProfile?.version) sourceVersions.ei_profile = ctx.eiProfile.version;
  if (ctx.competencyProfile) sourceVersions.competency_profile = 'competency-runtime/getProfile';

  return {
    ok: true,
    subject_id: ctx.subject_id,
    version: PASSPORT_PROFILE_VERSION,
    generated_at: new Date().toISOString(),
    measurable: sectionsPresent > 0,
    coverage: {
      sections_total: sectionsTotal,
      sections_present: sectionsPresent,
      coverage_pct: coveragePct,
      present_sections: presentSections,
    },
    sections,
    source_versions: sourceVersions,
    language_policy: ctx.eiProfile?.language_policy ?? LANGUAGE_POLICY,
    notes: ctx.notes,
  };
}
