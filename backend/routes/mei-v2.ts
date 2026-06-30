/**
 * MEI v2 Routes
 * ──────────────
 * User-facing:
 *   GET  /api/mei/score/:userId       — compute (or return cached) MEI score
 *   GET  /api/mei/breakdown/:userId   — full hierarchical breakdown
 *   GET  /api/mei/benchmark/:userId   — cohort percentile
 *   GET  /api/mei/narrative/:userId   — generated narrative
 *   GET  /api/mei/recommendations/:userId
 *   POST /api/mei/recommendations/:userId/:recId/action
 *
 * Admin:
 *   GET  /api/admin/mei/dimensions
 *   GET  /api/admin/mei/subdimensions
 *   GET  /api/admin/mei/competencies
 *   GET  /api/admin/mei/calibration/industry
 *   GET  /api/admin/mei/calibration/role
 *   GET    /api/admin/mei/insight-rules
 *   POST   /api/admin/mei/insight-rules
 *   PATCH  /api/admin/mei/insight-rules/:id
 *   DELETE /api/admin/mei/insight-rules/:id   (soft — sets is_active=false)
 *   GET    /api/admin/mei/recommendations
 *   POST   /api/admin/mei/recommendations
 *   PATCH  /api/admin/mei/recommendations/:id
 *   DELETE /api/admin/mei/recommendations/:id (soft — sets is_active=false)
 *   POST   /api/admin/mei/benchmark/refresh
 *   GET    /api/admin/mei/scores        — platform overview
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { computeMEIScore, ensureMEISchema, mapProfileToMEIInput, invalidateTaxonomyCache } from '../services/mei-scoring-engine';
import { computeBenchmark, refreshCohortBenchmark, deriveYoeBand } from '../services/mei-benchmark-engine';
import { generateNarrative, persistNarrative } from '../services/mei-narrative-engine';
import { computeRecommendations, markRecommendationActioned } from '../services/mei-recommendation-engine';

type Auth = (req: Request, res: Response, next: () => void) => void;

let schemaReady = false;

async function ensureSchema(pool: Pool) {
  if (!schemaReady) {
    await ensureMEISchema(pool).catch(() => {});
    schemaReady = true;
  }
}

/** Resolve career profile for a user ID */
async function resolveProfile(pool: Pool, userId: string): Promise<Record<string, unknown> | null> {
  const res = await pool.query(
    `SELECT data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  if (res.rows.length === 0) return null;
  const data = res.rows[0].data as Record<string, unknown> ?? {};

  // Also pull assessment score from competency_assessments if exists
  const asmt = await pool.query(
    `SELECT score FROM competency_assessments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  ).catch(() => ({ rows: [] }));
  if (asmt.rows.length > 0) data.assessmentScore = asmt.rows[0].score;

  // Pull CAPADEX score from capadex_reports
  const cap = await pool.query(
    `SELECT session_data FROM capadex_reports WHERE session_id IN (
       SELECT id FROM capadex_sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1
     ) LIMIT 1`,
    [userId]
  ).catch(() => ({ rows: [] }));
  if (cap.rows.length > 0) {
    const sd = cap.rows[0].session_data as Record<string, unknown> ?? {};
    data.capadexScore = sd.overallScore ?? sd.score ?? null;
  }

  return data;
}

