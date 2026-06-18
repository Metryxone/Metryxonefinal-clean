/**
 * Talent Foundation — Phase 1
 * Role Family Master, Competency Blueprint Master, and Mappings
 * Additive + flag-gated: FF_CAREER_GRAPH=1. Flag-off → 503. Never throws.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

const FLAG = 'FF_CAREER_GRAPH';
const flagOn = () => process.env[FLAG] === '1';
type AuthFn = (req: Request, res: Response, next: () => void) => void;

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rf_master (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        industries TEXT[] DEFAULT '{}',
        layers TEXT[] DEFAULT '{}',
        roles_covered TEXT[] DEFAULT '{}',
        future_relevance TEXT CHECK (future_relevance IN ('critical','high','moderate','low')) DEFAULT 'high',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS rf_role_mapping (
        id SERIAL PRIMARY KEY,
        rf_id INTEGER NOT NULL REFERENCES rf_master(id) ON DELETE CASCADE,
        role_id TEXT NOT NULL,
        role_name TEXT,
        layer TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(rf_id, role_id)
      );
      CREATE TABLE IF NOT EXISTS cb_master (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        applicable_layers TEXT[] DEFAULT '{}',
        applicable_families TEXT[] DEFAULT '{}',
        future_relevance TEXT CHECK (future_relevance IN ('critical','high','moderate','low')) DEFAULT 'high',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS cb_competency_mapping (
        id SERIAL PRIMARY KEY,
        cb_id INTEGER NOT NULL REFERENCES cb_master(id) ON DELETE CASCADE,
        competency_id TEXT NOT NULL,
        competency_name TEXT NOT NULL,
        weight NUMERIC(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
        criticality TEXT CHECK (criticality IN ('essential','important','supporting')) DEFAULT 'important',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(cb_id, competency_id)
      );
      CREATE TABLE IF NOT EXISTS rf_blueprint_mapping (
        id SERIAL PRIMARY KEY,
        rf_id INTEGER NOT NULL REFERENCES rf_master(id) ON DELETE CASCADE,
        cb_id INTEGER NOT NULL REFERENCES cb_master(id) ON DELETE CASCADE,
        weight NUMERIC(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(rf_id, cb_id)
      );
      CREATE INDEX IF NOT EXISTS idx_rf_role_rf_id ON rf_role_mapping(rf_id);
      CREATE INDEX IF NOT EXISTS idx_cb_comp_cb_id ON cb_competency_mapping(cb_id);
      CREATE INDEX IF NOT EXISTS idx_rf_bp_rf_id   ON rf_blueprint_mapping(rf_id);
    `);
    schemaReady = true;
    console.log('[talent-foundation] schema ready');
    await seedData(pool);
  } catch (e) {
    console.error('[talent-foundation] ensureSchema error:', e);
  }
}

async function seedData(pool: Pool): Promise<void> {
  try {
    const { rows: ex } = await pool.query('SELECT COUNT(*) FROM rf_master');
    if (Number(ex[0].count) > 0) return;

    const rfs: Array<[string, string, string[], string[], string]> = [
      ['Software Engineering', 'Roles focused on designing, building, and maintaining software systems.', ['Technology','Financial Services','E-commerce','Healthcare'], ['Execution','Managerial','Leadership'], 'critical'],
      ['Data Science & Analytics', 'Roles extracting insights from data to drive decisions and build predictive models.', ['Technology','Financial Services','Retail','Healthcare'], ['Execution','Managerial','Leadership'], 'critical'],
      ['Product Management', 'Roles owning product strategy, roadmap, and cross-functional delivery.', ['Technology','E-commerce','SaaS','Consumer Goods'], ['Execution','Managerial','Leadership'], 'critical'],
      ['Sales Leadership', 'Roles generating revenue through acquisition, pipeline management, and team leadership.', ['Technology','Financial Services','Manufacturing','Retail'], ['Execution','Managerial','Leadership'], 'high'],
      ['Customer Success', 'Roles ensuring customers achieve desired outcomes and maximising retention.', ['Technology','SaaS','Financial Services'], ['Execution','Managerial'], 'high'],
      ['Operations Management', 'Roles planning, directing, and coordinating operational activities for efficiency.', ['Manufacturing','Logistics','Retail','Healthcare'], ['Execution','Managerial','Leadership'], 'high'],
      ['Finance & Accounting', 'Roles governing financial planning, reporting, compliance, and capital allocation.', ['Financial Services','Manufacturing','Healthcare','Technology'], ['Execution','Managerial','Leadership'], 'moderate'],
      ['Human Resources & People', 'Roles attracting, developing, and retaining talent and shaping organisational culture.', ['All Industries'], ['Execution','Managerial','Leadership'], 'high'],
      ['Marketing & Growth', 'Roles responsible for brand, demand generation, and customer growth strategies.', ['Technology','Consumer Goods','Retail','Financial Services'], ['Execution','Managerial','Leadership'], 'high'],
      ['Executive Leadership', 'C-suite and senior leadership roles responsible for organisational strategy and governance.', ['All Industries'], ['Strategic','Leadership'], 'critical'],
      ['Manufacturing Operations', 'Roles overseeing production, quality, and supply chain in manufacturing environments.', ['Manufacturing','Automotive','Consumer Goods','Pharmaceuticals'], ['Execution','Managerial'], 'moderate'],
      ['Project & Programme Management', 'Roles delivering complex initiatives on time, within scope, and on budget.', ['Technology','Construction','Financial Services','Healthcare'], ['Execution','Managerial','Leadership'], 'high'],
      ['Legal & Compliance', 'Roles ensuring legal risk management, regulatory compliance, and corporate governance.', ['Financial Services','Healthcare','Technology','Energy'], ['Execution','Managerial','Leadership'], 'moderate'],
      ['Research & Innovation', 'Roles driving scientific research, R&D, and innovation strategy.', ['Pharmaceuticals','Technology','Healthcare','Energy'], ['Execution','Managerial','Leadership'], 'critical'],
      ['Healthcare Clinical', 'Clinical roles delivering patient care, diagnosis, and treatment.', ['Healthcare','Pharmaceuticals'], ['Execution','Managerial'], 'critical'],
    ];
    for (const [name, desc, ind, layers, fr] of rfs) {
      await pool.query(
        `INSERT INTO rf_master(name,description,industries,layers,future_relevance) VALUES($1,$2,$3,$4,$5) ON CONFLICT(name) DO NOTHING`,
        [name, desc, ind, layers, fr]
      );
    }

    const cbs: Array<[string, string, string[], string]> = [
      ['Executive Leadership', 'Strategic vision, enterprise governance, stakeholder influence, and organisational transformation.', ['Strategic','Leadership'], 'critical'],
      ['People Leadership', 'Team building, coaching, performance management, and inclusive culture development.', ['Managerial','Leadership'], 'critical'],
      ['Technical Engineering', 'Software architecture, engineering excellence, code quality, and systems design.', ['Execution','Managerial'], 'critical'],
      ['Data & Analytics', 'Statistical analysis, machine learning, data storytelling, and insight-driven decision making.', ['Execution','Managerial'], 'critical'],
      ['Sales & Revenue Growth', 'Pipeline management, consultative selling, negotiation, and revenue forecasting.', ['Execution','Managerial','Leadership'], 'high'],
      ['Customer Excellence', 'Customer relationship management, success planning, and churn prevention.', ['Execution','Managerial'], 'high'],
      ['Operations Excellence', 'Process optimisation, lean management, quality systems, and operational KPIs.', ['Execution','Managerial','Leadership'], 'high'],
      ['Project Delivery', 'Project planning, risk management, stakeholder communication, and delivery governance.', ['Execution','Managerial'], 'high'],
      ['Finance & Control', 'Financial modelling, budgeting, regulatory reporting, and capital management.', ['Execution','Managerial','Leadership'], 'moderate'],
      ['Marketing & Brand', 'Brand strategy, content, demand generation, and market positioning.', ['Execution','Managerial','Leadership'], 'high'],
      ['Innovation & Strategy', 'Strategic thinking, business model innovation, market analysis, and future-proofing.', ['Leadership','Strategic'], 'critical'],
      ['Compliance & Risk', 'Regulatory compliance, risk frameworks, governance, and legal risk management.', ['Execution','Managerial','Leadership'], 'moderate'],
    ];
    for (const [name, desc, layers, fr] of cbs) {
      await pool.query(
        `INSERT INTO cb_master(name,description,applicable_layers,future_relevance) VALUES($1,$2,$3,$4) ON CONFLICT(name) DO NOTHING`,
        [name, desc, layers, fr]
      );
    }

    const { rows: rfR } = await pool.query('SELECT id,name FROM rf_master');
    const { rows: cbR } = await pool.query('SELECT id,name FROM cb_master');
    const rfM: Record<string, number> = {};
    rfR.forEach((r: any) => { rfM[r.name] = r.id; });
    const cbM: Record<string, number> = {};
    cbR.forEach((r: any) => { cbM[r.name] = r.id; });

    const rfBP: Array<[string, Array<[string, number, boolean]>]> = [
      ['Software Engineering',          [['Technical Engineering',50,true],['Project Delivery',25,false],['Innovation & Strategy',15,false],['People Leadership',10,false]]],
      ['Data Science & Analytics',       [['Data & Analytics',55,true],['Technical Engineering',25,false],['Innovation & Strategy',20,false]]],
      ['Product Management',             [['Innovation & Strategy',35,true],['Data & Analytics',25,false],['People Leadership',20,false],['Marketing & Brand',20,false]]],
      ['Sales Leadership',               [['Sales & Revenue Growth',60,true],['People Leadership',25,false],['Customer Excellence',15,false]]],
      ['Customer Success',               [['Customer Excellence',55,true],['Sales & Revenue Growth',25,false],['Data & Analytics',20,false]]],
      ['Operations Management',          [['Operations Excellence',50,true],['People Leadership',30,false],['Finance & Control',20,false]]],
      ['Finance & Accounting',           [['Finance & Control',60,true],['Compliance & Risk',25,false],['Data & Analytics',15,false]]],
      ['Human Resources & People',       [['People Leadership',50,true],['Innovation & Strategy',25,false],['Compliance & Risk',25,false]]],
      ['Marketing & Growth',             [['Marketing & Brand',55,true],['Data & Analytics',25,false],['Innovation & Strategy',20,false]]],
      ['Executive Leadership',           [['Executive Leadership',40,true],['People Leadership',30,false],['Innovation & Strategy',30,false]]],
      ['Manufacturing Operations',       [['Operations Excellence',55,true],['Compliance & Risk',25,false],['People Leadership',20,false]]],
      ['Project & Programme Management', [['Project Delivery',60,true],['People Leadership',25,false],['Finance & Control',15,false]]],
      ['Legal & Compliance',             [['Compliance & Risk',65,true],['Innovation & Strategy',20,false],['People Leadership',15,false]]],
      ['Research & Innovation',          [['Innovation & Strategy',45,true],['Data & Analytics',35,false],['Technical Engineering',20,false]]],
      ['Healthcare Clinical',            [['Operations Excellence',40,true],['Compliance & Risk',35,false],['People Leadership',25,false]]],
    ];
    for (const [rfName, bps] of rfBP) {
      const rfId = rfM[rfName];
      if (!rfId) continue;
      for (const [cbName, w, isPrimary] of bps) {
        const cbId = cbM[cbName];
        if (!cbId) continue;
        await pool.query(
          `INSERT INTO rf_blueprint_mapping(rf_id,cb_id,weight,is_primary) VALUES($1,$2,$3,$4) ON CONFLICT(rf_id,cb_id) DO NOTHING`,
          [rfId, cbId, w, isPrimary]
        );
      }
    }

    const compMap: Array<[string, Array<[string, string, number, string]>]> = [
      ['Executive Leadership',  [['strategic_vision','Strategic Vision',30,'essential'],['enterprise_governance','Enterprise Governance',25,'essential'],['stakeholder_influence','Stakeholder Influence',25,'essential'],['org_transformation','Organisational Transformation',20,'important']]],
      ['People Leadership',     [['team_development','Team Development & Coaching',35,'essential'],['performance_management','Performance Management',30,'essential'],['inclusive_culture','Inclusive Culture',20,'important'],['conflict_resolution','Conflict Resolution',15,'important']]],
      ['Technical Engineering', [['software_architecture','Software Architecture',30,'essential'],['engineering_excellence','Engineering Excellence',30,'essential'],['systems_design','Systems Design',25,'essential'],['technical_problem_solving','Technical Problem Solving',15,'important']]],
      ['Data & Analytics',      [['statistical_analysis','Statistical Analysis',30,'essential'],['machine_learning','Machine Learning',30,'essential'],['data_storytelling','Data Storytelling',25,'important'],['data_governance','Data Governance',15,'supporting']]],
      ['Sales & Revenue Growth',[['consultative_selling','Consultative Selling',35,'essential'],['pipeline_management','Pipeline Management',30,'essential'],['negotiation','Negotiation',20,'important'],['revenue_forecasting','Revenue Forecasting',15,'supporting']]],
      ['Customer Excellence',   [['customer_relationship','Customer Relationship Management',40,'essential'],['success_planning','Success Planning',30,'essential'],['churn_prevention','Churn Prevention',20,'important'],['product_adoption','Product Adoption',10,'supporting']]],
      ['Operations Excellence', [['process_optimisation','Process Optimisation',35,'essential'],['lean_management','Lean Management',30,'essential'],['quality_systems','Quality Systems',20,'important'],['operational_kpis','Operational KPIs',15,'supporting']]],
      ['Project Delivery',      [['project_planning','Project Planning',30,'essential'],['risk_management','Risk Management',30,'essential'],['stakeholder_communication','Stakeholder Communication',25,'important'],['delivery_governance','Delivery Governance',15,'supporting']]],
      ['Finance & Control',     [['financial_modelling','Financial Modelling',30,'essential'],['budgeting','Budgeting & Forecasting',30,'essential'],['regulatory_reporting','Regulatory Reporting',25,'important'],['capital_management','Capital Management',15,'supporting']]],
      ['Marketing & Brand',     [['brand_strategy','Brand Strategy',30,'essential'],['content_strategy','Content Strategy',25,'important'],['demand_generation','Demand Generation',25,'essential'],['market_positioning','Market Positioning',20,'important']]],
      ['Innovation & Strategy', [['strategic_thinking','Strategic Thinking',35,'essential'],['biz_model_innovation','Business Model Innovation',30,'essential'],['market_analysis','Market Analysis',20,'important'],['future_proofing','Future Proofing',15,'supporting']]],
      ['Compliance & Risk',     [['regulatory_compliance','Regulatory Compliance',35,'essential'],['risk_frameworks','Risk Frameworks',30,'essential'],['governance_controls','Governance & Controls',25,'important'],['legal_risk','Legal Risk Management',10,'supporting']]],
    ];
    for (const [cbName, comps] of compMap) {
      const cbId = cbM[cbName];
      if (!cbId) continue;
      for (const [cid, cname, w, crit] of comps) {
        await pool.query(
          `INSERT INTO cb_competency_mapping(cb_id,competency_id,competency_name,weight,criticality) VALUES($1,$2,$3,$4,$5) ON CONFLICT(cb_id,competency_id) DO NOTHING`,
          [cbId, cid, cname, w, crit]
        );
      }
    }
    console.log('[talent-foundation] seed complete — 15 role families, 12 blueprints');
  } catch (e) {
    console.error('[talent-foundation] seed error:', e);
  }
}

function gate(res: Response): boolean {
  if (!flagOn()) {
    res.status(503).json({ error: 'Feature not enabled' });
    return false;
  }
  return true;
}

export function registerTalentFoundationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: AuthFn,
  requireSuperAdmin: AuthFn
): void {
  app.use(async (_req, _res, next) => {
    await ensureSchema(pool);
    next();
  });

  // ── User reads ─────────────────────────────────────────────────────────────
  app.get('/api/talent/role-families', requireAuth, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { rows } = await pool.query(`
        SELECT rf.*,
          COUNT(DISTINCT rrm.id)::int AS role_count,
          COUNT(DISTINCT rbm.id)::int  AS blueprint_count
        FROM rf_master rf
        LEFT JOIN rf_role_mapping rrm ON rrm.rf_id = rf.id
        LEFT JOIN rf_blueprint_mapping rbm ON rbm.rf_id = rf.id
        WHERE rf.is_active = true
        GROUP BY rf.id
        ORDER BY rf.name
      `);
      res.json(rows);
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/talent/role-families/:id', requireAuth, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return void res.status(400).json({ error: 'Invalid id' });
      const { rows: rf } = await pool.query('SELECT * FROM rf_master WHERE id=$1', [id]);
      if (!rf.length) return void res.status(404).json({ error: 'Not found' });
      const [{ rows: roles }, { rows: bps }] = await Promise.all([
        pool.query('SELECT * FROM rf_role_mapping WHERE rf_id=$1 ORDER BY role_name', [id]),
        pool.query(`SELECT rbm.*, cb.name AS blueprint_name FROM rf_blueprint_mapping rbm JOIN cb_master cb ON cb.id=rbm.cb_id WHERE rbm.rf_id=$1 ORDER BY rbm.weight DESC`, [id]),
      ]);
      res.json({ ...rf[0], roles, blueprints: bps });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/talent/blueprints', requireAuth, async (_req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { rows } = await pool.query(`
        SELECT cb.*,
          COUNT(ccm.id)::int             AS competency_count,
          COALESCE(SUM(ccm.weight),0)::numeric AS weight_total
        FROM cb_master cb
        LEFT JOIN cb_competency_mapping ccm ON ccm.cb_id = cb.id
        WHERE cb.is_active = true
        GROUP BY cb.id
        ORDER BY cb.name
      `);
      res.json(rows);
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/talent/blueprints/:id', requireAuth, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return void res.status(400).json({ error: 'Invalid id' });
      const { rows: cb } = await pool.query('SELECT * FROM cb_master WHERE id=$1', [id]);
      if (!cb.length) return void res.status(404).json({ error: 'Not found' });
      const { rows: comps } = await pool.query('SELECT * FROM cb_competency_mapping WHERE cb_id=$1 ORDER BY weight DESC', [id]);
      res.json({ ...cb[0], competencies: comps });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  // ── Admin — Role Families ──────────────────────────────────────────────────
  app.get('/api/admin/talent/role-families', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const s = (req.query.search as string) || '';
      const { rows } = await pool.query(`
        SELECT rf.*,
          COUNT(DISTINCT rrm.id)::int AS role_count,
          COUNT(DISTINCT rbm.id)::int  AS blueprint_count
        FROM rf_master rf
        LEFT JOIN rf_role_mapping rrm ON rrm.rf_id = rf.id
        LEFT JOIN rf_blueprint_mapping rbm ON rbm.rf_id = rf.id
        WHERE ($1 = '' OR rf.name ILIKE '%'||$1||'%' OR rf.description ILIKE '%'||$1||'%')
        GROUP BY rf.id
        ORDER BY rf.name
      `, [s]);
      res.json(rows);
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/admin/talent/role-families', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { name, description, industries, layers, roles_covered, future_relevance } = req.body;
      if (!name?.trim()) return void res.status(400).json({ error: 'name required' });
      const { rows } = await pool.query(
        `INSERT INTO rf_master(name,description,industries,layers,roles_covered,future_relevance) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [name.trim(), description || '', industries || [], layers || [], roles_covered || [], future_relevance || 'high']
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e.code === '23505') return void res.status(409).json({ error: 'Name already exists' });
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.put('/api/admin/talent/role-families/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return void res.status(400).json({ error: 'Invalid id' });
      const { name, description, industries, layers, roles_covered, future_relevance, is_active } = req.body;
      const { rows } = await pool.query(
        `UPDATE rf_master SET name=$1,description=$2,industries=$3,layers=$4,roles_covered=$5,future_relevance=$6,is_active=$7,updated_at=NOW() WHERE id=$8 RETURNING *`,
        [name, description, industries || [], layers || [], roles_covered || [], future_relevance || 'high', is_active !== false, id]
      );
      if (!rows.length) return void res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch (e: any) {
      if (e.code === '23505') return void res.status(409).json({ error: 'Name already exists' });
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.delete('/api/admin/talent/role-families/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return void res.status(400).json({ error: 'Invalid id' });
      await pool.query('DELETE FROM rf_master WHERE id=$1', [id]);
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/admin/talent/role-families/:id/roles', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { rows } = await pool.query('SELECT * FROM rf_role_mapping WHERE rf_id=$1 ORDER BY role_name', [parseInt(req.params.id)]);
      res.json(rows);
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/admin/talent/role-families/:id/roles', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const rf_id = parseInt(req.params.id);
      const { role_id, role_name, layer } = req.body;
      if (!role_id) return void res.status(400).json({ error: 'role_id required' });
      const { rows } = await pool.query(
        `INSERT INTO rf_role_mapping(rf_id,role_id,role_name,layer) VALUES($1,$2,$3,$4) ON CONFLICT(rf_id,role_id) DO UPDATE SET role_name=$3,layer=$4 RETURNING *`,
        [rf_id, role_id, role_name || role_id, layer || '']
      );
      res.status(201).json(rows[0]);
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/admin/talent/role-families/:rfId/roles/:roleId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      await pool.query('DELETE FROM rf_role_mapping WHERE rf_id=$1 AND role_id=$2', [req.params.rfId, req.params.roleId]);
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/admin/talent/role-families/:id/blueprints', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const id = parseInt(req.params.id);
      const { rows } = await pool.query(`
        SELECT rbm.*, cb.name AS blueprint_name, cb.description AS blueprint_description, cb.future_relevance AS blueprint_future_relevance
        FROM rf_blueprint_mapping rbm
        JOIN cb_master cb ON cb.id = rbm.cb_id
        WHERE rbm.rf_id = $1
        ORDER BY rbm.weight DESC
      `, [id]);
      res.json({ blueprints: rows, weight_total: rows.reduce((s: number, r: any) => s + Number(r.weight), 0) });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/admin/talent/role-families/:id/blueprints', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const rf_id = parseInt(req.params.id);
      const { cb_id, weight, is_primary } = req.body;
      if (!cb_id || !weight) return void res.status(400).json({ error: 'cb_id and weight required' });
      const { rows: ex } = await pool.query('SELECT COALESCE(SUM(weight),0)::numeric AS total FROM rf_blueprint_mapping WHERE rf_id=$1', [rf_id]);
      if (Number(ex[0].total) + Number(weight) > 100) {
        return void res.status(400).json({ error: `Would exceed 100% (current ${ex[0].total}%)` });
      }
      const { rows } = await pool.query(
        `INSERT INTO rf_blueprint_mapping(rf_id,cb_id,weight,is_primary) VALUES($1,$2,$3,$4) ON CONFLICT(rf_id,cb_id) DO UPDATE SET weight=$3,is_primary=$4 RETURNING *`,
        [rf_id, cb_id, weight, is_primary || false]
      );
      res.status(201).json(rows[0]);
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/admin/talent/role-families/:rfId/blueprints/:cbId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      await pool.query('DELETE FROM rf_blueprint_mapping WHERE rf_id=$1 AND cb_id=$2', [req.params.rfId, req.params.cbId]);
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  // ── Admin — Competency Blueprints ──────────────────────────────────────────
  app.get('/api/admin/talent/blueprints', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const s = (req.query.search as string) || '';
      const { rows } = await pool.query(`
        SELECT cb.*,
          COUNT(ccm.id)::int             AS competency_count,
          COALESCE(SUM(ccm.weight),0)::numeric AS weight_total
        FROM cb_master cb
        LEFT JOIN cb_competency_mapping ccm ON ccm.cb_id = cb.id
        WHERE ($1 = '' OR cb.name ILIKE '%'||$1||'%' OR cb.description ILIKE '%'||$1||'%')
        GROUP BY cb.id
        ORDER BY cb.name
      `, [s]);
      res.json(rows);
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/admin/talent/blueprints', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { name, description, applicable_layers, applicable_families, future_relevance } = req.body;
      if (!name?.trim()) return void res.status(400).json({ error: 'name required' });
      const { rows } = await pool.query(
        `INSERT INTO cb_master(name,description,applicable_layers,applicable_families,future_relevance) VALUES($1,$2,$3,$4,$5) RETURNING *`,
        [name.trim(), description || '', applicable_layers || [], applicable_families || [], future_relevance || 'high']
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e.code === '23505') return void res.status(409).json({ error: 'Name already exists' });
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.put('/api/admin/talent/blueprints/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return void res.status(400).json({ error: 'Invalid id' });
      const { name, description, applicable_layers, applicable_families, future_relevance, is_active } = req.body;
      const { rows } = await pool.query(
        `UPDATE cb_master SET name=$1,description=$2,applicable_layers=$3,applicable_families=$4,future_relevance=$5,is_active=$6,updated_at=NOW() WHERE id=$7 RETURNING *`,
        [name, description, applicable_layers || [], applicable_families || [], future_relevance || 'high', is_active !== false, id]
      );
      if (!rows.length) return void res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch (e: any) {
      if (e.code === '23505') return void res.status(409).json({ error: 'Name already exists' });
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.delete('/api/admin/talent/blueprints/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return void res.status(400).json({ error: 'Invalid id' });
      await pool.query('DELETE FROM cb_master WHERE id=$1', [id]);
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/admin/talent/blueprints/:id/competencies', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const id = parseInt(req.params.id);
      const { rows } = await pool.query('SELECT * FROM cb_competency_mapping WHERE cb_id=$1 ORDER BY weight DESC', [id]);
      res.json({ competencies: rows, weight_total: rows.reduce((s: number, r: any) => s + Number(r.weight), 0) });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/admin/talent/blueprints/:id/competencies', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const cb_id = parseInt(req.params.id);
      const { competency_id, competency_name, weight, criticality } = req.body;
      if (!competency_id || !weight) return void res.status(400).json({ error: 'competency_id and weight required' });
      const { rows: ex } = await pool.query('SELECT COALESCE(SUM(weight),0)::numeric AS total FROM cb_competency_mapping WHERE cb_id=$1', [cb_id]);
      if (Number(ex[0].total) + Number(weight) > 100) {
        return void res.status(400).json({ error: `Would exceed 100% (current ${ex[0].total}%)` });
      }
      const { rows } = await pool.query(
        `INSERT INTO cb_competency_mapping(cb_id,competency_id,competency_name,weight,criticality) VALUES($1,$2,$3,$4,$5) ON CONFLICT(cb_id,competency_id) DO UPDATE SET competency_name=$3,weight=$4,criticality=$5 RETURNING *`,
        [cb_id, competency_id, competency_name || competency_id, weight, criticality || 'important']
      );
      res.status(201).json(rows[0]);
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/admin/talent/blueprints/:cbId/competencies/:compId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      await pool.query('DELETE FROM cb_competency_mapping WHERE cb_id=$1 AND competency_id=$2', [req.params.cbId, req.params.compId]);
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  // ── Admin — Summary ────────────────────────────────────────────────────────
  app.get('/api/admin/talent/summary', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const [a, b, c, d, e] = await Promise.all([
        pool.query('SELECT COUNT(*)::int AS n FROM rf_master'),
        pool.query('SELECT COUNT(*)::int AS n FROM cb_master'),
        pool.query('SELECT COUNT(*)::int AS n FROM rf_role_mapping'),
        pool.query('SELECT COUNT(*)::int AS n FROM rf_blueprint_mapping'),
        pool.query('SELECT COUNT(*)::int AS n FROM cb_competency_mapping'),
      ]);
      const [{ rows: rfCov }, { rows: cbHlth }] = await Promise.all([
        pool.query(`
          SELECT rf.name, COUNT(rbm.id)::int AS blueprint_count,
            COALESCE(SUM(rbm.weight),0)::numeric AS weight_total, rf.future_relevance
          FROM rf_master rf
          LEFT JOIN rf_blueprint_mapping rbm ON rbm.rf_id = rf.id
          GROUP BY rf.id, rf.name, rf.future_relevance
          ORDER BY rf.name
        `),
        pool.query(`
          SELECT cb.name, COUNT(ccm.id)::int AS competency_count,
            COALESCE(SUM(ccm.weight),0)::numeric AS weight_total, cb.future_relevance
          FROM cb_master cb
          LEFT JOIN cb_competency_mapping ccm ON ccm.cb_id = cb.id
          GROUP BY cb.id, cb.name, cb.future_relevance
          ORDER BY cb.name
        `),
      ]);
      res.json({
        role_families: a.rows[0].n,
        blueprints: b.rows[0].n,
        role_assignments: c.rows[0].n,
        blueprint_mappings: d.rows[0].n,
        competency_mappings: e.rows[0].n,
        role_family_coverage: rfCov,
        blueprint_health: cbHlth,
      });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  // ── CSV Exports (literal paths before any param route) ─────────────────────
  app.get('/api/admin/talent/export/role-families.csv', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { rows } = await pool.query(`
        SELECT id, name, description,
          array_to_string(industries,'|') AS industries,
          array_to_string(layers,'|')     AS layers,
          future_relevance, is_active
        FROM rf_master ORDER BY name
      `);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="role-families.csv"');
      const header = 'id,name,description,industries,layers,future_relevance,is_active';
      const body = rows.map((r: any) =>
        [r.id, `"${r.name}"`, `"${(r.description || '').replace(/"/g, '""')}"`, `"${r.industries}"`, `"${r.layers}"`, r.future_relevance, r.is_active].join(',')
      ).join('\n');
      res.send(header + '\n' + body);
    } catch { res.status(500).json({ error: 'Export failed' }); }
  });

  app.get('/api/admin/talent/export/blueprints.csv', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { rows } = await pool.query(`
        SELECT id, name, description,
          array_to_string(applicable_layers,'|') AS layers,
          future_relevance, is_active
        FROM cb_master ORDER BY name
      `);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="competency-blueprints.csv"');
      const header = 'id,name,description,applicable_layers,future_relevance,is_active';
      const body = rows.map((r: any) =>
        [r.id, `"${r.name}"`, `"${(r.description || '').replace(/"/g, '""')}"`, `"${r.layers}"`, r.future_relevance, r.is_active].join(',')
      ).join('\n');
      res.send(header + '\n' + body);
    } catch { res.status(500).json({ error: 'Export failed' }); }
  });

  console.log('[talent-foundation] routes registered — /api/talent/* + /api/admin/talent/*');
}
