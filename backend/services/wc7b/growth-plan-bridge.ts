/**
 * CAPADEX WC-7B Tier A — Journey → Growth Plan Bridge (Deliverable 2).
 *
 * COMPOSE-ONLY + READ-ONLY. Activates a Growth Plan from the unified activation
 * decision by mapping the decision's activated L2 outcome models (current / desired
 * canonical stage → a canonical stage score) into the EXISTING M5 coach `CoachInput`,
 * then running `createAICoach(pool).growthPlan(input, persist=false)`. The plan is
 * NEVER persisted (no write to `m5_career_growth_plans`).
 *
 * When the assessed person resolves to real `user_competency_scores`
 * (`realUserScores`), those REAL competency baselines are merged in (union of
 * keyspaces — never overwriting the decision-derived models, never fabricated).
 *
 * Honest degradation: when no outcome model activated there is nothing to plan, so it
 * returns `ready:false reason:'no_outcome_models'`. Never throws — the caller is gated
 * on `isJourneyGrowthPlanBridgeEnabled()`.
 */
import type { Pool } from 'pg';
import { createAICoach } from '../m5-ai-coaching';
import { createAssessmentWriter } from '../assessment-writer';
import { normalizeStoredStage } from '../../lib/lifecycle';
import type { DecisionContext } from './decision-orchestrator';

/**
 * Map a stored stage to a 0..100 score on the WC3 5-point progression ladder
 * (Awareness 20 · Curiosity 40 · Clarity/Insight 60 · Growth 80 · Mastery 100). Resolution
 * goes through the canonical read-layer normalizer so a label, the display alias "Clarity",
 * or a `CAP_*` code all score identically. Unknown / absent stage → 50 (neutral midpoint),
 * preserving the legacy default. Score = (progression ordinal + 1) × 20.
 */
function stageScore(stage: string | null | undefined): number {
  const r = normalizeStoredStage(stage);
  const ordinal = r.isUncodedPreStage ? 0 : (r.code ? r.order + 1 : null);
  return ordinal === null ? 50 : (ordinal + 1) * 20;
}

export interface GrowthPlanActivation {
  ready: boolean;
  reason: string;
  source: 'outcome_models' | 'outcome_models+user_scores' | null;
  plan: ReturnType<typeof buildEmptyPlanShape> | null;
}

// Type-only helper so the public type mirrors the M5 roadmap without importing its
// internal (non-exported) shape.
function buildEmptyPlanShape() {
  return {
    user_id: '',
    target_role_id: null as string | null,
    horizon_months: 12,
    confidence: 0,
    steps: [] as any[],
    total_gap: 0,
    total_projected_uplift: 0,
  };
}

/**
 * Derive a Growth Plan activation from the unified decision. Read-only (persist=false).
 */
export async function deriveGrowthPlanActivation(
  pool: Pool,
  ctx: DecisionContext,
): Promise<GrowthPlanActivation> {
  try {
    const models = ctx.outcome && !ctx.outcome.unclassified ? ctx.outcome.models : [];
    if (models.length === 0) {
      return { ready: false, reason: 'no_outcome_models', source: null, plan: null };
    }

    const currentScores: Record<string, number> = {};
    const targetScores: Record<string, number> = {};
    for (const m of models) {
      currentScores[m.model_key] = stageScore(m.current_stage);
      targetScores[m.model_key] = stageScore(m.desired_stage);
    }

    // Merge REAL competency baselines when the person resolves to stored scores
    // (union of keyspaces — never overwrites a decision-derived model key).
    let source: GrowthPlanActivation['source'] = 'outcome_models';
    if (ctx.userId) {
      try {
        const real = await createAssessmentWriter(pool).realUserScores(ctx.userId);
        if (real && Object.keys(real).length > 0) {
          for (const [k, v] of Object.entries(real)) {
            if (currentScores[k] == null) currentScores[k] = Number(v);
          }
          source = 'outcome_models+user_scores';
        }
      } catch {
        /* real-score read is best-effort; ignore */
      }
    }

    const coach = createAICoach(pool);
    const plan = await coach.growthPlan(
      {
        userId: ctx.userId ?? `session:${ctx.sessionId}`,
        targetRoleId: ctx.journey?.primary_route?.route_key,
        currentScores,
        targetScores,
        // learningVelocity / reliability / marketDemand intentionally omitted — the
        // M5 engine applies honest neutral defaults; we never fabricate market data.
      },
      false, // READ-ONLY — never persist.
    );

    return { ready: true, reason: 'activated', source, plan: plan as any };
  } catch {
    return { ready: false, reason: 'growth_plan_bridge_error', source: null, plan: null };
  }
}
