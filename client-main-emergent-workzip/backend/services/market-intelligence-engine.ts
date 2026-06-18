/**
 * Phase 5 — Market Intelligence persistence + query layer.
 *
 * Stores and serves: job demand · salary shifts · AI disruption · emerging
 * roles · macro labour trends. Ingest is provider-agnostic (any caller can
 * post normalised signals). Read-side aggregates per role/competency/industry.
 */

import type { Pool } from 'pg';

export const MARKET_INTELLIGENCE_VERSION = '5.0.0';

export type MarketSignalType =
  'job_demand' | 'salary_shift' | 'ai_disruption' | 'emerging_role' | 'macro_trend';

export interface MarketSignal {
  signal_type: MarketSignalType;
  role_id?: string | null;
  competency_id?: string | null;
  industry_id?: string | null;
  geography?: string | null;
  metric_value: number;
  metric_unit?: string | null;
  direction?: 'up' | 'down' | 'flat' | 'volatile' | null;
  source?: string;
  confidence?: number;
  captured_at?: string | Date | null;
  context?: Record<string, unknown>;
}

const round = (x: number, p = 4) => Math.round(x * 10 ** p) / 10 ** p;

/** Per-type sane bounds for metric_value. Outliers outside the band are
 *  clamped (not silently dropped) and the original value preserved in context
 *  for audit. Aggregation pipelines stay protected from runaway inputs. */
const METRIC_BOUNDS: Record<MarketSignalType, [number, number]> = {
  job_demand:    [0, 1000],         // index
  salary_shift:  [-100, 500],       // pct_change
  ai_disruption: [0, 1],            // exposure score
  emerging_role: [0, 1000000],      // count-like
  macro_trend:   [-100, 500],       // pct_change
};

function clampMetric(type: MarketSignalType, value: number): { value: number; clamped: boolean } {
  const [lo, hi] = METRIC_BOUNDS[type] ?? [-1e9, 1e9];
  const v = Number.isFinite(value) ? value : 0;
  if (v < lo) return { value: lo, clamped: true };
  if (v > hi) return { value: hi, clamped: true };
  return { value: v, clamped: false };
}

