/**
 * Phase 4 — Intervention Learning Engine.
 *
 * Tracks the full causal chain:
 *   recommendation → action (started) → completion → competency delta →
 *   EI delta → trajectory shift.
 *
 * Reads/writes `learn_intervention_events`, `learn_outcomes`,
 * `learn_effectiveness`. Read-only against `onto_*` and `p4_competency_history`.
 *
 * Pure-function math is exported separately so tests don't need a DB.
 *
 * Language policy: developmental opportunity · observed delta · ROI signal.
 * Never asserts hiring outcomes or guaranteed lift.
 */

import type { Pool } from 'pg';

export const INTERVENTION_LEARNING_VERSION = '4.0.0';

export type EventType = 'recommended' | 'viewed' | 'started' | 'completed' | 'dismissed' | 'abandoned';
export type TrajectoryShift = 'accelerating' | 'stabilizing' | 'flat' | 'declining' | 'recovering';
export type ConfidenceTier = 'A' | 'B' | 'C' | 'D' | 'provisional';

export interface InterventionEvent {
  user_id: string;
  intervention_id: string;
  event_type: EventType;
  recommendation_id?: string | null;
  profile_segment?: string | null;
  context?: Record<string, unknown>;
}

export interface OutcomeRow {
  intervention_id: string;
  competency_id: string | null;
  competency_delta: number;
  ei_delta: number;
  effort_hours: number;
  trajectory_shift?: TrajectoryShift;
}

export interface EffectivenessRow {
  intervention_id: string;
  competency_id: string | null;
  profile_segment: string;
  n_observations: number;
  mean_competency_delta: number;
  mean_ei_delta: number;
  mean_effort_hours: number;
  roi_score: number;
  completion_rate: number;
  confidence_tier: ConfidenceTier;
}

// ── pure math (exported for tests) ─────────────────────────────────────────

export function confidenceTier(n: number): ConfidenceTier {
  if (n >= 100) return 'A';
  if (n >= 30)  return 'B';
  if (n >= 10)  return 'C';
  if (n >= 3)   return 'D';
  return 'provisional';
}

/** Bayesian-shrunken mean toward a global prior — protects against tiny-n bias. */
export function shrunkMean(sampleMean: number, n: number, priorMean: number, priorWeight = 5): number {
  if (n <= 0) return priorMean;
  return (sampleMean * n + priorMean * priorWeight) / (n + priorWeight);
}

export function rollupEffectiveness(
  outcomes: OutcomeRow[],
  opts: { profile_segment?: string; priorRoi?: number } = {},
): EffectivenessRow[] {
  const segment = opts.profile_segment ?? 'global';
  const priorRoi = opts.priorRoi ?? 0.5;
  // Group by (intervention_id, competency_id)
  const groups = new Map<string, OutcomeRow[]>();
  for (const o of outcomes) {
    const k = `${o.intervention_id}::${o.competency_id ?? '_any'}`;
    const arr = groups.get(k) ?? [];
    arr.push(o);
    groups.set(k, arr);
  }
  const rows: EffectivenessRow[] = [];
  for (const [k, arr] of groups) {
    const [intervention_id, compKey] = k.split('::');
    const n = arr.length;
    const meanComp = arr.reduce((a, b) => a + b.competency_delta, 0) / n;
    const meanEi   = arr.reduce((a, b) => a + b.ei_delta, 0) / n;
    const meanEff  = arr.reduce((a, b) => a + b.effort_hours, 0) / n;
    const rawRoi   = meanComp / Math.max(meanEff, 0.5);
    const roi      = shrunkMean(rawRoi, n, priorRoi);
    rows.push({
      intervention_id,
      competency_id: compKey === '_any' ? null : compKey,
      profile_segment: segment,
      n_observations: n,
      mean_competency_delta: round3(meanComp),
      mean_ei_delta: round3(meanEi),
      mean_effort_hours: round2(meanEff),
      roi_score: round4(roi),
      completion_rate: 1,
      confidence_tier: confidenceTier(n),
    });
  }
  return rows.sort((a, b) => b.roi_score - a.roi_score);
}

const round2 = (x: number) => Math.round(x * 100) / 100;
const round3 = (x: number) => Math.round(x * 1000) / 1000;
const round4 = (x: number) => Math.round(x * 10000) / 10000;

// ── DB-backed methods ──────────────────────────────────────────────────────

export async function recordEvent(pool: Pool, e: InterventionEvent): Promise<{ id: number }> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO learn_intervention_events
       (user_id, intervention_id, event_type, recommendation_id, profile_segment, context)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [e.user_id, e.intervention_id, e.event_type, e.recommendation_id ?? null,
     e.profile_segment ?? 'global', JSON.stringify(e.context ?? {})],
  );
  return rows[0];
}

