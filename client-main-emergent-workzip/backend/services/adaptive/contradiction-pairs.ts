/**
 * Adaptive Questioning — Trait Contradiction Pairs (Phase B, T8, pure)
 *
 * Objective #4: detect the three named cross-trait contradictions and use them
 * to drive deeper probing:
 *
 *   confidence_avoidance        — high confidence + high avoidance
 *   perfectionism_rapid_execution — high perfectionism + rapid execution
 *   confidence_performance_gap  — low confidence + strong performance
 *
 * Each finding names the traits to PROBE next so the selection layer can
 * prioritise resolving the tension instead of asking unrelated questions.
 *
 * Pure + deterministic. The same pure rule is reused by the live response-phase
 * contradiction runtime (see contradiction-engine.ts) so detection logic never
 * drifts between selection-time and persistence-time.
 */

import { deriveLevels, type TraitMap } from './trait-inference';

export type TraitContradictionType =
  | 'confidence_avoidance'
  | 'perfectionism_rapid_execution'
  | 'confidence_performance_gap';

export type Severity = 'low' | 'medium' | 'high';

export interface TraitContradiction {
  type: TraitContradictionType;
  severity: Severity;
  /** Distress traits to probe next to resolve the tension. */
  probe_traits: string[];
  description: string;
  /** The two derived levels that triggered the rule (for transparency). */
  evidence: Record<string, number>;
}

/** Level at/above which a derived level counts as "high". */
export const HIGH = 0.66;
/** Level at/below which a derived level counts as "low". */
export const LOW = 0.34;

function severityFromGap(a: number, b: number): Severity {
  // Larger combined distance from the decision boundary → stronger signal.
  const strength = (Math.abs(a - 0.5) + Math.abs(b - 0.5)) / 2;
  return strength >= 0.4 ? 'high' : strength >= 0.25 ? 'medium' : 'low';
}

/**
 * Detects the three named contradictions from a distress-trait map. Only fires
 * a rule when BOTH derived levels it depends on have observed evidence
 * (non-null) — we never infer a contradiction from absence of data.
 */
export function detectTraitContradictions(map: TraitMap): TraitContradiction[] {
  const lv = deriveLevels(map);
  const out: TraitContradiction[] = [];

  // 1. high confidence + high avoidance
  if (lv.confidence !== null && lv.avoidance !== null
      && lv.confidence >= HIGH && lv.avoidance >= HIGH) {
    out.push({
      type: 'confidence_avoidance',
      severity: severityFromGap(lv.confidence, lv.avoidance),
      probe_traits: ['self_doubt', 'avoidance'],
      description:
        `Reports high confidence (${lv.confidence.toFixed(2)}) yet also high ` +
        `avoidance (${lv.avoidance.toFixed(2)}) — confidence may be overstated.`,
      evidence: { confidence: lv.confidence, avoidance: lv.avoidance },
    });
  }

  // 2. high perfectionism + rapid execution
  if (lv.perfectionism !== null && lv.executionSpeed !== null
      && lv.perfectionism >= HIGH && lv.executionSpeed >= HIGH) {
    out.push({
      type: 'perfectionism_rapid_execution',
      severity: severityFromGap(lv.perfectionism, lv.executionSpeed),
      probe_traits: ['perfectionism', 'impulsivity'],
      description:
        `Reports high perfectionism (${lv.perfectionism.toFixed(2)}) yet rapid, ` +
        `impulsive execution (${lv.executionSpeed.toFixed(2)}) — standards and ` +
        `pace appear in tension.`,
      evidence: { perfectionism: lv.perfectionism, executionSpeed: lv.executionSpeed },
    });
  }

  // 3. low confidence + strong performance
  if (lv.confidence !== null && lv.performance !== null
      && lv.confidence <= LOW && lv.performance >= HIGH) {
    out.push({
      type: 'confidence_performance_gap',
      severity: severityFromGap(1 - lv.confidence, lv.performance),
      probe_traits: ['self_doubt', 'underperformance'],
      description:
        `Reports low confidence (${lv.confidence.toFixed(2)}) despite strong ` +
        `performance (${lv.performance.toFixed(2)}) — possible self-perception gap.`,
      evidence: { confidence: lv.confidence, performance: lv.performance },
    });
  }

  return out;
}
