/**
 * Phase 3 — Capability Confidence Engine 2.0 (v3.0.0)
 *
 * Confidence = Assessment Reliability
 *            + Evidence Strength       (from m3_evidence_confidence_scores)
 *            + Historical Consistency
 *            + Market Validation       (from m3_competency_market_scores)
 *            + Benchmark Stability
 *
 * Wraps Phase 2 confidence engine — does NOT replace it; this v2 model adds
 * market_validation as a first-class term while preserving the existing
 * sci_confidence_snapshots write path for callers that want backward compat.
 */
import type { Pool } from 'pg';
export const CONFIDENCE_V2_VERSION = '3.0.0';

const W = {
  assessment_reliability: 0.25,
  evidence_strength: 0.25,
  historical_consistency: 0.15,
  market_validation: 0.20,
  benchmark_stability: 0.15,
};
const clip01 = (x: number) => Math.max(0, Math.min(1, x));

export type ConfidenceV2Components = {
  assessment_reliability: number;
  evidence_strength: number;
  historical_consistency: number;
  market_validation: number;
  benchmark_stability: number;
};

export function computeConfidenceV2(c: ConfidenceV2Components) {
  const conf = W.assessment_reliability * clip01(c.assessment_reliability)
             + W.evidence_strength      * clip01(c.evidence_strength)
             + W.historical_consistency * clip01(c.historical_consistency)
             + W.market_validation      * clip01(c.market_validation)
             + W.benchmark_stability    * clip01(c.benchmark_stability);
  return {
    confidence: +conf.toFixed(4),
    components: c,
    weights: W,
    verification_level: conf >= 0.85 ? 'verified' : conf >= 0.70 ? 'strong' : conf >= 0.55 ? 'moderate' : 'weak',
  };
}

export function createConfidenceV2(pool: Pool) {
  /**
   * Build a full confidence vector for a subject using:
   *  - their raw competency scores (0..100)
   *  - existing m3_evidence_confidence_scores rows
   *  - latest m3_competency_market_scores rows (market_demand normalised 0..1)
   *  - any caller-supplied assessment_reliability / historical_consistency / benchmark_stability
   */
  async function vector(subjectId: string, rawScores: Record<string, number>, overrides?: Partial<ConfidenceV2Components>) {
    const [evidence, market] = await Promise.all([
      pool.query(`SELECT ontology_competency_id, evidence_strength::float AS s FROM m3_evidence_confidence_scores WHERE subject_id = $1`, [subjectId]),
      pool.query(`SELECT DISTINCT ON (ontology_competency_id) ontology_competency_id, market_demand::float AS m
                  FROM m3_competency_market_scores ORDER BY ontology_competency_id, computed_at DESC`),
    ]);
    const ev = Object.fromEntries(evidence.rows.map((r: any) => [r.ontology_competency_id, r.s]));
    const mk = Object.fromEntries(market.rows.map((r: any) => [r.ontology_competency_id, r.m / 100]));
    return Object.entries(rawScores).map(([comp, raw]) => {
      const base = clip01(raw / 100);
      const c: ConfidenceV2Components = {
        assessment_reliability: overrides?.assessment_reliability ?? 0.50 + base * 0.40,
        evidence_strength:      overrides?.evidence_strength      ?? ev[comp] ?? 0.40,
        historical_consistency: overrides?.historical_consistency ?? 0.55 + base * 0.30,
        market_validation:      overrides?.market_validation      ?? mk[comp] ?? 0.50,
        benchmark_stability:    overrides?.benchmark_stability    ?? 0.50 + base * 0.30,
      };
      return { competency_id: comp, raw_score: raw, ...computeConfidenceV2(c) };
    });
  }

  return { vector, computeConfidenceV2 };
}
