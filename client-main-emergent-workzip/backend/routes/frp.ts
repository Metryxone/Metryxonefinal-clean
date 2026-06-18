/**
 * FRP — Future Readiness Platform Routes
 * User routes:  /api/frp/*
 * Admin routes: /api/admin/frp/*
 *
 * Additive + flag-gated: FF_FUTURE_READINESS=1 to enable.
 * Flag-off → 503 on every route (user + admin), zero DB touch.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { ensureFRPSchema, seedFRPData } from '../services/frp-schema-seed';
import { computeFutureReadinessIndex, persistFRISnapshot } from '../services/frp-readiness-engine';
import { generateFRPRecommendations, persistFRPRecommendations, computeFRPBenchmarks, computeFRPBenchmarksByCohort, getFRPBenchmarks } from '../services/frp-recommendation-engine';
import { autoPopulateSkillProfile } from '../services/frp-skill-bridge';

// ── Feature flag gate ──────────────────────────────────────────────────────
const FLAG = 'FF_FUTURE_READINESS';
const flagOn = () => process.env[FLAG] === '1';

function flagGate(_req: Request, res: Response, next: () => void) {
  if (!flagOn()) return res.status(503).json({ ok: false, error: 'Feature not enabled', flag: FLAG });
  next();
}

// ── Admin cache (60 s) ─────────────────────────────────────────────────────
const adminCache: Map<string, { data: unknown; ts: number }> = new Map();
const ADMIN_TTL = 60_000;
const getCached = <T>(k: string): T | null => { const e = adminCache.get(k); return (e && Date.now() - e.ts < ADMIN_TTL) ? e.data as T : null; };
const setCache = (k: string, d: unknown) => adminCache.set(k, { data: d, ts: Date.now() });
const bustCache = (pfx: string) => { for (const k of adminCache.keys()) if (k.startsWith(pfx)) adminCache.delete(k); };

export function registerFRPRoutes(
  app: Express,
  pool: Pool,
  requireAuth: (req: any, res: any, next: any) => void,
  requireSuperAdmin: (req: any, res: any, next: any) => void,
): void {

  // Gate every /api/frp/* and /api/admin/frp/* route
  app.use('/api/frp', flagGate);
  app.use('/api/admin/frp', flagGate);

  // Ensure schema + seed on startup (lazy, idempotent)
  if (flagOn()) {
    ensureFRPSchema(pool)
      .then(() => seedFRPData(pool))
      .catch(() => { /* non-fatal */ });
  }

  // ── User Routes ────────────────────────────────────────────────────────

  /** GET /api/frp/overview  — composite FRI + signals for current user */
  app.get('/api/frp/overview', requireAuth, async (req: any, res: Response) => {
    const userId = String(req.user?.id ?? req.user?.userId ?? '');
    if (!userId) return res.status(401).json({ error: 'Unauthorised' });
    try {
      const refresh = req.query.refresh === '1';
      const currentRole = (req.query.current_role as string) || undefined;
      const targetRole = (req.query.target_role as string) || undefined;

      // Auto-detect industry from query param OR career profile JSONB
      let industry = (req.query.industry as string) || undefined;
      if (!industry) {
        try {
          const { rows: csp } = await pool.query<{ ind: string }>(
            `SELECT COALESCE(
               data->>'targetIndustry',
               data->>'industry',
               data->>'currentIndustry'
             ) AS ind
             FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`,
            [userId],
          );
          const raw = (csp[0]?.ind ?? '').trim().toLowerCase();
          if (raw) industry = raw;
        } catch { /* career profile absent */ }
      }

      // Auto-populate skill profile before scoring
      const bridge = await autoPopulateSkillProfile(userId, pool, { force: refresh });

      const [fri, benchResult] = await Promise.all([
        computeFutureReadinessIndex(userId, pool, { targetIndustry: industry, currentRoleCode: currentRole, targetRoleCode: targetRole }),
        getFRPBenchmarks(pool, industry),
      ]);
      await persistFRISnapshot(userId, fri, pool);
      return res.json({ ok: true, fri, benchmarks: benchResult.data, benchmark_meta: benchResult.meta, bridge });
    } catch (err) { return res.status(500).json({ error: 'Failed to compute FRI' }); }
  });

  /** GET /api/frp/snapshots  — FRI history for the authenticated user */
  app.get('/api/frp/snapshots', requireAuth, async (req: any, res: Response) => {
    const userId = String(req.user?.id ?? req.user?.userId ?? '');
    if (!userId) return res.status(401).json({ error: 'Unauthorised' });
    try {
      const limit = Math.min(50, Number(req.query.limit ?? 20));
      const { rows } = await pool.query(
        `SELECT composite, band, skill_durability, adaptability, market_alignment,
                learning_velocity, role_resilience, confidence, computed_at
         FROM frp_user_readiness
         WHERE user_id = $1
         ORDER BY computed_at ASC LIMIT $2`,
        [userId, limit],
      );
      return res.json({ ok: true, snapshots: rows, total: rows.length });
    } catch { return res.status(500).json({ error: 'Failed to load snapshots' }); }
  });

  /** GET /api/frp/skill-landscape  — full skill library with user proficiency overlay */
  app.get('/api/frp/skill-landscape', requireAuth, async (req: any, res: Response) => {
    const userId = String(req.user?.id ?? req.user?.userId ?? '');
    try {
      const { rows: skills } = await pool.query(
        `SELECT sl.*, ai.displacement_risk, ai.augmentation_potential, ai.new_work_creation, ai.impact_band, ai.timeline_years, ai.resilience_rationale,
                usp.proficiency_level, usp.source AS proficiency_source
         FROM frp_skill_library sl
         LEFT JOIN frp_ai_impact ai ON ai.skill_code = sl.skill_code
         LEFT JOIN frp_user_skill_profile usp ON usp.skill_code = sl.skill_code AND usp.user_id = $1
         WHERE sl.is_active = true
         ORDER BY sl.domain, sl.cluster, sl.durability_score DESC`,
        [userId],
      );
      // Group by domain
      const byDomain: Record<string, typeof skills> = {};
      for (const s of skills) {
        if (!byDomain[s.domain]) byDomain[s.domain] = [];
        byDomain[s.domain].push(s);
      }
      return res.json({ ok: true, skills, by_domain: byDomain, total: skills.length });
    } catch { return res.status(500).json({ error: 'Failed to load skill landscape' }); }
  });

  /** GET /api/frp/ai-impact  — per-skill AI impact data, optionally filtered to user's skills */
  app.get('/api/frp/ai-impact', requireAuth, async (req: any, res: Response) => {
    const userId = String(req.user?.id ?? req.user?.userId ?? '');
    const userOnly = req.query.user_only === '1';
    try {
      const { rows } = await pool.query(
        `SELECT sl.skill_code, sl.name, sl.domain, sl.cluster, sl.durability_score,
                ai.displacement_risk, ai.augmentation_potential, ai.new_work_creation,
                ai.impact_band, ai.timeline_years, ai.ai_tools_overlap, ai.resilience_rationale,
                ${userOnly ? 'usp.proficiency_level' : 'NULL::int AS proficiency_level'}
         FROM frp_skill_library sl
         JOIN frp_ai_impact ai ON ai.skill_code = sl.skill_code
         ${userOnly ? 'JOIN frp_user_skill_profile usp ON usp.skill_code = sl.skill_code AND usp.user_id = $1' : 'LEFT JOIN frp_user_skill_profile usp ON usp.skill_code = sl.skill_code AND usp.user_id = $1'}
         WHERE sl.is_active = true
         ORDER BY ai.displacement_risk DESC, sl.durability_score ASC`,
        [userId],
      );
      return res.json({ ok: true, skills: rows, total: rows.length });
    } catch { return res.status(500).json({ error: 'Failed to load AI impact data' }); }
  });

  /** GET /api/frp/automation-risk  — role automation risk profiles */
  app.get('/api/frp/automation-risk', requireAuth, async (req: any, res: Response) => {
    const { industry, risk_band, role_code } = req.query as Record<string, string>;
    try {
      const conds: string[] = []; const params: unknown[] = [];
      if (industry && industry !== 'all') { params.push(industry); conds.push(`industry = $${params.length}`); }
      if (risk_band && risk_band !== 'all') { params.push(risk_band); conds.push(`risk_band = $${params.length}`); }
      if (role_code) { params.push(role_code); conds.push(`role_code = $${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(`SELECT * FROM frp_automation_risk ${where} ORDER BY risk_score DESC LIMIT 100`, params);
      return res.json({ ok: true, roles: rows, total: rows.length });
    } catch { return res.status(500).json({ error: 'Failed to load automation risk' }); }
  });

  /** GET /api/frp/industry-forecast  — industry trend forecasts */
  app.get('/api/frp/industry-forecast', requireAuth, async (req: any, res: Response) => {
    const { industry_code } = req.query as Record<string, string>;
    try {
      const { rows } = industry_code
        ? await pool.query(`SELECT * FROM frp_industry_forecast WHERE industry_code = $1`, [industry_code])
        : await pool.query(`SELECT * FROM frp_industry_forecast ORDER BY ai_readiness_score DESC`);
      return res.json({ ok: true, industries: rows, total: rows.length });
    } catch { return res.status(500).json({ error: 'Failed to load industry forecasts' }); }
  });

  /** GET /api/frp/role-evolution  — evolution paths */
  app.get('/api/frp/role-evolution', requireAuth, async (req: any, res: Response) => {
    const { from_role, evolution_type } = req.query as Record<string, string>;
    try {
      const conds: string[] = []; const params: unknown[] = [];
      if (from_role) { params.push(`%${from_role}%`); conds.push(`from_role ILIKE $${params.length}`); }
      if (evolution_type && evolution_type !== 'all') { params.push(evolution_type); conds.push(`evolution_type = $${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(`SELECT * FROM frp_role_evolution ${where} ORDER BY feasibility_score DESC LIMIT 50`, params);
      return res.json({ ok: true, evolutions: rows, total: rows.length });
    } catch { return res.status(500).json({ error: 'Failed to load role evolution paths' }); }
  });

  /** GET /api/frp/recommendations  — personalised FRP recommendations */
  app.get('/api/frp/recommendations', requireAuth, async (req: any, res: Response) => {
    const userId = String(req.user?.id ?? req.user?.userId ?? '');
    const refresh = req.query.refresh === '1';
    try {
      if (!refresh) {
        const { rows: existing } = await pool.query(
          `SELECT * FROM frp_recommendations WHERE user_id=$1 AND status='active' ORDER BY priority DESC LIMIT 10`,
          [userId],
        );
        if (existing.length) return res.json({ ok: true, recommendations: existing, source: 'cached' });
      }
      const recs = await generateFRPRecommendations(userId, pool, {
        targetIndustry: (req.query.industry as string) || undefined,
        currentRole: (req.query.current_role as string) || undefined,
      });
      await persistFRPRecommendations(userId, recs, pool);
      return res.json({ ok: true, recommendations: recs, source: 'computed' });
    } catch { return res.status(500).json({ error: 'Failed to generate recommendations' }); }
  });

  /** POST /api/frp/skill-profile  — upsert user skill proficiency */
  app.post('/api/frp/skill-profile', requireAuth, async (req: any, res: Response) => {
    const userId = String(req.user?.id ?? req.user?.userId ?? '');
    const { skill_code, proficiency_level, source = 'self' } = req.body ?? {};
    if (!skill_code || proficiency_level == null) return res.status(400).json({ error: 'skill_code and proficiency_level required' });
    const level = Math.min(100, Math.max(0, Number(proficiency_level)));
    try {
      await pool.query(
        `INSERT INTO frp_user_skill_profile (user_id, skill_code, proficiency_level, source)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (user_id, skill_code) DO UPDATE SET proficiency_level=$3, source=$4, updated_at=NOW()`,
        [userId, skill_code, level, source],
      );
      return res.json({ ok: true, skill_code, proficiency_level: level });
    } catch { return res.status(500).json({ error: 'Failed to update skill profile' }); }
  });

  /** GET /api/frp/skill-profile  — current user's skill profile */
  app.get('/api/frp/skill-profile', requireAuth, async (req: any, res: Response) => {
    const userId = String(req.user?.id ?? req.user?.userId ?? '');
    try {
      const { rows } = await pool.query(
        `SELECT usp.*, sl.name, sl.domain, sl.cluster, sl.durability_score, sl.demand_trend,
                ai.displacement_risk, ai.impact_band
         FROM frp_user_skill_profile usp
         JOIN frp_skill_library sl ON sl.skill_code = usp.skill_code
         LEFT JOIN frp_ai_impact ai ON ai.skill_code = usp.skill_code
         WHERE usp.user_id = $1 ORDER BY sl.durability_score DESC`,
        [userId],
      );
      return res.json({ ok: true, skills: rows, total: rows.length });
    } catch { return res.status(500).json({ error: 'Failed to load skill profile' }); }
  });

  /** POST /api/frp/readiness/recompute  — force recompute + persist */
  app.post('/api/frp/readiness/recompute', requireAuth, async (req: any, res: Response) => {
    const userId = String(req.user?.id ?? req.user?.userId ?? '');
    try {
      const fri = await computeFutureReadinessIndex(userId, pool, {
        targetIndustry: req.body?.industry,
        currentRoleCode: req.body?.current_role_code,
        targetRoleCode: req.body?.target_role_code,
      });
      await persistFRISnapshot(userId, fri, pool);
      return res.json({ ok: true, fri });
    } catch { return res.status(500).json({ error: 'Recompute failed' }); }
  });

  // ── Admin Routes ───────────────────────────────────────────────────────

  /** GET /api/admin/frp/stats */
  app.get('/api/admin/frp/stats', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cacheKey = 'admin:frp:stats';
    const refresh = (req.query as any).refresh === '1';
    if (!refresh) { const cached = getCached<unknown>(cacheKey); if (cached) return res.json(cached); }
    try {
      const [skills, roles, industries, evolutions, users, snapshots] = await Promise.all([
        pool.query<{ count: string }>('SELECT COUNT(*) FROM frp_skill_library WHERE is_active=true'),
        pool.query<{ count: string }>('SELECT COUNT(*) FROM frp_automation_risk'),
        pool.query<{ count: string }>('SELECT COUNT(*) FROM frp_industry_forecast'),
        pool.query<{ count: string }>('SELECT COUNT(*) FROM frp_role_evolution'),
        pool.query<{ count: string }>('SELECT COUNT(DISTINCT user_id) FROM frp_user_readiness'),
        pool.query<{ count: string }>('SELECT COUNT(*) FROM frp_user_readiness'),
      ]);
      const { rows: bandDist } = await pool.query(
        `SELECT band, COUNT(*) AS cnt FROM frp_user_readiness WHERE computed_at > NOW() - INTERVAL '30 days' GROUP BY band ORDER BY cnt DESC`,
      );
      const { rows: avgFRI } = await pool.query(
        `SELECT ROUND(AVG(composite)) AS avg_composite FROM frp_user_readiness WHERE computed_at > NOW() - INTERVAL '30 days'`,
      );
      const result = {
        skill_count: Number(skills.rows[0].count),
        role_count: Number(roles.rows[0].count),
        industry_count: Number(industries.rows[0].count),
        evolution_count: Number(evolutions.rows[0].count),
        users_assessed: Number(users.rows[0].count),
        total_snapshots: Number(snapshots.rows[0].count),
        band_distribution: bandDist,
        avg_fri_30d: Number(avgFRI.rows[0]?.avg_composite ?? 0),
      };
      setCache(cacheKey, result);
      return res.json(result);
    } catch { return res.status(500).json({ error: 'Failed to load FRP stats' }); }
  });

  /** GET /api/admin/frp/skill-library */
  app.get('/api/admin/frp/skill-library', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const { search='', domain='all', demand_trend='all' } = req.query as Record<string,string>;
    try {
      const conds: string[] = []; const params: unknown[] = [];
      if (domain !== 'all') { params.push(domain); conds.push(`sl.domain = $${params.length}`); }
      if (demand_trend !== 'all') { params.push(demand_trend); conds.push(`sl.demand_trend = $${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(sl.name ILIKE $${params.length} OR sl.skill_code ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT sl.*, ai.displacement_risk, ai.augmentation_potential, ai.new_work_creation, ai.impact_band, ai.timeline_years
         FROM frp_skill_library sl
         LEFT JOIN frp_ai_impact ai ON ai.skill_code = sl.skill_code
         ${where} ORDER BY sl.domain, sl.cluster, sl.name LIMIT 200`,
        params,
      );
      return res.json({ items: rows, total: rows.length });
    } catch { return res.status(500).json({ error: 'Failed to load skill library' }); }
  });

  /** POST /api/admin/frp/skill-library */
  app.post('/api/admin/frp/skill-library', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const { skill_code, name, description, domain, cluster, durability_score=50, human_quotient=50, data_intensity=50, emergence_horizon='established', demand_trend='stable' } = req.body ?? {};
    if (!skill_code || !name || !domain) return res.status(400).json({ error: 'skill_code, name and domain required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO frp_skill_library (skill_code,name,description,domain,cluster,durability_score,human_quotient,data_intensity,emergence_horizon,demand_trend)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [skill_code,name,description,domain,cluster,durability_score,human_quotient,data_intensity,emergence_horizon,demand_trend],
      );
      bustCache('admin:frp:');
      return res.status(201).json({ ok: true, item: rows[0] });
    } catch (e: any) {
      if (e.code === '23505') return res.status(409).json({ error: 'skill_code already exists' });
      return res.status(500).json({ error: 'Failed to create skill' });
    }
  });

  /** PATCH /api/admin/frp/skill-library/:id */
  app.patch('/api/admin/frp/skill-library/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const allowed = ['name','description','domain','cluster','durability_score','human_quotient','data_intensity','emergence_horizon','demand_trend','is_active'];
    const updates: string[] = []; const params: unknown[] = [];
    for (const k of allowed) { if (req.body[k] !== undefined) { params.push(req.body[k]); updates.push(`${k}=$${params.length}`); } }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    params.push(id);
    try {
      const { rows } = await pool.query(`UPDATE frp_skill_library SET ${updates.join(',')} WHERE id=$${params.length} RETURNING *`, params);
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      bustCache('admin:frp:');
      return res.json({ ok: true, item: rows[0] });
    } catch { return res.status(500).json({ error: 'Update failed' }); }
  });

  /** DELETE /api/admin/frp/skill-library/:id */
  app.delete('/api/admin/frp/skill-library/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    try {
      await pool.query(`UPDATE frp_skill_library SET is_active=false WHERE id=$1`, [id]);
      bustCache('admin:frp:');
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: 'Delete failed' }); }
  });

  /** GET /api/admin/frp/taxonomy */
  app.get('/api/admin/frp/taxonomy', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM frp_skill_taxonomy ORDER BY level, parent_code NULLS FIRST, name`);
      return res.json({ items: rows, total: rows.length });
    } catch { return res.status(500).json({ error: 'Failed to load taxonomy' }); }
  });

  /** GET /api/admin/frp/ai-impact */
  app.get('/api/admin/frp/ai-impact', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const { impact_band='all', search='' } = req.query as Record<string,string>;
    try {
      const conds: string[] = []; const params: unknown[] = [];
      if (impact_band !== 'all') { params.push(impact_band); conds.push(`ai.impact_band=$${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`sl.name ILIKE $${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT sl.name, sl.domain, sl.cluster, ai.* FROM frp_ai_impact ai JOIN frp_skill_library sl ON sl.skill_code=ai.skill_code ${where} ORDER BY ai.displacement_risk DESC`,
        params,
      );
      return res.json({ items: rows, total: rows.length });
    } catch { return res.status(500).json({ error: 'Failed to load AI impact data' }); }
  });

  /** PATCH /api/admin/frp/ai-impact/:id */
  app.patch('/api/admin/frp/ai-impact/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const allowed = ['displacement_risk','augmentation_potential','new_work_creation','impact_band','timeline_years','ai_tools_overlap','resilience_rationale'];
    const updates: string[] = []; const params: unknown[] = [];
    for (const k of allowed) { if (req.body[k] !== undefined) { params.push(req.body[k]); updates.push(`${k}=$${params.length}`); } }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    params.push(id);
    try {
      const { rows } = await pool.query(`UPDATE frp_ai_impact SET ${updates.join(',')} WHERE id=$${params.length} RETURNING *`, params);
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true, item: rows[0] });
    } catch { return res.status(500).json({ error: 'Update failed' }); }
  });

  /** GET /api/admin/frp/automation-risk */
  app.get('/api/admin/frp/automation-risk', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const { search='', risk_band='all' } = req.query as Record<string,string>;
    try {
      const conds: string[] = []; const params: unknown[] = [];
      if (risk_band !== 'all') { params.push(risk_band); conds.push(`risk_band=$${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(role_name ILIKE $${params.length} OR role_code ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(`SELECT * FROM frp_automation_risk ${where} ORDER BY risk_score DESC LIMIT 100`, params);
      return res.json({ items: rows, total: rows.length });
    } catch { return res.status(500).json({ error: 'Failed to load automation risk' }); }
  });

  /** POST /api/admin/frp/automation-risk */
  app.post('/api/admin/frp/automation-risk', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const { role_code, role_name, industry, risk_score=50, risk_band='moderate', timeline_years=5, exposed_tasks=[], resilient_tasks=[], upskill_priorities=[] } = req.body ?? {};
    if (!role_code || !role_name) return res.status(400).json({ error: 'role_code and role_name required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO frp_automation_risk (role_code,role_name,industry,risk_score,risk_band,timeline_years,exposed_tasks,resilient_tasks,upskill_priorities)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [role_code,role_name,industry,risk_score,risk_band,timeline_years,exposed_tasks,resilient_tasks,upskill_priorities],
      );
      return res.status(201).json({ ok: true, item: rows[0] });
    } catch (e: any) {
      if (e.code === '23505') return res.status(409).json({ error: 'role_code already exists' });
      return res.status(500).json({ error: 'Create failed' });
    }
  });

  /** PATCH /api/admin/frp/automation-risk/:id */
  app.patch('/api/admin/frp/automation-risk/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const allowed = ['role_name','industry','risk_score','risk_band','timeline_years','exposed_tasks','resilient_tasks','upskill_priorities'];
    const updates: string[] = []; const params: unknown[] = [];
    for (const k of allowed) { if (req.body[k] !== undefined) { params.push(req.body[k]); updates.push(`${k}=$${params.length}`); } }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    params.push(id);
    try {
      const { rows } = await pool.query(`UPDATE frp_automation_risk SET ${updates.join(',')} WHERE id=$${params.length} RETURNING *`, params);
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true, item: rows[0] });
    } catch { return res.status(500).json({ error: 'Update failed' }); }
  });

  /** GET /api/admin/frp/industry-forecast */
  app.get('/api/admin/frp/industry-forecast', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM frp_industry_forecast ORDER BY ai_readiness_score DESC`);
      return res.json({ items: rows, total: rows.length });
    } catch { return res.status(500).json({ error: 'Failed to load forecasts' }); }
  });

  /** PATCH /api/admin/frp/industry-forecast/:id */
  app.patch('/api/admin/frp/industry-forecast/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const allowed = ['growth_outlook','ai_disruption_band','skill_demand_shift','top_growing_roles','top_declining_roles','horizon_years','ai_readiness_score','source_rationale'];
    const updates: string[] = []; const params: unknown[] = [];
    for (const k of allowed) { if (req.body[k] !== undefined) { const v = typeof req.body[k] === 'object' ? JSON.stringify(req.body[k]) : req.body[k]; params.push(v); updates.push(`${k}=$${params.length}`); } }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    params.push(id);
    try {
      const { rows } = await pool.query(`UPDATE frp_industry_forecast SET ${updates.join(',')} WHERE id=$${params.length} RETURNING *`, params);
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true, item: rows[0] });
    } catch { return res.status(500).json({ error: 'Update failed' }); }
  });

  /** GET /api/admin/frp/role-evolution */
  app.get('/api/admin/frp/role-evolution', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const { evolution_type='all', search='' } = req.query as Record<string,string>;
    try {
      const conds: string[] = []; const params: unknown[] = [];
      if (evolution_type !== 'all') { params.push(evolution_type); conds.push(`evolution_type=$${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(from_role ILIKE $${params.length} OR to_role ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(`SELECT * FROM frp_role_evolution ${where} ORDER BY feasibility_score DESC LIMIT 100`, params);
      return res.json({ items: rows, total: rows.length });
    } catch { return res.status(500).json({ error: 'Failed to load role evolution paths' }); }
  });

  /** POST /api/admin/frp/role-evolution */
  app.post('/api/admin/frp/role-evolution', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const { from_role, to_role, evolution_type='adjacent', feasibility_score=60, required_skills=[], drop_skills=[], transition_months_min=6, transition_months_max=18, is_ai_driven=false } = req.body ?? {};
    if (!from_role || !to_role) return res.status(400).json({ error: 'from_role and to_role required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO frp_role_evolution (from_role,to_role,evolution_type,feasibility_score,required_skills,drop_skills,transition_months_min,transition_months_max,is_ai_driven)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [from_role,to_role,evolution_type,feasibility_score,required_skills,drop_skills,transition_months_min,transition_months_max,is_ai_driven],
      );
      return res.status(201).json({ ok: true, item: rows[0] });
    } catch { return res.status(500).json({ error: 'Create failed' }); }
  });

  /** GET /api/admin/frp/benchmarks  — trigger recompute (global + per-cohort) + return */
  app.get('/api/admin/frp/benchmarks', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const refresh = (req.query as any).refresh === '1';
    try {
      let cohortResult: { computed: string[]; skipped: string[] } | null = null;
      if (refresh) {
        await computeFRPBenchmarks(pool);
        cohortResult = await computeFRPBenchmarksByCohort(pool);
      }
      const benchResult = await getFRPBenchmarks(pool);
      return res.json({
        ok: true,
        benchmarks: benchResult.data,
        benchmark_meta: benchResult.meta,
        metrics: Object.keys(benchResult.data).length,
        ...(cohortResult ? { cohort_recompute: cohortResult } : {}),
      });
    } catch { return res.status(500).json({ error: 'Failed to load benchmarks' }); }
  });

  /** GET /api/admin/frp/user-readiness  — latest FRI snapshots across all users */
  app.get('/api/admin/frp/user-readiness', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const limit = Math.min(200, Number((req.query as any).limit) || 50);
    try {
      const { rows } = await pool.query(
        `SELECT DISTINCT ON (user_id) * FROM frp_user_readiness ORDER BY user_id, computed_at DESC LIMIT $1`,
        [limit],
      );
      return res.json({ ok: true, users: rows, total: rows.length });
    } catch { return res.status(500).json({ error: 'Failed to load user readiness data' }); }
  });

  // ── Product Routes ─────────────────────────────────────────────────────

  /** GET /api/frp/products/skills-planner — Future Skills Planner: prioritised skill plan by horizon */
  app.get('/api/frp/products/skills-planner', requireAuth, async (req: any, res: Response) => {
    const userId = String(req.user?.id ?? req.user?.userId ?? '');
    if (!userId) return res.status(401).json({ error: 'Unauthorised' });
    try {
      const [skillsRes, friRes] = await Promise.all([
        pool.query(
          `SELECT sl.skill_code, sl.name, sl.domain, sl.cluster, sl.durability_score, sl.human_quotient,
                  sl.demand_trend, sl.emergence_horizon, sl.description,
                  ai.displacement_risk, ai.augmentation_potential, ai.impact_band, ai.timeline_years,
                  COALESCE(usp.proficiency_level, 0) AS proficiency_level, usp.source AS proficiency_source
             FROM frp_skill_library sl
             LEFT JOIN frp_ai_impact ai ON ai.skill_code = sl.skill_code
             LEFT JOIN frp_user_skill_profile usp ON usp.skill_code = sl.skill_code AND usp.user_id = $1
             WHERE sl.is_active = true
             ORDER BY sl.durability_score DESC`,
          [userId],
        ),
        pool.query(
          `SELECT composite, band, skill_durability, learning_velocity, computed_at
             FROM frp_user_readiness WHERE user_id = $1 ORDER BY computed_at DESC LIMIT 1`,
          [userId],
        ),
      ]);
      const skills = skillsRes.rows;
      const fri = friRes.rows[0] ?? null;

      const horizon: Record<string, any[]> = { immediate: [], near_term: [], future: [] };

      for (const s of skills) {
        const prof = Number(s.proficiency_level ?? 0);
        const dur  = Number(s.durability_score ?? 50);
        const disp = Number(s.displacement_risk ?? 0.3);
        const aug  = Number(s.augmentation_potential ?? 0.5);
        const urgency = disp * (1 - prof / 100) * Math.min(1, (100 - dur) / 50 + 0.3);

        let action_type: string; let rationale: string;
        if (disp >= 0.6 && prof < 50) {
          action_type = 'reskill';
          rationale = `High displacement risk (${Math.round(disp * 100)}%) — pivot to AI-augmented version or adjacent skill`;
        } else if (dur >= 70 && prof < 60) {
          action_type = 'upskill';
          rationale = `High durability (${dur}) — investing here builds a future-proof advantage`;
        } else if (aug >= 0.6 && prof >= 40) {
          action_type = 'deepen';
          rationale = `High augmentation potential — mastering this with AI tools multiplies your output`;
        } else {
          action_type = 'maintain';
          rationale = 'Stable skill — monitor for shifts, maintain current level';
        }

        const item = {
          skill_code: s.skill_code, name: s.name, domain: s.domain, cluster: s.cluster,
          durability_score: dur, displacement_risk: Math.round(disp * 100),
          augmentation_potential: Math.round(aug * 100), proficiency_level: prof,
          impact_band: s.impact_band, demand_trend: s.demand_trend, timeline_years: s.timeline_years,
          urgency: Math.round(urgency * 100) / 100, action_type, rationale,
        };

        if (action_type === 'reskill' || (action_type === 'upskill' && urgency > 0.35)) {
          horizon.immediate.push(item);
        } else if (action_type === 'upskill' || action_type === 'deepen') {
          horizon.near_term.push(item);
        } else {
          horizon.future.push(item);
        }
      }
      for (const h of Object.values(horizon)) h.sort((a: any, b: any) => b.urgency - a.urgency);

      const proficiencies = skills.map((s: any) => Number(s.proficiency_level ?? 0));
      const avgProf = proficiencies.length ? proficiencies.reduce((a, b) => a + b, 0) / proficiencies.length : 0;
      const highDur = skills.filter((s: any) => Number(s.durability_score) >= 70);
      const coveredHighDur = highDur.filter((s: any) => Number(s.proficiency_level) >= 50).length;
      const planScore = highDur.length > 0 ? Math.round((coveredHighDur / highDur.length) * 100) : Math.round(avgProf);

      return res.json({
        ok: true, plan_score: planScore, fri_band: fri?.band ?? null,
        fri_skill_durability: fri ? Math.round(Number(fri.skill_durability)) : null,
        horizon, horizon_counts: { immediate: horizon.immediate.length, near_term: horizon.near_term.length, future: horizon.future.length },
        total_skills: skills.length, avg_proficiency: Math.round(avgProf), computed_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[frp/products/skills-planner]', err);
      return res.json({ ok: false, plan_score: null, horizon: { immediate: [], near_term: [], future: [] }, horizon_counts: { immediate: 0, near_term: 0, future: 0 } });
    }
  });

  /** GET /api/frp/products/ai-navigator — AI Career Navigator: vulnerability + safe-harbor + augmentation */
  app.get('/api/frp/products/ai-navigator', requireAuth, async (req: any, res: Response) => {
    const userId = String(req.user?.id ?? req.user?.userId ?? '');
    if (!userId) return res.status(401).json({ error: 'Unauthorised' });
    try {
      const [skillsRes, rolesRes, industriesRes, userSkillsRes, friRes, capadexRes] = await Promise.all([
        pool.query(
          `SELECT sl.skill_code, sl.name, sl.domain, sl.durability_score, sl.construct_key,
                  ai.displacement_risk, ai.augmentation_potential, ai.new_work_creation, ai.impact_band,
                  ai.timeline_years, ai.resilience_rationale,
                  COALESCE(usp.proficiency_level, 0) AS proficiency_level
             FROM frp_skill_library sl
             JOIN frp_ai_impact ai ON ai.skill_code = sl.skill_code
             LEFT JOIN frp_user_skill_profile usp ON usp.skill_code = sl.skill_code AND usp.user_id = $1
             WHERE sl.is_active = true ORDER BY ai.displacement_risk DESC`,
          [userId],
        ),
        pool.query(`SELECT * FROM frp_automation_risk ORDER BY risk_score DESC LIMIT 25`),
        pool.query(`SELECT * FROM frp_industry_forecast ORDER BY ai_readiness_score DESC LIMIT 10`),
        pool.query(
          `SELECT usp.skill_code, usp.proficiency_level, sl.name, sl.durability_score, sl.domain
             FROM frp_user_skill_profile usp JOIN frp_skill_library sl ON sl.skill_code = usp.skill_code
             WHERE usp.user_id = $1 ORDER BY sl.durability_score DESC`,
          [userId],
        ),
        pool.query(
          `SELECT composite, band, adaptability, computed_at
             FROM frp_user_readiness WHERE user_id = $1 ORDER BY computed_at DESC LIMIT 1`,
          [userId],
        ),
        // CAPADEX personalisation: capadex_sessions is guest_email-keyed (no user_id)
        pool.query(
          `SELECT cs.primary_construct_key, cs.score, cs.persona, cs.concern_name
             FROM capadex_sessions cs
             JOIN users u ON u.email = cs.guest_email
             WHERE u.id::text = $1
               AND cs.status = 'completed'
               AND cs.primary_construct_key IS NOT NULL
             ORDER BY cs.updated_at DESC LIMIT 5`,
          [userId],
        ),
      ]);
      const skills = skillsRes.rows;
      const roles = rolesRes.rows;
      const industries = industriesRes.rows;
      const userSkills = userSkillsRes.rows;
      const fri = friRes.rows[0] ?? null;
      const capadexSignals = capadexRes.rows;

      // Build CAPADEX construct priority set — if the user has assessment signals, use them
      // to elevate skills that map to those constructs in the navigator recommendations.
      const priorityConstructs = new Set(capadexSignals.map((r: any) => String(r.primary_construct_key)));
      const personalizationActive = priorityConstructs.size > 0;

      const userSkillCodes = new Set(userSkills.map((s: any) => s.skill_code));
      const baseSkills = userSkillCodes.size > 0 ? skills.filter((s: any) => userSkillCodes.has(s.skill_code)) : skills.slice(0, 15);
      const vulnScore = baseSkills.length > 0
        ? Math.round(baseSkills.reduce((s: number, sk: any) => s + Number(sk.displacement_risk ?? 0.3), 0) / baseSkills.length * 100)
        : 35;

      const safeHarbors = roles.filter((r: any) => r.risk_score < 40).slice(0, 5)
        .map((r: any) => ({ role_name: r.role_name, risk_score: r.risk_score, risk_band: r.risk_band, industry: r.industry, resilient_tasks: (r.resilient_tasks ?? []).slice(0, 3), upskill_priorities: (r.upskill_priorities ?? []).slice(0, 3) }));

      const augOpps = skills.filter((s: any) => Number(s.augmentation_potential) >= 0.6 && Number(s.proficiency_level) >= 25).slice(0, 5)
        .map((s: any) => ({ name: s.name, domain: s.domain, augmentation_potential: Math.round(Number(s.augmentation_potential) * 100), current_proficiency: s.proficiency_level, resilience_rationale: s.resilience_rationale }));

      const highOpportunitySectors = industries.filter((i: any) => ['exceptional', 'strong'].includes(i.growth_outlook)).slice(0, 3)
        .map((i: any) => ({ industry_name: i.industry_name, growth_outlook: i.growth_outlook, ai_readiness_score: i.ai_readiness_score, top_growing_roles: (i.top_growing_roles ?? []).slice(0, 3), rising_skills: (i.skill_demand_shift?.rising ?? []).slice(0, 4) }));

      // CAPADEX-priority skills: durable skills that map to the user's flagged constructs.
      // Surfaced as a personalised focus list distinct from the standard vulnerability signal.
      const capadexPrioritySkills = personalizationActive
        ? skills
            .filter((s: any) => s.construct_key && priorityConstructs.has(String(s.construct_key)))
            .sort((a: any, b: any) => Number(b.durability_score) - Number(a.durability_score))
            .slice(0, 5)
            .map((s: any) => ({
              name: s.name, domain: s.domain,
              construct_key: s.construct_key,
              durability_score: s.durability_score,
              augmentation_potential: Math.round(Number(s.augmentation_potential ?? 0) * 100),
              displacement_risk: Math.round(Number(s.displacement_risk ?? 0) * 100),
            }))
        : [];

      const navScore = Math.min(100, Math.max(0, 100 - vulnScore + Math.round(Number(fri?.adaptability ?? 50) / 2)));
      let nav_stance: string; let nav_message: string;
      if (vulnScore < 30) {
        nav_stance = 'positioned';
        nav_message = personalizationActive
          ? 'Your skill portfolio has low AI displacement exposure. Your CAPADEX assessment highlights specific growth areas to deepen your advantage.'
          : 'Your current skill portfolio has low AI displacement exposure. Focus on augmentation to amplify output.';
      } else if (vulnScore < 55) {
        nav_stance = 'adaptive';
        nav_message = personalizationActive
          ? 'Moderate exposure detected. Your CAPADEX profile points to 1–2 targeted constructs where focused upskilling will have the highest impact.'
          : 'Moderate exposure — targeted upskilling in 2–3 durable skills will significantly reduce your vulnerability window.';
      } else {
        nav_stance = 'transition';
        nav_message = personalizationActive
          ? 'High displacement exposure. Your CAPADEX assessment has identified priority skill areas — starting there gives you the clearest path to a resilient portfolio.'
          : 'High displacement exposure detected. Prioritise the safe-harbor roles and augmentation opportunities below.';
      }

      return res.json({
        ok: true, vulnerability_score: vulnScore, nav_score: navScore, nav_stance, nav_message,
        fri_adaptability: fri ? Math.round(Number(fri.adaptability)) : null, fri_band: fri?.band ?? null,
        safe_harbor_roles: safeHarbors, augmentation_opportunities: augOpps, high_opportunity_sectors: highOpportunitySectors,
        skills_assessed: baseSkills.length,
        personalization_active: personalizationActive,
        capadex_constructs: Array.from(priorityConstructs),
        capadex_priority_skills: capadexPrioritySkills,
        computed_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[frp/products/ai-navigator]', err);
      return res.json({ ok: false, vulnerability_score: null, safe_harbor_roles: [], augmentation_opportunities: [] });
    }
  });

  /** GET /api/frp/products/transition-planner — Career Transition Planner: scored role paths */
  app.get('/api/frp/products/transition-planner', requireAuth, async (req: any, res: Response) => {
    const userId = String(req.user?.id ?? req.user?.userId ?? '');
    if (!userId) return res.status(401).json({ error: 'Unauthorised' });
    try {
      const [evolutionsRes, recsRes, friRes, userSkillsRes] = await Promise.all([
        pool.query(`SELECT * FROM frp_role_evolution ORDER BY feasibility_score DESC LIMIT 30`),
        pool.query(`SELECT * FROM frp_recommendations WHERE user_id=$1 AND status='active' ORDER BY priority DESC LIMIT 10`, [userId]),
        pool.query(`SELECT composite, band, skill_durability, market_alignment, learning_velocity, computed_at FROM frp_user_readiness WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 1`, [userId]),
        pool.query(
          `SELECT usp.skill_code, usp.proficiency_level, sl.name, sl.durability_score, sl.domain
             FROM frp_user_skill_profile usp JOIN frp_skill_library sl ON sl.skill_code = usp.skill_code
             WHERE usp.user_id = $1 ORDER BY usp.proficiency_level DESC`,
          [userId],
        ),
      ]);
      const evolutions = evolutionsRes.rows;
      const recs = recsRes.rows;
      const fri = friRes.rows[0] ?? null;
      const userSkills = userSkillsRes.rows;
      const userSkillNames = new Set(userSkills.map((s: any) => (s.name as string).toLowerCase()));

      const scoredPaths = evolutions.map((ev: any) => {
        const required: string[] = ev.required_skills ?? [];
        const covered = required.filter(s => userSkillNames.has(s.toLowerCase())).length;
        const skillMatch = required.length > 0 ? Math.round((covered / required.length) * 100) : 50;
        const adjustedFeasibility = Math.min(100, Math.round(Number(ev.feasibility_score) * 0.6 + skillMatch * 0.4));
        const gaps = required.filter(s => !userSkillNames.has(s.toLowerCase())).slice(0, 5);
        return {
          from_role: ev.from_role, to_role: ev.to_role, evolution_type: ev.evolution_type,
          feasibility_score: ev.feasibility_score, adjusted_feasibility: adjustedFeasibility,
          skill_match_pct: skillMatch, required_skills: required, skill_gaps: gaps,
          drop_skills: ev.drop_skills ?? [], is_ai_driven: ev.is_ai_driven,
          estimated_duration: `${ev.transition_months_min}–${ev.transition_months_max} months`,
        };
      }).sort((a: any, b: any) => b.adjusted_feasibility - a.adjusted_feasibility);

      const avgFeasibility = scoredPaths.length > 0
        ? Math.round(scoredPaths.reduce((s: number, p: any) => s + p.adjusted_feasibility, 0) / scoredPaths.length)
        : 0;
      const transitionRecs = recs.filter((r: any) => ['role_pivot','skill_reskill'].includes(r.rec_type)).slice(0, 5);

      return res.json({
        ok: true, paths: scoredPaths.slice(0, 10), total_paths: scoredPaths.length,
        top_path: scoredPaths[0] ?? null, transition_recs: transitionRecs,
        fri_band: fri?.band ?? null,
        fri_market_alignment: fri ? Math.round(Number(fri.market_alignment)) : null,
        fri_learning_velocity: fri ? Math.round(Number(fri.learning_velocity)) : null,
        avg_feasibility: avgFeasibility, user_skill_count: userSkills.length, computed_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[frp/products/transition-planner]', err);
      return res.json({ ok: false, paths: [], top_path: null });
    }
  });

  /** GET /api/frp/products/entrepreneurship — Entrepreneurship Intelligence */
  app.get('/api/frp/products/entrepreneurship', requireAuth, async (req: any, res: Response) => {
    const userId = String(req.user?.id ?? req.user?.userId ?? '');
    if (!userId) return res.status(401).json({ error: 'Unauthorised' });
    try {
      const [entSkillsRes, industriesRes, friRes] = await Promise.all([
        pool.query(
          `SELECT sl.skill_code, sl.name, sl.domain, sl.cluster, sl.durability_score, sl.human_quotient,
                  sl.description, ai.augmentation_potential, ai.impact_band,
                  COALESCE(usp.proficiency_level, 0) AS proficiency_level
             FROM frp_skill_library sl
             LEFT JOIN frp_ai_impact ai ON ai.skill_code = sl.skill_code
             LEFT JOIN frp_user_skill_profile usp ON usp.skill_code = sl.skill_code AND usp.user_id = $1
             WHERE sl.is_active = true
               AND (sl.domain ILIKE '%leadership%' OR sl.domain ILIKE '%management%'
                 OR sl.domain ILIKE '%innovation%' OR sl.domain ILIKE '%entrepreneurship%'
                 OR sl.cluster ILIKE '%creative%' OR sl.cluster ILIKE '%strategy%'
                 OR sl.human_quotient >= 75)
             ORDER BY sl.human_quotient DESC, sl.durability_score DESC`,
          [userId],
        ),
        pool.query(`SELECT * FROM frp_industry_forecast ORDER BY ai_readiness_score DESC`),
        pool.query(
          `SELECT composite, band, adaptability, learning_velocity, computed_at
             FROM frp_user_readiness WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 1`,
          [userId],
        ),
      ]);
      const entSkills = entSkillsRes.rows;
      const industries = industriesRes.rows;
      const fri = friRes.rows[0] ?? null;

      const skillsWithProf = entSkills.filter((s: any) => Number(s.proficiency_level) > 0);
      const avgEntSkillProf = skillsWithProf.length > 0
        ? skillsWithProf.reduce((s: number, sk: any) => s + Number(sk.proficiency_level), 0) / skillsWithProf.length : 0;
      const adaptability = fri ? Number(fri.adaptability) : 45;
      const learningVel  = fri ? Number(fri.learning_velocity) : 45;
      const entrepreneurialScore = Math.round(avgEntSkillProf * 0.4 + adaptability * 0.35 + learningVel * 0.25);

      let readiness_label: string;
      if (entrepreneurialScore >= 75) readiness_label = 'Venture-ready';
      else if (entrepreneurialScore >= 55) readiness_label = 'Building foundation';
      else if (entrepreneurialScore >= 35) readiness_label = 'Early exploration';
      else readiness_label = 'Foundation needed';

      const opportunitySectors = industries.filter((i: any) => ['exceptional','strong'].includes(i.growth_outlook)).slice(0, 4)
        .map((i: any) => ({ industry_name: i.industry_name, growth_outlook: i.growth_outlook, ai_readiness_score: i.ai_readiness_score, horizon_years: i.horizon_years, top_growing_roles: (i.top_growing_roles ?? []).slice(0, 3), rising_skills: (i.skill_demand_shift?.rising ?? []).slice(0, 4) }));

      const skillGaps = entSkills.filter((s: any) => Number(s.human_quotient) >= 70 && Number(s.proficiency_level) < 50).slice(0, 5)
        .map((s: any) => ({ name: s.name, domain: s.domain, human_quotient: s.human_quotient, proficiency_level: s.proficiency_level, gap: 70 - Number(s.proficiency_level) }));
      const strengths = entSkills.filter((s: any) => Number(s.proficiency_level) >= 60).slice(0, 4)
        .map((s: any) => ({ name: s.name, domain: s.domain, proficiency_level: s.proficiency_level, human_quotient: s.human_quotient }));

      return res.json({
        ok: true, entrepreneurial_score: entrepreneurialScore, readiness_label,
        opportunity_sectors: opportunitySectors, skill_gaps: skillGaps, strengths,
        ent_skill_count: entSkills.length, skills_assessed: skillsWithProf.length,
        fri_adaptability: fri ? Math.round(Number(fri.adaptability)) : null,
        fri_learning_velocity: fri ? Math.round(Number(fri.learning_velocity)) : null,
        computed_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[frp/products/entrepreneurship]', err);
      return res.json({ ok: false, entrepreneurial_score: null, opportunity_sectors: [], skill_gaps: [] });
    }
  });

  /** GET /api/frp/products/emerging-careers — Emerging Career Intelligence */
  app.get('/api/frp/products/emerging-careers', requireAuth, async (req: any, res: Response) => {
    const userId = String(req.user?.id ?? req.user?.userId ?? '');
    if (!userId) return res.status(401).json({ error: 'Unauthorised' });
    try {
      const [industriesRes, evolutionsRes, growthSkillsRes, userSkillsRes, friRes] = await Promise.all([
        pool.query(`SELECT * FROM frp_industry_forecast ORDER BY ai_readiness_score DESC`),
        pool.query(`SELECT * FROM frp_role_evolution WHERE evolution_type IN ('transformative','ai_transition') ORDER BY feasibility_score DESC LIMIT 20`),
        pool.query(
          `SELECT sl.*, ai.displacement_risk, ai.augmentation_potential, ai.new_work_creation, ai.impact_band
             FROM frp_skill_library sl
             JOIN frp_ai_impact ai ON ai.skill_code = sl.skill_code
             WHERE sl.demand_trend = 'high_growth' AND sl.is_active = true
             ORDER BY ai.new_work_creation DESC, sl.durability_score DESC`,
        ),
        pool.query(
          `SELECT usp.skill_code, usp.proficiency_level, sl.name, sl.demand_trend
             FROM frp_user_skill_profile usp JOIN frp_skill_library sl ON sl.skill_code = usp.skill_code
             WHERE usp.user_id = $1`,
          [userId],
        ),
        pool.query(
          `SELECT composite, band, market_alignment, adaptability, computed_at
             FROM frp_user_readiness WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 1`,
          [userId],
        ),
      ]);
      const industries = industriesRes.rows;
      const transformativePaths = evolutionsRes.rows;
      const growthSkills = growthSkillsRes.rows;
      const userSkills = userSkillsRes.rows;
      const fri = friRes.rows[0] ?? null;
      const userSkillNames = new Set(userSkills.map((s: any) => (s.name as string).toLowerCase()));
      const userHighGrowthSkills = userSkills.filter((s: any) => s.demand_trend === 'high_growth');

      const emergingRoles: any[] = [];
      for (const ind of industries) {
        for (const role of (ind.top_growing_roles ?? []).slice(0, 2)) {
          if (!emergingRoles.find(r => r.role_name === role)) {
            emergingRoles.push({ role_name: role, industry: ind.industry_name, industry_ai_readiness: ind.ai_readiness_score, growth_outlook: ind.growth_outlook, entry_type: 'industry_growth', horizon: `${ind.horizon_years}y` });
          }
        }
      }
      for (const ev of transformativePaths.slice(0, 5)) {
        if (!emergingRoles.find(r => r.role_name === ev.to_role)) {
          emergingRoles.push({
            role_name: ev.to_role, from_role: ev.from_role, entry_type: ev.evolution_type,
            feasibility: ev.feasibility_score,
            required_skills: (ev.required_skills ?? []).slice(0, 4),
            skill_gaps: (ev.required_skills ?? []).filter((s: string) => !userSkillNames.has(s.toLowerCase())).slice(0, 3),
            timeline: `${ev.transition_months_min}–${ev.transition_months_max}mo`, is_ai_driven: ev.is_ai_driven,
          });
        }
      }

      const alignmentScore = growthSkills.length > 0
        ? Math.round((userHighGrowthSkills.length / Math.min(growthSkills.length, 10)) * 100) : 0;

      const futureProofSkills = growthSkills
        .filter((s: any) => Number(s.new_work_creation) >= 0.5 && Number(s.durability_score) >= 65).slice(0, 6)
        .map((s: any) => ({ name: s.name, domain: s.domain, new_work_creation: Math.round(Number(s.new_work_creation) * 100), durability_score: s.durability_score, user_has: userSkillNames.has(s.name.toLowerCase()) }));

      return res.json({
        ok: true, emerging_roles: emergingRoles.slice(0, 10), total_emerging: emergingRoles.length,
        future_proof_skills: futureProofSkills, alignment_score: alignmentScore,
        user_high_growth_skills: userHighGrowthSkills.length,
        transformative_paths: transformativePaths.slice(0, 5).map((ev: any) => ({
          from_role: ev.from_role, to_role: ev.to_role, feasibility_score: ev.feasibility_score,
          timeline: `${ev.transition_months_min}–${ev.transition_months_max}mo`,
          is_ai_driven: ev.is_ai_driven, required_skills: (ev.required_skills ?? []).slice(0, 4),
        })),
        fri_market_alignment: fri ? Math.round(Number(fri.market_alignment)) : null,
        fri_adaptability: fri ? Math.round(Number(fri.adaptability)) : null,
        computed_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[frp/products/emerging-careers]', err);
      return res.json({ ok: false, emerging_roles: [], future_proof_skills: [], alignment_score: null });
    }
  });

  // ── Admin: Backfill ────────────────────────────────────────────────────

  /** POST /api/admin/frp/backfill-users
   *  Iterates career_seeker_profiles, runs autoPopulateSkillProfile +
   *  computeFutureReadinessIndex + persistFRISnapshot for each user.
   *  Returns a { attempted, succeeded, failed } summary.
   */
  app.post('/api/admin/frp/backfill-users', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { rows: candidates } = await pool.query<{ user_id: string }>(
        `SELECT DISTINCT user_id::text AS user_id FROM career_seeker_profiles LIMIT 500`,
      );
      let attempted = 0; let succeeded = 0; let failed = 0;
      const sampleErrors: string[] = [];
      for (const c of candidates) {
        attempted++;
        try {
          await autoPopulateSkillProfile(c.user_id, pool);
          const fri = await computeFutureReadinessIndex(c.user_id, pool);
          await persistFRISnapshot(c.user_id, fri, pool);
          succeeded++;
        } catch (e: any) {
          failed++;
          if (sampleErrors.length < 5) sampleErrors.push(`${c.user_id}: ${(e as Error).message}`);
        }
      }
      return res.json({ ok: true, attempted, succeeded, failed, sample_errors: sampleErrors });
    } catch (err) {
      console.error('[admin/frp/backfill-users]', err);
      return res.status(500).json({ error: 'Backfill failed', detail: String(err) });
    }
  });

  // ── Admin: Deep Analytics ──────────────────────────────────────────────

  /** GET /api/admin/frp/analytics
   *  Returns: FRI band distribution, per-axis signal quality (real vs default), top skills
   *  by user count, FRP outcome-model action coverage, and backfill candidate count.
   */
  app.get('/api/admin/frp/analytics', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const [bandsRes, signalRes, skillsRes, coverageRes, backfillRes] = await Promise.all([
        pool.query(`
          SELECT band, COUNT(*) AS count FROM frp_user_readiness
          WHERE computed_at > now() - interval '90 days'
          GROUP BY band ORDER BY band
        `),
        pool.query(`
          SELECT provenance FROM frp_user_readiness
          WHERE computed_at > now() - interval '90 days'
          LIMIT 500
        `),
        pool.query(`
          SELECT sl.skill_code, sl.name, sl.domain,
                 COUNT(usp.user_id) AS user_count,
                 ROUND(AVG(usp.proficiency_level)) AS avg_proficiency
          FROM frp_skill_library sl
          LEFT JOIN frp_user_skill_profile usp ON usp.skill_code = sl.skill_code
          WHERE sl.is_active = true
          GROUP BY sl.skill_code, sl.name, sl.domain
          ORDER BY user_count DESC, sl.name ASC LIMIT 20
        `),
        pool.query(`
          SELECT m.model_key, m.display_label, m.gated,
                 array_length(m.construct_keys, 1) AS ck_count,
                 COUNT(DISTINCT il.id) AS il_count
          FROM wc3_outcome_models m
          CROSS JOIN unnest(m.construct_keys) AS ck
          LEFT JOIN intervention_library il ON il.construct_key = ck AND il.is_active = true
          WHERE m.model_key IN (
            'ai_career_readiness','career_transition_readiness',
            'future_skills_readiness','entrepreneurship_readiness'
          )
          GROUP BY m.model_key, m.display_label, m.gated, array_length(m.construct_keys, 1)
          ORDER BY m.model_key
        `),
        pool.query(`
          SELECT COUNT(DISTINCT csp.user_id) AS backfill_candidates
          FROM career_seeker_profiles csp
          LEFT JOIN frp_user_readiness r ON r.user_id::text = csp.user_id::text
          WHERE r.user_id IS NULL
        `),
      ]);

      const BANDS = ['pioneering', 'resilient', 'capable', 'developing', 'emerging'];
      const bandMap: Record<string, number> = {};
      for (const r of bandsRes.rows) bandMap[r.band] = Number(r.count);
      const totalBand = Object.values(bandMap).reduce((a, b) => a + b, 0);
      const band_distribution = BANDS.map(b => ({
        band: b, count: bandMap[b] ?? 0,
        pct: totalBand > 0 ? Math.round(((bandMap[b] ?? 0) / totalBand) * 100) : 0,
      }));

      // Aggregate per-axis signal quality from provenance JSONB
      type AxisQ = { real: number; default: number };
      const axisCounts: Record<string, AxisQ> = {
        adaptability:      { real: 0, default: 0 },
        skill_durability:  { real: 0, default: 0 },
        market_alignment:  { real: 0, default: 0 },
        learning_velocity: { real: 0, default: 0 },
      };
      for (const r of signalRes.rows) {
        try {
          const p = typeof r.provenance === 'string' ? JSON.parse(r.provenance) : (r.provenance ?? {});
          for (const axis of Object.keys(axisCounts)) {
            const src = String((p[axis] as any)?.source ?? '');
            if (src.startsWith('default') || src === 'error') axisCounts[axis].default++;
            else if (src) axisCounts[axis].real++;
          }
        } catch { /* skip malformed */ }
      }
      const signal_quality = Object.entries(axisCounts).map(([axis, v]) => {
        const total = v.real + v.default;
        return { axis, real: v.real, default_fallback: v.default, real_pct: total > 0 ? Math.round(v.real / total * 100) : 0 };
      });

      return res.json({
        ok: true,
        total_assessed: totalBand,
        band_distribution,
        signal_quality,
        top_skills: skillsRes.rows.map(r => ({
          ...r, user_count: Number(r.user_count), avg_proficiency: Number(r.avg_proficiency ?? 0),
        })),
        outcome_action_coverage: coverageRes.rows.map(r => ({
          ...r, ck_count: Number(r.ck_count), il_count: Number(r.il_count),
        })),
        backfill_candidates: Number(backfillRes.rows[0]?.backfill_candidates ?? 0),
        computed_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[admin/frp/analytics]', err);
      return res.status(500).json({ error: 'Analytics query failed', detail: String(err) });
    }
  });
}
