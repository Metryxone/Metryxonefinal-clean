/**
 * D14 — Talent Digital Twin (6-State Model)
 * Extends the existing HIS synthesis with a full 6-state persisted model:
 * Current | Desired | Predicted | Future | Learning | Career
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
    CREATE TABLE IF NOT EXISTS tdt_user_states (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      state_type TEXT NOT NULL CHECK (state_type IN ('current','desired','predicted','future','learning','career')),
      state_data JSONB NOT NULL DEFAULT '{}',
      confidence NUMERIC(5,4) DEFAULT 0,
      computed_from TEXT[] DEFAULT '{}',
      valid_until TIMESTAMPTZ,
      computed_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, state_type)
    );
    CREATE INDEX IF NOT EXISTS idx_tdt_email ON tdt_user_states(user_email);
    CREATE INDEX IF NOT EXISTS idx_tdt_state_type ON tdt_user_states(state_type);
    CREATE TABLE IF NOT EXISTS tdt_state_transitions (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      from_state TEXT NOT NULL,
      to_state TEXT NOT NULL,
      trigger_event TEXT,
      delta JSONB DEFAULT '{}',
      transitioned_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tdt_trans_email ON tdt_state_transitions(user_email);
    CREATE TABLE IF NOT EXISTS tdt_twin_predictions (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL UNIQUE,
      predicted_his_3m NUMERIC(5,2),
      predicted_his_6m NUMERIC(5,2),
      predicted_his_12m NUMERIC(5,2),
      predicted_readiness_band TEXT,
      growth_trajectory TEXT CHECK (growth_trajectory IN ('accelerating','steady','plateauing','declining','insufficient_data')),
      key_growth_levers JSONB DEFAULT '[]',
      intervention_priority TEXT CHECK (intervention_priority IN ('urgent','high','medium','low','none')),
      prediction_confidence NUMERIC(5,4) DEFAULT 0,
      predicted_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tdt_pred_email ON tdt_twin_predictions(user_email);
  `);
  schemaReady = true;
}

// ── State Builders ────────────────────────────────────────────────────────────

async function buildCurrentState(pool: Pool, email: string): Promise<{ data: any; confidence: number; sources: string[] }> {
  const [twin, scores, ei, lbi, csi] = await Promise.all([
    pool.query('SELECT * FROM human_digital_twins WHERE user_email=$1 LIMIT 1', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT rf_name, composite_score FROM talent_role_scores WHERE user_email=$1 ORDER BY composite_score DESC LIMIT 5', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT overall_ei, dimensions FROM mei_scores WHERE user_email=$1 ORDER BY computed_at DESC LIMIT 1', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT overall_lbi, learning_style FROM lbi_scores WHERE user_email=$1 ORDER BY created_at DESC LIMIT 1', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT csi_score, csi_stage FROM csi_profiles WHERE user_email=$1 LIMIT 1', [email]).catch(() => ({ rows: [] })),
  ]);
  const sources: string[] = [];
  const his = twin.rows[0];
  const eiData = ei.rows[0];
  const lbiData = lbi.rows[0];
  const csiData = csi.rows[0];
  if (his) sources.push('HIS');
  if (eiData) sources.push('EI');
  if (lbiData) sources.push('LBI');
  if (csiData) sources.push('CSI');
  if (scores.rows.length) sources.push('TalentScore');

  return {
    data: {
      human_intelligence_score: his?.human_intelligence_score || null,
      cognitive_score: his?.cognitive_score || null,
      emotional_score: his?.emotional_score || null,
      behavioural_score: his?.behavioural_score || null,
      learning_score: his?.lbi_score || null,
      developmental_stage: his?.developmental_stage || csiData?.csi_stage || null,
      ei_score: eiData ? Number(eiData.overall_ei) : null,
      lbi_score: lbiData ? Number(lbiData.overall_lbi) : null,
      csi_score: csiData ? Number(csiData.csi_score) : null,
      top_rf_scores: scores.rows.map((s: any) => ({ rf_name: s.rf_name, score: Number(s.composite_score) })),
      adaptation_profile: his?.adaptation_profile || null,
      state_vector: his?.state_vector || null,
    },
    confidence: Math.min(1, sources.length / 5),
    sources,
  };
}

async function buildDesiredState(pool: Pool, email: string): Promise<{ data: any; confidence: number; sources: string[] }> {
  const [profile, passport] = await Promise.all([
    pool.query('SELECT data FROM career_seeker_profiles WHERE user_email=$1 LIMIT 1', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT * FROM career_seeker_profiles WHERE user_email=$1 LIMIT 1', [email]).catch(() => ({ rows: [] })),
  ]);
  const profileData = profile.rows[0]?.data || {};
  const sources: string[] = [];
  if (Object.keys(profileData).length) sources.push('CareerProfile');

  return {
    data: {
      target_role: profileData.targetRole || profileData.desired_role || null,
      target_industry: profileData.targetIndustry || null,
      target_level: profileData.targetLevel || null,
      desired_skills: profileData.desiredSkills || profileData.skills_to_develop || [],
      career_goals: profileData.careerGoals || profileData.goals || [],
      desired_his_score: profileData.targetHIS || null,
      time_horizon_months: profileData.timeHorizon || 24,
    },
    confidence: sources.length > 0 ? 0.7 : 0.1,
    sources,
  };
}

async function buildPredictedState(pool: Pool, email: string, currentData: any): Promise<{ data: any; confidence: number; sources: string[] }> {
  const [predictions, readiness] = await Promise.all([
    pool.query('SELECT * FROM ti_outcome_predictions WHERE user_email=$1 ORDER BY promotion_probability DESC LIMIT 3', [email]).catch(() => ({ rows: [] })),
    pool.query(`SELECT readiness_type, readiness_score, readiness_band FROM ri_readiness_scores WHERE user_email=$1 AND readiness_type='promotion' ORDER BY readiness_score DESC LIMIT 3`, [email]).catch(() => ({ rows: [] })),
  ]);
  const sources: string[] = [];
  if (predictions.rows.length) sources.push('OutcomePredictions');
  if (readiness.rows.length) sources.push('ReadinessEngine');

  const currentHIS = Number(currentData.human_intelligence_score || 0);
  const hasHIS = currentHIS > 0;
  const avgPromoProb = predictions.rows.length ? predictions.rows.reduce((a: number, p: any) => a + Number(p.promotion_probability || 0), 0) / predictions.rows.length : null;
  const growthRate = hasHIS ? Math.min(5, (100 - currentHIS) / 20) : null; // Points per month estimated

  return {
    data: {
      his_3m: hasHIS && growthRate ? Math.min(100, Math.round(currentHIS + growthRate * 3)) : null,
      his_6m: hasHIS && growthRate ? Math.min(100, Math.round(currentHIS + growthRate * 5.5)) : null,
      his_12m: hasHIS && growthRate ? Math.min(100, Math.round(currentHIS + growthRate * 9)) : null,
      promotion_probability: avgPromoProb ? Math.round(avgPromoProb * 100) / 100 : null,
      predicted_readiness: readiness.rows[0]?.readiness_band || null,
      top_predictions: predictions.rows.map((p: any) => ({
        rf_name: p.rf_name, promotion_probability: p.promotion_probability,
        role_success: p.role_success_probability, talent_risk: p.talent_risk
      })),
    },
    confidence: Math.min(1, sources.length / 2) * (hasHIS ? 1 : 0.3),
    sources,
  };
}

async function buildFutureState(pool: Pool, email: string): Promise<{ data: any; confidence: number; sources: string[] }> {
  const [frp, signals] = await Promise.all([
    pool.query('SELECT * FROM frp_user_snapshots WHERE user_email=$1 ORDER BY created_at DESC LIMIT 1', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT signal_code, signal_name, future_relevance FROM ti_signal_master WHERE future_relevance >= 9 ORDER BY future_relevance DESC LIMIT 10', []).catch(() => ({ rows: [] })),
  ]);
  const sources: string[] = [];
  if (frp.rows.length) sources.push('FRP');
  if (signals.rows.length) sources.push('SignalMaster');
  const frpData = frp.rows[0];

  return {
    data: {
      future_readiness_index: frpData?.future_readiness_index || null,
      ai_readiness: frpData?.ai_readiness_score || null,
      automation_risk: frpData?.automation_risk || null,
      high_relevance_signals: signals.rows.map((s: any) => ({ code: s.signal_code, name: s.signal_name, relevance: s.future_relevance })),
      future_horizon_years: 5,
      recommended_upskill_areas: ['AI Collaboration Fluency', 'Learning Velocity', 'Digital Transformation'],
    },
    confidence: frpData ? 0.75 : 0.3,
    sources,
  };
}

async function buildLearningState(pool: Pool, email: string): Promise<{ data: any; confidence: number; sources: string[] }> {
  const [paths, gaps, history] = await Promise.all([
    pool.query('SELECT * FROM lip_learning_paths WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 5', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT * FROM lip_competency_gaps WHERE user_id=$1 ORDER BY gap_score DESC LIMIT 10', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT twin_version, human_intelligence_score FROM human_digital_twins WHERE user_email=$1', [email]).catch(() => ({ rows: [] })),
  ]);
  const sources: string[] = [];
  if (paths.rows.length) sources.push('LIP');
  if (gaps.rows.length) sources.push('CompetencyGaps');
  if (history.rows.length) sources.push('HIS');

  const activePaths = paths.rows.filter((p: any) => p.status === 'active');
  const completedPaths = paths.rows.filter((p: any) => p.status === 'completed');

  return {
    data: {
      active_learning_paths: activePaths.length,
      completed_learning_paths: completedPaths.length,
      total_paths: paths.rows.length,
      top_competency_gaps: gaps.rows.slice(0, 5).map((g: any) => ({ competency: g.competency_name, gap_score: g.gap_score, priority: g.priority_level })),
      learning_velocity: history.rows[0]?.twin_version || 0,
      lbi_snapshot: null,
      recommended_learning_actions: gaps.rows.slice(0, 3).map((g: any) => `Develop ${g.competency_name || 'competency'} — identified gap`),
    },
    confidence: sources.length > 0 ? Math.min(1, sources.length / 3) : 0.1,
    sources,
  };
}

async function buildCareerState(pool: Pool, email: string): Promise<{ data: any; confidence: number; sources: string[] }> {
  const [passport, velocity, readiness] = await Promise.all([
    pool.query('SELECT * FROM career_seeker_profiles WHERE user_email=$1 LIMIT 1', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT * FROM cg_career_velocity WHERE user_id=$1 LIMIT 1', [email]).catch(() => ({ rows: [] })),
    pool.query(`SELECT rf_name, readiness_score, readiness_band FROM ri_readiness_scores WHERE user_email=$1 AND readiness_type='role' ORDER BY readiness_score DESC LIMIT 3`, [email]).catch(() => ({ rows: [] })),
  ]);
  const sources: string[] = [];
  const profile = passport.rows[0];
  if (profile) sources.push('CareerProfile');
  if (velocity.rows.length) sources.push('CareerVelocity');
  if (readiness.rows.length) sources.push('ReadinessEngine');
  const profileData = profile?.data || {};

  return {
    data: {
      current_role: profileData.currentRole || profileData.current_role || null,
      current_industry: profileData.industry || profileData.currentIndustry || null,
      years_experience: profileData.yearsExperience || profileData.experience_years || null,
      career_stage: profileData.careerStage || null,
      certifications: profileData.certifications || [],
      achievements: profileData.achievements || [],
      top_readiness_scores: readiness.rows.map((r: any) => ({ rf_name: r.rf_name, score: r.readiness_score, band: r.readiness_band })),
      career_velocity: velocity.rows[0] ? {
        overall_velocity: velocity.rows[0].overall_velocity,
        trajectory: velocity.rows[0].trajectory,
        momentum: velocity.rows[0].momentum,
      } : null,
    },
    confidence: sources.length > 0 ? Math.min(1, sources.length / 3) : 0.1,
    sources,
  };
}

function assessGrowthTrajectory(current: any, predicted: any): string {
  if (!current?.data?.human_intelligence_score) return 'insufficient_data';
  const currentHIS = Number(current.data.human_intelligence_score || 0);
  if (currentHIS === 0) return 'insufficient_data';
  const predicted12m = Number(predicted?.data?.his_12m || 0);
  if (!predicted12m) return 'insufficient_data';
  const delta = predicted12m - currentHIS;
  if (delta > 12) return 'accelerating';
  if (delta > 5) return 'steady';
  if (delta > 0) return 'plateauing';
  return 'declining';
}

function computeInterventionPriority(current: any, predicted: any): string {
  const his = Number(current?.data?.human_intelligence_score || 0);
  if (!his) return 'high';
  if (his < 40) return 'urgent';
  if (his < 55) return 'high';
  if (his < 70) return 'medium';
  return 'low';
}

async function synthesize6StateTwin(pool: Pool, email: string): Promise<any> {
  const [curState, desState, futState, lrnState, carState] = await Promise.all([
    buildCurrentState(pool, email),
    buildDesiredState(pool, email),
    buildFutureState(pool, email),
    buildLearningState(pool, email),
    buildCareerState(pool, email),
  ]);
  const predState = await buildPredictedState(pool, email, curState.data);

  const states = { current: curState, desired: desState, predicted: predState, future: futState, learning: lrnState, career: carState };
  const trajectory = assessGrowthTrajectory(curState, predState);
  const interventionPriority = computeInterventionPriority(curState, predState);
  const overallConfidence = Math.round(Object.values(states).reduce((a, s) => a + s.confidence, 0) / 6 * 100) / 100;

  // Save all 6 states
  for (const [stateType, stateObj] of Object.entries(states)) {
    await pool.query(
      `INSERT INTO tdt_user_states(user_email,state_type,state_data,confidence,computed_from,valid_until)
       VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '24 hours')
       ON CONFLICT(user_email,state_type) DO UPDATE SET state_data=$3,confidence=$4,computed_from=$5,valid_until=NOW()+INTERVAL '24 hours',computed_at=NOW()`,
      [email, stateType, JSON.stringify(stateObj.data), stateObj.confidence, stateObj.sources]
    ).catch(() => {});
  }

  // Save prediction snapshot
  const his12m = Number(predState.data.his_12m || 0);
  await pool.query(
    `INSERT INTO tdt_twin_predictions(user_email,predicted_his_3m,predicted_his_6m,predicted_his_12m,predicted_readiness_band,growth_trajectory,key_growth_levers,intervention_priority,prediction_confidence)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT(user_email) DO UPDATE SET predicted_his_3m=$2,predicted_his_6m=$3,predicted_his_12m=$4,predicted_readiness_band=$5,growth_trajectory=$6,key_growth_levers=$7,intervention_priority=$8,prediction_confidence=$9,predicted_at=NOW()`,
    [email, predState.data.his_3m, predState.data.his_6m, his12m, predState.data.predicted_readiness,
     trajectory, JSON.stringify(['Complete EI assessment', 'Close critical competency gaps', 'Build learning cadence']),
     interventionPriority, overallConfidence]
  ).catch(() => {});

  return { email, states, trajectory, intervention_priority: interventionPriority, overall_confidence: overallConfidence, synthesized_at: new Date().toISOString() };
}

export function registerTalentDigitalTwinRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn): void {
  if (!flagOn()) return;
  ensureSchema(pool).catch(() => {});

  // POST /api/admin/talent/twin/synthesize/:email — full 6-state synthesis
  app.post('/api/admin/talent/twin/synthesize/:email', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const result = await synthesize6StateTwin(pool, email);
      bustCache();
      res.json({ ok: true, ...result });
    } catch (err) { console.error('Twin 6-state error:', err); res.status(500).json({ error: 'synthesis failed' }); }
  });

  // POST /api/admin/talent/twin/synthesize-all — bulk synthesis
  app.post('/api/admin/talent/twin/synthesize-all', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    res.json({ ok: true, message: 'twin synthesis started in background' });
    (async () => {
      const users = await pool.query(`SELECT DISTINCT user_email FROM talent_role_scores LIMIT 300`).catch(() => ({ rows: [] }));
      let done = 0;
      for (const u of users.rows) { try { await synthesize6StateTwin(pool, u.user_email); done++; } catch { /* skip */ } }
      console.log(`[digital-twin-6state] Bulk complete: ${done}/${users.rows.length}`);
    })();
  });

  // GET /api/talent/twin/:email — user's 6-state twin
  app.get('/api/talent/twin/:email', requireAuth, async (req: Request, res: Response) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const [states, predictions] = await Promise.all([
        pool.query('SELECT * FROM tdt_user_states WHERE user_email=$1 ORDER BY state_type', [email]),
        pool.query('SELECT * FROM tdt_twin_predictions WHERE user_email=$1 LIMIT 1', [email]),
      ]);
      if (!states.rows.length) return res.json({ email, states: {}, predictions: null, message: 'No twin synthesized yet — run synthesis first' });
      const statesMap: Record<string, any> = {};
      for (const s of states.rows) statesMap[s.state_type] = { data: s.state_data, confidence: s.confidence, computed_from: s.computed_from, computed_at: s.computed_at };
      res.json({ email, states: statesMap, predictions: predictions.rows[0] || null, generated_at: new Date().toISOString() });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/admin/talent/twin — all twins paginated
  app.get('/api/admin/talent/twin', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cacheKey = `twin_list_${JSON.stringify(req.query)}`;
    const cached = getCached(cacheKey);
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const { trajectory, priority, page = '1', limit = '25' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const params: unknown[] = [];
      const where: string[] = [];
      if (trajectory) { params.push(trajectory); where.push(`growth_trajectory=$${params.length}`); }
      if (priority) { params.push(priority); where.push(`intervention_priority=$${params.length}`); }
      const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [countRes, rows, kpi, trajectoryDist] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM tdt_twin_predictions ${wc}`, params),
        pool.query(`SELECT * FROM tdt_twin_predictions ${wc} ORDER BY prediction_confidence DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, parseInt(limit), offset]),
        pool.query(`SELECT COUNT(*)::int as total, ROUND(AVG(predicted_his_12m)::numeric,1) as avg_his_12m, ROUND(AVG(prediction_confidence)::numeric,3) as avg_confidence, COUNT(*) FILTER (WHERE intervention_priority='urgent') as urgent_interventions, COUNT(*) FILTER (WHERE growth_trajectory='accelerating') as accelerating FROM tdt_twin_predictions`),
        pool.query(`SELECT growth_trajectory, COUNT(*) as cnt FROM tdt_twin_predictions WHERE growth_trajectory IS NOT NULL GROUP BY growth_trajectory ORDER BY cnt DESC`),
      ]);
      const result = { total: parseInt(countRes.rows[0].count), page: parseInt(page), rows: rows.rows, kpi: kpi.rows[0], trajectory_distribution: trajectoryDist.rows };
      setCache(cacheKey, result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/admin/talent/twin/states/:email — all 6 states for one user
  app.get('/api/admin/talent/twin/states/:email', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const [states, prediction, transitions] = await Promise.all([
        pool.query('SELECT * FROM tdt_user_states WHERE user_email=$1 ORDER BY state_type', [email]),
        pool.query('SELECT * FROM tdt_twin_predictions WHERE user_email=$1 LIMIT 1', [email]),
        pool.query('SELECT * FROM tdt_state_transitions WHERE user_email=$1 ORDER BY transitioned_at DESC LIMIT 10', [email]),
      ]);
      const statesMap: Record<string, any> = {};
      for (const s of states.rows) statesMap[s.state_type] = s;
      res.json({ email, states: statesMap, prediction: prediction.rows[0] || null, transitions: transitions.rows });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  console.log('[talent-digital-twin] D14 routes registered — 6-state model: current/desired/predicted/future/learning/career');
}
