// ─────────────────────────────────────────────────────────────────────────────
// CAPADEX Phase 9 — Predictive & Outcome Intelligence (validation framework)
//
// HONEST validation of the prediction layer. There are NO realized longitudinal
// outcomes yet, so empirical accuracy CANNOT be claimed. Instead we measure what
// is actually verifiable:
//   • Prediction Accuracy Framework — methodology + INTERNAL CONSISTENCY checks
//     (determinism, monotonicity vs evidence, calibration sanity) that must hold.
//   • Prediction Coverage   — share of evaluated subjects that produced predictions.
//   • Explainability Coverage — share of predictions carrying a real chain trace.
//   • Outcome Coverage      — share with a realized outcome record (honestly ~0).
//   • Prediction Explainability Score — mean trace coverage across subjects.
//   • Platform Completion Assessment — descriptive→predictive layer roll-up.
//
// Pure where possible; the DB roll-up is read-only + never-throws.
// ─────────────────────────────────────────────────────────────────────────────
import type { Pool } from 'pg';
import {
  predict,
  predictReadiness,
  type PredictionInput,
  type PredInputChainStage,
  type SubjectPrediction,
} from './prediction-engine';
import { LINEAGE_SPINE } from './graph-traversal-engine';

const round = (n: number, d = 4) => {
  const p = 10 ** d;
  return Math.round(n * p) / p;
};

export interface ConsistencyCheck {
  name: string;
  passed: boolean;
  detail: string;
}
export interface AccuracyFramework {
  methodology: string;
  empirical_accuracy_available: false;
  outcome_truth_note: string;
  consistency_checks: ConsistencyCheck[];
  consistency_passed: number;
  consistency_total: number;
  internally_valid: boolean;
}

function stages(n: number): PredInputChainStage[] {
  return (LINEAGE_SPINE as readonly string[]).map((c, i) => ({
    category: c, label: i < n ? `${c}` : null, resolved: i < n,
  }));
}
function probe(over: Partial<PredictionInput> = {}): PredictionInput {
  return {
    source: 'session', subject_id: 'probe', concern_label: 'career anxiety',
    archetype_key: 'A', archetype_name: 'A', signals: [], strengths: [],
    interventions: [], active_constructs: [],
    chain: { source: 'pipeline', anchor: 'c', stages: stages(7), resolved_hops: 7, total_hops: 7, degraded: false },
    ...over,
  };
}

/** Internal-consistency checks that MUST hold for the model to be trustworthy. */
export function buildAccuracyFramework(): AccuracyFramework {
  const checks: ConsistencyCheck[] = [];

  // Determinism
  const a = probe({ signals: [{ key: 'k', label: 'job stress', severity: 0.7, strength: 0.5, confidence: 0.8, active: true }] });
  const d1 = JSON.stringify({ ...predict(a), generated_at: '' });
  const d2 = JSON.stringify({ ...predict(a), generated_at: '' });
  checks.push({ name: 'determinism', passed: d1 === d2, detail: 'identical input ⇒ identical output' });

  // Monotonicity: more risk severity ⇒ lower readiness
  const low = predictReadiness('future', probe({ signals: [{ key: 'k', label: 'x', severity: 0.2, strength: 0.5, confidence: 0.8, active: true }] }));
  const high = predictReadiness('future', probe({ signals: [{ key: 'k', label: 'x', severity: 0.9, strength: 0.5, confidence: 0.8, active: true }] }));
  checks.push({ name: 'risk_monotonicity', passed: high.score < low.score, detail: `sev0.9→${high.score} < sev0.2→${low.score}` });

  // Monotonicity: more strength ⇒ higher readiness
  const noStr = predictReadiness('future', probe());
  const str = predictReadiness('future', probe({ strengths: [{ label: 'Resilience', evidence: 'e', confidence: 0.9 }] }));
  checks.push({ name: 'strength_monotonicity', passed: str.score > noStr.score, detail: `with strength ${str.score} > base ${noStr.score}` });

  // Calibration sanity: scores bounded 0..1, neutral with no evidence
  const neutral = predictReadiness('future', probe());
  checks.push({ name: 'neutral_baseline', passed: Math.abs(neutral.score - 0.5) < 1e-9, detail: `no-evidence baseline ${neutral.score}` });

  // Chain completeness ⇒ confidence ordering
  const fullC = predictReadiness('career', probe({ strengths: [{ label: 'career plan', evidence: 'e', confidence: 0.9 }], chain: { source: 'pipeline', anchor: 'c', stages: stages(7), resolved_hops: 7, total_hops: 7, degraded: false } }));
  const partC = predictReadiness('career', probe({ strengths: [{ label: 'career plan', evidence: 'e', confidence: 0.9 }], chain: { source: 'pipeline', anchor: 'c', stages: stages(2), resolved_hops: 2, total_hops: 7, degraded: true } }));
  checks.push({ name: 'confidence_tracks_chain', passed: fullC.confidence > partC.confidence, detail: `full ${fullC.confidence} > partial ${partC.confidence}` });

  // Expected outcome never below current
  const ex = predictReadiness('career', probe({ interventions: [{ key: 'i', title: 'career coaching', construct: 'career', expected_impact: 0.8, confidence: 0.9, addressable_severity: 0.6 }] }));
  checks.push({ name: 'expected_ge_current', passed: ex.expected_outcome.score >= ex.score, detail: `expected ${ex.expected_outcome.score} ≥ current ${ex.score}` });

  const passedN = checks.filter((c) => c.passed).length;
  return {
    methodology:
      'Predictions are deterministic, a-priori-weighted compositions of the descriptive layers ' +
      '(readiness = clamp(0.5 + strengths − risks); expected = readiness + Σ traced intervention uplift). ' +
      'Validity is established by internal-consistency invariants until realized outcomes enable empirical calibration.',
    empirical_accuracy_available: false,
    outcome_truth_note:
      'No realized longitudinal outcomes are recorded yet, so empirical accuracy (predicted vs actual) ' +
      'is not measurable. We deliberately make NO accuracy claim — only internal validity + explainability.',
    consistency_checks: checks,
    consistency_passed: passedN,
    consistency_total: checks.length,
    internally_valid: passedN === checks.length,
  };
}

