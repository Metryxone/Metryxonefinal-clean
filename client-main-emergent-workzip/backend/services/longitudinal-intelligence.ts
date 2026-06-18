/**
 * Longitudinal Intelligence Service — P-R4 W3
 *
 * Produces growth intelligence from repeated EI assessments:
 *   - EI score progression       delta across ei_snapshot_versions
 *   - Competency progression     from p4_competency_history
 *   - Readiness progression      how readiness band changes over time
 *   - Growth momentum            weighted recent rate-of-change
 *   - Trajectory progression     forecast alignment vs actuals
 *   - Trend narratives           human-readable growth story
 *   - Comparative intelligence   vs cohort (honest: < k_min=30 → degraded)
 *
 * Additive + read-only. Never throws.
 *
 * NULL = missing data. Never coerce null → 0 (would fabricate a datapoint).
 */

import type { Pool } from 'pg';

export const LONGITUDINAL_INTELLIGENCE_VERSION = '2.0.0';

const K_MIN_COHORT = 30; // k-anonymity floor for cohort comparisons

// ── Types ────────────────────────────────────────────────────────────────────

export interface EIScoreSnapshot {
  snapshot_id: string;
  taken_at: string;
  score: number;
  band: string;
  dimension_breakdown: Record<string, number>;
  ruleset_version: string;
}

export interface EIProgression {
  snapshots: EIScoreSnapshot[];
  deltas: Array<{ from_date: string; to_date: string; delta: number; pct_change: number }>;
  earliest_score: number | null;
  latest_score: number | null;
  net_delta: number | null;
  trajectory: 'strong_growth' | 'growth' | 'stable' | 'decline' | 'insufficient_data';
}

export interface CompetencyProgression {
  competency_id: string;
  canonical_name: string;
  history: Array<{ snapshot_at: string; score: number }>;
  net_delta: number | null;
  trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
}

export interface ReadinessProgression {
  occupation_title: string;
  history: Array<{ snapshot_at: string; readiness_pct: number; readiness_band: string }>;
  net_delta: number | null;
}

export interface GrowthMomentum {
  score: number;           // 0–100, weighted recent rate-of-change
  grade: 'high' | 'moderate' | 'low' | 'stalled' | 'no_data';
  primary_driver: string;
  contributing_factors: string[];
  weeks_of_data: number;
}

export interface TrajectoryAlignment {
  forecast_horizon: '6m' | '12m';
  projected_score: number;
  actual_score: number | null;
  alignment: 'ahead' | 'on_track' | 'behind' | 'no_actual';
  delta_vs_projection: number | null;
}

export interface TrendNarrative {
  headline: string;
  body: string;
  highlights: string[];
  data_coverage: 'full' | 'partial' | 'minimal';
  confidence: number;
}

export interface ComparativeIntelligence {
  cohort_size: number;
  cohort_avg_score: number | null;
  user_percentile: number | null;
  delta_vs_cohort: number | null;
  suppressed: boolean;
  suppression_reason: string | null;
}

// ── P-R5 W2: New intelligence types ──────────────────────────────────────────

export interface ReadinessTrend {
  snapshots: Array<{ taken_at: string; readiness_pct: number; band: string }>;
  trend_direction: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  velocity_per_week: number | null;
  forecast_30d: number | null;
  forecast_60d: number | null;
  forecast_90d: number | null;
}

export interface CompetencyVelocity {
  competency_id: string;
  canonical_name: string;
  points_per_week: number | null;
  weeks_of_data: number;
  direction: 'accelerating' | 'steady' | 'decelerating' | 'insufficient_data';
}

