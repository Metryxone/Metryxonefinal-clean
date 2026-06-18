/**
 * D20 — Analytics & Data Platform (Talent Intelligence Warehouse)
 * Fact tables, executive dashboards, predictive analytics KPIs.
 * Additive + flag-gated: FF_CAREER_GRAPH=1. Flag-off → 503. Never throws.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

const FLAG = 'FF_CAREER_GRAPH';
const flagOn = () => process.env[FLAG] === '1';
type AuthFn = (req: Request, res: Response, next: () => void) => void;

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60_000;
const getCached = <T>(k: string): T | null => { const e = cache.get(k); return e && Date.now() - e.ts < CACHE_TTL ? e.data as T : null; };
const setCache = (k: string, d: unknown) => cache.set(k, { data: d, ts: Date.now() });
const bustCache = () => cache.clear();

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ti_fact_assessments (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      assessment_type TEXT NOT NULL,
      assessment_key TEXT,
      score NUMERIC(5,2),
      completion_status TEXT,
      completed_at TIMESTAMPTZ,
      loaded_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ti_fa_email ON ti_fact_assessments(user_email);
    CREATE INDEX IF NOT EXISTS idx_ti_fa_type ON ti_fact_assessments(assessment_type);
    CREATE TABLE IF NOT EXISTS ti_fact_readiness (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      rf_name TEXT,
      readiness_type TEXT,
      readiness_score NUMERIC(5,2),
      readiness_band TEXT,
      success_probability NUMERIC(5,4),
      snapshot_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ti_fr_email ON ti_fact_readiness(user_email);
    CREATE TABLE IF NOT EXISTS ti_talent_kpis (
      id SERIAL PRIMARY KEY,
      kpi_key TEXT NOT NULL UNIQUE,
      kpi_name TEXT NOT NULL,
      kpi_value NUMERIC(12,4),
      kpi_unit TEXT,
      kpi_period TEXT,
      computed_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ti_dim_roles (
      id SERIAL PRIMARY KEY,
      rf_name TEXT NOT NULL UNIQUE,
      layer TEXT,
      industry_relevance TEXT[],
      future_relevance TEXT,
      automation_risk_level TEXT
    );
    CREATE TABLE IF NOT EXISTS ti_dim_time (
      id SERIAL PRIMARY KEY,
      date_key DATE NOT NULL UNIQUE,
      year INTEGER, quarter INTEGER, month INTEGER, week INTEGER,
      day_of_week INTEGER, is_weekday BOOLEAN
    );
  `);
  schemaReady = true;
}

async function loadFactTables(pool: Pool): Promise<{ assessments: number; readiness: number }> {
  // Load assessment facts from source tables
  const [mei, lbi, capadex] = await Promise.all([
    pool.query(`SELECT user_email,'MEI' as assessment_type,'mei_composite' as assessment_key,overall_ei as score,'completed' as completion_status,computed_at as completed_at FROM mei_scores`).catch(() => ({ rows: [] })),
    pool.query(`SELECT user_email,'LBI' as assessment_type,'lbi_composite' as assessment_key,overall_lbi as score,'completed' as completion_status,created_at as completed_at FROM lbi_scores`).catch(() => ({ rows: [] })),
    pool.query(`SELECT guest_email as user_email,'CAPADEX' as assessment_type,stage_code as assessment_key,score,'completed' as completion_status,created_at as completed_at FROM capadex_sessions WHERE status='completed'`).catch(() => ({ rows: [] })),
  ]);
  let assessmentCount = 0;
  for (const row of [...mei.rows, ...lbi.rows, ...capadex.rows]) {
    try {
      await pool.query(`INSERT INTO ti_fact_assessments(user_email,assessment_type,assessment_key,score,completion_status,completed_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [row.user_email, row.assessment_type, row.assessment_key, row.score, row.completion_status, row.completed_at]);
      assessmentCount++;
    } catch { /* skip */ }
  }

  // Load readiness facts
  const readiness = await pool.query(`SELECT user_email,rf_name,readiness_type,readiness_score,readiness_band,success_probability,computed_at as snapshot_at FROM ri_readiness_scores`).catch(() => ({ rows: [] }));
  let readinessCount = 0;
  for (const row of readiness.rows) {
    try {
      await pool.query(`INSERT INTO ti_fact_readiness(user_email,rf_name,readiness_type,readiness_score,readiness_band,success_probability,snapshot_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [row.user_email, row.rf_name, row.readiness_type, row.readiness_score, row.readiness_band, row.success_probability, row.snapshot_at]);
      readinessCount++;
    } catch { /* skip */ }
  }
  return { assessments: assessmentCount, readiness: readinessCount };
}

async function computeKPIs(pool: Pool): Promise<void> {
  const kpis: Array<{ key: string; name: string; unit: string; period: string; query: string }> = [
    { key: 'total_talent_assessed', name: 'Total Talent Assessed', unit: 'users', period: 'all_time', query: `SELECT COUNT(DISTINCT user_email)::numeric FROM talent_role_scores` },
    { key: 'avg_composite_score', name: 'Average Composite Score', unit: 'score_0_100', period: 'all_time', query: `SELECT ROUND(AVG(composite_score)::numeric, 2) FROM talent_role_scores` },
    { key: 'talent_ready_now_rate', name: 'Talent Ready Now Rate', unit: 'percentage', period: 'all_time', query: `SELECT ROUND(COUNT(*) FILTER (WHERE readiness_band='ready_now')::numeric / NULLIF(COUNT(*),0) * 100, 2) FROM ri_readiness_scores WHERE readiness_type='role'` },
    { key: 'avg_promotion_probability', name: 'Average Promotion Probability', unit: 'probability_0_1', period: 'all_time', query: `SELECT ROUND(AVG(promotion_probability)::numeric, 4) FROM ti_outcome_predictions` },
    { key: 'high_potential_count', name: 'High Potential Talent Count', unit: 'users', period: 'all_time', query: `SELECT COUNT(DISTINCT user_email)::numeric FROM ti_outcome_predictions WHERE promotion_probability > 0.65 AND leadership_potential > 0.60` },
    { key: 'talent_at_risk_count', name: 'Talent At Risk Count', unit: 'users', period: 'all_time', query: `SELECT COUNT(DISTINCT user_email)::numeric FROM ti_outcome_predictions WHERE talent_risk > 0.55` },
    { key: 'avg_ei_score', name: 'Average EI Score', unit: 'score_0_100', period: 'all_time', query: `SELECT ROUND(AVG(overall_ei)::numeric, 2) FROM mei_scores` },
    { key: 'avg_lbi_score', name: 'Average LBI Score', unit: 'score_0_100', period: 'all_time', query: `SELECT ROUND(AVG(overall_lbi)::numeric, 2) FROM lbi_scores` },
    { key: 'signal_library_size', name: 'Signal Library Size', unit: 'signals', period: 'static', query: `SELECT COUNT(*)::numeric FROM ti_signal_master` },
    { key: 'competency_dna_records', name: 'Competency DNA Records', unit: 'records', period: 'static', query: `SELECT COUNT(*)::numeric FROM competency_dna_master` },
    { key: 'capadex_completion_rate', name: 'CAPADEX Completion Rate', unit: 'percentage', period: 'all_time', query: `SELECT ROUND(COUNT(*) FILTER (WHERE status='completed')::numeric / NULLIF(COUNT(*),0) * 100, 2) FROM capadex_sessions` },
    { key: 'avg_future_employability', name: 'Average Future Employability', unit: 'probability_0_1', period: 'all_time', query: `SELECT ROUND(AVG(future_employability)::numeric, 4) FROM ti_outcome_predictions` },
  ];
  for (const kpi of kpis) {
    try {
      const result = await pool.query(kpi.query);
      const value = result.rows[0] ? Object.values(result.rows[0])[0] : null;
      if (value !== null) {
        await pool.query(`INSERT INTO ti_talent_kpis(kpi_key,kpi_name,kpi_value,kpi_unit,kpi_period) VALUES($1,$2,$3,$4,$5) ON CONFLICT(kpi_key) DO UPDATE SET kpi_value=$3,computed_at=NOW()`,
          [kpi.key, kpi.name, Number(value), kpi.unit, kpi.period]);
      }
    } catch { /* skip individual KPI errors */ }
  }
}

export function registerTalentAnalyticsWarehouseRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn): void {
  if (!flagOn()) return;
  ensureSchema(pool).catch(() => {});

  // POST /api/admin/talent/warehouse/load — ETL load into fact tables + compute KPIs
  app.post('/api/admin/talent/warehouse/load', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    res.json({ ok: true, message: 'warehouse load started in background' });
    (async () => {
      try {
        const { assessments, readiness } = await loadFactTables(pool);
        await computeKPIs(pool);
        bustCache();
        console.log(`[analytics-warehouse] ETL complete: ${assessments} assessment facts, ${readiness} readiness facts, KPIs computed`);
      } catch (err) { console.error('Warehouse load error:', err); }
    })();
  });

  // POST /api/admin/talent/warehouse/compute-kpis — recompute KPIs only
  app.post('/api/admin/talent/warehouse/compute-kpis', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      await computeKPIs(pool); bustCache();
      const kpis = await pool.query('SELECT * FROM ti_talent_kpis ORDER BY kpi_name');
      res.json({ ok: true, kpis: kpis.rows });
    } catch (err) { res.status(500).json({ error: 'KPI compute failed' }); }
  });

  // GET /api/admin/talent/warehouse/executive-dashboard — main dashboard
  app.get('/api/admin/talent/warehouse/executive-dashboard', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('exec_dashboard');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const [kpis, rfDist, bandDist, topRFs, riskProfile, predictions, trendData] = await Promise.all([
        pool.query('SELECT * FROM ti_talent_kpis ORDER BY kpi_name'),
        pool.query(`SELECT rf_name, COUNT(*) as talent_count, ROUND(AVG(composite_score)::numeric,1) as avg_score FROM talent_role_scores GROUP BY rf_name ORDER BY avg_score DESC LIMIT 15`).catch(() => ({ rows: [] })),
        pool.query(`SELECT readiness_band, COUNT(*) as cnt FROM ri_readiness_scores WHERE readiness_type='role' GROUP BY readiness_band ORDER BY cnt DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT rf_name, ROUND(AVG(composite_score)::numeric,1) as avg_score, COUNT(DISTINCT user_email) as headcount FROM talent_role_scores GROUP BY rf_name ORDER BY avg_score DESC LIMIT 5`).catch(() => ({ rows: [] })),
        pool.query(`SELECT COUNT(*) FILTER (WHERE talent_risk>0.6) as high_risk, COUNT(*) FILTER (WHERE talent_risk>0.4 AND talent_risk<=0.6) as medium_risk, COUNT(*) FILTER (WHERE talent_risk<=0.4) as low_risk FROM ti_outcome_predictions`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT ROUND(AVG(promotion_probability)::numeric,3) as avg_promo, ROUND(AVG(leadership_potential)::numeric,3) as avg_leadership, ROUND(AVG(career_velocity)::numeric,3) as avg_velocity FROM ti_outcome_predictions`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT DATE_TRUNC('month',computed_at) as month, COUNT(*) as assessments FROM talent_role_scores GROUP BY DATE_TRUNC('month',computed_at) ORDER BY month DESC LIMIT 6`).catch(() => ({ rows: [] })),
      ]);

      // Derive insight tags
      const kpiMap = kpis.rows.reduce((m: any, k: any) => { m[k.kpi_key] = Number(k.kpi_value); return m; }, {});
      const insights: string[] = [];
      if (kpiMap.talent_ready_now_rate > 30) insights.push(`${kpiMap.talent_ready_now_rate}% of talent is ready_now — strong pipeline`);
      else if (kpiMap.talent_ready_now_rate < 15) insights.push(`Only ${kpiMap.talent_ready_now_rate}% ready now — investment in development needed`);
      if (kpiMap.talent_at_risk_count > 0) insights.push(`${kpiMap.talent_at_risk_count} talent at flight risk — proactive retention recommended`);
      if (kpiMap.high_potential_count > 0) insights.push(`${kpiMap.high_potential_count} high-potential candidates identified for accelerated development`);

      const result = { kpis: kpis.rows, kpi_map: kpiMap, rf_distribution: rfDist.rows, readiness_band_distribution: bandDist.rows, top_rfs_by_score: topRFs.rows, risk_profile: riskProfile.rows[0], prediction_averages: predictions.rows[0], assessment_trend: trendData.rows, insights };
      setCache('exec_dashboard', result);
      res.json(result);
    } catch (err) { console.error('Executive dashboard error:', err); res.status(500).json({ error: 'dashboard failed' }); }
  });

  // GET /api/admin/talent/warehouse/predictive-analytics — predictions analytics
  app.get('/api/admin/talent/warehouse/predictive-analytics', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('predictive_analytics');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const [overview, rfPredictions, riskSegments, velocityDist, trajectories] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int as total_predicted, ROUND(AVG(promotion_probability)::numeric,3) as avg_promo_prob, ROUND(AVG(role_success_probability)::numeric,3) as avg_success_prob, ROUND(AVG(leadership_potential)::numeric,3) as avg_leadership, ROUND(AVG(future_employability)::numeric,3) as avg_future_emp, ROUND(AVG(talent_risk)::numeric,3) as avg_talent_risk FROM ti_outcome_predictions`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT rf_name, ROUND(AVG(promotion_probability)::numeric,3) as avg_promo, ROUND(AVG(leadership_potential)::numeric,3) as avg_leadership, ROUND(AVG(talent_risk)::numeric,3) as avg_risk, COUNT(*) as headcount FROM ti_outcome_predictions GROUP BY rf_name ORDER BY avg_promo DESC LIMIT 10`).catch(() => ({ rows: [] })),
        pool.query(`SELECT CASE WHEN talent_risk>0.6 THEN 'High Risk' WHEN talent_risk>0.4 THEN 'Medium Risk' ELSE 'Low Risk' END as segment, COUNT(*) as cnt, ROUND(AVG(promotion_probability)::numeric,3) as avg_promo FROM ti_outcome_predictions GROUP BY 1`).catch(() => ({ rows: [] })),
        pool.query(`SELECT CASE WHEN career_velocity>=0.7 THEN 'High Velocity' WHEN career_velocity>=0.5 THEN 'Moderate Velocity' ELSE 'Low Velocity' END as band, COUNT(*) as cnt FROM ti_outcome_predictions GROUP BY 1`).catch(() => ({ rows: [] })),
        pool.query(`SELECT growth_trajectory, COUNT(*) as cnt, ROUND(AVG(predicted_his_12m)::numeric,1) as avg_his_12m FROM tdt_twin_predictions WHERE growth_trajectory IS NOT NULL GROUP BY growth_trajectory ORDER BY cnt DESC`).catch(() => ({ rows: [] })),
      ]);
      const result = { overview: overview.rows[0], rf_predictions: rfPredictions.rows, risk_segments: riskSegments.rows, velocity_distribution: velocityDist.rows, growth_trajectories: trajectories.rows };
      setCache('predictive_analytics', result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'analytics failed' }); }
  });

  // GET /api/admin/talent/warehouse/talent-intelligence — deep talent intelligence report
  app.get('/api/admin/talent/warehouse/talent-intelligence', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('talent_intelligence');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const [signalStats, dnaStats, benchStats, readinessFunnel, successionDepth] = await Promise.all([
        pool.query(`SELECT category, COUNT(*) as count, ROUND(AVG(future_relevance),1) as avg_relevance FROM ti_signal_master GROUP BY category ORDER BY avg_relevance DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT blueprint_key, COUNT(*) as dna_count, COUNT(*) FILTER (WHERE is_foundational) as foundational, ROUND(AVG(development_timeline_weeks)) as avg_dev_weeks FROM competency_dna_master GROUP BY blueprint_key ORDER BY blueprint_key`).catch(() => ({ rows: [] })),
        pool.query(`SELECT layer, composite_p50 as median_score, composite_p75 as top_quartile, composite_p90 as top_decile FROM ti_layer_benchmarks ORDER BY composite_p50 DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT readiness_band, COUNT(*) as cnt, ROUND(AVG(readiness_score)::numeric,1) as avg_score FROM ri_readiness_scores WHERE readiness_type='role' GROUP BY readiness_band ORDER BY avg_score DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT rf_name, COUNT(*) FILTER (WHERE readiness_band IN ('ready_now','ready_6m')) as bench_strength, COUNT(*) as total FROM ri_readiness_scores WHERE readiness_type='promotion' AND rf_name IS NOT NULL GROUP BY rf_name ORDER BY bench_strength DESC LIMIT 10`).catch(() => ({ rows: [] })),
      ]);
      const result = { signal_intelligence: signalStats.rows, competency_dna_coverage: dnaStats.rows, benchmark_norms: benchStats.rows, readiness_funnel: readinessFunnel.rows, succession_bench_strength: successionDepth.rows };
      setCache('talent_intelligence', result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'intelligence report failed' }); }
  });

  // GET /api/admin/talent/warehouse/kpis — current KPI snapshot
  app.get('/api/admin/talent/warehouse/kpis', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('kpis');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const rows = await pool.query('SELECT * FROM ti_talent_kpis ORDER BY kpi_name');
      const result = { kpis: rows.rows, computed_at: rows.rows[0]?.computed_at };
      setCache('kpis', result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/admin/talent/warehouse/fact-tables — warehouse stats
  app.get('/api/admin/talent/warehouse/fact-tables', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const [fa, fr, kpis, dims] = await Promise.all([
        pool.query(`SELECT assessment_type, COUNT(*)::int as rows, ROUND(AVG(score)::numeric,1) as avg_score FROM ti_fact_assessments GROUP BY assessment_type ORDER BY rows DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT readiness_type, COUNT(*)::int as rows, ROUND(AVG(readiness_score)::numeric,1) as avg_score FROM ti_fact_readiness GROUP BY readiness_type ORDER BY rows DESC`).catch(() => ({ rows: [] })),
        pool.query('SELECT COUNT(*)::int as total FROM ti_talent_kpis'),
        pool.query('SELECT COUNT(*)::int as dim_roles FROM ti_dim_roles').catch(() => ({ rows: [{ dim_roles: 0 }] })),
      ]);
      res.json({ fact_assessments: fa.rows, fact_readiness: fr.rows, kpi_count: kpis.rows[0]?.total, dim_counts: dims.rows[0] });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  console.log('[talent-analytics-warehouse] D20 routes registered — fact tables + executive dashboard + predictive analytics');
}
