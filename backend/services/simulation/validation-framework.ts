/**
 * CAPADEX Simulation — Validation Framework + Quality Monitoring (0C).
 *
 * Defines the production-readiness targets / fail conditions from the 0C spec
 * and turns an aggregated MetricSet into a pass | warn | fail verdict with a
 * transparent per-condition breakdown. Pure / no side effects.
 *
 * Conditions are tagged `hard` (a breach fails the run) or `soft` (a breach
 * warns). Metrics that were not produced (e.g. an optional subsystem was flag-
 * off / had no data) are reported as `applicable:false` and never fail a run —
 * honouring the platform rule that absent data == acceptable current behaviour.
 */

export interface MetricSet {
  /** Composite question relevance 0..1. */
  relevance: number;
  /** Sub-components of relevance (transparency for calibration). */
  relevanceCoverage: number;
  relevanceConcept: number;
  relevanceConcernMatch: number;
  /** Within-assessment duplicate-question ratio 0..1 (lower better). */
  repetition: number;
  /** Fraction of runs whose report score band matched the injected severity band. */
  confidenceAccuracy: number;
  /** Stability of report scores 0..1 (1 - normalised stddev). */
  confidenceStability: number;
  /** Mean confidence of generated signals (NaN-safe; coverage tracked separately). */
  signalConfidence: number;
  /** Mean confidence of generated patterns. */
  patternConfidence: number;
  /** Mean hypothesis confidence (from /analyze when flag-on, else pattern conf). */
  hypothesisConfidence: number;
  /** Fraction of interventions that are non-generic (construct + rationale + refs). */
  recommendationQuality: number;
  /** Report completeness 0..1. */
  reportUsefulness: number;
  /** Question quality 0..1 (well-formed stem + options present). */
  questionQuality: number;
  /** Option quality 0..1 (≥2 distinct options). */
  optionQuality: number;
  /** Fraction of attempted personas whose concern had seeded questions. */
  concernCoverage: number;
  /** Concern strings with no seeded questions (surfaced for the team). */
  unseededConcerns: string[];
  /** Coverage counters — how many sampled runs produced each artefact. */
  coverage: {
    runs: number;
    attempted: number;
    seeded: number;
    withSignals: number;
    withPatterns: number;
    withInterventions: number;
    withReport: number;
  };
}

export interface ConditionResult {
  key: string;
  label: string;
  value: number;
  threshold: number;
  comparator: 'gte' | 'lte';
  severity: 'hard' | 'soft';
  applicable: boolean;
  passed: boolean;
}

export type Verdict = 'pass' | 'warn' | 'fail';

export interface ValidationResult {
  verdict: Verdict;
  conditions: ConditionResult[];
  failedConditions: string[];
  warnedConditions: string[];
}

/** Targets straight from the 0C spec. */
export const TARGETS = {
  relevance: { initial: 0.85, optimized: 0.9, top: 0.95 },
  repetitionMax: 0.02,
  questionQuality: 0.9,
  optionQuality: 0.9,
  reportQuality: 0.9,
  confidenceAccuracyMin: 0.7,
  confidenceStabilityMin: 0.75,
  recommendationQualityMin: 0.8,
  concernCoverageMin: 0.8,
} as const;

function cmp(value: number, threshold: number, comparator: 'gte' | 'lte'): boolean {
  return comparator === 'gte' ? value >= threshold : value <= threshold;
}

export function evaluate(m: MetricSet): ValidationResult {
  const hasSignals = m.coverage.withSignals > 0 || m.coverage.withPatterns > 0;
  const hasInterventions = m.coverage.withInterventions > 0;

  const defs: Array<Omit<ConditionResult, 'passed'>> = [
    {
      key: 'relevance',
      label: 'Question relevance',
      value: m.relevance,
      threshold: TARGETS.relevance.initial,
      comparator: 'gte',
      severity: 'hard',
      applicable: true,
    },
    {
      key: 'repetition',
      label: 'Question repetition rate',
      value: m.repetition,
      threshold: TARGETS.repetitionMax,
      comparator: 'lte',
      severity: 'hard',
      applicable: true,
    },
    {
      key: 'reportUsefulness',
      label: 'Report quality',
      value: m.reportUsefulness,
      threshold: TARGETS.reportQuality,
      comparator: 'gte',
      severity: 'hard',
      applicable: m.coverage.withReport > 0,
    },
    {
      key: 'questionQuality',
      label: 'Question quality',
      value: m.questionQuality,
      threshold: TARGETS.questionQuality,
      comparator: 'gte',
      severity: 'soft',
      applicable: true,
    },
    {
      key: 'optionQuality',
      label: 'Option quality',
      value: m.optionQuality,
      threshold: TARGETS.optionQuality,
      comparator: 'gte',
      severity: 'soft',
      applicable: true,
    },
    {
      key: 'confidenceAccuracy',
      label: 'Confidence accuracy',
      value: m.confidenceAccuracy,
      threshold: TARGETS.confidenceAccuracyMin,
      comparator: 'gte',
      severity: 'soft',
      applicable: m.coverage.withReport > 0,
    },
    {
      key: 'confidenceStability',
      label: 'Confidence stability',
      value: m.confidenceStability,
      threshold: TARGETS.confidenceStabilityMin,
      comparator: 'gte',
      severity: 'soft',
      applicable: m.coverage.withReport > 1,
    },
    {
      key: 'recommendationQuality',
      label: 'Recommendation quality',
      value: m.recommendationQuality,
      threshold: TARGETS.recommendationQualityMin,
      comparator: 'gte',
      severity: 'soft',
      applicable: hasInterventions,
    },
    {
      key: 'signalConfidence',
      label: 'Signal confidence',
      value: m.signalConfidence,
      threshold: 0.5,
      comparator: 'gte',
      severity: 'soft',
      applicable: hasSignals,
    },
    {
      key: 'concernCoverage',
      label: 'Concern seed coverage',
      value: m.concernCoverage,
      threshold: TARGETS.concernCoverageMin,
      comparator: 'gte',
      severity: 'soft',
      applicable: m.coverage.attempted > 0,
    },
  ];

  const conditions: ConditionResult[] = defs.map((d) => ({
    ...d,
    passed: !d.applicable || cmp(d.value, d.threshold, d.comparator),
  }));

  const failedConditions = conditions
    .filter((c) => c.applicable && !c.passed && c.severity === 'hard')
    .map((c) => c.key);
  const warnedConditions = conditions
    .filter((c) => c.applicable && !c.passed && c.severity === 'soft')
    .map((c) => c.key);

  const verdict: Verdict = failedConditions.length > 0 ? 'fail' : warnedConditions.length > 0 ? 'warn' : 'pass';

  return { verdict, conditions, failedConditions, warnedConditions };
}
