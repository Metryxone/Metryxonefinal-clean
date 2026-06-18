/**
 * Adaptive Questioning — Governance Rejection Predicate (Phase B, T3, pure)
 *
 * A single predicate that decides whether a candidate should be REJECTED from
 * the next-question pool, and (for accepted candidates) what governance role it
 * plays. Roles reuse the existing hypothesis governance vocabulary
 * (explore / weaken / strengthen / eliminate) via `classifyGovernance` so the
 * adaptive layer speaks the same language as the hypothesis engine.
 *
 * Reject when:
 *   - the candidate is any kind of duplicate (zero-repetition), OR
 *   - its information gain is below the floor (adds no new evidence).
 *
 * Pure + deterministic.
 */

import { classifyGovernance, type GovernanceRole } from '../hypothesis-question-governance';
import type { DuplicateResult } from './zero-repetition';

/** Info-gain at/below which a non-duplicate question is still rejected. */
export const MIN_INFO_GAIN = 0.1;

export interface GovernanceDecisionInput {
  infoGain: number;
  duplicate: DuplicateResult;
  /** True when the candidate targets a trait flagged by a contradiction probe. */
  isContradictionProbe: boolean;
  /** Mean coverage of the candidate's traits (0..1); high → already strong. */
  traitCoverage: number;
  /** Dominant trait the candidate targets (governance rationale label). */
  targetTrait: string;
}

export interface GovernanceDecision {
  rejected: boolean;
  reject_reason: 'duplicate' | 'zero_information_gain' | null;
  role: GovernanceRole;
  rationale: string;
}

export function decideGovernance(input: GovernanceDecisionInput): GovernanceDecision {
  if (input.duplicate.isDuplicate) {
    return {
      rejected: true,
      reject_reason: 'duplicate',
      role: 'explore',
      rationale: `Suppressed: ${input.duplicate.kind} duplicate of an answered question.`,
    };
  }
  if (input.infoGain <= MIN_INFO_GAIN) {
    return {
      rejected: true,
      reject_reason: 'zero_information_gain',
      role: 'explore',
      rationale: 'Suppressed: adds negligible new evidence.',
    };
  }

  // Accepted — classify the role using the shared hypothesis governance engine.
  // Map adaptive signals onto its input contract:
  //   band     — high trait coverage → 'strong' (we already know a lot here)
  //   relevance/confidenceGain ← info gain
  //   contradictionProbe ← whether this resolves a named contradiction
  const band = input.traitCoverage >= 0.66 ? 'strong'
             : input.traitCoverage >= 0.34 ? 'moderate'
             : 'weak';
  const gov = classifyGovernance({
    targetConstruct: input.targetTrait || 'behavioural_signal',
    band,
    relevance: input.infoGain,
    contradictionProbe: input.isContradictionProbe ? 0.8 : 0,
    confidenceGain: input.infoGain,
  });

  return {
    rejected: false,
    reject_reason: null,
    role: gov.role,
    rationale: gov.rationale,
  };
}
