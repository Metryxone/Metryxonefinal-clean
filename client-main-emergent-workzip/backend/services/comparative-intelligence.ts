/**
 * Comparative Intelligence Service — P-R5 W3
 *
 * Provides cohort-based benchmarking for EI scores, competencies, and readiness:
 *   - peer_comparison       where does the user sit relative to similar users
 *   - percentile_rank       user's EI percentile within cohort
 *   - cohort_benchmarking   avg EI by seniority/domain
 *   - occupation_benchmark  avg EI for users targeting same occupation
 *   - competency_benchmark  avg competency scores by cohort
 *   - readiness_benchmark   % of cohort above readiness thresholds
 *
 * k-anonymity: all comparative outputs suppressed when cohort < K_MIN (30).
 * Additive + read-only. Never throws.
 */

import type { Pool } from 'pg';

export const COMPARATIVE_INTELLIGENCE_VERSION = '1.0.0';
const K_MIN = 30;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PeerComparison {
  user_ei_score: number | null;
  cohort_avg_score: number | null;
  cohort_median_score: number | null;
  difference_from_avg: number | null;
  relative_position: 'above_average' | 'average' | 'below_average' | 'suppressed' | 'no_data';
  cohort_size: number;
  suppressed: boolean;
  suppressed_reason?: string;
}

export interface PercentileRank {
  percentile: number | null;           // 0–100, null if suppressed
  rank_within_cohort: number | null;
  cohort_size: number;
  suppressed: boolean;
  suppressed_reason?: string;
  label: string;                        // e.g. "Top 25%" or "Below average"
}

export interface CohortBenchmark {
  dimension: string;                    // e.g. 'seniority:senior', 'domain:technology'
  cohort_size: number;
  avg_score: number | null;
  median_score: number | null;
  top_quartile_threshold: number | null;
  bottom_quartile_threshold: number | null;
  suppressed: boolean;
}

export interface OccupationBenchmark {
  occupation_title: string;
  cohort_size: number;
  avg_ei_score: number | null;
  avg_readiness_pct: number | null;
  top_performer_threshold: number | null;  // 75th percentile
  suppressed: boolean;
  suppressed_reason?: string;
}

export interface CompetencyBenchmark {
  competency_id: string;
  canonical_name: string;
  user_score: number | null;
  cohort_avg_score: number | null;
  cohort_size: number;
  user_percentile: number | null;
  above_avg: boolean | null;
  suppressed: boolean;
}

export interface ReadinessBenchmark {
  target_occupation: string | null;
  pct_cohort_ready: number | null;          // % with readiness_band = 'ready'
  pct_cohort_near_ready: number | null;
  user_readiness_band: string | null;
  cohort_size: number;
  suppressed: boolean;
}

