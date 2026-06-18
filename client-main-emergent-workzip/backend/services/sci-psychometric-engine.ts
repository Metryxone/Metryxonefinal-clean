/**
 * Scientific Psychometric Engine
 * Phase 2 Scientific Competency Intelligence (v2.0.0)
 * Pure computations + DB read for sci_psychometric_results.
 *
 * Cronbach α formula:
 *   α = k/(k-1) × (1 - Σ Var(i) / Var(total))
 *
 * Does NOT replace existing services/reliability-engine.ts or psychometric-calibration.ts.
 * This module provides defensible item-level psychometrics + fairness checks
 * for the new sci_* domain only.
 */
import type { Pool } from 'pg';

export const SCI_PSYCHOMETRIC_VERSION = '2.0.0';

function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
}

function pearson(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  const mx = x.reduce((s, v) => s + v, 0) / x.length;
  const my = y.reduce((s, v) => s + v, 0) / y.length;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) {
    const a = x[i] - mx, b = y[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

/**
 * itemResponses: 2D matrix [respondent][item] of numeric scores.
 * Returns Cronbach α plus standard diagnostics.
 */
export function cronbachAlpha(itemResponses: number[][]): { alpha: number; k_items: number; n_respondents: number; var_sum: number; var_total: number } {
  const n = itemResponses.length;
  const k = itemResponses[0]?.length ?? 0;
  if (n < 2 || k < 2) return { alpha: 0, k_items: k, n_respondents: n, var_sum: 0, var_total: 0 };
  const itemVars: number[] = [];
  for (let i = 0; i < k; i++) {
    const col = itemResponses.map(r => r[i]);
    itemVars.push(variance(col));
  }
  const totals = itemResponses.map(r => r.reduce((s, v) => s + v, 0));
  const totalVar = variance(totals);
  if (totalVar === 0) return { alpha: 0, k_items: k, n_respondents: n, var_sum: 0, var_total: 0 };
  const sumItem = itemVars.reduce((s, v) => s + v, 0);
  const alpha = (k / (k - 1)) * (1 - sumItem / totalVar);
  return {
    alpha: +alpha.toFixed(4),
    k_items: k, n_respondents: n,
    var_sum: +sumItem.toFixed(4), var_total: +totalVar.toFixed(4),
  };
}

export function reliabilityTier(alpha: number): 'A' | 'B' | 'C' | 'D' | 'provisional' {
  if (alpha >= 0.90) return 'A';
  if (alpha >= 0.80) return 'B';
  if (alpha >= 0.70) return 'C';
  if (alpha >= 0.60) return 'D';
  return 'provisional';
}

/** Test-retest reliability — Pearson correlation across two administrations. */
export function testRetest(t1: number[], t2: number[]) {
  return { r: +pearson(t1, t2).toFixed(4), n: Math.min(t1.length, t2.length) };
}

/**
 * Cohen's kappa for two raters on categorical ratings.
 * categories: numeric labels.
 */
export function cohensKappa(raterA: number[], raterB: number[]): { kappa: number; agreement: number; chance: number } {
  if (raterA.length !== raterB.length || raterA.length === 0) return { kappa: 0, agreement: 0, chance: 0 };
  const n = raterA.length;
  const cats = new Set<number>([...raterA, ...raterB]);
  let agree = 0;
  for (let i = 0; i < n; i++) if (raterA[i] === raterB[i]) agree++;
  const pa = agree / n;
  let pe = 0;
  for (const c of cats) {
    const fa = raterA.filter(v => v === c).length / n;
    const fb = raterB.filter(v => v === c).length / n;
    pe += fa * fb;
  }
  const kappa = pe === 1 ? 1 : (pa - pe) / (1 - pe);
  return { kappa: +kappa.toFixed(4), agreement: +pa.toFixed(4), chance: +pe.toFixed(4) };
}

/**
 * Adverse impact ratio (four-fifths rule).
 * Returns ratio = groupB selection / groupA selection.
 * passes_four_fifths = ratio >= 0.80
 */
export function adverseImpact(groupAPositive: number, groupATotal: number, groupBPositive: number, groupBTotal: number) {
  if (groupATotal === 0 || groupBTotal === 0) return { ratio: null, passes_four_fifths: false };
  const a = groupAPositive / groupATotal;
  const b = groupBPositive / groupBTotal;
  if (a === 0) return { ratio: null, passes_four_fifths: false };
  const ratio = b / a;
  return { ratio: +ratio.toFixed(4), passes_four_fifths: ratio >= 0.80 };
}

/** Construct validity — correlation between a measured score and a criterion. */
export function constructValidity(scores: number[], criterion: number[]) {
  return { r: +pearson(scores, criterion).toFixed(4), n: Math.min(scores.length, criterion.length) };
}

export function createSciPsychometricEngine(pool: Pool) {
  async function recordResult(input: {
    assessment_id: string; competency_id?: string | null; sample_size: number;
    alpha?: number; validity?: number; test_retest?: number; kappa?: number;
  }) {
    const id = `spsy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const tier = input.alpha != null ? reliabilityTier(input.alpha) : 'provisional';
    await pool.query(
      `INSERT INTO sci_psychometric_results
         (id, assessment_id, competency_id, sample_size, cronbach_alpha, reliability_tier,
          validity_score, test_retest_r, inter_rater_kappa)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, input.assessment_id, input.competency_id ?? null, input.sample_size,
       input.alpha ?? null, tier, input.validity ?? null, input.test_retest ?? null, input.kappa ?? null]
    );
    return { id, reliability_tier: tier };
  }

  async function listResults(assessmentId: string) {
    const { rows } = await pool.query(
      `SELECT * FROM sci_psychometric_results WHERE assessment_id = $1 ORDER BY computed_at DESC LIMIT 100`,
      [assessmentId]
    );
    return rows;
  }

  /** Demo computation: synthetic 5-item × 30-respondent matrix for any assessment id. */
  function demoMatrix(seed = 42, k = 8, n = 30): number[][] {
    let s = seed;
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    return Array.from({ length: n }, () => {
      const trait = rand() * 4 + 1; // 1..5
      return Array.from({ length: k }, () => Math.max(1, Math.min(5, Math.round(trait + (rand() - 0.5) * 1.2))));
    });
  }

  function fullDiagnostics(seed = 42) {
    const matrix = demoMatrix(seed);
    const a = cronbachAlpha(matrix);
    // Deterministic seeded RNG for retest + rater-2 jitter (separate stream)
    let s = (seed * 31 + 7) | 0;
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const totalA = matrix.map(r => r.reduce((s2, v) => s2 + v, 0));
    const totalB = totalA.map(t => t + Math.round((rand() - 0.5) * 2));
    const tr = testRetest(totalA, totalB);
    const ratings = matrix.map(r => Math.round(r.reduce((s2, v) => s2 + v, 0) / r.length));
    const ratings2 = ratings.map(r => Math.max(1, Math.min(5, r + (rand() < 0.85 ? 0 : 1))));
    const kappa = cohensKappa(ratings, ratings2);
    const fairness = adverseImpact(12, 20, 10, 20);
    return {
      cronbach: a,
      reliability_tier: reliabilityTier(a.alpha),
      test_retest: tr,
      inter_rater: kappa,
      fairness,
      methodology_version: SCI_PSYCHOMETRIC_VERSION,
    };
  }

  return { recordResult, listResults, demoMatrix, fullDiagnostics };
}
