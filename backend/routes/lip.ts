/**
 * LIP — Learning Intelligence Platform Routes
 * User routes: /api/lip/*
 * Admin routes: /api/admin/lip/*
 *
 * Additive + flag-gated: FF_LEARNING_INTELLIGENCE=1 to enable.
 * Flag-off → 503 on every route (user + admin).
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { ensureLIPSchema } from '../services/lip-competency-gap-engine';
import { computeCompetencyGaps } from '../services/lip-competency-gap-engine';
import { analyzeLearningNeeds } from '../services/lip-learning-need-engine';
import { mapCourses, mapCertifications, mapProjects, mapMentors, invalidateCatalogCache } from '../services/lip-resource-mapping-engine';
import { buildLearningPath } from '../services/lip-path-builder-engine';
import { computeReadiness } from '../services/lip-readiness-engine';

// ── Feature flag gate ──────────────────────────────────────────────────────────
const FLAG = 'FF_LEARNING_INTELLIGENCE';
const flagOn = () => process.env[FLAG] === '1';

function flagGate(_req: Request, res: Response, next: () => void) {
  if (!flagOn()) {
    return res.status(503).json({ ok: false, error: 'Feature not enabled', flag: FLAG });
  }
  next();
}

// 60-second admin cache
const adminCache: Map<string, { data: unknown; ts: number }> = new Map();
const ADMIN_CACHE_MS = 60_000;

function getCached<T>(key: string): T | null {
  const entry = adminCache.get(key);
  if (entry && Date.now() - entry.ts < ADMIN_CACHE_MS) return entry.data as T;
  return null;
}
function setCache(key: string, data: unknown): void {
  adminCache.set(key, { data, ts: Date.now() });
}
function bustCache(prefix: string): void {
  for (const key of adminCache.keys()) {
    if (key.startsWith(prefix)) adminCache.delete(key);
  }
}

// ── Stale check (24h) ─────────────────────────────────────────────────────────
async function isGapStale(userId: string, pool: Pool): Promise<boolean> {
  try {
    const r = await pool.query<{ computed_at: string }>(
      `SELECT computed_at FROM lip_competency_gaps WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 1`,
      [userId],
    );
    if (!r.rows.length) return true;
    const ageH = (Date.now() - new Date(r.rows[0].computed_at).getTime()) / 3600000;
    return ageH > 24;
  } catch { return true; }
}

export function registerLIPRoutes(
  app: Express,
  pool: Pool,
  requireAuth: (req: any, res: any, next: any) => void,
  requireSuperAdmin: (req: any, res: any, next: any) => void,
): void {

  // Gate every /api/lip/* and /api/admin/lip/* route — single check, no per-route repetition
  app.use('/api/lip', flagGate);
  app.use('/api/admin/lip', flagGate);

  // Ensure schema on startup (lazy, idempotent) — only runs when flag is on
  if (flagOn()) {
    ensureLIPSchema(pool).catch(() => { /* non-fatal */ });
  }

  // ── User Routes ─────────────────────────────────────────────────────────────

  // GET /api/lip/competency-gaps
  app.get('/api/lip/competency-gaps', requireAuth, async (req: any, res: any) => {
    try {
      const userId: string = String(req.user.id);
      const refresh = req.query.refresh === '1';
      const stale = refresh || await isGapStale(userId, pool);

      let gaps;
      if (stale) {
        gaps = await computeCompetencyGaps(userId, req.query.targetRoleId as string || null, pool);
      } else {
        const rows = await pool.query(
          `SELECT * FROM lip_competency_gaps WHERE user_id=$1 ORDER BY learning_priority,gap_magnitude DESC`,
          [userId],
        );
        // Derive overall_coverage_pct from stored row count vs total rules
        let totalRules = rows.rows.length;
        try {
          const ruleCount = await pool.query<{ count: string }>('SELECT COUNT(*)::int AS count FROM lip_competency_gap_rules');
          totalRules = Number(ruleCount.rows[0]?.count ?? rows.rows.length);
        } catch { /* ignore */ }
        const gapCount = rows.rows.length;
        const coveredCount = Math.max(0, totalRules - gapCount);
        const overallCoverage = totalRules > 0 ? Math.round((coveredCount / totalRules) * 100) : 0;
        gaps = {
          gaps: rows.rows,
          overall_coverage_pct: overallCoverage,
          critical_count: rows.rows.filter((r: any) => r.gap_severity === 'critical').length,
          major_count: rows.rows.filter((r: any) => r.gap_severity === 'major').length,
          confidence: 0.7,
          computed_at: rows.rows[0]?.computed_at ?? new Date().toISOString(),
        };
      }
      res.json({ success: true, data: gaps });
    } catch (err) {
      res.json({ success: false, data: { gaps: [], critical_count: 0, major_count: 0, overall_coverage_pct: 0, confidence: 0.3 } });
    }
  });

  // GET /api/lip/competency-gaps/:code — literal must be before catch-all (none here, but good practice)
  app.get('/api/lip/competency-gaps/:code', requireAuth, async (req: any, res: any) => {
    try {
      const userId: string = String(req.user.id);
      const { code } = req.params;
      const r = await pool.query(
        `SELECT g.*, array_agg(DISTINCT c.title) FILTER (WHERE c.id IS NOT NULL) AS suggested_courses
         FROM lip_competency_gaps g
         LEFT JOIN lip_course_competency_map m ON m.competency_code = g.competency_code
         LEFT JOIN lip_courses c ON c.id = m.course_id AND c.is_active = true
         WHERE g.user_id=$1 AND g.competency_code=$2
         GROUP BY g.id`,
        [userId, code],
      );
      if (!r.rows.length) return res.status(404).json({ success: false, error: 'Gap not found' });
      res.json({ success: true, data: r.rows[0] });
    } catch {
      res.status(404).json({ success: false, error: 'Not found' });
    }
  });

  // GET /api/lip/learning-needs
  app.get('/api/lip/learning-needs', requireAuth, async (req: any, res: any) => {
    try {
      const userId: string = String(req.user.id);
      const refresh = req.query.refresh === '1';
      let result;
      if (refresh) {
        result = await analyzeLearningNeeds(userId, pool);
      } else {
        const rows = await pool.query(
          `SELECT * FROM lip_learning_needs WHERE user_id=$1 ORDER BY priority_score DESC`,
          [userId],
        );
        if (rows.rows.length === 0) {
          result = await analyzeLearningNeeds(userId, pool);
        } else {
          result = {
            needs: rows.rows,
            immediate_count: rows.rows.filter((r: any) => r.urgency === 'immediate').length,
            categories_triggered: rows.rows.map((r: any) => r.need_category),
            computed_at: rows.rows[0]?.computed_at,
          };
        }
      }
      res.json({ success: true, data: result });
    } catch {
      res.json({ success: false, data: { needs: [], immediate_count: 0, categories_triggered: [] } });
    }
  });

  // GET /api/lip/courses
  app.get('/api/lip/courses', requireAuth, async (req: any, res: any) => {
    try {
      const userId: string = String(req.user.id);
      const opts = {
        region: req.query.region as 'IN' | 'GLOBAL' | undefined,
        type: req.query.type as string | undefined,
        maxCostInr: req.query.maxCost ? Number(req.query.maxCost) : undefined,
      };
      const gaps = await computeCompetencyGaps(userId, null, pool);
      const courses = await mapCourses(userId, gaps.gaps, opts, pool);
      res.json({ success: true, data: courses });
    } catch {
      res.json({ success: false, data: [] });
    }
  });

  // GET /api/lip/certifications
  app.get('/api/lip/certifications', requireAuth, async (req: any, res: any) => {
    try {
      const userId: string = String(req.user.id);
      const opts = {
        type: req.query.type as string | undefined,
        maxCostInr: req.query.maxCost ? Number(req.query.maxCost) : undefined,
        industry: req.query.industry as string | undefined,
      };
      const gaps = await computeCompetencyGaps(userId, null, pool);
      const certs = await mapCertifications(userId, gaps.gaps, opts, pool);
      res.json({ success: true, data: certs });
    } catch {
      res.json({ success: false, data: [] });
    }
  });

  // GET /api/lip/projects
  app.get('/api/lip/projects', requireAuth, async (req: any, res: any) => {
    try {
      const userId: string = String(req.user.id);
      const opts = {
        type: req.query.type as string | undefined,
        difficulty: req.query.difficulty ? Number(req.query.difficulty) : undefined,
      };
      const gaps = await computeCompetencyGaps(userId, null, pool);
      const projects = await mapProjects(userId, gaps.gaps, opts, pool);
      res.json({ success: true, data: projects });
    } catch {
      res.json({ success: false, data: [] });
    }
  });

  // GET /api/lip/mentors
  app.get('/api/lip/mentors', requireAuth, async (req: any, res: any) => {
    try {
      const userId: string = String(req.user.id);
      const needs = await analyzeLearningNeeds(userId, pool);
      const mentorOpts = {
        style: req.query.style as string | undefined,
        function: req.query.function as string | undefined,
        availability: req.query.availability ? Number(req.query.availability) : undefined,
      };
      const mentors = await mapMentors(userId, needs.needs, mentorOpts, pool);
      res.json({ success: true, data: mentors });
    } catch {
      res.json({ success: false, data: [] });
    }
  });

  // GET /api/lip/path
  app.get('/api/lip/path', requireAuth, async (req: any, res: any) => {
    try {
      const userId: string = String(req.user.id);
      const gaps = await computeCompetencyGaps(userId, null, pool);
      const needs = await analyzeLearningNeeds(userId, pool);
      const courses = await mapCourses(userId, gaps.gaps, {}, pool);
      const certs = await mapCertifications(userId, gaps.gaps, {}, pool);
      const projects = await mapProjects(userId, gaps.gaps, {}, pool);
      const mentors = await mapMentors(userId, needs.needs, {}, pool);
      const result = await buildLearningPath(userId, courses, certs, projects, mentors, gaps.gaps, {}, pool);
      res.json({ success: true, data: result });
    } catch {
      res.json({ success: false, data: null });
    }
  });

  // POST /api/lip/path
  app.post('/api/lip/path', requireAuth, async (req: any, res: any) => {
    try {
      const userId: string = String(req.user.id);
      const { targetRoleId, maxHours } = req.body;
      const gaps = await computeCompetencyGaps(userId, targetRoleId || null, pool);
      const needs = await analyzeLearningNeeds(userId, pool);
      const courses = await mapCourses(userId, gaps.gaps, {}, pool);
      const certs = await mapCertifications(userId, gaps.gaps, {}, pool);
      const projects = await mapProjects(userId, gaps.gaps, {}, pool);
      const mentors = await mapMentors(userId, needs.needs, {}, pool);
      const result = await buildLearningPath(userId, courses, certs, projects, mentors, gaps.gaps, { targetRoleId, maxHours: maxHours ? Number(maxHours) : undefined, forceRebuild: true }, pool);
      res.json({ success: true, data: result });
    } catch {
      res.json({ success: false, data: null });
    }
  });

  // POST /api/lip/path/items/:itemId/status — literal before /:id catch-all
  app.post('/api/lip/path/items/:itemId/status', requireAuth, async (req: any, res: any) => {
    try {
      const userId: string = String(req.user.id);
      const { itemId } = req.params;
      const { status } = req.body;
      const VALID = ['pending', 'in_progress', 'completed', 'skipped'];
      if (!VALID.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });

      // Verify item belongs to user's path
      const check = await pool.query(
        `SELECT pi.id FROM lip_learning_path_items pi
         JOIN lip_learning_paths p ON p.id = pi.path_id
         WHERE pi.id=$1 AND p.user_id=$2`,
        [itemId, userId],
      );
      if (!check.rows.length) return res.status(403).json({ success: false, error: 'Forbidden' });

      await pool.query(
        `UPDATE lip_learning_path_items SET status=$1, completed_at=${status === 'completed' ? 'NOW()' : 'NULL'} WHERE id=$2`,
        [status, itemId],
      );

      // Recalculate path progress
      try {
        const pathRes = await pool.query<{ path_id: string }>(
          `SELECT path_id FROM lip_learning_path_items WHERE id=$1`,
          [itemId],
        );
        const pathId = pathRes.rows[0]?.path_id;
        if (pathId) {
          const statsRes = await pool.query<{ total: string; done: string; done_hours: string; total_hours: string }>(
            `SELECT COUNT(*) AS total,
                    SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS done,
                    SUM(CASE WHEN status='completed' THEN hours ELSE 0 END) AS done_hours,
                    SUM(hours) AS total_hours
             FROM lip_learning_path_items WHERE path_id=$1`,
            [pathId],
          );
          if (statsRes.rows.length > 0) {
            const { total, done, done_hours, total_hours } = statsRes.rows[0];
            const pct = Number(total) > 0 ? Math.round((Number(done) / Number(total)) * 100) : 0;
            await pool.query(
              `UPDATE lip_learning_paths SET progress_pct=$1, total_hours_completed=$2, updated_at=NOW(), status=${pct === 100 ? "'completed'" : "'active'"} WHERE id=$3`,
              [pct, Number(done_hours), pathId],
            );
          }
        }
      } catch { /* progress update is best-effort */ }

      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false, error: 'Update failed' });
    }
  });

  // POST /api/lip/courses/:courseId/save
  app.post('/api/lip/courses/:courseId/save', requireAuth, async (req: any, res: any) => {
    try {
      const userId: string = String(req.user.id);
      const { courseId } = req.params;
      const existing = await pool.query(
        `SELECT is_saved FROM lip_user_courses WHERE user_id=$1 AND course_id=$2`,
        [userId, courseId],
      );
      const isSaved = existing.rows.length > 0 ? !existing.rows[0].is_saved : true;
      await pool.query(
        `INSERT INTO lip_user_courses (user_id,course_id,relevance_score,is_saved,computed_at)
         VALUES ($1,$2,50,$3,NOW())
         ON CONFLICT (user_id,course_id) DO UPDATE SET is_saved=$3`,
        [userId, courseId, isSaved],
      );
      res.json({ success: true, saved: isSaved });
    } catch {
      res.status(500).json({ success: false });
    }
  });

  // POST /api/lip/certifications/:certId/save
  app.post('/api/lip/certifications/:certId/save', requireAuth, async (req: any, res: any) => {
    try {
      const userId: string = String(req.user.id);
      const { certId } = req.params;
      const existing = await pool.query(
        `SELECT is_saved FROM lip_user_certifications WHERE user_id=$1 AND cert_id=$2`,
        [userId, certId],
      );
      const isSaved = existing.rows.length > 0 ? !existing.rows[0].is_saved : true;
      await pool.query(
        `INSERT INTO lip_user_certifications (user_id,cert_id,relevance_score,is_saved,computed_at)
         VALUES ($1,$2,50,$3,NOW())
         ON CONFLICT (user_id,cert_id) DO UPDATE SET is_saved=$3`,
        [userId, certId, isSaved],
      );
      res.json({ success: true, saved: isSaved });
    } catch {
      res.status(500).json({ success: false });
    }
  });

  // GET /api/lip/readiness
  app.get('/api/lip/readiness', requireAuth, async (req: any, res: any) => {
    try {
      const userId: string = String(req.user.id);
      const refresh = req.query.refresh === '1';
      if (!refresh) {
        try {
          const existing = await pool.query(
            `SELECT * FROM lip_readiness_scores WHERE user_id=$1`,
            [userId],
          );
          if (existing.rows.length > 0) {
            const r = existing.rows[0];
            const ageH = (Date.now() - new Date(r.computed_at).getTime()) / 3600000;
            if (ageH < 24) {
              return res.json({ success: true, data: {
                composite: Number(r.composite_readiness),
                band: r.readiness_band,
                signals: {
                  motivation: Number(r.motivation_score),
                  cognitive_readiness: Number(r.cognitive_readiness_score),
                  time_availability: Number(r.time_availability_score),
                  support_network: Number(r.support_network_score),
                  prior_learning: Number(r.prior_learning_score),
                },
                blockers: r.blockers,
                confidence: Number(r.confidence),
                computed_at: r.computed_at,
              }});
            }
          }
        } catch { /* compute fresh */ }
      }
      const result = await computeReadiness(userId, pool);
      res.json({ success: true, data: result });
    } catch {
      res.json({ success: false, data: { composite: 50, band: 'moderate', signals: {}, blockers: [], confidence: 0.2 } });
    }
  });

  // GET /api/lip/report
  app.get('/api/lip/report', requireAuth, async (req: any, res: any) => {
    try {
      const userId: string = String(req.user.id);
      // Compute gaps first so mappers can personalise resource ranking to user's gaps
      const [gaps, needs, readiness] = await Promise.all([
        computeCompetencyGaps(userId, null, pool),
        analyzeLearningNeeds(userId, pool),
        computeReadiness(userId, pool),
      ]);
      // Pass user gaps to mappers for relevance-ranked, personalised resource highlights
      const [courses, certs, projects, mentors] = await Promise.all([
        mapCourses(userId, gaps.gaps, {}, pool),
        mapCertifications(userId, gaps.gaps, {}, pool),
        mapProjects(userId, gaps.gaps, {}, pool),
        mapMentors(userId, needs.needs, {}, pool),
      ]);

      // Load active path
      let pathData = null;
      try {
        const pr = await pool.query(
          `SELECT lp.*, json_agg(li ORDER BY li.phase_num,li.order_in_phase) AS items
           FROM lip_learning_paths lp
           LEFT JOIN lip_learning_path_items li ON li.path_id = lp.id
           WHERE lp.user_id=$1 AND lp.status='active'
           GROUP BY lp.id ORDER BY lp.updated_at DESC LIMIT 1`,
          [userId],
        );
        pathData = pr.rows[0] || null;
      } catch { /* no path yet */ }

      res.json({
        success: true,
        data: {
          readiness_summary: {
            composite: readiness.composite,
            band: readiness.band,
            signals: readiness.signals,
            blockers: readiness.blockers,
          },
          competency_gap_profile: {
            critical_gaps: gaps.critical_count,
            major_gaps: gaps.major_count,
            overall_coverage_pct: gaps.overall_coverage_pct,
            gaps: gaps.gaps.slice(0, 20),
          },
          learning_needs_analysis: {
            immediate_count: needs.immediate_count,
            categories_triggered: needs.categories_triggered,
            top_needs: needs.needs.slice(0, 5),
          },
          recommended_learning_path: pathData ? {
            id: pathData.id,
            name: pathData.name,
            status: pathData.status,
            total_hours: pathData.total_hours_estimated,
            estimated_weeks: Math.ceil(Number(pathData.total_hours_estimated) / 8),
            progress_pct: pathData.progress_pct,
            items: (pathData.items || []).filter(Boolean).slice(0, 20),
          } : null,
          resource_highlights: {
            top_courses: courses.slice(0, 3),
            top_certs: certs.slice(0, 2),
            top_projects: projects.slice(0, 2),
            top_mentors: mentors.slice(0, 2),
          },
          generated_at: new Date().toISOString(),
        },
      });
    } catch {
      res.json({ success: false, data: null });
    }
  });

  // ── Admin Routes ────────────────────────────────────────────────────────────

  // GET /api/admin/lip/stats — register literal BEFORE /:id
  app.get('/api/admin/lip/stats', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    const cacheKey = 'admin:lip:stats';
    if (req.query.refresh !== '1') {
      const cached = getCached(cacheKey);
      if (cached) return res.json({ success: true, data: cached });
    }
    try {
      const [users, avgReadiness, gapDist, bandDist, topCourses] = await Promise.all([
        pool.query<{ cnt: string }>(`SELECT COUNT(DISTINCT user_id) AS cnt FROM lip_learning_paths`),
        pool.query<{ avg: string }>(`SELECT ROUND(AVG(composite_readiness),1) AS avg FROM lip_readiness_scores`),
        pool.query<{ gap_severity: string; cnt: string }>(`SELECT gap_severity, COUNT(*) AS cnt FROM lip_competency_gaps GROUP BY gap_severity`),
        pool.query<{ readiness_band: string; cnt: string }>(`SELECT readiness_band, COUNT(*) AS cnt FROM lip_readiness_scores GROUP BY readiness_band`),
        pool.query<{ title: string; provider: string; cnt: string }>(
          `SELECT c.title, c.provider, COUNT(*) AS cnt
           FROM lip_user_courses uc JOIN lip_courses c ON c.id=uc.course_id
           WHERE uc.status != 'dismissed'
           GROUP BY c.id,c.title,c.provider ORDER BY cnt DESC LIMIT 10`,
        ),
      ]);

      // k-anonymity: suppress readiness bands with fewer than 10 users
      const bandRows = bandDist.rows.filter(r => Number(r.cnt) >= 10);

      const data = {
        users_with_paths: Number(users.rows[0]?.cnt ?? 0),
        avg_readiness_score: Number(avgReadiness.rows[0]?.avg ?? 0),
        gap_severity_distribution: gapDist.rows,
        readiness_band_distribution: bandRows,
        top_10_recommended_courses: topCourses.rows,
      };
      setCache(cacheKey, data);
      res.json({ success: true, data });
    } catch {
      res.json({ success: false, data: {} });
    }
  });

  // GET /api/admin/lip/readiness-weights — literal before /:id
  app.get('/api/admin/lip/readiness-weights', requireAuth, requireSuperAdmin, async (_req: any, res: any) => {
    try {
      const r = await pool.query(`SELECT * FROM lip_readiness_weights LIMIT 1`);
      res.json({ success: true, data: r.rows[0] || null });
    } catch {
      res.json({ success: false, data: null });
    }
  });

  // PATCH /api/admin/lip/readiness-weights
  app.patch('/api/admin/lip/readiness-weights', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { motivation_weight, cognitive_weight, time_weight, support_weight, prior_weight } = req.body;
      const total = (Number(motivation_weight) + Number(cognitive_weight) + Number(time_weight) + Number(support_weight) + Number(prior_weight));
      if (Math.abs(total - 1) > 0.01) return res.status(400).json({ success: false, error: 'Weights must sum to 1.0' });
      await pool.query(
        `UPDATE lip_readiness_weights SET motivation_weight=$1,cognitive_weight=$2,time_weight=$3,support_weight=$4,prior_weight=$5,updated_at=NOW() WHERE true`,
        [motivation_weight, cognitive_weight, time_weight, support_weight, prior_weight],
      );
      bustCache('admin:lip:');
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false });
    }
  });

  // ── Admin CRUD: Courses ────────────────────────────────────────────────────

  app.get('/api/admin/lip/courses', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    const cacheKey = `admin:lip:courses:${JSON.stringify(req.query)}`;
    if (req.query.refresh !== '1') {
      const cached = getCached(cacheKey);
      if (cached) return res.json({ success: true, data: cached });
    }
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Number(req.query.limit) || 50);
      const offset = (page - 1) * limit;
      const conditions: string[] = ['c.is_active = true'];
      const params: unknown[] = [];
      if (req.query.type) { params.push(req.query.type); conditions.push(`c.type=$${params.length}`); }
      if (req.query.region) { params.push(req.query.region); conditions.push(`c.region=$${params.length}`); }
      if (req.query.difficulty) { params.push(Number(req.query.difficulty)); conditions.push(`c.difficulty_level=$${params.length}`); }
      if (req.query.delivery_mode) { params.push(req.query.delivery_mode); conditions.push(`c.delivery_mode=$${params.length}`); }
      const where = conditions.join(' AND ');
      const [rows, count] = await Promise.all([
        pool.query(`SELECT * FROM lip_courses c WHERE ${where} ORDER BY quality_score DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, limit, offset]),
        pool.query(`SELECT COUNT(*) AS cnt FROM lip_courses c WHERE ${where}`, params),
      ]);
      const data = { rows: rows.rows, total: Number(count.rows[0].cnt), page, limit };
      setCache(cacheKey, data);
      res.json({ success: true, data });
    } catch {
      res.json({ success: false, data: { rows: [], total: 0 } });
    }
  });

  app.post('/api/admin/lip/courses', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { title, provider, type, delivery_mode, duration_hours, difficulty_level, cost_usd, cost_inr, quality_score, rating, skills_covered, competency_codes, region, url } = req.body;
      const r = await pool.query(
        `INSERT INTO lip_courses (title,provider,type,delivery_mode,duration_hours,difficulty_level,cost_usd,cost_inr,quality_score,rating,skills_covered,competency_codes,region,url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [title, provider, type || 'online_course', delivery_mode || 'self_paced', duration_hours || 10, difficulty_level || 2, cost_usd || 0, cost_inr || 0, quality_score || 70, rating || 4.0, JSON.stringify(skills_covered || []), JSON.stringify(competency_codes || []), region || 'GLOBAL', url || null],
      );
      bustCache('admin:lip:courses');
      invalidateCatalogCache();
      res.json({ success: true, id: r.rows[0].id });
    } catch {
      res.status(500).json({ success: false });
    }
  });

  app.patch('/api/admin/lip/courses/:id', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const fields = req.body;
      const sets: string[] = [];
      const params: unknown[] = [];
      const allowed = ['title','provider','type','delivery_mode','duration_hours','difficulty_level','cost_usd','cost_inr','quality_score','rating','skills_covered','competency_codes','region','url'];
      for (const key of allowed) {
        if (key in fields) {
          params.push(key.includes('codes') || key.includes('covered') ? JSON.stringify(fields[key]) : fields[key]);
          sets.push(`${key}=$${params.length}`);
        }
      }
      if (!sets.length) return res.status(400).json({ success: false, error: 'No fields to update' });
      params.push(id);
      await pool.query(`UPDATE lip_courses SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length}`, params);
      bustCache('admin:lip:courses');
      invalidateCatalogCache();
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false });
    }
  });

  app.delete('/api/admin/lip/courses/:id', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    try {
      await pool.query(`UPDATE lip_courses SET is_active=false,updated_at=NOW() WHERE id=$1`, [req.params.id]);
      bustCache('admin:lip:courses');
      invalidateCatalogCache();
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false });
    }
  });

  // ── Admin CRUD: Certifications ─────────────────────────────────────────────

  app.get('/api/admin/lip/certifications', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    const cacheKey = `admin:lip:certs:${JSON.stringify(req.query)}`;
    if (req.query.refresh !== '1') {
      const cached = getCached(cacheKey);
      if (cached) return res.json({ success: true, data: cached });
    }
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Number(req.query.limit) || 50);
      const offset = (page - 1) * limit;
      const conditions: string[] = ['is_active = true'];
      const params: unknown[] = [];
      if (req.query.type) { params.push(req.query.type); conditions.push(`type=$${params.length}`); }
      if (req.query.issuing_body) { params.push(req.query.issuing_body); conditions.push(`issuing_body=$${params.length}`); }
      const where = conditions.join(' AND ');
      const [rows, count] = await Promise.all([
        pool.query(`SELECT * FROM lip_certifications WHERE ${where} ORDER BY prestige_score DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, limit, offset]),
        pool.query(`SELECT COUNT(*) AS cnt FROM lip_certifications WHERE ${where}`, params),
      ]);
      const data = { rows: rows.rows, total: Number(count.rows[0].cnt), page, limit };
      setCache(cacheKey, data);
      res.json({ success: true, data });
    } catch {
      res.json({ success: false, data: { rows: [], total: 0 } });
    }
  });

  app.post('/api/admin/lip/certifications', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { title, issuing_body, type, validity_years, prep_hours_estimate, cost_usd, cost_inr, difficulty_level, prestige_score, skills_validated, competency_codes, industry_codes } = req.body;
      const r = await pool.query(
        `INSERT INTO lip_certifications (title,issuing_body,type,validity_years,prep_hours_estimate,cost_usd,cost_inr,difficulty_level,prestige_score,skills_validated,competency_codes,industry_codes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [title, issuing_body, type || 'professional', validity_years || null, prep_hours_estimate || 60, cost_usd || 0, cost_inr || 0, difficulty_level || 2, prestige_score || 60, JSON.stringify(skills_validated || []), JSON.stringify(competency_codes || []), JSON.stringify(industry_codes || [])],
      );
      bustCache('admin:lip:certs');
      invalidateCatalogCache();
      res.json({ success: true, id: r.rows[0].id });
    } catch {
      res.status(500).json({ success: false });
    }
  });

  app.patch('/api/admin/lip/certifications/:id', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const fields = req.body;
      const sets: string[] = [];
      const params: unknown[] = [];
      const allowed = ['title','issuing_body','type','validity_years','prep_hours_estimate','cost_usd','cost_inr','difficulty_level','prestige_score','skills_validated','competency_codes','industry_codes'];
      for (const key of allowed) {
        if (key in fields) {
          params.push(['skills_validated','competency_codes','industry_codes'].includes(key) ? JSON.stringify(fields[key]) : fields[key]);
          sets.push(`${key}=$${params.length}`);
        }
      }
      if (!sets.length) return res.status(400).json({ success: false, error: 'No fields to update' });
      params.push(id);
      await pool.query(`UPDATE lip_certifications SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length}`, params);
      bustCache('admin:lip:certs');
      invalidateCatalogCache();
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false });
    }
  });

  app.delete('/api/admin/lip/certifications/:id', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    try {
      await pool.query(`UPDATE lip_certifications SET is_active=false,updated_at=NOW() WHERE id=$1`, [req.params.id]);
      bustCache('admin:lip:certs');
      invalidateCatalogCache();
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false });
    }
  });

  // ── Admin CRUD: Projects ───────────────────────────────────────────────────

  app.get('/api/admin/lip/projects', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    const cacheKey = `admin:lip:projects:${JSON.stringify(req.query)}`;
    if (req.query.refresh !== '1') {
      const cached = getCached(cacheKey);
      if (cached) return res.json({ success: true, data: cached });
    }
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Number(req.query.limit) || 50);
      const offset = (page - 1) * limit;
      const conditions: string[] = ['is_active = true'];
      const params: unknown[] = [];
      if (req.query.type) { params.push(req.query.type); conditions.push(`type=$${params.length}`); }
      if (req.query.solo_or_team) { params.push(req.query.solo_or_team); conditions.push(`solo_or_team=$${params.length}`); }
      if (req.query.difficulty) { params.push(Number(req.query.difficulty)); conditions.push(`difficulty_level=$${params.length}`); }
      const where = conditions.join(' AND ');
      const [rows, count] = await Promise.all([
        pool.query(`SELECT * FROM lip_projects WHERE ${where} ORDER BY difficulty_level LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, limit, offset]),
        pool.query(`SELECT COUNT(*) AS cnt FROM lip_projects WHERE ${where}`, params),
      ]);
      const data = { rows: rows.rows, total: Number(count.rows[0].cnt), page, limit };
      setCache(cacheKey, data);
      res.json({ success: true, data });
    } catch {
      res.json({ success: false, data: { rows: [], total: 0 } });
    }
  });

  app.post('/api/admin/lip/projects', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { title, type, duration_hours, difficulty_level, skills_practiced, competency_codes, deliverable, solo_or_team, description } = req.body;
      const r = await pool.query(
        `INSERT INTO lip_projects (title,type,duration_hours,difficulty_level,skills_practiced,competency_codes,deliverable,solo_or_team,description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [title, type || 'portfolio', duration_hours || 20, difficulty_level || 2, JSON.stringify(skills_practiced || []), JSON.stringify(competency_codes || []), deliverable || 'document', solo_or_team || 'either', description || null],
      );
      bustCache('admin:lip:projects');
      invalidateCatalogCache();
      res.json({ success: true, id: r.rows[0].id });
    } catch {
      res.status(500).json({ success: false });
    }
  });

  app.patch('/api/admin/lip/projects/:id', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const fields = req.body;
      const sets: string[] = [];
      const params: unknown[] = [];
      const allowed = ['title','type','duration_hours','difficulty_level','skills_practiced','competency_codes','deliverable','solo_or_team','description'];
      for (const key of allowed) {
        if (key in fields) {
          params.push(['skills_practiced','competency_codes'].includes(key) ? JSON.stringify(fields[key]) : fields[key]);
          sets.push(`${key}=$${params.length}`);
        }
      }
      if (!sets.length) return res.status(400).json({ success: false, error: 'No fields to update' });
      params.push(id);
      await pool.query(`UPDATE lip_projects SET ${sets.join(',')} WHERE id=$${params.length}`, params);
      bustCache('admin:lip:projects');
      invalidateCatalogCache();
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false });
    }
  });

  app.delete('/api/admin/lip/projects/:id', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    try {
      await pool.query(`UPDATE lip_projects SET is_active=false WHERE id=$1`, [req.params.id]);
      bustCache('admin:lip:projects');
      invalidateCatalogCache();
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false });
    }
  });

  // ── Admin CRUD: Mentors ────────────────────────────────────────────────────

  app.get('/api/admin/lip/mentors', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    const cacheKey = `admin:lip:mentors:${JSON.stringify(req.query)}`;
    if (req.query.refresh !== '1') {
      const cached = getCached(cacheKey);
      if (cached) return res.json({ success: true, data: cached });
    }
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Number(req.query.limit) || 50);
      const offset = (page - 1) * limit;
      const conditions: string[] = ['is_active = true'];
      const params: unknown[] = [];
      if (req.query.style) { params.push(req.query.style); conditions.push(`mentoring_style=$${params.length}`); }
      if (req.query.cost_model) { params.push(req.query.cost_model); conditions.push(`cost_model=$${params.length}`); }
      if (req.query.function) { params.push(JSON.stringify([req.query.function])); conditions.push(`function_codes @> $${params.length}::jsonb`); }
      if (req.query.availability) { params.push(Number(req.query.availability)); conditions.push(`availability_hrs_month >= $${params.length}`); }
      const where = conditions.join(' AND ');
      const [rows, count] = await Promise.all([
        pool.query(`SELECT * FROM lip_mentors WHERE ${where} ORDER BY rating DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, limit, offset]),
        pool.query(`SELECT COUNT(*) AS cnt FROM lip_mentors WHERE ${where}`, params),
      ]);
      const data = { rows: rows.rows, total: Number(count.rows[0].cnt), page, limit };
      setCache(cacheKey, data);
      res.json({ success: true, data });
    } catch {
      res.json({ success: false, data: { rows: [], total: 0 } });
    }
  });

  app.post('/api/admin/lip/mentors', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { name, title, company, function_codes, competency_expertise, seniority_level, mentoring_style, availability_hrs_month, cost_model, cost_per_hour_inr, rating } = req.body;
      const r = await pool.query(
        `INSERT INTO lip_mentors (name,title,company,function_codes,competency_expertise,seniority_level,mentoring_style,availability_hrs_month,cost_model,cost_per_hour_inr,rating)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [name, title, company || null, JSON.stringify(function_codes || []), JSON.stringify(competency_expertise || []), seniority_level || 3, mentoring_style || 'coaching', availability_hrs_month || 4, cost_model || 'free', cost_per_hour_inr || 0, rating || 4.5],
      );
      bustCache('admin:lip:mentors');
      invalidateCatalogCache();
      res.json({ success: true, id: r.rows[0].id });
    } catch {
      res.status(500).json({ success: false });
    }
  });

  app.patch('/api/admin/lip/mentors/:id', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const fields = req.body;
      const sets: string[] = [];
      const params: unknown[] = [];
      const allowed = ['name','title','company','function_codes','competency_expertise','seniority_level','mentoring_style','availability_hrs_month','cost_model','cost_per_hour_inr','rating','is_verified'];
      for (const key of allowed) {
        if (key in fields) {
          params.push(['function_codes','competency_expertise'].includes(key) ? JSON.stringify(fields[key]) : fields[key]);
          sets.push(`${key}=$${params.length}`);
        }
      }
      if (!sets.length) return res.status(400).json({ success: false, error: 'No fields to update' });
      params.push(id);
      await pool.query(`UPDATE lip_mentors SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length}`, params);
      bustCache('admin:lip:mentors');
      invalidateCatalogCache();
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false });
    }
  });

  // ── Admin: Path Templates ──────────────────────────────────────────────────

  app.get('/api/admin/lip/path-templates', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    const cacheKey = 'admin:lip:path-templates';
    if (req.query.refresh !== '1') {
      const cached = getCached(cacheKey);
      if (cached) return res.json({ success: true, data: cached });
    }
    try {
      const r = await pool.query(`SELECT * FROM lip_path_templates WHERE is_active=true ORDER BY code`);
      setCache(cacheKey, r.rows);
      res.json({ success: true, data: r.rows });
    } catch {
      res.json({ success: false, data: [] });
    }
  });

  app.post('/api/admin/lip/path-templates', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { code, name, target_role_id, estimated_total_hours, estimated_weeks, phase_count, phases } = req.body;
      const r = await pool.query(
        `INSERT INTO lip_path_templates (code,name,target_role_id,estimated_total_hours,estimated_weeks,phase_count,phases)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [code, name, target_role_id || null, estimated_total_hours || 120, estimated_weeks || 15, phase_count || 4, JSON.stringify(phases || [])],
      );
      bustCache('admin:lip:path-templates');
      res.json({ success: true, id: r.rows[0].id });
    } catch {
      res.status(500).json({ success: false });
    }
  });

  app.patch('/api/admin/lip/path-templates/:id', requireAuth, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { name, estimated_total_hours, estimated_weeks, phase_count, phases } = req.body;
      await pool.query(
        `UPDATE lip_path_templates SET name=$1,estimated_total_hours=$2,estimated_weeks=$3,phase_count=$4,phases=$5 WHERE id=$6`,
        [name, estimated_total_hours, estimated_weeks, phase_count, JSON.stringify(phases || []), id],
      );
      bustCache('admin:lip:path-templates');
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false });
    }
  });
}
