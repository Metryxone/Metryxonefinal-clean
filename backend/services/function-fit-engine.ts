/**
 * Phase 3.7 — Function Fit Engine.
 *
 * PURE, deterministic, never-throws fit classification for a subject against a
 * FUNCTION's aggregated competency demand (e.g. Engineering, Product, Risk).
 * Developmental signal only — NEVER a hiring/placement verdict.
 *
 * Composes (never recomputes) the function ReadinessResult produced by the
 * function-readiness-engine. The fit band is derived from the weighted readiness
 * score and CAPPED by blocking (critical) gaps — mirroring the role/industry
 * fit contract so every readiness surface stays consistent.
 *
 * Honesty contract:
 *   - Abstains ('unmeasured') when there is no measured readiness — never a 0.
 *   - A blocking critical gap can never read as a Strong/Good fit.
 */

import { roleFit, type ReadinessResult } from './role-competency-profile.js';

export const FUNCTION_FIT_ENGINE_VERSION = 'phase-3.7';

export interface FunctionFit {
  fit_band: 'strong' | 'good' | 'partial' | 'low' | 'unmeasured';
  label: string;
  score: number | null;
  capped_by_critical: boolean;
}

/**
 * Classify a subject's fit to a function from its readiness result. `readiness`
 * may be null (function has no derivable requirements / subject unscored) → fit
 * is 'unmeasured' (never assumed).
 */
export function assessFunctionFit(readiness: ReadinessResult | null | undefined): FunctionFit {
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
