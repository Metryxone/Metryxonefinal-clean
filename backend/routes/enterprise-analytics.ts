import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  ensureEnterpriseAnalyticsSchema,
  refreshAllAnalytics,
  computeKPIs,
  computeCohortAnalysis,
  computeBenchmarkSnapshots,
  computePredictiveFeatures,
  getWarehouseStatus,
} from '../services/enterprise-analytics-schema';
import { isFlagEnabled } from '../config/feature-flags';

// ── Flag guard ──────────────────────────────────────────────────────────────
function flagGuard(res: Response): boolean {
  if (!isFlagEnabled('enterpriseAnalytics')) {
    res.status(503).json({ error: 'Enterprise Analytics not enabled', flag: 'FF_ENTERPRISE_ANALYTICS' });
    return false;
  }
  return true;
}

// ── Schema init (lazy) ──────────────────────────────────────────────────────
let schemaReady = false;
async function ensureSchema(pool: Pool) {
  if (schemaReady) return;
  await ensureEnterpriseAnalyticsSchema(pool);
  schemaReady = true;
}

export function registerEnterpriseAnalyticsRoutes(
  app: Express,
  pool: Pool,
  requireAuth: any,
  requireSuperAdmin: any,
) {
  // ── Lazy schema init on first request ────────────────────────────────────
  app.use('/api/analytics', requireAuth, async (req, res, next) => {
    try { await ensureSchema(pool); next(); }
    catch (e: any) { next(e); }
  });

  // ── GET /api/analytics/status ─────────────────────────────────────────────
  app.get('/api/analytics/status', requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGuard(res)) return;
    try {
      const tables = await getWarehouseStatus(pool);
      const total  = tables.reduce((s, t) => s + t.rows, 0);
      res.json({
        flag_active: true,
        total_rows: total,
        tables,
        generated_at: new Date().toISOString(),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/analytics/refresh ───────────────────────────────────────────
  app.post('/api/analytics/refresh', requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGuard(res)) return;
    try {
      const result = await refreshAllAnalytics(pool);
      const totalRows = Object.values(result.steps).reduce((s, x) => s + x.rows, 0);
      const errors    = Object.entries(result.steps).filter(([, v]) => v.error).map(([k, v]) => `${k}: ${v.error}`);
      res.json({ ...result, total_rows_processed: totalRows, errors });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/analytics/executive ─────────────────────────────────────────
  app.get('/api/analytics/executive', requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGuard(res)) return;
    try {
      const [kpiRows, cohortRows, benchRows, featRows, warehouseRows] = await Promise.all([
        pool.query(`
          SELECT metric_name, metric_value, metric_label FROM anl_kpi_daily
          WHERE dimension='overall' AND dimension_value='all'
          ORDER BY date_key DESC, metric_name
          LIMIT 100
        `).catch(() => ({ rows: [] as any[] })),
        pool.query(`
          SELECT cohort_key, cohort_type, period_offset, period_label,
                 users_in_cohort, active_in_period, retention_rate, avg_score
          FROM anl_cohort_analysis
          ORDER BY cohort_key, period_offset
          LIMIT 500
        `).catch(() => ({ rows: [] as any[] })),
        pool.query(`
          SELECT metric, cohort_segment, p25, p50, p75, mean, stddev, sample_size, suppressed
          FROM anl_benchmark_snapshot
          ORDER BY snapshot_date DESC, metric
          LIMIT 50
        `).catch(() => ({ rows: [] as any[] })),
        pool.query(`
          SELECT
            COUNT(*) AS total_users,
            ROUND(AVG(completion_rate)::numeric, 4) AS avg_completion_rate,
            ROUND(AVG(avg_score)::numeric, 2)       AS avg_score,
            COUNT(*) FILTER (WHERE target_at_risk=TRUE)  AS at_risk,
            COUNT(*) FILTER (WHERE target_high_performer=TRUE) AS high_performers,
            COUNT(*) FILTER (WHERE behaviour_dims_present>0)   AS behaviour_profiled
          FROM anl_predictive_features
          WHERE feature_date = CURRENT_DATE
        `).catch(() => ({ rows: [{}] as any[] })),
        getWarehouseStatus(pool),
      ]);

      // KPI trend sparkline (last 30 days)
      const trendRows = await pool.query(`
        SELECT date_key::text, metric_name, metric_value
        FROM anl_kpi_daily
        WHERE date_key >= CURRENT_DATE - INTERVAL '30 days'
          AND dimension='overall' AND dimension_value='all'
          AND metric_name IN ('total_users','sessions_completed','active_users_7d','avg_score')
        ORDER BY date_key ASC, metric_name
      `).catch(() => ({ rows: [] as any[] }));

      res.json({
        kpis:      kpiRows.rows,
        cohorts:   cohortRows.rows,
        benchmarks: benchRows.rows,
        predictive: featRows.rows[0] ?? {},
        trends:    trendRows.rows,
        warehouse: warehouseRows,
        generated_at: new Date().toISOString(),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/analytics/kpis ───────────────────────────────────────────────
  app.get('/api/analytics/kpis', requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGuard(res)) return;
    try {
      const days  = Math.min(Number(req.query.days) || 30, 365);
      const metric = req.query.metric as string | undefined;
      const { rows } = await pool.query(`
        SELECT date_key::text, metric_name, metric_value, metric_label, dimension, dimension_value
        FROM anl_kpi_daily
        WHERE date_key >= CURRENT_DATE - ($1 || ' days')::interval
          ${metric ? `AND metric_name = $2` : ''}
        ORDER BY date_key DESC, metric_name
        LIMIT 2000
      `, metric ? [days, metric] : [days]).catch(() => ({ rows: [] as any[] }));
      res.json({ rows, days, metric: metric ?? 'all' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/analytics/cohorts ────────────────────────────────────────────
  app.get('/api/analytics/cohorts', requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGuard(res)) return;
    try {
      const type = (req.query.type as string) || 'weekly';
      const { rows } = await pool.query(`
        SELECT ca.cohort_key, ca.period_offset, ca.period_label,
               ca.users_in_cohort, ca.active_in_period, ca.retention_rate::float,
               ca.avg_score, ca.completed_in_period,
               dc.cohort_label, dc.first_entry_date::text
        FROM anl_cohort_analysis ca
        JOIN anl_dim_cohort dc ON dc.cohort_key = ca.cohort_key
        WHERE ca.cohort_type = $1
        ORDER BY dc.first_entry_date DESC, ca.period_offset ASC
        LIMIT 1000
      `, [type]).catch(() => ({ rows: [] as any[] }));
      res.json({ rows, type });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/analytics/benchmarks ────────────────────────────────────────
  app.get('/api/analytics/benchmarks', requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGuard(res)) return;
    try {
      const { rows } = await pool.query(`
        SELECT metric, cohort_segment, p10::float, p25::float, p50::float, p75::float, p90::float,
               mean::float, stddev::float, sample_size, suppressed, min_cohort_size,
               snapshot_date::text, refreshed_at::text
        FROM anl_benchmark_snapshot
        ORDER BY snapshot_date DESC, metric
        LIMIT 200
      `).catch(() => ({ rows: [] as any[] }));
      res.json({ rows, min_cohort_k: 30 });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/analytics/features ──────────────────────────────────────────
  app.get('/api/analytics/features', requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGuard(res)) return;
    try {
      const { rows: summary } = await pool.query(`
        SELECT
          COUNT(*)::integer                                              AS total_users,
          COUNT(*) FILTER (WHERE target_at_risk)::integer               AS at_risk,
          COUNT(*) FILTER (WHERE target_high_performer)::integer        AS high_performers,
          COUNT(*) FILTER (WHERE target_will_complete)::integer         AS likely_to_complete,
          COUNT(*) FILTER (WHERE behaviour_dims_present>0)::integer     AS behaviour_profiled,
          COUNT(*) FILTER (WHERE competency_count>0)::integer           AS competency_profiled,
          ROUND(AVG(completion_rate)::numeric,4)                        AS avg_completion_rate,
          ROUND(AVG(avg_score)::numeric,2)                              AS avg_score,
          ROUND(AVG(motivation)::numeric,3)                             AS avg_motivation,
          ROUND(AVG(confidence)::numeric,3)                             AS avg_confidence,
          ROUND(AVG(engagement)::numeric,3)                             AS avg_engagement,
          ROUND(AVG(adaptability)::numeric,3)                           AS avg_adaptability,
          ROUND(AVG(days_since_last_session)::numeric,1)                AS avg_days_inactive
        FROM anl_predictive_features
        WHERE feature_date = CURRENT_DATE
      `).catch(() => ({ rows: [{}] }));

      const { rows: dist } = await pool.query(`
        SELECT
          CASE
            WHEN last_score IS NULL THEN 'unscored'
            WHEN last_score < 40 THEN 'needs_support'
            WHEN last_score < 60 THEN 'developing'
            WHEN last_score < 75 THEN 'progressing'
            ELSE 'high_performer'
          END AS band,
          COUNT(*)::integer AS n
        FROM anl_predictive_features
        WHERE feature_date = CURRENT_DATE
        GROUP BY 1 ORDER BY 1
      `).catch(() => ({ rows: [] as any[] }));

      res.json({ summary: summary[0] ?? {}, score_distribution: dist, feature_date: new Date().toISOString().slice(0,10) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/analytics/event-lake ────────────────────────────────────────
  app.get('/api/analytics/event-lake', requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGuard(res)) return;
    try {
      const limit  = Math.min(Number(req.query.limit) || 50, 500);
      const offset = Number(req.query.offset) || 0;
      const type   = req.query.type as string | undefined;
      const { rows } = await pool.query(`
        SELECT id, event_type, user_id, session_id, tenant_id, event_at::text, payload
        FROM anl_event_lake
        ${type ? `WHERE event_type = $3` : ''}
        ORDER BY event_at DESC
        LIMIT $1 OFFSET $2
      `, type ? [limit, offset, type] : [limit, offset]).catch(() => ({ rows: [] as any[] }));
      const { rows: ct } = await pool.query(`SELECT COUNT(*) n FROM anl_event_lake ${type ? `WHERE event_type=$1` : ''}`, type ? [type] : []).catch(() => ({ rows: [{ n: 0 }] }));
      res.json({ rows, total: Number(ct[0]?.n ?? 0), limit, offset });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/analytics/events ────────────────────────────────────────────
  app.post('/api/analytics/events', requireAuth, async (req: Request, res: Response) => {
    if (!flagGuard(res)) return;
    try {
      const { event_type, user_id, session_id, tenant_id, payload } = req.body ?? {};
      if (!event_type || typeof event_type !== 'string') {
        return res.status(400).json({ error: 'event_type required' });
      }
      const { rows } = await pool.query(`
        INSERT INTO anl_event_lake (event_type, user_id, session_id, tenant_id, payload)
        VALUES ($1,$2,$3,$4,$5) RETURNING id, event_at::text
      `, [event_type, user_id ?? null, session_id ?? null, tenant_id ?? null, payload ?? {}]);
      res.status(201).json({ id: rows[0].id, event_at: rows[0].event_at });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/analytics/warehouse ─────────────────────────────────────────
  app.get('/api/analytics/warehouse', requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGuard(res)) return;
    try {
      const tables = await getWarehouseStatus(pool);
      const byCategory: Record<string, typeof tables> = {};
      for (const t of tables) {
        if (!byCategory[t.category]) byCategory[t.category] = [];
        byCategory[t.category].push(t);
      }
      res.json({ by_category: byCategory, total_tables: tables.length, total_rows: tables.reduce((s, t) => s + t.rows, 0) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/analytics/refresh/kpis ─────────────────────────────────────
  app.post('/api/analytics/refresh/kpis', requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGuard(res)) return;
    try {
      const n = await computeKPIs(pool);
      res.json({ rows: n, refreshed_at: new Date().toISOString() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /api/analytics/refresh/cohorts ──────────────────────────────────
  app.post('/api/analytics/refresh/cohorts', requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGuard(res)) return;
    try {
      const n = await computeCohortAnalysis(pool);
      res.json({ rows: n, refreshed_at: new Date().toISOString() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /api/analytics/refresh/benchmarks ───────────────────────────────
  app.post('/api/analytics/refresh/benchmarks', requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGuard(res)) return;
    try {
      const n = await computeBenchmarkSnapshots(pool);
      res.json({ rows: n, refreshed_at: new Date().toISOString() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /api/analytics/refresh/features ─────────────────────────────────
  app.post('/api/analytics/refresh/features', requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGuard(res)) return;
    try {
      const n = await computePredictiveFeatures(pool);
      res.json({ rows: n, refreshed_at: new Date().toISOString() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log('[enterprise-analytics] routes registered — /api/analytics/*');
}
