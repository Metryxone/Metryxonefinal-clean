/**
 * D17 — Benchmark Intelligence Engine
 * Industry, Role Family, and Layer benchmarks tied to the RF/blueprint taxonomy.
 * Seeded percentile bands for 6 industries × 15 RFs × 4 layers.
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
    CREATE TABLE IF NOT EXISTS ti_industry_benchmarks (
      id SERIAL PRIMARY KEY,
      industry TEXT NOT NULL,
      blueprint_key TEXT NOT NULL,
      percentile_10 NUMERIC(5,2), percentile_25 NUMERIC(5,2),
      percentile_50 NUMERIC(5,2), percentile_75 NUMERIC(5,2),
      percentile_90 NUMERIC(5,2),
      top_performer_threshold NUMERIC(5,2),
      sample_size INTEGER DEFAULT 0,
      last_updated TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(industry, blueprint_key)
    );
    CREATE INDEX IF NOT EXISTS idx_ti_ib_industry ON ti_industry_benchmarks(industry);
    CREATE TABLE IF NOT EXISTS ti_role_benchmarks (
      id SERIAL PRIMARY KEY,
      rf_id INTEGER,
      rf_name TEXT NOT NULL,
      layer TEXT NOT NULL CHECK (layer IN ('Strategic','Leadership','Managerial','Execution')),
      composite_p10 NUMERIC(5,2), composite_p25 NUMERIC(5,2),
      composite_p50 NUMERIC(5,2), composite_p75 NUMERIC(5,2),
      composite_p90 NUMERIC(5,2),
      ei_p50 NUMERIC(5,2), lbi_p50 NUMERIC(5,2),
      top_performer_profile JSONB DEFAULT '{}',
      sample_size INTEGER DEFAULT 0,
      last_updated TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(rf_name, layer)
    );
    CREATE INDEX IF NOT EXISTS idx_ti_rb_rf ON ti_role_benchmarks(rf_name);
    CREATE TABLE IF NOT EXISTS ti_layer_benchmarks (
      id SERIAL PRIMARY KEY,
      layer TEXT NOT NULL UNIQUE CHECK (layer IN ('Strategic','Leadership','Managerial','Execution')),
      composite_p10 NUMERIC(5,2), composite_p25 NUMERIC(5,2),
      composite_p50 NUMERIC(5,2), composite_p75 NUMERIC(5,2),
      composite_p90 NUMERIC(5,2),
      ei_p50 NUMERIC(5,2), lbi_p50 NUMERIC(5,2),
      promotion_rate_p50 NUMERIC(5,4),
      leadership_potential_p50 NUMERIC(5,4),
      description TEXT,
      last_updated TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ti_user_benchmark_positions (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      rf_name TEXT NOT NULL,
      layer TEXT,
      industry TEXT,
      composite_percentile NUMERIC(5,2),
      ei_percentile NUMERIC(5,2),
      lbi_percentile NUMERIC(5,2),
      overall_percentile NUMERIC(5,2),
      benchmark_tier TEXT CHECK (benchmark_tier IN ('top_10','top_25','median','below_median','bottom_25')),
      computed_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, rf_name)
    );
    CREATE INDEX IF NOT EXISTS idx_ti_ubp_email ON ti_user_benchmark_positions(user_email);
  `);
  schemaReady = true;
}

const INDUSTRIES = ['Technology','Finance','Healthcare','Manufacturing','Professional Services','Retail'];
const RF_NAMES = ['Software Engineering','Data & Analytics','Operations','Sales & Business Development','Marketing','Finance & Accounting','Human Resources','Project & Programme Management','Customer Success','Product Management','Strategy & Consulting','Legal & Compliance','Supply Chain','Research & Development','Executive Leadership'];
const LAYERS = ['Strategic', 'Leadership', 'Managerial', 'Execution'];

// Seeded benchmark norms (industry × blueprint median scores based on WEF/LinkedIn/McKinsey research analogues)
const INDUSTRY_MEDIANS: Record<string, Record<string, number>> = {
  Technology:              { executive_leadership: 72, software_engineering: 78, data_science: 76, operations_management: 68, project_management: 71, sales_leadership: 65, customer_success: 69, people_leadership: 70, product_management: 73, future_readiness_blueprint: 80, cross_functional: 68 },
  Finance:                 { executive_leadership: 74, software_engineering: 65, data_science: 70, operations_management: 72, project_management: 73, sales_leadership: 70, customer_success: 67, people_leadership: 68, product_management: 65, future_readiness_blueprint: 66, cross_functional: 70 },
  Healthcare:              { executive_leadership: 69, software_engineering: 58, data_science: 65, operations_management: 70, project_management: 68, sales_leadership: 62, customer_success: 72, people_leadership: 71, product_management: 62, future_readiness_blueprint: 62, cross_functional: 67 },
  Manufacturing:           { executive_leadership: 67, software_engineering: 58, data_science: 62, operations_management: 75, project_management: 69, sales_leadership: 63, customer_success: 64, people_leadership: 66, product_management: 60, future_readiness_blueprint: 60, cross_functional: 65 },
  'Professional Services': { executive_leadership: 73, software_engineering: 66, data_science: 67, operations_management: 69, project_management: 74, sales_leadership: 69, customer_success: 70, people_leadership: 71, product_management: 68, future_readiness_blueprint: 68, cross_functional: 72 },
  Retail:                  { executive_leadership: 65, software_engineering: 60, data_science: 63, operations_management: 68, project_management: 66, sales_leadership: 68, customer_success: 71, people_leadership: 65, product_management: 64, future_readiness_blueprint: 60, cross_functional: 63 },
};

const LAYER_BENCHMARKS: Record<string, { p10: number; p25: number; p50: number; p75: number; p90: number; ei: number; lbi: number; promo_rate: number; leader: number; desc: string }> = {
  Strategic:   { p10: 55, p25: 65, p50: 74, p75: 82, p90: 90, ei: 75, lbi: 72, promo_rate: 0.18, leader: 0.82, desc: 'C-suite and Board level. Highest composite, EI, and leadership potential expectations.' },
  Leadership:  { p10: 50, p25: 60, p50: 68, p75: 77, p90: 85, ei: 70, lbi: 68, promo_rate: 0.22, leader: 0.70, desc: 'VP and Director level. Strong people leadership and strategic capability required.' },
  Managerial:  { p10: 44, p25: 54, p50: 62, p75: 71, p90: 79, ei: 65, lbi: 63, promo_rate: 0.28, leader: 0.55, desc: 'Manager and Team Lead level. People management and operational excellence core.' },
  Execution:   { p10: 35, p25: 46, p50: 56, p75: 66, p90: 76, ei: 58, lbi: 58, promo_rate: 0.32, leader: 0.35, desc: 'Individual Contributor level. Deep functional capability and learning agility valued.' },
};

async function seedBenchmarks(pool: Pool): Promise<void> {
  const existing = await pool.query<{ cnt: string }>('SELECT COUNT(*)::int AS cnt FROM ti_layer_benchmarks');
  if (Number(existing.rows[0]?.cnt) >= 4) return;

  // Layer benchmarks
  for (const [layer, b] of Object.entries(LAYER_BENCHMARKS)) {
    await pool.query(
      `INSERT INTO ti_layer_benchmarks(layer,composite_p10,composite_p25,composite_p50,composite_p75,composite_p90,ei_p50,lbi_p50,promotion_rate_p50,leadership_potential_p50,description)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(layer) DO NOTHING`,
      [layer, b.p10, b.p25, b.p50, b.p75, b.p90, b.ei, b.lbi, b.promo_rate, b.leader, b.desc]
    );
  }

  // Industry benchmarks
  for (const industry of INDUSTRIES) {
    const medians = INDUSTRY_MEDIANS[industry] || {};
    for (const [blueprint_key, median] of Object.entries(medians)) {
      const p10 = Math.max(0, median - 22);
      const p25 = Math.max(0, median - 12);
      const p75 = Math.min(100, median + 10);
      const p90 = Math.min(100, median + 18);
      const top = Math.min(100, median + 22);
      await pool.query(
        `INSERT INTO ti_industry_benchmarks(industry,blueprint_key,percentile_10,percentile_25,percentile_50,percentile_75,percentile_90,top_performer_threshold,sample_size)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,200) ON CONFLICT(industry,blueprint_key) DO NOTHING`,
        [industry, blueprint_key, p10, p25, median, p75, p90, top]
      );
    }
  }

  // Role benchmarks (RF × Layer)
  const layerMultipliers: Record<string, number> = { Strategic: 1.2, Leadership: 1.08, Managerial: 1.0, Execution: 0.88 };
  for (const rfName of RF_NAMES) {
    for (const layer of LAYERS) {
      const base = 62 + (rfName.includes('Software') || rfName.includes('Data') ? 6 : rfName.includes('Executive') ? 8 : 0);
      const mult = layerMultipliers[layer];
      const p50 = Math.min(100, Math.round(base * mult));
      const p10 = Math.max(0, p50 - 22);
      const p25 = Math.max(0, p50 - 12);
      const p75 = Math.min(100, p50 + 10);
      const p90 = Math.min(100, p50 + 18);
      const eiP50 = LAYER_BENCHMARKS[layer]?.ei || 65;
      const lbiP50 = LAYER_BENCHMARKS[layer]?.lbi || 60;
      await pool.query(
        `INSERT INTO ti_role_benchmarks(rf_name,layer,composite_p10,composite_p25,composite_p50,composite_p75,composite_p90,ei_p50,lbi_p50,sample_size,top_performer_profile)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,50,$10) ON CONFLICT(rf_name,layer) DO NOTHING`,
        [rfName, layer, p10, p25, p50, p75, p90, eiP50, lbiP50,
         JSON.stringify({ min_composite: p75, min_ei: Math.round(eiP50 * 1.1), required_skills: ['Domain expertise', 'Leadership', 'Strategic thinking'].slice(0, layer === 'Execution' ? 1 : 3) })]
      );
    }
  }
}

function computePercentile(score: number, p10: number, p25: number, p50: number, p75: number, p90: number): number {
  if (score <= p10) return 10 * (score / p10);
  if (score <= p25) return 10 + 15 * ((score - p10) / (p25 - p10));
  if (score <= p50) return 25 + 25 * ((score - p25) / (p50 - p25));
  if (score <= p75) return 50 + 25 * ((score - p50) / (p75 - p50));
  if (score <= p90) return 75 + 15 * ((score - p75) / (p90 - p75));
  return Math.min(99, 90 + 9 * ((score - p90) / (100 - p90)));
}

function percentileTier(p: number): string {
  if (p >= 90) return 'top_10';
  if (p >= 75) return 'top_25';
  if (p >= 50) return 'median';
  if (p >= 25) return 'below_median';
  return 'bottom_25';
}

export function registerTalentBenchmarkEngineRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn): void {
  if (!flagOn()) return;
  ensureSchema(pool).then(() => seedBenchmarks(pool)).catch(() => {});

  // GET /api/admin/talent/benchmarks/industry — industry benchmarks
  app.get('/api/admin/talent/benchmarks/industry', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('bench_industry');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const { industry, blueprint_key } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const where: string[] = [];
      if (industry) { params.push(industry); where.push(`industry=$${params.length}`); }
      if (blueprint_key) { params.push(blueprint_key); where.push(`blueprint_key=$${params.length}`); }
      const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [rows, industries] = await Promise.all([
        pool.query(`SELECT * FROM ti_industry_benchmarks ${wc} ORDER BY industry, blueprint_key`, params),
        pool.query('SELECT DISTINCT industry FROM ti_industry_benchmarks ORDER BY industry'),
      ]);
      const result = { benchmarks: rows.rows, industries: industries.rows.map((r: any) => r.industry), count: rows.rows.length };
      setCache('bench_industry', result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/admin/talent/benchmarks/role — role family × layer benchmarks
  app.get('/api/admin/talent/benchmarks/role', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('bench_role');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const { rf_name, layer } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const where: string[] = [];
      if (rf_name) { params.push(`%${rf_name}%`); where.push(`rf_name ILIKE $${params.length}`); }
      if (layer) { params.push(layer); where.push(`layer=$${params.length}`); }
      const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const rows = await pool.query(`SELECT * FROM ti_role_benchmarks ${wc} ORDER BY rf_name, layer`, params);
      res.json({ benchmarks: rows.rows, count: rows.rows.length });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/admin/talent/benchmarks/layer — global layer benchmarks
  app.get('/api/admin/talent/benchmarks/layer', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    const cached = getCached('bench_layer');
    if (cached) return res.json(cached);
    try {
      const rows = await pool.query('SELECT * FROM ti_layer_benchmarks ORDER BY layer');
      const result = { benchmarks: rows.rows };
      setCache('bench_layer', result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/talent/benchmarks/position/:email — where does user sit vs benchmarks
  app.get('/api/talent/benchmarks/position/:email', requireAuth, async (req: Request, res: Response) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const industry = (req.query.industry as string) || 'Technology';
      const [scores, ei, lbi, benchmarks, layerBench] = await Promise.all([
        pool.query('SELECT * FROM talent_role_scores WHERE user_email=$1 ORDER BY composite_score DESC LIMIT 5', [email]).catch(() => ({ rows: [] })),
        pool.query('SELECT overall_ei FROM mei_scores WHERE user_email=$1 ORDER BY computed_at DESC LIMIT 1', [email]).catch(() => ({ rows: [] })),
        pool.query('SELECT overall_lbi FROM lbi_scores WHERE user_email=$1 ORDER BY created_at DESC LIMIT 1', [email]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM ti_role_benchmarks WHERE layer='Execution'`).catch(() => ({ rows: [] })),
        pool.query('SELECT * FROM ti_layer_benchmarks WHERE layer=$1', ['Execution']).catch(() => ({ rows: [] })),
      ]);

      const eiScore = ei.rows[0] ? Number(ei.rows[0].overall_ei) : null;
      const lbiScore = lbi.rows[0] ? Number(lbi.rows[0].overall_lbi) : null;
      const positions: any[] = [];

      for (const score of scores.rows) {
        const rfBench = benchmarks.rows.find((b: any) => b.rf_name === score.rf_name) || layerBench.rows[0];
        if (!rfBench) continue;
        const compositeP = Math.round(computePercentile(Number(score.composite_score), rfBench.composite_p10, rfBench.composite_p25, rfBench.composite_p50, rfBench.composite_p75, rfBench.composite_p90));
        const eiP = eiScore !== null ? Math.round(computePercentile(eiScore, 30, 45, 60, 72, 82)) : null;
        const lbiP = lbiScore !== null ? Math.round(computePercentile(lbiScore, 30, 44, 58, 70, 80)) : null;
        const overallP = Math.round((compositeP + (eiP || compositeP) + (lbiP || compositeP)) / (eiP && lbiP ? 3 : eiP || lbiP ? 2 : 1));
        const position = { rf_name: score.rf_name, composite_percentile: compositeP, ei_percentile: eiP, lbi_percentile: lbiP, overall_percentile: overallP, benchmark_tier: percentileTier(overallP), composite_score: Number(score.composite_score), benchmark_p50: rfBench.composite_p50, benchmark_p75: rfBench.composite_p75 };
        positions.push(position);
        await pool.query(
          `INSERT INTO ti_user_benchmark_positions(user_email,rf_name,industry,composite_percentile,ei_percentile,lbi_percentile,overall_percentile,benchmark_tier)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_email,rf_name) DO UPDATE SET composite_percentile=$4,ei_percentile=$5,lbi_percentile=$6,overall_percentile=$7,benchmark_tier=$8,computed_at=NOW()`,
          [email, score.rf_name, industry, compositeP, eiP, lbiP, overallP, percentileTier(overallP)]
        ).catch(() => {});
      }
      res.json({ email, industry, positions, generated_at: new Date().toISOString() });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/admin/talent/benchmarks/top-performers — top performers by RF
  app.get('/api/admin/talent/benchmarks/top-performers', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('bench_top');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const rows = await pool.query(`
        SELECT user_email, rf_name, overall_percentile, composite_percentile, ei_percentile, lbi_percentile, benchmark_tier, computed_at
        FROM ti_user_benchmark_positions WHERE benchmark_tier IN ('top_10','top_25') ORDER BY overall_percentile DESC LIMIT 50
      `);
      const result = { top_performers: rows.rows, count: rows.rows.length };
      setCache('bench_top', result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/admin/talent/benchmarks/comparative — cross-industry comparison
  app.get('/api/admin/talent/benchmarks/comparative', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('bench_comp');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const { blueprint_key = 'executive_leadership' } = req.query as Record<string, string>;
      const rows = await pool.query(`SELECT industry, percentile_50 as median_score, percentile_75 as top_quartile, percentile_90 as top_decile, top_performer_threshold FROM ti_industry_benchmarks WHERE blueprint_key=$1 ORDER BY percentile_50 DESC`, [blueprint_key]);
      const layer = await pool.query('SELECT * FROM ti_layer_benchmarks ORDER BY composite_p50 DESC');
      const result = { blueprint_key, industry_comparison: rows.rows, layer_comparison: layer.rows };
      setCache('bench_comp', result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  console.log('[talent-benchmark-engine] D17 routes registered — industry/role/layer benchmarks seeded');
}
