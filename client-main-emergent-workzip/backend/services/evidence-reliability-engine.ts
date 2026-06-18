/**
 * Evidence Reliability Engine — Phase 3.
 *
 * Computes a per-signal reliability score ∈ [0,1] decomposed into six
 * independently auditable components:
 *
 *   metric_specificity     — does the signal demand quantitative anchors or
 *                            structurally narrow patterns? (taxonomy property)
 *   behavioural_density    — hits per source: thin-text vs dense narrative
 *   external_validation    — diversity of source types backing the signal
 *   consistency            — agreement (1 - stddev) across per-hit match_strength
 *   recency                — already half-life decayed in scoreSignal()
 *   contradiction_penalty  — penalty applied when a contradiction flag touches
 *                            the same competency
 *
 * Composite (weights sum to 1.0):
 *   0.18 specificity + 0.18 density + 0.18 external + 0.18 consistency +
 *   0.18 recency + 0.10 (1 - contradiction_penalty)
 *
 * Pure function. No DB. No throws. Deterministic.
 */

import type { SignalScore } from './behavioral-signal-engine.js';
import type { EvidenceSource } from './evidence-extractor.js';
import type { ContradictionResult } from './contradiction-detector.js';
import { SIGNALS_BY_KEY } from './behavioral-signal-engine.js';

export const RELIABILITY_VERSION = '3.0.0';

const SPECIFICITY_BOOSTS: Record<string, number> = {
  quantified_outcomes:     1.00,
  scale_anchors:           0.95,
  systems_thinking:        0.90,
  ownership_signals:       0.85,
  reflection_signals:      0.80,
  conflict_resolution:     0.80,
  longitudinal_consistency: 0.75,
};

const CONTRADICTION_TO_COMPETENCY: Record<string, string[]> = {
  leadership_without_ownership: ['comp_accountability', 'comp_leadership'],
  strategy_without_systems_thinking: ['comp_strategic_reasoning'],
  inflated_project_scale:        ['comp_accountability', 'comp_communication'],
  inconsistent_timelines:        ['comp_accountability'],
  quantification_gap:            ['comp_accountability', 'comp_strategic_reasoning'],
  hedging_dominant:              ['comp_accountability', 'comp_communication'],
};

const SEVERITY_PENALTY: Record<'low'|'medium'|'high', number> = {
  low: 0.10, medium: 0.25, high: 0.50,
};

export interface ReliabilityBreakdown {
  signal_key: string;
  competency_id: string;
  metric_specificity:    number;  // 0..1
  behavioural_density:   number;  // 0..1
  external_validation:   number;  // 0..1
  consistency:           number;  // 0..1
  recency:               number;  // 0..1 (mirror of score.recency_weight)
  contradiction_penalty: number;  // 0..1 — higher = worse
  composite_reliability: number;  // 0..1
  excluded_evidence_reason?: string;  // populated when composite < 0.30
}

export function scoreReliability(args: {
  score: SignalScore;
  sources: EvidenceSource[];
  contradictions: ContradictionResult;
}): ReliabilityBreakdown {
  const { score, sources, contradictions } = args;
  const taxonomyEntry = SIGNALS_BY_KEY[score.signal_key];

  // Short-circuit: a signal with no evidence cannot be reliable regardless
  // of taxonomy-derived properties. Return a zero-composite breakdown that
  // is explicitly excluded from downstream Bayesian inference.
  if (score.evidence_count === 0 || score.evidence.length === 0) {
    return {
      signal_key: score.signal_key,
      competency_id: score.competency_id,
      metric_specificity: 0, behavioural_density: 0, external_validation: 0,
      consistency: 0, recency: 0, contradiction_penalty: 0,
      composite_reliability: 0,
      excluded_evidence_reason: 'no_evidence',
    };
  }

  // ── metric_specificity ─────────────────────────────────────────────────
  // Explicit boost when taxonomy demands quantifiers; otherwise scale with
  // pattern complexity (more patterns = narrower = more specific).
  const specBoost = SPECIFICITY_BOOSTS[score.signal_key]
                 ?? (taxonomyEntry?.expects_quantifier ? 0.85 : 0.55);
  const patternComplexity = Math.min(1, (taxonomyEntry?.patterns.length ?? 1) / 6);
  const metric_specificity = clamp01(0.7 * specBoost + 0.3 * patternComplexity);

  // ── behavioural_density ────────────────────────────────────────────────
  // hits per source — thin text yields few hits even if sources are many.
  const density = sources.length > 0
    ? Math.min(1, score.evidence_count / sources.length)
    : 0;
  const behavioural_density = clamp01(density);

  // ── external_validation ────────────────────────────────────────────────
  // diversity of source TYPES (resume vs goal vs transcript) backing the signal
  const sourceTypes = new Set<string>();
  for (const e of score.evidence) sourceTypes.add(e.source_type);
  const external_validation = clamp01(Math.min(1, sourceTypes.size / 3));

  // ── consistency ────────────────────────────────────────────────────────
  // 1 - stddev of per-hit match_strength values
  const strengths = score.evidence.map(e => e.match_strength);
  const consistency = strengths.length <= 1
    ? 0.5  // unknown — neutral
    : clamp01(1 - stddev(strengths) * 1.5);

  // ── recency (mirror) ───────────────────────────────────────────────────
  const recency = clamp01(score.recency_weight);

  // ── contradiction_penalty ──────────────────────────────────────────────
  let contradiction_penalty = 0;
  for (const f of contradictions.contradiction_flags) {
    const affected = CONTRADICTION_TO_COMPETENCY[f.rule_id] ?? [];
    if (affected.includes(score.competency_id)) {
      contradiction_penalty = Math.max(contradiction_penalty, SEVERITY_PENALTY[f.severity]);
    }
  }

  // ── composite ──────────────────────────────────────────────────────────
  const composite = round3(
      0.18 * metric_specificity
    + 0.18 * behavioural_density
    + 0.18 * external_validation
    + 0.18 * consistency
    + 0.18 * recency
    + 0.10 * (1 - contradiction_penalty));

  const excluded = composite < 0.30
    ? (score.evidence_count === 0    ? 'no_evidence'
     : behavioural_density < 0.15    ? 'evidence_too_thin'
     : contradiction_penalty >= 0.50 ? 'contradiction_invalidates_signal'
     :                                  'composite_below_threshold')
    : undefined;

  return {
    signal_key: score.signal_key,
    competency_id: score.competency_id,
    metric_specificity:    round3(metric_specificity),
    behavioural_density:   round3(behavioural_density),
    external_validation:   round3(external_validation),
    consistency:           round3(consistency),
    recency:               round3(recency),
    contradiction_penalty: round3(contradiction_penalty),
    composite_reliability: composite,
    excluded_evidence_reason: excluded,
  };
}

export function scoreReliabilityBatch(args: {
  scores: SignalScore[];
  sources: EvidenceSource[];
  contradictions: ContradictionResult;
}): ReliabilityBreakdown[] {
  return args.scores.map(s => scoreReliability({
    score: s, sources: args.sources, contradictions: args.contradictions,
  }));
}

// ── helpers ────────────────────────────────────────────────────────────────

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }
function round3(n: number): number { return Math.round(n * 1000) / 1000; }
function stddev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}
