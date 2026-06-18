/**
 * Adaptive Questioning — Trait Inference (Phase B, pure)
 *
 * Shared vocabulary + helpers for the adaptive clarity pipeline. Clarity
 * questions are predominantly DISTRESS-worded ("I avoid hard tasks", "I doubt
 * myself"). We therefore model every trait as a *distress intensity* in 0..1
 * where 1 = maximum presence of that distress trait (e.g. the respondent
 * answers "Yes, often" to a distress-worded stem).
 *
 * Named confidence/performance "levels" used by the contradiction-pair engine
 * are DERIVED from the underlying distress traits so polarity stays explicit
 * and in one place (see `deriveLevels`).
 *
 * Everything here is pure (no IO, no DB, deterministic) so it is trivially
 * unit-testable with `npx tsx` and safe to call inside the hot `/analyze` path.
 */

// ─── Shared types ─────────────────────────────────────────────────────────────

export type TraitToken = string;

/** A single answered clarity question, normalised for the pipeline. */
export interface PriorAnswer {
  id: string;
  question: string;
  /** Distress intensity 0..1 (1 = strongest presence of the distress trait). */
  response_value: number;
  response_label?: string;
}

/** A candidate clarity question (mirrors the picker `CQ` element shape). */
export interface Candidate {
  id: string;
  question: string;
  options?: string[];
  response_type?: string;
}

export interface TraitStat {
  /** Sum of distress intensities observed for this trait. */
  sum: number;
  /** Number of answered questions that touched this trait. */
  count: number;
  /** Mean distress intensity (sum / count). */
  mean: number;
}

export type TraitMap = Record<TraitToken, TraitStat>;

// ─── Trait vocabulary ─────────────────────────────────────────────────────────
//
// Each trait maps to lowercase substrings matched against the question stem.
// Curated rather than generated — quality over coverage. A stem can carry
// multiple traits. Keep substrings discriminative (avoid words so generic they
// fire on every stem).

export const TRAIT_KEYWORDS: Record<TraitToken, string[]> = {
  self_doubt: [
    'doubt', 'not good enough', 'good enough', 'insecure', 'unsure of myself',
    'lack confidence', 'inadequate', 'worthless', 'second-guess', 'second guess',
    'not capable', 'can i do', 'believe in myself', 'self-belief', 'self belief',
  ],
  avoidance: [
    'avoid', 'put off', 'putting off', 'procrastinat', 'escape', 'delay',
    'postpone', 'withdraw', 'skip', 'run away', 'dodge', 'stay away', 'duck out',
  ],
  perfectionism: [
    'perfect', 'flawless', 'never good enough', 'high standard', 'redo',
    'not satisfied', 'mistakes unacceptable', 'every detail', 'must be right',
    'over-prepare', 'over prepare', 'nitpick',
  ],
  impulsivity: [
    'rush', 'hurry', 'immediately', 'without thinking', 'impulsive', 'act fast',
    'jump in', 'jump straight', 'hasty', 'quick decision', 'rapidly', 'right away',
    'spur of the moment', 'before thinking',
  ],
  underperformance: [
    'underperform', 'fail', 'poor result', 'fall short', 'below expectation',
    'bad grade', 'low marks', 'mistakes', 'errors', 'mess up', 'mess it up',
    'not deliver', 'underachiev',
  ],
  overthinking: [
    'overthink', 'over-think', 'ruminate', "can't stop thinking", 'cant stop thinking',
    'analyse too much', 'analyze too much', 'dwell', 'replay', 'keep thinking',
    'mind keeps', 'too much in my head',
  ],
  focus_difficulty: [
    'distract', 'lose focus', "can't concentrate", 'cant concentrate',
    'mind wander', 'attention', 'off track', 'lose track', 'zone out', 'drift off',
  ],
  anxiety: [
    'anxious', 'nervous', 'panic', 'fear', 'worried', 'worry', 'tense', 'stress',
    'overwhelm', 'on edge', 'butterflies', 'dread',
  ],
  low_motivation: [
    'unmotivated', 'no energy', "can't start", 'cant start', 'lazy', 'give up',
    'lack drive', 'demotivat', 'no interest', "don't feel like", 'pointless',
  ],
  social_difficulty: [
    'shy', 'awkward', 'isolate', 'lonely', 'social', 'talking to people',
    'in a group', 'speak up', 'reach out', 'judged by others',
  ],
  emotional_dysregulation: [
    'angry', 'frustrat', 'cry', 'mood', 'emotional', 'irritat', 'lose my temper',
    'snap', 'overwhelmed by', 'bottle up', 'shut down',
  ],
};

const TRAIT_TOKENS = Object.keys(TRAIT_KEYWORDS);

// ─── Inference ────────────────────────────────────────────────────────────────

/** Returns the set of distress traits a question stem touches (may be empty). */
export function inferQuestionTraits(text: string): TraitToken[] {
  if (!text) return [];
  const hay = text.toLowerCase();
  const out: TraitToken[] = [];
  for (const trait of TRAIT_TOKENS) {
    if (TRAIT_KEYWORDS[trait].some((kw) => hay.includes(kw))) out.push(trait);
  }
  return out;
}

/**
 * Builds the cumulative trait map from the answered questions. Each answer's
 * distress intensity is attributed to every trait its stem touches.
 */
export function buildTraitMap(answers: PriorAnswer[]): TraitMap {
  const map: TraitMap = {};
  for (const a of answers) {
    const v = clamp01(a.response_value);
    for (const trait of inferQuestionTraits(a.question)) {
      const cur = map[trait] ?? { sum: 0, count: 0, mean: 0 };
      cur.sum += v;
      cur.count += 1;
      cur.mean = cur.sum / cur.count;
      map[trait] = cur;
    }
  }
  return map;
}

// ─── Derived, polarity-explicit levels ────────────────────────────────────────

export interface DerivedLevels {
  /** 1 = high confidence. null when no self_doubt evidence yet. */
  confidence: number | null;
  /** 1 = strong performance. null when no underperformance evidence yet. */
  performance: number | null;
  /** 1 = high avoidance. null when unobserved. */
  avoidance: number | null;
  /** 1 = high perfectionism. null when unobserved. */
  perfectionism: number | null;
  /** 1 = very rapid / impulsive execution. null when unobserved. */
  executionSpeed: number | null;
}

/**
 * Translates distress traits into the polarity-explicit levels the
 * contradiction-pair rules are phrased in. self_doubt and underperformance are
 * distress traits, so their *levels* are inverted (high distress → low level).
 */
export function deriveLevels(t: TraitMap): DerivedLevels {
  const lvlInverse = (token: TraitToken): number | null =>
    t[token] ? clamp01(1 - t[token].mean) : null;
  const lvlDirect = (token: TraitToken): number | null =>
    t[token] ? clamp01(t[token].mean) : null;

  return {
    confidence: lvlInverse('self_doubt'),
    performance: lvlInverse('underperformance'),
    avoidance: lvlDirect('avoidance'),
    perfectionism: lvlDirect('perfectionism'),
    executionSpeed: lvlDirect('impulsivity'),
  };
}

// ─── Util ─────────────────────────────────────────────────────────────────────

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
