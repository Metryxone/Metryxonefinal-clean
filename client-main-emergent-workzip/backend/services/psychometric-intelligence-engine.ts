/**
 * Psychometric Intelligence Engine — simplified IRT (3PL), Cronbach α,
 * factor-loading approximation, construct validity coefficient computation.
 * Pure functions (no external statistical libs).
 */
import type { Pool, PoolClient } from 'pg';
export const PSYCHOMETRIC_ENGINE_VERSION = '7.0.0';
type Q = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

/** 3PL IRT probability of correct response. */
export function irt3PL(theta: number, a: number, b: number, c: number): number {
  const z = a * (theta - b);
  const sig = 1 / (1 + Math.exp(-z));
  return Math.max(0, Math.min(1, c + (1 - c) * sig));
}

/** Cronbach α from per-item variances + total-score variance.
 *  α = (k / (k-1)) * (1 - Σσ²ᵢ / σ²_total)
 */
export function cronbachAlpha(itemVariances: number[], totalVariance: number): number {
  const k = itemVariances.length;
  if (k < 2 || totalVariance <= 0) return 0;
  const sumItemVar = itemVariances.reduce((a, b) => a + b, 0);
  return Math.max(0, Math.min(1, (k / (k - 1)) * (1 - sumItemVar / totalVariance)));
}

/** Pearson correlation, returns 0 on insufficient data. */
export function pearsonR(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; num += dx * dy; sx += dx * dx; sy += dy * dy; }
  if (sx === 0 || sy === 0) return 0;
  return num / Math.sqrt(sx * sy);
}

/** Approximate single-factor loading via item-total correlation. */
export function factorLoading(itemScores: number[], totalScores: number[]): number {
  return Math.max(-1, Math.min(1, pearsonR(itemScores, totalScores)));
}

/** Variance helper. */
export function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1);
}

/** Latent-trait MAP estimate (one-step Newton); coarse but pure. */
export function estimateTheta(responses: Array<{ a: number; b: number; c: number; correct: boolean }>): number {
  if (!responses.length) return 0;
  let theta = 0;
  for (let iter = 0; iter < 8; iter++) {
    let num = 0, den = 0;
    for (const r of responses) {
      const p = irt3PL(theta, r.a, r.b, r.c);
      const w = p * (1 - p);
      num += r.a * ((r.correct ? 1 : 0) - p);
      den += r.a * r.a * w;
    }
    if (den === 0) break;
    theta += num / den;
    if (Math.abs(num / den) < 1e-4) break;
  }
  return Math.max(-4, Math.min(4, theta));
}

// ── DB persistence ───────────────────────────────────────────────────────
export async function persistPsychometricModel(pool: Q, args: {
  modelKey: string; competencyKey: string; a?: number; b?: number; c?: number;
  alpha?: number; loading?: number; sampleSize?: number;
}) {
  try {
    await pool.query(
      `INSERT INTO psychometric_models (model_key, competency_key, irt_a, irt_b, irt_c, cronbach_alpha, factor_loading, sample_size)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (model_key) DO UPDATE SET irt_a=EXCLUDED.irt_a, irt_b=EXCLUDED.irt_b, irt_c=EXCLUDED.irt_c, cronbach_alpha=EXCLUDED.cronbach_alpha, factor_loading=EXCLUDED.factor_loading, sample_size=EXCLUDED.sample_size`,
      [args.modelKey, args.competencyKey, args.a ?? null, args.b ?? null, args.c ?? null, args.alpha ?? null, args.loading ?? null, args.sampleSize ?? null],
    );
  } catch (e) { console.warn('[psycho] persist failed:', (e as Error).message); }
}

export async function persistValidity(pool: Q, competencyKey: string, validityType: string, coefficient: number, sampleSize?: number) {
  try {
    await pool.query(
      `INSERT INTO competency_validity_models (competency_key, validity_type, coefficient, sample_size) VALUES ($1,$2,$3,$4)`,
      [competencyKey, validityType, coefficient, sampleSize ?? null],
    );
  } catch (e) { console.warn('[psycho] validity persist failed:', (e as Error).message); }
}

export async function persistReliability(pool: Q, competencyKey: string, reliabilityType: string, coefficient: number, sampleSize?: number) {
  try {
    await pool.query(
      `INSERT INTO reliability_validation_models (competency_key, reliability_type, coefficient, sample_size) VALUES ($1,$2,$3,$4)`,
      [competencyKey, reliabilityType, coefficient, sampleSize ?? null],
    );
  } catch (e) { console.warn('[psycho] reliability persist failed:', (e as Error).message); }
}
