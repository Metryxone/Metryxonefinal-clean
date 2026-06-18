/**
 * Phase 5 — Learning ROI engine.
 *
 * Connects intervention outcomes (Phase 4 learn_*) to org-level financial
 * proxies. Conservative formula:
 *   capability_uplift = mean(competency_delta) per cohort
 *   roi_index         = capability_uplift / log(1 + total_program_cost)
 *
 * All financial estimates are clearly labelled "developmental signal" and
 * never asserted as guaranteed dollar returns.
 */

import type { Pool } from 'pg';

export const LEARNING_ROI_VERSION = '5.0.0';

const round = (x: number, p = 4) => Math.round(x * 10 ** p) / 10 ** p;

export interface RoiComputeInput {
  tenant_id: number;
  intervention_id: string;
  cohort_size: number;
  total_program_cost?: number;
  hourly_rate_proxy?: number;     // USD/hr default 50
  measurement_window_days?: number;
}

export interface RoiComputed {
  tenant_id: number;
  intervention_id: string;
  cohort_size: number;
  completion_rate: number;
  mean_competency_delta: number;
  mean_ei_delta: number;
  capability_uplift: number;
  estimated_capacity_gain_hours: number;
  estimated_retention_lift_pct: number;
  total_program_cost: number;
  roi_index: number;
  confidence_tier: 'A' | 'B' | 'C' | 'D' | 'provisional';
  language_note: string;
}

export async function computeRoi(pool: Pool, args: RoiComputeInput): Promise<RoiComputed> {
  // Pull effectiveness + completion stats from Phase 4 learn_outcomes / events
  const { rows: outcomeRows } = await pool.query<{
    mean_delta: string | null; mean_ei: string | null; n: string;
  }>(
    `SELECT AVG(competency_delta)::float::text AS mean_delta,
            AVG(ei_delta)::float::text         AS mean_ei,
            COUNT(*)::text                     AS n
       FROM learn_outcomes
      WHERE intervention_id = $1`,
    [args.intervention_id]);
  const meanDelta = Number(outcomeRows[0]?.mean_delta ?? 0) || 0;
  const meanEi    = Number(outcomeRows[0]?.mean_ei ?? 0) || 0;
  const n         = parseInt(outcomeRows[0]?.n ?? '0', 10);

  const { rows: evtRows } = await pool.query<{ recommended: string; completed: string }>(
    `SELECT COUNT(*) FILTER (WHERE event_type='recommended')::text AS recommended,
            COUNT(*) FILTER (WHERE event_type='completed')::text   AS completed
       FROM learn_intervention_events
      WHERE intervention_id = $1`,
    [args.intervention_id]);
  const rec = parseInt(evtRows[0]?.recommended ?? '0', 10);
  const com = parseInt(evtRows[0]?.completed ?? '0', 10);
  const completionRate = rec > 0 ? com / rec : 0.6;     // prior

  const cohort = Math.max(1, args.cohort_size);
  const capabilityUplift = meanDelta;                   // a per-learner pts move
  const hourlyRate = args.hourly_rate_proxy ?? 50;
  // Conservative: each +1 pt uplift = 0.5 hr/wk capacity gain over a quarter
  const capacityGainHours = round(capabilityUplift * 0.5 * 13 * cohort * completionRate, 2);
  // Conservative: 0.4 pct retention lift per +1 pt EI delta, ceiling 5%
  const retentionLift = Math.min(5, round(meanEi * 0.4, 2));
  const cost = args.total_program_cost ?? cohort * 250; // $250/learner default placeholder
  const roiIndex = cost > 0 ? round(capabilityUplift / Math.log(1 + cost), 4) : 0;

  const tier: RoiComputed['confidence_tier'] =
    n >= 100 ? 'A' : n >= 30 ? 'B' : n >= 10 ? 'C' : n >= 3 ? 'D' : 'provisional';

  return {
    tenant_id: args.tenant_id,
    intervention_id: args.intervention_id,
    cohort_size: cohort,
    completion_rate: round(completionRate),
    mean_competency_delta: round(meanDelta, 3),
    mean_ei_delta: round(meanEi, 3),
    capability_uplift: round(capabilityUplift, 3),
    estimated_capacity_gain_hours: capacityGainHours,
    estimated_retention_lift_pct: retentionLift,
    total_program_cost: round(cost, 2),
    roi_index: roiIndex,
    confidence_tier: tier,
    language_note: 'All ROI figures are developmental signals derived from observed cohort outcomes — not guaranteed financial returns.',
  };
}

export async function persistRoi(pool: Pool, r: RoiComputed): Promise<{ id: number }> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO wos_learning_roi
       (tenant_id, intervention_id, cohort_size, completion_rate, mean_competency_delta,
        mean_ei_delta, capability_uplift, estimated_capacity_gain_hours,
        estimated_retention_lift_pct, total_program_cost, roi_index, confidence_tier, context)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [r.tenant_id, r.intervention_id, r.cohort_size, r.completion_rate,
     r.mean_competency_delta, r.mean_ei_delta, r.capability_uplift,
     r.estimated_capacity_gain_hours, r.estimated_retention_lift_pct,
     r.total_program_cost, r.roi_index, r.confidence_tier,
     JSON.stringify({ note: r.language_note })]);
  return { id: Number(rows[0].id) };
}

export async function listRoi(pool: Pool, opts: {
  tenant_id?: number; intervention_id?: string; limit?: number;
} = {}) {
  const where: string[] = []; const params: any[] = [];
  if (opts.tenant_id != null) { params.push(opts.tenant_id); where.push(`tenant_id = $${params.length}`); }
  if (opts.intervention_id)  { params.push(opts.intervention_id); where.push(`intervention_id = $${params.length}`); }
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
  const { rows } = await pool.query(`
    SELECT id, tenant_id, intervention_id, cohort_size,
           completion_rate::float AS completion_rate,
           mean_competency_delta::float AS mean_competency_delta,
           mean_ei_delta::float AS mean_ei_delta,
           capability_uplift::float AS capability_uplift,
           estimated_capacity_gain_hours::float AS estimated_capacity_gain_hours,
           estimated_retention_lift_pct::float AS estimated_retention_lift_pct,
           total_program_cost::float AS total_program_cost,
           roi_index::float AS roi_index,
           confidence_tier, computed_at, context
      FROM wos_learning_roi
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY computed_at DESC, id DESC
     LIMIT ${limit}
  `, params);
  return rows;
}
