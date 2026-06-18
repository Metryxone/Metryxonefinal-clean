/**
 * Adaptive Questioning — Zero Repetition Engine (Phase B, T7, pure)
 *
 * Objective #3: never re-ask. Three layers of duplicate detection between a
 * candidate and the already-answered set:
 *
 *   literal   — same id, or identical normalised stem text
 *   semantic  — high token-overlap (Jaccard) with an answered stem
 *   signal    — every trait the candidate touches is already saturated, so it
 *               adds no new behavioural evidence even if worded differently
 *
 * Pure + deterministic.
 */

import {
  buildTraitMap,
  inferQuestionTraits,
  type Candidate,
  type PriorAnswer,
  type TraitMap,
} from './trait-inference';
import { SATURATION_COUNT } from './information-gain';

export type DuplicateKind = 'literal' | 'semantic' | 'signal' | null;

export interface DuplicateResult {
  isDuplicate: boolean;
  kind: DuplicateKind;
  /** 0..1 — overlap strength for semantic; 1 for literal; coverage for signal. */
  score: number;
}

/** Jaccard threshold above which two stems are considered the same question. */
export const SEMANTIC_THRESHOLD = 0.82;

const STOPWORDS = new Set([
  'the', 'and', 'are', 'you', 'your', 'for', 'with', 'that', 'this', 'have',
  'has', 'how', 'when', 'what', 'why', 'who', 'does', 'did', 'will', 'would',
  'can', 'could', 'should', 'about', 'they', 'them', 'their', 'from', 'feel',
  'feeling', 'often', 'sometimes', 'usually', 'tend', 'into', 'more', 'most',
]);

export function normaliseStem(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenSet(text: string): Set<string> {
  return new Set(
    normaliseStem(text)
      .split(' ')
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Classifies whether a candidate duplicates the answered set. `traitMap` may be
 * supplied to avoid rebuilding it per-candidate (the pipeline passes it in).
 */
export function classifyDuplicate(
  candidate: Candidate,
  answered: PriorAnswer[],
  traitMap?: TraitMap,
): DuplicateResult {
  const answeredIds = new Set(answered.map((a) => a.id));
  const candNorm = normaliseStem(candidate.question);

  // 1. literal — id or exact normalised text
  if (answeredIds.has(candidate.id)) {
    return { isDuplicate: true, kind: 'literal', score: 1 };
  }
  for (const a of answered) {
    if (normaliseStem(a.question) === candNorm && candNorm.length > 0) {
      return { isDuplicate: true, kind: 'literal', score: 1 };
    }
  }

  // 2. semantic — token Jaccard
  const candTokens = tokenSet(candidate.question);
  let bestSem = 0;
  for (const a of answered) {
    bestSem = Math.max(bestSem, jaccard(candTokens, tokenSet(a.question)));
  }
  if (bestSem >= SEMANTIC_THRESHOLD) {
    return { isDuplicate: true, kind: 'semantic', score: bestSem };
  }

  // 3. signal — every candidate trait already saturated
  const map = traitMap ?? buildTraitMap(answered);
  const traits = inferQuestionTraits(candidate.question);
  if (traits.length > 0) {
    const allSaturated = traits.every(
      (t) => (map[t]?.count ?? 0) >= SATURATION_COUNT,
    );
    if (allSaturated) {
      return { isDuplicate: true, kind: 'signal', score: 1 };
    }
  }

  return { isDuplicate: false, kind: null, score: bestSem };
}
