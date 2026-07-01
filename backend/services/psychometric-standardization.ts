/**
 * Psychometric Standardization (CAPADEX 3.0 · Program 3 · Phase 3.1 · AP-7)
 * ---------------------------------------------------------------------------
 * PURE, additive standardization transforms over a z-score. Closes GAP-AP-7:
 *   • Canonical T-score (mean 50, SD **10**) — the psychometrically-correct T.
 *   • Stanine (1..9, mean 5, SD 2).
 *   • Sten (1..10, mean 5.5, SD 2).
 *   • An HONEST label for the pre-existing `50 + z*15` transform: it is a
 *     DEVIATION score (SD=15), NOT a T-score. Exposed as `deviationScore` so
 *     callers stop mislabelling it.
 *
 * These are trivial linear/threshold transforms of the standard normal — no new
 * science, no new data, no fabrication. Every function is pure: given the same
 * z it returns the same value, deterministically. NOTHING here reads or writes.
 *
 * Honesty contract:
 *  - A standard score is only meaningful when a real reference distribution
 *    produced the z. Producing z from a fabricated / absent norm is the caller's
 *    responsibility to refuse; this module never invents a z.
 *  - `null` z in → `null` out (never a fabricated 50 / stanine 5).
 */

/** Abramowitz & Stegun 7.1.26 approximation of the error function (shared math). */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/** Standard-normal CDF Φ(z) ∈ (0,1). */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Percentile (1..99) from a z-score. Clamped away from 0/100 like the norms engine. */
export function zToPercentile(z: number | null): number | null {
  if (z == null || !Number.isFinite(z)) return null;
  return Math.max(1, Math.min(99, Math.round(normalCdf(z) * 100)));
}

/**
 * Canonical T-score: mean 50, **SD 10**. T = 50 + z*10.
 * Conventionally clamped to the reportable 20..80 window (±3 SD).
 */
export function zToT(z: number | null): number | null {
  if (z == null || !Number.isFinite(z)) return null;
  const t = 50 + z * 10;
  return Math.round(Math.max(20, Math.min(80, t)) * 10) / 10;
}

/**
 * DEVIATION score (mean 50, SD **15**) — the pre-existing `50 + z*15` transform,
 * honestly labelled. This is NOT a T-score; kept only so legacy callers have a
 * correctly-named home for the value they were mislabelling as "T-like".
 */
export function zToDeviationScore(z: number | null): number | null {
  if (z == null || !Number.isFinite(z)) return null;
  const d = 50 + z * 15;
  return Math.round(Math.max(0, Math.min(100, d)) * 10) / 10;
}

/**
 * Stanine (STAndard NINE): integer 1..9, mean 5, SD 2. Standard boundary cuts at
 * the classic percentile breakpoints (4,11,23,40,60,77,89,96). Stanine = round to
 * nearest integer of (z*2 + 5), clamped 1..9 — equivalent to the percentile cuts.
 */
export function zToStanine(z: number | null): number | null {
  if (z == null || !Number.isFinite(z)) return null;
  const s = Math.round(z * 2 + 5);
  return Math.max(1, Math.min(9, s));
}

/** Sten (STandard TEN): integer 1..10, mean 5.5, SD 2. Sten = round(z*2 + 5.5), 1..10. */
export function zToSten(z: number | null): number | null {
  if (z == null || !Number.isFinite(z)) return null;
  const s = Math.round(z * 2 + 5.5);
  return Math.max(1, Math.min(10, s));
}

/** Textual interpretation band for a stanine (below-average / average / above-average). */
export function stanineBand(stanine: number | null): 'low' | 'below_average' | 'average' | 'above_average' | 'high' | null {
  if (stanine == null) return null;
  if (stanine <= 2) return 'low';
  if (stanine === 3) return 'below_average';
  if (stanine >= 4 && stanine <= 6) return 'average';
  if (stanine === 7) return 'above_average';
  return 'high';
}

export interface StandardScoreSet {
  z: number | null;
  percentile: number | null;
  t_score: number | null;          // canonical T, SD=10
  stanine: number | null;          // 1..9
  sten: number | null;             // 1..10
  deviation_score: number | null;  // SD=15, honestly labelled (NOT a T)
  stanine_band: ReturnType<typeof stanineBand>;
}

/**
 * Compute the full canonical standard-score set from a z-score. `null` z (no norm
 * available) yields an all-null set — never a fabricated score.
 */
export function standardScoresFromZ(z: number | null): StandardScoreSet {
  const stanine = zToStanine(z);
  return {
    z: z != null && Number.isFinite(z) ? Math.round(z * 1000) / 1000 : null,
    percentile: zToPercentile(z),
    t_score: zToT(z),
    stanine,
    sten: zToSten(z),
    deviation_score: zToDeviationScore(z),
    stanine_band: stanineBand(stanine),
  };
}

/** Derive z from a raw value against a real reference (mean, sd). sd<=0 → null (no discrimination). */
export function zFromValue(value: number | null, mean: number | null, sd: number | null): number | null {
  if (value == null || mean == null || sd == null) return null;
  if (!Number.isFinite(value) || !Number.isFinite(mean) || !Number.isFinite(sd) || sd <= 0) return null;
  return (value - mean) / sd;
}
