/**
 * VX-D15 — Labor Market Intelligence
 * external_skill_demand_master / market_intelligence_master / future_demand_master
 * Skill demand, role demand, salary intelligence, hiring trends, market gap intelligence.
 * Flag-gated FF_CAREER_GRAPH=1. Never-throws. Additive.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

const FLAG = 'FF_CAREER_GRAPH';
const flagOn = () => process.env[FLAG] === '1';
type AuthFn = (req: Request, res: Response, next: () => void) => void;
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 120_000;
const gc = <T>(k: string): T | null => { const e = cache.get(k); return e && Date.now() - e.ts < TTL ? e.data as T : null; };
const sc = (k: string, d: unknown) => cache.set(k, { data: d, ts: Date.now() });

let ready = false;
async function ensureSchema(pool: Pool) {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS external_skill_demand_master (
      id SERIAL PRIMARY KEY,
      skill_name TEXT NOT NULL,
      skill_category TEXT,
      demand_score NUMERIC(5,2) DEFAULT 50.0,
      trend_direction TEXT CHECK (trend_direction IN ('rising','stable','declining','emerging')) DEFAULT 'stable',
      demand_velocity NUMERIC(4,2) DEFAULT 0.0,
      industry_key TEXT,
      role_family_key TEXT,
      data_source TEXT DEFAULT 'metryx_intelligence',
      snapshot_date DATE DEFAULT CURRENT_DATE,
      is_emerging BOOLEAN DEFAULT false,
      ai_impact_score NUMERIC(5,2) DEFAULT 0.0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS market_intelligence_master (
      id SERIAL PRIMARY KEY,
      role_family_key TEXT NOT NULL,
      industry_key TEXT,
      demand_index NUMERIC(5,2) DEFAULT 50.0,
      supply_index NUMERIC(5,2) DEFAULT 50.0,
      market_gap_score NUMERIC(5,2) DEFAULT 0.0,
      competition_intensity TEXT CHECK (competition_intensity IN ('low','moderate','high','fierce')) DEFAULT 'moderate',
      avg_salary_min INTEGER,
      avg_salary_max INTEGER,
      salary_currency TEXT DEFAULT 'INR',
      hiring_trend TEXT CHECK (hiring_trend IN ('strong_growth','moderate_growth','stable','contracting')) DEFAULT 'stable',
      time_to_hire_days INTEGER DEFAULT 30,
      talent_availability TEXT CHECK (talent_availability IN ('abundant','adequate','scarce','critical_shortage')) DEFAULT 'adequate',
      snapshot_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS future_demand_master (
      id SERIAL PRIMARY KEY,
      skill_name TEXT NOT NULL,
      role_family_key TEXT,
      industry_key TEXT,
      horizon_years INTEGER DEFAULT 3,
      predicted_demand_score NUMERIC(5,2) DEFAULT 50.0,
      disruption_risk TEXT CHECK (disruption_risk IN ('low','moderate','high','transformative')) DEFAULT 'moderate',
      opportunity_score NUMERIC(5,2) DEFAULT 50.0,
      automation_displacement_risk NUMERIC(5,2) DEFAULT 25.0,
      ai_augmentation_potential NUMERIC(5,2) DEFAULT 50.0,
      reskilling_difficulty TEXT CHECK (reskilling_difficulty IN ('easy','moderate','hard','expert')) DEFAULT 'moderate',
      strategic_importance TEXT CHECK (strategic_importance IN ('foundational','important','differentiating','critical')) DEFAULT 'important',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_esdm_skill ON external_skill_demand_master(skill_name);
    CREATE INDEX IF NOT EXISTS idx_esdm_trend ON external_skill_demand_master(trend_direction);
    CREATE INDEX IF NOT EXISTS idx_mim_rf ON market_intelligence_master(role_family_key);
    CREATE INDEX IF NOT EXISTS idx_fdm_rf ON future_demand_master(role_family_key);
  `);
  ready = true;
}

const SKILL_DEMAND_SEED = [
  { skill_name: 'Machine Learning Engineering', skill_category: 'AI/Data', demand_score: 94.0, trend_direction: 'rising', demand_velocity: 2.8, industry_key: 'technology', role_family_key: 'data_science', is_emerging: false, ai_impact_score: 85.0 },
  { skill_name: 'Generative AI Application Development', skill_category: 'AI/Data', demand_score: 97.0, trend_direction: 'emerging', demand_velocity: 4.5, industry_key: 'technology', role_family_key: 'software_engineering', is_emerging: true, ai_impact_score: 90.0 },
  { skill_name: 'Data Engineering & Pipelines', skill_category: 'AI/Data', demand_score: 88.0, trend_direction: 'rising', demand_velocity: 2.1, industry_key: 'technology', role_family_key: 'data_science', is_emerging: false, ai_impact_score: 60.0 },
  { skill_name: 'Cloud Architecture (AWS/Azure/GCP)', skill_category: 'Engineering', demand_score: 91.0, trend_direction: 'rising', demand_velocity: 1.8, industry_key: 'technology', role_family_key: 'software_engineering', is_emerging: false, ai_impact_score: 50.0 },
  { skill_name: 'Cybersecurity & Zero-Trust Architecture', skill_category: 'Engineering', demand_score: 89.0, trend_direction: 'rising', demand_velocity: 2.2, industry_key: 'technology', role_family_key: 'software_engineering', is_emerging: false, ai_impact_score: 45.0 },
  { skill_name: 'Strategic Communication & Influence', skill_category: 'Leadership', demand_score: 82.0, trend_direction: 'stable', demand_velocity: 0.5, industry_key: 'all', role_family_key: 'executive_leadership', is_emerging: false, ai_impact_score: 20.0 },
  { skill_name: 'Change Management & Transformation', skill_category: 'Leadership', demand_score: 85.0, trend_direction: 'rising', demand_velocity: 1.2, industry_key: 'all', role_family_key: 'executive_leadership', is_emerging: false, ai_impact_score: 25.0 },
  { skill_name: 'Product-Led Growth Strategy', skill_category: 'Product', demand_score: 87.0, trend_direction: 'rising', demand_velocity: 1.9, industry_key: 'technology', role_family_key: 'product_management', is_emerging: false, ai_impact_score: 40.0 },
  { skill_name: 'Customer Success & Retention Management', skill_category: 'Commercial', demand_score: 83.0, trend_direction: 'stable', demand_velocity: 0.8, industry_key: 'technology', role_family_key: 'customer_success', is_emerging: false, ai_impact_score: 35.0 },
  { skill_name: 'ESG Reporting & Sustainability', skill_category: 'Governance', demand_score: 78.0, trend_direction: 'emerging', demand_velocity: 3.1, industry_key: 'all', role_family_key: 'executive_leadership', is_emerging: true, ai_impact_score: 30.0 },
  { skill_name: 'Prompt Engineering & AI Orchestration', skill_category: 'AI/Data', demand_score: 92.0, trend_direction: 'emerging', demand_velocity: 5.0, industry_key: 'technology', role_family_key: 'software_engineering', is_emerging: true, ai_impact_score: 95.0 },
  { skill_name: 'Coaching & Talent Development', skill_category: 'People', demand_score: 80.0, trend_direction: 'stable', demand_velocity: 0.4, industry_key: 'all', role_family_key: 'people_leadership', is_emerging: false, ai_impact_score: 20.0 },
  { skill_name: 'Statistical Analysis & Causal Inference', skill_category: 'AI/Data', demand_score: 85.0, trend_direction: 'stable', demand_velocity: 0.7, industry_key: 'technology', role_family_key: 'data_science', is_emerging: false, ai_impact_score: 55.0 },
  { skill_name: 'DevSecOps & Platform Engineering', skill_category: 'Engineering', demand_score: 86.0, trend_direction: 'rising', demand_velocity: 1.5, industry_key: 'technology', role_family_key: 'software_engineering', is_emerging: false, ai_impact_score: 40.0 },
  { skill_name: 'Revenue Operations (RevOps)', skill_category: 'Commercial', demand_score: 81.0, trend_direction: 'rising', demand_velocity: 1.4, industry_key: 'technology', role_family_key: 'sales_leadership', is_emerging: false, ai_impact_score: 45.0 },
];

const MARKET_SEED = [
  { role_family_key: 'data_science', industry_key: 'technology', demand_index: 92.0, supply_index: 55.0, market_gap_score: 37.0, competition_intensity: 'fierce', avg_salary_min: 1200000, avg_salary_max: 3500000, hiring_trend: 'strong_growth', time_to_hire_days: 45, talent_availability: 'scarce' },
  { role_family_key: 'software_engineering', industry_key: 'technology', demand_index: 88.0, supply_index: 65.0, market_gap_score: 23.0, competition_intensity: 'high', avg_salary_min: 900000, avg_salary_max: 2800000, hiring_trend: 'strong_growth', time_to_hire_days: 35, talent_availability: 'scarce' },
  { role_family_key: 'executive_leadership', industry_key: 'all', demand_index: 75.0, supply_index: 45.0, market_gap_score: 30.0, competition_intensity: 'fierce', avg_salary_min: 3000000, avg_salary_max: 12000000, hiring_trend: 'moderate_growth', time_to_hire_days: 90, talent_availability: 'critical_shortage' },
  { role_family_key: 'product_management', industry_key: 'technology', demand_index: 85.0, supply_index: 58.0, market_gap_score: 27.0, competition_intensity: 'high', avg_salary_min: 1500000, avg_salary_max: 4000000, hiring_trend: 'strong_growth', time_to_hire_days: 40, talent_availability: 'scarce' },
  { role_family_key: 'people_leadership', industry_key: 'all', demand_index: 72.0, supply_index: 68.0, market_gap_score: 4.0, competition_intensity: 'moderate', avg_salary_min: 1200000, avg_salary_max: 3200000, hiring_trend: 'stable', time_to_hire_days: 30, talent_availability: 'adequate' },
  { role_family_key: 'sales_leadership', industry_key: 'technology', demand_index: 80.0, supply_index: 70.0, market_gap_score: 10.0, competition_intensity: 'high', avg_salary_min: 1000000, avg_salary_max: 3500000, hiring_trend: 'moderate_growth', time_to_hire_days: 25, talent_availability: 'adequate' },
];

const FUTURE_DEMAND_SEED = [
  { skill_name: 'AI Reasoning & Orchestration', role_family_key: 'software_engineering', horizon_years: 3, predicted_demand_score: 98.0, disruption_risk: 'transformative', opportunity_score: 95.0, automation_displacement_risk: 10.0, ai_augmentation_potential: 90.0, reskilling_difficulty: 'hard', strategic_importance: 'critical' },
  { skill_name: 'Autonomous Agent Design', role_family_key: 'software_engineering', horizon_years: 3, predicted_demand_score: 92.0, disruption_risk: 'transformative', opportunity_score: 88.0, automation_displacement_risk: 5.0, ai_augmentation_potential: 85.0, reskilling_difficulty: 'expert', strategic_importance: 'critical' },
  { skill_name: 'Human-AI Teaming Leadership', role_family_key: 'executive_leadership', horizon_years: 3, predicted_demand_score: 88.0, disruption_risk: 'high', opportunity_score: 82.0, automation_displacement_risk: 15.0, ai_augmentation_potential: 70.0, reskilling_difficulty: 'moderate', strategic_importance: 'critical' },
  { skill_name: 'Quantitative ESG Measurement', role_family_key: 'executive_leadership', horizon_years: 5, predicted_demand_score: 85.0, disruption_risk: 'high', opportunity_score: 78.0, automation_displacement_risk: 20.0, ai_augmentation_potential: 60.0, reskilling_difficulty: 'hard', strategic_importance: 'differentiating' },
  { skill_name: 'Multimodal AI Development', role_family_key: 'data_science', horizon_years: 3, predicted_demand_score: 91.0, disruption_risk: 'transformative', opportunity_score: 90.0, automation_displacement_risk: 8.0, ai_augmentation_potential: 88.0, reskilling_difficulty: 'expert', strategic_importance: 'critical' },
  { skill_name: 'Synthetic Data Generation', role_family_key: 'data_science', horizon_years: 3, predicted_demand_score: 82.0, disruption_risk: 'high', opportunity_score: 75.0, automation_displacement_risk: 15.0, ai_augmentation_potential: 80.0, reskilling_difficulty: 'hard', strategic_importance: 'differentiating' },
  { skill_name: 'Neuro-Inclusive Design', role_family_key: 'product_management', horizon_years: 5, predicted_demand_score: 72.0, disruption_risk: 'moderate', opportunity_score: 68.0, automation_displacement_risk: 10.0, ai_augmentation_potential: 40.0, reskilling_difficulty: 'moderate', strategic_importance: 'important' },
  { skill_name: 'Outcome-Based Sales Architecture', role_family_key: 'sales_leadership', horizon_years: 3, predicted_demand_score: 80.0, disruption_risk: 'high', opportunity_score: 76.0, automation_displacement_risk: 30.0, ai_augmentation_potential: 65.0, reskilling_difficulty: 'moderate', strategic_importance: 'differentiating' },
];

export function registerVXLaborMarketIntelligenceRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn) {
  const guard = (req: Request, res: Response, next: () => void) => { if (!flagOn()) return res.status(503).json({ error: `${FLAG} off` }); next(); };
  let seeded = false;
  async function seed() {
    if (seeded) return; await ensureSchema(pool);
    const cnt = await pool.query('SELECT COUNT(*) FROM external_skill_demand_master').catch(() => ({ rows: [{ count: '0' }] }));
    if (Number(cnt.rows[0].count) === 0) {
      for (const s of SKILL_DEMAND_SEED) await pool.query('INSERT INTO external_skill_demand_master(skill_name,skill_category,demand_score,trend_direction,demand_velocity,industry_key,role_family_key,is_emerging,ai_impact_score) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING', [s.skill_name, s.skill_category, s.demand_score, s.trend_direction, s.demand_velocity, s.industry_key, s.role_family_key, s.is_emerging, s.ai_impact_score]).catch(() => null);
      for (const m of MARKET_SEED) await pool.query('INSERT INTO market_intelligence_master(role_family_key,industry_key,demand_index,supply_index,market_gap_score,competition_intensity,avg_salary_min,avg_salary_max,hiring_trend,time_to_hire_days,talent_availability) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING', [m.role_family_key, m.industry_key, m.demand_index, m.supply_index, m.market_gap_score, m.competition_intensity, m.avg_salary_min, m.avg_salary_max, m.hiring_trend, m.time_to_hire_days, m.talent_availability]).catch(() => null);
      for (const f of FUTURE_DEMAND_SEED) await pool.query('INSERT INTO future_demand_master(skill_name,role_family_key,horizon_years,predicted_demand_score,disruption_risk,opportunity_score,automation_displacement_risk,ai_augmentation_potential,reskilling_difficulty,strategic_importance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING', [f.skill_name, f.role_family_key, f.horizon_years, f.predicted_demand_score, f.disruption_risk, f.opportunity_score, f.automation_displacement_risk, f.ai_augmentation_potential, f.reskilling_difficulty, f.strategic_importance]).catch(() => null);
    }
    seeded = true;
  }

  app.get('/api/admin/vx/labor-market/overview', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seed().catch(() => null);
    const cached = gc<unknown>('lm_overview'); if (cached) return res.json(cached);
    try {
      const [skills, market, future] = await Promise.all([
        pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE is_emerging) as emerging, ROUND(AVG(demand_score),1) as avg_demand FROM external_skill_demand_master'),
        pool.query('SELECT COUNT(*) as role_markets, ROUND(AVG(market_gap_score),1) as avg_gap, COUNT(*) FILTER(WHERE talent_availability=\'critical_shortage\') as critical_shortage FROM market_intelligence_master'),
        pool.query('SELECT COUNT(*) as future_skills, COUNT(*) FILTER(WHERE disruption_risk=\'transformative\') as transformative, ROUND(AVG(predicted_demand_score),1) as avg_future_demand FROM future_demand_master'),
      ]);
      const payload = { skill_intelligence: skills.rows[0], market_intelligence: market.rows[0], future_intelligence: future.rows[0] };
      sc('lm_overview', payload); res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/labor-market/skill-demand', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    const cached = gc<unknown>('lm_skill'); if (cached && !req.query.refresh) return res.json(cached);
    try {
      const { trend_direction, role_family_key, is_emerging } = req.query as Record<string, string>;
      const p: unknown[] = []; const w: string[] = [];
      if (trend_direction) { p.push(trend_direction); w.push(`trend_direction=$${p.length}`); }
      if (role_family_key) { p.push(role_family_key); w.push(`role_family_key=$${p.length}`); }
      if (is_emerging === 'true') { w.push('is_emerging=true'); }
      const wc = w.length ? `WHERE ${w.join(' AND ')}` : '';
      const rows = await pool.query(`SELECT * FROM external_skill_demand_master ${wc} ORDER BY demand_score DESC, demand_velocity DESC`, p);
      const payload = { skills: rows.rows, total: rows.rows.length };
      sc('lm_skill', payload); res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/labor-market/market-intelligence', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seed().catch(() => null);
    const cached = gc<unknown>('lm_market'); if (cached) return res.json(cached);
    try {
      const rows = await pool.query('SELECT * FROM market_intelligence_master ORDER BY market_gap_score DESC');
      const payload = { markets: rows.rows, total: rows.rows.length };
      sc('lm_market', payload); res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/labor-market/salary-intelligence', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const rows = await pool.query('SELECT role_family_key, industry_key, avg_salary_min, avg_salary_max, salary_currency, (avg_salary_min+avg_salary_max)/2 as avg_salary_mid, competition_intensity FROM market_intelligence_master ORDER BY avg_salary_max DESC');
      res.json({ salary_intelligence: rows.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/labor-market/hiring-trends', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const rows = await pool.query('SELECT role_family_key, industry_key, hiring_trend, time_to_hire_days, talent_availability, demand_index, supply_index FROM market_intelligence_master ORDER BY demand_index DESC');
      res.json({ hiring_trends: rows.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/labor-market/future-demand', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    const cached = gc<unknown>('lm_future'); if (cached && !req.query.refresh) return res.json(cached);
    try {
      const { horizon_years, disruption_risk } = req.query as Record<string, string>;
      const p: unknown[] = []; const w: string[] = [];
      if (horizon_years) { p.push(parseInt(horizon_years)); w.push(`horizon_years=$${p.length}`); }
      if (disruption_risk) { p.push(disruption_risk); w.push(`disruption_risk=$${p.length}`); }
      const wc = w.length ? `WHERE ${w.join(' AND ')}` : '';
      const rows = await pool.query(`SELECT * FROM future_demand_master ${wc} ORDER BY predicted_demand_score DESC`, p);
      const payload = { future_skills: rows.rows, total: rows.rows.length };
      sc('lm_future', payload); res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/labor-market/market-gaps', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const rows = await pool.query('SELECT role_family_key, industry_key, market_gap_score, demand_index, supply_index, talent_availability, CASE WHEN market_gap_score > 25 THEN \'critical\' WHEN market_gap_score > 15 THEN \'high\' WHEN market_gap_score > 5 THEN \'moderate\' ELSE \'low\' END as gap_severity FROM market_intelligence_master ORDER BY market_gap_score DESC');
      res.json({ market_gaps: rows.rows, critical_gaps: rows.rows.filter((r: any) => r.gap_severity === 'critical').length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log('[vx-labor-market-intelligence] VX-D15 routes registered — skill_demand + market_intelligence + future_demand tables');
}
