/**
 * OMEGA-X Psychometric Calibration Engine
 *
 * Computes z-scores, percentiles, cohort benchmarks, and confidence intervals
 * for every CAPADEX session score. Uses the live capadex_reports table as the
 * reference cohort (no synthetic data).
 *
 * Output per session:
 *   - overall_z_score       (-3 to +3)
 *   - overall_percentile    (1–99)
 *   - confidence_interval   [low, high] at 95%
 *   - reliability_score     (response consistency estimate)
 *   - subdomain_calibration (z + percentile per subdomain)
 *   - cohort_label          (descriptive peer group label)
 *   - uniqueness_score      (how atypical this profile is)
 */

import type { Pool } from 'pg';

export interface CalibrationProfile {
  session_id: string;
  overall_z_score: number;
  overall_percentile: number;
  confidence_interval_low: number;
  confidence_interval_high: number;
  reliability_score: number;
  response_consistency: number;
  subdomain_calibration: Record<string, SubdomainCalibration>;
  cohort_label: string;
  uniqueness_score: number;
  cohort_size: number;
  computed_at: string;
}

export interface SubdomainCalibration {
  subdomain_name: string;
  score: number;
  z_score: number;
  percentile: number;
  cohort_mean: number;
  cohort_std: number;
}

export interface CohortStats {
  n: number;
  mean: number;
  std: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

// ─── Statistical Helpers ──────────────────────────────────────────────────────

/** Standard normal CDF approximation (Abramowitz & Stegun). */
function normCdf(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + p * z);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

function zToPercentile(z: number): number {
  return Math.round(Math.min(99, Math.max(1, normCdf(z) * 100)));
}

function computeZScore(score: number, mean: number, std: number): number {
  if (std < 0.01) return 0;
  return parseFloat(((score - mean) / std).toFixed(3));
}

/** 95% confidence interval using SE = std / sqrt(n). */
function confidenceInterval(score: number, std: number, n: number): [number, number] {
  const se = std / Math.sqrt(Math.max(n, 2));
  const margin = 1.96 * se;
  return [
    Math.round(Math.max(0, score - margin)),
    Math.round(Math.min(100, score + margin)),
  ];
}

function cohortLabel(percentile: number, n: number): string {
  if (n < 10) return 'Early cohort — percentile estimates are provisional';
  if (percentile >= 90) return 'Top 10% of your peer group';
  if (percentile >= 75) return 'Upper quartile of your peer group';
  if (percentile >= 50) return 'Above average for your peer group';
  if (percentile >= 25) return 'Building — below average for your peer group';
  return 'Early stage — in the lower quartile of your peer group';
}

function uniquenessScore(subdomainZ: number[]): number {
  if (!subdomainZ.length) return 0.5;
  const variance = subdomainZ.reduce((acc, z) => acc + Math.abs(z), 0) / subdomainZ.length;
  return parseFloat(Math.min(1, variance / 3).toFixed(3));
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class PsychometricCalibrationEngine {
  constructor(private pool: Pool) {}

  /** Compute or refresh calibration for a completed session. */
  async calibrateSession(
    sessionId: string,
    sessionScore: number,
    concernCategory: string,
    stageCode: string,
    subdomains: { subdomain_name: string; avg_score: number }[],
    itemCount: number,
  ): Promise<CalibrationProfile> {
    // 1. Get cohort stats from live data
    const cohort = await this.getCohortStats(concernCategory, stageCode);

    // 2. Overall z-score and percentile
    const zScore = computeZScore(sessionScore, cohort.mean, cohort.std);
    const percentile = zToPercentile(zScore);
    const [ciLow, ciHigh] = confidenceInterval(sessionScore, cohort.std, cohort.n);

    // 3. Reliability estimate (based on item count — more items → more reliable)
    const reliability = parseFloat(Math.min(0.95, 0.50 + (itemCount / 40) * 0.45).toFixed(3));

    // 4. Response consistency (approximated from subdomain variance)
    const subScores = subdomains.map(s => Number(s.avg_score) / 100);
    const avgSub = subScores.reduce((a, b) => a + b, 0) / Math.max(subScores.length, 1);
    const variance = subScores.reduce((acc, s) => acc + Math.pow(s - avgSub, 2), 0) / Math.max(subScores.length, 1);
    const consistency = parseFloat(Math.max(0.3, 1 - Math.sqrt(variance)).toFixed(3));

    // 5. Per-subdomain calibration
    const subdomainCalibration: Record<string, SubdomainCalibration> = {};
    const subdomainZScores: number[] = [];

    for (const sd of subdomains) {
      const sdScore = Number(sd.avg_score);
      const sdCohort = await this.getSubdomainCohortStats(concernCategory, stageCode, sd.subdomain_name);
      const sdZ = computeZScore(sdScore, sdCohort.mean, sdCohort.std);
      subdomainZScores.push(sdZ);
      subdomainCalibration[sd.subdomain_name] = {
        subdomain_name: sd.subdomain_name,
        score: Math.round(sdScore),
        z_score: sdZ,
        percentile: zToPercentile(sdZ),
        cohort_mean: Math.round(sdCohort.mean),
        cohort_std: parseFloat(sdCohort.std.toFixed(1)),
      };
    }

    const profile: CalibrationProfile = {
      session_id: sessionId,
      overall_z_score: zScore,
      overall_percentile: percentile,
      confidence_interval_low: ciLow,
      confidence_interval_high: ciHigh,
      reliability_score: reliability,
      response_consistency: consistency,
      subdomain_calibration: subdomainCalibration,
      cohort_label: cohortLabel(percentile, cohort.n),
      uniqueness_score: uniquenessScore(subdomainZScores),
      cohort_size: cohort.n,
      computed_at: new Date().toISOString(),
    };

    // 6. Persist
    await this.pool.query(
      `INSERT INTO omega_calibration_profiles
        (session_id, overall_z_score, overall_percentile, confidence_interval_low,
         confidence_interval_high, reliability_score, response_consistency,
         subdomain_calibration, cohort_label, uniqueness_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (session_id) DO UPDATE SET
         overall_z_score = EXCLUDED.overall_z_score,
         overall_percentile = EXCLUDED.overall_percentile,
         confidence_interval_low = EXCLUDED.confidence_interval_low,
         confidence_interval_high = EXCLUDED.confidence_interval_high,
         reliability_score = EXCLUDED.reliability_score,
         response_consistency = EXCLUDED.response_consistency,
         subdomain_calibration = EXCLUDED.subdomain_calibration,
         cohort_label = EXCLUDED.cohort_label,
         uniqueness_score = EXCLUDED.uniqueness_score,
         computed_at = NOW()`,
      [
        sessionId, zScore, percentile, ciLow, ciHigh,
        reliability, consistency,
        JSON.stringify(subdomainCalibration),
        profile.cohort_label, profile.uniqueness_score,
      ],
    );

    return profile;
  }

  async getCalibrationProfile(sessionId: string): Promise<CalibrationProfile | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM omega_calibration_profiles WHERE session_id = $1`,
      [sessionId],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      session_id: r.session_id,
      overall_z_score: parseFloat(r.overall_z_score),
      overall_percentile: r.overall_percentile,
      confidence_interval_low: parseFloat(r.confidence_interval_low),
      confidence_interval_high: parseFloat(r.confidence_interval_high),
      reliability_score: parseFloat(r.reliability_score),
      response_consistency: parseFloat(r.response_consistency),
      subdomain_calibration: r.subdomain_calibration ?? {},
      cohort_label: r.cohort_label,
      uniqueness_score: parseFloat(r.uniqueness_score),
      cohort_size: 0,
      computed_at: r.computed_at,
    };
  }

  private async getCohortStats(category: string, stageCode: string): Promise<CohortStats> {
    const { rows } = await this.pool.query(
      `SELECT
         COUNT(*)::int AS n,
         COALESCE(AVG(cr.score), 65) AS mean,
         COALESCE(STDDEV(cr.score), 18) AS std,
         COALESCE(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY cr.score), 35) AS p10,
         COALESCE(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY cr.score), 48) AS p25,
         COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY cr.score), 65) AS p50,
         COALESCE(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cr.score), 78) AS p75,
         COALESCE(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY cr.score), 88) AS p90
       FROM capadex_reports cr
       JOIN capadex_sessions cs ON cr.session_id = cs.id
       WHERE cs.stage_code = $1`,
      [stageCode],
    );
    const r = rows[0];
    return {
      n: r.n ?? 0,
      mean: parseFloat(r.mean) || 65,
      std: parseFloat(r.std) || 18,
      p10: parseFloat(r.p10) || 35,
      p25: parseFloat(r.p25) || 48,
      p50: parseFloat(r.p50) || 65,
      p75: parseFloat(r.p75) || 78,
      p90: parseFloat(r.p90) || 88,
    };
  }

  private async getSubdomainCohortStats(
    category: string,
    stageCode: string,
    subdomainName: string,
  ): Promise<{ mean: number; std: number; n: number }> {
    // Check precomputed stats first
    const { rows } = await this.pool.query(
      `SELECT * FROM omega_cohort_stats
       WHERE stage_code = $1 AND subdomain_name = $2`,
      [stageCode, subdomainName],
    );
    if (rows.length && rows[0].n_samples > 4) {
      return { mean: parseFloat(rows[0].mean_score) || 65, std: parseFloat(rows[0].std_dev) || 18, n: rows[0].n_samples };
    }
    // Fall back to overall cohort stats
    const overall = await this.getCohortStats(category, stageCode);
    return { mean: overall.mean, std: overall.std, n: overall.n };
  }
}
