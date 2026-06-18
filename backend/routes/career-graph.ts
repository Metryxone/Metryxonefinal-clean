/**
 * Career Graph Intelligence — API routes
 * Prefix: /api/career/*   (user-facing, authenticated)
 *         /api/admin/career-graph/*  (superadmin)
 *
 * Additive + flag-gated: FF_CAREER_GRAPH=1 to enable.
 * Flag-off → 503 on every route.
 * Literal sub-paths ALWAYS registered BEFORE /:param catch-alls.
 */

import * as fs   from 'fs';
import * as path from 'path';
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import type { CgRole } from '../services/career-graph-engine';
import {
  listRoles, getRoleById, getNeighbours, getPaths, listTracks,
  findTracksForRole, buildGraphCache,
} from '../services/career-graph-engine';
import {
  computeSkillGaps,
} from '../services/career-skill-gap-engine';
import {
  computeReadiness, loadReadinessWeights, readinessCohortStats,
} from '../services/career-readiness-engine';
import {
  generateRecommendations,
} from '../services/career-recommendation-engine';
import {
  generateLearningRecs, markResourceActioned,
} from '../services/career-learning-rec-engine';

type Auth = (req: Request, res: Response, next: () => void) => void;

const FLAG = 'FF_CAREER_GRAPH';
const flagOn = () => process.env[FLAG] === '1';

function flagGate(_req: Request, res: Response, next: () => void) {
  if (!flagOn()) {
    return res.status(503).json({ ok: false, error: 'Feature not enabled', flag: FLAG });
  }
  next();
}

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  const migDir = path.join(__dirname, '../migrations');
  for (const f of [
    '20260611_career_graph.sql',
    '20260611_career_graph_supplement.sql',
  ]) {
    const p = path.join(migDir, f);
    if (fs.existsSync(p)) {
      const sql = fs.readFileSync(p, 'utf8');
      await pool.query(sql);  // propagates on DDL failure — fail closed
    }
  }
  // Verify essential table present before declaring schema ready.
  // If migrations left an incomplete schema, this throws and the caller returns 500/503.
  await pool.query('SELECT 1 FROM cg_roles LIMIT 1');
  schemaReady = true;
}

/**
 * Resolve the user's current role server-side.
 * Priority: explicit query param → most-recent saved path → profile currentRole title → highest-demand anchor.
 */
async function resolveCurrentRoleForUser(
  pool: Pool,
  userId: string,
  providedRoleId: number | null,
  getRoleByIdFn: typeof getRoleById,
): Promise<CgRole | null> {
  if (providedRoleId) return getRoleByIdFn(pool, providedRoleId);

  // 1. Most-recent saved career path from_role_id
  const pathRes = await pool.query(
    `SELECT from_role_id FROM cg_user_career_path
     WHERE user_id = $1 AND from_role_id IS NOT NULL
     ORDER BY saved_at DESC LIMIT 1`,
    [userId],
  ).catch(() => ({ rows: [] }));
  if (pathRes.rows[0]?.from_role_id) {
    const r = await getRoleByIdFn(pool, Number(pathRes.rows[0].from_role_id));
    if (r) return r;
  }

  // 2. Profile currentRole title → fuzzy-match role
  const profRes = await pool.query(
    `SELECT data->>'currentRole' AS cr FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`,
    [userId],
  ).catch(() => ({ rows: [] }));
  const crTitle: string | null = profRes.rows[0]?.cr ?? null;
  if (crTitle) {
    const roleRes = await pool.query(
      `SELECT id FROM cg_roles WHERE LOWER(title) = LOWER($1) AND is_active LIMIT 1`,
      [crTitle],
    ).catch(() => ({ rows: [] }));
    if (roleRes.rows[0]) {
      const r = await getRoleByIdFn(pool, Number(roleRes.rows[0].id));
      if (r) return r;
    }
  }

  // 3. Anchor to the highest-demand active role so recommendations are never empty
  const anchorRes = await pool.query(
    `SELECT id FROM cg_roles WHERE is_active ORDER BY demand_score DESC LIMIT 1`,
  ).catch(() => ({ rows: [] }));
  if (anchorRes.rows[0]) return getRoleByIdFn(pool, Number(anchorRes.rows[0].id));
  return null;
}

function resolveUserId(req: Request): string | null {
  const user = (req as Request & { user?: { id?: string; userId?: string } }).user;
  if (user?.id)     return String(user.id);
  if (user?.userId) return String(user.userId);
  return null;
}

function safeInt(v: unknown): number | null {
  const n = parseInt(String(v ?? ''));
  return isNaN(n) ? null : n;
}

