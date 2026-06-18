/**
 * RIE Core Routes — Recommendation & Intervention Engine
 * Auth: requireAuth + requireSuperAdmin passed in from registerRoutes()
 * Tables are created by migration 20260507_rie_engine.sql — no DDL here
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { aggregateUserContext } from '../services/rie-aggregator';
import { generateRecommendations, saveRecommendations } from '../services/rie-recommendation-engine';
import { orchestrateInterventions } from '../services/rie-intervention-orchestrator';
import { computeRecoveryProfile } from '../services/rie-recovery-intelligence';
import { detectOpportunities, saveOpportunityFlags } from '../services/rie-opportunity-engine';

export async function runRIEPipeline(pool: Pool, email: string, sessionId?: string, tenantId?: string): Promise<void> {
  const ctx = await aggregateUserContext(pool, email, sessionId, tenantId);
  const recs = generateRecommendations(ctx);
  const opportunities = detectOpportunities(ctx);

  await Promise.all([
    saveRecommendations(pool, email, sessionId, recs, ctx.tenant_id),
    orchestrateInterventions(pool, ctx),
    computeRecoveryProfile(pool, email, ctx.tenant_id),
    saveOpportunityFlags(pool, email, opportunities, ctx.tenant_id),
  ]);
}

export function registerRIERoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler
) {
  // POST /api/rie/run/:email — full pipeline trigger (super admin only)
  app.post('/api/rie/run/:email', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const { session_id } = req.body;
      if (!email) return res.status(400).json({ error: 'email required' });
      await runRIEPipeline(pool, email, session_id);
      res.json({ ok: true, message: 'RIE pipeline completed', email });
    } catch (err) { next(err); }
  });

  // GET /api/rie/context/:email (super admin only) — tenant-scoped read
  app.get('/api/rie/context/:email', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const tenantId = (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000000';
      const { rows: [ctx] } = await pool.query(
        `SELECT * FROM rie_intervention_context WHERE user_email=$1 AND tenant_id=$2`,
        [email, tenantId]
      );
      if (!ctx) return res.status(404).json({ error: 'No context found — run RIE pipeline first' });
      res.json({ context: ctx });
    } catch (err) { next(err); }
  });

  // GET /api/rie/recommendations/:email (super admin only) — tenant-scoped read
  app.get('/api/rie/recommendations/:email', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const tenantId = (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000000';
      const { rows } = await pool.query(
        `SELECT * FROM rie_recommendations WHERE user_email=$1 AND tenant_id=$2 ORDER BY priority ASC, created_at DESC LIMIT 20`,
        [email, tenantId]
      );
      res.json({ recommendations: rows });
    } catch (err) { next(err); }
  });

  // POST /api/rie/interventions/:email/resolve (super admin only)
  app.post('/api/rie/interventions/:email/resolve', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const { intervention_id, outcome_type, score_before, score_after, notes } = req.body;
      if (!intervention_id) return res.status(400).json({ error: 'intervention_id required' });

      const delta = score_after != null && score_before != null ? score_after - score_before : null;
      const success = delta != null ? delta > 0 : false;

      await pool.query(
        `UPDATE rie_interventions SET status='completed', outcome_notes=$1, completed_at=NOW(), updated_at=NOW() WHERE id=$2`,
        [notes || '', intervention_id]
      );
      await pool.query(
        `INSERT INTO rie_outcomes (user_email, intervention_id, outcome_type, score_before, score_after, delta, success, notes, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
        [email, intervention_id, outcome_type || 'manual_resolve', score_before, score_after, delta, success, notes || '']
      );
      res.json({ ok: true, success, delta });
    } catch (err) { next(err); }
  });

  // POST /api/rie/counterfactual — what-if simulation (super admin, no DB writes)
  app.post('/api/rie/counterfactual', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, levers } = req.body;
      if (!email) return res.status(400).json({ error: 'email required' });

      const ctx = await aggregateUserContext(pool, email, undefined, undefined, false);

      const modifiedCtx = { ...ctx };
      if (levers?.add_mentorship) {
        modifiedCtx.dropout_risk = Math.max(0, ctx.dropout_risk - 20);
        modifiedCtx.burnout_probability = Math.max(0, ctx.burnout_probability - 15);
        modifiedCtx.leadership_emergence = Math.min(100, ctx.leadership_emergence + 10);
      }
      if (levers?.reduce_overload) {
        modifiedCtx.cognitive_load = Math.max(0, ctx.cognitive_load - 25);
        modifiedCtx.emotional_load = Math.max(0, ctx.emotional_load - 20);
        modifiedCtx.burnout_probability = Math.max(0, ctx.burnout_probability - 20);
      }
      if (levers?.optimise_pacing) {
        modifiedCtx.engagement_score = Math.min(100, ctx.engagement_score + 15);
        modifiedCtx.dropout_risk = Math.max(0, ctx.dropout_risk - 15);
        modifiedCtx.lbi_score = Math.min(100, ctx.lbi_score + 8);
      }
      if (levers?.delay_emotional_support) {
        modifiedCtx.emotional_load = Math.min(100, ctx.emotional_load + 10);
        modifiedCtx.burnout_probability = Math.min(100, ctx.burnout_probability + 15);
        modifiedCtx.dropout_risk = Math.min(100, ctx.dropout_risk + 10);
      }
      if (levers?.add_peer_support) {
        modifiedCtx.engagement_score = Math.min(100, ctx.engagement_score + 10);
        modifiedCtx.leadership_emergence = Math.min(100, ctx.leadership_emergence + 5);
      }

      const baselineRecs = generateRecommendations(ctx);
      const modifiedRecs = generateRecommendations(modifiedCtx);

      // Project recovery intelligence for counterfactual context
      const projectedMomentumVelocityBoost = levers?.reduce_overload ? 10 : levers?.optimise_pacing ? 8 : 0;
      const projectedMomentumScore = Math.min(100, Math.round(
        (modifiedCtx.engagement_score * 0.4 + (100 - modifiedCtx.burnout_probability) * 0.35 + (100 - modifiedCtx.dropout_risk) * 0.25)
        + projectedMomentumVelocityBoost
      ));

      const delta = {
        dropout_risk: modifiedCtx.dropout_risk - ctx.dropout_risk,
        burnout_probability: modifiedCtx.burnout_probability - ctx.burnout_probability,
        employability_readiness: modifiedCtx.employability_readiness - ctx.employability_readiness,
        leadership_emergence: modifiedCtx.leadership_emergence - ctx.leadership_emergence,
        emotional_load: modifiedCtx.emotional_load - ctx.emotional_load,
        cognitive_load: modifiedCtx.cognitive_load - ctx.cognitive_load,
        engagement_score: modifiedCtx.engagement_score - ctx.engagement_score,
        recommendation_count_change: modifiedRecs.length - baselineRecs.length,
        projected_recovery_momentum: projectedMomentumScore,
        crisis_risk_change: ctx.crisis_detected && !modifiedCtx.crisis_detected ? 'resolved' :
          !ctx.crisis_detected && modifiedCtx.crisis_detected ? 'emerged' : 'unchanged',
      };

      res.json({
        baseline: { context: ctx, recommendations: baselineRecs.slice(0, 5) },
        projected: { context: modifiedCtx, recommendations: modifiedRecs.slice(0, 5), recovery_momentum: projectedMomentumScore },
        levers_applied: levers,
        delta,
        summary: `Applying selected levers projects: dropout risk ${delta.dropout_risk > 0 ? '+' : ''}${delta.dropout_risk}%, burnout ${delta.burnout_probability > 0 ? '+' : ''}${delta.burnout_probability}%, engagement ${delta.engagement_score > 0 ? '+' : ''}${delta.engagement_score}`,
      });
    } catch (err) { next(err); }
  });

  // POST /api/rie/signals/emotional-containment — emergency containment (super admin only)
  app.post('/api/rie/signals/emotional-containment', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, session_id, trigger_signals, severity } = req.body;
      if (!email) return res.status(400).json({ error: 'email required' });

      // Resolve tenant_id for this user (sentinel for public users)
      const { rows: ctxRow } = await pool.query(
        `SELECT tenant_id FROM rie_intervention_context WHERE user_email=$1 LIMIT 1`,
        [email.toLowerCase()]
      );
      const tenantId = ctxRow[0]?.tenant_id || '00000000-0000-0000-0000-000000000000';

      const { rows: [esc] } = await pool.query(`
        INSERT INTO rie_escalations
          (user_email, tenant_id, session_id, escalation_type, severity, trigger_reason, trigger_signals,
           requires_counsellor, mandatory_human_review, status, created_at, updated_at)
        VALUES ($1,$2,$3,'emotional_containment',$4,'Emergency emotional containment triggered',$5,true,true,'pending',NOW(),NOW())
        RETURNING id, user_email, escalation_type, severity, trigger_reason, requires_counsellor, mandatory_human_review
      `, [email, tenantId, session_id || null, severity || 'critical', JSON.stringify(trigger_signals || [])]);

      // Non-blocking crisis email alert
      if (esc) {
        import('../email').then(({ sendCrisisEscalationAlert }) =>
          sendCrisisEscalationAlert(esc).then(sent => {
            if (sent && esc?.id) {
              pool.query(
                `UPDATE rie_escalations SET admin_notified_at = NOW() WHERE id = $1`,
                [esc.id]
              ).catch(e => console.error('[rie] admin_notified_at update error:', e));
            }
          }).catch(e => console.error('[rie] crisis email error:', e))
        ).catch(console.error);
      }

      res.json({
        ok: true,
        action: 'emergency_escalation_created',
        mandatory_human_review: true,
        message: 'Constitutional AI guardrail active — mandatory human counsellor review has been triggered',
      });
    } catch (err) { next(err); }
  });
}
