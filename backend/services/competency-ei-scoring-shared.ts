/**
 * Phase 3.3 — Employability Scoring Engine · SHARED PRIMITIVES
 * ============================================================================
 * Leaf module (no sibling-engine imports → no cycles). Holds the pure scoring
 * math + shared types used by BOTH:
 *   - services/competency-ei-dimensions.ts   (Phase 3.2 dimension mapping)
 *   - services/dimension-scoring-engine.ts   (Phase 3.3 per-dimension scorer)
 *   - services/ei-calculation-engine.ts      (Phase 3.3 EI roll-up)
 *   - services/employability-scoring-engine.ts (Phase 3.3 orchestrator + audit)
 *
 * Honesty canon: compose, never recompute; never impute an unmeasured value;
 * Coverage (how much measured) and Confidence (how trustworthy) are SEPARATE
 * axes; domain-proxy measurement CAPS confidence — it never inflates a score.
 *
 * SINGLE SOURCE OF TRUTH: the dimension/EI arithmetic lives ONCE here and in
 * the two pure engines that import these helpers. The 3.2 dimensions endpoint
 * and the 3.3 scoring endpoint therefore compute identical numbers by
 * construction — they cannot drift.
 */

export const DEFAULT_BAND_THRESHOLDS: Record<string, number> = {
  excellent: 80,
  strong: 65,
  developing: 50,
  emerging: 35,
};

export function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function bandFor(score: number, t: Record<string, number>): string {
  const ex = Number(t?.excellent ?? 80);
  const st = Number(t?.strong ?? 65);
  const dv = Number(t?.developing ?? 50);
  const em = Number(t?.emerging ?? 35);
  if (score >= ex) return 'Excellent';
  if (score >= st) return 'Strong';
  if (score >= dv) return 'Developing';
  if (score >= em) return 'Emerging';
  return 'Early';
}

// ----------------------------------------------------------------------------
// Shared types
// ----------------------------------------------------------------------------

/** One competency edge into a dimension, with its (domain-proxy) score. */
export interface DimensionComponent {
  competency_id: string;
  competency_name: string | null;
  onto_domain: string | null;
  contribution_weight: number;
  proxy_score: number | null; // domain-proxy score (null when its domain was not measured)
  measured: boolean;
}

export interface DimensionConfidence {
  score: number;
  band: 'High' | 'Moderate' | 'Limited' | 'Low' | 'None';
  measurement: string;
  caps: string[];
  factors: string[];
}

/** The calculation parameters for ONE dimension (projected from config rows). */
export interface DimensionScoringRule {
  ei_dimension_id: string;
  dimension_name: string;
  description: string;
  rollup_weight: number;
  min_components: number;
  min_coverage_pct: number;
  domain_proxy_confidence_cap: number;
  band_thresholds: Record<string, number>;
  aggregation_method: string;
  score_source: string;
}

/** One auditable, human-readable step in a calculation trace. */
export interface CalcStep {
  n: number;
  label: string;
  expr?: string;
  value?: number | string | null;
  note?: string;
}

// ----------------------------------------------------------------------------
// Confidence — shared between dimension scorer and EI roll-up
// ----------------------------------------------------------------------------

export function emptyConfidence(measurement: string, reason: string): DimensionConfidence {
  return { score: 0, band: 'None', measurement, caps: [], factors: [reason] };
}

/**
 * Confidence = how trustworthy the measurement is, on its OWN axis.
 * domain_proxy measurement caps the ceiling; mapped-competency coverage below
 * 100% applies a bounded penalty. Never inflates the score it describes.
 */
export function dimensionConfidence(
  measurement: string,
  coveragePct: number,
  cap: number,
): DimensionConfidence {
  const caps: string[] = [];
  const factors: string[] = [];
  let ceiling = 100;
  let score = 100;

  if (measurement === 'domain_proxy') {
    ceiling = cap;
    caps.push(`measurement is domain_proxy → confidence capped at ${cap}`);
  }
  if (coveragePct < 100) {
    const pen = Math.min(40, Math.round((100 - coveragePct) * 0.4));
    score -= pen;
    factors.push(`${round1(coveragePct)}% mapped-competency coverage (−${pen})`);
  }
  score = clamp(Math.min(score, ceiling));

  let band: DimensionConfidence['band'];
  if (score >= 75) band = 'High';
  else if (score >= 50) band = 'Moderate';
  else if (score >= 25) band = 'Limited';
  else band = 'Low';

  return { score: round1(score), band, measurement, caps, factors };
}

export const LANGUAGE_POLICY = {
  intent: 'developmental_signal_only',
  allowed_terms: ['employability readiness', 'readiness dimension', 'growth areas', 'strengths', 'coverage', 'confidence'],
  disallowed_terms: ['hire', 'do not hire', 'reject', 'suitability', 'rank candidates', 'pass', 'fail', 'promotion decision'],
  disclaimer:
    'Employability readiness scores are developmental signals composed from competency assessment. ' +
    'NOT a hiring, promotion, or suitability prediction.',
};
