/**
 * Phase 2 — Empirical Percentile Engine.
 *
 * Replaces Gaussian percentile assumptions with the empirical definition:
 *     percentile = count(samples <= user_score) / n
 *
 * The z-score is retained for *diagnostics only* (drift detection,
 * distributional sanity checks). It is never used to derive percentiles.
 */

export interface PercentileResult {
  percentile: number;        // 0..100, empirical
  n: number;
  method: 'empirical';
  z_diagnostic: number | null;
  confidence_interval_95: [number, number] | null;
  band: 'bottom' | 'lower' | 'mid' | 'upper' | 'top';
}

/**
 * Binary search: index of first element strictly greater than x.
 * Equivalent to count of elements <= x.
 */
function upperBound(sorted: number[], x: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Empirical percentile rank of `score` in `sortedSamples` (ascending).
 *
 * For very small samples (n < kMin), result is still returned but flagged
 * via the surrounding `band` computation as low-confidence by the caller.
 */
export function empiricalPercentile(
  sortedSamples: readonly number[],
  score: number,
): PercentileResult {
  const n = sortedSamples.length;
  if (n === 0) {
    return { percentile: 50, n: 0, method: 'empirical',
             z_diagnostic: null, confidence_interval_95: null, band: 'mid' };
  }
  const rank = upperBound(sortedSamples as number[], score);
  const pct  = (rank / n) * 100;

  // Diagnostic z (NOT used for percentile)
  let z: number | null = null;
  if (n > 1) {
    let sum = 0; for (const s of sortedSamples) sum += s;
    const mean = sum / n;
    let sq = 0; for (const s of sortedSamples) sq += (s - mean) ** 2;
    const sd = Math.sqrt(sq / (n - 1));
    z = sd > 0 ? (score - mean) / sd : 0;
  }

  // Wilson-style 95% CI on the rank proportion → percentile bounds
  let ci: [number, number] | null = null;
  if (n >= 5) {
    const p = rank / n;
    const z95 = 1.96;
    const denom = 1 + (z95 ** 2) / n;
    const centre = (p + (z95 ** 2) / (2 * n)) / denom;
    const margin = (z95 * Math.sqrt((p * (1 - p) + (z95 ** 2) / (4 * n)) / n)) / denom;
    ci = [
      Math.max(0, (centre - margin) * 100),
      Math.min(100, (centre + margin) * 100),
    ];
  }

  const band: PercentileResult['band'] =
    pct < 10 ? 'bottom' :
    pct < 25 ? 'lower'  :
    pct < 75 ? 'mid'    :
    pct < 90 ? 'upper'  : 'top';

  return { percentile: round(pct), n, method: 'empirical',
           z_diagnostic: z === null ? null : round(z, 3),
           confidence_interval_95: ci ? [round(ci[0]), round(ci[1])] : null,
           band };
}

/**
 * Confidence tier from sample size (Phase 2 spec):
 *   A=1000, B=300, C=100, D=30, else provisional.
 */
export function confidenceTier(n: number): 'A' | 'B' | 'C' | 'D' | 'provisional' {
  if (n >= 1000) return 'A';
  if (n >=  300) return 'B';
  if (n >=  100) return 'C';
  if (n >=   30) return 'D';
  return 'provisional';
}

const round = (v: number, dp = 2) => Math.round(v * 10 ** dp) / 10 ** dp;
