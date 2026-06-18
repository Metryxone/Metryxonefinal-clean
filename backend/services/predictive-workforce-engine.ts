/**
 * Phase 5 — Predictive Workforce engine.
 *
 * Conservative, evidence-anchored forecasts for:
 *   • skill obsolescence (per competency, horizon 24m default)
 *   • workforce risk (org / function / role-family / layer / role)
 *   • role emergence (composite roles forming in the market)
 *   • AI exposure (per competency + per role; net disruption = exposure - augmentation)
 *
 * Language policy: all signals are developmental / planning aids. NEVER
 * promotes hiring/firing decisions. CI bands and confidence tiers stamped.
 */

import type { Pool } from 'pg';

export const PREDICTIVE_WORKFORCE_VERSION = '5.0.0';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskType = 'attrition_pressure' | 'capability_gap' | 'succession_thin' |
                       'ai_exposure' | 'market_drift';

const round = (x: number, p = 4) => Math.round(x * 10 ** p) / 10 ** p;

export function severityFromScore(score: number): RiskSeverity {
  if (score >= 0.75) return 'critical';
  if (score >= 0.55) return 'high';
  if (score >= 0.30) return 'medium';
  return 'low';
}

export interface ObsolescenceRow {
  competency_id: string;
  canonical_name?: string;
  obsolescence_score: number;
  horizon_months: number;
  drivers: string[];
  confidence_tier: string;
  evidence_count: number;
  recommended_pivot: string | null;
  captured_at: string;
}

export async function listObsolescence(
  pool: Pool, opts: { limit?: number; min_score?: number } = {},
): Promise<ObsolescenceRow[]> {
  const min = Math.max(0, Math.min(opts.min_score ?? 0, 1));
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));
  const { rows } = await pool.query(`
    SELECT o.competency_id, c.canonical_name,
           o.obsolescence_score::float AS obsolescence_score,
           o.horizon_months,
           o.drivers, o.confidence_tier, o.evidence_count,
           o.recommended_pivot, o.captured_at
      FROM wos_skill_obsolescence o
      LEFT JOIN onto_competencies c ON c.id = o.competency_id
     WHERE o.obsolescence_score >= $1
     ORDER BY o.obsolescence_score DESC
     LIMIT ${limit}
  `, [min]);
  return rows.map(r => ({ ...r, obsolescence_score: round(r.obsolescence_score) }));
}

export interface WorkforceRiskRow {
  id: number;
  tenant_id: number | null;
  scope_type: string;
  scope_ref: string | null;
  risk_type: RiskType;
  risk_score: number;
  severity: RiskSeverity;
  drivers: string[];
  recommended_actions: Array<Record<string, unknown>>;
  horizon_months: number;
  captured_at: string;
}

export async function listWorkforceRisk(
  pool: Pool, opts: { tenant_id?: number; risk_type?: RiskType; severity?: RiskSeverity; limit?: number } = {},
): Promise<WorkforceRiskRow[]> {
  const where: string[] = []; const params: any[] = [];
  if (opts.tenant_id != null)  { params.push(opts.tenant_id);  where.push(`tenant_id = $${params.length}`); }
  if (opts.risk_type)          { params.push(opts.risk_type);  where.push(`risk_type = $${params.length}`); }
  if (opts.severity)           { params.push(opts.severity);   where.push(`severity = $${params.length}`); }
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
  const { rows } = await pool.query(`
    SELECT id, tenant_id, scope_type, scope_ref, risk_type,
           risk_score::float AS risk_score, severity, drivers, recommended_actions,
           horizon_months, captured_at
      FROM wos_workforce_risk
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY
        CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        risk_score DESC
     LIMIT ${limit}
  `, params);
  return rows.map(r => ({ ...r, risk_score: round(r.risk_score) }));
}

/** Compose a fresh risk snapshot from current effectiveness + market signals. */
export async function recomputeOrgRiskSnapshot(
  pool: Pool, tenantId: number,
): Promise<WorkforceRiskRow[]> {
  // Capability gap proxy: avg ROI of effectiveness rollup (lower → bigger gap)
  const { rows: eff } = await pool.query<{ avg_roi: string | null; n: string }>(
    `SELECT AVG(roi_score)::float::text AS avg_roi, COUNT(*)::text AS n FROM learn_effectiveness`);
  const avgRoi = eff[0]?.avg_roi ? Number(eff[0].avg_roi) : 0.5;
  const capGapScore = Math.max(0, Math.min(1, 1 - avgRoi));

  // AI exposure proxy: mean ai_disruption from market signals
  const { rows: dis } = await pool.query<{ mean_exposure: string | null }>(
    `SELECT AVG(metric_value)::float::text AS mean_exposure
       FROM wos_market_signals
      WHERE signal_type='ai_disruption'`);
  const aiScore = Math.max(0, Math.min(1, dis[0]?.mean_exposure ? Number(dis[0].mean_exposure) : 0.4));

  const snapshot = [
    { type: 'capability_gap' as RiskType, score: capGapScore,
      drivers: ['low_intervention_roi','observed_effectiveness_thin'] },
    { type: 'ai_exposure' as RiskType, score: aiScore,
      drivers: ['market_signal:ai_disruption','automation_pressure'] },
  ];

  // Replace today's snapshot for this tenant + these risk types
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const s of snapshot) {
      await client.query(
        `DELETE FROM wos_workforce_risk
          WHERE tenant_id = $1 AND risk_type = $2 AND scope_type='org'
            AND captured_at::date = CURRENT_DATE`,
        [tenantId, s.type]);
      await client.query(
        `INSERT INTO wos_workforce_risk
           (tenant_id, scope_type, scope_ref, risk_type, risk_score, severity, drivers, recommended_actions, horizon_months)
         VALUES ($1,'org',NULL,$2,$3,$4,$5,$6,12)`,
        [tenantId, s.type, s.score, severityFromScore(s.score),
         JSON.stringify(s.drivers),
         JSON.stringify([{ action: 'review_capability_plan', priority: severityFromScore(s.score) }])],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  return listWorkforceRisk(pool, { tenant_id: tenantId, limit: 50 });
}

export async function aiExposure(pool: Pool, scope: 'competency' | 'role' | 'all' = 'all') {
  const where = scope === 'all' ? '' : `WHERE scope_type = '${scope}'`;
  const { rows } = await pool.query(`
    SELECT scope_type, scope_ref,
           exposure_score::float AS exposure_score,
           augmentation_score::float AS augmentation_score,
           net_disruption::float AS net_disruption,
           recommended_focus, captured_at
      FROM wos_ai_exposure
      ${where}
     ORDER BY net_disruption DESC
  `);
  return rows.map(r => ({
    ...r,
    exposure_score: round(r.exposure_score),
    augmentation_score: round(r.augmentation_score),
    net_disruption: round(r.net_disruption),
  }));
}

export async function listEmergingRoles(pool: Pool) {
  const { rows } = await pool.query(`
    SELECT id, emerging_role_name, base_role_id, industry_id,
           emergence_score::float AS emergence_score,
           composite_competencies, signals, first_observed_at, captured_at
      FROM wos_role_emergence
     ORDER BY emergence_score DESC
  `);
  return rows.map(r => ({ ...r, emergence_score: round(r.emergence_score) }));
}
