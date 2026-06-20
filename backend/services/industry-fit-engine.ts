/**
 * Phase 3.6 — Industry Fit Engine.
 *
 * PURE, deterministic, never-throws fit classification for a subject against an
 * INDUSTRY's aggregated competency demand. Developmental signal only — NEVER a
 * hiring/placement verdict.
 *
 * Composes (never recomputes) the industry ReadinessResult produced by the
 * industry-readiness-engine. The fit band is derived from the weighted
 * readiness score and CAPPED by blocking (critical) gaps — exactly mirroring
 * the role-level roleFit contract so the two surfaces stay consistent.
 *
 * Honesty contract:
 *   - Abstains ('unmeasured') when there is no measured readiness — never a 0.
 *   - A blocking critical gap can never read as a Strong/Good fit.
 */

import { roleFit, type ReadinessResult } from './role-competency-profile.js';

export const INDUSTRY_FIT_ENGINE_VERSION = 'phase-3.6';

export interface IndustryFit {
  fit_band: 'strong' | 'good' | 'partial' | 'low' | 'unmeasured';
  label: string;
  score: number | null;
  capped_by_critical: boolean;
}

/**
 * Classify a subject's fit to an industry from its readiness result. `readiness`
 * may be null (industry has no derivable requirements / subject unscored) →
 * fit is 'unmeasured' (never assumed).
 */
export function assessIndustryFit(readiness: ReadinessResult | null | undefined): IndustryFit {
  if (!readiness || !readiness.measured || readiness.readiness_score == null) {
    return { fit_band: 'unmeasured', label: 'Unmeasured', score: null, capped_by_critical: false };
  }
  const fit = roleFit(readiness.readiness_score, readiness.blocking_gaps);
  return {
    fit_band: fit.band,
    label: fit.label,
    score: fit.score,
    capped_by_critical: fit.capped_by_critical,
  };
}
