/**
 * PHASE 5.11 — Hiring Intelligence: hiring_intelligence_engine (services).
 *
 * Produces two DEVELOPMENTAL, coverage-gated indices for a (job, candidate):
 *   - Hiring Probability — a favourable-signal composite of operator panel recommendations,
 *     interview evaluation, and the latest operator decision posture.
 *   - Hiring Risk        — an unfavourable-signal composite of negative panel recommendations,
 *     operator concern density, and the latest operator decision risk.
 *
 * Contract: PURE READ / compose-never-recompute (deterministic folds of operator-recorded
 * evidence), never-throws, IDOR job-scoped, honesty-first (unmeasured ⇒ null, NOT 0). These
 * are directional development signals — NOT predictions and NOT a hire/reject verdict.
 */

import type { Pool } from 'pg';
import {
  type Evidence, type EngineResult,
  composite, ok, resolveEvidence,
  evaluationMeanPct, meanRecommendationPct, concernDensityPct,
  latestDecision, decisionPostureToPct, decisionRiskToPct,
  evidenceSummary,
  HIRING_INTELLIGENCE_DISCLAIMER, HIRING_INTELLIGENCE_VERSION, PROVENANCE,
} from './hiring-intelligence-shared';

// Pure: compose the two hiring indices from already-loaded evidence (no DB, no recompute).
export function computeHiringIntelligenceFromEvidence(ev: Evidence) {
  const evalMean = evaluationMeanPct(ev.scores);
  const recMean = meanRecommendationPct(ev.feedback);
  const concern = concernDensityPct(ev.feedback);
  const latest = latestDecision(ev.decisions);

  const hiring_probability = composite([
    {
      key: 'panel_recommendation', label: 'Panel recommendation', weight: 0.4,
      value: recMean.mean, source: `interview_feedback (${recMean.n} recommendation(s))`,
    },
    {
      key: 'interview_evaluation', label: 'Interview evaluation', weight: 0.35,
      value: evalMean.mean, source: `interview_scores (${evalMean.n} score(s))`,
    },
    {
      key: 'decision_posture', label: 'Latest decision posture', weight: 0.25,
      value: decisionPostureToPct(latest), source: latest ? `interview_decisions (latest: ${latest})` : 'no decision recorded',
    },
  ]);

  const panelNegativity = recMean.mean != null ? 100 - recMean.mean : null;
  const hiring_risk = composite([
    {
      key: 'panel_negativity', label: 'Panel negativity', weight: 0.4,
      value: panelNegativity, source: `interview_feedback (${recMean.n} recommendation(s))`,
    },
    {
      key: 'concern_density', label: 'Operator concern density', weight: 0.3,
      value: concern.pct, source: `interview_feedback (${concern.n} submission(s))`,
    },
    {
      key: 'decision_risk', label: 'Latest decision risk', weight: 0.3,
      value: decisionRiskToPct(latest), source: latest ? `interview_decisions (latest: ${latest})` : 'no decision recorded',
    },
  ]);

  return { hiring_probability, hiring_risk, latest_decision: latest };
}

// GET entry: load evidence once (IDOR-guarded) then compose. Never writes.
export async function computeHiringIntelligence(
  pool: Pool, jobId: string, candidateId: string,
): Promise<EngineResult> {
  const resolved = await resolveEvidence(pool, jobId, candidateId);
  if (!resolved.ok) return resolved;
  const ev = resolved.data;
  const indices = computeHiringIntelligenceFromEvidence(ev);
  return ok({
    engine: 'hiring_intelligence_engine',
    version: HIRING_INTELLIGENCE_VERSION,
    job_id: ev.job_id,
    candidate_id: ev.candidate_id,
    ...indices,
    evidence: evidenceSummary(ev),
    provenance: PROVENANCE,
    disclaimer: HIRING_INTELLIGENCE_DISCLAIMER,
  });
}