export interface CoverageMetrics {
  prediction_coverage: { evaluated: number; produced: number; degraded: number; coverage: number };
  explainability_coverage: { predictions_total: number; predictions_traced: number; coverage: number };
  outcome_coverage: { with_realized_outcome: number; total: number; coverage: number; note: string };
  prediction_explainability_score: number;
}

/** Roll up coverage metrics across a set of already-built subject predictions. */
export function rollupCoverage(predictions: SubjectPrediction[]): CoverageMetrics {
  const evaluated = predictions.length;
  const produced = predictions.filter((p) => p.readiness.length > 0).length;
  const degraded = predictions.filter((p) => p.degraded).length;

  let predTotal = 0, predTraced = 0, explSum = 0;
  for (const p of predictions) {
    predTotal += p.explainability.predictions_total;
    predTraced += p.explainability.predictions_traced;
    explSum += p.explainability.score;
  }

  return {
    prediction_coverage: {
      evaluated, produced, degraded,
      coverage: evaluated ? round(produced / evaluated) : 0,
    },
    explainability_coverage: {
      predictions_total: predTotal,
      predictions_traced: predTraced,
      coverage: predTotal ? round(predTraced / predTotal) : 0,
    },
    outcome_coverage: {
      with_realized_outcome: 0,
      total: evaluated,
      coverage: 0,
      note: 'No realized-outcome records exist (no longitudinal follow-up captured) — honestly 0%.',
    },
    prediction_explainability_score: evaluated ? round(explSum / evaluated) : 0,
  };
}

export interface PlatformCompletionAssessment {
  layers: { name: string; status: 'present' | 'partial' | 'absent'; note: string }[];
  descriptive_complete: boolean;
  predictive_complete: boolean;
  completion_score: number; // 0..1
  honest_gaps: string[];
}

/** Honest descriptive→predictive completion roll-up (composition, not a score to game). */
export function buildPlatformCompletionAssessment(coverage: CoverageMetrics, framework: AccuracyFramework): PlatformCompletionAssessment {
  const layers: PlatformCompletionAssessment['layers'] = [
    { name: 'Evidence → Signal (runtime)', status: 'present', note: 'Signal activation runtime persists session signals.' },
    { name: 'Signal → Concept spine (KG)', status: 'present', note: '7-hop lineage materialized in pil_kg_*.' },
    { name: 'Descriptive reports', status: 'present', note: 'Stakeholder + institution reports with readiness.' },
    { name: 'Recommendations', status: 'present', note: 'Active-construct-anchored, chain-traced.' },
    { name: 'Predictive readiness', status: 'present', note: '4 dimensions, deterministic + traced.' },
    { name: 'Intervention impact prediction', status: 'present', note: 'Library expected_impact × confidence × severity.' },
    {
      name: 'Outcome attribution (realized)',
      status: coverage.outcome_coverage.with_realized_outcome > 0 ? 'partial' : 'absent',
      note: 'No realized longitudinal outcomes captured yet — empirical calibration pending.',
    },
  ];
  const present = layers.filter((l) => l.status === 'present').length;
  const completion = round(present / layers.length);
  const gaps: string[] = [];
  if (coverage.outcome_coverage.with_realized_outcome === 0) gaps.push('No realized outcomes → empirical accuracy not yet measurable.');
  if (coverage.prediction_coverage.degraded > 0) gaps.push(`${coverage.prediction_coverage.degraded} session(s) degraded (partial chain) — predictions emitted at lower confidence.`);
  if (!framework.internally_valid) gaps.push('Internal-consistency checks did not all pass — investigate before trusting predictions.');

  return {
    layers,
    descriptive_complete: true,
    predictive_complete: framework.internally_valid,
    completion_score: completion,
    honest_gaps: gaps,
  };
}

/** Check for a realized-outcomes surface (read-only; honest absence is the expected result). */
export async function countRealizedOutcomes(pool: Pool): Promise<number> {
  // Probe a few plausible outcome tables without assuming any exist.
  for (const tbl of ['capadex_outcome_records', 'capadex_realized_outcomes', 'outcome_attribution']) {
    try {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${tbl}`);
      if (rows[0]?.n != null) return Number(rows[0].n);
    } catch { /* table absent — keep probing */ }
  }
  return 0;
}
