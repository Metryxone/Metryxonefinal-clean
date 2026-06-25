/**
 * Career Intelligence Hub — composition API
 *
 * Reads from existing tables (career_memory_snapshots, capadex_behavioural_memory,
 * wcl0_user_intelligence, learn_recommendations) and calls existing services
 * (wc3/forecast-intelligence). Additive, read-only, never-throws.
 *
 * All endpoints: requireAuth, user resolved from session (not client-supplied id).
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { computeUserForecasts } from '../services/wc3/forecast-intelligence';

function getEmail(req: Request): string | null {
  // Career-seeker accounts store their email in `username` (login is by email),
  // so fall back to it when the `email` field is absent — without it the self
  // hub reports auth_required for an authenticated candidate.
  return (
    (req as any).user?.email ??
    (req as any).user?.username ??
    (req as any).session?.email ??
    (req.query?.email as string) ??
    null
  );
}
function getUserId(req: Request): string | null {
  const u = (req as any).user;
  return u?.id != null ? String(u.id) : null;
}
function safe(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}
function safeArr(v: unknown): any[] {
  return Array.isArray(v) ? v : [];
}

const MARKET_ROLES = [
  { id: 'swe',         title: 'Software Engineer',       family: 'Engineering', minEI: 40, demandScore: 90, automationRisk: 25, salaryP50: 22, competencies: [{id:'programming',req:4},{id:'systems-design',req:3},{id:'cloud',req:2},{id:'collaboration',req:3}] },
  { id: 'senior-swe',  title: 'Senior Software Engineer', family: 'Engineering', minEI: 55, demandScore: 92, automationRisk: 22, salaryP50: 35, competencies: [{id:'programming',req:5},{id:'systems-design',req:4},{id:'cloud',req:3},{id:'drive',req:3}] },
  { id: 'tech-lead',   title: 'Tech Lead',                family: 'Engineering', minEI: 65, demandScore: 85, automationRisk: 18, salaryP50: 50, competencies: [{id:'programming',req:4},{id:'systems-design',req:5},{id:'people-mgmt',req:3},{id:'strategy',req:3}] },
  { id: 'eng-mgr',     title: 'Engineering Manager',      family: 'Leadership',  minEI: 70, demandScore: 80, automationRisk: 15, salaryP50: 65, competencies: [{id:'people-mgmt',req:4},{id:'strategy',req:4},{id:'stakeholder-mgmt',req:4},{id:'mentoring',req:3}] },
  { id: 'ml-eng',      title: 'ML Engineer',              family: 'Data',        minEI: 55, demandScore: 94, automationRisk: 20, salaryP50: 40, competencies: [{id:'programming',req:5},{id:'statistics',req:4},{id:'data-engineering',req:4},{id:'cloud',req:3}] },
  { id: 'ds',          title: 'Data Scientist',           family: 'Data',        minEI: 45, demandScore: 88, automationRisk: 30, salaryP50: 28, competencies: [{id:'statistics',req:4},{id:'programming',req:3},{id:'data-analysis',req:4},{id:'research',req:3}] },
  { id: 'de',          title: 'Data Engineer',            family: 'Data',        minEI: 45, demandScore: 85, automationRisk: 28, salaryP50: 26, competencies: [{id:'data-engineering',req:4},{id:'programming',req:3},{id:'cloud',req:3}] },
  { id: 'pm',          title: 'Product Manager',          family: 'Product',     minEI: 60, demandScore: 82, automationRisk: 20, salaryP50: 40, competencies: [{id:'strategy',req:4},{id:'stakeholder-mgmt',req:4},{id:'business-acumen',req:4},{id:'writing',req:3}] },
  { id: 'devops',      title: 'DevOps Engineer',          family: 'Engineering', minEI: 45, demandScore: 86, automationRisk: 32, salaryP50: 24, competencies: [{id:'cloud',req:5},{id:'security',req:3},{id:'process',req:4},{id:'programming',req:3}] },
  { id: 'security-eng',title: 'Security Engineer',        family: 'Engineering', minEI: 50, demandScore: 90, automationRisk: 20, salaryP50: 32, competencies: [{id:'security',req:5},{id:'programming',req:3},{id:'systems-design',req:3}] },
  { id: 'consultant',  title: 'Management Consultant',    family: 'Consulting',  minEI: 65, demandScore: 75, automationRisk: 28, salaryP50: 50, competencies: [{id:'strategy',req:4},{id:'business-acumen',req:5},{id:'presentation',req:4},{id:'research',req:4}] },
  { id: 'ux',          title: 'UX Designer',              family: 'Design',      minEI: 40, demandScore: 78, automationRisk: 22, salaryP50: 18, competencies: [{id:'design-thinking',req:4},{id:'visual-design',req:4},{id:'research',req:3}] },
] as const;

function computeSwitchability(levels: Record<string,number>, ei: number, role: typeof MARKET_ROLES[number]): number {
  const met = role.competencies.filter(rc => (levels[rc.id] ?? 0) >= rc.req - 1).length;
  return Math.min(100, Math.round((met / Math.max(1, role.competencies.length)) * 60 + Math.min(1, ei / Math.max(1, role.minEI)) * 40));
}
function computeEta(levels: Record<string,number>, role: typeof MARKET_ROLES[number], vel = 0.15): number {
  const gap = role.competencies.reduce((s, rc) => s + Math.max(0, rc.req - (levels[rc.id] ?? 0)), 0);
  return Math.min(48, Math.max(1, Math.ceil(gap / Math.max(0.05, vel) / 2)));
}
function computeKeyGaps(levels: Record<string,number>, role: typeof MARKET_ROLES[number]): string[] {
  return role.competencies.filter(rc => (levels[rc.id] ?? 0) < rc.req - 1).sort((a,b) => b.req - a.req).slice(0,3).map(rc => rc.id);
}

function extractCompetencyLevels(brain: any): Record<string,number> {
  const levels: Record<string,number> = {};
  const scores = brain?.competencyScores ?? brain?.competencyProfile?.scores ?? {};
  Object.entries(scores).forEach(([k, v]) => {
    const key = String(k).toLowerCase().trim().replace(/\s+/g, '-');
    const val = safe(v);
    if (key && val != null) levels[key] = Math.min(5, Math.round(val / 20));
  });
  return levels;
}

/** Read career_seeker_profiles JSONB — live EI score (assessmentScore) + persona */
async function getLiveProfile(pool: Pool, userId: string): Promise<any> {
  try {
    const { rows } = await pool.query(
      `SELECT data FROM career_seeker_profiles WHERE user_id = $1`,
      [userId]
    );
    return rows[0]?.data ?? null;
  } catch { return null; }
}

