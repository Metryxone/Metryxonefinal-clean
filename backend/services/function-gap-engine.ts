/**
 * Phase 3.7 — Function Gap Engine.
 *
 * PURE, deterministic, never-throws extraction of the gap areas between a
 * subject and a FUNCTION's aggregated competency demand. Developmental signal
 * only — never a hiring/placement verdict.
 *
 * Composes (never recomputes) the function ReadinessResult. Surfaces the gap
 * areas, the critical (blocking) gaps, and the single most material (top) gap so
 * a development plan can be anchored on it. Mirrors the role/industry gap shape.
 *
 * Honesty contract:
 *   - Only ASSESSED competencies (those with an actual proficiency) can be a gap;
 *     unassessed competencies are a Coverage gap, never a fabricated shortfall.
 *   - top_gap prefers the largest BLOCKING (critical) gap, else the largest gap.
 */

import type { ReadinessResult, ReadinessGap } from './role-competency-profile.js';

export const FUNCTION_GAP_ENGINE_VERSION = 'phase-3.7';

export interface FunctionGapTop {
  competency_id: string;
  competency_name: string | null;
  required_level: number;
  actual_level: number | null;
  gap: number;
  criticality: string;
  blocking: boolean;
}

export interface FunctionGap {
  top_gap: FunctionGapTop | null;
  gap_areas: ReadinessGap[];
  critical_gaps: ReadinessGap[];
  blocking_gaps: number;
}

function pickTopGap(readiness: ReadinessResult): FunctionGapTop | null {
  // Prefer the largest blocking (critical) gap; otherwise the largest gap area.
  const pool = readiness.critical_gaps.length > 0 ? readiness.critical_gaps : readiness.gap_areas;
  if (pool.length === 0) return null;
  const top = [...pool].sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0];
  if (top.gap == null) return null;
  return {
    competency_id: top.competency_id,
    competency_name: top.competency_name,
    required_level: top.required_level,
    actual_level: top.actual_level,
    gap: top.gap,
    criticality: top.criticality,
    blocking: top.blocking,
  };
}

/**
 * Extract the function gap view from a readiness result. `readiness` may be null
 * (no derivable requirements / subject unscored) → an empty, honest gap view.
 */
export function assessFunctionGaps(readiness: ReadinessResult | null | undefined): FunctionGap {
  if (!readiness || !readiness.measured) {
    return { top_gap: null, gap_areas: [], critical_gaps: [], blocking_gaps: 0 };
  }
  return {
    top_gap: pickTopGap(readiness),
    gap_areas: readiness.gap_areas,
    critical_gaps: readiness.critical_gaps,
    blocking_gaps: readiness.blocking_gaps,
  };
}
