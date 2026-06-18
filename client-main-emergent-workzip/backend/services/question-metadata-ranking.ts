/**
 * CAPADEX AQ-2R — Runtime Metadata Ranking (pure, deterministic).
 *
 * Shared scorer that consumes the AQ-2 per-question metadata layer
 * (`capadex_question_metadata`, provenance `aq2_reconstruction`) to additively
 * re-rank a concern's curated clarity-question pool inside the LIVE picker
 * (`pickQuestionsFromMaster`). This module is the SINGLE source of truth for the
 * scoring math: BOTH the runtime picker AND the offline measurement harness
 * (`scripts/audit/aq-2r-runtime-activation-impl.ts`) import it, so the measured
 * "after" ordering is byte-faithful to the production ordering (see
 * .agents/memory/audit-runtime-fidelity.md — one scorer, no drift).
 *
 * Strictly additive: nothing here mutates data, fabricates metadata, or runs
 * unless the caller has already gated on `isRuntimeMetadataActivationEnabled()`.
 * Questions with NO metadata (LEFT-JOIN miss) score 0 on every dimension and
 * sort after metadata-bearing peers — they are never dropped (honest fallback).
 */

// AQ-2 canonical development stages (Phase 4 — progression order).
export const STAGE_ORDER = ['Awareness', 'Curiosity', 'Clarity', 'Growth', 'Mastery'] as const;
export type Stage = typeof STAGE_ORDER[number];

/** Ascending progression rank; unknown/absent stage sinks to the end. */
export function stageRank(stage: string | null | undefined): number {
  if (!stage) return STAGE_ORDER.length;
  const i = (STAGE_ORDER as readonly string[]).indexOf(stage);
  return i < 0 ? STAGE_ORDER.length : i;
}

// AQ-2 canonical personas.
export const CANONICAL_PERSONAS = ['Student', 'Parent', 'Teacher', 'Counselor', 'Professional', 'Entrepreneur'] as const;
export type CanonicalPersona = typeof CANONICAL_PERSONAS[number];

/**
 * Map a runtime persona key (snake_case sub-persona OR free-text label) to the
 * AQ-2 canonical persona used in `capadex_question_metadata.persona_primary` /
 * `personas`. Mirrors the bucket logic AQ-2 used when it built the layer so the
 * runtime and the reconstruction agree. Returns null when no confident bucket.
 */
export function canonicalPersonaFor(primaryPersona?: string | null): CanonicalPersona | null {
  const s = (primaryPersona || '').toLowerCase();
  if (!s.trim()) return null;
  if (/entrepreneur|founder|business[_ ]?owner|venture|startup|start-up|self[_ -]?employ/.test(s)) return 'Entrepreneur';
  if (/parent/.test(s)) return 'Parent';
  if (/counsel|mentor|coach|placement|career[_ ]?cell|success[_ ]?office/.test(s)) return 'Counselor';
  if (/teacher|educator|principal|faculty|academic[_ ]?operations/.test(s)) return 'Teacher';
  if (/professional|employee|job[_ ]?seeker|working|career[_ ]?transition|mid[_ -]?career|leadership/.test(s)) return 'Professional';
  if (/student|campus|learner|aspirant|explorer|self[_ -]?(exploration|discovery)|skill[_ ]?development/.test(s)) return 'Student';
  return null;
}

/** The metadata columns consumed by the scorer (subset of the AQ-2 table). */
export interface QuestionMetadata {
  age_min: number | null;
  age_max: number | null;
  age_band: string | null;
  age_confidence: number | null;
  personas: Record<string, number> | null;
  persona_primary: string | null;
  persona_confidence: number | null;
  dev_stage: string | null;
  dev_stage_confidence: number | null;
  primary_behavior: string | null;
  behavior_confidence: number | null;
  primary_capability: string | null;
  capability_confidence: number | null;
  signal_family: string | null;
  signal_strength: string | null;
  signal_confidence: number | null;
}

/** The user/concern context the question is being ranked against. */
export interface MetadataContext {
  age: number | null;
  ageBand: string | null;            // AQ-2 canonical band, e.g. "18-24"
  canonicalPersona: CanonicalPersona | null;
}

// Component weights (sum = 1.0). Age + persona dominate (relevance), signal next
// (evidence quality, Phase 7), behaviour/capability are construct-targeting
// (Phases 5/6), stage is a light quality signal (ordering carries progression).
export const META_WEIGHTS = {
  age: 0.30,
  persona: 0.25,
  signal: 0.20,
  behavior: 0.10,
  capability: 0.10,
  stage: 0.05,
} as const;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Canonical AQ-2 age band for a raw age (mirrors the reconstruction bands). */
export function ageBandForAge(age: number | null | undefined): string | null {
  if (age == null || !Number.isFinite(age)) return null;
  let x = age;
  if (x < 11) x = 11;
  if (x <= 13) return '11-13';
  if (x <= 17) return '14-17';
  if (x <= 24) return '18-24';
  if (x <= 45) return '25-45';
  return '46+';
}

export interface MetaScoreResult {
  score: number;                       // 0..1 composite
  components: {
    age: number;
    persona: number;
    signal: number;
    behavior: number;
    capability: number;
    stage: number;
  };
}

