/**
 * D9 — Unified Role Readiness Engine
 * Four coordinated readiness types: Role, Promotion, Leadership, Managerial.
 * Reads existing talent_role_scores + talent_gaps + rp_level_profiles + EI/LBI.
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
    CREATE TABLE IF NOT EXISTS ri_readiness_scores (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      readiness_type TEXT NOT NULL CHECK (readiness_type IN ('role','promotion','leadership','managerial')),
      rf_id INTEGER,
      rf_name TEXT,
      target_level TEXT,
      current_level TEXT,
      readiness_score NUMERIC(5,2) DEFAULT 0,
      success_probability NUMERIC(5,4) DEFAULT 0,
      readiness_band TEXT CHECK (readiness_band IN ('ready_now','ready_6m','ready_12m','ready_18m+','not_ready')) DEFAULT 'not_ready',
      gap_priority_areas JSONB DEFAULT '[]',
      strengths JSONB DEFAULT '[]',
      development_actions JSONB DEFAULT '[]',
      confidence NUMERIC(5,4) DEFAULT 0,
      data_sources JSONB DEFAULT '[]',
      computed_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, readiness_type, rf_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ri_readiness_email ON ri_readiness_scores(user_email);
    CREATE INDEX IF NOT EXISTS idx_ri_readiness_type ON ri_readiness_scores(readiness_type);
    CREATE INDEX IF NOT EXISTS idx_ri_readiness_band ON ri_readiness_scores(readiness_band);
    CREATE TABLE IF NOT EXISTS ri_readiness_history (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      readiness_type TEXT NOT NULL,
      rf_id INTEGER,
      readiness_score NUMERIC(5,2),
      readiness_band TEXT,
      snapshot_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ri_history_email ON ri_readiness_history(user_email);
  `);
  schemaReady = true;
}

// ── Scoring Engine ────────────────────────────────────────────────────────────

function getBand(score: number): string {
  if (score >= 85) return 'ready_now';
  if (score >= 70) return 'ready_6m';
  if (score >= 55) return 'ready_12m';
  if (score >= 40) return 'ready_18m+';
  return 'not_ready';
}

function successProb(readiness: number): number {
  // Logistic-inspired: S-curve from 0.05 at score=0 to 0.97 at score=100
  return Math.round((1 / (1 + Math.exp(-0.08 * (readiness - 55)))) * 1000) / 1000;
}

interface UserData {
  talent_scores: any[];
  talent_gaps: any[];
  level_profiles: any[];
  ei_score: number | null;
  lbi_score: number | null;
  csi_score: number | null;
}

async function fetchUserData(pool: Pool, email: string): Promise<UserData> {
  const [scores, gaps, profiles, ei, lbi, csi] = await Promise.all([
    pool.query('SELECT * FROM talent_role_scores WHERE user_email=$1 ORDER BY composite_score DESC LIMIT 15', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT * FROM talent_gaps WHERE user_email=$1 ORDER BY gap_score DESC LIMIT 20', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT * FROM rp_level_profiles ORDER BY rf_id, level_order LIMIT 100', []).catch(() => ({ rows: [] })),
    pool.query('SELECT overall_ei FROM mei_scores WHERE user_email=$1 ORDER BY computed_at DESC LIMIT 1', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT overall_lbi FROM lbi_scores WHERE user_email=$1 ORDER BY created_at DESC LIMIT 1', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT csi_score FROM csi_profiles WHERE user_email=$1 LIMIT 1', [email]).catch(() => ({ rows: [] })),
  ]);
  return {
    talent_scores: scores.rows,
    talent_gaps: gaps.rows,
    level_profiles: profiles.rows,
    ei_score: ei.rows[0] ? Number(ei.rows[0].overall_ei) : null,
    lbi_score: lbi.rows[0] ? Number(lbi.rows[0].overall_lbi) : null,
    csi_score: csi.rows[0] ? Number(csi.rows[0].csi_score) : null,
  };
}

function computeRoleReadiness(data: UserData, rfId: number): { score: number; strengths: string[]; gaps: string[]; actions: string[]; confidence: number; sources: string[] } {
  const score = data.talent_scores.find(s => s.rf_id === rfId);
  if (!score) return { score: 0, strengths: [], gaps: ['No talent score available — complete assessments first'], actions: ['Complete MEI/LBI assessments to unlock scoring'], confidence: 0, sources: [] };

  const compositeScore = Number(score.composite_score || 0);
  const gaps = data.talent_gaps.filter(g => g.rf_id === rfId && g.severity !== 'none');
  const criticalGaps = gaps.filter(g => g.severity === 'critical');
  const moderateGaps = gaps.filter(g => g.severity === 'moderate');

  // Penalise for critical gaps
  const gapPenalty = criticalGaps.length * 8 + moderateGaps.length * 3;
  const readinessScore = Math.max(0, Math.min(100, compositeScore - gapPenalty));

  const sources: string[] = [];
  if (score.ei_score) sources.push('EI');
  if (score.lbi_score) sources.push('LBI');
  if (score.competency_score) sources.push('Competency');
  if (score.csi_score) sources.push('CSI');
  const confidence = sources.length / 4;

  return {
    score: readinessScore,
    strengths: criticalGaps.length === 0 ? ['Strong overall competency alignment', 'No critical gaps identified'] : ['Foundation competencies present'],
    gaps: [...criticalGaps.map((g: any) => `Critical gap: ${g.blueprint_key || 'Core competency'} (gap score: ${g.gap_score})`), ...moderateGaps.slice(0,2).map((g: any) => `Moderate gap: ${g.blueprint_key || 'Supporting competency'}`)],
    actions: criticalGaps.length > 0 ? criticalGaps.slice(0,3).map((g: any) => `Close critical gap in ${g.blueprint_key || 'key competency area'} — targeted development needed`) : ['Maintain current performance', 'Build depth in top competency areas'],
    confidence,
    sources,
  };
}

function computePromotionReadiness(data: UserData, rfId: number): { score: number; currentLevel: string; targetLevel: string; strengths: string[]; gaps: string[]; actions: string[]; confidence: number } {
  const score = data.talent_scores.find(s => s.rf_id === rfId);
  if (!score) return { score: 0, currentLevel: 'unknown', targetLevel: 'unknown', strengths: [], gaps: ['Insufficient data'], actions: ['Complete full assessment suite'], confidence: 0 };

  const compositeScore = Number(score.composite_score || 0);
  const profiles = data.level_profiles.filter(p => p.rf_id === rfId);
  const sortedProfiles = profiles.sort((a: any, b: any) => a.level_order - b.level_order);

  // Determine current level from score
  let currentLevel = 'Junior';
  let targetLevel = 'Mid-Level';
  for (const p of sortedProfiles) {
    const threshold = Number(p.competency_thresholds?.minimum_composite || 0);
    if (compositeScore >= threshold) { currentLevel = p.level_name; }
  }
  const currentIdx = sortedProfiles.findIndex((p: any) => p.level_name === currentLevel);
  if (currentIdx < sortedProfiles.length - 1) targetLevel = sortedProfiles[currentIdx + 1]?.level_name || 'Senior';

  // Promotion readiness = how close to NEXT level threshold
  const nextProfile = sortedProfiles[currentIdx + 1];
  const nextThreshold = Number(nextProfile?.competency_thresholds?.minimum_composite || 100);
  const currentThreshold = Number(sortedProfiles[currentIdx]?.competency_thresholds?.minimum_composite || 0);
  const progressToNext = nextProfile ? Math.min(100, ((compositeScore - currentThreshold) / (nextThreshold - currentThreshold)) * 100) : 100;

  // Blend with EI and LBI for leadership readiness at senior+ levels
  let finalScore = progressToNext;
  const sources: string[] = ['TalentScore'];
  if (data.ei_score && (targetLevel === 'Lead' || targetLevel === 'Senior' || targetLevel === 'Executive')) {
    finalScore = finalScore * 0.7 + data.ei_score * 0.3;
    sources.push('EI');
  }
  if (data.lbi_score) { finalScore = finalScore * 0.85 + data.lbi_score * 0.15; sources.push('LBI'); }

  const criticalGaps = data.talent_gaps.filter(g => g.rf_id === rfId && g.severity === 'critical');
  const confidence = sources.length / 3;

  return {
    score: Math.round(finalScore),
    currentLevel,
    targetLevel,
    strengths: compositeScore > 65 ? ['Strong competency foundation', 'Above-average role performance'] : ['Developing competency base'],
    gaps: criticalGaps.slice(0,3).map((g: any) => `${g.blueprint_key || 'Key area'} needs development for ${targetLevel} readiness`),
    actions: criticalGaps.length > 0
      ? criticalGaps.slice(0,3).map((g: any) => `Priority development: ${g.blueprint_key || 'competency gap'} — required for ${targetLevel}`)
      : [`Complete ${targetLevel}-level stretch assignments`, `Build strategic visibility at ${targetLevel} scope`],
    confidence,
  };
}

function computeLeadershipReadiness(data: UserData): { score: number; dimensions: Record<string, number>; strengths: string[]; gaps: string[]; actions: string[]; confidence: number } {
  const sources: string[] = [];
  const dims: Record<string, number> = {};

  // EI → emotional leadership
  if (data.ei_score !== null) { dims.emotional_leadership = data.ei_score; sources.push('EI'); }
  // LBI → learning agility for leadership
  if (data.lbi_score !== null) { dims.learning_agility = data.lbi_score; sources.push('LBI'); }
  // CSI → behavioural maturity
  if (data.csi_score !== null) { dims.behavioural_maturity = data.csi_score; sources.push('CSI'); }

  // Talent score → strategic capability (best executive RF score)
  const execScore = data.talent_scores.find(s => (s.rf_name || '').toLowerCase().includes('leader')) || data.talent_scores[0];
  if (execScore) { dims.strategic_capability = Number(execScore.composite_score || 0); sources.push('TalentScore'); }

  if (!Object.keys(dims).length) return { score: 0, dimensions: {}, strengths: [], gaps: ['No assessment data available'], actions: ['Complete EI, LBI, and CAPADEX assessments'], confidence: 0 };

  const avg = Object.values(dims).reduce((a, b) => a + b, 0) / Object.values(dims).length;
  const confidence = sources.length / 4;

  return {
    score: Math.round(avg),
    dimensions: dims,
    strengths: avg > 65 ? ['Well-rounded leadership profile', 'Emotional and cognitive leadership indicators strong'] : ['Core leadership potential present'],
    gaps: avg < 60 ? ['Significant leadership development needed across multiple dimensions', 'EI/LBI/strategic capability require strengthening'] : avg < 75 ? ['Targeted leadership refinement needed', 'Some dimensions below leadership threshold'] : [],
    actions: avg < 60
      ? ['Complete EI assessment and coaching programme','Build strategic exposure through cross-functional roles','Engage executive mentoring relationship']
      : avg < 75 ? ['Targeted leadership development in weak dimensions', 'Seek senior leadership stretch assignment'] : ['Consolidate leadership impact at scale', 'Mentor high-potential team members'],
    confidence,
  };
}

function computeManagerialReadiness(data: UserData): { score: number; dimensions: Record<string, number>; strengths: string[]; gaps: string[]; actions: string[]; confidence: number } {
  const dims: Record<string, number> = {};
  const sources: string[] = [];

  if (data.ei_score !== null) { dims.people_management = Math.min(100, data.ei_score * 1.1); sources.push('EI'); }
  if (data.lbi_score !== null) { dims.team_development = data.lbi_score; sources.push('LBI'); }

  const topScore = data.talent_scores[0];
  if (topScore) {
    dims.operational_delivery = Number(topScore.competency_score || topScore.composite_score || 0);
    sources.push('TalentScore');
    dims.performance_management = Math.min(100, Number(topScore.composite_score || 0) * 0.9);
  }
  if (data.csi_score !== null) { dims.coaching_capability = data.csi_score; sources.push('CSI'); }

  if (!Object.keys(dims).length) return { score: 0, dimensions: {}, strengths: [], gaps: ['No assessment data'], actions: ['Complete assessments'], confidence: 0 };

  const avg = Object.values(dims).reduce((a, b) => a + b, 0) / Object.values(dims).length;
  const confidence = sources.length / 4;

  return {
    score: Math.round(avg),
    dimensions: dims,
    strengths: avg > 65 ? ['Operational delivery capability strong', 'People management foundation established'] : ['Developing managerial foundation'],
    gaps: avg < 60 ? ['People management capability needs development', 'Coaching and delegation skills require focus'] : avg < 75 ? ['Some managerial dimensions below threshold'] : [],
    actions: avg < 60
      ? ['Complete structured management training','Build delegation skills through stretch assignment','Seek coaching from experienced manager']
      : avg < 75 ? ['Develop coaching capability with team members', 'Lead cross-functional project for broader scope'] : ['Accelerate team development initiatives', 'Position for senior management opportunity'],
    confidence,
  };
}

async function computeAndSaveReadiness(pool: Pool, email: string): Promise<{ role: any[]; promotion: any[]; leadership: any; managerial: any }> {
  const data = await fetchUserData(pool, email);
  const results: { role: any[]; promotion: any[]; leadership: any; managerial: any } = { role: [], promotion: [], leadership: null, managerial: null };

  // Role & Promotion readiness per RF
  const rfIds = [...new Set(data.talent_scores.map((s: any) => s.rf_id).filter(Boolean))];
  for (const rfId of rfIds) {
    const rfName = data.talent_scores.find((s: any) => s.rf_id === rfId)?.rf_name || String(rfId);
    const role = computeRoleReadiness(data, rfId);
    const promo = computePromotionReadiness(data, rfId);

    await pool.query(
      `INSERT INTO ri_readiness_scores(user_email,readiness_type,rf_id,rf_name,readiness_score,success_probability,readiness_band,gap_priority_areas,strengths,development_actions,confidence,data_sources)
       VALUES($1,'role',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT(user_email,readiness_type,rf_id) DO UPDATE SET
         readiness_score=$4,success_probability=$5,readiness_band=$6,gap_priority_areas=$7,strengths=$8,development_actions=$9,confidence=$10,data_sources=$11,computed_at=NOW()`,
      [email, rfId, rfName, role.score, successProb(role.score), getBand(role.score),
       JSON.stringify(role.gaps), JSON.stringify(role.strengths), JSON.stringify(role.actions),
       role.confidence, JSON.stringify(role.sources)]
    );
    await pool.query(
      `INSERT INTO ri_readiness_scores(user_email,readiness_type,rf_id,rf_name,current_level,target_level,readiness_score,success_probability,readiness_band,gap_priority_areas,strengths,development_actions,confidence,data_sources)
       VALUES($1,'promotion',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT(user_email,readiness_type,rf_id) DO UPDATE SET
         current_level=$4,target_level=$5,readiness_score=$6,success_probability=$7,readiness_band=$8,gap_priority_areas=$9,strengths=$10,development_actions=$11,confidence=$12,data_sources=$13,computed_at=NOW()`,
      [email, rfId, rfName, promo.currentLevel, promo.targetLevel, promo.score, successProb(promo.score), getBand(promo.score),
       JSON.stringify(promo.gaps), JSON.stringify(promo.strengths), JSON.stringify(promo.actions),
       promo.confidence, JSON.stringify(['TalentScore', 'LevelProfiles'])]
    );

    // Save snapshots
    await pool.query(`INSERT INTO ri_readiness_history(user_email,readiness_type,rf_id,readiness_score,readiness_band) VALUES($1,'role',$2,$3,$4)`,
      [email, rfId, role.score, getBand(role.score)]).catch(() => {});
    await pool.query(`INSERT INTO ri_readiness_history(user_email,readiness_type,rf_id,readiness_score,readiness_band) VALUES($1,'promotion',$2,$3,$4)`,
      [email, rfId, promo.score, getBand(promo.score)]).catch(() => {});

    results.role.push({ rf_id: rfId, rf_name: rfName, ...role });
    results.promotion.push({ rf_id: rfId, rf_name: rfName, ...promo });
  }

  // Leadership readiness (global)
  const leadership = computeLeadershipReadiness(data);
  await pool.query(
    `INSERT INTO ri_readiness_scores(user_email,readiness_type,rf_id,readiness_score,success_probability,readiness_band,gap_priority_areas,strengths,development_actions,confidence,data_sources)
     VALUES($1,'leadership',0,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT(user_email,readiness_type,rf_id) DO UPDATE SET
       readiness_score=$2,success_probability=$3,readiness_band=$4,gap_priority_areas=$5,strengths=$6,development_actions=$7,confidence=$8,data_sources=$9,computed_at=NOW()`,
    [email, leadership.score, successProb(leadership.score), getBand(leadership.score),
     JSON.stringify(leadership.gaps), JSON.stringify(leadership.strengths), JSON.stringify(leadership.actions),
     leadership.confidence, JSON.stringify(Object.keys(leadership.dimensions))]
  );
  results.leadership = leadership;

  // Managerial readiness (global)
  const managerial = computeManagerialReadiness(data);
  await pool.query(
    `INSERT INTO ri_readiness_scores(user_email,readiness_type,rf_id,readiness_score,success_probability,readiness_band,gap_priority_areas,strengths,development_actions,confidence,data_sources)
     VALUES($1,'managerial',0,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT(user_email,readiness_type,rf_id) DO UPDATE SET
       readiness_score=$2,success_probability=$3,readiness_band=$4,gap_priority_areas=$5,strengths=$6,development_actions=$7,confidence=$8,data_sources=$9,computed_at=NOW()`,
    [email, managerial.score, successProb(managerial.score), getBand(managerial.score),
     JSON.stringify(managerial.gaps), JSON.stringify(managerial.strengths), JSON.stringify(managerial.actions),
     managerial.confidence, JSON.stringify(Object.keys(managerial.dimensions))]
  );
  results.managerial = managerial;

  return results;
}

export function registerTalentReadinessEngineRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn): void {
  if (!flagOn()) return;
  ensureSchema(pool).catch(() => {});

  // POST /api/admin/talent/readiness/compute/:email — compute all 4 readiness types
  app.post('/api/admin/talent/readiness/compute/:email', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const results = await computeAndSaveReadiness(pool, email);
      bustCache();
      res.json({ ok: true, email, role_count: results.role.length, promotion_count: results.promotion.length, leadership: results.leadership?.score, managerial: results.managerial?.score });
    } catch (err) { console.error('Readiness compute error:', err); res.status(500).json({ error: 'compute failed' }); }
  });

  // POST /api/admin/talent/readiness/compute-all — bulk compute (up to 500)
  app.post('/api/admin/talent/readiness/compute-all', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    res.json({ ok: true, message: 'readiness computation started in background' });
    (async () => {
      try {
        const users = await pool.query(`SELECT DISTINCT user_email FROM talent_role_scores LIMIT 500`);
        let processed = 0;
        for (const u of users.rows) {
          try { await computeAndSaveReadiness(pool, u.user_email); processed++; } catch { /* skip */ }
        }
        console.log(`[readiness-engine] Bulk compute complete: ${processed}/${users.rows.length}`);
      } catch (err) { console.error('Bulk readiness error:', err); }
    })();
  });

  // GET /api/admin/talent/readiness — paginated list
  app.get('/api/admin/talent/readiness', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cacheKey = `readiness_${JSON.stringify(req.query)}`;
    const cached = getCached(cacheKey);
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const { type = 'role', band, search, page = '1', limit = '25' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const params: unknown[] = [type];
      const where: string[] = ['readiness_type=$1'];
      if (band) { params.push(band); where.push(`readiness_band=$${params.length}`); }
      if (search) { params.push(`%${search}%`); where.push(`user_email ILIKE $${params.length}`); }
      const wc = `WHERE ${where.join(' AND ')}`;
      const [countRes, rows, kpi, bandDist] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM ri_readiness_scores ${wc}`, params),
        pool.query(`SELECT * FROM ri_readiness_scores ${wc} ORDER BY readiness_score DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, parseInt(limit), offset]),
        pool.query(`SELECT COUNT(*)::int as total, ROUND(AVG(readiness_score)::numeric,1) as avg_score,
          ROUND(AVG(success_probability)::numeric,3) as avg_success_prob,
          COUNT(*) FILTER (WHERE readiness_band='ready_now') as ready_now,
          COUNT(*) FILTER (WHERE readiness_band='ready_6m') as ready_6m,
          COUNT(*) FILTER (WHERE readiness_band='not_ready') as not_ready
          FROM ri_readiness_scores WHERE readiness_type=$1`, [type]),
        pool.query(`SELECT readiness_band, COUNT(*) as cnt FROM ri_readiness_scores WHERE readiness_type=$1 GROUP BY readiness_band ORDER BY cnt DESC`, [type]),
      ]);
      const result = { total: parseInt(countRes.rows[0].count), page: parseInt(page), rows: rows.rows, kpi: kpi.rows[0], band_distribution: bandDist.rows };
      setCache(cacheKey, result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/talent/readiness/:email — user's full readiness profile
  app.get('/api/talent/readiness/:email', requireAuth, async (req: Request, res: Response) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const [role, promotion, leadership, managerial] = await Promise.all([
        pool.query(`SELECT * FROM ri_readiness_scores WHERE user_email=$1 AND readiness_type='role' ORDER BY readiness_score DESC`, [email]),
        pool.query(`SELECT * FROM ri_readiness_scores WHERE user_email=$1 AND readiness_type='promotion' ORDER BY readiness_score DESC`, [email]),
        pool.query(`SELECT * FROM ri_readiness_scores WHERE user_email=$1 AND readiness_type='leadership' LIMIT 1`, [email]),
        pool.query(`SELECT * FROM ri_readiness_scores WHERE user_email=$1 AND readiness_type='managerial' LIMIT 1`, [email]),
      ]);
      const noData = !role.rows.length && !leadership.rows.length;
      if (noData) return res.json({ email, message: 'No readiness scores computed yet — run compute first', role: [], promotion: [], leadership: null, managerial: null });
      res.json({ email, role: role.rows, promotion: promotion.rows, leadership: leadership.rows[0] || null, managerial: managerial.rows[0] || null, generated_at: new Date().toISOString() });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/admin/talent/readiness/pipeline — readiness pipeline (counts by band × RF)
  app.get('/api/admin/talent/readiness/pipeline', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('readiness_pipeline');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const [overview, byRF, leadership, succession] = await Promise.all([
        pool.query(`SELECT readiness_type, readiness_band, COUNT(*) as cnt, ROUND(AVG(readiness_score)::numeric,1) as avg_score
          FROM ri_readiness_scores GROUP BY readiness_type, readiness_band ORDER BY readiness_type, cnt DESC`),
        pool.query(`SELECT rf_name, readiness_band, COUNT(*) as cnt FROM ri_readiness_scores WHERE readiness_type='role' AND rf_name IS NOT NULL GROUP BY rf_name, readiness_band ORDER BY rf_name`),
        pool.query(`SELECT readiness_band, COUNT(*) as cnt, ROUND(AVG(readiness_score)::numeric,1) as avg_score FROM ri_readiness_scores WHERE readiness_type='leadership' GROUP BY readiness_band`),
        pool.query(`SELECT user_email, rf_name, readiness_score, success_probability FROM ri_readiness_scores WHERE readiness_type='promotion' AND readiness_band IN ('ready_now','ready_6m') ORDER BY readiness_score DESC LIMIT 20`),
      ]);
      const result = { readiness_overview: overview.rows, readiness_by_rf: byRF.rows, leadership_pipeline: leadership.rows, succession_candidates: succession.rows };
      setCache('readiness_pipeline', result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/admin/talent/readiness/history/:email — readiness trend
  app.get('/api/admin/talent/readiness/history/:email', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const history = await pool.query(
        `SELECT readiness_type, rf_id, readiness_score, readiness_band, snapshot_at FROM ri_readiness_history WHERE user_email=$1 ORDER BY snapshot_at DESC LIMIT 50`, [email]
      );
      res.json({ email, history: history.rows });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  console.log('[talent-readiness-engine] D9 routes registered — 4 readiness types: role/promotion/leadership/managerial');
}
