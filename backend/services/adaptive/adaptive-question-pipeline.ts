/**
 * Adaptive Questioning — Selection Pipeline (Phase B, T4 orchestrator, pure)
 *
 * Combines all five Phase-B capabilities into one deterministic pass over a
 * candidate pool given the answers so far:
 *
 *   #1 Dynamic Pathing  — candidates are ranked by relevance to the gaps the
 *                         prior answers reveal (info gain + contradiction probes).
 *   #2 Information Gain  — every candidate scored for expected new evidence.
 *   #3 Zero Repetition   — literal/semantic/signal duplicates suppressed.
 *   #4 Contradiction     — named trait contradictions detected → probe boost.
 *   #5 Adaptive Length   — stop-when-confident decision.
 *
 * Pure: no IO, no DB. The route layer fetches the candidate pool and persists;
 * this module only decides ordering + the stop signal, so it is fully unit
 * testable and safe to call inside the hot path.
 */

import {
  buildTraitMap,
  inferQuestionTraits,
  type Candidate,
  type PriorAnswer,
} from './trait-inference';
import { computeInformationGain, traitCoverage } from './information-gain';
import { classifyDuplicate, type DuplicateResult } from './zero-repetition';
import {
  detectTraitContradictions,
  type TraitContradiction,
} from './contradiction-pairs';
import { decideGovernance } from './question-governance-reject';
import {
  shouldStopInvestigating,
  type StopReason,
} from './adaptive-length';
import type { GovernanceRole } from '../hypothesis-question-governance';

export interface AnnotatedCandidate {
  id: string;
  question: string;
  options?: string[];
  response_type?: string;
  traits: string[];
  info_gain: number;
  duplicate: DuplicateResult;
  is_contradiction_probe: boolean;
  rejected: boolean;
  reject_reason: string | null;
  governance_role: GovernanceRole;
  governance_rationale: string;
  /** Final ranking score (accepted candidates only; rejected = -1). */
  score: number;
}

export interface AdaptiveSelectionInput {
  candidates: Candidate[];
  priorAnswers: PriorAnswer[];
  minQuestions?: number;
  maxQuestions?: number;
}

export interface AdaptiveSelectionResult {
  done: boolean;
  stop_reason: StopReason;
  confidence: number;
  answered_count: number;
  /** The single best next question, or null when done. */
  next_question: AnnotatedCandidate | null;
  /** All accepted candidates, ranked best-first (next_question is [0]). */
  ordered_questions: AnnotatedCandidate[];
  /** Candidates suppressed by the zero-repetition / governance layer. */
  rejected_questions: AnnotatedCandidate[];
  contradictions: TraitContradiction[];
  trait_coverage: Record<string, number>;
}

// Ranking weights — dynamic pathing prioritises new evidence and contradiction
// resolution over raw position in the picked pool.
const W_INFO_GAIN = 0.5;
const W_PROBE = 0.35;
const W_ROLE = 0.15;

const ROLE_PRIORITY: Record<GovernanceRole, number> = {
  weaken: 1, // resolving a contradiction is most valuable
  eliminate: 0.7,
  explore: 0.5,
  strengthen: 0.3,
};

export function runAdaptiveSelection(
  input: AdaptiveSelectionInput,
): AdaptiveSelectionResult {
  const answers = input.priorAnswers ?? [];
  const traitMap = buildTraitMap(answers);
  const contradictions = detectTraitContradictions(traitMap);
  const probeTraits = new Set(contradictions.flatMap((c) => c.probe_traits));

  const annotated: AnnotatedCandidate[] = (input.candidates ?? []).map((c) => {
    const traits = inferQuestionTraits(c.question);
    const infoGain = computeInformationGain(c, traitMap);
    const duplicate = classifyDuplicate(c, answers, traitMap);
    const isProbe = traits.some((t) => probeTraits.has(t));
    const cov = traits.length
      ? traits.reduce((s, t) => s + traitCoverage(traitMap, t), 0) / traits.length
      : 0;
    const decision = decideGovernance({
      infoGain,
      duplicate,
      isContradictionProbe: isProbe,
      traitCoverage: cov,
      targetTrait: traits[0] ?? '',
    });
    const score = decision.rejected
      ? -1
      : W_INFO_GAIN * infoGain
        + W_PROBE * (isProbe ? 1 : 0)
        + W_ROLE * ROLE_PRIORITY[decision.role];
    return {
      id: c.id,
      question: c.question,
      options: c.options,
      response_type: c.response_type,
      traits,
      info_gain: infoGain,
      duplicate,
      is_contradiction_probe: isProbe,
      rejected: decision.rejected,
      reject_reason: decision.reject_reason,
      governance_role: decision.role,
      governance_rationale: decision.rationale,
      score,
    };
  });

  const rejected = annotated.filter((a) => a.rejected);
  let accepted = annotated
    .filter((a) => !a.rejected)
    .sort((a, b) => b.score - a.score);

  // Never strand the user: if every candidate was suppressed but some remain,
  // surface the single highest-info-gain question (degrade gracefully).
  if (accepted.length === 0 && annotated.length > 0) {
    accepted = [...annotated].sort((a, b) => b.info_gain - a.info_gain).slice(0, 1);
  }

  const bestRemainingGain = accepted.length ? accepted[0].info_gain : 0;
  const stop = shouldStopInvestigating({
    answeredCount: answers.length,
    bestRemainingGain,
    openContradictions: contradictions.length,
    candidatesRemaining: accepted.length,
    traitMap,
    minQuestions: input.minQuestions,
    maxQuestions: input.maxQuestions,
  });

  const trait_coverage: Record<string, number> = {};
  for (const t of Object.keys(traitMap)) trait_coverage[t] = traitCoverage(traitMap, t);

  const done = stop.stop;
  return {
    done,
    stop_reason: stop.reason,
    confidence: stop.confidence,
    answered_count: answers.length,
    next_question: done ? null : (accepted[0] ?? null),
    ordered_questions: accepted,
    rejected_questions: rejected,
    contradictions,
    trait_coverage,
  };
}