export interface TrendPatternIndicator {
  pattern: 'plateau' | 'decline' | 'acceleration' | 'recovery' | 'consistent_growth';
  duration_weeks: number;
  affected_dimension: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface LongitudinalProfile {
  user_id: string;
  generated_at: string;
  version: string;
  ei_progression: EIProgression;
  competency_progression: CompetencyProgression[];
  growth_momentum: GrowthMomentum;
  trajectory_alignment: TrajectoryAlignment[];
  trend_narrative: TrendNarrative;
  comparative_intelligence: ComparativeIntelligence;
  /** P-R5 W2: Readiness trend derived from EI band history. */
  readiness_trend: ReadinessTrend | null;
  /** P-R5 W2: Per-competency rate-of-change (points/week). */
  competency_velocities: CompetencyVelocity[];
  /** P-R5 W2: Named trend patterns detected in the progression data. */
  trend_pattern_indicators: TrendPatternIndicator[];
  data_quality: {
    ei_snapshots: number;
    competency_snapshots: number;
    weeks_covered: number;
    confidence: 'high' | 'medium' | 'low';
  };
}

// ── EI Progression ───────────────────────────────────────────────────────────

async function resolveEIProgression(pool: Pool, userId: string): Promise<EIProgression> {
  try {
    const r = await pool.query<{
      id: string; created_at: string; ei_score: number; band: string;
      dimension_scores: Record<string, number> | null; ruleset_version: string;
    }>(
      `SELECT id::text, created_at::text, ei_score::float, band,
              dimension_scores, COALESCE(ruleset_version,'1.0.0') AS ruleset_version
         FROM ei_snapshot_versions
        WHERE user_id = $1
        ORDER BY created_at ASC`,
      [userId],
    );
    const snapshots: EIScoreSnapshot[] = r.rows.map(row => ({
      snapshot_id: row.id,
      taken_at: row.created_at,
      score: Math.round(row.ei_score),
      band: row.band,
      dimension_breakdown: row.dimension_scores || {},
      ruleset_version: row.ruleset_version,
    }));

    if (snapshots.length === 0) {
      return { snapshots: [], deltas: [], earliest_score: null, latest_score: null,
               net_delta: null, trajectory: 'insufficient_data' };
    }

    const deltas = snapshots.slice(1).map((snap, i) => ({
      from_date: snapshots[i].taken_at,
      to_date: snap.taken_at,
      delta: Math.round(snap.score - snapshots[i].score),
      pct_change: +(((snap.score - snapshots[i].score) / Math.max(snapshots[i].score, 1)) * 100).toFixed(1),
    }));

    const earliest = snapshots[0].score;
    const latest = snapshots[snapshots.length - 1].score;
    const net = latest - earliest;

    const trajectory: EIProgression['trajectory'] =
      snapshots.length < 2 ? 'insufficient_data'
      : net > 10 ? 'strong_growth'
      : net > 2  ? 'growth'
      : net < -5 ? 'decline'
      : 'stable';

    return { snapshots, deltas, earliest_score: earliest, latest_score: latest,
             net_delta: Math.round(net), trajectory };
  } catch { return { snapshots: [], deltas: [], earliest_score: null, latest_score: null,
                     net_delta: null, trajectory: 'insufficient_data' }; }
}

// ── Competency Progression ───────────────────────────────────────────────────

async function resolveCompetencyProgression(pool: Pool, userId: string): Promise<CompetencyProgression[]> {
  try {
    const r = await pool.query<{
      competency_id: string; competency_name: string; created_at: string; score: number;
    }>(
      `SELECT competency_id::text, competency_name, created_at::text, score::float
         FROM p4_competency_history
        WHERE user_id = $1
        ORDER BY competency_id, created_at ASC
        LIMIT 500`,
      [userId],
    );

    const byComp = new Map<string, { name: string; history: Array<{ snapshot_at: string; score: number }> }>();
    for (const row of r.rows) {
      if (!byComp.has(row.competency_id)) byComp.set(row.competency_id, { name: row.competency_name, history: [] });
      byComp.get(row.competency_id)!.history.push({ snapshot_at: row.created_at, score: Math.round(row.score) });
    }

    return Array.from(byComp.entries()).map(([id, { name, history }]) => {
      const net = history.length >= 2 ? history[history.length - 1].score - history[0].score : null;
      return {
        competency_id: id,
        canonical_name: name,
        history,
        net_delta: net !== null ? Math.round(net) : null,
        trend: history.length < 2 ? 'insufficient_data'
              : net! > 3 ? 'improving' : net! < -3 ? 'declining' : 'stable',
      };
    });
  } catch { return []; }
}

// ── Growth Momentum ──────────────────────────────────────────────────────────

function computeGrowthMomentum(eiProgression: EIProgression, competencyProgression: CompetencyProgression[]): GrowthMomentum {
  if (eiProgression.snapshots.length < 2) {
    return { score: 0, grade: 'no_data', primary_driver: 'Insufficient assessment history',
             contributing_factors: [], weeks_of_data: 0 };
  }

  const snaps = eiProgression.snapshots;
  const firstDate = new Date(snaps[0].taken_at);
  const lastDate = new Date(snaps[snaps.length - 1].taken_at);
  const weeksCovered = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));

  // Weight recent deltas more heavily
  const recentDeltas = eiProgression.deltas.slice(-3);
  const weightedDelta = recentDeltas.length > 0
    ? recentDeltas.reduce((sum, d, i) => sum + d.delta * (i + 1), 0) / recentDeltas.reduce((sum, _d, i) => sum + (i + 1), 0)
    : 0;

  // Normalize to 0-100 momentum score
  const rawMomentum = Math.min(100, Math.max(0, 50 + weightedDelta * 2));
  const grade: GrowthMomentum['grade'] =
    rawMomentum >= 70 ? 'high'
    : rawMomentum >= 50 ? 'moderate'
    : rawMomentum >= 35 ? 'low'
    : rawMomentum >= 20 ? 'stalled'
    : 'no_data';

  const improvingCompetencies = competencyProgression.filter(c => c.trend === 'improving').length;
  const factors: string[] = [];
  if (eiProgression.net_delta && eiProgression.net_delta > 0) factors.push(`EI score +${eiProgression.net_delta} points overall`);
  if (improvingCompetencies > 0) factors.push(`${improvingCompetencies} competencies trending upward`);
  if (weeksCovered > 4) factors.push(`${weeksCovered} weeks of sustained practice`);

  const primaryDriver =
    (eiProgression.net_delta ?? 0) > 5 ? `EI score growing (+${eiProgression.net_delta} net)`
    : improvingCompetencies > 2 ? `${improvingCompetencies} competencies improving`
    : weeksCovered > 8 ? 'Sustained engagement over time'
    : 'Early stage — continue building assessment history';

  return { score: Math.round(rawMomentum), grade, primary_driver: primaryDriver,
           contributing_factors: factors, weeks_of_data: weeksCovered };
}