/** Read cra_scores — latest competency level per code; raw_score (0–100) → level (0–5) */
async function getLiveCompetencyLevels(pool: Pool, userId: string): Promise<Record<string,number>> {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (competency_code) competency_code, raw_score
         FROM cra_scores WHERE user_id = $1 ORDER BY competency_code, created_at DESC`,
      [userId]
    );
    const levels: Record<string,number> = {};
    rows.forEach((r: any) => {
      const key = String(r.competency_code ?? '').toLowerCase().trim().replace(/[\s_]+/g, '-');
      const val = safe(r.raw_score);
      if (key && val != null) levels[key] = Math.min(5, Math.round(val / 20));
    });
    return levels;
  } catch { return {}; }
}

const SIGNAL_EPS = 0.05;
function computeGrowthDeltas(latest: any, prev: any) {
  const curSigs = safeArr(latest?.signals);
  const prevSigs = safeArr(prev?.signals);
  const prevMap = new Map(prevSigs.map((s: any) => [String(s.key ?? ''), s]));
  const improving: any[] = [], worsening: any[] = [];
  for (const s of curSigs) {
    const key = String(s.key ?? '');
    const before = prevMap.get(key);
    if (!before) continue;
    const delta = (safe(s.strength) ?? 0) - (safe(before.strength) ?? 0);
    if (delta > SIGNAL_EPS) improving.push({ ...s, delta });
    else if (delta < -SIGNAL_EPS) worsening.push({ ...s, delta });
  }
  const curPats = safeArr(latest?.patterns);
  const prevPats = safeArr(prev?.patterns);
  const prevPatMap = new Map(prevPats.map((p: any) => [String(p.key ?? ''), p]));
  const stable: any[] = [], emerging: any[] = [];
  for (const p of curPats) {
    prevPatMap.has(String(p.key ?? '')) ? stable.push(p) : emerging.push(p);
  }
  return { improving_signals: improving, worsening_signals: worsening, stable_patterns: stable, emerging_patterns: emerging };
}

/** Get latest completed CAPADEX concern sessions for a user email */
async function getCapadexContext(pool: Pool, email: string): Promise<any> {
  try {
    const { rows: sessions } = await pool.query(
      `SELECT id, concern_name, stage_code, score, created_at, updated_at
         FROM capadex_sessions WHERE guest_email = $1 AND status = 'completed'
         ORDER BY updated_at DESC LIMIT 5`,
      [email]
    );
    if (!sessions.length) return { session_count: 0, top_patterns: [], recent_concerns: [] };
    const topId = sessions[0].id;
    let patterns: any[] = [];
    try {
      const { rows } = await pool.query(
        `SELECT pattern_key, label, confidence, explanation
           FROM capadex_session_patterns WHERE session_id = $1
           ORDER BY confidence DESC LIMIT 5`,
        [topId]
      );
      patterns = rows;
    } catch {}
    return {
      session_count: sessions.length,
      latest_concern: sessions[0].concern_name ?? null,
      latest_stage: sessions[0].stage_code ?? null,
      latest_score: safe(sessions[0].score),
      last_session_at: sessions[0].updated_at ?? null,
      recent_concerns: sessions.slice(0, 5).map((s: any) => ({
        concern: s.concern_name, stage: s.stage_code, score: safe(s.score), date: s.created_at,
      })),
      top_patterns: patterns.map((p: any) => ({
        key: p.pattern_key, label: p.label, confidence: safe(p.confidence), explanation: p.explanation,
      })),
    };
  } catch { return { session_count: 0, top_patterns: [], recent_concerns: [] }; }
}

/** Get recent Pragati conversation sessions for a user email */
async function getPragatiContext(pool: Pool, email: string): Promise<any> {
  try {
    const { rows } = await pool.query(
      `SELECT initial_concern, stage, quality_score, emotional_weight, drift_direction, turn_count, updated_at
         FROM pragati_sessions WHERE email = $1 ORDER BY updated_at DESC LIMIT 5`,
      [email]
    );
    if (!rows.length) return { session_count: 0, sessions: [] };
    return {
      session_count: rows.length,
      sessions: rows.map((r: any) => ({
        concern: r.initial_concern, stage: r.stage,
        quality_score: safe(r.quality_score), emotional_weight: safe(r.emotional_weight),
        drift_direction: r.drift_direction, turn_count: r.turn_count, last_active: r.updated_at,
      })),
    };
  } catch { return { session_count: 0, sessions: [] }; }
}

/** Compute peer benchmark percentile inline from ei_calculation_logs (k=30 suppression) */
async function computeInlinePeerBenchmark(pool: Pool, eiScore: number): Promise<any> {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE score < $1) AS below_count,
              COUNT(*) AS total_count, AVG(score) AS mean_score
         FROM ei_calculation_logs
         WHERE source = 'resolve' AND fallback_used = false AND score IS NOT NULL`,
      [eiScore]
    );
    if (!rows[0]) return null;
    const total = Number(rows[0].total_count ?? 0);
    const below = Number(rows[0].below_count ?? 0);
    if (total < 30) return { redacted: true, reason: 'insufficient_cohort', cohort_size: total };
    const percentile = Math.round((below / total) * 100);
    return {
      redacted: false, percentile, cohort_size: total,
      mean: rows[0].mean_score != null ? Math.round(Number(rows[0].mean_score) * 10) / 10 : null,
      rank_label: percentile >= 90 ? 'Top 10%' : percentile >= 75 ? 'Top 25%' : percentile >= 50 ? 'Above average' : percentile >= 25 ? 'Below average' : 'Bottom 25%',
    };
  } catch { return null; }
}

