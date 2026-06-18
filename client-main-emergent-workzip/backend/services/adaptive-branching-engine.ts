/**
 * Adaptive Branching Engine — Phase 4 (additive, shadow-mode).
 *
 * Decides the next-question policy from current session state. Pure-function
 * `chooseBranch` for unit tests; `recordBranch` is best-effort persistence.
 * Never affects assessment scoring or UI.
 */
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';

export const ADAPTIVE_BRANCHING_VERSION = '1.0.0';

export type BranchPolicy =
  | 'escalate_depth'        // increase depth_level for the same competency
  | 'reduce_ambiguity'      // probe for a concrete example
  | 'probe_contradiction'   // ask a contradiction-targeted question
  | 'increase_complexity'   // raise scenario complexity (multi-stakeholder, etc.)
  | 'shift_focus'           // change to next competency in priority list
  | 'maintain';             // no change

export type BranchReasonCode =
  | 'low_quality_response'
  | 'high_quality_response'
  | 'contradiction_pending'
  | 'cognitive_underrepresented'
  | 'competency_coverage_complete'
  | 'no_signal';

export type BranchDecision = {
  policy: BranchPolicy;
  reasonCode: BranchReasonCode;
  nextCompetencyId?: string;
  nextDepthLevel: number;
  engineVersion: string;
};

export type BranchInput = {
  currentCompetencyId: string;
  currentDepthLevel: number;
  lastQualityScore?: number;       // 0..1
  pendingContradictions: number;   // count of unresolved contradictions
  cognitiveSignalsCovered: number; // 0..7
  competencyCoverage: Record<string, number>;  // competencyId → answered count
  competencyPriority: string[];    // ordered priority list
  minCoveragePerCompetency?: number; // default 2
};

export function chooseBranch(input: BranchInput): BranchDecision {
  const minCov = input.minCoveragePerCompetency ?? 2;

  // 1. Contradictions outstanding → probe.
  if (input.pendingContradictions > 0) {
    return {
      policy: 'probe_contradiction', reasonCode: 'contradiction_pending',
      nextCompetencyId: input.currentCompetencyId,
      nextDepthLevel: Math.max(input.currentDepthLevel, 2),
      engineVersion: ADAPTIVE_BRANCHING_VERSION,
    };
  }

  // 2. Underrepresented cognitive signals → escalate complexity.
  if (input.cognitiveSignalsCovered < 4) {
    return {
      policy: 'increase_complexity', reasonCode: 'cognitive_underrepresented',
      nextCompetencyId: input.currentCompetencyId,
      nextDepthLevel: Math.min(5, input.currentDepthLevel + 1),
      engineVersion: ADAPTIVE_BRANCHING_VERSION,
    };
  }

  // 3. Low-quality answer → reduce ambiguity and stay on competency.
  if (typeof input.lastQualityScore === 'number' && input.lastQualityScore < 0.35) {
    return {
      policy: 'reduce_ambiguity', reasonCode: 'low_quality_response',
      nextCompetencyId: input.currentCompetencyId,
      nextDepthLevel: input.currentDepthLevel,
      engineVersion: ADAPTIVE_BRANCHING_VERSION,
    };
  }

  // 4. High-quality answer and competency coverage already met → shift focus.
  const currentCov = input.competencyCoverage[input.currentCompetencyId] ?? 0;
  if (typeof input.lastQualityScore === 'number' && input.lastQualityScore >= 0.75 && currentCov >= minCov) {
    const next = input.competencyPriority.find(
      (c) => c !== input.currentCompetencyId && (input.competencyCoverage[c] ?? 0) < minCov,
    );
    if (next) {
      return {
        policy: 'shift_focus', reasonCode: 'high_quality_response',
        nextCompetencyId: next, nextDepthLevel: 1,
        engineVersion: ADAPTIVE_BRANCHING_VERSION,
      };
    }
    return {
      policy: 'maintain', reasonCode: 'competency_coverage_complete',
      nextCompetencyId: input.currentCompetencyId,
      nextDepthLevel: input.currentDepthLevel,
      engineVersion: ADAPTIVE_BRANCHING_VERSION,
    };
  }

  // 5. Medium-quality answer with room to grow → escalate depth.
  if (typeof input.lastQualityScore === 'number' && input.lastQualityScore >= 0.5) {
    return {
      policy: 'escalate_depth', reasonCode: 'high_quality_response',
      nextCompetencyId: input.currentCompetencyId,
      nextDepthLevel: Math.min(5, input.currentDepthLevel + 1),
      engineVersion: ADAPTIVE_BRANCHING_VERSION,
    };
  }

  // Default — keep going on same competency.
  return {
    policy: 'maintain', reasonCode: 'no_signal',
    nextCompetencyId: input.currentCompetencyId,
    nextDepthLevel: input.currentDepthLevel,
    engineVersion: ADAPTIVE_BRANCHING_VERSION,
  };
}

export async function recordBranch(
  pool: Pool,
  args: { sessionId: string; fromQuestionId?: string; decision: BranchDecision },
): Promise<string | null> {
  try {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO adaptive_question_branches
         (id, session_id, from_question_id, policy, reason_code, decision, engine_version)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [id, args.sessionId, args.fromQuestionId ?? null,
       args.decision.policy, args.decision.reasonCode,
       JSON.stringify(args.decision), args.decision.engineVersion],
    );
    return id;
  } catch (err) {
    console.warn('[branching-engine] persist failed:', (err as Error).message);
    return null;
  }
}