export function registerMEIV2Routes(
  app: Express,
  pool: Pool,
  requireAuth: Auth,
  requireSuperAdmin: Auth
): void {

  // ── Middleware ─────────────────────────────────────────────────────────────
  app.use('/api/mei', async (_req: Request, _res: Response, next: () => void) => {
    await ensureSchema(pool);
    next();
  });
  app.use('/api/admin/mei', async (_req: Request, _res: Response, next: () => void) => {
    await ensureSchema(pool);
    next();
  });

  // ── GET /api/mei/score/:userId ─────────────────────────────────────────────
  app.get('/api/mei/score/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { industry, role, force } = req.query as Record<string, string>;

      // Return cached score unless ?force=1
      if (!force) {
        const cached = await pool.query('SELECT * FROM mei_scores WHERE user_id=$1', [userId]);
        if (cached.rows.length > 0) {
          const row = cached.rows[0] as Record<string, unknown>;
          const score = {
            ...row,
            dimensions: ((row.breakdown as Record<string, unknown>)?.dimensions ?? []),
          };
          return res.json({ ok: true, cached: true, score });
        }
      }

      const profile = await resolveProfile(pool, userId);
      if (!profile) return res.status(404).json({ ok: false, error: 'Profile not found' });

      const input = mapProfileToMEIInput(profile, {
        industryCode:  industry ?? profile.targetIndustry as string ?? null,
        roleLevelCode: role ?? null,
      });
      const output = await computeMEIScore(pool, input);

      // Persist score + history atomically (Program 2 2.1: was two separate
      // pool.query calls → a failure between them could leave a partial write
      // of mei_scores without the matching mei_score_history snapshot).
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO mei_scores
             (user_id, composite_score, band, confidence, industry_code, role_level_code,
              breakdown, calibration_trace, data_sources, computed_at, version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),'2.0')
           ON CONFLICT (user_id) DO UPDATE SET
             composite_score=$2, band=$3, confidence=$4, industry_code=$5,
             role_level_code=$6, breakdown=$7, calibration_trace=$8,
             data_sources=$9, computed_at=NOW()`,
          [userId, output.composite_score, output.band, output.confidence,
           output.industry_code, output.role_level_code,
           JSON.stringify({ dimensions: output.dimensions }),
           JSON.stringify(output.calibration_trace),
           output.data_sources]
        );
        await client.query(
          `INSERT INTO mei_score_history
             (user_id,composite_score,band,confidence,industry_code,role_level_code,breakdown,snapshot_trigger,version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'api_compute','2.0')`,
          [userId, output.composite_score, output.band, output.confidence,
           output.industry_code, output.role_level_code,
           JSON.stringify({ dimensions: output.dimensions })]
        );
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }

      res.json({ ok: true, cached: false, score: output });
    } catch (err) {
      console.error('[mei-v2] score error', err);
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── GET /api/mei/breakdown/:userId ────────────────────────────────────────
  app.get('/api/mei/breakdown/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { industry, role } = req.query as Record<string, string>;

      const profile = await resolveProfile(pool, userId);
      if (!profile) return res.status(404).json({ ok: false, error: 'Profile not found' });

      const input = mapProfileToMEIInput(profile, {
        industryCode:  industry ?? profile.targetIndustry as string ?? null,
        roleLevelCode: role ?? null,
      });
      const output = await computeMEIScore(pool, input);
      res.json({ ok: true, breakdown: output });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── GET /api/mei/benchmark/:userId ────────────────────────────────────────
  app.get('/api/mei/benchmark/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { industry, role } = req.query as Record<string, string>;

      const [profileRaw, cachedScore] = await Promise.all([
        resolveProfile(pool, userId),
        pool.query('SELECT * FROM mei_scores WHERE user_id=$1', [userId]),
      ]);
      if (!profileRaw) return res.status(404).json({ ok: false, error: 'Profile not found' });

      const input = mapProfileToMEIInput(profileRaw, {
        industryCode:  industry ?? profileRaw.targetIndustry as string ?? null,
        roleLevelCode: role ?? null,
      });

      let scoreOutput;
      if (cachedScore.rows.length > 0) {
        const row = cachedScore.rows[0] as Record<string, unknown>;
        scoreOutput = {
          composite_score: row.composite_score as number,
          band: row.band as string,
          dimensions: (row.breakdown as Record<string, unknown>).dimensions ?? [],
          confidence: row.confidence as number,
          industry_code: row.industry_code,
          role_level_code: row.role_level_code,
        } as Parameters<typeof computeBenchmark>[1];
      } else {
        scoreOutput = await computeMEIScore(pool, input);
      }

      const benchmark = await computeBenchmark(pool, scoreOutput, input.totalMonths ?? 0);
      res.json({ ok: true, benchmark });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── GET /api/mei/narrative/:userId ────────────────────────────────────────
  app.get('/api/mei/narrative/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { audience = 'candidate', force } = req.query as Record<string, string>;

      // Cache check
      if (!force) {
        const cached = await pool.query(
          'SELECT * FROM mei_narratives WHERE user_id=$1 AND audience=$2', [userId, audience]);
        if (cached.rows.length > 0) {
          return res.json({ ok: true, cached: true, narrative: cached.rows[0] });
        }
      }

      const profile = await resolveProfile(pool, userId);
      if (!profile) return res.status(404).json({ ok: false, error: 'Profile not found' });

      const input = mapProfileToMEIInput(profile);
      const scoreOutput = await computeMEIScore(pool, input);
      const benchmarkOutput = await computeBenchmark(pool, scoreOutput, input.totalMonths ?? 0);
      const narrative = await generateNarrative(pool, scoreOutput, benchmarkOutput, audience as 'candidate' | 'counselor');
      await persistNarrative(pool, userId, narrative, scoreOutput.composite_score);

      res.json({ ok: true, cached: false, narrative });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── GET /api/mei/recommendations/:userId ──────────────────────────────────
  app.get('/api/mei/recommendations/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { industry, role } = req.query as Record<string, string>;

      const profile = await resolveProfile(pool, userId);
      if (!profile) return res.status(404).json({ ok: false, error: 'Profile not found' });

      const input = mapProfileToMEIInput(profile, {
        industryCode:  industry ?? profile.targetIndustry as string ?? null,
        roleLevelCode: role ?? null,
      });
      const scoreOutput = await computeMEIScore(pool, input);
      const recs = await computeRecommendations(pool, userId, scoreOutput);
      res.json({ ok: true, recommendations: recs });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── POST /api/mei/recommendations/:userId/:recId/action ───────────────────
  app.post('/api/mei/recommendations/:userId/:recId/action', requireAuth, async (req: Request, res: Response) => {
    try {
      await markRecommendationActioned(pool, req.params.userId, parseInt(req.params.recId));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── GET /api/mei/history/:userId ──────────────────────────────────────────
  app.get('/api/mei/history/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { limit = '20' } = req.query as Record<string, string>;
      const res2 = await pool.query(
        `SELECT id,composite_score::float,band,confidence::float,industry_code,role_level_code,
                snapshot_trigger,computed_at
         FROM mei_score_history WHERE user_id=$1 ORDER BY computed_at DESC LIMIT $2`,
        [req.params.userId, parseInt(limit)]
      );
      res.json({ ok: true, history: res2.rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ADMIN ROUTES
  // ──────────────────────────────────────────────────────────────────────────

  // Taxonomy reads
  app.get('/api/admin/mei/dimensions', requireAuth, requireSuperAdmin, async (_req, res) => {
    const r = await pool.query('SELECT * FROM mei_dimensions ORDER BY display_order');
    res.json({ ok: true, dimensions: r.rows });
  });

  app.get('/api/admin/mei/subdimensions', requireAuth, requireSuperAdmin, async (_req, res) => {
    const r = await pool.query(`
      SELECT sd.*, d.code AS dimension_code, d.name AS dimension_name
      FROM mei_subdimensions sd JOIN mei_dimensions d ON d.id=sd.dimension_id
      ORDER BY d.display_order, sd.display_order`);
    res.json({ ok: true, subdimensions: r.rows });
  });

  app.get('/api/admin/mei/competencies', requireAuth, requireSuperAdmin, async (req, res) => {
    const { subdimension_id } = req.query as Record<string, string>;
    const where = subdimension_id ? 'WHERE c.subdimension_id=$1' : '';
    const params = subdimension_id ? [subdimension_id] : [];
    const r = await pool.query(
      `SELECT c.*, sd.code AS subdimension_code, sd.name AS subdimension_name,
              d.code AS dimension_code
       FROM mei_competencies c
       JOIN mei_subdimensions sd ON sd.id=c.subdimension_id
       JOIN mei_dimensions d ON d.id=sd.dimension_id
       ${where}
       ORDER BY d.display_order, sd.display_order, c.display_order`,
      params
    );
    res.json({ ok: true, competencies: r.rows });
  });

  // Calibration reads
  app.get('/api/admin/mei/calibration/industry', requireAuth, requireSuperAdmin, async (_req, res) => {
    const r = await pool.query(`
      SELECT ic.*, d.code AS dimension_code, d.name AS dimension_name
      FROM mei_industry_calibration ic JOIN mei_dimensions d ON d.id=ic.dimension_id
      ORDER BY ic.industry_name, d.display_order`);
    res.json({ ok: true, calibration: r.rows });
  });

  app.get('/api/admin/mei/calibration/role', requireAuth, requireSuperAdmin, async (_req, res) => {
    const r = await pool.query(`
      SELECT rc.*, d.code AS dimension_code, d.name AS dimension_name
      FROM mei_role_calibration rc JOIN mei_dimensions d ON d.id=rc.dimension_id
      ORDER BY rc.yoe_min NULLS LAST, d.display_order`);
    res.json({ ok: true, calibration: r.rows });
  });

  // Insight rules
  app.get('/api/admin/mei/insight-rules', requireAuth, requireSuperAdmin, async (_req, res) => {
    const r = await pool.query('SELECT * FROM mei_insight_rules ORDER BY rule_type, priority DESC');
    res.json({ ok: true, rules: r.rows });
  });

  // Recommendation master
  app.get('/api/admin/mei/recommendations', requireAuth, requireSuperAdmin, async (_req, res) => {
    const r = await pool.query(`
      SELECT rm.*, d.code AS dimension_code, d.name AS dimension_name
      FROM mei_recommendation_master rm
      LEFT JOIN mei_dimensions d ON d.id=rm.target_dimension
      ORDER BY rm.display_order`);
    res.json({ ok: true, recommendations: r.rows });
  });

  // Platform score overview
  app.get('/api/admin/mei/scores', requireAuth, requireSuperAdmin, async (_req, res) => {
    const [overview, banddist, recent] = await Promise.all([
      pool.query(`SELECT
        COUNT(*)::int AS total_scored,
        ROUND(AVG(composite_score)::numeric,1) AS avg_score,
        ROUND(MIN(composite_score)::numeric,1) AS min_score,
        ROUND(MAX(composite_score)::numeric,1) AS max_score
        FROM mei_scores`),
      pool.query(`SELECT band, COUNT(*)::int AS count FROM mei_scores GROUP BY band ORDER BY band`),
      pool.query(`SELECT user_id,composite_score::float,band,computed_at
                  FROM mei_scores ORDER BY computed_at DESC LIMIT 20`),
    ]);
    res.json({
      ok: true,
      overview: overview.rows[0],
      band_distribution: banddist.rows,
      recent_scores: recent.rows,
    });
  });

  // Benchmark refresh (admin trigger)
  app.post('/api/admin/mei/benchmark/refresh', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { industry_code = null, role_level_code = null, yoe_band = null } = req.body as Record<string, string | null>;
      const result = await refreshCohortBenchmark(pool, industry_code, role_level_code, yoe_band);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // Dimension weight update
  app.patch('/api/admin/mei/dimensions/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { base_weight, is_active } = req.body as Record<string, unknown>;
      await pool.query(
        `UPDATE mei_dimensions SET base_weight=COALESCE($1,base_weight), is_active=COALESCE($2,is_active), updated_at=NOW() WHERE id=$3`,
        [base_weight, is_active, req.params.id]
      );
      invalidateTaxonomyCache();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // Calibration update
  app.patch('/api/admin/mei/calibration/industry/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { multiplier } = req.body as Record<string, unknown>;
      await pool.query('UPDATE mei_industry_calibration SET multiplier=$1,updated_at=NOW() WHERE id=$2', [multiplier, req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.patch('/api/admin/mei/calibration/role/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { multiplier } = req.body as Record<string, unknown>;
      await pool.query('UPDATE mei_role_calibration SET multiplier=$1,updated_at=NOW() WHERE id=$2', [multiplier, req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── Insight rules CRUD ────────────────────────────────────────────────────

  app.post('/api/admin/mei/insight-rules', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const {
        rule_type, trigger_field, trigger_operator, trigger_value,
        narrative_template, tone = 'direct', audience = 'candidate', priority = 50,
      } = req.body as Record<string, unknown>;
      if (!rule_type || !trigger_field || !trigger_operator || !narrative_template) {
        return res.status(400).json({ ok: false, error: 'rule_type, trigger_field, trigger_operator, narrative_template are required' });
      }
      const r = await pool.query(
        `INSERT INTO mei_insight_rules
           (rule_type, trigger_field, trigger_operator, trigger_value,
            narrative_template, tone, audience, priority)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [rule_type, trigger_field, trigger_operator,
         trigger_value !== undefined ? JSON.stringify(trigger_value) : null,
         narrative_template, tone, audience, priority]
      );
      res.json({ ok: true, rule: r.rows[0] });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.patch('/api/admin/mei/insight-rules/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const {
        rule_type, trigger_field, trigger_operator, trigger_value,
        narrative_template, tone, audience, priority, is_active,
      } = req.body as Record<string, unknown>;
      await pool.query(
        `UPDATE mei_insight_rules SET
           rule_type            = COALESCE($1, rule_type),
           trigger_field        = COALESCE($2, trigger_field),
           trigger_operator     = COALESCE($3, trigger_operator),
           trigger_value        = COALESCE($4::jsonb, trigger_value),
           narrative_template   = COALESCE($5, narrative_template),
           tone                 = COALESCE($6, tone),
           audience             = COALESCE($7, audience),
           priority             = COALESCE($8, priority),
           is_active            = COALESCE($9, is_active)
         WHERE id = $10`,
        [rule_type, trigger_field, trigger_operator,
         trigger_value !== undefined ? JSON.stringify(trigger_value) : null,
         narrative_template, tone, audience, priority, is_active,
         req.params.id]
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.delete('/api/admin/mei/insight-rules/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      await pool.query('UPDATE mei_insight_rules SET is_active=FALSE WHERE id=$1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── Recommendation master CRUD ────────────────────────────────────────────

  app.post('/api/admin/mei/recommendations', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const {
        code, title, description, action_type = 'update_profile',
        target_dimension = null, target_subdimension = null,
        estimated_point_gain = null, effort_level = 'medium',
        time_to_complete = null, link_path = null, display_order = 99,
      } = req.body as Record<string, unknown>;
      if (!code || !title || !description) {
        return res.status(400).json({ ok: false, error: 'code, title, description are required' });
      }
      const r = await pool.query(
        `INSERT INTO mei_recommendation_master
           (code, title, description, action_type, target_dimension, target_subdimension,
            estimated_point_gain, effort_level, time_to_complete, link_path, display_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [code, title, description, action_type, target_dimension, target_subdimension,
         estimated_point_gain, effort_level, time_to_complete, link_path, display_order]
      );
      res.json({ ok: true, recommendation: r.rows[0] });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.patch('/api/admin/mei/recommendations/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const {
        title, description, action_type, target_dimension, target_subdimension,
        estimated_point_gain, effort_level, time_to_complete, link_path,
        display_order, is_active,
      } = req.body as Record<string, unknown>;
      await pool.query(
        `UPDATE mei_recommendation_master SET
           title                = COALESCE($1, title),
           description          = COALESCE($2, description),
           action_type          = COALESCE($3, action_type),
           target_dimension     = COALESCE($4, target_dimension),
           target_subdimension  = COALESCE($5, target_subdimension),
           estimated_point_gain = COALESCE($6::numeric, estimated_point_gain),
           effort_level         = COALESCE($7, effort_level),
           time_to_complete     = COALESCE($8, time_to_complete),
           link_path            = COALESCE($9, link_path),
           display_order        = COALESCE($10, display_order),
           is_active            = COALESCE($11, is_active)
         WHERE id = $12`,
        [title, description, action_type, target_dimension, target_subdimension,
         estimated_point_gain, effort_level, time_to_complete, link_path,
         display_order, is_active, req.params.id]
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  app.delete('/api/admin/mei/recommendations/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      await pool.query('UPDATE mei_recommendation_master SET is_active=FALSE WHERE id=$1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── GET /api/mei/forecast/:userId ─────────────────────────────────────────
  app.get('/api/mei/forecast/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const histRes = await pool.query(
        `SELECT composite_score, computed_at FROM mei_score_history
         WHERE user_id=$1 ORDER BY computed_at ASC`,
        [userId]
      );
      if (histRes.rows.length < 2) {
        return res.json({
          ok: true,
          forecast: {
            insufficient_data: true,
            data_points: histRes.rows.length,
            historical: histRes.rows.map((r: Record<string,unknown>) => ({
              score: Number(r.composite_score),
              computed_at: r.computed_at,
            })),
            slope: null, projected: [], trend: 'stable',
          },
        });
      }

      const rows = histRes.rows.map((r: Record<string,unknown>, i: number) => ({
        x: i,
        y: Number(r.composite_score),
        computed_at: r.computed_at,
      }));
      const n = rows.length;
      const sumX  = rows.reduce((s, p) => s + p.x, 0);
      const sumY  = rows.reduce((s, p) => s + p.y, 0);
      const sumXY = rows.reduce((s, p) => s + p.x * p.y, 0);
      const sumXX = rows.reduce((s, p) => s + p.x * p.x, 0);
      const denom = n * sumXX - sumX * sumX;
      const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
      const intercept = (sumY - slope * sumX) / n;

      const projected = [1, 2, 3].map(k => ({
        session_offset: k,
        label: `Session +${k}`,
        score: Math.max(0, Math.min(99, Math.round((intercept + slope * (n + k - 1)) * 10) / 10)),
      }));

      const trend = slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'stable';

      res.json({
        ok: true,
        forecast: {
          insufficient_data: false,
          data_points: n,
          slope: Math.round(slope * 100) / 100,
          trend,
          historical: rows.map(r => ({ score: r.y, computed_at: r.computed_at })),
          projected,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── GET /api/mei/longitudinal/:userId ─────────────────────────────────────
  app.get('/api/mei/longitudinal/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const rows = await pool.query(
        `SELECT composite_score, band, confidence, snapshot_trigger, computed_at,
                breakdown->>'dimensions' AS dimensions_json
         FROM mei_score_history WHERE user_id=$1
         ORDER BY computed_at DESC LIMIT $2`,
        [userId, limit]
      );
      res.json({ ok: true, history: rows.rows, total: rows.rowCount });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── GET /api/admin/mei/pipeline-health ────────────────────────────────────
  app.get('/api/admin/mei/pipeline-health', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const [
        meiScoresR, meiHistR, meiRecsR, ucipR, ucipLogsR,
        profilesR, usersR, recentTriggersR, meiLast24hR,
      ] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM mei_scores'),
        pool.query('SELECT COUNT(*), MAX(computed_at) AS last_compute FROM mei_score_history'),
        pool.query('SELECT COUNT(*) FROM mei_user_recommendations'),
        pool.query('SELECT COUNT(*) FROM ucip_profiles'),
        pool.query(`SELECT status, COUNT(*) FROM ucip_runtime_logs GROUP BY status`).catch(() => ({ rows: [] })),
        pool.query('SELECT COUNT(*) FROM career_seeker_profiles').catch(() => ({ rows: [{ count: '0' }] })),
        pool.query('SELECT COUNT(*) FROM users').catch(() => ({ rows: [{ count: '0' }] })),
        pool.query(`SELECT COUNT(*) FROM mei_score_history WHERE computed_at > NOW() - INTERVAL '24 hours'`),
        pool.query(`SELECT COUNT(DISTINCT user_id) FROM mei_score_history`),
      ]);

      const meiScores      = Number(meiScoresR.rows[0].count);
      const meiHistTotal   = Number(meiHistR.rows[0].count);
      const lastCompute    = meiHistR.rows[0].last_compute;
      const meiRecs        = Number(meiRecsR.rows[0].count);
      const ucipProfiles   = Number(ucipR.rows[0].count);
      const profilesTotal  = Number(profilesR.rows[0].count);
      const usersTotal     = Number(usersR.rows[0].count);
      const triggers24h    = Number(recentTriggersR.rows[0].count);
      const usersScored    = Number(meiLast24hR.rows[0].count);

      const ucipStatuses: Record<string,number> = {};
      for (const r of ucipLogsR.rows as Array<{ status: string; count: string }>) {
        ucipStatuses[r.status] = Number(r.count);
      }

      const coveragePct = profilesTotal > 0
        ? Math.round((meiScores / profilesTotal) * 100) : 0;
      const ucipCoveragePct = meiScores > 0
        ? Math.round((ucipProfiles / meiScores) * 100) : 0;
      const recCoveragePct = meiScores > 0
        ? Math.round((meiRecs / meiScores) * 100) : 0;

      res.json({
        ok: true,
        health: {
          generated_at: new Date().toISOString(),
          pipeline: {
            mei_scores:       meiScores,
            mei_history_rows: meiHistTotal,
            last_compute:     lastCompute,
            triggers_24h:     triggers24h,
            users_scored:     usersScored,
          },
          coverage: {
            profiles_total:    profilesTotal,
            users_total:       usersTotal,
            mei_coverage_pct:  coveragePct,
            ucip_profiles:     ucipProfiles,
            ucip_coverage_pct: ucipCoveragePct,
            recommendations:   meiRecs,
            rec_coverage_pct:  recCoveragePct,
          },
          ucip_statuses: ucipStatuses,
          status: meiScores === 0 ? 'inactive'
            : coveragePct < 50 ? 'partial'
            : coveragePct >= 80 ? 'healthy' : 'active',
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── POST /api/admin/mei/pipeline-health/rebuild/:userId ───────────────────
  app.post('/api/admin/mei/pipeline-health/rebuild/:userId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { triggerMEIChain } = await import('../services/mei-chain-trigger');
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ ok: false, error: 'userId required' });
      await triggerMEIChain(pool, userId);
      const score = await pool.query('SELECT composite_score, band, computed_at FROM mei_scores WHERE user_id=$1', [userId]);
      res.json({ ok: true, user_id: userId, score: score.rows[0] ?? null });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── POST /api/admin/mei/pipeline-health/backfill ──────────────────────────
  app.post('/api/admin/mei/pipeline-health/backfill', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { backfillMEIChain } = await import('../services/mei-chain-trigger');
      const usersRes = await pool.query(
        `SELECT DISTINCT user_id FROM career_seeker_profiles WHERE user_id IS NOT NULL ORDER BY user_id`
      );
      const userIds = usersRes.rows.map((r: Record<string,unknown>) => String(r.user_id));
      res.json({ ok: true, queued: userIds.length, message: 'Backfill started in background' });
      backfillMEIChain(pool, userIds, { chunkSize: 3 }).then(result => {
        console.log('[mei-backfill-admin] complete:', result);
      }).catch(e => console.warn('[mei-backfill-admin] error:', e.message));
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });
}
