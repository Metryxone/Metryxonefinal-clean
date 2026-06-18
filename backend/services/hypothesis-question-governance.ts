/**
 * Hypothesis Question Governance — CAPADEX Phase 0B
 *
 * Pure, deterministic classifier that labels what investigative ROLE a candidate
 * question plays against the CURRENT hypothesis set. This is the "scientist's
 * intent" layer over the adaptive selection score: the score says *which* question
 * is best, this says *why we are asking it* in hypothesis-testing terms.
 *
 * Four roles (mutually exclusive, evaluated in priority order):
 *   • explore     — no hypothesis is targeted yet (relevance ≤ 0 / no construct).
 *                   We are still gathering breadth before committing.
 *   • weaken      — the question probes a construct implicated in an unresolved
 *                   contradiction (contradictionProbe ≥ 0.5). Asking it should
 *                   resolve or deepen the contradiction → weaken a hypothesis.
 *   • eliminate   — the targeted hypothesis sits in the `weak` confidence band.
 *                   A weak hypothesis is a candidate for elimination; this
 *                   question collects the evidence to rule it in or out.
 *   • strengthen  — the targeted hypothesis is `moderate`/`strong`. The question
 *                   accumulates confirming evidence to push confidence higher.
 *
 * No side effects, no DB, no flags — callers decide whether/when to surface it.
 */

import type { ConfidenceBand } from './confidence-engine';

export type GovernanceRole = 'explore' | 'weaken' | 'eliminate' | 'strengthen';

export interface GovernanceInput {
  /** Canonical construct key the question targets, or null when none matched. */
  targetConstruct:    string | null;
  /** Confidence band of the targeted hypothesis (null when no target). */
  band:               ConfidenceBand | null;
  /** 0–1 hypothesis-relevance score for the question. */
  relevance:          number;
  /** 0–1 contradiction-probe score for the question. */
  contradictionProbe: number;
  /** 0–1 expected confidence gain the question would yield. */
  confidenceGain:     number;
}

export interface GovernanceResult {
  role:      GovernanceRole;
  /** Non-generic, names the construct + band + the deciding factor. */
  rationale: string;
}

/** 0–1 contradiction-probe score at/above which a question is a weaken probe. */
export const CONTRADICTION_PROBE_THRESHOLD = 0.5;

function pct(x: number): string {
  return `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;
}

/**
 * Classify the investigative role of a candidate question. Pure + deterministic:
 * the same inputs always yield the same role + rationale.
 */
export function classifyGovernance(input: GovernanceInput): GovernanceResult {
  const { targetConstruct, band, relevance, contradictionProbe, confidenceGain } = input;

  // 1. No target → exploration. We have nothing to confirm/deny yet.
  if (!targetConstruct || relevance <= 0) {
    return {
      role:      'explore',
      rationale: `No active hypothesis matched — exploring to surface a construct before committing (relevance ${pct(relevance)}).`,
    };
  }

  // 2. Contradiction probe outranks band — resolving a contradiction is the
  //    highest-value evidence we can collect.
  if (contradictionProbe >= CONTRADICTION_PROBE_THRESHOLD) {
    return {
      role:      'weaken',
      rationale: `Probes an unresolved contradiction in '${targetConstruct}' (probe ${pct(contradictionProbe)}) — answer should weaken or resolve the hypothesis.`,
    };
  }

  // 3. Weak band → the hypothesis is a candidate for elimination.
  if (band === 'weak') {
    return {
      role:      'eliminate',
      rationale: `'${targetConstruct}' sits in the weak confidence band — collecting evidence to rule it in or out (expected gain ${pct(confidenceGain)}).`,
    };
  }

  // 4. Moderate / strong band → strengthen with confirming evidence.
  return {
    role:      'strengthen',
    rationale: `'${targetConstruct}' is ${band ?? 'moderate'} — accumulating confirming evidence to raise confidence (expected gain ${pct(confidenceGain)}).`,
  };
}