// ── Trajectory Alignment ─────────────────────────────────────────────────────

async function resolveTrajectoryAlignment(pool: Pool, userId: string, latestScore: number | null): Promise<TrajectoryAlignment[]> {
  if (latestScore === null) return [];
  try {
    const r = await pool.query<{
      forecast_horizon: string; projected_score: number; target_date: string;
    }>(
      `SELECT forecast_horizon, projected_score::float, target_date::text
         FROM competency_forecasts
        WHERE user_id = $1
        ORDER BY generated_at DESC
        LIMIT 2`,
      [userId],
    );
    return r.rows.map(row => {
      const horizon = (row.forecast_horizon === '6m' ? '6m' : '12m') as '6m' | '12m';
      const targetDate = new Date(row.target_date);
      const now = new Date();
      const past = targetDate <= now;
      const actual = past ? latestScore : null;
      const delta = actual !== null ? actual - row.projected_score : null;
      return {
        forecast_horizon: horizon,
        projected_score: Math.round(row.projected_score),
        actual_score: actual,
        alignment: actual === null ? 'no_actual'
                 : delta! > 2 ? 'ahead' : delta! < -5 ? 'behind' : 'on_track',
        delta_vs_projection: delta !== null ? Math.round(delta) : null,
      };
    });
  } catch { return []; }
}

// ── Trend Narrative ──────────────────────────────────────────────────────────

