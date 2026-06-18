import type { Pool } from 'pg';

export const EXECUTIVE_INTELLIGENCE_VERSION = '5.0.0';
export const EXECUTIVE_RECOMMENDATION_VERSION = '5.0.0';

const newId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36).slice(-4)}`;

export function createExecutiveIntelligence(pool: Pool) {
  async function insights(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_executive_workforce_insights WHERE org_id=$1 ORDER BY severity DESC, created_at DESC`,
      [orgId]);
    return r.rows;
  }

  async function strategicRisks(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_strategic_workforce_risks WHERE org_id=$1 ORDER BY composite_risk DESC`,
      [orgId]);
    return r.rows;
  }

  async function transformationReadiness(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_enterprise_transformation_readiness WHERE org_id=$1 ORDER BY recorded_at DESC LIMIT 1`,
      [orgId]);
    return r.rows[0] ?? null;
  }

  async function strategyRecommendations(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_workforce_strategy_recommendations WHERE org_id=$1 ORDER BY priority`, [orgId]);
    return r.rows;
  }

  async function executiveRecommendations(orgId: string, category?: string) {
    const sql = category
      ? `SELECT * FROM m5_executive_recommendations WHERE org_id=$1 AND category=$2 ORDER BY priority`
      : `SELECT * FROM m5_executive_recommendations WHERE org_id=$1 ORDER BY priority`;
    const args = category ? [orgId, category] : [orgId];
    const r = await pool.query(sql, args);
    return r.rows;
  }

  async function interventionRecommendations(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_organizational_intervention_recommendations WHERE org_id=$1 ORDER BY created_at DESC`,
      [orgId]);
    return r.rows;
  }

  async function logDecision(args: {
    orgId: string;
    recommendationId?: string;
    decision: string;
    decidedBy?: string;
    rationale?: string;
  }) {
    const id = newId('m5edAudit');
    await pool.query(
      `INSERT INTO m5_executive_decision_audits(id, org_id, recommendation_id, decision, decided_by, rationale)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, args.orgId, args.recommendationId ?? null, args.decision, args.decidedBy ?? null, args.rationale ?? null]);
    if (args.recommendationId) {
      await pool.query(
        `INSERT INTO m5_strategy_recommendation_logs(id, recommendation_id, action, actor, notes)
         VALUES ($1,$2,$3,$4,$5)`,
        [newId('m5srl'), args.recommendationId, args.decision, args.decidedBy ?? null, args.rationale ?? null]);
    }
    return { audit_id: id };
  }

  async function decisionAudits(orgId: string, limit = 50) {
    const r = await pool.query(
      `SELECT * FROM m5_executive_decision_audits WHERE org_id=$1 ORDER BY decided_at DESC LIMIT $2`,
      [orgId, Math.min(limit, 200)]);
    return r.rows;
  }

  return {
    insights, strategicRisks, transformationReadiness, strategyRecommendations,
    executiveRecommendations, interventionRecommendations, logDecision, decisionAudits,
  };
}
