/**
 * PHASE 5.11 — Hiring Intelligence: success_prediction_engine (services).
 *
 * Produces two DEVELOPMENTAL, coverage-gated indices for a (job, candidate):
 *   - Success Potential   — composite of interview evaluation + operator-entered match score
 *     + operator-entered assessment score.
 *   - Retention Potential — composite of operator rating + evaluation consistency across
 *     rounds + EI signal. Retention is THINLY evidenced by interview data; coverage is
 *     reported honestly and the index abstains (null) when no supporting evidence exists.
 *
 * Contract: PURE READ / compose-never-recompute, never-throws, IDOR job-scoped, honesty-first
 * (unmeasured ⇒ null, NOT 0). These are directional development signals — NOT a prediction of
 * job success/tenure and NOT a hire/reject verdict. The name "prediction" denotes a composite
 * of operator-recorded evidence, not a forecast.
 */

import type { Pool } from 'pg';
import {
  type Evidence, type EngineResult,
  composite, ok, resolveEvidence,
  evaluationMeanPct, evaluationConsistencyPct,
  evidenceSummary,
  HIRING_INTELLIGENCE_DISCLAIMER, HIRING_INTELLIGENCE_VERSION, PROVENANCE,
} from './hiring-intelligence-shared';

// Pure: compose the two success indices from already-loaded evidence.
export function computeSuccessPredictionFromEvidence(ev: Evidence) {
  const evalMean = evaluationMeanPct(ev.scores);
  const consistency = evaluationConsistencyPct(ev.scores, ev.interview_order);
  const c = ev.candidate;

  const success_potential = composite([
    {
      key: 'interview_evaluation', label: 'Interview evaluation', weight: 0.45,
      value: evalMean.mean, source: `interview_scores (${evalMean.n} score(s))`,
    },
    {
      key: 'match_score', label: 'Operator match score', weight: 0.30,
      value: c.match_score, source: c.match_score != null ? 'employer_candidates.match_score' : 'not recorded',
    },
    {
      key: 'assessment_score', label: 'Assessment score', weight: 0.25,
      value: c.assessment_score, source: c.assessment_score != null ? 'employer_candidates.assessment_score' : 'not recorded',
    },
  ]);

  const retention_potential = composite([
    {
      key: 'operator_rating', label: 'Operator rating', weight: 0.5,
      value: c.rating, source: c.rating != null ? 'employer_candidates.rating' : 'not recorded',
    },
    {
      key: 'evaluation_consistency', label: 'Evaluation consistency across rounds', weight: 0.3,
      value: consistency, source: consistency != null ? 'interview_scores (>=2 scored interviews)' : 'needs >=2 scored interviews',
    },
    {
      key: 'ei_signal', label: 'Operator EI signal', weight: 0.2,
      value: c.ei_score, source: c.ei_score != null ? 'employer_candidates.ei_score' : 'not recorded',
    },
  ]);

  return { success_potential, retention_potential };
}

// GET entry: load evidence once (IDOR-guarded) then compose. Never writes.
export async function computeSuccessPrediction(
  pool: Pool, jobId: string, candidateId: string,
): Promise<EngineResult> {
  const resolved = await resolveEvidence(pool, jobId, candidateId);
  if (!resolved.ok) return resolved;
  const ev = resolved.data;
  const indices = computeSuccessPredictionFromEvidence(ev);
  return ok({
    engine: 'success_prediction_engine',
    version: HIRING_INTELLIGENCE_VERSION,
    job_id: ev.job_id,
    candidate_id: ev.candidate_id,
    ...indices,
    evidence: evidenceSummary(ev),
    provenance: PROVENANCE,
    disclaimer: HIRING_INTELLIGENCE_DISCLAIMER,
  });
}