export interface ComparativeProfile {
  user_id: string;
  generated_at: string;
  version: string;
  peer_comparison: PeerComparison;
  percentile_rank: PercentileRank;
  cohort_benchmarks: CohortBenchmark[];
  occupation_benchmark: OccupationBenchmark | null;
  competency_benchmarks: CompetencyBenchmark[];
  readiness_benchmark: ReadinessBenchmark | null;
  meta: {
    cohort_definition: string;
    k_min: number;
    suppression_applied: boolean;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function percentileLabel(pct: number | null): string {
  if (pct === null) return 'Suppressed';
  if (pct >= 90) return 'Top 10%';
  if (pct >= 75) return 'Top 25%';
  if (pct >= 50) return 'Above median';
  if (pct >= 25) return 'Below median';
  return 'Bottom 25%';
}

function relativePosition(userScore: number, avg: number): PeerComparison['relative_position'] {
  const diff = userScore - avg;
  if (diff > 5) return 'above_average';
  if (diff < -5) return 'below_average';
  return 'average';
}

// ── Cohort key derivation ─────────────────────────────────────────────────────

async function resolveCohortKey(pool: Pool, userId: string): Promise<{
  seniority: string | null; domain: string | null; band: string | null;
}> {
  // Try career_seeker_profiles first
  const csp = await pool.query(
    `SELECT data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  ).catch(() => ({ rows: [] as any[] }));

  if (csp.rows.length) {
    const d = csp.rows[0].data || {};
    return {
      seniority: d.seniority_level || d.current_seniority || null,
      domain: d.target_domain || d.domain || d.role_family || null,
      band: null,
    };
  }

  // Fall back to latest EI snapshot
  const snap = await pool.query(
    `SELECT band FROM ei_snapshot_versions WHERE user_id=$1 ORDER BY snapshot_date DESC LIMIT 1`,
    [userId]
  ).catch(() => ({ rows: [] as any[] }));

  return { seniority: null, domain: null, band: snap.rows[0]?.band || null };
}

// ── Peer comparison ───────────────────────────────────────────────────────────

async function resolvePeerComparison(pool: Pool, userId: string): Promise<PeerComparison> {
  const snap = await pool.query(
    `SELECT DISTINCT ON (user_id) user_id, capability_score AS score, band
       FROM ei_snapshot_versions ORDER BY user_id, snapshot_date DESC`,
  ).catch(() => ({ rows: [] as any[] }));

  const userRow = snap.rows.find((r: any) => r.user_id === userId);
  const userScore = userRow ? Number(userRow.score) : null;

  const others = snap.rows.filter((r: any) => r.user_id !== userId).map((r: any) => Number(r.score));

  if (userScore === null) {
    return { user_ei_score: null, cohort_avg_score: null, cohort_median_score: null,
      difference_from_avg: null, relative_position: 'no_data',
      cohort_size: others.length, suppressed: false };
  }

  if (others.length < K_MIN) {
    return { user_ei_score: userScore, cohort_avg_score: null, cohort_median_score: null,
      difference_from_avg: null, relative_position: 'suppressed',
      cohort_size: others.length, suppressed: true,
      suppressed_reason: `Cohort too small (${others.length} < ${K_MIN} required)` };
  }

  const avg = others.reduce((s, v) => s + v, 0) / others.length;
  const sorted = [...others].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  return {
    user_ei_score: Math.round(userScore * 100) / 100,
    cohort_avg_score: Math.round(avg * 100) / 100,
    cohort_median_score: Math.round(median * 100) / 100,
    difference_from_avg: Math.round((userScore - avg) * 100) / 100,
    relative_position: relativePosition(userScore, avg),
    cohort_size: others.length,
    suppressed: false,
  };
}

// ── Percentile rank ───────────────────────────────────────────────────────────

async function resolvePercentileRank(pool: Pool, userId: string): Promise<PercentileRank> {
  const snap = await pool.query(
    `SELECT DISTINCT ON (user_id) user_id, capability_score AS score
       FROM ei_snapshot_versions ORDER BY user_id, snapshot_date DESC`,
  ).catch(() => ({ rows: [] as any[] }));

  const userRow = snap.rows.find((r: any) => r.user_id === userId);
  if (!userRow) {
    return { percentile: null, rank_within_cohort: null, cohort_size: snap.rows.length,
      suppressed: false, label: 'No EI score recorded' };
  }

  const allScores = snap.rows.map((r: any) => Number(r.score)).sort((a, b) => a - b);
  if (allScores.length < K_MIN) {
    return { percentile: null, rank_within_cohort: null, cohort_size: allScores.length,
      suppressed: true, suppressed_reason: `Cohort too small (${allScores.length} < ${K_MIN})`,
      label: 'Suppressed' };
  }

  const userScore = Number(userRow.score);
  const belowCount = allScores.filter(s => s < userScore).length;
  const percentile = Math.round((belowCount / allScores.length) * 100);
  const rank = allScores.length - belowCount;

  return {
    percentile,
    rank_within_cohort: rank,
    cohort_size: allScores.length,
    suppressed: false,
    label: percentileLabel(percentile),
  };
}

// ── Cohort benchmarks ─────────────────────────────────────────────────────────

async function resolveCohortBenchmarks(
  pool: Pool, userId: string,
  cohortKey: { seniority: string | null; domain: string | null },
): Promise<CohortBenchmark[]> {
  const result: CohortBenchmark[] = [];

  // Seniority cohort
  if (cohortKey.seniority) {
    const rows = await pool.query(
      `SELECT DISTINCT ON (esv.user_id) esv.user_id, esv.capability_score AS score
         FROM ei_snapshot_versions esv
         JOIN career_seeker_profiles csp ON csp.user_id = esv.user_id
         WHERE (csp.data->>'seniority_level') = $1 AND esv.user_id != $2
         ORDER BY esv.user_id, esv.snapshot_date DESC`,
      [cohortKey.seniority, userId]
    ).catch(() => ({ rows: [] as any[] }));

    const scores = rows.rows.map((r: any) => Number(r.score)).sort((a, b) => a - b);
    const suppressed = scores.length < K_MIN;
    const avg = suppressed ? null : Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 100) / 100;
    const median = suppressed ? null : scores[Math.floor(scores.length / 2)];
    const q3 = suppressed ? null : scores[Math.floor(scores.length * 0.75)];
    const q1 = suppressed ? null : scores[Math.floor(scores.length * 0.25)];

    result.push({
      dimension: `seniority:${cohortKey.seniority}`,
      cohort_size: scores.length,
      avg_score: avg,
      median_score: median !== null ? Math.round(median * 100) / 100 : null,
      top_quartile_threshold: q3 !== null ? Math.round(q3 * 100) / 100 : null,
      bottom_quartile_threshold: q1 !== null ? Math.round(q1 * 100) / 100 : null,
      suppressed,
    });
  }

  // Domain cohort
  if (cohortKey.domain) {
    const rows = await pool.query(
      `SELECT DISTINCT ON (esv.user_id) esv.user_id, esv.capability_score AS score
         FROM ei_snapshot_versions esv
         JOIN career_seeker_profiles csp ON csp.user_id = esv.user_id
         WHERE (csp.data->>'target_domain' ILIKE $1 OR csp.data->>'domain' ILIKE $1)
           AND esv.user_id != $2
         ORDER BY esv.user_id, esv.snapshot_date DESC`,
      [`%${cohortKey.domain}%`, userId]
    ).catch(() => ({ rows: [] as any[] }));

    const scores = rows.rows.map((r: any) => Number(r.score)).sort((a, b) => a - b);
    const suppressed = scores.length < K_MIN;
    const avg = suppressed ? null : Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 100) / 100;
    const median = suppressed ? null : scores[Math.floor(scores.length / 2)];

    result.push({
      dimension: `domain:${cohortKey.domain}`,
      cohort_size: scores.length,
      avg_score: avg,
      median_score: median !== null ? Math.round(median * 100) / 100 : null,
      top_quartile_threshold: null,
      bottom_quartile_threshold: null,
      suppressed,
    });
  }

  // Band cohort (all users in same EI band)
  const bandSnap = await pool.query(
    `SELECT DISTINCT ON (user_id) user_id, capability_score AS score, band
       FROM ei_snapshot_versions WHERE user_id != $1
       ORDER BY user_id, snapshot_date DESC`,
    [userId]
  ).catch(() => ({ rows: [] as any[] }));

  const userBand = await pool.query(
    `SELECT band FROM ei_snapshot_versions WHERE user_id=$1 ORDER BY snapshot_date DESC LIMIT 1`,
    [userId]
  ).catch(() => ({ rows: [] as any[] }));

  if (userBand.rows[0]?.band) {
    const bandPeers = bandSnap.rows
      .filter((r: any) => r.band === userBand.rows[0].band)
      .map((r: any) => Number(r.score))
      .sort((a, b) => a - b);

    const suppressed = bandPeers.length < K_MIN;
    const avg = suppressed ? null : Math.round(bandPeers.reduce((s, v) => s + v, 0) / bandPeers.length * 100) / 100;

    result.push({
      dimension: `band:${userBand.rows[0].band}`,
      cohort_size: bandPeers.length,
      avg_score: avg,
      median_score: suppressed ? null : Math.round(bandPeers[Math.floor(bandPeers.length / 2)] * 100) / 100,
      top_quartile_threshold: null,
      bottom_quartile_threshold: null,
      suppressed,
    });
  }

  return result;
}

// ── Occupation benchmark ──────────────────────────────────────────────────────

async function resolveOccupationBenchmark(pool: Pool, userId: string): Promise<OccupationBenchmark | null> {
  // Find the user's target occupation from career_seeker_profiles
  const csp = await pool.query(
    `SELECT data FROM career_seeker_profiles WHERE user_id=$1 LIMIT 1`,
    [userId]
  ).catch(() => ({ rows: [] as any[] }));

  if (!csp.rows.length) return null;
  const targetOcc = csp.rows[0].data?.target_occupation || csp.rows[0].data?.target_role || null;
  if (!targetOcc) return null;

  // Find other users with same target occupation and their EI scores
  const peers = await pool.query(
    `SELECT DISTINCT ON (esv.user_id) esv.user_id, esv.capability_score AS score
       FROM ei_snapshot_versions esv
       JOIN career_seeker_profiles csp2 ON csp2.user_id = esv.user_id
       WHERE (csp2.data->>'target_occupation' ILIKE $1 OR csp2.data->>'target_role' ILIKE $1)
         AND esv.user_id != $2
       ORDER BY esv.user_id, esv.snapshot_date DESC`,
    [`%${targetOcc}%`, userId]
  ).catch(() => ({ rows: [] as any[] }));

  const scores = peers.rows.map((r: any) => Number(r.score)).sort((a, b) => a - b);
  const suppressed = scores.length < K_MIN;

  return {
    occupation_title: targetOcc,
    cohort_size: scores.length,
    avg_ei_score: suppressed ? null : Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 100) / 100,
    avg_readiness_pct: null,  // Requires competency data per user — deferred
    top_performer_threshold: suppressed ? null : Math.round(scores[Math.floor(scores.length * 0.75)] * 100) / 100,
    suppressed,
    suppressed_reason: suppressed ? `Cohort too small (${scores.length} < ${K_MIN})` : undefined,
  };
}

// ── Competency benchmarks ─────────────────────────────────────────────────────

async function resolveCompetencyBenchmarks(pool: Pool, userId: string): Promise<CompetencyBenchmark[]> {
  // User's own scores
  const myScores = await pool.query(
    `SELECT ucs.competency_id, cl.canonical_name, ucs.score
       FROM user_competency_scores ucs
       JOIN competency_library cl ON cl.id = ucs.competency_id
       WHERE ucs.user_id = $1`,
    [userId]
  ).catch(() => ({ rows: [] as any[] }));

  if (!myScores.rows.length) return [];

  const benchmarks: CompetencyBenchmark[] = [];

  for (const row of myScores.rows.slice(0, 10)) {  // Cap at 10 competencies to avoid N+1 explosion
    const peers = await pool.query(
      `SELECT score FROM user_competency_scores WHERE competency_id = $1 AND user_id != $2`,
      [row.competency_id, userId]
    ).catch(() => ({ rows: [] as any[] }));

    const peerScores = peers.rows.map((r: any) => Number(r.score)).sort((a, b) => a - b);
    const suppressed = peerScores.length < K_MIN;
    const userScore = Number(row.score);

    const cohortAvg = suppressed ? null
      : Math.round(peerScores.reduce((s, v) => s + v, 0) / peerScores.length * 100) / 100;

    const belowCount = suppressed ? null : peerScores.filter(s => s < userScore).length;
    const userPct = belowCount !== null
      ? Math.round((belowCount / peerScores.length) * 100)
      : null;

    benchmarks.push({
      competency_id: row.competency_id,
      canonical_name: row.canonical_name,
      user_score: userScore,
      cohort_avg_score: cohortAvg,
      cohort_size: peerScores.length,
      user_percentile: userPct,
      above_avg: cohortAvg !== null ? userScore > cohortAvg : null,
      suppressed,
    });
  }

  return benchmarks;
}

// ── Readiness benchmark ───────────────────────────────────────────────────────

async function resolveReadinessBenchmark(pool: Pool, userId: string): Promise<ReadinessBenchmark | null> {
  // Get user's target occupation
  const csp = await pool.query(
    `SELECT data FROM career_seeker_profiles WHERE user_id=$1 LIMIT 1`,
    [userId]
  ).catch(() => ({ rows: [] as any[] }));

  const targetOcc = csp.rows[0]?.data?.target_occupation || csp.rows[0]?.data?.target_role || null;

  // We proxy readiness via EI band distribution — 'ready' ≈ ei band 'excellent'/'strong'
  const bandData = await pool.query(
    `SELECT DISTINCT ON (user_id) user_id, band
       FROM ei_snapshot_versions WHERE user_id != $1
       ORDER BY user_id, snapshot_date DESC`,
    [userId]
  ).catch(() => ({ rows: [] as any[] }));

  const userBand = await pool.query(
    `SELECT band FROM ei_snapshot_versions WHERE user_id=$1 ORDER BY snapshot_date DESC LIMIT 1`,
    [userId]
  ).catch(() => ({ rows: [] as any[] }));

  const total = bandData.rows.length;
  if (total < K_MIN) {
    return { target_occupation: targetOcc, pct_cohort_ready: null, pct_cohort_near_ready: null,
      user_readiness_band: userBand.rows[0]?.band || null, cohort_size: total, suppressed: true };
  }

  const READY_BANDS = ['excellent', 'outstanding', 'strong'];
  const NEAR_READY_BANDS = ['good', 'developing'];

  const readyCount = bandData.rows.filter((r: any) => READY_BANDS.includes(r.band)).length;
  const nearReadyCount = bandData.rows.filter((r: any) => NEAR_READY_BANDS.includes(r.band)).length;

  return {
    target_occupation: targetOcc,
    pct_cohort_ready: Math.round((readyCount / total) * 100),
    pct_cohort_near_ready: Math.round((nearReadyCount / total) * 100),
    user_readiness_band: userBand.rows[0]?.band || null,
    cohort_size: total,
    suppressed: false,
  };
}

// ── Master resolver ───────────────────────────────────────────────────────────

export async function resolveComparativeIntelligence(
  pool: Pool, userId: string
): Promise<ComparativeProfile> {
  try {
    const cohortKey = await resolveCohortKey(pool, userId);
    const [
      peerComparison, percentileRank, cohortBenchmarks,
      occupationBenchmark, competencyBenchmarks, readinessBenchmark,
    ] = await Promise.all([
      resolvePeerComparison(pool, userId),
      resolvePercentileRank(pool, userId),
      resolveCohortBenchmarks(pool, userId, cohortKey),
      resolveOccupationBenchmark(pool, userId),
      resolveCompetencyBenchmarks(pool, userId),
      resolveReadinessBenchmark(pool, userId),
    ]);

    const suppressionApplied = peerComparison.suppressed || percentileRank.suppressed ||
      cohortBenchmarks.some(b => b.suppressed);

    return {
      user_id: userId,
      generated_at: new Date().toISOString(),
      version: COMPARATIVE_INTELLIGENCE_VERSION,
      peer_comparison: peerComparison,
      percentile_rank: percentileRank,
      cohort_benchmarks: cohortBenchmarks,
      occupation_benchmark: occupationBenchmark,
      competency_benchmarks: competencyBenchmarks,
      readiness_benchmark: readinessBenchmark,
      meta: {
        cohort_definition: [
          cohortKey.seniority ? `seniority:${cohortKey.seniority}` : null,
          cohortKey.domain    ? `domain:${cohortKey.domain}`       : null,
          'global_all_users',
        ].filter(Boolean).join(' | '),
        k_min: K_MIN,
        suppression_applied: suppressionApplied,
      },
    };
  } catch (e: any) {
    return {
      user_id: userId,
      generated_at: new Date().toISOString(),
      version: COMPARATIVE_INTELLIGENCE_VERSION,
      peer_comparison: { user_ei_score: null, cohort_avg_score: null, cohort_median_score: null,
        difference_from_avg: null, relative_position: 'no_data', cohort_size: 0, suppressed: false },
      percentile_rank: { percentile: null, rank_within_cohort: null, cohort_size: 0,
        suppressed: false, label: 'Error resolving' },
      cohort_benchmarks: [],
      occupation_benchmark: null,
      competency_benchmarks: [],
      readiness_benchmark: null,
      meta: { cohort_definition: 'error', k_min: K_MIN, suppression_applied: false },
    };
  }
}