// Simple 60-second admin cache
const adminCache = new Map<string, { ts: number; data: unknown }>();
function adminCached<T>(key: string, bust: boolean, fn: () => Promise<T>): Promise<T> {
  const entry = adminCache.get(key);
  if (!bust && entry && Date.now() - entry.ts < 60_000) return Promise.resolve(entry.data as T);
  return fn().then(data => { adminCache.set(key, { ts: Date.now(), data }); return data; });
}

export function registerCareerGraphRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Auth,
  requireSuperAdmin: Auth,
): void {

  // Eager schema init + occupation seed at server startup — fire-and-forget, non-fatal.
  // Ensures cg_* tables exist and base role/skill data is populated without waiting for
  // the first user request (which previously left the tables missing until Career Builder
  // was first visited).
  ensureSchema(pool)
    .then(() => import('../services/occupation-graph-seed').then(m => m.ensureOccupationGraphSeed(pool)))
    .then(() => import('../services/occupation-graph-seed-p5').then(m => m.ensureOccupationGraphSeedP5(pool)))
    .catch(err => console.warn('[career-graph] startup init:', err instanceof Error ? err.message : String(err)));

  app.use('/api/career',       async (_req, _res, next) => { try { await ensureSchema(pool); next(); } catch (err) { next(err); } });
  app.use('/api/admin/career-graph', async (_req, _res, next) => { try { await ensureSchema(pool); next(); } catch (err) { next(err); } });

  // ════════════════════════════════════════════════════════════════════════════
  // USER ROUTES
  // ════════════════════════════════════════════════════════════════════════════

  // GET /api/career/roles — paginated role catalog
  app.get('/api/career/roles', requireAuth, flagGate, async (req: Request, res: Response) => {
    try {
      const { function: fn, seniority, industry, limit, offset } = req.query as Record<string, string>;
      const result = await listRoles(pool, {
        function_area: fn,
        seniority,
        industry,
        limit:  limit  ? parseInt(limit)  : 50,
        offset: offset ? parseInt(offset) : 0,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // GET /api/career/tracks — 15 career tracks with waypoints  (literal before /:id)
  app.get('/api/career/tracks', requireAuth, flagGate, async (_req: Request, res: Response) => {
    try {
      const tracks = await listTracks(pool);
      res.json({ ok: true, tracks, total: tracks.length });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // GET /api/career/current-role — user's resolved current role + neighbours  (literal before /:id)
  app.get('/api/career/current-role', requireAuth, flagGate, async (req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const userId = resolveUserId(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'Unauthenticated' });
      const currentRole = await resolveCurrentRoleForUser(pool, userId, null, getRoleById);
      const neighbours = currentRole
        ? await getNeighbours(pool, currentRole.id).catch(() => [] as Awaited<ReturnType<typeof getNeighbours>>)
        : [];
      res.json({ ok: true, current_role: currentRole ?? null, neighbours });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // GET /api/career/paths?from=&to= — Dijkstra optimal paths  (literal before /:id)
  app.get('/api/career/paths', requireAuth, flagGate, async (req: Request, res: Response) => {
    try {
      const fromId = safeInt(req.query.from);
      const toId   = safeInt(req.query.to);
      if (!fromId || !toId) return res.status(400).json({ ok: false, error: '"from" and "to" role ids required' });
      const paths = await getPaths(pool, fromId, toId);
      res.json({ ok: true, paths });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // GET /api/career/recommendations — personalised ranked next-role list  (literal before /:id)
  app.get('/api/career/recommendations', requireAuth, flagGate, async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'Unauthenticated' });

      const { current_role_id } = req.query as Record<string, string>;
      const roleId = safeInt(current_role_id);

      const g = await buildGraphCache(pool);
      const currentRole = await resolveCurrentRoleForUser(pool, userId, roleId, getRoleById);

      const readinessMap = new Map<number, Awaited<ReturnType<typeof computeReadiness>>>();
      if (currentRole) {
        const neighbours = g.adjacency.get(currentRole.id) ?? [];
        const neighbourIds = neighbours.slice(0, 12).map(e => e.to_role_id);
        await Promise.all(neighbourIds.map(async nid => {
          const gap = await computeSkillGaps(pool, userId, nid);
          const r = await computeReadiness(pool, userId, nid, gap);
          readinessMap.set(nid, r);
        }));
      }

      const bundle = await generateRecommendations(pool, userId, currentRole, g, readinessMap);
      res.json({ ok: true, ...bundle });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // GET /api/career/report — full Career Intelligence Report  (literal before /:id)
  app.get('/api/career/report', requireAuth, flagGate, async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'Unauthenticated' });

      const profileRow = await pool.query(
        `SELECT data FROM career_seeker_profiles WHERE id = $1 LIMIT 1`,
        [userId],
      ).catch(() => ({ rows: [] }));
      const profileData = (profileRow.rows[0]?.data ?? {}) as Record<string, unknown>;
      const currentRoleTitle: string | null = (profileData.currentRole as string) ?? null;

      const g = await buildGraphCache(pool);
      const currentRole = await resolveCurrentRoleForUser(pool, userId, null, getRoleById);

      // match_confidence: higher when the user has an explicit saved path
      const hasSavedPath = (await pool.query(
        `SELECT 1 FROM cg_user_career_path WHERE user_id=$1 LIMIT 1`, [userId],
      ).catch(() => ({ rows: [] }))).rows.length > 0;
      const matchConfidence: number | null = currentRole
        ? (hasSavedPath ? 0.8 : 0.6)
        : null;

      const reportReadinessMap = new Map<number, Awaited<ReturnType<typeof computeReadiness>>>();
      if (currentRole) {
        const nbrs = g.adjacency.get(currentRole.id) ?? [];
        await Promise.all(nbrs.slice(0, 8).map(async e => {
          const gap = await computeSkillGaps(pool, userId, e.to_role_id).catch(() => null);
          if (gap) {
            const r = await computeReadiness(pool, userId, e.to_role_id, gap).catch(() => null);
            if (r) reportReadinessMap.set(e.to_role_id, r);
          }
        }));
      }
      const bundle = await generateRecommendations(pool, userId, currentRole, g, reportReadinessMap);

      // Top 3 targets from next_steps + stretch_goals
      const topTargets = [
        ...(bundle.next_steps    ?? []).slice(0, 2),
        ...(bundle.stretch_goals ?? []).slice(0, 1),
      ];

      const readinessByRole: Record<number, unknown> = {};
      const gapsByRole: Record<number, unknown> = {};
      for (const rec of topTargets) {
        const rId = rec.role_id;
        const gap = await computeSkillGaps(pool, userId, rId).catch(() => null);
        gapsByRole[rId] = gap;
        if (gap) {
          const r = await computeReadiness(pool, userId, rId, gap).catch(() => null);
          readinessByRole[rId] = r;
        }
      }

      // Fetch full market details (automation_risk, growth_30mo, seniority, function_area)
      const targetIds = topTargets.map(r => r.role_id).filter(Boolean);
      type MktRow = { automation_risk: number; growth_30mo: number; seniority: string; function_area: string | null };
      const mktRows: Record<number, MktRow> = {};
      if (targetIds.length) {
        const mktRes = await pool.query(
          `SELECT id, seniority, function_area,
                  automation_risk::float AS automation_risk,
                  growth_30mo::float     AS growth_30mo
           FROM cg_roles WHERE id = ANY($1)`,
          [targetIds],
        ).catch(() => ({ rows: [] }));
        for (const row of mktRes.rows as Array<Record<string, unknown>>) {
          mktRows[row.id as number] = {
            automation_risk: Number(row.automation_risk ?? 30),
            growth_30mo:     Number(row.growth_30mo ?? 5),
            seniority:       String(row.seniority ?? ''),
            function_area:   (row.function_area as string) ?? null,
          };
        }
      }

      const report = {
        generated_at: new Date().toISOString(),
        user_id:      userId,
        sections: {
          position_analysis: {
            current_role:        currentRoleTitle,
            seniority:           currentRole?.seniority ?? null,
            function_fit:        currentRole?.function_area ?? null,
            match_confidence:    matchConfidence,
            profile_completeness: (profileData.completeness as number) ?? null,
          },
          readiness_summary: topTargets.map(rec => ({
            role_id:      rec.role_id,
            role_title:   rec.title,
            seniority:    mktRows[rec.role_id]?.seniority ?? null,
            function_area: mktRows[rec.role_id]?.function_area ?? null,
            readiness:    readinessByRole[rec.role_id] ?? null,
            segment:      rec.segment,
          })),
          skill_gap_analysis: topTargets.map(rec => ({
            role_id:    rec.role_id,
            role_title: rec.title,
            gaps:       gapsByRole[rec.role_id] ?? null,
          })),
          learning_pathway: topTargets.length
            ? await generateLearningRecs(
                pool, userId, topTargets[0].role_id,
                (gapsByRole[topTargets[0].role_id] as { gaps?: [] })?.gaps ?? [],
              ).catch(() => ({ recommendations: [] }))
            : { recommendations: [] },
          market_signals: topTargets.map(rec => ({
            role_id:         rec.role_id,
            role_title:      rec.title,
            demand_score:    rec.demand_score,
            automation_risk: mktRows[rec.role_id]?.automation_risk ?? null,
            growth_30mo:     mktRows[rec.role_id]?.growth_30mo ?? null,
          })),
        },
        confidence:   bundle.confidence,
        data_sources: bundle.data_sources,
      };

      res.json({ ok: true, report });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // POST /api/career/path — save selected career path  (literal before /:id)
  app.post('/api/career/path', requireAuth, flagGate, async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'Unauthenticated' });
      const b = req.body as Record<string, unknown>;
      // Accept both frontend shape (to_role_id / source) and legacy (role_id / path_type)
      const finalRoleId = b.to_role_id ?? b.role_id;
      const finalSource = String(b.source ?? b.path_type ?? 'user_selected');
      if (!finalRoleId) return res.status(400).json({ ok: false, error: 'to_role_id required' });
      await pool.query(
        `INSERT INTO cg_user_career_path(user_id, to_role_id, source)
         VALUES($1,$2,$3)
         ON CONFLICT(user_id, to_role_id) DO UPDATE SET source=$3, saved_at=NOW()`,
        [userId, finalRoleId, finalSource],
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // GET /api/career/skill-gap/:roleId
  app.get('/api/career/skill-gap/:roleId', requireAuth, flagGate, async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'Unauthenticated' });
      const roleId = safeInt(req.params.roleId);
      if (!roleId) return res.status(400).json({ ok: false, error: 'Invalid roleId' });
      const result = await computeSkillGaps(pool, userId, roleId);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // GET /api/career/readiness/:roleId
  app.get('/api/career/readiness/:roleId', requireAuth, flagGate, async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'Unauthenticated' });
      const roleId = safeInt(req.params.roleId);
      if (!roleId) return res.status(400).json({ ok: false, error: 'Invalid roleId' });
      const gap = await computeSkillGaps(pool, userId, roleId);
      const readiness = await computeReadiness(pool, userId, roleId, gap);
      const cohort = await readinessCohortStats(pool, roleId);
      res.json({ ok: true, readiness, cohort });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // GET /api/career/learning/:roleId — learning recs  (BEFORE /:roleId/:resourceId/action)
  app.get('/api/career/learning/:roleId', requireAuth, flagGate, async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'Unauthenticated' });
      const roleId = safeInt(req.params.roleId);
      if (!roleId) return res.status(400).json({ ok: false, error: 'Invalid roleId' });
      const gap = await computeSkillGaps(pool, userId, roleId);
      const result = await generateLearningRecs(pool, userId, roleId, gap.gaps);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // POST /api/career/learning/:roleId/:resourceId/action
  app.post('/api/career/learning/:roleId/:resourceId/action', requireAuth, flagGate, async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'Unauthenticated' });
      const roleId     = safeInt(req.params.roleId);
      const resourceId = safeInt(req.params.resourceId);
      if (!roleId || !resourceId) return res.status(400).json({ ok: false, error: 'Invalid ids' });
      const { action_type = 'started' } = req.body as Record<string, unknown>;
      const allowed = new Set(['started', 'completed', 'bookmarked']);
      if (!allowed.has(String(action_type))) return res.status(400).json({ ok: false, error: 'Invalid action_type' });
      await markResourceActioned(pool, userId, roleId, resourceId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // GET /api/career/roles/:id/neighbors — literal sub-path BEFORE /:id
  app.get('/api/career/roles/:id/neighbors', requireAuth, flagGate, async (req: Request, res: Response) => {
    try {
      const id = safeInt(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid role id' });
      const neighbours = await getNeighbours(pool, id);
      res.json({ ok: true, neighbours, total: neighbours.length });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // GET /api/career/roles/:id — role detail + skill requirements
  app.get('/api/career/roles/:id', requireAuth, flagGate, async (req: Request, res: Response) => {
    try {
      const id = safeInt(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid role id' });
      const role = await getRoleById(pool, id);
      if (!role) return res.status(404).json({ ok: false, error: 'Role not found' });

      const [reqRows, promoRows, lateralRows, trackRows] = await Promise.all([
        pool.query(`SELECT * FROM cg_skill_requirements WHERE role_id=$1 ORDER BY importance, min_proficiency DESC`, [id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM cg_promotion_rules WHERE from_role_id=$1`, [id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM cg_lateral_rules   WHERE from_role_id=$1`, [id]).catch(() => ({ rows: [] })),
        findTracksForRole(pool, id).catch(() => []),
      ]);

      res.json({
        ok: true,
        role,
        skill_requirements: reqRows.rows,
        promotion_rules:    promoRows.rows,
        lateral_rules:      lateralRows.rows,
        tracks:             trackRows,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── Promotion Paths — from user's resolved current role ──────────────────
  app.get('/api/career/promotion-paths', requireAuth, flagGate, async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'Unauthenticated' });
      const currentRole = await resolveCurrentRoleForUser(pool, userId, null, getRoleById);
      if (!currentRole) return res.json({ ok: true, promotion_paths: [], current_role: null });
      const r = await pool.query(
        `SELECT pr.id, pr.to_role_id, pr.min_months, pr.required_skills, pr.condition_text,
                tr.title AS to_role_title, tr.seniority AS to_role_seniority,
                tr.function_area, tr.avg_salary_inr, tr.demand_score::float
         FROM cg_promotion_rules pr
         JOIN cg_roles tr ON tr.id = pr.to_role_id
         WHERE pr.from_role_id = $1 AND tr.is_active
         ORDER BY pr.min_months ASC`,
        [currentRole.id],
      ).catch(() => ({ rows: [] }));
      const paths = await Promise.all((r.rows as Record<string, unknown>[]).map(async (row) => {
        const gap = await computeSkillGaps(pool, userId, Number(row.to_role_id)).catch(() => null);
        const readiness = gap ? await computeReadiness(pool, userId, Number(row.to_role_id), gap).catch(() => null) : null;
        return { ...row, readiness_score: readiness?.readiness_score ?? null, readiness_band: readiness?.readiness_band ?? null };
      }));
      res.json({ ok: true, current_role: currentRole, promotion_paths: paths });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── Lateral Options — from user's resolved current role ───────────────────
  app.get('/api/career/lateral-options', requireAuth, flagGate, async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'Unauthenticated' });
      const currentRole = await resolveCurrentRoleForUser(pool, userId, null, getRoleById);
      if (!currentRole) return res.json({ ok: true, lateral_options: [], current_role: null });
      const r = await pool.query(
        `SELECT lr.id, lr.to_role_id, lr.similarity_score::float, lr.skills_to_gain, lr.condition_text,
                tr.title AS to_role_title, tr.seniority AS to_role_seniority,
                tr.function_area, tr.avg_salary_inr, tr.demand_score::float
         FROM cg_lateral_rules lr
         JOIN cg_roles tr ON tr.id = lr.to_role_id
         WHERE lr.from_role_id = $1 AND tr.is_active
         ORDER BY lr.similarity_score DESC`,
        [currentRole.id],
      ).catch(() => ({ rows: [] }));
      const options = await Promise.all((r.rows as Record<string, unknown>[]).map(async (row) => {
        const gap = await computeSkillGaps(pool, userId, Number(row.to_role_id)).catch(() => null);
        const readiness = gap ? await computeReadiness(pool, userId, Number(row.to_role_id), gap).catch(() => null) : null;
        return { ...row, readiness_score: readiness?.readiness_score ?? null };
      }));
      res.json({ ok: true, current_role: currentRole, lateral_options: options });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── Track detail — literal BEFORE /:id catch-alls ─────────────────────────
  app.get('/api/career/tracks/:trackId', requireAuth, flagGate, async (req: Request, res: Response) => {
    try {
      const trackId = safeInt(req.params.trackId);
      if (!trackId) return res.status(400).json({ ok: false, error: 'Invalid trackId' });
      const [trackRes, waypointsRes] = await Promise.all([
        pool.query(`SELECT * FROM cg_tracks WHERE id=$1`, [trackId]).catch(() => ({ rows: [] })),
        pool.query(
          `SELECT w.step_order, w.is_optional, r.id AS role_id, r.title, r.seniority, r.function_area,
                  r.avg_salary_inr, r.demand_score::float
           FROM cg_track_waypoints w
           JOIN cg_roles r ON r.id = w.role_id
           WHERE w.track_id = $1
           ORDER BY w.step_order`,
          [trackId],
        ).catch(() => ({ rows: [] })),
      ]);
      if (!trackRes.rows[0]) return res.status(404).json({ ok: false, error: 'Track not found' });
      res.json({ ok: true, track: trackRes.rows[0], waypoints: waypointsRes.rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ADMIN ROUTES  (requireSuperAdmin)
  // ════════════════════════════════════════════════════════════════════════════

  // GET /api/admin/career-graph/stats  (literal before /:resource)
  app.get('/api/admin/career-graph/stats', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const stats = await adminCached('stats', bust, async () => {
        const [roles, edges, tracks, users, gaps, recs] = await Promise.all([
          pool.query(`SELECT COUNT(*)::int n FROM cg_roles WHERE is_active`),
          pool.query(`SELECT COUNT(*)::int n FROM cg_role_edges`),
          pool.query(`SELECT COUNT(*)::int n FROM cg_tracks`),
          pool.query(`SELECT COUNT(DISTINCT user_id)::int n FROM cg_user_role_readiness`),
          pool.query(`SELECT COUNT(*)::int n FROM cg_user_skill_gaps`),
          pool.query(`SELECT COUNT(*)::int n FROM cg_user_recommendations`),
        ]);
        const topRoles = await pool.query(
          `SELECT r.title, COUNT(rec.id)::int AS rec_count
           FROM cg_user_recommendations rec
           JOIN cg_roles r ON r.id = rec.role_id
           GROUP BY r.id, r.title ORDER BY rec_count DESC LIMIT 5`
        ).catch(() => ({ rows: [] }));
        const dist = await pool.query(
          `SELECT readiness_band, COUNT(*)::int AS n
           FROM cg_user_role_readiness GROUP BY readiness_band`
        ).catch(() => ({ rows: [] }));
        return {
          roles:        Number(roles.rows[0]?.n ?? 0),
          edges:        Number(edges.rows[0]?.n ?? 0),
          tracks:       Number(tracks.rows[0]?.n ?? 0),
          users_scored: Number(users.rows[0]?.n ?? 0),
          skill_gaps:   Number(gaps.rows[0]?.n ?? 0),
          recs_stored:  Number(recs.rows[0]?.n ?? 0),
          top_roles:    topRoles.rows,
          readiness_distribution: dist.rows,
        };
      });
      res.json({ ok: true, stats });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── Roles ──────────────────────────────────────────────────────────────────

  app.get('/api/admin/career-graph/roles', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const { function: fn, seniority, industry, limit = '100', offset = '0' } = req.query as Record<string, string>;
      const data = await adminCached(`roles:${fn}:${seniority}:${industry}:${limit}:${offset}`, bust, () =>
        listRoles(pool, { function_area: fn, seniority, industry, limit: parseInt(limit), offset: parseInt(offset) })
      );
      res.json({ ok: true, ...data });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.post('/api/admin/career-graph/roles', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      if (!b.role_key || !b.title || !b.seniority) return res.status(400).json({ ok: false, error: 'role_key, title, seniority required' });
      const r = await pool.query(
        `INSERT INTO cg_roles(role_key, title, seniority, function_area, description, avg_salary_inr, demand_score, automation_risk, growth_30mo)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT(role_key) DO UPDATE SET
           title=$2, seniority=$3, function_area=$4, description=$5,
           avg_salary_inr=$6, demand_score=$7, automation_risk=$8, growth_30mo=$9, updated_at=NOW()
         RETURNING id`,
        [b.role_key, b.title, b.seniority, b.function_area ?? 'general',
         b.description ?? null, b.avg_salary_inr ?? null, b.demand_score ?? 50,
         b.automation_risk ?? 0, b.growth_30mo ?? 0],
      );
      res.json({ ok: true, id: r.rows[0]?.id });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.patch('/api/admin/career-graph/roles/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = safeInt(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid id' });
      const b = req.body as Record<string, unknown>;
      await pool.query(
        `UPDATE cg_roles SET
           title          = COALESCE($1, title),
           demand_score   = COALESCE($2, demand_score),
           automation_risk= COALESCE($3, automation_risk),
           is_active      = COALESCE($4, is_active),
           updated_at     = NOW()
         WHERE id = $5`,
        [b.title ?? null, b.demand_score ?? null, b.automation_risk ?? null, b.is_active ?? null, id],
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.delete('/api/admin/career-graph/roles/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = safeInt(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid id' });
      await pool.query(`UPDATE cg_roles SET is_active=false, updated_at=NOW() WHERE id=$1`, [id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── Edges ─────────────────────────────────────────────────────────────────

  app.get('/api/admin/career-graph/edges', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { from_role_id, edge_type, limit = '200' } = req.query as Record<string, string>;
      const conds: string[] = [];
      const params: unknown[] = [];
      if (from_role_id) { conds.push(`e.from_role_id=$${params.length+1}`); params.push(parseInt(from_role_id)); }
      if (edge_type)    { conds.push(`e.edge_type=$${params.length+1}`);    params.push(edge_type); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const r = await pool.query(
        `SELECT e.id, e.from_role_id, e.to_role_id, e.edge_type,
                e.avg_months_transition, e.transition_probability::float,
                fr.title AS from_title, tr.title AS to_title
         FROM cg_role_edges e
         JOIN cg_roles fr ON fr.id = e.from_role_id
         JOIN cg_roles tr ON tr.id = e.to_role_id
         ${where} ORDER BY fr.title, e.edge_type
         LIMIT $${params.length+1}`,
        [...params, parseInt(limit)],
      );
      res.json({ ok: true, edges: r.rows, total: r.rows.length });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.post('/api/admin/career-graph/edges', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      if (!b.from_role_id || !b.to_role_id) return res.status(400).json({ ok: false, error: 'from_role_id and to_role_id required' });
      const r = await pool.query(
        `INSERT INTO cg_role_edges(from_role_id, to_role_id, edge_type, avg_months_transition, transition_probability)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(from_role_id, to_role_id) DO UPDATE SET
           edge_type=$3, avg_months_transition=$4, transition_probability=$5
         RETURNING id`,
        [b.from_role_id, b.to_role_id, b.edge_type ?? 'lateral',
         b.avg_months_transition ?? 12, b.transition_probability ?? 0.5],
      );
      res.json({ ok: true, id: r.rows[0]?.id });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.patch('/api/admin/career-graph/edges/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = safeInt(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid id' });
      const b = req.body as Record<string, unknown>;
      await pool.query(
        `UPDATE cg_role_edges SET
           transition_probability = COALESCE($1, transition_probability),
           avg_months_transition  = COALESCE($2, avg_months_transition)
         WHERE id=$3`,
        [b.transition_probability ?? null, b.avg_months_transition ?? null, id],
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.delete('/api/admin/career-graph/edges/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = safeInt(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid id' });
      await pool.query(`DELETE FROM cg_role_edges WHERE id=$1`, [id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── Tracks ────────────────────────────────────────────────────────────────

  app.get('/api/admin/career-graph/tracks', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const tracks = await listTracks(pool);
      res.json({ ok: true, tracks, total: tracks.length });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.post('/api/admin/career-graph/tracks', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      if (!b.track_key || !b.name) return res.status(400).json({ ok: false, error: 'track_key and name required' });
      const r = await pool.query(
        `INSERT INTO cg_tracks(track_key, name, description, function_area)
         VALUES($1,$2,$3,$4)
         ON CONFLICT(track_key) DO UPDATE SET name=$2, description=$3, function_area=$4
         RETURNING id`,
        [b.track_key, b.name, b.description ?? null, b.function_area ?? b.domain ?? null],
      );
      res.json({ ok: true, id: r.rows[0]?.id });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.patch('/api/admin/career-graph/tracks/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = safeInt(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid id' });
      const b = req.body as Record<string, unknown>;
      await pool.query(
        `UPDATE cg_tracks SET
           name=COALESCE($1,name), description=COALESCE($2,description),
           function_area=COALESCE($3,function_area), estimated_years=COALESCE($4,estimated_years)
         WHERE id=$5`,
        [b.name ?? null, b.description ?? null, b.function_area ?? null, b.estimated_years ?? null, id],
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.delete('/api/admin/career-graph/tracks/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = safeInt(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid id' });
      await pool.query(`DELETE FROM cg_tracks WHERE id=$1`, [id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── Track waypoints ───────────────────────────────────────────────────────

  app.get('/api/admin/career-graph/track-waypoints', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { track_id } = req.query as Record<string, string>;
      const where = track_id ? 'WHERE w.track_id=$1' : '';
      const params = track_id ? [parseInt(track_id)] : [];
      const r = await pool.query(
        `SELECT w.*, r.title AS role_title FROM cg_track_waypoints w
         JOIN cg_roles r ON r.id = w.role_id
         ${where} ORDER BY w.track_id, w.step_order`,
        params,
      );
      res.json({ ok: true, waypoints: r.rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.post('/api/admin/career-graph/track-waypoints', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      if (!b.track_id || !b.role_id || b.step_order == null) {
        return res.status(400).json({ ok: false, error: 'track_id, role_id, step_order required' });
      }
      const r = await pool.query(
        `INSERT INTO cg_track_waypoints(track_id, role_id, step_order, is_optional)
         VALUES($1,$2,$3,$4)
         ON CONFLICT(track_id, role_id) DO UPDATE SET step_order=$3, is_optional=$4
         RETURNING id`,
        [b.track_id, b.role_id, b.step_order, b.is_optional ?? false],
      );
      res.json({ ok: true, id: r.rows[0]?.id });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.patch('/api/admin/career-graph/track-waypoints/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = safeInt(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid id' });
      const b = req.body as Record<string, unknown>;
      await pool.query(
        `UPDATE cg_track_waypoints SET step_order=COALESCE($1,step_order), is_optional=COALESCE($2,is_optional) WHERE id=$3`,
        [b.step_order ?? null, b.is_optional ?? null, id],
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── Skill requirements ────────────────────────────────────────────────────

  app.get('/api/admin/career-graph/skill-requirements', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { role_id } = req.query as Record<string, string>;
      const where = role_id ? 'WHERE role_id=$1' : '';
      const params = role_id ? [parseInt(role_id)] : [];
      const r = await pool.query(`SELECT * FROM cg_skill_requirements ${where} ORDER BY importance, min_proficiency DESC LIMIT 500`, params);
      res.json({ ok: true, requirements: r.rows, total: r.rows.length });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.post('/api/admin/career-graph/skill-requirements', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      if (!b.role_id || !b.skill_key || b.required_level == null) {
        return res.status(400).json({ ok: false, error: 'role_id, skill_key, required_level required' });
      }
      const r = await pool.query(
        `INSERT INTO cg_skill_requirements(role_id, skill_key, skill_label, category, importance, min_proficiency)
         VALUES($1,$2,$3,$4,$5,$6)
         ON CONFLICT(role_id, skill_key) DO UPDATE SET
           skill_label=$3, category=$4, importance=$5, min_proficiency=$6
         RETURNING id`,
        [b.role_id, b.skill_key, b.skill_label ?? b.skill_key,
         b.category ?? 'technical', b.importance ?? 'preferred', b.required_level ?? b.min_proficiency ?? 2],
      );
      res.json({ ok: true, id: r.rows[0]?.id });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.patch('/api/admin/career-graph/skill-requirements/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = safeInt(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid id' });
      const b = req.body as Record<string, unknown>;
      await pool.query(
        `UPDATE cg_skill_requirements SET
           importance=COALESCE($1,importance),
           min_proficiency=COALESCE($2,min_proficiency)
         WHERE id=$3`,
        [b.importance ?? null, b.min_proficiency ?? b.required_level ?? null, id],
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── Learning resources ────────────────────────────────────────────────────

  app.get('/api/admin/career-graph/learning-resources', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { resource_type, provider, region, limit = '100' } = req.query as Record<string, string>;
      const conds: string[] = ['lr.is_active'];
      const params: unknown[] = [];
      if (resource_type) { conds.push(`lr.resource_type=$${params.length+1}`); params.push(resource_type); }
      if (provider)      { conds.push(`lr.provider=$${params.length+1}`);      params.push(provider); }
      if (region)        { conds.push(`lr.region=$${params.length+1}`);         params.push(region); }
      const r = await pool.query(
        `SELECT * FROM cg_learning_resources lr WHERE ${conds.join(' AND ')}
         ORDER BY title LIMIT $${params.length+1}`,
        [...params, parseInt(limit)],
      );
      res.json({ ok: true, resources: r.rows, total: r.rows.length });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.post('/api/admin/career-graph/learning-resources', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      if (!b.title || !b.resource_type) return res.status(400).json({ ok: false, error: 'title and resource_type required' });
      const rkey = b.resource_key ?? `res_${Date.now()}`;
      const r = await pool.query(
        `INSERT INTO cg_learning_resources(resource_key, title, resource_type, provider, url, duration_hours, cost_band, difficulty, language, region)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [rkey, b.title, b.resource_type, b.provider ?? null, b.url ?? null,
         b.duration_hours ?? null, b.cost_band ?? 'free', b.difficulty ?? 'beginner',
         b.language ?? 'en', b.region ?? 'IN'],
      );
      res.json({ ok: true, id: r.rows[0]?.id });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.patch('/api/admin/career-graph/learning-resources/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = safeInt(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid id' });
      const b = req.body as Record<string, unknown>;
      await pool.query(
        `UPDATE cg_learning_resources SET
           title=COALESCE($1,title), url=COALESCE($2,url),
           is_active=COALESCE($3,is_active)
         WHERE id=$4`,
        [b.title ?? null, b.url ?? null, b.is_active ?? null, id],
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.delete('/api/admin/career-graph/learning-resources/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = safeInt(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid id' });
      await pool.query(`UPDATE cg_learning_resources SET is_active=false WHERE id=$1`, [id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── Readiness weights ─────────────────────────────────────────────────────

  app.get('/api/admin/career-graph/readiness-weights', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const w = await loadReadinessWeights(pool);
      res.json({ ok: true, weights: w });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.patch('/api/admin/career-graph/readiness-weights', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      await pool.query(
        `UPDATE cg_readiness_weights SET
           skill_weight      = COALESCE($1, skill_weight),
           experience_weight = COALESCE($2, experience_weight),
           behaviour_weight  = COALESCE($3, behaviour_weight),
           credential_weight = COALESCE($4, credential_weight),
           market_weight     = COALESCE($5, market_weight),
           version           = version + 1,
           updated_at        = NOW()
         WHERE true`,
        [b.skill_weight ?? null, b.experience_weight ?? null, b.behaviour_weight ?? null,
         b.credential_weight ?? null, b.market_weight ?? null],
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });
}