export interface RecordOutcomeArgs {
  user_id: string;
  intervention_id: string;
  competency_id?: string | null;
  baseline_score?: number | null;
  followup_score?: number | null;
  competency_delta?: number | null;
  ei_delta?: number | null;
  trajectory_shift?: TrajectoryShift;
  effort_hours_observed?: number | null;
  baseline_at?: string | null;
  measured_at?: string | null;
  evidence_source?: 'history_diff' | 'self_report' | 'manager_feedback' | 'assessment' | 'synthetic_seed';
  profile_segment?: string;
  context?: Record<string, unknown>;
}

export async function recordOutcome(pool: Pool, args: RecordOutcomeArgs): Promise<{ id: number }> {
  // Auto-derive delta if scores supplied
  const delta = args.competency_delta ??
    (args.baseline_score != null && args.followup_score != null
      ? args.followup_score - args.baseline_score
      : null);
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO learn_outcomes
       (user_id, intervention_id, competency_id, baseline_score, followup_score,
        competency_delta, ei_delta, trajectory_shift, effort_hours_observed,
        baseline_at, measured_at, evidence_source, profile_segment, context)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [args.user_id, args.intervention_id, args.competency_id ?? null,
     args.baseline_score ?? null, args.followup_score ?? null,
     delta, args.ei_delta ?? null, args.trajectory_shift ?? null,
     args.effort_hours_observed ?? null,
     args.baseline_at ?? null, args.measured_at ?? new Date().toISOString(),
     args.evidence_source ?? 'self_report',
     args.profile_segment ?? 'global',
     JSON.stringify(args.context ?? {})],
  );
  return rows[0];
}

export async function getEffectiveness(
  pool: Pool,
  filter: { intervention_id?: string; competency_id?: string; profile_segment?: string },
): Promise<EffectivenessRow[]> {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (filter.intervention_id) { params.push(filter.intervention_id); conds.push(`intervention_id = $${params.length}`); }
  if (filter.competency_id)   { params.push(filter.competency_id);   conds.push(`competency_id = $${params.length}`); }
  if (filter.profile_segment) { params.push(filter.profile_segment); conds.push(`profile_segment = $${params.length}`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const { rows } = await pool.query(`
    SELECT intervention_id, competency_id, profile_segment, n_observations,
           mean_competency_delta::float, mean_ei_delta::float, mean_effort_hours::float,
           roi_score::float, completion_rate::float, confidence_tier
      FROM learn_effectiveness
      ${where}
     ORDER BY roi_score DESC NULLS LAST
     LIMIT 200
  `, params);
  return rows as EffectivenessRow[];
}

/** Refresh the rollup table by re-aggregating raw outcomes. Run on a schedule
 *  or after a batch of new outcomes. Atomic via single TRUNCATE+INSERT txn. */
export async function refreshEffectivenessRollup(pool: Pool): Promise<{ rows: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM learn_effectiveness`);
    const r = await client.query(`
      INSERT INTO learn_effectiveness
        (intervention_id, competency_id, profile_segment, n_observations,
         mean_competency_delta, mean_ei_delta, mean_effort_hours, roi_score,
         completion_rate, confidence_tier, updated_at)
      SELECT
        o.intervention_id, o.competency_id, COALESCE(o.profile_segment,'global'),
        COUNT(*),
        AVG(o.competency_delta),
        AVG(o.ei_delta),
        AVG(o.effort_hours_observed),
        AVG(o.competency_delta) / GREATEST(AVG(o.effort_hours_observed), 0.5),
        COALESCE(
          (SELECT COUNT(*) FILTER (WHERE event_type='completed')::float
                / NULLIF(COUNT(*) FILTER (WHERE event_type='recommended'),0)
             FROM learn_intervention_events e
            WHERE e.intervention_id = o.intervention_id),
          1.0),
        CASE
          WHEN COUNT(*) >= 100 THEN 'A'
          WHEN COUNT(*) >= 30  THEN 'B'
          WHEN COUNT(*) >= 10  THEN 'C'
          WHEN COUNT(*) >= 3   THEN 'D'
          ELSE 'provisional' END,
        NOW()
      FROM learn_outcomes o
      WHERE o.competency_delta IS NOT NULL
      GROUP BY o.intervention_id, o.competency_id, COALESCE(o.profile_segment,'global')
    `);
    await client.query('COMMIT');
    return { rows: r.rowCount ?? 0 };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
