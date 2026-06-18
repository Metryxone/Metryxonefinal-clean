/**
 * Competency Confidence Engine
 * Phase 2 Scientific Competency Intelligence (v2.0.0)
 *
 *   Confidence = w1·Reliability + w2·Behavioural Consistency
 *              + w3·Evidence Validation + w4·Historical Stability
 *              + w5·Benchmark Confidence
 *   weights default: 0.30 / 0.20 / 0.20 / 0.15 / 0.15  → sum = 1.0
 *
 * Inputs are 0..1 normalised. Output bundle:
 *   { raw_score, confidence, reliability_tier, evidence_strength, components }
 */
import type { Pool } from 'pg';

export const CONFIDENCE_ENGINE_VERSION = '2.0.0';

export interface ConfidenceComponents {
  reliability: number;            // 0..1
  behavioral_consistency: number; // 0..1
  evidence_validation: number;    // 0..1
  historical_stability: number;   // 0..1
  benchmark_confidence: number;   // 0..1
}

const DEFAULT_WEIGHTS = {
  reliability: 0.30,
  behavioral_consistency: 0.20,
  evidence_validation: 0.20,
  historical_stability: 0.15,
  benchmark_confidence: 0.15,
};

export function reliabilityTierFromConfidence(c: number): 'A' | 'B' | 'C' | 'D' | 'provisional' {
  if (c >= 0.85) return 'A';
  if (c >= 0.70) return 'B';
  if (c >= 0.55) return 'C';
  if (c >= 0.40) return 'D';
  return 'provisional';
}

export function evidenceStrength(c: ConfidenceComponents): 'weak' | 'moderate' | 'strong' | 'very_strong' {
  const e = c.evidence_validation;
  if (e >= 0.85) return 'very_strong';
  if (e >= 0.70) return 'strong';
  if (e >= 0.50) return 'moderate';
  return 'weak';
}

export function computeConfidence(
  components: ConfidenceComponents,
  weights: Partial<typeof DEFAULT_WEIGHTS> = {}
) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const cc = {
    reliability: clamp01(components.reliability),
    behavioral_consistency: clamp01(components.behavioral_consistency),
    evidence_validation: clamp01(components.evidence_validation),
    historical_stability: clamp01(components.historical_stability),
    benchmark_confidence: clamp01(components.benchmark_confidence),
  };
  const conf =
    w.reliability             * cc.reliability             +
    w.behavioral_consistency  * cc.behavioral_consistency  +
    w.evidence_validation     * cc.evidence_validation     +
    w.historical_stability    * cc.historical_stability    +
    w.benchmark_confidence    * cc.benchmark_confidence;
  return {
    confidence: +conf.toFixed(4),
    reliability_tier: reliabilityTierFromConfidence(conf),
    evidence_strength: evidenceStrength(cc),
    components: cc,
    weights: w,
  };
}

export function createConfidenceEngine(pool: Pool) {
  async function persist(sessionId: string, competencyId: string, rawScore: number | null, computed: ReturnType<typeof computeConfidence>) {
    const id = `sconf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await pool.query(
      `INSERT INTO sci_confidence_snapshots
         (id, session_id, competency_id, raw_score, confidence, reliability_tier, evidence_strength, components)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, sessionId, competencyId, rawScore, computed.confidence,
       computed.reliability_tier, computed.evidence_strength, JSON.stringify(computed.components)]
    );
    return id;
  }

  async function listForSession(sessionId: string) {
    const { rows } = await pool.query(
      `SELECT * FROM sci_confidence_snapshots WHERE session_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [sessionId]
    );
    return rows;
  }

  /** Score an entire competency vector (synthetic components for any single score). */
  function scoreVector(sessionId: string, scores: Record<string, number>, overrides?: Partial<ConfidenceComponents>) {
    return Object.entries(scores).map(([compId, raw]) => {
      // Conservative synthetic components driven by raw score magnitude
      const base = Math.max(0, Math.min(1, raw / 100));
      const comp = computeConfidence({
        reliability: overrides?.reliability ?? 0.4 + base * 0.5,
        behavioral_consistency: overrides?.behavioral_consistency ?? 0.5 + base * 0.4,
        evidence_validation: overrides?.evidence_validation ?? 0.45 + base * 0.45,
        historical_stability: overrides?.historical_stability ?? 0.5 + base * 0.35,
        benchmark_confidence: overrides?.benchmark_confidence ?? 0.4 + base * 0.4,
      });
      return { competency_id: compId, raw_score: raw, ...comp };
    });
  }

  return { persist, listForSession, scoreVector, computeConfidence };
}
