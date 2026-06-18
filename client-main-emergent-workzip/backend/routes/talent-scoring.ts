/**
 * Talent Foundation — Phase 3: Talent Scoring Engine
 *                   — Phase 4: Gap Intelligence
 * Reads mei_scores + lbi_scores + csi_profiles + career_seeker_profiles
 * to compute per-user Role Family fit scores and gap records.
 * Additive + flag-gated: FF_CAREER_GRAPH=1. Never throws.
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
      CREATE TABLE IF NOT EXISTS talent_role_scores (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        rf_id INTEGER NOT NULL REFERENCES rf_master(id) ON DELETE CASCADE,
        overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,
        blueprint_scores JSONB DEFAULT '{}',
        level_fit TEXT CHECK (level_fit IN ('junior','mid','senior','lead','executive')),
        data_sources TEXT[] DEFAULT '{}',
        confidence NUMERIC(3,2) DEFAULT 0,
        computed_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, rf_id)
      );
      CREATE TABLE IF NOT EXISTS talent_gaps (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        rf_id INTEGER NOT NULL REFERENCES rf_master(id) ON DELETE CASCADE,
        target_level TEXT CHECK (target_level IN ('junior','mid','senior','lead','executive')),
        overall_gap_score NUMERIC(5,2) DEFAULT 0,
        gap_breakdown JSONB DEFAULT '{}',
        priority_gaps TEXT[] DEFAULT '{}',
        gap_severity TEXT CHECK (gap_severity IN ('critical','moderate','minor','none')) DEFAULT 'moderate',
        computed_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, rf_id)
      );
      CREATE INDEX IF NOT EXISTS idx_talent_scores_user ON talent_role_scores(user_id);
      CREATE INDEX IF NOT EXISTS idx_talent_scores_rf   ON talent_role_scores(rf_id);
      CREATE INDEX IF NOT EXISTS idx_talent_gaps_user   ON talent_gaps(user_id);
    `);
    schemaReady = true;
    console.log('[talent-scoring] schema ready');
  } catch (e) {
    console.error('[talent-scoring] ensureSchema error:', e);
  }
}

function gate(res: Response): boolean {
  if (!flagOn()) { res.status(503).json({ error: 'Feature not enabled' }); return false; }
  return true;
}

// ── Scoring Engine ─────────────────────────────────────────────────────────
interface UserSignals {
  mei_score: number | null;
  lbi_consistency: number | null;
  lbi_persistence: number | null;
  lbi_attention: number | null;
  csi_stage: string | null;
  csi_stage_score: number | null;
  experience_years: number;
  declared_role: string;
  skills: string[];
  has_mei: boolean;
  has_lbi: boolean;
  has_csi: boolean;
}

async function getUserSignals(pool: Pool, userId: string): Promise<UserSignals> {
  const [meiRes, lbiRes, csiRes, profileRes] = await Promise.all([
    pool.query(`SELECT score FROM mei_scores WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1`, [userId]).catch(() => ({ rows: [] })),
    pool.query(`SELECT consistency_score, persistence_score, attention_score FROM lbi_scores WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [userId]).catch(() => ({ rows: [] })),
    pool.query(`SELECT career_stage, stage_score FROM csi_profiles WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 1`, [userId]).catch(() => ({ rows: [] })),
    pool.query(`SELECT data FROM career_seeker_profiles WHERE user_id=$1 LIMIT 1`, [userId]).catch(() => ({ rows: [] })),
  ]);

  const mei = meiRes.rows[0];
  const lbi = lbiRes.rows[0];
  const csi = csiRes.rows[0];
  const profile = profileRes.rows[0]?.data || {};

  const expYears = (() => {
    if (profile.experience) return Number(profile.experience) || 0;
    if (profile.workExperience?.length) return profile.workExperience.length * 1.5;
    return 0;
  })();

  const skills: string[] = [
    ...(profile.skills || []),
    ...(profile.technicalSkills || []),
  ].map((s: any) => String(s).toLowerCase());

  return {
    mei_score: mei ? Number(mei.score) : null,
    lbi_consistency: lbi ? Number(lbi.consistency_score) : null,
    lbi_persistence: lbi ? Number(lbi.persistence_score) : null,
    lbi_attention: lbi ? Number(lbi.attention_score) : null,
    csi_stage: csi?.career_stage || null,
    csi_stage_score: csi ? Number(csi.stage_score) : null,
    experience_years: expYears,
    declared_role: String(profile.currentRole || profile.targetRole || '').toLowerCase(),
    skills,
    has_mei: !!mei,
    has_lbi: !!lbi,
    has_csi: !!csi,
  };
}

// Blueprint competency ID → signal weight function
// Maps abstract blueprint competency IDs to a score derived from available signals
function computeBlueprintScore(competencyId: string, signals: UserSignals, rfName: string): number {
  const base = signals.mei_score ?? 40;
  const behavioural = ((signals.lbi_consistency ?? 50) + (signals.lbi_persistence ?? 50) + (signals.lbi_attention ?? 50)) / 3;
  const stageBoost = signals.csi_stage_score ? Number(signals.csi_stage_score) : 45;

  // Role-name keyword match → boosts score if user's declared role aligns with RF
  const roleKeywords = rfName.toLowerCase().split(/\s+/);
  const roleMatch = roleKeywords.some(kw => signals.declared_role.includes(kw)) ? 15 : 0;

  // Competency-specific weights
  const competencyWeights: Record<string, number> = {
    // Technical competencies — rely more on MEI
    technical_engineering: 0.70, software_architecture: 0.70, systems_design: 0.70,
    engineering_excellence: 0.70, technical_problem_solving: 0.65, machine_learning: 0.70,
    statistical_analysis: 0.70, data_governance: 0.60, data_storytelling: 0.55,
    // Behavioural competencies — rely more on LBI
    team_development: 0.60, performance_management: 0.60, inclusive_culture: 0.65,
    conflict_resolution: 0.65, people_leadership: 0.60,
    // Strategic competencies — blend MEI + stage
    strategic_thinking: 0.65, biz_model_innovation: 0.65, market_analysis: 0.65,
    future_proofing: 0.60, strategic_vision: 0.70, enterprise_governance: 0.70,
    stakeholder_influence: 0.65, org_transformation: 0.65,
    // Sales/customer
    consultative_selling: 0.60, pipeline_management: 0.60, negotiation: 0.60,
    revenue_forecasting: 0.65, customer_relationship: 0.60, success_planning: 0.60,
    churn_prevention: 0.60, product_adoption: 0.55,
    // Operations/Finance
    process_optimisation: 0.65, lean_management: 0.65, quality_systems: 0.65,
    operational_kpis: 0.65, financial_modelling: 0.70, budgeting: 0.65,
    regulatory_reporting: 0.65, capital_management: 0.70,
    // Marketing/Delivery
    brand_strategy: 0.60, content_strategy: 0.55, demand_generation: 0.60,
    market_positioning: 0.60, project_planning: 0.65, risk_management: 0.65,
    stakeholder_communication: 0.60, delivery_governance: 0.65,
    // Compliance
    regulatory_compliance: 0.65, risk_frameworks: 0.65, governance_controls: 0.65,
    legal_risk: 0.65,
  };

  const meiWeight = competencyWeights[competencyId] ?? 0.60;
  const lbiWeight = 1 - meiWeight;

  const raw = (base * meiWeight) + (behavioural * lbiWeight * 0.5) + (stageBoost * 0.2) + roleMatch;
  // Clamp to 0-100 with a mild randomisation seed for differentiation when data is sparse
  const seed = (competencyId.charCodeAt(0) % 10) - 5;
  return Math.min(100, Math.max(0, Math.round(raw + seed)));
}

function inferLevelFit(score: number, experienceYears: number): string {
  if (score >= 85 || experienceYears >= 12) return 'executive';
  if (score >= 72 || experienceYears >= 8)  return 'lead';
  if (score >= 58 || experienceYears >= 5)  return 'senior';
  if (score >= 44 || experienceYears >= 2)  return 'mid';
  return 'junior';
}

async function computeScoresForUser(
  pool: Pool,
  userId: string
): Promise<{ scored: number; gaps: number }> {
  const signals = await getUserSignals(pool, userId);
  const dataSources: string[] = [];
  if (signals.has_mei) dataSources.push('mei');
  if (signals.has_lbi) dataSources.push('lbi');
  if (signals.has_csi) dataSources.push('csi');
  if (signals.skills.length > 0) dataSources.push('profile');
  const confidence = Math.min(1, dataSources.length / 4);

  // Fetch all role families + their blueprint mappings + competency mappings
  const { rows: rfRows } = await pool.query(`
    SELECT rf.id AS rf_id, rf.name AS rf_name,
      json_agg(json_build_object(
        'cb_id', rbm.cb_id, 'weight', rbm.weight, 'is_primary', rbm.is_primary
      )) AS blueprints
    FROM rf_master rf
    JOIN rf_blueprint_mapping rbm ON rbm.rf_id = rf.id
    WHERE rf.is_active = true
    GROUP BY rf.id, rf.name
  `);

  const { rows: compRows } = await pool.query('SELECT cb_id, competency_id, weight FROM cb_competency_mapping');
  const compsByCb: Record<number, Array<{ competency_id: string; weight: number }>> = {};
  compRows.forEach((c: any) => {
    if (!compsByCb[c.cb_id]) compsByCb[c.cb_id] = [];
    compsByCb[c.cb_id].push({ competency_id: c.competency_id, weight: Number(c.weight) });
  });

  let scored = 0;
  let gaps = 0;

  for (const rf of rfRows) {
    const blueprints: Array<{ cb_id: number; weight: number; is_primary: boolean }> = rf.blueprints;
    let totalBpWeight = 0;
    let weightedScore = 0;
    const blueprintScores: Record<number, number> = {};

    for (const bp of blueprints) {
      const comps = compsByCb[bp.cb_id] || [];
      if (!comps.length) continue;
      let totalCompWeight = 0;
      let compScore = 0;
      for (const comp of comps) {
        const cs = computeBlueprintScore(comp.competency_id, signals, rf.rf_name);
        compScore += cs * comp.weight;
        totalCompWeight += comp.weight;
      }
      const bpScore = totalCompWeight > 0 ? compScore / totalCompWeight : 0;
      blueprintScores[bp.cb_id] = Math.round(bpScore);
      weightedScore += bpScore * bp.weight;
      totalBpWeight += bp.weight;
    }

    const overallScore = totalBpWeight > 0 ? Math.round(weightedScore / totalBpWeight) : 0;
    const levelFit = inferLevelFit(overallScore, signals.experience_years);

    await pool.query(
      `INSERT INTO talent_role_scores(user_id,rf_id,overall_score,blueprint_scores,level_fit,data_sources,confidence,computed_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT(user_id,rf_id) DO UPDATE SET overall_score=$3,blueprint_scores=$4,level_fit=$5,data_sources=$6,confidence=$7,computed_at=NOW()`,
      [userId, rf.rf_id, overallScore, JSON.stringify(blueprintScores), levelFit, dataSources, confidence]
    );
    scored++;

    // Gap computation: distance from next level's threshold
    const { rows: lp } = await pool.query(
      `SELECT level, competency_thresholds FROM rp_level_profiles WHERE rf_id=$1 AND level=$2`,
      [rf.rf_id, levelFit]
    );
    if (lp.length) {
      const thresholds = lp[0].competency_thresholds || {};
      const primaryThreshold = thresholds.primary_blueprint ?? 50;
      const primaryScore = Object.values(blueprintScores)[0] as number || 0;
      const gapScore = Math.max(0, primaryThreshold - primaryScore);
      const severity = gapScore > 30 ? 'critical' : gapScore > 15 ? 'moderate' : gapScore > 5 ? 'minor' : 'none';
      const priorityGaps = Object.entries(blueprintScores)
        .map(([cbId, score]) => ({ cbId, gap: primaryThreshold - score }))
        .filter(x => x.gap > 10)
        .sort((a, b) => b.gap - a.gap)
        .slice(0, 3)
        .map(x => String(x.cbId));

      await pool.query(
        `INSERT INTO talent_gaps(user_id,rf_id,target_level,overall_gap_score,gap_breakdown,priority_gaps,gap_severity,computed_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,NOW())
         ON CONFLICT(user_id,rf_id) DO UPDATE SET target_level=$3,overall_gap_score=$4,gap_breakdown=$5,priority_gaps=$6,gap_severity=$7,computed_at=NOW()`,
        [userId, rf.rf_id, levelFit, gapScore, JSON.stringify(blueprintScores), priorityGaps, severity]
      );
      gaps++;
    }
  }

  return { scored, gaps };
}

export function registerTalentScoringRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn): void {
  app.use(async (_req, _res, next) => { await ensureSchema(pool); next(); });

  // ── User: my scores ────────────────────────────────────────────────────────
  app.get('/api/talent/my-scores', requireAuth, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const userId = (req as any).user?.id || (req as any).session?.userId;
      if (!userId) return void res.status(401).json({ error: 'Not authenticated' });
      const { rows } = await pool.query(`
        SELECT trs.*, rf.name AS rf_name, rf.future_relevance
        FROM talent_role_scores trs
        JOIN rf_master rf ON rf.id = trs.rf_id
        WHERE trs.user_id = $1
        ORDER BY trs.overall_score DESC
      `, [String(userId)]);
      res.json(rows);
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/talent/my-gaps', requireAuth, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const userId = (req as any).user?.id || (req as any).session?.userId;
      if (!userId) return void res.status(401).json({ error: 'Not authenticated' });
      const { rows } = await pool.query(`
        SELECT tg.*, rf.name AS rf_name
        FROM talent_gaps tg
        JOIN rf_master rf ON rf.id = tg.rf_id
        WHERE tg.user_id = $1
        ORDER BY tg.overall_gap_score DESC
      `, [String(userId)]);
      res.json(rows);
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  // ── Admin: compute scores ──────────────────────────────────────────────────
  app.post('/api/admin/talent/scoring/compute', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { user_id } = req.body;
      if (user_id) {
        const result = await computeScoresForUser(pool, String(user_id));
        return void res.json({ success: true, user_id, ...result });
      }
      // Bulk: compute for all users with career profiles
      const { rows: users } = await pool.query(`SELECT DISTINCT user_id FROM career_seeker_profiles WHERE user_id IS NOT NULL LIMIT 500`);
      let totalScored = 0; let totalGaps = 0;
      for (const u of users) {
        try {
          const r = await computeScoresForUser(pool, String(u.user_id));
          totalScored += r.scored; totalGaps += r.gaps;
        } catch {}
      }
      res.json({ success: true, users_processed: users.length, total_scores: totalScored, total_gaps: totalGaps });
    } catch (e: any) { res.status(500).json({ error: e.message || 'Failed' }); }
  });

  // ── Admin: population overview ─────────────────────────────────────────────
  app.get('/api/admin/talent/scoring/overview', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const [rfDist, levelDist, topScorers, gapSummary, coverage] = await Promise.all([
        pool.query(`
          SELECT rf.name AS rf_name, rf.future_relevance,
            COUNT(trs.id)::int AS user_count,
            ROUND(AVG(trs.overall_score),1)::numeric AS avg_score,
            ROUND(MIN(trs.overall_score),1)::numeric AS min_score,
            ROUND(MAX(trs.overall_score),1)::numeric AS max_score
          FROM rf_master rf
          LEFT JOIN talent_role_scores trs ON trs.rf_id = rf.id
          GROUP BY rf.id, rf.name, rf.future_relevance
          ORDER BY avg_score DESC NULLS LAST
        `),
        pool.query(`
          SELECT level_fit, COUNT(*)::int AS count
          FROM talent_role_scores
          WHERE level_fit IS NOT NULL
          GROUP BY level_fit
          ORDER BY CASE level_fit WHEN 'junior' THEN 1 WHEN 'mid' THEN 2 WHEN 'senior' THEN 3 WHEN 'lead' THEN 4 WHEN 'executive' THEN 5 END
        `),
        pool.query(`
          SELECT trs.user_id, rf.name AS top_rf, trs.overall_score, trs.level_fit, trs.confidence
          FROM talent_role_scores trs
          JOIN rf_master rf ON rf.id = trs.rf_id
          WHERE trs.overall_score = (
            SELECT MAX(t2.overall_score) FROM talent_role_scores t2 WHERE t2.user_id = trs.user_id
          )
          ORDER BY trs.overall_score DESC
          LIMIT 20
        `),
        pool.query(`
          SELECT gap_severity, COUNT(*)::int AS count
          FROM talent_gaps
          GROUP BY gap_severity
          ORDER BY CASE gap_severity WHEN 'critical' THEN 1 WHEN 'moderate' THEN 2 WHEN 'minor' THEN 3 WHEN 'none' THEN 4 END
        `),
        pool.query(`
          SELECT COUNT(DISTINCT user_id)::int AS scored_users,
            COUNT(*)::int AS total_score_records,
            ROUND(AVG(overall_score),1)::numeric AS platform_avg_score,
            ROUND(AVG(confidence),2)::numeric AS avg_confidence
          FROM talent_role_scores
        `),
      ]);
      res.json({
        rf_distribution: rfDist.rows,
        level_distribution: levelDist.rows,
        top_scorers: topScorers.rows,
        gap_severity_distribution: gapSummary.rows,
        coverage: coverage.rows[0],
      });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/admin/talent/scoring/user/:userId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const userId = req.params.userId;
      const [scores, gaps] = await Promise.all([
        pool.query(`SELECT trs.*, rf.name AS rf_name, rf.future_relevance FROM talent_role_scores trs JOIN rf_master rf ON rf.id=trs.rf_id WHERE trs.user_id=$1 ORDER BY trs.overall_score DESC`, [userId]),
        pool.query(`SELECT tg.*, rf.name AS rf_name FROM talent_gaps tg JOIN rf_master rf ON rf.id=tg.rf_id WHERE tg.user_id=$1 ORDER BY tg.overall_gap_score DESC`, [userId]),
      ]);
      res.json({ user_id: userId, scores: scores.rows, gaps: gaps.rows });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  // ── Admin: gap intelligence overview ──────────────────────────────────────
  app.get('/api/admin/talent/gaps/overview', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { rows } = await pool.query(`
        SELECT rf.name AS rf_name,
          COUNT(tg.id)::int AS total_users,
          COUNT(CASE WHEN tg.gap_severity='critical' THEN 1 END)::int AS critical_count,
          COUNT(CASE WHEN tg.gap_severity='moderate' THEN 1 END)::int AS moderate_count,
          COUNT(CASE WHEN tg.gap_severity='minor' THEN 1 END)::int AS minor_count,
          COUNT(CASE WHEN tg.gap_severity='none' THEN 1 END)::int AS no_gap_count,
          ROUND(AVG(tg.overall_gap_score),1)::numeric AS avg_gap
        FROM rf_master rf
        LEFT JOIN talent_gaps tg ON tg.rf_id = rf.id
        GROUP BY rf.id, rf.name
        ORDER BY avg_gap DESC NULLS LAST
      `);
      res.json(rows);
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  // ── Pipeline analytics ─────────────────────────────────────────────────────
  app.get('/api/admin/talent/pipeline', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const [heatmap, depth, criticality] = await Promise.all([
        pool.query(`
          SELECT rf.name AS rf_name, trs.level_fit,
            COUNT(*)::int AS count,
            ROUND(AVG(trs.overall_score),1)::numeric AS avg_score
          FROM talent_role_scores trs
          JOIN rf_master rf ON rf.id = trs.rf_id
          WHERE trs.level_fit IS NOT NULL
          GROUP BY rf.name, trs.level_fit
          ORDER BY rf.name, CASE trs.level_fit WHEN 'junior' THEN 1 WHEN 'mid' THEN 2 WHEN 'senior' THEN 3 WHEN 'lead' THEN 4 WHEN 'executive' THEN 5 END
        `),
        pool.query(`
          SELECT rf.name AS rf_name, rf.future_relevance,
            COUNT(trs.id)::int AS talent_pool_size,
            COUNT(CASE WHEN trs.level_fit IN ('senior','lead','executive') THEN 1 END)::int AS senior_talent,
            COUNT(CASE WHEN trs.overall_score >= 70 THEN 1 END)::int AS high_performers
          FROM rf_master rf
          LEFT JOIN talent_role_scores trs ON trs.rf_id = rf.id
          GROUP BY rf.id, rf.name, rf.future_relevance
          ORDER BY talent_pool_size DESC
        `),
        pool.query(`
          SELECT rf.name AS rf_name, rf.future_relevance,
            COUNT(CASE WHEN tg.gap_severity = 'critical' THEN 1 END)::int AS critical_gaps
          FROM rf_master rf
          LEFT JOIN talent_gaps tg ON tg.rf_id = rf.id
          GROUP BY rf.id, rf.name, rf.future_relevance
          ORDER BY critical_gaps DESC
        `),
      ]);
      res.json({
        level_heatmap: heatmap.rows,
        depth_analysis: depth.rows,
        criticality_analysis: criticality.rows,
      });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  console.log('[talent-scoring] routes registered — Phase 3 + Phase 4 + Phase 5 pipeline');
}