export function registerCareerIntelligenceHubRoutes(app: Express, pool: Pool, requireAuth: RequestHandler): void {

  async function getSnapshots(userId: string) {
    try {
      const { rows } = await pool.query(
        `SELECT id, snapshot_at, ei_score, current_stage, target_role, transition_probability,
                core_bottleneck, market_readiness, interview_readiness, signals, patterns,
                interventions, outcomes, brain
           FROM career_memory_snapshots WHERE user_id = $1 ORDER BY snapshot_at DESC LIMIT 12`,
        [userId]
      );
      return rows;
    } catch { return []; }
  }

  /* GET /api/career/hub/summary */
  app.get('/api/career/hub/summary', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req); const email = getEmail(req);
      if (!userId || !email) return void res.status(400).json({ ok: false, error: 'auth_required' });
      const [snaps, liveProfile] = await Promise.all([
        getSnapshots(userId),
        getLiveProfile(pool, userId),
      ]);
      const latest = snaps[0] ?? null; const prev = snaps[1] ?? null;
      const eiNow = safe(latest?.ei_score) ?? safe(liveProfile?.assessmentScore);
      const eiPrev = safe(prev?.ei_score);
      const eiDelta = eiNow != null && eiPrev != null ? Math.round((eiNow - eiPrev) * 10) / 10 : null;
      let riskScore: number | null = null;
      try {
        const { rows } = await pool.query(`SELECT risk_score FROM wcl0_user_intelligence WHERE user_email = $1 ORDER BY computed_at DESC LIMIT 1`, [email]);
        riskScore = rows[0] ? safe(rows[0].risk_score) : null;
      } catch {}
      const marketReadiness = safe(latest?.market_readiness);
      const opportunityScore = eiNow != null ? Math.min(100, Math.round(eiNow * 0.6 + (marketReadiness ?? 50) * 0.4)) : null;
      const transProb = latest?.transition_probability;
      res.json({
        ok: true, snapshot_count: snaps.length,
        ei_score: eiNow, ei_delta: eiDelta,
        transition_probability: transProb != null ? Math.round(Number(transProb) * 100) : null,
        market_readiness: marketReadiness, interview_readiness: safe(latest?.interview_readiness),
        core_bottleneck: latest?.core_bottleneck ?? null, current_stage: latest?.current_stage ?? null,
        target_role: latest?.target_role ?? null, risk_score: riskScore,
        opportunity_score: opportunityScore, last_snapshot_at: latest?.snapshot_at ?? null,
      });
    } catch (err) {
      console.error('[career-hub/summary]', err);
      res.json({ ok: false, snapshot_count: 0, ei_score: null, ei_delta: null, transition_probability: null, market_readiness: null, interview_readiness: null, core_bottleneck: null, current_stage: null, target_role: null, risk_score: null, opportunity_score: null, last_snapshot_at: null });
    }
  });

  /* GET /api/career/hub/memory */
  app.get('/api/career/hub/memory', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req); const email = getEmail(req);
      if (!userId) return void res.status(400).json({ ok: false, error: 'auth_required' });
      const snaps = await getSnapshots(userId);
      const [pragatiCtx, capadexCtx] = await Promise.all([
        email ? getPragatiContext(pool, email) : Promise.resolve({ session_count: 0, sessions: [] }),
        email ? getCapadexContext(pool, email) : Promise.resolve({ session_count: 0, top_patterns: [], recent_concerns: [] }),
      ]);
      if (!snaps.length) return void res.json({ ok: true, snapshot_count: 0, timeline: [], growth: null, signals: [], patterns: [], pragati: pragatiCtx, capadex: capadexCtx });
      const latest = snaps[0]; const prev = snaps[1] ?? null;
      const growth = prev ? computeGrowthDeltas(latest, prev) : null;
      const timeline = [...snaps].reverse().map(s => ({
        id: s.id,
        date: s.snapshot_at,
        ei_score: safe(s.ei_score),
        market_readiness: safe(s.market_readiness),
        interview_readiness: safe(s.interview_readiness),
        transition_probability: s.transition_probability != null ? Math.round(Number(s.transition_probability) * 100) : null,
      }));
      res.json({ ok: true, snapshot_count: snaps.length, timeline, growth, latest_stage: latest.current_stage ?? null, target_role: latest.target_role ?? null, core_bottleneck: latest.core_bottleneck ?? null, signals: safeArr(latest.signals).slice(0, 10), patterns: safeArr(latest.patterns).slice(0, 10), pragati: pragatiCtx, capadex: capadexCtx });
    } catch (err) {
      console.error('[career-hub/memory]', err);
      res.json({ ok: false, snapshot_count: 0, timeline: [], growth: null, signals: [], patterns: [], pragati: null, capadex: null });
    }
  });

  /* GET /api/career/hub/trajectory */
  app.get('/api/career/hub/trajectory', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return void res.status(400).json({ ok: false, error: 'auth_required' });
      const snaps = await getSnapshots(userId);
      const latest = snaps[0] ?? null;
      const brain = latest?.brain ?? {};
      const [liveLevels, liveProfile] = await Promise.all([
        getLiveCompetencyLevels(pool, userId),
        getLiveProfile(pool, userId),
      ]);
      const snapLevels = extractCompetencyLevels(brain);
      const levels = Object.keys(liveLevels).length > 0 ? liveLevels : snapLevels;
      const eiScore = safe(latest?.ei_score) ?? safe(liveProfile?.assessmentScore) ?? 50;
      const vel = brain.learningVelocity ?? 0.15;
      const roles = MARKET_ROLES.map(role => ({
        id: role.id, title: role.title, family: role.family,
        switchability: computeSwitchability(levels, eiScore, role),
        eta_months: computeEta(levels, role, vel),
        key_gaps: computeKeyGaps(levels, role),
        demand_score: role.demandScore,
        automation_risk: role.automationRisk,
        salary_p50: role.salaryP50,
        min_ei: role.minEI,
        reachable: eiScore >= role.minEI * 0.7,
      })).sort((a, b) => b.switchability - a.switchability);
      const topRole = roles[0] ?? null;
      const peer_benchmark = await computeInlinePeerBenchmark(pool, eiScore);
      res.json({
        ok: true, computed_from_snapshot: latest?.snapshot_at ?? null,
        ei_score: eiScore, competency_levels: levels,
        top_transition: topRole, roles: roles.slice(0, 8),
        current_stage: latest?.current_stage ?? null, target_role: latest?.target_role ?? null,
        transition_probability: latest?.transition_probability != null ? Math.round(Number(latest.transition_probability) * 100) : null,
        peer_benchmark,
      });
    } catch (err) {
      console.error('[career-hub/trajectory]', err);
      res.json({ ok: false, roles: [], top_transition: null });
    }
  });

  /* GET /api/career/hub/forecast */
  app.get('/api/career/hub/forecast', requireAuth, async (req: Request, res: Response) => {
    try {
      const email = getEmail(req);
      if (!email) return void res.status(400).json({ ok: false, error: 'auth_required' });
      const result = await computeUserForecasts(pool, email);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[career-hub/forecast]', err);
      res.json({ ok: false, enabled: false, reason: 'error' });
    }
  });

  /* GET /api/career/hub/outcomes */
  app.get('/api/career/hub/outcomes', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return void res.status(400).json({ ok: false, error: 'auth_required' });
      const snaps = await getSnapshots(userId);
      const allOutcomes: any[] = [];
      const allInterventions: any[] = [];
      snaps.forEach(s => {
        safeArr(s.outcomes).forEach((o: any) => allOutcomes.push({ ...o, snapshot_at: s.snapshot_at }));
        safeArr(s.interventions).forEach((i: any) => allInterventions.push({ ...i, snapshot_at: s.snapshot_at }));
      });
      const ei_timeline = [...snaps].reverse().map(s => ({ date: s.snapshot_at, ei: safe(s.ei_score) })).filter(p => p.ei != null);
      const attributions = allInterventions.slice(0, 20).map((intervention: any) => {
        const snap_idx = snaps.findIndex(s => s.snapshot_at === intervention.snapshot_at);
        const next_snap = snaps[snap_idx - 1] ?? null;
        const ei_before = safe(snaps[snap_idx]?.ei_score);
        const ei_after = safe(next_snap?.ei_score);
        const ei_delta = ei_before != null && ei_after != null ? Math.round((ei_after - ei_before) * 10) / 10 : null;
        return {
          key: intervention.key ?? intervention.intervention_key ?? 'unknown',
          label: intervention.label ?? intervention.title ?? 'Intervention',
          strength: safe(intervention.strength) ?? 0,
          status: intervention.status ?? 'completed',
          ei_delta, snapshot_at: intervention.snapshot_at,
        };
      });
      const realized = attributions.filter(a => a.ei_delta != null && a.ei_delta > 0);
      res.json({ ok: true, snapshot_count: snaps.length, attributions, realized_count: realized.length, outcomes: allOutcomes.slice(0, 20), ei_timeline });
    } catch (err) {
      console.error('[career-hub/outcomes]', err);
      res.json({ ok: false, attributions: [], realized_count: 0, outcomes: [], ei_timeline: [] });
    }
  });

  /* GET /api/career/hub/interventions */
  app.get('/api/career/hub/interventions', requireAuth, async (req: Request, res: Response) => {
    try {
      const email = getEmail(req);
      if (!email) return void res.status(400).json({ ok: false, error: 'auth_required' });
      let recommendations: any[] = [];
      try {
        const { rows } = await pool.query(
          `SELECT id, title, description, target_dimension, effort_level, time_to_complete,
                  estimated_impact, is_actioned, created_at
             FROM learn_recommendations WHERE user_email = $1 ORDER BY is_actioned ASC, created_at DESC LIMIT 30`,
          [email]
        );
        recommendations = rows;
      } catch {}
      const active = recommendations.filter(r => !r.is_actioned);
      const done = recommendations.filter(r => r.is_actioned);
      res.json({ ok: true, total: recommendations.length, active_count: active.length, done_count: done.length, recommendations, active, done });
    } catch (err) {
      console.error('[career-hub/interventions]', err);
      res.json({ ok: false, recommendations: [], active: [], done: [] });
    }
  });

  /* GET /api/career/hub/risk-opportunity */
  app.get('/api/career/hub/risk-opportunity', requireAuth, async (req: Request, res: Response) => {
    try {
      const email = getEmail(req); const userId = getUserId(req);
      if (!email || !userId) return void res.status(400).json({ ok: false, error: 'auth_required' });
      let behavDims: any = null;
      try {
        const { rows } = await pool.query(
          `SELECT motivation_score, confidence_score, risk_score, engagement_score, adaptability_score,
                  learning_style, persona, computed_at
             FROM wcl0_user_intelligence WHERE user_email = $1 ORDER BY computed_at DESC LIMIT 1`,
          [email]
        );
        if (rows[0]) behavDims = rows[0];
      } catch {}
      const [snaps, liveProfile] = await Promise.all([getSnapshots(userId), getLiveProfile(pool, userId)]);
      const latest = snaps[0] ?? null;
      const eiNow = safe(latest?.ei_score) ?? safe(liveProfile?.assessmentScore) ?? 0;
      // When wcl0 table has no row yet, derive estimated dims from EI (labelled as estimated in response)
      if (!behavDims && eiNow > 0) {
        const r = Math.min(1, eiNow / 100);
        behavDims = { motivation_score: r * 0.85, confidence_score: r * 0.80, risk_score: Math.max(0.05, 1 - r * 0.7), engagement_score: r * 0.90, adaptability_score: r * 0.75, learning_style: null, _derived: true };
      }
      const marketReadiness = safe(latest?.market_readiness) ?? 0;
      const signals = safeArr(latest?.signals);
      const riskSignals = signals.filter((s: any) => (s.type ?? s.status ?? '') === 'risk' || (safe(s.strength) ?? 0) < 0.3).slice(0,5);
      const riskScore = behavDims?.risk_score != null ? Math.min(100, Math.round(Number(behavDims.risk_score) * 100)) : null;
      const opportunityScore = Math.min(100, Math.round(eiNow * 0.5 + marketReadiness * 0.3 + (behavDims?.adaptability_score != null ? Number(behavDims.adaptability_score) * 20 : 0)));
      const automationExposure = snaps.length > 0 ? Math.max(0, 100 - eiNow) : null;
      res.json({
        ok: true, risk_score: riskScore, opportunity_score: opportunityScore,
        automation_exposure: automationExposure,
        dims: behavDims ? {
          motivation: safe(behavDims.motivation_score),
          confidence: safe(behavDims.confidence_score),
          risk: safe(behavDims.risk_score),
          engagement: safe(behavDims.engagement_score),
          adaptability: safe(behavDims.adaptability_score),
        } : null,
        dims_source: (behavDims as any)?._derived ? 'ei_estimated' : (behavDims ? 'behavioural_engine' : null),
        risk_signals: riskSignals, market_readiness: marketReadiness,
        ei_score: eiNow, learning_style: behavDims?.learning_style ?? null,
        computed_at: behavDims?.computed_at ?? latest?.snapshot_at ?? null,
      });
    } catch (err) {
      console.error('[career-hub/risk-opportunity]', err);
      res.json({ ok: false, risk_score: null, opportunity_score: null, dims: null, risk_signals: [] });
    }
  });

  /* GET /api/career/hub/report */
  app.get('/api/career/hub/report', requireAuth, async (req: Request, res: Response) => {
    try {
      const email = getEmail(req); const userId = getUserId(req);
      if (!email || !userId) return void res.status(400).json({ ok: false, error: 'auth_required' });
      const [snaps, liveProfile] = await Promise.all([getSnapshots(userId), getLiveProfile(pool, userId)]);
      const latest = snaps[0] ?? null;
      const eiNow = safe(latest?.ei_score) ?? safe(liveProfile?.assessmentScore);
      const sections: { title: string; content: string; type: string; deep_link_tab?: string }[] = [];

      if (eiNow != null) {
        const band = eiNow >= 75 ? 'Elite' : eiNow >= 55 ? 'Strong' : eiNow >= 35 ? 'Developing' : 'Foundation';
        sections.push({ type: 'ei', title: 'Current Standing', deep_link_tab: 'memory', content: `Your Employability Index stands at ${Math.round(eiNow)} — ${band} tier. ${snaps.length >= 2 ? `Tracked across ${snaps.length} snapshots, your profile demonstrates longitudinal engagement with career development.` : 'Begin completing your profile and running assessments to build your intelligence history.'}` });
      }
      if (latest?.target_role) {
        const tp = latest.transition_probability != null ? `Transition probability: ${Math.round(Number(latest.transition_probability) * 100)}%.` : 'Complete a competency assessment to unlock your transition probability.';
        sections.push({ type: 'trajectory', title: 'Target Role Trajectory', deep_link_tab: 'transition', content: `Your current path targets the ${latest.target_role} role. ${tp}${latest.core_bottleneck ? ` Primary bottleneck: ${latest.core_bottleneck}.` : ''}` });
      }
      if (latest?.market_readiness != null) {
        const mr = Math.round(Number(latest.market_readiness));
        sections.push({ type: 'market', title: 'Market Readiness', deep_link_tab: 'trajectory', content: `Market readiness: ${mr}/100. ${mr >= 70 ? 'You are positioned well relative to current market demand.' : 'Focused competency development in your gap areas will accelerate market positioning.'}${latest.interview_readiness != null ? ` Interview readiness: ${Math.round(Number(latest.interview_readiness))}/100.` : ''}` });
      }
      const riskSignals = safeArr(latest?.signals).filter((s: any) => (safe(s.strength) ?? 0) < 0.3).slice(0, 3);
      if (riskSignals.length > 0) {
        sections.push({ type: 'risk', title: 'Risk Signals', deep_link_tab: 'risk', content: `${riskSignals.length} active risk signal${riskSignals.length > 1 ? 's' : ''} detected: ${riskSignals.map((s: any) => s.label ?? s.key ?? 'signal').join(', ')}. Visit the Risk & Opportunity tab for mitigation guidance.` });
      }
      const topInterventions = safeArr(latest?.interventions).slice(0, 3);
      if (topInterventions.length > 0) {
        sections.push({ type: 'interventions', title: 'Recommended Next Steps', deep_link_tab: 'interventions', content: `${topInterventions.length} career intervention${topInterventions.length > 1 ? 's' : ''} recommended: ${topInterventions.map((i: any) => i.label ?? i.title ?? 'action').join(', ')}. See the Interventions tab for effort and impact scoring.` });
      }
      if (!sections.length) {
        sections.push({ type: 'empty', title: 'Build Your Intelligence Profile', deep_link_tab: 'memory', content: 'Complete your career profile, run a competency assessment, and track at least one career memory snapshot to unlock your personalised Career Intelligence Report.' });
      }
      res.json({ ok: true, sections, generated_at: new Date().toISOString(), snapshot_count: snaps.length, email });
    } catch (err) {
      console.error('[career-hub/report]', err);
      res.json({ ok: false, sections: [] });
    }
  });

  /* GET /api/career/hub/transition — Role Transition Intelligence (8th surface) */
  app.get('/api/career/hub/transition', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return void res.status(400).json({ ok: false, error: 'auth_required' });

      const [snaps, liveLevels] = await Promise.all([
        getSnapshots(userId),
        getLiveCompetencyLevels(pool, userId),
      ]);
      const latest = snaps[0] ?? null;
      const brain = latest?.brain ?? {};
      const snapLevels = extractCompetencyLevels(brain);
      const levels = Object.keys(liveLevels).length > 0 ? liveLevels : snapLevels;
      const eiScore = safe(latest?.ei_score) ?? 50;
      const vel = brain.learningVelocity ?? 0.15;

      const scoredRoles = (MARKET_ROLES as any[]).map(role => ({
        ...role,
        switchability: computeSwitchability(levels, eiScore, role),
        eta_months:    computeEta(levels, role, vel),
        key_gaps:      computeKeyGaps(levels, role),
      }));

      // Detect current role from brain or snapshot stage
      const currentRoleRaw = brain.currentRole ?? latest?.current_stage ?? null;
      const currentScored = currentRoleRaw
        ? (scoredRoles.find(r => r.title.toLowerCase() === String(currentRoleRaw).toLowerCase())
           ?? scoredRoles.find(r => String(currentRoleRaw).toLowerCase().includes(r.id)))
        : null;

      // Detect target role from snapshot or brain
      const targetRoleRaw = latest?.target_role ?? brain.targetRole ?? null;
      const targetScored = targetRoleRaw
        ? (scoredRoles.find(r => r.title.toLowerCase() === String(targetRoleRaw).toLowerCase())
           ?? scoredRoles.find(r => String(targetRoleRaw).toLowerCase().includes(r.id)))
          ?? [...scoredRoles].sort((a, b) => b.demandScore - a.demandScore)[0]
        : [...scoredRoles]
            .sort((a, b) => b.switchability - a.switchability)
            .find(r => r.id !== currentScored?.id) ?? scoredRoles[0];

      // Bridge roles: higher switchability than target, share ≥1 competency with target
      const targetCompIds = new Set((targetScored as any).competencies.map((c: any) => c.id));
      const bridgeRoles = scoredRoles
        .filter(r => r.id !== targetScored.id && r.id !== currentScored?.id)
        .filter(r => r.switchability >= Math.max(30, targetScored.switchability - 10))
        .filter(r => r.competencies.filter((c: any) => targetCompIds.has(c.id)).length >= 1)
        .sort((a, b) => {
          const aOv = a.competencies.filter((c: any) => targetCompIds.has(c.id)).length;
          const bOv = b.competencies.filter((c: any) => targetCompIds.has(c.id)).length;
          return (bOv * 20 + b.switchability) - (aOv * 20 + a.switchability);
        })
        .slice(0, 2);

      const path: any[] = [];
      if (currentScored) {
        path.push({ step: 'current', role: currentScored, label: 'Where you are now', switchability: 100, eta_months: 0, key_gaps: [] });
      }
      bridgeRoles.forEach((br, i) => {
        path.push({ step: `bridge_${i + 1}`, role: br, label: `Bridge role ${i + 1}`, switchability: br.switchability, eta_months: br.eta_months, key_gaps: br.key_gaps });
      });
      path.push({ step: 'target', role: targetScored, label: 'Your target destination', switchability: targetScored.switchability, eta_months: targetScored.eta_months, key_gaps: targetScored.key_gaps });

      const totalEta = path.filter(p => p.step !== 'current').reduce((s, p) => s + (p.eta_months ?? 0), 0);

      res.json({
        ok: true, path,
        current_role: currentScored ?? null,
        target_role: targetScored,
        bridge_count: bridgeRoles.length,
        total_eta_months: totalEta,
        overall_switchability: targetScored.switchability,
        transition_probability: latest?.transition_probability != null ? Math.round(Number(latest.transition_probability) * 100) : null,
        live_competency_used: Object.keys(liveLevels).length > 0,
        computed_from_snapshot: latest?.snapshot_at ?? null,
        competency_levels: levels,
        learning_velocity: vel,
      });
    } catch (err) {
      console.error('[career-hub/transition]', err);
      res.json({ ok: false, path: [], current_role: null, target_role: null, bridge_count: 0, total_eta_months: 0 });
    }
  });

  /* GET /api/career/hub/onboarding — 5-step completion checker */
  app.get('/api/career/hub/onboarding', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req); const email = getEmail(req);
      if (!userId || !email) return void res.status(400).json({ ok: false });
      const [profileRes, competencyRes, capadexRes, pragatiRes, snapshotRes] = await Promise.allSettled([
        pool.query(`SELECT 1 FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`, [userId]),
        pool.query(`SELECT 1 FROM cra_scores WHERE user_id = $1 LIMIT 1`, [userId]),
        pool.query(`SELECT 1 FROM capadex_sessions WHERE guest_email = $1 AND status = 'completed' LIMIT 1`, [email]),
        pool.query(`SELECT 1 FROM pragati_sessions WHERE email = $1 LIMIT 1`, [email]),
        pool.query(`SELECT 1 FROM career_memory_snapshots WHERE user_id = $1 LIMIT 1`, [userId]),
      ]);
      const hasProfile  = profileRes.status === 'fulfilled'  && profileRes.value.rows.length > 0;
      const hasComp     = competencyRes.status === 'fulfilled' && competencyRes.value.rows.length > 0;
      const hasCapadex  = capadexRes.status === 'fulfilled'  && capadexRes.value.rows.length > 0;
      const hasPragati  = pragatiRes.status === 'fulfilled'  && pragatiRes.value.rows.length > 0;
      const hasSnapshot = snapshotRes.status === 'fulfilled' && snapshotRes.value.rows.length > 0;
      const steps = [
        { id: 'profile',    label: 'Complete your career profile',       done: hasProfile,  cta_label: 'Go to My Profile' },
        { id: 'competency', label: 'Run a competency assessment',         done: hasComp,     cta_label: 'Take Assessment' },
        { id: 'capadex',    label: 'Complete a CAPADEX concern session',  done: hasCapadex,  cta_label: 'Start CAPADEX' },
        { id: 'pragati',    label: 'Start a Pragati conversation',        done: hasPragati,  cta_label: 'Open Pragati' },
        { id: 'snapshot',   label: 'Track your first career snapshot',    done: hasSnapshot, cta_label: 'Update Profile' },
      ];
      const completedCount = steps.filter(s => s.done).length;
      res.json({ ok: true, steps, completed_count: completedCount, total: steps.length, completion_pct: Math.round((completedCount / steps.length) * 100), fully_onboarded: completedCount === steps.length });
    } catch (err) {
      console.error('[career-hub/onboarding]', err);
      res.json({ ok: false, steps: [], completed_count: 0, total: 5, completion_pct: 0 });
    }
  });

  /* PATCH /api/career/hub/interventions/:id/action — mark a recommendation done */
  app.patch('/api/career/hub/interventions/:id/action', requireAuth, async (req: Request, res: Response) => {
    try {
      const email = getEmail(req);
      if (!email) return void res.status(401).json({ ok: false });
      const { id } = req.params;
      const { rows } = await pool.query(
        `UPDATE learn_recommendations SET is_actioned = true
           WHERE id = $1 AND user_email = $2 RETURNING id, is_actioned`,
        [id, email]
      );
      if (!rows[0]) return void res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, id: rows[0].id, is_actioned: rows[0].is_actioned });
    } catch (err) {
      console.error('[career-hub/interventions/:id/action]', err);
      res.status(500).json({ ok: false });
    }
  });

  /* GET /api/career/hub/capadex-context — CAPADEX concern data for Memory tab enrichment */
  app.get('/api/career/hub/capadex-context', requireAuth, async (req: Request, res: Response) => {
    try {
      const email = getEmail(req);
      if (!email) return void res.status(401).json({ ok: false });
      const ctx = await getCapadexContext(pool, email);
      res.json({ ok: true, ...ctx });
    } catch (err) {
      console.error('[career-hub/capadex-context]', err);
      res.json({ ok: false, session_count: 0, top_patterns: [] });
    }
  });
}
