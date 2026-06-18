/**
 * Career Builder — First Outcome Evidence Engine (pure, read-only).
 *
 * Given a set of (prior_score, outcome) pairs this computes an HONEST association
 * statistic linking a prior MetryxOne score to a real-world observed outcome:
 *   - binary outcomes (goal achieved 1/0)  -> point-biserial correlation + group means
 *   - continuous outcomes (e.g. EI lift)   -> Pearson correlation
 * plus n, a 95% confidence interval (Fisher-z), and a two-sided p-value.
 *
 * Honesty rules baked in here (not the caller's job):
 *   - `validated` only ever flips true when n >= MIN_VALIDATION_N, the cohort is
 *     real (caller passes only non-demo rows), both groups are populated (binary),
 *     and p < 0.05. Demo/synthetic data can never be "validated".
 *   - When n is too small the status is INSUFFICIENT_EVIDENCE and no claim is made.
 *   - Nothing is fabricated: empty input yields an explicit empty/abstain result.
 */

export const MIN_VALIDATION_N = 30;

export interface OutcomePair {
  priorScore: number;
  outcomeValue: number; // 0/1 for binary, real delta for continuous
}

export type EvidenceStatus =
  | 'VALIDATED'
  | 'PRELIMINARY'
  | 'INSUFFICIENT_EVIDENCE';

export interface EvidenceResult {
  kind: 'binary' | 'continuous';
  n: number;
  /** point-biserial (binary) or Pearson (continuous) correlation; null when not computable */
  r: number | null;
  /** 95% CI on r via Fisher z-transform; null when n < 4 */
  ci95: [number, number] | null;
  /** two-sided p-value for r != 0; null when not computable */
  pValue: number | null;
  /** binary only: group sizes and mean prior score per group */
  groups: {
    achieved: { n: number; meanPriorScore: number | null };
    notAchieved: { n: number; meanPriorScore: number | null };
    meanScoreGap: number | null; // achieved - notAchieved
  } | null;
  validated: boolean;
  status: EvidenceStatus;
  caveats: string[];
}

function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2) return null;
  const mx = mean(xs)!;
  const my = mean(ys)!;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (den === 0) return null; // no variance in one variable
  return num / den;
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 erf approximation). */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p =
    d *
    t *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

/**
 * Two-sided p-value for a correlation r with sample size n.
 * Uses the Fisher z-transform with normal approximation (honest about being an
 * approximation; exact small-n inference would use the t-distribution).
 */
function pValueForR(r: number, n: number): number | null {
  if (n < 4 || Math.abs(r) >= 1) return null;
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const stat = Math.abs(z / se);
  return 2 * (1 - normalCdf(stat));
}

function fisherCi(r: number, n: number): [number, number] | null {
  if (n < 4 || Math.abs(r) >= 1) return null;
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const lo = z - 1.959963985 * se;
  const hi = z + 1.959963985 * se;
  const back = (v: number) => (Math.exp(2 * v) - 1) / (Math.exp(2 * v) + 1);
  return [back(lo), back(hi)];
}

/**
 * Build an honest evidence result from outcome pairs.
 * @param pairs   prior-score / outcome pairs (caller filters demo vs real)
 * @param kind    'binary' | 'continuous'
 * @param isReal  whether these pairs are real (non-demo). Demo can never validate.
 */
export function computeEvidence(
  pairs: OutcomePair[],
  kind: 'binary' | 'continuous',
  isReal: boolean,
): EvidenceResult {
  const caveats: string[] = [];
  const clean = pairs.filter(
    (p) => Number.isFinite(p.priorScore) && Number.isFinite(p.outcomeValue),
  );
  const n = clean.length;

  if (n === 0) {
    return {
      kind, n: 0, r: null, ci95: null, pValue: null, groups: null,
      validated: false, status: 'INSUFFICIENT_EVIDENCE',
      caveats: ['No (prior score, observed outcome) pairs available yet — nothing to validate.'],
    };
  }

  const xs = clean.map((p) => p.priorScore);
  const ys = clean.map((p) => p.outcomeValue);
  const r = pearson(xs, ys); // point-biserial == Pearson with a 0/1 variable

  let groups: EvidenceResult['groups'] = null;
  if (kind === 'binary') {
    const achievedScores = clean.filter((p) => p.outcomeValue >= 0.5).map((p) => p.priorScore);
    const notScores = clean.filter((p) => p.outcomeValue < 0.5).map((p) => p.priorScore);
    const ma = mean(achievedScores);
    const mn = mean(notScores);
    groups = {
      achieved: { n: achievedScores.length, meanPriorScore: ma },
      notAchieved: { n: notScores.length, meanPriorScore: mn },
      meanScoreGap: ma != null && mn != null ? ma - mn : null,
    };
    if (achievedScores.length === 0 || notScores.length === 0) {
      caveats.push('Only one outcome group is populated — a correlation needs both achievers and non-achievers.');
    }
  }

  const pValue = r != null ? pValueForR(r, n) : null;
  const ci95 = r != null ? fisherCi(r, n) : null;

  if (!isReal) caveats.push('Synthetic demonstration cohort — illustrates the pipeline only; NOT real-world validation.');
  if (n < MIN_VALIDATION_N) caveats.push(`n=${n} is below the minimum cohort size (${MIN_VALIDATION_N}) required for a validated claim.`);
  if (r == null) caveats.push('Correlation not computable (no variance in prior score or outcome).');

  const bothGroups = kind === 'continuous' || (groups != null && groups.achieved.n > 0 && groups.notAchieved.n > 0);
  const significant = pValue != null && pValue < 0.05;
  const validated = isReal && n >= MIN_VALIDATION_N && bothGroups && r != null && significant;

  let status: EvidenceStatus;
  if (n < MIN_VALIDATION_N || !bothGroups || r == null) status = 'INSUFFICIENT_EVIDENCE';
  else if (validated) status = 'VALIDATED';
  else status = 'PRELIMINARY';

  return { kind, n, r, ci95, pValue, groups, validated, status, caveats };
}