/** Persist a batch of normalised market signals. Returns the inserted ids. */
export async function ingestSignals(
  pool: Pool, signals: MarketSignal[],
): Promise<{ inserted: number; ids: number[]; clamped: number }> {
  if (!signals.length) return { inserted: 0, ids: [], clamped: 0 };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ids: number[] = [];
    let clamped = 0;
    for (const s of signals) {
      const { value: safeValue, clamped: wasClamped } = clampMetric(s.signal_type, s.metric_value);
      if (wasClamped) clamped += 1;
      const ctx = wasClamped
        ? { ...(s.context ?? {}), original_metric_value: s.metric_value, clamped: true }
        : (s.context ?? {});
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO wos_market_signals
           (signal_type, role_id, competency_id, industry_id, geography, metric_value,
            metric_unit, direction, source, confidence, captured_at, context)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, COALESCE($11::date, CURRENT_DATE), $12)
         RETURNING id`,
        [s.signal_type, s.role_id ?? null, s.competency_id ?? null, s.industry_id ?? null,
         s.geography ?? 'global', safeValue, s.metric_unit ?? null,
         s.direction ?? null, s.source ?? 'ingest:api',
         Math.max(0, Math.min(1, s.confidence ?? 0.5)),
         s.captured_at ?? null, JSON.stringify(ctx)],
      );
      ids.push(Number(rows[0].id));
    }
    await client.query('COMMIT');
    return { inserted: ids.length, ids, clamped };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export interface MarketQueryOpts {
  signal_type?: MarketSignalType;
  role_id?: string;
  competency_id?: string;
  industry_id?: string;
  geography?: string;
  since_days?: number;     // default 90
  limit?: number;          // default 100
}

export async function querySignals(pool: Pool, opts: MarketQueryOpts) {
  const where: string[] = [];
  const params: any[] = [];
  // Each call pushes one param and builds the placeholder from its 1-based index,
  // so multiple filters never collide.
  const add = (col: string, val: any) => { params.push(val); where.push(`${col} = $${params.length}`); };
  if (opts.signal_type)   add('signal_type',   opts.signal_type);
  if (opts.role_id)       add('role_id',       opts.role_id);
  if (opts.competency_id) add('competency_id', opts.competency_id);
  if (opts.industry_id)   add('industry_id',   opts.industry_id);
  if (opts.geography)     add('geography',     opts.geography);
  const sinceDays = Math.max(1, Math.min(opts.since_days ?? 90, 730));
  where.push(`captured_at >= CURRENT_DATE - INTERVAL '${sinceDays} days'`);
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
  const sql = `SELECT id, signal_type, role_id, competency_id, industry_id, geography,
                      metric_value::float AS metric_value, metric_unit, direction,
                      source, confidence::float AS confidence, captured_at, context
                 FROM wos_market_signals
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY captured_at DESC, id DESC
                LIMIT ${limit}`;
  const { rows } = await pool.query(sql, params);
  return rows;
}

/** Per-competency disruption summary: mean exposure, recent direction, n. */
export async function competencyDisruptionSummary(pool: Pool) {
  const { rows } = await pool.query(`
    SELECT competency_id,
           AVG(metric_value)::float AS mean_exposure,
           COUNT(*)::int AS observations,
           MAX(captured_at) AS most_recent
      FROM wos_market_signals
     WHERE signal_type = 'ai_disruption' AND competency_id IS NOT NULL
     GROUP BY competency_id
     ORDER BY mean_exposure DESC
  `);
  return rows.map(r => ({ ...r, mean_exposure: round(r.mean_exposure) }));
}

/** Role-level demand momentum: latest metric vs 30-day prior. */
export async function roleDemandMomentum(pool: Pool) {
  const { rows } = await pool.query(`
    WITH latest AS (
      SELECT DISTINCT ON (role_id) role_id, metric_value, captured_at
        FROM wos_market_signals
       WHERE signal_type='job_demand' AND role_id IS NOT NULL
       ORDER BY role_id, captured_at DESC
    ),
    prior AS (
      SELECT DISTINCT ON (role_id) role_id, metric_value
        FROM wos_market_signals
       WHERE signal_type='job_demand' AND role_id IS NOT NULL
         AND captured_at <= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY role_id, captured_at DESC
    )
    SELECT l.role_id,
           l.metric_value::float AS latest,
           p.metric_value::float AS prior_30d,
           CASE WHEN p.metric_value IS NULL OR p.metric_value = 0
                THEN NULL
                ELSE ((l.metric_value - p.metric_value) / p.metric_value)::float
           END AS pct_change_30d,
           l.captured_at
      FROM latest l LEFT JOIN prior p USING (role_id)
     ORDER BY pct_change_30d DESC NULLS LAST
  `);
  return rows.map(r => ({
    role_id: r.role_id,
    latest: round(r.latest, 2),
    prior_30d: r.prior_30d == null ? null : round(r.prior_30d, 2),
    pct_change_30d: r.pct_change_30d == null ? null : round(r.pct_change_30d, 4),
    captured_at: r.captured_at,
  }));
}

export async function emergingRoles(pool: Pool) {
  const { rows } = await pool.query(`
    SELECT id, emerging_role_name, base_role_id, industry_id,
           emergence_score::float AS emergence_score,
           composite_competencies, signals, first_observed_at
      FROM wos_role_emergence
     ORDER BY emergence_score DESC
  `);
  return rows;
}

export async function macroTrends(pool: Pool) {
  const { rows } = await pool.query(`
    SELECT metric_value::float AS metric_value, metric_unit, direction,
           confidence::float AS confidence, captured_at, context
      FROM wos_market_signals
     WHERE signal_type = 'macro_trend'
     ORDER BY captured_at DESC LIMIT 25
  `);
  return rows;
}
