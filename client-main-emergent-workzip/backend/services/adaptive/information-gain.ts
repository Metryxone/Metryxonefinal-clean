/**
 * Adaptive Questioning — Information Gain model (Phase B, T2, pure)
 *
 * Objective #2: "every question generates new evidence". Each candidate is
 * scored 0..1 for the *expected new evidence* it adds given what has already
 * been asked. A question whose traits are already well-covered yields low gain;
 * a question probing an unexplored trait yields high gain.
 *
 * Pure + deterministic. No IO.
 */

import {
  buildTraitMap,
  inferQuestionTraits,
  type Candidate,
  type PriorAnswer,
  type TraitMap,
} from './trait-inference';

/** Answers needed on a trait before it counts as fully saturated. */
export const SATURATION_COUNT = 3;

/** Coverage of a trait grows with how many times it has been answered. */
export function traitCoverage(map: TraitMap, trait: string): number {
  const count = map[trait]?.count ?? 0;
  if (count <= 0) return 0;
  return Math.min(1, count / SATURATION_COUNT);
}

/**
 * Expected new evidence a candidate adds. Mean over its traits of
 * (1 - coverage). A candidate with NO recognised trait returns a neutral
 * mid-value (we cannot prove it is redundant, so we do not over-penalise it).
 */
export function computeInformationGain(
  candidate: Candidate,
  map: TraitMap,
): number {
  const traits = inferQuestionTraits(candidate.question);
  if (traits.length === 0) return 0.5;
  const gains = traits.map((t) => 1 - traitCoverage(map, t));
  return gains.reduce((s, g) => s + g, 0) / gains.length;
}

/** Convenience: build the trait map from answers then score one candidate. */
export function informationGainFromAnswers(
  candidate: Candidate,
  answers: PriorAnswer[],
): number {
  return computeInformationGain(candidate, buildTraitMap(answers));
}
