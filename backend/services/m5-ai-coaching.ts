import type { Pool } from 'pg';

export const AI_COACHING_VERSION = '5.0.1';
export const GROWTH_ROADMAP_VERSION = '5.0.0';

const newId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36).slice(-4)}`;
const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

type CoachInput = {
  userId: string;
  orgId?: string;
  targetRoleId?: string;
  currentScores: Record<string, number>;
  targetScores?: Record<string, number>;
  marketDemand?: Record<string, number>;
  learningVelocity?: number;
  reliability?: number;
  horizonMonths?: number;
};

// Adaptive Career Roadmap = current + target + market + velocity → ranked development steps.
export function generateGrowthRoadmap(input: CoachInput) {
  const horizon = input.horizonMonths ?? 12;
  const v = clip(input.learningVelocity ?? 0.5, 0, 1);
  const rel = clip(input.reliability ?? 0.7, 0, 1);
  const steps: any[] = [];
  for (const comp of Object.keys(input.currentScores)) {
    const cur = input.currentScores[comp];
    const tgt = input.targetScores?.[comp] ?? Math.min(100, cur + 15);
    const gap = Math.max(0, tgt - cur);
    if (gap < 3) continue;
    const market = input.marketDemand?.[comp] ?? 0.5;
    // Priority: gap × demand × (1 - velocity discount); higher = more urgent.
    const priority = +(gap * (0.5 + 0.5 * market) * (1.2 - 0.4 * v)).toFixed(2);
    const projected_uplift = +clip(gap * (0.30 + 0.40 * v) * (horizon / 12), 0, gap).toFixed(2);
    steps.push({
      competency_id: comp,
      baseline: cur, target: tgt, gap,
      market_demand: market,
      priority,
      projected_uplift,
      projected_score: +clip(cur + projected_uplift, 0, 100).toFixed(2),
      rationale: `Gap ${gap.toFixed(1)} pts, market demand ${(market * 100).toFixed(0)}%. With learning velocity ${v.toFixed(2)} over ${horizon} mo, ~${projected_uplift.toFixed(1)} pts uplift is realistic.`,
    });
  }
  steps.sort((a, b) => b.priority - a.priority);
  return {
    user_id: input.userId,
    target_role_id: input.targetRoleId ?? null,
    horizon_months: horizon,
    confidence: +rel.toFixed(3),
    steps,
    total_gap: +steps.reduce((s, x) => s + x.gap, 0).toFixed(2),
    total_projected_uplift: +steps.reduce((s, x) => s + x.projected_uplift, 0).toFixed(2),
  };
}

export function createAICoach(pool: Pool) {
  async function growthPlan(input: CoachInput, persist = false) {
    const plan = generateGrowthRoadmap(input);
    if (persist) {
      const id = newId('m5cgp');
      await pool.query(
        `INSERT INTO m5_career_growth_plans(id, user_id, org_id, target_role_id, horizon_months, plan, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, input.userId, input.orgId ?? null, input.targetRoleId ?? null,
         plan.horizon_months, JSON.stringify(plan), plan.confidence]);
      return { ...plan, plan_id: id };
    }
    return plan;
  }

  async function learningRecommendations(userId: string, input?: CoachInput) {
    if (input) {
      const plan = generateGrowthRoadmap(input);
      return plan.steps.slice(0, 8).map((s, i) => ({
        competency_id: s.competency_id,
        resource_type: i % 2 === 0 ? 'course' : 'project',
        resource_title: `${s.competency_id} development pathway`,
        expected_uplift: s.projected_uplift,
        priority: i + 1,
        rationale: s.rationale,
      }));
    }
    const r = await pool.query(
      `SELECT * FROM m5_learning_recommendations WHERE user_id=$1 ORDER BY priority`, [userId]);
    return r.rows;
  }

  async function interventions(userId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_coaching_interventions WHERE user_id=$1 ORDER BY created_at DESC`, [userId]);
    return r.rows;
  }

  async function mentorMatches(userId: string, input?: CoachInput) {
    const stored = await pool.query(
      `SELECT * FROM m5_mentor_recommendations WHERE user_id=$1 ORDER BY match_score DESC`, [userId]);
    if (stored.rows.length) return stored.rows;
    // Demo fallback: derive 3 mentor archetypes from top gaps.
    if (!input) return [];
    const plan = generateGrowthRoadmap(input);
    return plan.steps.slice(0, 3).map((s, i) => ({
      mentor_user_id: `mentor_${s.competency_id}_${i}`,
      mentor_profile: { strength: s.competency_id, archetype: ['practitioner', 'leader', 'innovator'][i] },
      match_score: +clip(0.6 + 0.1 * (3 - i), 0, 1).toFixed(3),
      rationale: `Strong track record in ${s.competency_id}; matches your top development priority.`,
    }));
  }

  async function transitionGuidance(userId: string, fromRoleId: string, toRoleId: string, input: CoachInput) {
    const plan = generateGrowthRoadmap({ ...input, targetRoleId: toRoleId });
    return {
      user_id: userId, from_role_id: fromRoleId, to_role_id: toRoleId,
      feasibility: +clip(1 - plan.total_gap / 200, 0, 1).toFixed(3),
      guidance: {
        critical_gaps: plan.steps.slice(0, 3),
        estimated_horizon_months: plan.horizon_months,
        recommended_sequence: plan.steps.map(s => s.competency_id),
      },
    };
  }

  return { growthPlan, learningRecommendations, interventions, mentorMatches, transitionGuidance };
}