function buildTrendNarrative(
  eiProgression: EIProgression,
  momentum: GrowthMomentum,
  compProgression: CompetencyProgression[],
): TrendNarrative {
  const snapCount = eiProgression.snapshots.length;
  const coverage: TrendNarrative['data_coverage'] =
    snapCount >= 3 ? 'full' : snapCount >= 2 ? 'partial' : 'minimal';
  const conf = snapCount >= 3 ? 0.80 : snapCount >= 2 ? 0.60 : 0.35;

  if (snapCount === 0) {
    return {
      headline: 'No assessment history yet',
      body: 'Complete your first assessment to begin building your longitudinal growth profile.',
      highlights: [],
      data_coverage: 'minimal',
      confidence: 0.20,
    };
  }

  const trajectory = eiProgression.trajectory;
  const net = eiProgression.net_delta ?? 0;
  const improving = compProgression.filter(c => c.trend === 'improving');
  const declining = compProgression.filter(c => c.trend === 'declining');

  const headlineMap: Record<string, string> = {
    strong_growth: `Strong growth trajectory — +${net} EI points across ${snapCount} assessments`,
    growth: `Positive development — +${net} EI points over ${snapCount} assessments`,
    stable: `Stable profile — consistent performance across ${snapCount} assessments`,
    decline: `Recalibration needed — ${net} EI point shift, ${declining.length} competencies declining`,
    insufficient_data: `Early stage — ${snapCount} assessment${snapCount === 1 ? '' : 's'} recorded`,
  };

  const body =
    trajectory === 'strong_growth' || trajectory === 'growth'
      ? `Your Employability Index shows consistent upward movement. ${improving.length > 0 ? `${improving.length} competency areas are showing measurable improvement.` : ''} Sustained practice is translating into measurable capability growth.`
    : trajectory === 'stable'
      ? `Your profile is holding steady. To accelerate growth, focus on the highest-weighted capability gaps in your target role.`
    : trajectory === 'decline'
      ? `Recent snapshots show a downward shift. This can reflect a more accurate assessment calibration as data quality improves. Focus on the 2–3 critical capability gaps.`
    : `You have ${snapCount} assessment${snapCount === 1 ? '' : 's'} on record. Continue completing assessments to build a more complete growth picture.`;

  const highlights: string[] = [];
  if (momentum.score >= 60) highlights.push(`Growth momentum: ${momentum.grade} (${momentum.score}/100)`);
  if (improving.length > 0) highlights.push(`${improving.length} competency${improving.length > 1 ? 'areas' : ' area'} improving`);
  if (eiProgression.latest_score !== null) highlights.push(`Current EI: ${eiProgression.latest_score} (${eiProgression.snapshots[eiProgression.snapshots.length - 1].band})`);

  return {
    headline: headlineMap[trajectory] || headlineMap['insufficient_data'],
    body,
    highlights,
    data_coverage: coverage,
    confidence: conf,
  };
}

// ── Comparative Intelligence ─────────────────────────────────────────────────

async function resolveComparativeIntelligence(
  pool: Pool, userId: string, latestScore: number | null,
): Promise<ComparativeIntelligence> {
  if (latestScore === null) {
    return { cohort_size: 0, cohort_avg_score: null, user_percentile: null,
             delta_vs_cohort: null, suppressed: true, suppression_reason: 'No EI snapshot for this user' };
  }
  try {
    const r = await pool.query<{ cohort_size: number; cohort_avg: number; below_count: number }>(
      `SELECT COUNT(*)::int AS cohort_size,
              AVG(ei_score)::float AS cohort_avg,
              COUNT(*) FILTER (WHERE ei_score < $1)::int AS below_count
         FROM (
           SELECT DISTINCT ON (user_id) user_id, ei_score
             FROM ei_snapshot_versions
            ORDER BY user_id, created_at DESC
         ) latest`,
      [latestScore],
    );
    const { cohort_size, cohort_avg, below_count } = r.rows[0];
    if (cohort_size < K_MIN_COHORT) {
      return { cohort_size, cohort_avg_score: null, user_percentile: null,
               delta_vs_cohort: null, suppressed: true,
               suppression_reason: `Cohort size ${cohort_size} < k_min=${K_MIN_COHORT} (k-anonymity)` };
    }
    const percentile = Math.round((below_count / cohort_size) * 100);
    return {
      cohort_size,
      cohort_avg_score: cohort_avg !== null ? Math.round(cohort_avg) : null,
      user_percentile: percentile,
      delta_vs_cohort: cohort_avg !== null ? Math.round(latestScore - cohort_avg) : null,
      suppressed: false,
      suppression_reason: null,
    };
  } catch {
    return { cohort_size: 0, cohort_avg_score: null, user_percentile: null,
             delta_vs_cohort: null, suppressed: true, suppression_reason: 'Query error' };
  }
}

// ── P-R5 W2: Readiness trend, velocity, and pattern resolvers ─────────────────

