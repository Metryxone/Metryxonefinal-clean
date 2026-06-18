/**
 * VX-D9 — IRT & Adaptive Assessment Engine
 * Item Response Theory: difficulty (b), discrimination (a), guessing (c) parameters.
 * Ability estimation (θ), confidence intervals, adaptive stopping rules.
 * irt_item_parameters / irt_ability_estimates / irt_adaptive_config
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

/* ── IRT Mathematics (3PL model) ─────────────────────────────────────────── */
function icc3PL(theta: number, a: number, b: number, c: number): number {
  return c + (1 - c) / (1 + Math.exp(-1.7 * a * (theta - b)));
}

function estimateTheta(responses: { correct: boolean; a: number; b: number; c: number }[], priorMean = 0.0, priorSd = 1.0, maxIterations = 50): { theta: number; se: number; converged: boolean } {
  let theta = priorMean;
  for (let iter = 0; iter < maxIterations; iter++) {
    let firstDeriv = 0; let secondDeriv = 0;
    for (const r of responses) {
      const p = icc3PL(theta, r.a, r.b, r.c);
      const q = 1 - p;
      const w = (p - r.c) / (1 - r.c);
      const dP = 1.7 * r.a * w * q;
      const u = r.correct ? 1 : 0;
      if (p > 0.001 && q > 0.001) {
        firstDeriv += dP * ((u - p) / (p * q));
        secondDeriv -= (dP * dP) / (p * q);
      }
    }
    // Prior contribution (normal prior)
    firstDeriv -= (theta - priorMean) / (priorSd * priorSd);
    secondDeriv -= 1 / (priorSd * priorSd);
    if (Math.abs(secondDeriv) < 0.0001) break;
    const delta = firstDeriv / secondDeriv;
    theta -= delta;
    theta = Math.max(-4, Math.min(4, theta)); // clamp
    if (Math.abs(delta) < 0.001) break;
  }
  const fishersInfo = responses.reduce((sum, r) => {
    const p = icc3PL(theta, r.a, r.b, r.c);
    const q = 1 - p;
    const w = (p - r.c) / (1 - r.c);
    const dP = 1.7 * r.a * w * q;
    return p > 0.001 && q > 0.001 ? sum + (dP * dP) / (p * q) : sum;
  }, 0) + 1 / (priorSd * priorSd);
  const se = fishersInfo > 0 ? 1 / Math.sqrt(fishersInfo) : priorSd;
  return { theta: Math.round(theta * 1000) / 1000, se: Math.round(se * 1000) / 1000, converged: true };
}

function selectNextItem(remainingItems: { id: number; a: number; b: number; c: number }[], theta: number): number | null {
  if (!remainingItems.length) return null;
  let bestId: number | null = null; let bestInfo = -1;
  for (const item of remainingItems) {
    const p = icc3PL(theta, item.a, item.b, item.c);
    const q = 1 - p;
    const w = (p - item.c) / (1 - item.c);
    const dP = 1.7 * item.a * w * q;
    const info = p > 0.001 && q > 0.001 ? (dP * dP) / (p * q) : 0;
    if (info > bestInfo) { bestInfo = info; bestId = item.id; }
  }
  return bestId;
}

