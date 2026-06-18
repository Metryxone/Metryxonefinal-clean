/**
 * D8 — Measurement Science Platform
 * Scoring Formula Manager, Signal Weight Manager, Competency Weight Manager,
 * Composite Index Formula Manager, Measurement Governance Engine.
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
    CREATE TABLE IF NOT EXISTS ti_scoring_formulas (
      id SERIAL PRIMARY KEY,
      formula_key TEXT NOT NULL UNIQUE,
      formula_name TEXT NOT NULL,
      target_metric TEXT NOT NULL,
      formula_version INTEGER DEFAULT 1,
      formula_expression TEXT NOT NULL,
      weights JSONB DEFAULT '{}',
      normalization_method TEXT DEFAULT 'min_max',
      score_range_min NUMERIC DEFAULT 0,
      score_range_max NUMERIC DEFAULT 100,
      description TEXT,
      status TEXT CHECK (status IN ('draft','active','deprecated')) DEFAULT 'draft',
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      effective_from TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ti_sf_key ON ti_scoring_formulas(formula_key);
    CREATE TABLE IF NOT EXISTS ti_signal_weights (
      id SERIAL PRIMARY KEY,
      weight_config_key TEXT NOT NULL UNIQUE,
      config_name TEXT NOT NULL,
      blueprint_key TEXT,
      signal_weights JSONB NOT NULL DEFAULT '{}',
      total_weight NUMERIC(5,4),
      version INTEGER DEFAULT 1,
      status TEXT CHECK (status IN ('draft','active','deprecated')) DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ti_competency_weights (
      id SERIAL PRIMARY KEY,
      weight_config_key TEXT NOT NULL UNIQUE,
      config_name TEXT NOT NULL,
      blueprint_key TEXT NOT NULL,
      competency_weights JSONB NOT NULL DEFAULT '{}',
      total_weight NUMERIC(5,4),
      version INTEGER DEFAULT 1,
      status TEXT CHECK (status IN ('draft','active','deprecated')) DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ti_measurement_governance (
      id SERIAL PRIMARY KEY,
      governance_event TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_key TEXT NOT NULL,
      old_value JSONB,
      new_value JSONB,
      changed_by TEXT,
      rationale TEXT,
      impact_assessment TEXT,
      approved_by TEXT,
      status TEXT CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ti_mg_entity ON ti_measurement_governance(entity_type, entity_key);
    CREATE TABLE IF NOT EXISTS ti_norm_groups (
      id SERIAL PRIMARY KEY,
      norm_group_key TEXT NOT NULL UNIQUE,
      group_name TEXT NOT NULL,
      filters JSONB DEFAULT '{}',
      sample_size INTEGER DEFAULT 0,
      mean_score NUMERIC(5,2),
      std_dev NUMERIC(5,2),
      percentile_table JSONB DEFAULT '{}',
      last_computed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ti_score_bands (
      id SERIAL PRIMARY KEY,
      band_config_key TEXT NOT NULL UNIQUE,
      config_name TEXT NOT NULL,
      metric TEXT NOT NULL,
      bands JSONB NOT NULL DEFAULT '[]',
      version INTEGER DEFAULT 1,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  schemaReady = true;
}

const DEFAULT_FORMULAS = [
  {
    formula_key: 'talent_composite_v1', formula_name: 'Talent Composite Score v1',
    target_metric: 'talent_role_score', formula_version: 1,
    formula_expression: '(ei_score * 0.30) + (lbi_score * 0.25) + (competency_score * 0.25) + (csi_score * 0.20)',
    weights: { ei_score: 0.30, lbi_score: 0.25, competency_score: 0.25, csi_score: 0.20 },
    normalization_method: 'min_max', score_range_min: 0, score_range_max: 100,
    description: 'Primary composite formula for talent role scoring. Weights reflect relative importance of EI (people), LBI (learning), Competency (capability), and CSI (behavioural maturity).', status: 'active'
  },
  {
    formula_key: 'readiness_role_v1', formula_name: 'Role Readiness Score v1',
    target_metric: 'ri_role_readiness', formula_version: 1,
    formula_expression: 'composite_score - (critical_gaps * 8) - (moderate_gaps * 3)',
    weights: { composite_score: 1.0, critical_gap_penalty: 8, moderate_gap_penalty: 3 },
    normalization_method: 'clamp_0_100', score_range_min: 0, score_range_max: 100,
    description: 'Role readiness derived from composite score minus gap penalties. Critical gaps penalise heavily as they represent blockers.', status: 'active'
  },
  {
    formula_key: 'leadership_readiness_v1', formula_name: 'Leadership Readiness Score v1',
    target_metric: 'ri_leadership_readiness', formula_version: 1,
    formula_expression: '(ei_score * 0.40) + (lbi_score * 0.30) + (csi_score * 0.20) + (composite_score * 0.10)',
    weights: { ei_score: 0.40, lbi_score: 0.30, csi_score: 0.20, composite_score: 0.10 },
    normalization_method: 'weighted_avg', score_range_min: 0, score_range_max: 100,
    description: 'Leadership readiness strongly weighted toward EI (40%) as leadership is fundamentally interpersonal. Learning agility (LBI) enables adaptation. Technical score plays a minor role at leadership level.', status: 'active'
  },
  {
    formula_key: 'future_employability_v1', formula_name: 'Future Employability Index v1',
    target_metric: 'ti_future_employability', formula_version: 1,
    formula_expression: '(composite_score * 0.50) + (lbi_score * 0.30) + (ei_score * 0.20)',
    weights: { composite_score: 0.50, lbi_score: 0.30, ei_score: 0.20 },
    normalization_method: 'sigmoid_scaled', score_range_min: 0, score_range_max: 1,
    description: 'Future employability driven by current competency (50%), learning agility (30% — predicts reskilling ability), and EI (20% — interpersonal value in human-AI hybrid world).', status: 'active'
  },
  {
    formula_key: 'talent_risk_v1', formula_name: 'Talent Risk Score v1',
    target_metric: 'ti_talent_risk', formula_version: 1,
    formula_expression: '1 - (role_readiness * 0.50 + ei_score/100 * 0.30 + (1 - critical_gaps*0.10) * 0.20)',
    weights: { role_readiness: 0.50, ei_score: 0.30, gap_penalty: 0.20 },
    normalization_method: 'inversion', score_range_min: 0, score_range_max: 1,
    description: 'Talent risk = inverse of retention signals. High readiness + high EI + no gaps = low risk. Inverted so that high scores mean high risk.', status: 'active'
  },
];

const DEFAULT_SCORE_BANDS = [
  {
    band_config_key: 'talent_composite_bands', config_name: 'Talent Composite Score Bands', metric: 'talent_composite',
    bands: [
      { label: 'Exceptional', min: 85, max: 100, color: '#2ecc71', description: 'Top 10% performer — ready for next-level challenges' },
      { label: 'Strong', min: 70, max: 84, color: '#27ae60', description: 'Above average — performing well, some development areas' },
      { label: 'Developing', min: 55, max: 69, color: '#f39c12', description: 'Average performance — clear development plan needed' },
      { label: 'Emerging', min: 40, max: 54, color: '#e67e22', description: 'Below average — significant capability development required' },
      { label: 'Foundational', min: 0, max: 39, color: '#e74c3c', description: 'Early stage — intensive support and development needed' },
    ],
  },
  {
    band_config_key: 'readiness_bands', config_name: 'Readiness Score Bands', metric: 'readiness',
    bands: [
      { label: 'Ready Now', min: 85, max: 100, color: '#2ecc71', description: 'Ready for role/promotion immediately' },
      { label: 'Ready 6 Months', min: 70, max: 84, color: '#27ae60', description: 'Will be ready with targeted 6-month development' },
      { label: 'Ready 12 Months', min: 55, max: 69, color: '#f39c12', description: 'Requires 12 months focused development' },
      { label: 'Ready 18+ Months', min: 40, max: 54, color: '#e67e22', description: 'Longer development journey required' },
      { label: 'Not Ready', min: 0, max: 39, color: '#e74c3c', description: 'Significant gaps to close before readiness' },
    ],
  },
  {
    band_config_key: 'ei_bands', config_name: 'Employability Index Bands', metric: 'employability_index',
    bands: [
      { label: 'World-Class', min: 85, max: 100, color: '#2ecc71', description: 'Exceptional employability across industries' },
      { label: 'High', min: 70, max: 84, color: '#27ae60', description: 'Strong employability, competitive in market' },
      { label: 'Moderate', min: 55, max: 69, color: '#f39c12', description: 'Average employability, industry-specific' },
      { label: 'Developing', min: 40, max: 54, color: '#e67e22', description: 'Below-market employability, needs investment' },
      { label: 'Low', min: 0, max: 39, color: '#e74c3c', description: 'Significant employability challenges' },
    ],
  },
];

const DEFAULT_SIGNAL_WEIGHTS = [
  {
    weight_config_key: 'executive_signals_v1', config_name: 'Executive Leadership Signals',
    blueprint_key: 'executive_leadership',
    signal_weights: { SI_001: 0.15, SI_002: 0.12, LP_001: 0.18, LP_026: 0.12, AC_002: 0.10, CI_001: 0.10, ES_001: 0.08, FR_001: 0.08, IC_019: 0.07 },
    total_weight: 1.0, notes: 'Strategic vision and inspirational leadership are top-weighted for executive roles',
  },
  {
    weight_config_key: 'data_science_signals_v1', config_name: 'Data Science Signals',
    blueprint_key: 'data_science',
    signal_weights: { AC_001: 0.18, AC_005: 0.16, DT_002: 0.18, DT_003: 0.14, AC_013: 0.12, LA_001: 0.10, AC_002: 0.12 },
    total_weight: 1.0, notes: 'Data interpretation and quantitative reasoning lead for data science roles',
  },
  {
    weight_config_key: 'people_leadership_signals_v1', config_name: 'People Leadership Signals',
    blueprint_key: 'people_leadership',
    signal_weights: { LP_007: 0.18, LP_008: 0.15, LP_003: 0.16, ES_002: 0.14, LP_016: 0.12, CI_003: 0.10, ES_001: 0.15 },
    total_weight: 1.0, notes: 'Psychological safety and coaching capability are foundational for people leaders',
  },
];

const DEFAULT_COMPETENCY_WEIGHTS = [
  {
    weight_config_key: 'exec_comp_weights_v1', config_name: 'Executive Leadership Competency Weights',
    blueprint_key: 'executive_leadership',
    competency_weights: { 'Strategic Thinking': 0.25, 'Decision Making': 0.20, 'Inspirational Leadership': 0.20, 'Stakeholder Management': 0.15, 'Ethical Leadership': 0.10, 'Change Leadership': 0.10 },
    total_weight: 1.0,
  },
  {
    weight_config_key: 'ops_comp_weights_v1', config_name: 'Operations Management Competency Weights',
    blueprint_key: 'operations_management',
    competency_weights: { 'Process Design': 0.25, 'Quality Management': 0.20, 'Continuous Improvement': 0.20, 'Operational Risk Management': 0.15, 'Data-Driven Operations': 0.20 },
    total_weight: 1.0,
  },
  {
    weight_config_key: 'data_comp_weights_v1', config_name: 'Data Science Competency Weights',
    blueprint_key: 'data_science',
    competency_weights: { 'Machine Learning Engineering': 0.30, 'Statistical Analysis': 0.25, 'Data Analytics': 0.20, 'Research Design': 0.15, 'AI/ML Literacy': 0.10 },
    total_weight: 1.0,
  },
];

async function seedMeasurementData(pool: Pool): Promise<void> {
  const existing = await pool.query<{ cnt: string }>('SELECT COUNT(*)::int AS cnt FROM ti_scoring_formulas');
  if (Number(existing.rows[0]?.cnt) >= DEFAULT_FORMULAS.length) return;
  for (const f of DEFAULT_FORMULAS) {
    await pool.query(
      `INSERT INTO ti_scoring_formulas(formula_key,formula_name,target_metric,formula_version,formula_expression,weights,normalization_method,score_range_min,score_range_max,description,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(formula_key) DO NOTHING`,
      [f.formula_key, f.formula_name, f.target_metric, f.formula_version, f.formula_expression, JSON.stringify(f.weights), f.normalization_method, f.score_range_min, f.score_range_max, f.description, f.status]
    );
  }
  for (const b of DEFAULT_SCORE_BANDS) {
    await pool.query(`INSERT INTO ti_score_bands(band_config_key,config_name,metric,bands) VALUES($1,$2,$3,$4) ON CONFLICT(band_config_key) DO NOTHING`,
      [b.band_config_key, b.config_name, b.metric, JSON.stringify(b.bands)]);
  }
  for (const sw of DEFAULT_SIGNAL_WEIGHTS) {
    await pool.query(`INSERT INTO ti_signal_weights(weight_config_key,config_name,blueprint_key,signal_weights,total_weight,notes) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(weight_config_key) DO NOTHING`,
      [sw.weight_config_key, sw.config_name, sw.blueprint_key, JSON.stringify(sw.signal_weights), sw.total_weight, sw.notes]);
  }
  for (const cw of DEFAULT_COMPETENCY_WEIGHTS) {
    await pool.query(`INSERT INTO ti_competency_weights(weight_config_key,config_name,blueprint_key,competency_weights,total_weight) VALUES($1,$2,$3,$4,$5) ON CONFLICT(weight_config_key) DO NOTHING`,
      [cw.weight_config_key, cw.config_name, cw.blueprint_key, JSON.stringify(cw.competency_weights), cw.total_weight]);
  }
}

export function registerTalentMeasurementScienceRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn): void {
  if (!flagOn()) return;
  ensureSchema(pool).then(() => seedMeasurementData(pool)).catch(() => {});

  // ── Scoring Formulas ───────────────────────────────────────────────────────

  app.get('/api/admin/talent/measurement/formulas', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('formulas');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const [rows, kpi] = await Promise.all([
        pool.query('SELECT * FROM ti_scoring_formulas ORDER BY status DESC, formula_name'),
        pool.query(`SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE status='active') as active, COUNT(*) FILTER (WHERE status='draft') as draft FROM ti_scoring_formulas`),
      ]);
      const result = { formulas: rows.rows, kpi: kpi.rows[0] };
      setCache('formulas', result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  app.post('/api/admin/talent/measurement/formulas', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const { formula_key, formula_name, target_metric, formula_expression, weights, normalization_method, score_range_min, score_range_max, description } = req.body;
    if (!formula_key || !formula_name || !formula_expression) return res.status(400).json({ error: 'formula_key, formula_name, formula_expression required' });
    try {
      const r = await pool.query(`INSERT INTO ti_scoring_formulas(formula_key,formula_name,target_metric,formula_expression,weights,normalization_method,score_range_min,score_range_max,description,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft') RETURNING *`,
        [formula_key, formula_name, target_metric, formula_expression, JSON.stringify(weights || {}), normalization_method || 'min_max', score_range_min || 0, score_range_max || 100, description]);
      await pool.query(`INSERT INTO ti_measurement_governance(governance_event,entity_type,entity_key,new_value,rationale) VALUES('formula_created','scoring_formula',$1,$2,$3)`,
        [formula_key, JSON.stringify(r.rows[0]), req.body.rationale || 'New formula created']).catch(() => {});
      bustCache(); res.json({ ok: true, formula: r.rows[0] });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  app.patch('/api/admin/talent/measurement/formulas/:key', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const fields = ['formula_name', 'formula_expression', 'weights', 'normalization_method', 'description', 'status'];
    const updates: string[] = []; const params: unknown[] = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        params.push(f === 'weights' ? JSON.stringify(req.body[f]) : req.body[f]);
        updates.push(`${f}=$${params.length}`);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'nothing to update' });
    params.push(req.params.key);
    try {
      const r = await pool.query(`UPDATE ti_scoring_formulas SET ${updates.join(',')},updated_at=NOW(),formula_version=formula_version+1 WHERE formula_key=$${params.length} RETURNING *`, params);
      bustCache(); res.json({ ok: true, formula: r.rows[0] });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // ── Signal Weights ─────────────────────────────────────────────────────────

  app.get('/api/admin/talent/measurement/signal-weights', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ configs: (await pool.query('SELECT * FROM ti_signal_weights ORDER BY config_name')).rows }); } catch { res.status(500).json({ error: 'fetch failed' }); }
  });

  app.patch('/api/admin/talent/measurement/signal-weights/:key', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const { signal_weights, notes } = req.body;
    if (!signal_weights) return res.status(400).json({ error: 'signal_weights required' });
    const totalWeight = Object.values(signal_weights as Record<string, number>).reduce((a, b) => a + b, 0);
    if (Math.abs(totalWeight - 1) > 0.01) return res.status(400).json({ error: `Weights must sum to 1.0 (got ${totalWeight.toFixed(3)})` });
    try {
      const old = await pool.query('SELECT signal_weights FROM ti_signal_weights WHERE weight_config_key=$1', [req.params.key]);
      const r = await pool.query(`UPDATE ti_signal_weights SET signal_weights=$1,total_weight=$2,notes=$3,version=version+1,updated_at=NOW() WHERE weight_config_key=$4 RETURNING *`,
        [JSON.stringify(signal_weights), totalWeight, notes, req.params.key]);
      await pool.query(`INSERT INTO ti_measurement_governance(governance_event,entity_type,entity_key,old_value,new_value) VALUES('weight_updated','signal_weight',$1,$2,$3)`,
        [req.params.key, old.rows[0]?.signal_weights, JSON.stringify(signal_weights)]).catch(() => {});
      bustCache(); res.json({ ok: true, config: r.rows[0] });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // ── Competency Weights ─────────────────────────────────────────────────────

  app.get('/api/admin/talent/measurement/competency-weights', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ configs: (await pool.query('SELECT * FROM ti_competency_weights ORDER BY config_name')).rows }); } catch { res.status(500).json({ error: 'fetch failed' }); }
  });

  app.patch('/api/admin/talent/measurement/competency-weights/:key', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const { competency_weights, notes } = req.body;
    if (!competency_weights) return res.status(400).json({ error: 'competency_weights required' });
    const totalWeight = Object.values(competency_weights as Record<string, number>).reduce((a, b) => a + b, 0);
    if (Math.abs(totalWeight - 1) > 0.01) return res.status(400).json({ error: `Weights must sum to 1.0 (got ${totalWeight.toFixed(3)})` });
    try {
      const r = await pool.query(`UPDATE ti_competency_weights SET competency_weights=$1,total_weight=$2,notes=$3,version=version+1,updated_at=NOW() WHERE weight_config_key=$4 RETURNING *`,
        [JSON.stringify(competency_weights), totalWeight, notes, req.params.key]);
      bustCache(); res.json({ ok: true, config: r.rows[0] });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // ── Score Bands ────────────────────────────────────────────────────────────

  app.get('/api/admin/talent/measurement/score-bands', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ configs: (await pool.query('SELECT * FROM ti_score_bands ORDER BY config_name')).rows }); } catch { res.status(500).json({ error: 'fetch failed' }); }
  });

  // ── Norm Groups ────────────────────────────────────────────────────────────

  app.get('/api/admin/talent/measurement/norm-groups', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ groups: (await pool.query('SELECT * FROM ti_norm_groups ORDER BY group_name')).rows }); } catch { res.status(500).json({ error: 'fetch failed' }); }
  });

  app.post('/api/admin/talent/measurement/norm-groups/compute', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const scores = await pool.query('SELECT composite_score FROM talent_role_scores WHERE composite_score > 0');
      if (!scores.rows.length) return res.json({ ok: false, message: 'No talent scores to compute norm from' });
      const vals = scores.rows.map((r: any) => Number(r.composite_score)).sort((a, b) => a - b);
      const n = vals.length;
      const mean = vals.reduce((a, b) => a + b, 0) / n;
      const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
      const std = Math.sqrt(variance);
      const percentiles: Record<string, number> = {};
      for (const p of [10, 25, 50, 75, 90]) {
        const idx = Math.floor((p / 100) * n);
        percentiles[`p${p}`] = vals[Math.min(idx, n - 1)];
      }
      await pool.query(
        `INSERT INTO ti_norm_groups(norm_group_key,group_name,sample_size,mean_score,std_dev,percentile_table,last_computed_at)
         VALUES('talent_composite_global','All Talent (Global)',$1,$2,$3,$4,NOW())
         ON CONFLICT(norm_group_key) DO UPDATE SET sample_size=$1,mean_score=$2,std_dev=$3,percentile_table=$4,last_computed_at=NOW()`,
        [n, Math.round(mean * 100) / 100, Math.round(std * 100) / 100, JSON.stringify(percentiles)]
      );
      bustCache(); res.json({ ok: true, norm: { sample_size: n, mean, std, percentiles } });
    } catch (err) { res.status(500).json({ error: 'compute failed' }); }
  });

  // ── Governance Audit Trail ─────────────────────────────────────────────────

  app.get('/api/admin/talent/measurement/governance', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { page = '1', limit = '25' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const [countRes, rows] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM ti_measurement_governance'),
        pool.query('SELECT * FROM ti_measurement_governance ORDER BY created_at DESC LIMIT $1 OFFSET $2', [parseInt(limit), offset]),
      ]);
      res.json({ total: parseInt(countRes.rows[0].count), page: parseInt(page), events: rows.rows });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // ── Platform Overview ──────────────────────────────────────────────────────

  app.get('/api/admin/talent/measurement/overview', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('measurement_overview');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const [formulas, signals, competency, bands, norms, govEvents] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE status='active') as active FROM ti_scoring_formulas`),
        pool.query('SELECT COUNT(*)::int as total FROM ti_signal_weights'),
        pool.query('SELECT COUNT(*)::int as total FROM ti_competency_weights'),
        pool.query('SELECT COUNT(*)::int as total FROM ti_score_bands'),
        pool.query('SELECT COUNT(*)::int as total FROM ti_norm_groups WHERE last_computed_at IS NOT NULL'),
        pool.query(`SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE status='pending') as pending FROM ti_measurement_governance`),
      ]);
      const result = {
        scoring_formulas: formulas.rows[0], signal_weight_configs: signals.rows[0],
        competency_weight_configs: competency.rows[0], score_band_configs: bands.rows[0],
        norm_groups: norms.rows[0], governance_events: govEvents.rows[0],
      };
      setCache('measurement_overview', result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  console.log('[talent-measurement-science] D8 routes registered — Formula/Weight/Band/Norm/Governance managers');
}
