/**
 * MEI v2 Recommendation Engine
 * ─────────────────────────────
 * Gap analysis → prioritised, actionable recommendations.
 *
 * Priority formula:
 *   priority_score = impact_score × (1 - effort_score) × data_confidence
 *
 * Where:
 *   impact_score  = (dimension cal_weight × gap_magnitude) normalised to [0,1]
 *   effort_score  = low=0.1 / medium=0.4 / high=0.8
 *   data_confidence = MEIScoreOutput.confidence
 *
 * Output is persisted to mei_user_recommendations for dashboard display.
 */

import type { Pool } from 'pg';
import type { MEIScoreOutput } from './mei-scoring-engine';

const EFFORT_SCORE: Record<string, number> = { low: 0.10, medium: 0.40, high: 0.80 };

export interface ComputedRecommendation {
  id:             number;
  code:           string;
  title:          string;
  description:    string;
  action_type:    string;
  dimension_code: string | null;
  estimated_point_gain: number | null;
  effort_level:   string;
  time_to_complete: string | null;
  link_path:      string | null;
  priority_score: number;
  point_impact:   number;
  is_actioned:    boolean;
}

export async function computeRecommendations(
  pool: Pool,
  userId: string,
  score: MEIScoreOutput
): Promise<ComputedRecommendation[]> {
  // Load recommendation master with dimension info
  const masterRes = await pool.query(`
    SELECT
      rm.id, rm.code, rm.title, rm.description, rm.action_type,
      rm.estimated_point_gain::float,
      rm.effort_level, rm.time_to_complete, rm.link_path,
      d.code AS dimension_code
    FROM mei_recommendation_master rm
    LEFT JOIN mei_dimensions d ON d.id = rm.target_dimension
    WHERE rm.is_active
    ORDER BY rm.display_order
  `);
  const masters = masterRes.rows as Array<Record<string, unknown>>;

  // Dimension score map for gap calculation
  const dimScore = Object.fromEntries(score.dimensions.map(d => [d.code, d]));

  // Load existing actioned recommendations for this user
  const actionedRes = await pool.query(
    'SELECT recommendation_id FROM mei_user_recommendations WHERE user_id=$1 AND is_actioned=TRUE',
    [userId]
  );
  const actionedIds = new Set(actionedRes.rows.map((r: Record<string, unknown>) => r.recommendation_id as number));

  const recommendations: ComputedRecommendation[] = [];

  for (const master of masters) {
    const dimCode = master.dimension_code as string | null;
    const dim = dimCode ? dimScore[dimCode] : null;

    // Gap magnitude: how much room for improvement in this dimension (0..1)
    const gapMagnitude = dim ? Math.max(0, 1 - dim.score) : 0.5;

    // Impact: dimension weight × gap
    const calWeight = dim?.cal_weight ?? 0.20;
    const impactScore = Math.min(calWeight * gapMagnitude * 5, 1); // scale so max weight×full-gap ≈ 1

    // Special case: gated competencies (assessment not taken → high impact)
    let gateBonus = 0;
    if (master.action_type === 'take_assessment' || master.action_type === 'capadex') {
      const hasGated = score.dimensions.some(d =>
        d.subdimensions.some(sd => sd.competencies.some(c => c.is_gated && !c.gate_met))
      );
      if (hasGated) gateBonus = 0.3;
    }

    const effortScore = EFFORT_SCORE[master.effort_level as string] ?? 0.40;
    const priorityScore = (impactScore + gateBonus) * (1 - effortScore) * score.confidence;

    // Point impact: estimated points available × gap fraction
    const baseGain = (master.estimated_point_gain as number) ?? 2;
    const pointImpact = Math.round(baseGain * gapMagnitude * 10) / 10;

    recommendations.push({
      id:            master.id as number,
      code:          master.code as string,
      title:         master.title as string,
      description:   master.description as string,
      action_type:   master.action_type as string,
      dimension_code: dimCode,
      estimated_point_gain: master.estimated_point_gain as number | null,
      effort_level:  master.effort_level as string,
      time_to_complete: master.time_to_complete as string | null,
      link_path:     master.link_path as string | null,
      priority_score: Math.round(priorityScore * 1000) / 1000,
      point_impact:  pointImpact,
      is_actioned:   actionedIds.has(master.id as number),
    });
  }

  // Sort by priority descending, actioned last
  recommendations.sort((a, b) => {
    if (a.is_actioned !== b.is_actioned) return a.is_actioned ? 1 : -1;
    return b.priority_score - a.priority_score;
  });

  // Persist to mei_user_recommendations
  if (recommendations.length > 0) {
    const upsertValues = recommendations
      .map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4}, NOW())`)
      .join(', ');
    const params: unknown[] = [userId];
    for (const r of recommendations) {
      params.push(r.id, r.priority_score, r.point_impact);
    }
    await pool.query(
      `INSERT INTO mei_user_recommendations (user_id, recommendation_id, priority_score, point_impact, computed_at)
       VALUES ${upsertValues}
       ON CONFLICT (user_id, recommendation_id) DO UPDATE SET
         priority_score=EXCLUDED.priority_score,
         point_impact=EXCLUDED.point_impact,
         computed_at=NOW()`,
      params
    );
  }

  return recommendations;
}

/** Mark a recommendation as actioned */
export async function markRecommendationActioned(
  pool: Pool,
  userId: string,
  recommendationId: number
): Promise<void> {
  await pool.query(
    `UPDATE mei_user_recommendations
     SET is_actioned=TRUE, actioned_at=NOW()
     WHERE user_id=$1 AND recommendation_id=$2`,
    [userId, recommendationId]
  );
}