function resolveReadinessTrend(eiProgression: EIProgression): ReadinessTrend | null {
  const snaps = eiProgression.snapshots;
  if (snaps.length === 0) return null;

  const snapshots = snaps.map(s => ({
    taken_at: s.taken_at,
    readiness_pct: Math.round(s.score),
    band: s.band,
  }));

  if (snaps.length < 2) {
    return { snapshots, trend_direction: 'insufficient_data',
             velocity_per_week: null, forecast_30d: null, forecast_60d: null, forecast_90d: null };
  }

  const first = snaps[0];
  const last = snaps[snaps.length - 1];
  const weeksCovered = Math.max(0.1,
    (new Date(last.taken_at).getTime() - new Date(first.taken_at).getTime()) / (7 * 24 * 60 * 60 * 1000));
  const delta = last.score - first.score;
  const velPW = Math.round((delta / weeksCovered) * 100) / 100;
  const direction: ReadinessTrend['trend_direction'] = Math.abs(delta) < 2 ? 'stable'
    : delta > 0 ? 'improving' : 'declining';
  const latestPct = Math.round(last.score);
  return {
    snapshots,
    trend_direction: direction,
    velocity_per_week: velPW,
    forecast_30d: velPW !== 0 ? Math.min(100, Math.round(latestPct + velPW * 4.3)) : null,
    forecast_60d: velPW !== 0 ? Math.min(100, Math.round(latestPct + velPW * 8.6)) : null,
    forecast_90d: velPW !== 0 ? Math.min(100, Math.round(latestPct + velPW * 12.9)) : null,
  };
}

function computeCompetencyVelocities(competencyProgression: CompetencyProgression[]): CompetencyVelocity[] {
  const result: CompetencyVelocity[] = [];
  for (const cp of competencyProgression) {
    const sorted = [...cp.history].sort((a, b) => a.snapshot_at.localeCompare(b.snapshot_at));
    if (sorted.length < 2) continue;
    const weeksOfData = Math.max(0.1,
      (new Date(sorted[sorted.length - 1].snapshot_at).getTime() - new Date(sorted[0].snapshot_at).getTime())
      / (7 * 24 * 60 * 60 * 1000));
    const delta = sorted[sorted.length - 1].score - sorted[0].score;
    const pointsPerWeek = Math.round((delta / weeksOfData) * 100) / 100;
    let direction: CompetencyVelocity['direction'] = 'steady';
    if (sorted.length >= 3) {
      const midIdx = Math.floor(sorted.length / 2);
      const midTime = Math.max(0.1,
        (new Date(sorted[midIdx].snapshot_at).getTime() - new Date(sorted[0].snapshot_at).getTime())
        / (7 * 24 * 60 * 60 * 1000));
      const firstHalf = (sorted[midIdx].score - sorted[0].score) / midTime;
      const secondHalf = (sorted[sorted.length - 1].score - sorted[midIdx].score) / Math.max(0.1, weeksOfData - midTime);
      direction = secondHalf > firstHalf + 0.1 ? 'accelerating'
                : secondHalf < firstHalf - 0.1 ? 'decelerating'
                : 'steady';
    }
    result.push({ competency_id: cp.competency_id, canonical_name: cp.canonical_name,
                  points_per_week: pointsPerWeek, weeks_of_data: Math.round(weeksOfData), direction });
  }
  return result.sort((a, b) => Math.abs(b.points_per_week ?? 0) - Math.abs(a.points_per_week ?? 0));
}

