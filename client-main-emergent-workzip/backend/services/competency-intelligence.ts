/**
 * Competency Intelligence Service — P-R4 W1
 *
 * Makes competency a first-class intelligence object:
 *   - competency_strengths     top-scoring competencies (≥ threshold)
 *   - competency_gaps          below target-role requirements
 *   - competency_readiness     readiness % for a target occupation
 *   - competency_progression   longitudinal history
 *   - competency_trend_tracking improvement velocity per competency
 *   - competency_recommendation_mapping which recs address which competency
 *   - competency_to_pathway_mapping pathways that address gaps
 *   - competency_to_trajectory_mapping trajectory delta per competency
 *
 * Additive + read-only. Never throws — all callers receive degraded output
 * on error rather than a propagated exception.
 */

import type { Pool } from 'pg';

export const COMPETENCY_INTELLIGENCE_VERSION = '2.0.0';

export interface CompetencyScore {
  competency_id: string;
  canonical_name: string;
  cluster: string;
  score: number;
  confidence: number;
  source: string;
  assessed_at: string | null;
}

export interface CompetencyStrength {
  competency_id: string;
  canonical_name: string;
  cluster: string;
  score: number;
  confidence: number;
  evidence_label: string;
}

export interface CompetencyGap {
  competency_id: string;
  canonical_name: string;
  cluster: string;
  user_score: number;
  target_score: number;
  gap: number;
  gap_severity: 'critical' | 'significant' | 'moderate' | 'minor';
  bridgeable: boolean;
  /** P-R5 W1: 0–100 — (gap_magnitude × importance_weight) / effort_factor. Higher = prioritise first. */
  priority_score: number;
  /** P-R5 W1: Estimated weeks to close gap at average observed competency velocity. */
  weeks_to_close: number | null;
}

export interface CompetencyReadiness {
  occupation_title: string;
  readiness_pct: number;
  readiness_band: 'developing' | 'approaching' | 'near_ready' | 'ready';
  strengths_count: number;
  gaps_count: number;
  critical_gaps_count: number;
  confidence: number;
  /** P-R5 W1: Projected readiness pct in 30 / 60 / 90 days based on gap velocity. */
  forecast_30d: number | null;
  forecast_60d: number | null;
  forecast_90d: number | null;
}

export interface CompetencyHistoryEntry {
  snapshot_at: string;
  competency_id: string;
  canonical_name: string;
  score: number;
  source: string;
}

export interface CompetencyTrend {
  competency_id: string;
  canonical_name: string;
  cluster: string;
  earliest_score: number;
  latest_score: number;
  delta: number;
  trend_direction: 'improving' | 'stable' | 'declining';
  data_points: number;
  /** P-R5 W1: Net score points gained/lost per week of data (null < 2 snapshots). */
  growth_velocity_per_week: number | null;
}