/**
 * Pure metadata match score in [0,1]. Each component is a 0..1 match quality;
 * the composite is the weighted sum. No metadata → 0 (sorts last, never dropped).
 *
 * - age:      exact canonical-band match = 1.0; numeric [age_min,age_max] overlap
 *             with the user band/age = 0.5; else 0. (Hard age eligibility is still
 *             enforced family-side in SQL; this only PREFERS per-question matches.)
 * - persona:  the user's canonical-persona relevance score from `personas` JSONB;
 *             falls back to persona_confidence when persona_primary matches.
 * - signal:   signal_confidence (evidence quality).
 * - behavior: behavior_confidence when a primary_behavior is present.
 * - capability: capability_confidence when a primary_capability is present.
 * - stage:    dev_stage_confidence (clarity of the stage assignment).
 */
export function scoreQuestionMetadata(meta: QuestionMetadata | null, ctx: MetadataContext): MetaScoreResult {
  const zero: MetaScoreResult = { score: 0, components: { age: 0, persona: 0, signal: 0, behavior: 0, capability: 0, stage: 0 } };
  if (!meta) return zero;

  // age
  let age = 0;
  const userBand = ctx.ageBand || ageBandForAge(ctx.age);
  if (meta.age_band && userBand && meta.age_band === userBand) {
    age = 1;
  } else if (meta.age_min != null && meta.age_max != null) {
    if (ctx.age != null && Number.isFinite(ctx.age) && meta.age_min <= ctx.age && meta.age_max >= ctx.age) {
      age = 0.5;
    }
  }

  // persona
  let persona = 0;
  if (ctx.canonicalPersona) {
    const fromMap = meta.personas && typeof meta.personas === 'object' ? num(meta.personas[ctx.canonicalPersona]) : 0;
    if (fromMap > 0) persona = clamp01(fromMap);
    else if (meta.persona_primary === ctx.canonicalPersona) persona = clamp01(num(meta.persona_confidence));
  }

  const signal = clamp01(num(meta.signal_confidence));
  const behavior = meta.primary_behavior ? clamp01(num(meta.behavior_confidence)) : 0;
  const capability = meta.primary_capability ? clamp01(num(meta.capability_confidence)) : 0;
  const stage = clamp01(num(meta.dev_stage_confidence));

  const score =
    META_WEIGHTS.age * age +
    META_WEIGHTS.persona * persona +
    META_WEIGHTS.signal * signal +
    META_WEIGHTS.behavior * behavior +
    META_WEIGHTS.capability * capability +
    META_WEIGHTS.stage * stage;

  return { score: Math.round(score * 1e6) / 1e6, components: { age, persona, signal, behavior, capability, stage } };
}

/** The SELECT-list fragment of metadata columns (aliased `m`) the picker joins. */
export const META_SELECT_COLS = `
  m.age_min            AS m_age_min,
  m.age_max            AS m_age_max,
  m.age_band           AS m_age_band,
  m.age_confidence     AS m_age_confidence,
  m.personas           AS m_personas,
  m.persona_primary    AS m_persona_primary,
  m.persona_confidence AS m_persona_confidence,
  m.dev_stage          AS m_dev_stage,
  m.dev_stage_confidence AS m_dev_stage_confidence,
  m.primary_behavior   AS m_primary_behavior,
  m.behavior_confidence AS m_behavior_confidence,
  m.primary_capability AS m_primary_capability,
  m.capability_confidence AS m_capability_confidence,
  m.signal_family      AS m_signal_family,
  m.signal_strength    AS m_signal_strength,
  m.signal_confidence  AS m_signal_confidence`;

/** The LEFT JOIN fragment binding metadata to clarity rows by question_id. */
export const META_JOIN = `LEFT JOIN capadex_question_metadata m ON m.question_id = q.question_id`;

/** Hydrate a raw SQL row's aliased `m_*` columns into a QuestionMetadata (or null). */
export function metaFromRow(row: Record<string, any>): QuestionMetadata | null {
  // A LEFT-JOIN miss leaves every alias null; treat that as "no metadata".
  const anyPresent =
    row.m_age_band != null || row.m_persona_primary != null || row.m_dev_stage != null ||
    row.m_primary_behavior != null || row.m_primary_capability != null || row.m_signal_family != null ||
    row.m_age_min != null;
  if (!anyPresent) return null;
  let personas: Record<string, number> | null = null;
  const rawP = row.m_personas;
  if (rawP != null) {
    try { personas = typeof rawP === 'string' ? JSON.parse(rawP) : rawP; } catch { personas = null; }
  }
  const n = (v: any): number | null => (v == null ? null : Number(v));
  return {
    age_min: n(row.m_age_min),
    age_max: n(row.m_age_max),
    age_band: row.m_age_band ?? null,
    age_confidence: n(row.m_age_confidence),
    personas,
    persona_primary: row.m_persona_primary ?? null,
    persona_confidence: n(row.m_persona_confidence),
    dev_stage: row.m_dev_stage ?? null,
    dev_stage_confidence: n(row.m_dev_stage_confidence),
    primary_behavior: row.m_primary_behavior ?? null,
    behavior_confidence: n(row.m_behavior_confidence),
    primary_capability: row.m_primary_capability ?? null,
    capability_confidence: n(row.m_capability_confidence),
    signal_family: row.m_signal_family ?? null,
    signal_strength: row.m_signal_strength ?? null,
    signal_confidence: n(row.m_signal_confidence),
  };
}
