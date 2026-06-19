/**
 * Phase 3.3 — EI CALCULATION ENGINE  (deliverable: ei_calculation_engine)
 * ============================================================================
 * Rolls the per-dimension scores up into the final Employability-Intelligence
 * (EI) score and emits a fully TRANSPARENT, EXPLAINABLE, TRACEABLE record of
 * exactly how the number was produced.
 *
 * Pure (no DB, never throws). Imports only the shared primitives, so the
 * roll-up arithmetic is identical to the 3.2 overall roll-up by construction.
 *
 * Method: weighted mean over MEASURABLE dimensions only, re-normalised over
 * those actually available.
 *   EI = Σ(score_d × rollup_weight_d) / Σ(rollup_weight_d)   (measurable d only)
 * A dimension that is not measurable contributes NOTHING (never imputed). When
 * no dimension is measurable the EI is null with an explicit reason.
 */

import {
  DEFAULT_BAND_THRESHOLDS,
  type CalcStep,
  type DimensionConfidence,
  bandFor,
  clamp,
  dimensionConfidence,
  emptyConfidence,
  round1,
} from './competency-ei-scoring-shared.js';
import type { ScoredDimension } from './dimension-scoring-engine.js';

export interface EiCalculationTrace {
  method: string;
  measurement: string;
  formula: string;
  steps: CalcStep[];
  numerator: number | null;
  denominator: number | null;
  raw_score: number | null;
  clamped_score: number | null;
  coverage: {
    dimensions_total: number;
    dimensions_measurable: number;
    coverage_pct: number;
  };
  band_thresholds: Record<string, number>;
}

export interface EiCalculation {
  measurable: boolean;
  ei_score: number | null;
  band: string | null;
  dimensions_total: number;
  dimensions_measurable: number;
  coverage_pct: number;
  confidence: DimensionConfidence;
  trace: EiCalculationTrace;
}

export interface EiCalculationOptions {
  measurement: string;
  /** confidence ceiling applied at the overall level (domain-proxy basis). */
  confidence_cap: number;
  band_thresholds?: Record<string, number>;
}

/**
 * Compute the final EI score from already-scored dimensions, with a complete
 * calculation trace.
 */
export function calculateEi(
  dimensions: ScoredDimension[],
  opts: EiCalculationOptions,
): EiCalculation {
  const measurement = opts.measurement;
  const bandThresholds = opts.band_thresholds ?? DEFAULT_BAND_THRESHOLDS;

  const total = dimensions.length;
  const measurable = dimensions.filter((d) => d.measurable && d.score != null);
  const coveragePct = total > 0 ? round1((measurable.length / total) * 100) : 0;

  const steps: CalcStep[] = [];

  if (measurable.length === 0) {
    steps.push({
      n: 1,
      label: 'measurable dimensions',
      value: 0,
      note: 'no dimension passed its coverage/min-component gate — EI not measurable',
    });
    return {
      measurable: false,
      ei_score: null,
      band: null,
      dimensions_total: total,
      dimensions_measurable: 0,
      coverage_pct: coveragePct,
      confidence: emptyConfidence(
        measurement,
        total === 0 ? 'no dimensions configured' : 'no measurable dimensions for this subject',
      ),
      trace: {
        method: 'roll-up weighted_mean over measurable dimensions',
        measurement,
        formula: 'EI = Σ(score_d × rollup_weight_d) / Σ(rollup_weight_d)  [measurable d only]',
        steps,
        numerator: null,
        denominator: null,
        raw_score: null,
        clamped_score: null,
        coverage: { dimensions_total: total, dimensions_measurable: 0, coverage_pct: coveragePct },
        band_thresholds: bandThresholds,
      },
    };
  }

  let num = 0;
  let den = 0;
  measurable.forEach((d, i) => {
    const product = (d.score as number) * d.rollup_weight;
    num += product;
    den += d.rollup_weight;
    steps.push({
      n: i + 1,
      label: `dimension · ${d.ei_dimension_id}`,
      expr: `score ${round1(d.score as number)} × rollup_weight ${d.rollup_weight}`,
      value: round1(product),
    });
  });

  const rawScore = den > 0 ? num / den : null;
  const clamped = rawScore != null ? clamp(rawScore) : null;
  const eiScore = clamped != null ? round1(clamped) : null;
  const band = eiScore != null ? bandFor(eiScore, bandThresholds) : null;

  steps.push({ n: steps.length + 1, label: 'Σ weighted scores (numerator)', value: round1(num) });
  steps.push({ n: steps.length + 1, label: 'Σ rollup weights (denominator)', value: round1(den) });
  steps.push({
    n: steps.length + 1,
    label: 'weighted mean',
    expr: `${round1(num)} / ${round1(den)}`,
    value: rawScore != null ? round1(rawScore) : null,
  });
  steps.push({ n: steps.length + 1, label: 'clamp to 0–100', value: eiScore });
  steps.push({
    n: steps.length + 1,
    label: 'band',
    expr: `thresholds ex≥${bandThresholds.excellent ?? 80} st≥${bandThresholds.strong ?? 65} dv≥${bandThresholds.developing ?? 50} em≥${bandThresholds.emerging ?? 35}`,
    value: band,
  });

  return {
    measurable: eiScore != null,
    ei_score: eiScore,
    band,
    dimensions_total: total,
    dimensions_measurable: measurable.length,
    coverage_pct: coveragePct,
    confidence: dimensionConfidence(measurement, coveragePct, opts.confidence_cap),
    trace: {
      method: 'roll-up weighted_mean over measurable dimensions',
      measurement,
      formula: 'EI = Σ(score_d × rollup_weight_d) / Σ(rollup_weight_d)  [measurable d only]',
      steps,
      numerator: round1(num),
      denominator: round1(den),
      raw_score: rawScore != null ? round1(rawScore) : null,
      clamped_score: eiScore,
      coverage: {
        dimensions_total: total,
        dimensions_measurable: measurable.length,
        coverage_pct: coveragePct,
      },
      band_thresholds: bandThresholds,
    },
  };
}
