/**
 * Phase 3.3 — DIMENSION SCORING ENGINE  (deliverable: dimension_scoring_engine)
 * ============================================================================
 * Scores ONE employability readiness dimension from its mapped competency
 * components and emits a fully TRANSPARENT, EXPLAINABLE, TRACEABLE record of
 * exactly how the number was produced.
 *
 * Pure (no DB, never throws). Imports only the shared primitives, so the
 * arithmetic is identical to the 3.2 dimension mapping by construction.
 *
 * Method: weighted mean over MEASURED components only.
 *   score = Σ(proxy_i × weight_i) / Σ(weight_i)            (measured i only)
 * Unmeasured competencies are NEVER imputed. A dimension that fails its
 * min-components / min-coverage gate is reported measurable:false with a null
 * score and a reason — never a fabricated number.
 */

import {
  type CalcStep,
  type DimensionComponent,
  type DimensionConfidence,
  type DimensionScoringRule,
  bandFor,
  clamp,
  dimensionConfidence,
  emptyConfidence,
  round1,
} from './competency-ei-scoring-shared.js';

export interface DimensionScoreTrace {
  method: string;
  measurement: string;
  formula: string;
  gate: {
    min_components: number;
    min_coverage_pct: number;
    components_total: number;
    components_measured: number;
    coverage_pct: number;
    passed: boolean;
    reason: string | null;
  };
  steps: CalcStep[];
  numerator: number | null;
  denominator: number | null;
  raw_score: number | null;
  clamped_score: number | null;
  band_thresholds: Record<string, number>;
}

export interface ScoredDimension {
  ei_dimension_id: string;
  dimension_name: string;
  description: string;
  measurable: boolean;
  score: number | null;
  band: string | null;
  rollup_weight: number;
  components_total: number;
  components_measured: number;
  coverage_pct: number;
  confidence: DimensionConfidence;
  components: DimensionComponent[];
  reason?: string;
  trace: DimensionScoreTrace;
}

/**
 * Score a single dimension with a complete calculation trace.
 *
 * @param rule        calculation parameters for this dimension
 * @param components  every mapped competency edge (measured + unmeasured)
 * @param measurement measurement basis (e.g. 'domain_proxy')
 */
export function scoreDimension(
  rule: DimensionScoringRule,
  components: DimensionComponent[],
  measurement: string,
): ScoredDimension {
  const total = components.length;
  const measured = components.filter((c) => c.measured && c.proxy_score != null);
  const coveragePct = total > 0 ? round1((measured.length / total) * 100) : 0;

  const enoughComponents = measured.length >= rule.min_components;
  const enoughCoverage = coveragePct >= rule.min_coverage_pct;
  const gatePassed = total > 0 && enoughComponents && enoughCoverage;

  const bandThresholds = rule.band_thresholds ?? {};

  // ---- Gate not passed → honest non-measurable (no fabricated score) -------
  if (!gatePassed) {
    const reason =
      total === 0
        ? 'no_mapped_competencies'
        : !enoughComponents
          ? 'below_min_components'
          : 'below_min_coverage';
    const reasonText =
      total === 0
        ? 'no competencies mapped to this dimension'
        : `insufficient measured competencies (${measured.length}/${total}, need ${rule.min_components} and ≥${rule.min_coverage_pct}% coverage)`;

    const steps: CalcStep[] = [
      {
        n: 1,
        label: 'coverage',
        expr: `${measured.length} measured / ${total} mapped × 100`,
        value: coveragePct,
        note: '% of this dimension\'s mapped competencies that were actually measured',
      },
      {
        n: 2,
        label: 'gate check',
        expr: `measured ≥ ${rule.min_components} AND coverage ≥ ${rule.min_coverage_pct}%`,
        value: 'fail',
        note: reasonText,
      },
      { n: 3, label: 'result', value: 'not measurable', note: 'no score produced (never imputed)' },
    ];

    return {
      ei_dimension_id: rule.ei_dimension_id,
      dimension_name: rule.dimension_name,
      description: rule.description,
      measurable: false,
      score: null,
      band: null,
      rollup_weight: rule.rollup_weight,
      components_total: total,
      components_measured: measured.length,
      coverage_pct: coveragePct,
      confidence: emptyConfidence(measurement, reasonText),
      components,
      reason,
      trace: {
        method: `${rule.aggregation_method} over measured components`,
        measurement,
        formula: 'score = Σ(proxy_i × weight_i) / Σ(weight_i)  [measured i only]',
        gate: {
          min_components: rule.min_components,
          min_coverage_pct: rule.min_coverage_pct,
          components_total: total,
          components_measured: measured.length,
          coverage_pct: coveragePct,
          passed: false,
          reason,
        },
        steps,
        numerator: null,
        denominator: null,
        raw_score: null,
        clamped_score: null,
        band_thresholds: bandThresholds,
      },
    };
  }

  // ---- Weighted mean over MEASURED components only -------------------------
  const steps: CalcStep[] = [];
  let num = 0;
  let den = 0;
  measured.forEach((c, i) => {
    const product = (c.proxy_score as number) * c.contribution_weight;
    num += product;
    den += c.contribution_weight;
    steps.push({
      n: i + 1,
      label: `component · ${c.competency_id}`,
      expr: `proxy ${round1(c.proxy_score as number)} × weight ${c.contribution_weight}`,
      value: round1(product),
      note: c.onto_domain ? `domain-proxy via ${c.onto_domain}` : undefined,
    });
  });

  const rawScore = den > 0 ? num / den : null;
  const clamped = rawScore != null ? clamp(rawScore) : null;
  const score = clamped != null ? round1(clamped) : null;
  const band = score != null ? bandFor(score, bandThresholds) : null;

  steps.push({ n: steps.length + 1, label: 'Σ weighted products (numerator)', value: round1(num) });
  steps.push({ n: steps.length + 1, label: 'Σ weights (denominator)', value: round1(den) });
  steps.push({
    n: steps.length + 1,
    label: 'weighted mean',
    expr: `${round1(num)} / ${round1(den)}`,
    value: rawScore != null ? round1(rawScore) : null,
  });
  steps.push({ n: steps.length + 1, label: 'clamp to 0–100', value: score });
  steps.push({
    n: steps.length + 1,
    label: 'band',
    expr: `thresholds ex≥${bandThresholds.excellent ?? 80} st≥${bandThresholds.strong ?? 65} dv≥${bandThresholds.developing ?? 50} em≥${bandThresholds.emerging ?? 35}`,
    value: band,
  });

  const confidence = dimensionConfidence(measurement, coveragePct, rule.domain_proxy_confidence_cap);

  return {
    ei_dimension_id: rule.ei_dimension_id,
    dimension_name: rule.dimension_name,
    description: rule.description,
    measurable: score != null,
    score,
    band,
    rollup_weight: rule.rollup_weight,
    components_total: total,
    components_measured: measured.length,
    coverage_pct: coveragePct,
    confidence,
    components,
    trace: {
      method: `${rule.aggregation_method} over measured components`,
      measurement,
      formula: 'score = Σ(proxy_i × weight_i) / Σ(weight_i)  [measured i only]',
      gate: {
        min_components: rule.min_components,
        min_coverage_pct: rule.min_coverage_pct,
        components_total: total,
        components_measured: measured.length,
        coverage_pct: coveragePct,
        passed: true,
        reason: null,
      },
      steps,
      numerator: round1(num),
      denominator: round1(den),
      raw_score: rawScore != null ? round1(rawScore) : null,
      clamped_score: score,
      band_thresholds: bandThresholds,
    },
  };
}
