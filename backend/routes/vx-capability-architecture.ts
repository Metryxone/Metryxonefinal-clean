/**
 * VX-D3 — Capability Architecture
 * capability_master / capability_cluster_master / capability_dependency_master /
 * capability_relationship_master / capability_weight_master
 * Capabilities: stable, long-lived layer between Role Families and Competencies.
 * Flag-gated FF_CAREER_GRAPH=1. Never-throws. Additive.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

const FLAG = 'FF_CAREER_GRAPH';
const flagOn = () => process.env[FLAG] === '1';
type AuthFn = (req: Request, res: Response, next: () => void) => void;
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 60_000;
const gc = <T>(k: string): T | null => { const e = cache.get(k); return e && Date.now() - e.ts < TTL ? e.data as T : null; };
const sc = (k: string, d: unknown) => cache.set(k, { data: d, ts: Date.now() });
const bc = () => cache.clear();

let ready = false;
async function ensureSchema(pool: Pool) {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS capability_cluster_master (
      id SERIAL PRIMARY KEY,
      cluster_code TEXT UNIQUE NOT NULL,
      cluster_name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS capability_master (
      id SERIAL PRIMARY KEY,
      capability_code TEXT UNIQUE NOT NULL,
      capability_name TEXT NOT NULL,
      cluster_code TEXT REFERENCES capability_cluster_master(cluster_code),
      description TEXT,
      long_lived_relevance TEXT CHECK (long_lived_relevance IN ('permanent','decade','5yr','3yr')) DEFAULT 'decade',
      automation_risk_level TEXT CHECK (automation_risk_level IN ('low','moderate','high')) DEFAULT 'low',
      governance_rules JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS capability_dependency_master (
      id SERIAL PRIMARY KEY,
      from_capability TEXT NOT NULL,
      to_capability TEXT NOT NULL,
      dependency_type TEXT CHECK (dependency_type IN ('prerequisite','enables','enhances','blocks')) DEFAULT 'prerequisite',
      strength NUMERIC(3,2) DEFAULT 0.5,
      UNIQUE(from_capability, to_capability)
    );
    CREATE TABLE IF NOT EXISTS capability_relationship_master (
      id SERIAL PRIMARY KEY,
      capability_code TEXT NOT NULL,
      related_capability_code TEXT NOT NULL,
      relationship_type TEXT CHECK (relationship_type IN ('complementary','substitutable','reinforcing','opposing')) DEFAULT 'complementary',
      strength NUMERIC(3,2) DEFAULT 0.5,
      UNIQUE(capability_code, related_capability_code)
    );
    CREATE TABLE IF NOT EXISTS capability_weight_master (
      id SERIAL PRIMARY KEY,
      capability_code TEXT NOT NULL,
      role_family_code TEXT,
      layer TEXT CHECK (layer IN ('Strategic','Leadership','Managerial','Execution')),
      weight NUMERIC(5,2) DEFAULT 10.0,
      criticality TEXT CHECK (criticality IN ('critical','high','medium','low')) DEFAULT 'high',
      UNIQUE(capability_code, role_family_code, layer)
    );
    CREATE INDEX IF NOT EXISTS idx_cap_cluster ON capability_master(cluster_code);
    CREATE INDEX IF NOT EXISTS idx_cap_dep_from ON capability_dependency_master(from_capability);
    CREATE INDEX IF NOT EXISTS idx_cap_rel_code ON capability_relationship_master(capability_code);
    CREATE INDEX IF NOT EXISTS idx_cap_wt_code ON capability_weight_master(capability_code);
  `);
  ready = true;
}

const CLUSTERS = [
  { cluster_code: 'leadership', cluster_name: 'Leadership & People', description: 'Capabilities related to leading people, teams, and organisations' },
  { cluster_code: 'execution', cluster_name: 'Execution & Delivery', description: 'Capabilities related to getting things done with quality and speed' },
  { cluster_code: 'intelligence', cluster_name: 'Intelligence & Thinking', description: 'Capabilities related to analysis, insight, and strategic thought' },
  { cluster_code: 'customer', cluster_name: 'Customer & Commercial', description: 'Capabilities related to customer value creation and commercial outcomes' },
  { cluster_code: 'innovation', cluster_name: 'Innovation & Future', description: 'Capabilities related to creating new value and navigating the future' },
  { cluster_code: 'digital', cluster_name: 'Digital & Technology', description: 'Capabilities related to technology use, data, and digital transformation' },
];

const CAPABILITIES = [
  { capability_code: 'CAP_STRAT_LEAD', capability_name: 'Strategic Leadership', cluster_code: 'leadership', long_lived_relevance: 'permanent', automation_risk_level: 'low', description: 'The ability to define direction, align people, and lead organisations through complexity and uncertainty.' },
  { capability_code: 'CAP_PEOPLE_LEAD', capability_name: 'People Leadership', cluster_code: 'leadership', long_lived_relevance: 'permanent', automation_risk_level: 'low', description: 'The ability to attract, develop, engage, and retain high-performing teams.' },
  { capability_code: 'CAP_EXEC_EXCEL', capability_name: 'Execution Excellence', cluster_code: 'execution', long_lived_relevance: 'decade', automation_risk_level: 'moderate', description: 'The ability to translate strategy into disciplined, high-quality delivery at pace.' },
  { capability_code: 'CAP_OPS_EXCEL', capability_name: 'Operational Excellence', cluster_code: 'execution', long_lived_relevance: 'decade', automation_risk_level: 'moderate', description: 'The ability to design, optimise, and govern efficient repeatable operations at scale.' },
  { capability_code: 'CAP_CUST_CENT', capability_name: 'Customer Centricity', cluster_code: 'customer', long_lived_relevance: 'permanent', automation_risk_level: 'low', description: 'The ability to understand, serve, and create enduring value for customers across the lifecycle.' },
  { capability_code: 'CAP_COMM_ACUT', capability_name: 'Commercial Acumen', cluster_code: 'customer', long_lived_relevance: 'decade', automation_risk_level: 'low', description: 'The ability to understand commercial models, create revenue, and manage P&L responsibility.' },
  { capability_code: 'CAP_INNOV_EXCEL', capability_name: 'Innovation Excellence', cluster_code: 'innovation', long_lived_relevance: 'permanent', automation_risk_level: 'low', description: 'The ability to generate, test, and scale novel ideas that create disproportionate value.' },
  { capability_code: 'CAP_DIGITAL_FLU', capability_name: 'Digital Fluency', cluster_code: 'digital', long_lived_relevance: '5yr', automation_risk_level: 'moderate', description: 'The ability to leverage digital tools, platforms, and workflows to amplify personal and team effectiveness.' },
  { capability_code: 'CAP_DATA_LIT', capability_name: 'Data Literacy', cluster_code: 'digital', long_lived_relevance: 'decade', automation_risk_level: 'low', description: 'The ability to read, work with, analyse, and argue with data to make better decisions.' },
  { capability_code: 'CAP_CRITICAL_THK', capability_name: 'Critical & Systems Thinking', cluster_code: 'intelligence', long_lived_relevance: 'permanent', automation_risk_level: 'low', description: 'The ability to analyse complex problems, see systemic patterns, and reason carefully under uncertainty.' },
  { capability_code: 'CAP_LEARN_AGIL', capability_name: 'Learning Agility', cluster_code: 'intelligence', long_lived_relevance: 'permanent', automation_risk_level: 'low', description: 'The ability to rapidly acquire new knowledge and skills and apply them in changing contexts.' },
  { capability_code: 'CAP_ADAPT_RESIL', capability_name: 'Adaptive Resilience', cluster_code: 'intelligence', long_lived_relevance: 'permanent', automation_risk_level: 'low', description: 'The ability to remain effective and recover quickly in the face of setbacks, ambiguity, and disruption.' },
];

const DEPENDENCIES = [
  { from_capability: 'CAP_STRAT_LEAD', to_capability: 'CAP_CRITICAL_THK', dependency_type: 'prerequisite', strength: 0.8 },
  { from_capability: 'CAP_STRAT_LEAD', to_capability: 'CAP_PEOPLE_LEAD', dependency_type: 'enables', strength: 0.7 },
  { from_capability: 'CAP_PEOPLE_LEAD', to_capability: 'CAP_ADAPT_RESIL', dependency_type: 'enhances', strength: 0.6 },
  { from_capability: 'CAP_EXEC_EXCEL', to_capability: 'CAP_OPS_EXCEL', dependency_type: 'enables', strength: 0.7 },
  { from_capability: 'CAP_DATA_LIT', to_capability: 'CAP_CRITICAL_THK', dependency_type: 'enhances', strength: 0.7 },
  { from_capability: 'CAP_DIGITAL_FLU', to_capability: 'CAP_DATA_LIT', dependency_type: 'enables', strength: 0.6 },
  { from_capability: 'CAP_LEARN_AGIL', to_capability: 'CAP_INNOV_EXCEL', dependency_type: 'enables', strength: 0.6 },
  { from_capability: 'CAP_ADAPT_RESIL', to_capability: 'CAP_LEARN_AGIL', dependency_type: 'enhances', strength: 0.5 },
];

const WEIGHTS = [
  { capability_code: 'CAP_STRAT_LEAD', role_family_code: 'executive_leadership', layer: 'Strategic', weight: 25.0, criticality: 'critical' },
  { capability_code: 'CAP_PEOPLE_LEAD', role_family_code: 'executive_leadership', layer: 'Strategic', weight: 20.0, criticality: 'critical' },
  { capability_code: 'CAP_CRITICAL_THK', role_family_code: 'executive_leadership', layer: 'Strategic', weight: 15.0, criticality: 'high' },
  { capability_code: 'CAP_EXEC_EXCEL', role_family_code: 'operations_management', layer: 'Managerial', weight: 25.0, criticality: 'critical' },
  { capability_code: 'CAP_OPS_EXCEL', role_family_code: 'operations_management', layer: 'Managerial', weight: 20.0, criticality: 'critical' },
  { capability_code: 'CAP_DATA_LIT', role_family_code: 'data_science', layer: 'Execution', weight: 30.0, criticality: 'critical' },
  { capability_code: 'CAP_DIGITAL_FLU', role_family_code: 'software_engineering', layer: 'Execution', weight: 25.0, criticality: 'critical' },
  { capability_code: 'CAP_CUST_CENT', role_family_code: 'sales_leadership', layer: 'Leadership', weight: 20.0, criticality: 'critical' },
  { capability_code: 'CAP_COMM_ACUT', role_family_code: 'sales_leadership', layer: 'Leadership', weight: 20.0, criticality: 'critical' },
  { capability_code: 'CAP_INNOV_EXCEL', role_family_code: 'product_management', layer: 'Leadership', weight: 20.0, criticality: 'high' },
  { capability_code: 'CAP_LEARN_AGIL', role_family_code: 'future_readiness_blueprint', layer: 'Execution', weight: 25.0, criticality: 'critical' },
  { capability_code: 'CAP_ADAPT_RESIL', role_family_code: 'future_readiness_blueprint', layer: 'Execution', weight: 20.0, criticality: 'high' },
];

export function registerVXCapabilityArchitectureRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn) {
  const guard = (req: Request, res: Response, next: () => void) => { if (!flagOn()) return res.status(503).json({ error: `${FLAG} off` }); next(); };
  let seeded = false;
  async function seed() {
    if (seeded) return; await ensureSchema(pool);
    const cnt = await pool.query('SELECT COUNT(*) FROM capability_master').catch(() => ({ rows: [{ count: '0' }] }));
    if (Number(cnt.rows[0].count) === 0) {
      for (const c of CLUSTERS) await pool.query('INSERT INTO capability_cluster_master(cluster_code,cluster_name,description) VALUES($1,$2,$3) ON CONFLICT(cluster_code) DO NOTHING', [c.cluster_code, c.cluster_name, c.description]).catch(() => null);
      for (const c of CAPABILITIES) await pool.query('INSERT INTO capability_master(capability_code,capability_name,cluster_code,description,long_lived_relevance,automation_risk_level) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(capability_code) DO NOTHING', [c.capability_code, c.capability_name, c.cluster_code, c.description, c.long_lived_relevance, c.automation_risk_level]).catch(() => null);
      for (const d of DEPENDENCIES) await pool.query('INSERT INTO capability_dependency_master(from_capability,to_capability,dependency_type,strength) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [d.from_capability, d.to_capability, d.dependency_type, d.strength]).catch(() => null);
      for (const w of WEIGHTS) await pool.query('INSERT INTO capability_weight_master(capability_code,role_family_code,layer,weight,criticality) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [w.capability_code, w.role_family_code, w.layer, w.weight, w.criticality]).catch(() => null);
    }
    seeded = true;
  }

  app.get('/api/admin/vx/capabilities', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    const cached = gc<unknown>('cap_list'); if (cached && !req.query.refresh) return res.json(cached);
    try {
      const { cluster_code, search, automation_risk_level } = req.query as Record<string, string>;
      const p: unknown[] = []; const w: string[] = ['cm.is_active=true'];
      if (cluster_code) { p.push(cluster_code); w.push(`cm.cluster_code=$${p.length}`); }
      if (automation_risk_level) { p.push(automation_risk_level); w.push(`cm.automation_risk_level=$${p.length}`); }
      if (search) { p.push(`%${search}%`); w.push(`cm.capability_name ILIKE $${p.length}`); }
      const rows = await pool.query(`SELECT cm.*, cc.cluster_name FROM capability_master cm LEFT JOIN capability_cluster_master cc ON cc.cluster_code=cm.cluster_code WHERE ${w.join(' AND ')} ORDER BY cc.cluster_name,cm.capability_name`, p);
      const clusters = await pool.query('SELECT * FROM capability_cluster_master ORDER BY cluster_name');
      const payload = { capabilities: rows.rows, clusters: clusters.rows, total: rows.rows.length };
      sc('cap_list', payload); res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/capabilities/stats', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seed().catch(() => null);
    const cached = gc<unknown>('cap_stats'); if (cached) return res.json(cached);
    try {
      const [total, byCluster, byRisk, deps, weights] = await Promise.all([
        pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE is_active) as active FROM capability_master'),
        pool.query('SELECT cc.cluster_name, COUNT(cm.id) as count FROM capability_master cm LEFT JOIN capability_cluster_master cc ON cc.cluster_code=cm.cluster_code GROUP BY cc.cluster_name ORDER BY count DESC'),
        pool.query('SELECT automation_risk_level, COUNT(*) as count FROM capability_master GROUP BY automation_risk_level'),
        pool.query('SELECT COUNT(*) as dependency_count FROM capability_dependency_master'),
        pool.query('SELECT COUNT(DISTINCT capability_code) as weighted_capabilities, COUNT(*) as weight_entries FROM capability_weight_master'),
      ]);
      const payload = { total: Number(total.rows[0].total), active: Number(total.rows[0].active), by_cluster: byCluster.rows, by_risk: byRisk.rows, dependency_count: Number(deps.rows[0].dependency_count), weight_entries: Number(weights.rows[0].weight_entries) };
      sc('cap_stats', payload); res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/capabilities/:code/dependencies', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const rows = await pool.query('SELECT * FROM capability_dependency_master WHERE from_capability=$1 OR to_capability=$1', [req.params.code]);
      res.json({ capability_code: req.params.code, dependencies: rows.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/capabilities/:code/weights', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const rows = await pool.query('SELECT * FROM capability_weight_master WHERE capability_code=$1 ORDER BY layer', [req.params.code]);
      res.json({ capability_code: req.params.code, weights: rows.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/capabilities/:code', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const [cap, deps, rels, weights] = await Promise.all([
        pool.query('SELECT cm.*, cc.cluster_name FROM capability_master cm LEFT JOIN capability_cluster_master cc ON cc.cluster_code=cm.cluster_code WHERE cm.capability_code=$1', [req.params.code]),
        pool.query('SELECT * FROM capability_dependency_master WHERE from_capability=$1 OR to_capability=$1', [req.params.code]),
        pool.query('SELECT * FROM capability_relationship_master WHERE capability_code=$1', [req.params.code]),
        pool.query('SELECT * FROM capability_weight_master WHERE capability_code=$1', [req.params.code]),
      ]);
      if (!cap.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json({ ...cap.rows[0], dependencies: deps.rows, relationships: rels.rows, weights: weights.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/admin/vx/capabilities', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const { capability_code, capability_name, cluster_code, description, long_lived_relevance = 'decade', automation_risk_level = 'low' } = req.body;
      if (!capability_code || !capability_name) return res.status(400).json({ error: 'capability_code and capability_name required' });
      const row = await pool.query('INSERT INTO capability_master(capability_code,capability_name,cluster_code,description,long_lived_relevance,automation_risk_level) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [capability_code, capability_name, cluster_code, description, long_lived_relevance, automation_risk_level]);
      bc(); res.status(201).json(row.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post('/api/admin/vx/capabilities/weights', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    try {
      const { capability_code, role_family_code, layer, weight, criticality } = req.body;
      const row = await pool.query('INSERT INTO capability_weight_master(capability_code,role_family_code,layer,weight,criticality) VALUES($1,$2,$3,$4,$5) ON CONFLICT(capability_code,role_family_code,layer) DO UPDATE SET weight=$4,criticality=$5 RETURNING *', [capability_code, role_family_code, layer, weight, criticality]);
      bc(); res.json(row.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  console.log('[vx-capability-architecture] VX-D3 routes registered — capability_master + 4 related tables + 12 capabilities');
}
