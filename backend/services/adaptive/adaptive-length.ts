/**
 * Adaptive Questioning — Adaptive Length (Phase B, T9, pure)
 *
 * Objective #5: stop when confident rather than always asking a fixed count.
 * The clarity phase ends early once the remaining questions stop adding
 * meaningful evidence AND there are no open contradictions to resolve — but
 * never before a minimum, and never beyond a maximum.
 *
 * Pure + deterministic.
 */

import { type TraitMap } from './trait-inference';

export const DEFAULT_MIN_QUESTIONS = 3;
export const DEFAULT_MAX_QUESTIONS = 10;
/** Best remaining info-gain below this counts as "no new evidence available". */
export const MARGINAL_GAIN_EPSILON = 0.18;

export type StopReason =
  | 'max_reached'
  | 'confidence_sufficient'
  | 'no_more_questions'
  | null;

export interface StopInput {
  answeredCount: number;
  /** Highest information-gain among the still-available candidates. */
  bestRemainingGain: number;
  /** Count of unresolved trait contradictions. */
  openContradictions: number;
  /** Whether any candidate questions remain at all. */
  candidatesRemaining: number;
  traitMap: TraitMap;
  minQuestions?: number;
  maxQuestions?: number;
}

export interface StopResult {
  stop: boolean;
  reason: StopReason;
  /** 0..1 — how confident the picture is (mean trait coverage). */
  confidence: number;
}

/** Mean coverage across all explored traits (saturates at 3 answers/trait). */
export function explorationConfidence(map: TraitMap): number {
  const traits = Object.values(map);
  if (traits.length === 0) return 0;
  const cov = traits.map((t) => Math.min(1, t.count / 3));
  return cov.reduce((s, c) => s + c, 0) / cov.length;
}

export function shouldStopInvestigating(input: StopInput): StopResult {
  const min = input.minQuestions ?? DEFAULT_MIN_QUESTIONS;
  const max = input.maxQuestions ?? DEFAULT_MAX_QUESTIONS;
  const confidence = explorationConfidence(input.traitMap);

  // Nothing left to ask — always stop.
  if (input.candidatesRemaining <= 0) {
    return { stop: true, reason: 'no_more_questions', confidence };
  }
  // Hard cap.
  if (input.answeredCount >= max) {
    return { stop: true, reason: 'max_reached', confidence };
  }
  // Floor — always ask at least `min`.
  if (input.answeredCount < min) {
    return { stop: false, reason: null, confidence };
  }
  // Open contradictions must be probed before we can stop on confidence.
  if (input.openContradictions > 0) {
    return { stop: false, reason: null, confidence };
  }
  // Confident enough: remaining questions add little new evidence.
  if (input.bestRemainingGain < MARGINAL_GAIN_EPSILON) {
    return { stop: true, reason: 'confidence_sufficient', confidence };
  }
  return { stop: false, reason: null, confidence };
}