export interface CompetencyRecommendationMapping {
  competency_id: string;
  canonical_name: string;
  rec_category: string;
  rec_action: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CompetencyPathwayMapping {
  competency_id: string;
  canonical_name: string;
  pathway_name: string;
  pathway_category: string;
  pathway_relevance: number;
}

export interface CompetencyTrajectoryMapping {
  competency_id: string;
  canonical_name: string;
  projected_score_6m: number;
  projected_score_12m: number;
  growth_required_for_target: number | null;
}

export interface CompetencyIntelligenceProfile {
  user_id: string;
  generated_at: string;
  version: string;
  scores: CompetencyScore[];
  strengths: CompetencyStrength[];
  gaps: CompetencyGap[];
  readiness: CompetencyReadiness | null;
  progression: CompetencyHistoryEntry[];
  trends: CompetencyTrend[];
  recommendation_mapping: CompetencyRecommendationMapping[];
  pathway_mapping: CompetencyPathwayMapping[];
  trajectory_mapping: CompetencyTrajectoryMapping[];
  /** P-R5 W1: 0–1 composite: how strongly competency evidence informs EI modifier. */
  competency_impact_score: number;
  /** P-R5 W1: Personalization notes applied (career stage / seniority). */
  career_stage_adjustments: string[];
  data_quality: {
    scores_count: number;
    history_entries: number;
    has_target_role: boolean;
    confidence: 'high' | 'medium' | 'low';
  };
}

const STRENGTH_THRESHOLD = 65;
const GAP_SEVERITY = (gap: number): CompetencyGap['gap_severity'] => {
  const g = Math.abs(gap);
  if (g >= 30) return 'critical';
  if (g >= 20) return 'significant';
  if (g >= 10) return 'moderate';
  return 'minor';
};
const READINESS_BAND = (pct: number): CompetencyReadiness['readiness_band'] => {
  if (pct >= 80) return 'ready';
  if (pct >= 65) return 'near_ready';
  if (pct >= 45) return 'approaching';
  return 'developing';
};

/** P-R5 W1: priority = magnitude × cluster_weight × (1/effort_factor). 0–100. */
const GAP_PRIORITY_SCORE = (gap: number, cluster: string): number => {
  const magnitude = Math.min(100, Math.abs(gap));
  const cw = cluster === 'leadership' || cluster === 'strategic' ? 1.3
           : cluster === 'execution' ? 1.1 : 1.0;
  const ef = magnitude >= 30 ? 0.6 : magnitude >= 20 ? 0.75 : magnitude >= 10 ? 0.9 : 1.0;
  return Math.round(Math.min(100, magnitude * cw * ef));
};

/** P-R5 W1: estimated weeks to close gap at typical learning velocity. */
const WEEKS_TO_CLOSE = (gap: number): number | null => {
  const g = Math.abs(gap);
  if (g === 0) return null;
  if (g <= 10) return 6;
  if (g <= 20) return 12;
  if (g <= 30) return 20;
  return 32;
};

// ── Core score resolver ──────────────────────────────────────────────────────

async function resolveUserCompetencyScores(pool: Pool, userId: string): Promise<CompetencyScore[]> {
  try {
    // Primary: user_competency_scores (most direct, career-builder populated)
    const r = await pool.query<{
      competency_id: string; canonical_name: string; cluster_name: string;
      score: number; confidence: number; source: string; updated_at: string;
    }>(
      `SELECT ucs.competency_id::text, cl.canonical_name, cc.cluster_name,
              ucs.score::float, ucs.confidence::float, ucs.source, ucs.updated_at::text
         FROM user_competency_scores ucs
         JOIN competency_library cl ON cl.id = ucs.competency_id
         LEFT JOIN competency_clusters cc ON cc.id = cl.cluster_id
        WHERE ucs.user_id = $1
        ORDER BY ucs.score DESC`,
      [userId],
    );
    if (r.rowCount && r.rowCount > 0) return r.rows.map(row => ({
      competency_id: row.competency_id,
      canonical_name: row.canonical_name,
      cluster: row.cluster_name || 'general',
      score: Math.round(row.score),
      confidence: +row.confidence.toFixed(2),
      source: row.source || 'assessment',
      assessed_at: row.updated_at,
    }));
  } catch { /* fall through */ }

  try {
    // Fallback: p4_competency_history latest snapshot per competency
    const r = await pool.query<{
      competency_id: string; competency_name: string; cluster_name: string;
      score: number; source: string; created_at: string;
    }>(
      `SELECT DISTINCT ON (h.competency_id)
              h.competency_id::text, h.competency_name, 'general' AS cluster_name,
              h.score::float, h.source, h.created_at::text
         FROM p4_competency_history h
        WHERE h.user_id = $1
        ORDER BY h.competency_id, h.created_at DESC`,
      [userId],
    );
    return r.rows.map(row => ({
      competency_id: row.competency_id,
      canonical_name: row.competency_name,
      cluster: row.cluster_name,
      score: Math.round(row.score),
      confidence: 0.6,
      source: row.source || 'history',
      assessed_at: row.created_at,
    }));
  } catch { return []; }
}

// ── Strengths ────────────────────────────────────────────────────────────────

export function deriveStrengths(scores: CompetencyScore[]): CompetencyStrength[] {
  return scores
    .filter(s => s.score >= STRENGTH_THRESHOLD)
    .slice(0, 10)
    .map(s => ({
      competency_id: s.competency_id,
      canonical_name: s.canonical_name,
      cluster: s.cluster,
      score: s.score,
      confidence: s.confidence,
      evidence_label: s.score >= 80 ? 'Strong evidence of mastery'
                    : s.score >= 70 ? 'Consistent demonstrated capability'
                    : 'Emerging demonstrated capability',
    }));
}

// ── Gaps ─────────────────────────────────────────────────────────────────────

async function deriveGaps(
  pool: Pool, userId: string, targetOccupationTitle: string, scores: CompetencyScore[],
): Promise<CompetencyGap[]> {
  try {
    // Get role competency requirements
    const occ = await pool.query<{ id: string }>(
      `SELECT id FROM occupations WHERE canonical_title ILIKE $1 AND is_active LIMIT 1`,
      [targetOccupationTitle],
    );
    if (!occ.rowCount) return [];
    const occId = occ.rows[0].id;

    // Try mobility_competency_gaps first
    const mgaps = await pool.query<{
      competency_id: string; canonical_name: string; cluster: string;
      user_score: number; target_score: number; gap: number;
    }>(
      `SELECT mcg.competency_id::text, cl.canonical_name,
              COALESCE(cc.cluster_name,'general') AS cluster,
              mcg.user_score::float, mcg.target_score::float,
              (mcg.user_score - mcg.target_score)::float AS gap
         FROM mobility_competency_gaps mcg
         JOIN competency_library cl ON cl.id = mcg.competency_id
         LEFT JOIN competency_clusters cc ON cc.id = cl.cluster_id
        WHERE mcg.user_id = $1 AND mcg.occupation_id = $2`,
      [userId, occId],
    );
    if (mgaps.rowCount && mgaps.rowCount > 0) {
      return mgaps.rows
        .filter(r => r.gap < 0)
        .map(r => ({
          competency_id: r.competency_id,
          canonical_name: r.canonical_name,
          cluster: r.cluster,
          user_score: Math.round(r.user_score),
          target_score: Math.round(r.target_score),
          gap: Math.round(r.gap),
          gap_severity: GAP_SEVERITY(r.gap),
          bridgeable: Math.abs(r.gap) <= 30,
          priority_score: GAP_PRIORITY_SCORE(r.gap, r.cluster),
          weeks_to_close: WEEKS_TO_CLOSE(r.gap),
        }))
        .sort((a, b) => a.gap - b.gap)
        .slice(0, 8);
    }

    // Fallback: use role_competency_weights as target
    const rcw = await pool.query<{
      competency_id: string; canonical_name: string; cluster_name: string; target_score: number;
    }>(
      `SELECT rcw.competency_id::text, cl.canonical_name,
              COALESCE(cc.cluster_name,'general') AS cluster_name,
              (rcw.weight * 100)::float AS target_score
         FROM role_competency_weights rcw
         JOIN competency_library cl ON cl.id = rcw.competency_id
         LEFT JOIN competency_clusters cc ON cc.id = cl.cluster_id
        WHERE rcw.occupation_id = $1
        ORDER BY rcw.weight DESC
        LIMIT 12`,
      [occId],
    );
    const scoreMap = new Map(scores.map(s => [s.competency_id, s.score]));
    return rcw.rows.map(r => {
      const userScore = scoreMap.get(r.competency_id) ?? 0;
      const gap = userScore - r.target_score;
      return {
        competency_id: r.competency_id,
        canonical_name: r.canonical_name,
        cluster: r.cluster_name,
        user_score: Math.round(userScore),
        target_score: Math.round(r.target_score),
        gap: Math.round(gap),
        gap_severity: GAP_SEVERITY(gap),
        bridgeable: Math.abs(gap) <= 30,
        priority_score: GAP_PRIORITY_SCORE(gap, r.cluster_name),
        weeks_to_close: WEEKS_TO_CLOSE(gap),
      };
    }).filter(r => r.gap < 0).sort((a, b) => a.gap - b.gap).slice(0, 8);
  } catch { return []; }
}

// ── Readiness ────────────────────────────────────────────────────────────────

export function deriveReadiness(
  gaps: CompetencyGap[], strengths: CompetencyStrength[], targetTitle: string,
): CompetencyReadiness {
  const totalChecked = Math.max(gaps.length + strengths.length, 1);
  const metCount = strengths.length;
  const pct = Math.round((metCount / totalChecked) * 100);
  const criticalGaps = gaps.filter(g => g.gap_severity === 'critical').length;
  const conf = totalChecked >= 5 ? 0.75 : totalChecked >= 3 ? 0.55 : 0.35;

  // P-R5 W1: 30/60/90-day readiness forecast based on gap-closing velocity
  const avgWeeklyReadinessGain = gaps.length > 0
    ? gaps.reduce((s, g) => {
        if (!g.weeks_to_close || g.weeks_to_close === 0) return s;
        return s + (Math.abs(g.gap) / g.weeks_to_close) / Math.max(1, totalChecked) * 100 * 0.25;
      }, 0) / gaps.length
    : 0;
  const f30 = avgWeeklyReadinessGain > 0 ? Math.min(100, Math.round(pct + avgWeeklyReadinessGain * 4.3)) : null;
  const f60 = avgWeeklyReadinessGain > 0 ? Math.min(100, Math.round(pct + avgWeeklyReadinessGain * 8.6)) : null;
  const f90 = avgWeeklyReadinessGain > 0 ? Math.min(100, Math.round(pct + avgWeeklyReadinessGain * 12.9)) : null;

  return {
    occupation_title: targetTitle,
    readiness_pct: pct,
    readiness_band: READINESS_BAND(pct),
    strengths_count: strengths.length,
    gaps_count: gaps.length,
    critical_gaps_count: criticalGaps,
    confidence: conf,
    forecast_30d: f30,
    forecast_60d: f60,
    forecast_90d: f90,
  };
}

// ── Progression (longitudinal) ────────────────────────────────────────────────

async function resolveProgression(pool: Pool, userId: string): Promise<CompetencyHistoryEntry[]> {
  try {
    const r = await pool.query<{
      created_at: string; competency_id: string; competency_name: string; score: number; source: string;
    }>(
      `SELECT created_at::text, competency_id::text, competency_name, score::float, source
         FROM p4_competency_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [userId],
    );
    return r.rows.map(row => ({
      snapshot_at: row.created_at,
      competency_id: row.competency_id,
      canonical_name: row.competency_name,
      score: Math.round(row.score),
      source: row.source || 'history',
    }));
  } catch { return []; }
}

// ── Trends ───────────────────────────────────────────────────────────────────

export function deriveCompetencyTrends(progression: CompetencyHistoryEntry[], scores: CompetencyScore[]): CompetencyTrend[] {
  // Group history by competency
  const byComp = new Map<string, { name: string; entries: Array<{ ts: string; score: number }> }>();
  for (const e of progression) {
    if (!byComp.has(e.competency_id)) byComp.set(e.competency_id, { name: e.canonical_name, entries: [] });
    byComp.get(e.competency_id)!.entries.push({ ts: e.snapshot_at, score: e.score });
  }
  // Fill in current scores for competencies not in history
  for (const s of scores) {
    if (!byComp.has(s.competency_id)) {
      byComp.set(s.competency_id, { name: s.canonical_name, entries: [] });
    }
    const bucket = byComp.get(s.competency_id)!;
    if (s.assessed_at) bucket.entries.push({ ts: s.assessed_at, score: s.score });
  }

  const trends: CompetencyTrend[] = [];
  const clusterMap = new Map(scores.map(s => [s.competency_id, s.cluster]));

  for (const [id, { name, entries }] of byComp) {
    if (entries.length === 0) continue;
    const sorted = [...entries].sort((a, b) => a.ts.localeCompare(b.ts));
    const earliest = sorted[0].score;
    const latest = sorted[sorted.length - 1].score;
    const delta = latest - earliest;
    const weeksCovered = sorted.length >= 2
      ? Math.max(0.1, (new Date(sorted[sorted.length - 1].ts).getTime() - new Date(sorted[0].ts).getTime()) / (7 * 24 * 60 * 60 * 1000))
      : 0;
    const growth_velocity_per_week = sorted.length >= 2
      ? Math.round((delta / weeksCovered) * 100) / 100
      : null;
    trends.push({
      competency_id: id,
      canonical_name: name,
      cluster: clusterMap.get(id) || 'general',
      earliest_score: earliest,
      latest_score: latest,
      delta: Math.round(delta),
      trend_direction: delta > 3 ? 'improving' : delta < -3 ? 'declining' : 'stable',
      data_points: sorted.length,
      growth_velocity_per_week,
    });
  }
  return trends.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

// ── Recommendation mapping ─────────────────────────────────────────────────

export function deriveRecommendationMapping(gaps: CompetencyGap[]): CompetencyRecommendationMapping[] {
  return gaps.slice(0, 6).map(g => {
    const cat = g.cluster === 'leadership' ? 'leadership_growth' : 'competency_development';
    return {
      competency_id: g.competency_id,
      canonical_name: g.canonical_name,
      rec_category: cat,
      rec_action: `Targeted development programme for ${g.canonical_name}`,
      priority: g.gap_severity === 'critical' ? 'high'
               : g.gap_severity === 'significant' ? 'medium' : 'low',
    };
  });
}

// ── Pathway mapping ──────────────────────────────────────────────────────────

async function derivePathwayMapping(pool: Pool, gaps: CompetencyGap[]): Promise<CompetencyPathwayMapping[]> {
  if (gaps.length === 0) return [];
  try {
    const ids = gaps.slice(0, 5).map(g => g.competency_id);
    const r = await pool.query<{
      pathway_id: string; pathway_name: string; pathway_category: string;
      competency_id: string; relevance: number;
    }>(
      `SELECT dp.id::text AS pathway_id, dp.name AS pathway_name,
              dp.category AS pathway_category,
              dp.terminal_competency_id::text AS competency_id,
              1.0 AS relevance
         FROM developmental_pathways dp
        WHERE dp.terminal_competency_id = ANY($1::uuid[])
        LIMIT 10`,
      [ids],
    );
    return r.rows.map(row => ({
      competency_id: row.competency_id,
      canonical_name: gaps.find(g => g.competency_id === row.competency_id)?.canonical_name || row.competency_id,
      pathway_name: row.pathway_name,
      pathway_category: row.pathway_category || 'general',
      pathway_relevance: row.relevance,
    }));
  } catch { return []; }
}

// ── Trajectory mapping ───────────────────────────────────────────────────────

async function deriveTrajectoryMapping(
  pool: Pool, userId: string, gaps: CompetencyGap[],
): Promise<CompetencyTrajectoryMapping[]> {
  if (gaps.length === 0) return [];
  try {
    const ids = gaps.slice(0, 5).map(g => g.competency_id);
    const r = await pool.query<{
      competency_id: string; projected_6m: number; projected_12m: number;
    }>(
      `SELECT competency_id::text, projected_score_6m::float AS projected_6m,
              projected_score_12m::float AS projected_12m
         FROM competency_forecasts
        WHERE user_id = $1 AND competency_id = ANY($2::uuid[])
        ORDER BY generated_at DESC
        LIMIT 10`,
      [userId, ids],
    );
    return r.rows.map(row => {
      const gap = gaps.find(g => g.competency_id === row.competency_id);
      return {
        competency_id: row.competency_id,
        canonical_name: gap?.canonical_name || row.competency_id,
        projected_score_6m: Math.round(row.projected_6m),
        projected_score_12m: Math.round(row.projected_12m),
        growth_required_for_target: gap ? Math.abs(gap.target_score - gap.user_score) : null,
      };
    });
  } catch { return []; }
}

// ── Master resolver ──────────────────────────────────────────────────────────

export async function resolveCompetencyIntelligence(
  pool: Pool,
  userId: string,
  targetOccupationTitle?: string,
): Promise<CompetencyIntelligenceProfile> {
  const scores = await resolveUserCompetencyScores(pool, userId);
  const strengths = deriveStrengths(scores);
  const gaps = targetOccupationTitle
    ? await deriveGaps(pool, userId, targetOccupationTitle, scores)
    : [];
  const readiness = targetOccupationTitle
    ? deriveReadiness(gaps, strengths, targetOccupationTitle)
    : null;
  const progression = await resolveProgression(pool, userId);
  const trends = deriveCompetencyTrends(progression, scores);
  const recommendation_mapping = deriveRecommendationMapping(gaps);
  const pathway_mapping = await derivePathwayMapping(pool, gaps);
  const trajectory_mapping = await deriveTrajectoryMapping(pool, userId, gaps);

  const dataQuality = {
    scores_count: scores.length,
    history_entries: progression.length,
    has_target_role: !!targetOccupationTitle,
    confidence: (scores.length >= 5 ? 'high' : scores.length >= 2 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
  };

  // P-R5 W1: competency_impact_score — how much evidence backs a competency EI modifier
  const competency_impact_score = scores.length >= 5 ? 0.85
    : scores.length >= 3 ? 0.65
    : scores.length >= 1 ? 0.40
    : 0;

  // P-R5 W6: career-stage personalization notes
  const career_stage_adjustments: string[] = [];
  if (scores.length === 0) career_stage_adjustments.push('No competency scores yet — complete an assessment to unlock gap analysis.');
  if (gaps.length > 0 && readiness) {
    if (readiness.readiness_band === 'developing') career_stage_adjustments.push('Focus on critical gaps first — they have the highest priority scores.');
    if (readiness.readiness_band === 'near_ready') career_stage_adjustments.push('Near-ready for target role — address 1–2 priority gaps to reach readiness.');
    if (readiness.forecast_90d && readiness.forecast_90d >= 80) career_stage_adjustments.push('On track to reach role-readiness within 90 days at current velocity.');
  }
  if (trends.filter(t => t.trend_direction === 'improving').length >= 3)
    career_stage_adjustments.push('Strong momentum: 3+ competencies showing measurable improvement.');

  return {
    user_id: userId,
    generated_at: new Date().toISOString(),
    version: COMPETENCY_INTELLIGENCE_VERSION,
    scores,
    strengths,
    gaps,
    readiness,
    progression,
    trends,
    recommendation_mapping,
    pathway_mapping,
    trajectory_mapping,
    competency_impact_score,
    career_stage_adjustments,
    data_quality: dataQuality,
  };
}