function detectTrendPatterns(
  rt: ReadinessTrend | null,
  velocities: CompetencyVelocity[],
  momentum: GrowthMomentum,
): TrendPatternIndicator[] {
  const indicators: TrendPatternIndicator[] = [];
  if (!rt || rt.snapshots.length < 2) return indicators;

  const snaps = rt.snapshots;
  const overallDelta = snaps[snaps.length - 1].readiness_pct - snaps[0].readiness_pct;
  const weeksTotal = snaps.length >= 2
    ? Math.round((new Date(snaps[snaps.length - 1].taken_at).getTime() - new Date(snaps[0].taken_at).getTime()) / (7 * 24 * 60 * 60 * 1000))
    : 0;

  if (snaps.length >= 3 && Math.abs(overallDelta) <= 3) {
    indicators.push({ pattern: 'plateau', duration_weeks: weeksTotal, affected_dimension: 'overall_readiness',
      severity: weeksTotal >= 8 ? 'high' : 'medium',
      recommendation: 'Sustained plateau detected. Introduce new challenge activities or a targeted skill development programme.' });
  }
  if (overallDelta < -5) {
    indicators.push({ pattern: 'decline', duration_weeks: weeksTotal, affected_dimension: 'overall_readiness',
      severity: overallDelta < -15 ? 'high' : 'medium',
      recommendation: 'Readiness trend is declining. Review recent assessment results and reprioritise development activities.' });
  }
  if (snaps.length >= 3) {
    const avgDelta = overallDelta / (snaps.length - 1);
    const recentDelta = snaps[snaps.length - 1].readiness_pct - snaps[snaps.length - 2].readiness_pct;
    if (recentDelta > avgDelta * 1.5 && recentDelta > 2) {
      indicators.push({ pattern: 'acceleration', duration_weeks: 4, affected_dimension: 'overall_readiness',
        severity: 'low', recommendation: 'Growth is accelerating. Maintain current development momentum.' });
    }
    const midIdx = Math.floor(snaps.length / 2);
    const firstHalfDelta = snaps[midIdx].readiness_pct - snaps[0].readiness_pct;
    const secondHalfDelta = snaps[snaps.length - 1].readiness_pct - snaps[midIdx].readiness_pct;
    if (firstHalfDelta < -3 && secondHalfDelta > 3) {
      indicators.push({ pattern: 'recovery', duration_weeks: Math.round(weeksTotal / 2), affected_dimension: 'overall_readiness',
        severity: 'low', recommendation: 'Recovery pattern detected after a decline period. Continue the positive trajectory.' });
    }
  }
  if (snaps.length >= 3 && overallDelta > 8) {
    const allPositive = snaps.slice(1).every((s, i) => s.readiness_pct >= snaps[i].readiness_pct - 1);
    if (allPositive) {
      indicators.push({ pattern: 'consistent_growth', duration_weeks: weeksTotal, affected_dimension: 'overall_readiness',
        severity: 'low', recommendation: 'Consistent growth pattern. Excellent progress — maintain your current development strategy.' });
    }
  }
  for (const v of velocities.filter(v2 => v2.direction === 'decelerating').slice(0, 2)) {
    indicators.push({ pattern: 'decline', duration_weeks: v.weeks_of_data, affected_dimension: v.canonical_name,
      severity: 'medium', recommendation: `Growth in ${v.canonical_name} is decelerating. Consider focused practice or mentoring in this area.` });
  }
  return indicators;
}

// ── Master resolver ──────────────────────────────────────────────────────────

export async function resolveLongitudinalIntelligence(
  pool: Pool, userId: string,
): Promise<LongitudinalProfile> {
  const eiProgression = await resolveEIProgression(pool, userId);
  const competencyProgression = await resolveCompetencyProgression(pool, userId);
  const momentum = computeGrowthMomentum(eiProgression, competencyProgression);

  const latestScore = eiProgression.latest_score;
  const [trajectoryAlignment, comparative] = await Promise.all([
    resolveTrajectoryAlignment(pool, userId, latestScore),
    resolveComparativeIntelligence(pool, userId, latestScore),
  ]);

  const narrative = buildTrendNarrative(eiProgression, momentum, competencyProgression);

  const firstSnap = eiProgression.snapshots[0];
  const lastSnap = eiProgression.snapshots[eiProgression.snapshots.length - 1];
  const weeksCovered = firstSnap && lastSnap
    ? Math.round((new Date(lastSnap.taken_at).getTime() - new Date(firstSnap.taken_at).getTime()) / (7 * 24 * 60 * 60 * 1000))
    : 0;

  const dataQuality = {
    ei_snapshots: eiProgression.snapshots.length,
    competency_snapshots: competencyProgression.reduce((s, c) => s + c.history.length, 0),
    weeks_covered: weeksCovered,
    confidence: (eiProgression.snapshots.length >= 3 ? 'high' : eiProgression.snapshots.length >= 2 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
  };

  // P-R5 W2: Resolve new intelligence fields
  const readiness_trend = resolveReadinessTrend(eiProgression);
  const competency_velocities = computeCompetencyVelocities(competencyProgression);
  const trend_pattern_indicators = detectTrendPatterns(readiness_trend, competency_velocities, momentum);

  return {
    user_id: userId,
    generated_at: new Date().toISOString(),
    version: LONGITUDINAL_INTELLIGENCE_VERSION,
    ei_progression: eiProgression,
    competency_progression: competencyProgression,
    growth_momentum: momentum,
    trajectory_alignment: trajectoryAlignment,
    trend_narrative: narrative,
    comparative_intelligence: comparative,
    readiness_trend,
    competency_velocities,
    trend_pattern_indicators,
    data_quality: dataQuality,
  };
}
