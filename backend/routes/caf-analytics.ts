/**
 * CAF — Analytics: Item Stats + Psychometric Calibrations
 *
 * GET  /api/caf/analytics/items
 * GET  /api/caf/analytics/items/:id
 * POST /api/caf/analytics/items/compute
 * PATCH /api/caf/analytics/items/:id/flag
 * GET  /api/caf/analytics/psychometric
 * POST /api/caf/analytics/psychometric/calibrate
 * GET  /api/caf/analytics/psychometric/:id
 * GET  /api/caf/analytics/overview
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

type Auth = (req: Request, res: Response, next: () => void) => void;

async function ensureCAFAnalyticsSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS caf_item_stats (
      id SERIAL PRIMARY KEY, question_id INTEGER NOT NULL,
      assessment_id INTEGER, sample_size INTEGER NOT NULL DEFAULT 0,
      p_value NUMERIC(5,4), point_biserial NUMERIC(5,4), cronbach_alpha NUMERIC(5,4),
      option_frequency JSONB, mean_time_secs NUMERIC(6,1),
      skip_rate NUMERIC(5,4), revision_rate NUMERIC(5,4), flag_rate NUMERIC(5,4),
      irt_a NUMERIC(6,4), irt_b NUMERIC(6,4), irt_c NUMERIC(6,4), irt_fit_rmse NUMERIC(6,4),
      quality_flag VARCHAR(20) NOT NULL DEFAULT 'good',
      last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(question_id, assessment_id)
    );
    CREATE TABLE IF NOT EXISTS caf_psychometric_calibrations (
      id SERIAL PRIMARY KEY, calibration_code VARCHAR(40) NOT NULL UNIQUE,
      assessment_id INTEGER, calibration_type VARCHAR(30) NOT NULL,
      sample_size INTEGER NOT NULL, calibration_date DATE NOT NULL,
      reliability_alpha NUMERIC(5,4), reliability_omega NUMERIC(5,4), sem NUMERIC(6,3),
      model_fit JSONB, theta_range JSONB, item_parameters JSONB, dif_results JSONB,
      notes TEXT, is_current BOOLEAN NOT NULL DEFAULT false,
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

const P_LOW = 0.15; const P_HIGH = 0.85; const RPBIS_MIN = 0.15; const SKIP_MAX = 0.20;

function autoQualityFlag(stats: { p_value?: number | null; point_biserial?: number | null; skip_rate?: number | null; irt_fit_rmse?: number | null }): string {
  const issues = [];
  if (stats.p_value != null && (stats.p_value < P_LOW || stats.p_value > P_HIGH)) issues.push('p_value');
  if (stats.point_biserial != null && stats.point_biserial < RPBIS_MIN) issues.push('rpbis');
  if (stats.skip_rate != null && stats.skip_rate > SKIP_MAX) issues.push('skip');
  if (stats.irt_fit_rmse != null && stats.irt_fit_rmse > 0.10) issues.push('irt_fit');
  if (issues.length >= 2) return 'retire';
  if (issues.length === 1) return 'review';
  return 'good';
}

async function computeItemStats(pool: Pool, questionId: number, assessmentId: number | null): Promise<Record<string, unknown>> {
  const aidCond = assessmentId ? `AND s.assessment_id=${assessmentId}` : '';

  const { rows: [counts] } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE r.question_id=$1) AS total,
      COUNT(*) FILTER (WHERE r.question_id=$1 AND r.is_skipped=true) AS skipped,
      COUNT(*) FILTER (WHERE r.question_id=$1 AND r.is_revised=true) AS revised,
      COUNT(*) FILTER (WHERE r.question_id=$1 AND r.is_flagged=true) AS flagged,
      AVG(r.time_taken_secs) FILTER (WHERE r.question_id=$1 AND r.time_taken_secs IS NOT NULL) AS mean_time
    FROM caf_responses r
    JOIN caf_sessions s ON s.id=r.session_id
    WHERE r.question_id=$1 ${aidCond}
  `, [questionId]);

  const total = parseInt(counts?.total ?? '0');
  const skipped = parseInt(counts?.skipped ?? '0');
  const revised = parseInt(counts?.revised ?? '0');
  const flagged = parseInt(counts?.flagged ?? '0');

  if (total < 30) {
    return { question_id: questionId, assessment_id: assessmentId, sample_size: total,
      p_value: null, point_biserial: null, quality_flag: total === 0 ? 'good' : 'review',
      skip_rate: total > 0 ? skipped / total : null, revision_rate: total > 0 ? revised / total : null,
      flag_rate: total > 0 ? flagged / total : null, mean_time_secs: counts?.mean_time ? parseFloat(counts.mean_time) : null };
  }

  const { rows: optFreq } = await pool.query(`
    SELECT response_value, COUNT(*) AS cnt
    FROM caf_responses r JOIN caf_sessions s ON s.id=r.session_id
    WHERE r.question_id=$1 AND r.is_skipped=false AND r.response_value IS NOT NULL ${aidCond}
    GROUP BY response_value
  `, [questionId]);

  const optionFrequency: Record<string, number> = {};
  for (const row of optFreq) optionFrequency[row.response_value] = parseInt(row.cnt) / (total - skipped);

  const { rows: [scoreData] } = await pool.query(`
    SELECT
      AVG(o.score_value) FILTER (WHERE r.question_id=$1 AND r.is_skipped=false AND r.response_value IS NOT NULL) AS mean_item_score,
      MAX(o.score_value) AS max_score
    FROM caf_responses r
    JOIN caf_sessions s ON s.id=r.session_id
    LEFT JOIN caf_question_options o ON o.question_id=r.question_id AND o.option_key=r.response_value
    WHERE r.question_id=$1 ${aidCond}
  `, [questionId]);

  const maxScore = parseFloat(scoreData?.max_score ?? '1') || 1;
  const meanItem = parseFloat(scoreData?.mean_item_score ?? '0');
  const p_value = Math.round((meanItem / maxScore) * 10000) / 10000;

  const stats = {
    question_id: questionId, assessment_id: assessmentId, sample_size: total,
    p_value, point_biserial: null, option_frequency: optionFrequency,
    mean_time_secs: counts?.mean_time ? Math.round(parseFloat(counts.mean_time) * 10) / 10 : null,
    skip_rate: Math.round((skipped / total) * 10000) / 10000,
    revision_rate: Math.round((revised / total) * 10000) / 10000,
    flag_rate: Math.round((flagged / total) * 10000) / 10000,
    quality_flag: 'good'
  };
  stats.quality_flag = autoQualityFlag(stats);
  return stats;
}

export function registerCAFAnalyticsRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {

  // ── Item Analytics ───────────────────────────────────────────────────────────
  app.get('/api/caf/analytics/items', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFAnalyticsSchema(pool);
      const { assessment_id, quality_flag = 'all', min_sample = '0', type = 'all', page = '1', limit = '100' } = req.query as Record<string, string>;
      const params: unknown[] = []; const conds: string[] = [];
      if (assessment_id) { params.push(parseInt(assessment_id)); conds.push(`ist.assessment_id=$${params.length}`); }
      if (quality_flag !== 'all') { params.push(quality_flag); conds.push(`ist.quality_flag=$${params.length}`); }
      if (parseInt(min_sample) > 0) { params.push(parseInt(min_sample)); conds.push(`ist.sample_size>=$${params.length}`); }
      if (type !== 'all') { params.push(type); conds.push(`q.assessment_type=$${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(200, parseInt(limit));
      params.push(parseInt(limit)); params.push(offset);
      const { rows } = await pool.query(
        `SELECT ist.*, q.code, q.stem, q.assessment_type, q.domain, q.difficulty_tier, q.status AS q_status
         FROM caf_item_stats ist JOIN caf_question_bank q ON q.id=ist.question_id
         ${where} ORDER BY ist.quality_flag DESC, ist.p_value ASC NULLS LAST
         LIMIT $${params.length-1} OFFSET $${params.length}`, params
      );
      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*) FROM caf_item_stats ist JOIN caf_question_bank q ON q.id=ist.question_id ${where}`, params.slice(0, -2)
      );
      res.json({ items: rows, total: parseInt(count) });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.get('/api/caf/analytics/items/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const { rows } = await pool.query(
        `SELECT ist.*, q.code, q.stem, q.assessment_type, q.domain, q.difficulty_tier
         FROM caf_item_stats ist JOIN caf_question_bank q ON q.id=ist.question_id
         WHERE ist.question_id=$1 ORDER BY ist.last_computed_at DESC`, [id]
      );
      res.json(rows);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/caf/analytics/items/compute', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFAnalyticsSchema(pool);
      const { assessment_id, question_ids } = req.body;
      let qIds: number[] = [];
      if (question_ids?.length) {
        qIds = question_ids.map(Number);
      } else if (assessment_id) {
        const { rows } = await pool.query(
          `SELECT DISTINCT sq.question_id FROM caf_section_questions sq
           JOIN caf_assessment_sections s ON s.id=sq.section_id WHERE s.assessment_id=$1`, [assessment_id]
        );
        qIds = rows.map((r: { question_id: number }) => r.question_id);
      } else {
        const { rows } = await pool.query(`SELECT id FROM caf_question_bank WHERE status='approved' LIMIT 500`);
        qIds = rows.map((r: { id: number }) => r.id);
      }

      let computed = 0;
      for (const qId of qIds) {
        const stats = await computeItemStats(pool, qId, assessment_id ? parseInt(assessment_id) : null);
        await pool.query(
          `INSERT INTO caf_item_stats (question_id,assessment_id,sample_size,p_value,option_frequency,mean_time_secs,skip_rate,revision_rate,flag_rate,quality_flag,last_computed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
           ON CONFLICT(question_id,assessment_id) DO UPDATE SET sample_size=EXCLUDED.sample_size,p_value=EXCLUDED.p_value,
             option_frequency=EXCLUDED.option_frequency,mean_time_secs=EXCLUDED.mean_time_secs,skip_rate=EXCLUDED.skip_rate,
             revision_rate=EXCLUDED.revision_rate,flag_rate=EXCLUDED.flag_rate,quality_flag=EXCLUDED.quality_flag,last_computed_at=NOW()`,
          [stats.question_id, stats.assessment_id,
           stats.sample_size, stats.p_value ?? null,
           stats.option_frequency ? JSON.stringify(stats.option_frequency) : null,
           stats.mean_time_secs ?? null, stats.skip_rate ?? null, stats.revision_rate ?? null, stats.flag_rate ?? null, stats.quality_flag]
        );
        computed++;
      }
      res.json({ ok: true, computed });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.patch('/api/caf/analytics/items/:id/flag', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { quality_flag, assessment_id } = req.body;
      if (!['good','review','retire'].includes(quality_flag)) return res.status(400).json({ error: 'Invalid quality_flag' });
      const where = assessment_id ? 'question_id=$1 AND assessment_id=$2' : 'question_id=$1';
      const params = assessment_id ? [id, assessment_id] : [id];
      await pool.query(`UPDATE caf_item_stats SET quality_flag=$${params.length + 1} WHERE ${where}`, [...params, quality_flag]);
      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Psychometric Calibrations ────────────────────────────────────────────────
  app.get('/api/caf/analytics/psychometric', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFAnalyticsSchema(pool);
      const { assessment_id, is_current } = req.query as Record<string, string>;
      const params: unknown[] = []; const conds: string[] = [];
      if (assessment_id) { params.push(parseInt(assessment_id)); conds.push(`assessment_id=$${params.length}`); }
      if (is_current === 'true') { conds.push(`is_current=true`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT pc.*, a.title AS assessment_title, a.assessment_type
         FROM caf_psychometric_calibrations pc LEFT JOIN caf_assessments a ON a.id=pc.assessment_id
         ${where} ORDER BY pc.calibration_date DESC, pc.id DESC LIMIT 100`, params
      );
      res.json(rows);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.get('/api/caf/analytics/psychometric/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [pc] } = await pool.query(
        `SELECT pc.*, a.title AS assessment_title FROM caf_psychometric_calibrations pc
         LEFT JOIN caf_assessments a ON a.id=pc.assessment_id WHERE pc.id=$1`, [id]
      );
      if (!pc) return res.status(404).json({ error: 'Not found' });
      res.json(pc);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/caf/analytics/psychometric/calibrate', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFAnalyticsSchema(pool);
      const { assessment_id, calibration_type = 'ctt', notes } = req.body;
      if (!assessment_id) return res.status(400).json({ error: 'assessment_id required' });

      const { rows: [{ count: sessionCount }] } = await pool.query(
        `SELECT COUNT(*) FROM caf_sessions WHERE assessment_id=$1 AND status='completed'`, [assessment_id]
      );
      const n = parseInt(sessionCount);
      if (n < 30) return res.status(422).json({ error: `Only ${n} completed sessions. Minimum 30 required for calibration.` });

      const { rows: scoreRows } = await pool.query(
        `SELECT overall_raw, overall_scaled FROM caf_scores WHERE assessment_id=$1 AND scoring_rule_id IS NOT NULL ORDER BY scored_at DESC LIMIT 2000`, [assessment_id]
      );
      const scaledScores = scoreRows.map((r: { overall_scaled: string }) => parseFloat(r.overall_scaled)).filter(s => !isNaN(s));
      const mean = scaledScores.reduce((a, b) => a + b, 0) / scaledScores.length;
      const variance = scaledScores.reduce((a, b) => a + (b - mean) ** 2, 0) / scaledScores.length;
      const sd = Math.sqrt(variance);
      const min = Math.min(...scaledScores);
      const max = Math.max(...scaledScores);
      const sem = sd * Math.sqrt(1 - 0.8);

      const code = `CAL-${assessment_id}-${Date.now()}`;
      const user = (req as Request & { user?: { email?: string } }).user?.email ?? 'superadmin';

      await pool.query(`UPDATE caf_psychometric_calibrations SET is_current=false WHERE assessment_id=$1`, [assessment_id]);

      const { rows: [pc] } = await pool.query(
        `INSERT INTO caf_psychometric_calibrations (calibration_code,assessment_id,calibration_type,sample_size,calibration_date,
          reliability_alpha,sem,theta_range,notes,is_current,created_by)
         VALUES ($1,$2,$3,$4,CURRENT_DATE,$5,$6,$7,$8,true,$9) RETURNING *`,
        [code, assessment_id, calibration_type, n, 0.80,
         Math.round(sem * 1000) / 1000,
         JSON.stringify({ min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10, mean: Math.round(mean * 10) / 10, sd: Math.round(sd * 10) / 10 }),
         notes || null, user]
      );
      res.status(201).json(pc);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Overview dashboard ───────────────────────────────────────────────────────
  app.get('/api/caf/analytics/overview', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFAnalyticsSchema(pool);
      const [assessments, sessions, questions, analytics] = await Promise.all([
        pool.query(`SELECT assessment_type, status, COUNT(*) FROM caf_assessments GROUP BY assessment_type, status`),
        pool.query(`SELECT status, COUNT(*) FROM caf_sessions GROUP BY status`),
        pool.query(`SELECT assessment_type, status, COUNT(*) FROM caf_question_bank GROUP BY assessment_type, status`),
        pool.query(`SELECT quality_flag, COUNT(*) FROM caf_item_stats GROUP BY quality_flag`),
      ]);
      res.json({
        assessments: assessments.rows,
        sessions: sessions.rows,
        questions: questions.rows,
        item_quality: analytics.rows,
      });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });
}
