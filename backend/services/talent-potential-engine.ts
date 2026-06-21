/**
 * PHASE 5.11 — Hiring Intelligence: talent_potential_engine (services).
 *
 * Produces two DEVELOPMENTAL, coverage-gated indices for a (job, candidate):
 *   - Leadership Potential — composite of operator scores on LEADERSHIP-tagged interview
 *     criteria + panel strengths mentioning leadership themes. Abstains (null) when leadership
 *     was not assessed (no leadership-tagged criteria / no feedback) — coverage discloses this.
 *   - Growth Potential     — composite of operator scores on GROWTH/LEARNING-tagged criteria +
 *     observed improvement trajectory across interview rounds.
 *
 * Criterion tagging is lexicon-based: Coverage honestly reflects how much of the theme was
 * actually assessed by operators. Contract: PURE READ / compose-never-recompute, never-throws,
 * IDOR job-scoped, honesty-first (unmeasured ⇒ null, NOT 0). These are directional development
 * signals — NOT promotion/leadership predictions and NOT a hire/reject verdict.
 */

import type { Pool } from 'pg';
import {
  type Evidence, type EngineResult,
  composite, ok, resolveEvidence,
  criterionMeanPctMatching, strengthsMentionPct, improvementTrajectoryPct,
  LEADERSHIP_TERMS, GROWTH_TERMS, evidenceSummary,
  HIRING_INTELLIGENCE_DISCLAIMER, HIRING_INTELLIGENCE_VERSION, PROVENANCE,
} from './hiring-intelligence-shared';

// Pure: compose the two potential indices from already-loaded evidence.
export function computeTalentPotentialFromEvidence(ev: Evidence) {
  const leadCrit = criterionMeanPctMatching(ev.scores, LEADERSHIP_TERMS);
  const leadStrengths = strengthsMentionPct(ev.feedback, LEADERSHIP_TERMS);
  const growthCrit = criterionMeanPctMatching(ev.scores, GROWTH_TERMS);
  const trajectory = improvementTrajectoryPct(ev.scores, ev.interview_order);

  const leadership_potential = composite([
    {
      key: 'leadership_criteria', label: 'Leadership-tagged criteria', weight: 0.7,
      value: leadCrit.mean,
      source: `interview_scores (${leadCrit.matched_scores} score(s) on ${leadCrit.matched_criteria.length} criterion/criteria)`,
    },
    {
      key: 'leadership_strengths', label: 'Leadership mentions in strengths', weight: 0.3,
      value: leadStrengths.pct,
      source: `interview_feedback (${leadStrengths.mentions}/${leadStrengths.n} mention leadership)`,
    },
  ]);

  const growth_potential = composite([
    {
      key: 'growth_criteria', label: 'Growth/learning-tagged criteria', weight: 0.6,
      value: growthCrit.mean,
      source: `interview_scores (${growthCrit.matched_scores} score(s) on ${growthCrit.matched_criteria.length} criterion/criteria)`,
    },
    {
      key: 'improvement_trajectory', label: 'Improvement trajectory across rounds', weight: 0.4,
      value: trajectory,
      source: trajectory != null ? 'interview_scores (>=2 scored interviews)' : 'needs >=2 scored interviews',
    },
  ]);

  return {
    leadership_potential,
    growth_potential,
    leadership_criteria_assessed: leadCrit.matched_criteria,
    growth_criteria_assessed: growthCrit.matched_criteria,
  };
}

// GET entry: load evidence once (IDOR-guarded) then compose. Never writes.
export async function computeTalentPotential(
  pool: Pool, jobId: string, candidateId: string,
): Promise<EngineResult> {
  const resolved = await resolveEvidence(pool, jobId, candidateId);
  if (!resolved.ok) return resolved;
  const ev = resolved.data;
  const indices = computeTalentPotentialFromEvidence(ev);
  return ok({
    engine: 'talent_potential_engine',
    version: HIRING_INTELLIGENCE_VERSION,
    job_id: ev.job_id,
    candidate_id: ev.candidate_id,
    ...indices,
    evidence: evidenceSummary(ev),
    provenance: PROVENANCE,
    disclaimer: HIRING_INTELLIGENCE_DISCLAIMER,
  });
}