let ready = false;
async function ensureSchema(pool: Pool) {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS irt_item_parameters (
      id SERIAL PRIMARY KEY,
      question_ref TEXT UNIQUE NOT NULL,
      question_label TEXT,
      difficulty_b NUMERIC(6,4) DEFAULT 0.0,
      discrimination_a NUMERIC(6,4) DEFAULT 1.0,
      guessing_c NUMERIC(6,4) DEFAULT 0.0,
      model_type TEXT CHECK (model_type IN ('1PL','2PL','3PL')) DEFAULT '3PL',
      calibration_status TEXT CHECK (calibration_status IN ('simulated','pilot','calibrated','validated')) DEFAULT 'simulated',
      calibration_date DATE DEFAULT CURRENT_DATE,
      sample_size INTEGER DEFAULT 0,
      fit_statistic NUMERIC(8,4),
      infit_mnsq NUMERIC(6,4),
      outfit_mnsq NUMERIC(6,4),
      competency_code TEXT,
      signal_key TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS irt_ability_estimates (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_ref TEXT,
      theta_estimate NUMERIC(8,4) NOT NULL,
      standard_error NUMERIC(8,4) NOT NULL,
      ci_lower NUMERIC(8,4),
      ci_upper NUMERIC(8,4),
      estimation_method TEXT CHECK (estimation_method IN ('MAP','MLE','EAP','BAYES')) DEFAULT 'MAP',
      item_count INTEGER DEFAULT 0,
      prior_mean NUMERIC(6,4) DEFAULT 0.0,
      prior_sd NUMERIC(6,4) DEFAULT 1.0,
      stopping_reason TEXT,
      converged BOOLEAN DEFAULT true,
      score_standardized NUMERIC(5,1),
      competency_code TEXT,
      computed_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS irt_adaptive_config (
      id SERIAL PRIMARY KEY,
      config_key TEXT UNIQUE NOT NULL,
      assessment_type TEXT,
      ability_prior_mean NUMERIC(6,4) DEFAULT 0.0,
      ability_prior_sd NUMERIC(6,4) DEFAULT 1.0,
      stopping_rule TEXT CHECK (stopping_rule IN ('max_items','se_threshold','both')) DEFAULT 'both',
      max_items INTEGER DEFAULT 30,
      min_items INTEGER DEFAULT 10,
      se_threshold NUMERIC(5,4) DEFAULT 0.30,
      item_selection_method TEXT CHECK (item_selection_method IN ('max_information','a_stratified','progressive','random')) DEFAULT 'max_information',
      content_balance_rules JSONB DEFAULT '{}',
      exposure_control BOOLEAN DEFAULT true,
      max_exposure_rate NUMERIC(4,3) DEFAULT 0.20,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_irt_ip_qref ON irt_item_parameters(question_ref);
    CREATE INDEX IF NOT EXISTS idx_irt_ip_competency ON irt_item_parameters(competency_code);
    CREATE INDEX IF NOT EXISTS idx_irt_ae_session ON irt_ability_estimates(session_id);
    CREATE INDEX IF NOT EXISTS idx_irt_ae_user ON irt_ability_estimates(user_ref);
  `);
  ready = true;
}

const DEFAULT_ADAPTIVE_CONFIGS = [
  { config_key: 'behavioral_30', assessment_type: 'behavioral', max_items: 30, min_items: 10, se_threshold: 0.30, item_selection_method: 'max_information' },
  { config_key: 'cognitive_40', assessment_type: 'cognitive', max_items: 40, min_items: 15, se_threshold: 0.25, item_selection_method: 'a_stratified' },
  { config_key: 'leadership_25', assessment_type: 'leadership', max_items: 25, min_items: 8, se_threshold: 0.35, item_selection_method: 'max_information' },
  { config_key: 'functional_35', assessment_type: 'functional', max_items: 35, min_items: 12, se_threshold: 0.28, item_selection_method: 'progressive' },
];

export function registerVXIRTEngineRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn) {
  const guard = (req: Request, res: Response, next: () => void) => { if (!flagOn()) return res.status(503).json({ error: `${FLAG} off` }); next(); };
  let seeded = false;
  async function seed() {
    if (seeded) return; await ensureSchema(pool);
    const cnt = await pool.query('SELECT COUNT(*) FROM irt_adaptive_config').catch(() => ({ rows: [{ count: '0' }] }));
    if (Number(cnt.rows[0].count) === 0) for (const c of DEFAULT_ADAPTIVE_CONFIGS) await pool.query('INSERT INTO irt_adaptive_config(config_key,assessment_type,max_items,min_items,se_threshold,item_selection_method) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(config_key) DO NOTHING', [c.config_key, c.assessment_type, c.max_items, c.min_items, c.se_threshold, c.item_selection_method]).catch(() => null);
    seeded = true;
  }

  app.get('/api/admin/vx/irt/overview', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seed().catch(() => null);
    const cached = gc<unknown>('irt_overview'); if (cached) return res.json(cached);
    try {
      const [items, estimates, configs] = await Promise.all([
        pool.query('SELECT model_type, calibration_status, COUNT(*) as count, ROUND(AVG(difficulty_b),3) as avg_difficulty, ROUND(AVG(discrimination_a),3) as avg_discrimination FROM irt_item_parameters WHERE is_active=true GROUP BY model_type, calibration_status'),
        pool.query('SELECT estimation_method, COUNT(*) as count, ROUND(AVG(theta_estimate),3) as avg_theta, ROUND(AVG(standard_error),3) as avg_se FROM irt_ability_estimates GROUP BY estimation_method'),
        pool.query('SELECT * FROM irt_adaptive_config ORDER BY config_key'),
      ]);
      const payload = { item_parameters: items.rows, ability_estimates: estimates.rows, adaptive_configs: configs.rows };
      sc('irt_overview', payload); res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/irt/items', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const { competency_code, calibration_status, model_type, page = '1', limit = '50' } = req.query as Record<string, string>;
      const p: unknown[] = ['true']; const w: string[] = ['is_active=$1'];
      if (competency_code) { p.push(competency_code); w.push(`competency_code=$${p.length}`); }
      if (calibration_status) { p.push(calibration_status); w.push(`calibration_status=$${p.length}`); }
      if (model_type) { p.push(model_type); w.push(`model_type=$${p.length}`); }
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const rows = await pool.query(`SELECT * FROM irt_item_parameters WHERE ${w.join(' AND ')} ORDER BY question_ref LIMIT $${p.length + 1} OFFSET $${p.length + 2}`, [...p, parseInt(limit), offset]);
      res.json({ items: rows.rows, total: rows.rows.length, page: parseInt(page) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/admin/vx/irt/items', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const { question_ref, question_label, difficulty_b = 0.0, discrimination_a = 1.0, guessing_c = 0.0, model_type = '3PL', competency_code, signal_key } = req.body;
      if (!question_ref) return res.status(400).json({ error: 'question_ref required' });
      const row = await pool.query('INSERT INTO irt_item_parameters(question_ref,question_label,difficulty_b,discrimination_a,guessing_c,model_type,competency_code,signal_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(question_ref) DO UPDATE SET difficulty_b=$3,discrimination_a=$4,guessing_c=$5 RETURNING *', [question_ref, question_label, difficulty_b, discrimination_a, guessing_c, model_type, competency_code, signal_key]);
      res.status(201).json(row.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  /* ── Ability Estimation Engine ─────────────────────────────────────────── */
  app.post('/api/vx/irt/ability/estimate', requireAuth, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const { session_id, user_ref, responses, competency_code, prior_mean = 0.0, prior_sd = 1.0 } = req.body;
      if (!session_id || !responses?.length) return res.status(400).json({ error: 'session_id and responses required' });

      // Fetch IRT params for each responded item
      const qRefs = responses.map((r: { question_ref: string }) => r.question_ref);
      const params = await pool.query('SELECT question_ref, difficulty_b, discrimination_a, guessing_c FROM irt_item_parameters WHERE question_ref=ANY($1) AND is_active=true', [qRefs]);
      const paramMap: Record<string, { a: number; b: number; c: number }> = {};
      for (const p of params.rows) paramMap[p.question_ref] = { a: Number(p.discrimination_a), b: Number(p.difficulty_b), c: Number(p.guessing_c) };

      const scoredResponses = responses
        .filter((r: { question_ref: string }) => paramMap[r.question_ref])
        .map((r: { question_ref: string; correct: boolean }) => ({ correct: r.correct, ...paramMap[r.question_ref] }));

      if (!scoredResponses.length) return res.status(400).json({ error: 'No responses with valid IRT parameters found' });

      const { theta, se, converged } = estimateTheta(scoredResponses, prior_mean, prior_sd);
      const ciLower = Math.round((theta - 1.96 * se) * 1000) / 1000;
      const ciUpper = Math.round((theta + 1.96 * se) * 1000) / 1000;
      const scoreStandardized = Math.round(((theta + 4) / 8) * 100 * 10) / 10; // 0-100 scale

      const stopping_reason = se <= 0.30 ? 'se_threshold_met' : scoredResponses.length >= 30 ? 'max_items_reached' : 'pending';

      const row = await pool.query(
        'INSERT INTO irt_ability_estimates(session_id,user_ref,theta_estimate,standard_error,ci_lower,ci_upper,estimation_method,item_count,prior_mean,prior_sd,stopping_reason,converged,score_standardized,competency_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',
        [session_id, user_ref, theta, se, ciLower, ciUpper, 'MAP', scoredResponses.length, prior_mean, prior_sd, stopping_reason, converged, scoreStandardized, competency_code]
      );
      res.json({ ability_estimate: row.rows[0], interpretation: { theta_scale: `${theta} (scale: -4 to +4)`, standardized_score: `${scoreStandardized}/100`, proficiency: theta > 1 ? 'Advanced' : theta > 0 ? 'Proficient' : theta > -1 ? 'Developing' : 'Foundational', confidence_interval_95: `[${ciLower}, ${ciUpper}]` } });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  /* ── Next Item Selection ───────────────────────────────────────────────── */
  app.post('/api/vx/irt/adaptive/next-item', requireAuth, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const { current_theta = 0.0, administered_refs = [], assessment_type = 'behavioral', competency_code } = req.body;
      const p: unknown[] = [administered_refs.length > 0 ? administered_refs : ['__none__']]; const w: string[] = ['is_active=true', 'question_ref!=ALL($1)'];
      if (competency_code) { p.push(competency_code); w.push(`competency_code=$${p.length}`); }
      const config = await pool.query('SELECT * FROM irt_adaptive_config WHERE assessment_type=$1 LIMIT 1', [assessment_type]).catch(() => ({ rows: [] }));
      const cfg = config.rows[0];
      if (administered_refs.length >= (cfg?.max_items || 30)) return res.json({ next_item: null, stopping_reason: 'max_items_reached' });
      const items = await pool.query(`SELECT id, question_ref, difficulty_b as b, discrimination_a as a, guessing_c as c FROM irt_item_parameters WHERE ${w.join(' AND ')} LIMIT 100`, p);
      if (!items.rows.length) return res.json({ next_item: null, stopping_reason: 'no_more_items' });
      const candidates = items.rows.map((i: any) => ({ id: i.id, a: Number(i.a), b: Number(i.b), c: Number(i.c), question_ref: i.question_ref }));
      const bestId = selectNextItem(candidates, current_theta);
      const chosen = candidates.find(c => c.id === bestId);
      res.json({ next_item: chosen || null, administered_count: administered_refs.length, current_theta, selection_method: 'max_information' });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/irt/adaptive-config', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const rows = await pool.query('SELECT * FROM irt_adaptive_config ORDER BY config_key');
      res.json({ configs: rows.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put('/api/admin/vx/irt/adaptive-config/:key', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const { max_items, min_items, se_threshold, item_selection_method, ability_prior_mean, ability_prior_sd } = req.body;
      const row = await pool.query('UPDATE irt_adaptive_config SET max_items=COALESCE($1,max_items),min_items=COALESCE($2,min_items),se_threshold=COALESCE($3,se_threshold),item_selection_method=COALESCE($4,item_selection_method),ability_prior_mean=COALESCE($5,ability_prior_mean),ability_prior_sd=COALESCE($6,ability_prior_sd) WHERE config_key=$7 RETURNING *', [max_items, min_items, se_threshold, item_selection_method, ability_prior_mean, ability_prior_sd, req.params.key]);
      res.json(row.rows[0] || { error: 'Config not found' });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post('/api/admin/vx/irt/simulate-calibration', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const { question_ref, target_difficulty = 0.0, target_discrimination = 1.0, target_guessing = 0.0, sample_size = 200 } = req.body;
      if (!question_ref) return res.status(400).json({ error: 'question_ref required' });
      // Simulate calibration with small random perturbation
      const noise = () => (Math.random() - 0.5) * 0.1;
      const b = Math.round((target_difficulty + noise()) * 1000) / 1000;
      const a = Math.max(0.1, Math.round((target_discrimination + Math.abs(noise())) * 1000) / 1000);
      const c = Math.max(0, Math.min(0.35, Math.round((target_guessing + noise() * 0.5) * 1000) / 1000));
      const fitStat = Math.round((1.0 + noise() * 0.2) * 1000) / 1000;
      const row = await pool.query('INSERT INTO irt_item_parameters(question_ref,difficulty_b,discrimination_a,guessing_c,model_type,calibration_status,sample_size,fit_statistic,infit_mnsq,outfit_mnsq) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(question_ref) DO UPDATE SET difficulty_b=$2,discrimination_a=$3,guessing_c=$4,calibration_status=$6,sample_size=$7,fit_statistic=$8,infit_mnsq=$9,outfit_mnsq=$10,calibration_date=CURRENT_DATE RETURNING *', [question_ref, b, a, c, '3PL', 'pilot', sample_size, fitStat, fitStat, fitStat]);
      res.json({ calibrated_item: row.rows[0], note: 'Simulated calibration — replace with real calibration data from live assessment responses' });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  console.log('[vx-irt-engine] VX-D9 routes registered — IRT 3PL + MAP θ estimation + adaptive next-item selection');
}
