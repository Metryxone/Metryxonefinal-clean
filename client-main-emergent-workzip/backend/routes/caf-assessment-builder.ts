/**
 * CAF — Assessment Builder + Randomization Engine
 *
 * GET/POST/PATCH/DELETE /api/caf/assessments
 * GET/POST/PATCH/DELETE /api/caf/assessments/:id/sections
 * GET/POST/DELETE       /api/caf/sections/:id/questions
 * GET/PUT               /api/caf/assessments/:id/randomization
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

type Auth = (req: Request, res: Response, next: () => void) => void;

async function ensureCAFBuilderSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS caf_assessments (
      id SERIAL PRIMARY KEY, code VARCHAR(40) NOT NULL UNIQUE, title VARCHAR(220) NOT NULL,
      assessment_type VARCHAR(30) NOT NULL DEFAULT 'behavioral',
      description TEXT, instructions TEXT,
      level_framework_id INTEGER, difficulty_calibration_id INTEGER,
      time_limit_mins SMALLINT, max_attempts SMALLINT NOT NULL DEFAULT 1,
      passing_score NUMERIC(5,2) NOT NULL DEFAULT 60.0,
      randomize_sections BOOLEAN NOT NULL DEFAULT false,
      randomize_questions BOOLEAN NOT NULL DEFAULT false,
      show_score_immediately BOOLEAN NOT NULL DEFAULT false,
      show_feedback BOOLEAN NOT NULL DEFAULT true,
      allow_review BOOLEAN NOT NULL DEFAULT false,
      proctoring_level VARCHAR(20) NOT NULL DEFAULT 'none',
      target_persona TEXT[], target_roles INTEGER[], target_level_codes TEXT[], tags TEXT[],
      published_at TIMESTAMPTZ, version SMALLINT NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT true, status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS caf_assessment_sections (
      id SERIAL PRIMARY KEY, assessment_id INTEGER NOT NULL REFERENCES caf_assessments(id) ON DELETE CASCADE,
      code VARCHAR(40) NOT NULL, title VARCHAR(180) NOT NULL, instructions TEXT,
      section_type VARCHAR(30) NOT NULL DEFAULT 'standard',
      time_limit_mins SMALLINT, question_count SMALLINT NOT NULL DEFAULT 10,
      randomize BOOLEAN NOT NULL DEFAULT false, weight NUMERIC(5,3) NOT NULL DEFAULT 1.0,
      scoring_method VARCHAR(20) NOT NULL DEFAULT 'sum', sort_order SMALLINT NOT NULL DEFAULT 0,
      UNIQUE(assessment_id, code)
    );
    CREATE TABLE IF NOT EXISTS caf_section_questions (
      id SERIAL PRIMARY KEY, section_id INTEGER NOT NULL REFERENCES caf_assessment_sections(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES caf_question_bank(id) ON DELETE CASCADE,
      is_fixed BOOLEAN NOT NULL DEFAULT true, pool_group VARCHAR(40), sort_order SMALLINT NOT NULL DEFAULT 0,
      UNIQUE(section_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS caf_randomization_rules (
      id SERIAL PRIMARY KEY, assessment_id INTEGER NOT NULL REFERENCES caf_assessments(id) ON DELETE CASCADE UNIQUE,
      strategy VARCHAR(30) NOT NULL DEFAULT 'stratified',
      stratify_by TEXT[], difficulty_distribution JSONB, ensure_coverage TEXT[],
      seed_mode VARCHAR(20) NOT NULL DEFAULT 'session', parallel_forms SMALLINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export function registerCAFAssessmentBuilderRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {

  // ── Assessments ──────────────────────────────────────────────────────────────
  app.get('/api/caf/assessments', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFBuilderSchema(pool);
      const { search = '', type = 'all', status = 'all', page = '1', limit = '50' } = req.query as Record<string, string>;
      const params: unknown[] = []; const conds: string[] = [];
      if (type !== 'all') { params.push(type); conds.push(`assessment_type=$${params.length}`); }
      if (status !== 'all') { params.push(status); conds.push(`status=$${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(title ILIKE $${params.length} OR code ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
      params.push(parseInt(limit)); params.push(offset);
      const { rows } = await pool.query(
        `SELECT a.*,
          (SELECT COUNT(*) FROM caf_assessment_sections WHERE assessment_id=a.id) AS section_count,
          (SELECT COUNT(*) FROM caf_sessions WHERE assessment_id=a.id) AS session_count
         FROM caf_assessments a ${where} ORDER BY a.assessment_type, a.status, a.id DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`, params
      );
      const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM caf_assessments ${where}`, params.slice(0, -2));
      res.json({ assessments: rows, total: parseInt(count) });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.get('/api/caf/assessments/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [a] } = await pool.query(`SELECT * FROM caf_assessments WHERE id=$1`, [id]);
      if (!a) return res.status(404).json({ error: 'Not found' });
      const { rows: sections } = await pool.query(
        `SELECT s.*, (SELECT COUNT(*) FROM caf_section_questions WHERE section_id=s.id) AS question_count
         FROM caf_assessment_sections s WHERE assessment_id=$1 ORDER BY sort_order`, [id]
      );
      const { rows: [rr] } = await pool.query(`SELECT * FROM caf_randomization_rules WHERE assessment_id=$1`, [id]);
      res.json({ ...a, sections, randomization: rr || null });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/caf/assessments', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFBuilderSchema(pool);
      const { code, title, assessment_type, description, instructions, level_framework_id, difficulty_calibration_id,
        time_limit_mins, max_attempts = 1, passing_score = 60, randomize_sections = false, randomize_questions = false,
        show_score_immediately = false, show_feedback = true, allow_review = false, proctoring_level = 'none',
        target_persona, target_roles, target_level_codes, tags, status = 'draft' } = req.body;
      if (!code || !title || !assessment_type) return res.status(400).json({ error: 'code, title, assessment_type required' });
      const user = (req as Request & { user?: { email?: string } }).user?.email ?? 'superadmin';
      const { rows: [a] } = await pool.query(
        `INSERT INTO caf_assessments (code,title,assessment_type,description,instructions,level_framework_id,difficulty_calibration_id,
          time_limit_mins,max_attempts,passing_score,randomize_sections,randomize_questions,show_score_immediately,
          show_feedback,allow_review,proctoring_level,target_persona,target_roles,target_level_codes,tags,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
        [code, title, assessment_type, description || null, instructions || null,
         level_framework_id || null, difficulty_calibration_id || null, time_limit_mins || null,
         max_attempts, passing_score, randomize_sections, randomize_questions,
         show_score_immediately, show_feedback, allow_review, proctoring_level,
         target_persona || null, target_roles || null, target_level_codes || null, tags || null, status, user]
      );
      res.status(201).json(a);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.patch('/api/caf/assessments/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const allowed = ['title','description','instructions','level_framework_id','difficulty_calibration_id',
        'time_limit_mins','max_attempts','passing_score','randomize_sections','randomize_questions',
        'show_score_immediately','show_feedback','allow_review','proctoring_level',
        'target_persona','target_roles','target_level_codes','tags','is_active','status'];
      const sets: string[] = []; const params: unknown[] = [];
      for (const f of allowed) {
        if (req.body[f] !== undefined) { params.push(req.body[f]); sets.push(`${f}=$${params.length}`); }
      }
      if (req.body.status === 'published') {
        sets.push('published_at=NOW()');
        sets.push(`version=(SELECT version+1 FROM caf_assessments WHERE id=${id})`);
      }
      if (!sets.length) return res.status(400).json({ error: 'No fields' });
      params.push(id);
      const { rows: [a] } = await pool.query(`UPDATE caf_assessments SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length} RETURNING *`, params);
      if (!a) return res.status(404).json({ error: 'Not found' });
      res.json(a);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.delete('/api/caf/assessments/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM caf_sessions WHERE assessment_id=$1 AND status='completed'`, [id]);
      if (parseInt(count) > 0) return res.status(409).json({ error: 'Assessment has completed sessions. Archive instead.' });
      await pool.query(`DELETE FROM caf_assessments WHERE id=$1`, [id]);
      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Sections ─────────────────────────────────────────────────────────────────
  app.get('/api/caf/assessments/:id/sections', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { rows } = await pool.query(
        `SELECT s.*, (SELECT COUNT(*) FROM caf_section_questions WHERE section_id=s.id) AS question_count
         FROM caf_assessment_sections s WHERE assessment_id=$1 ORDER BY sort_order`, [id]
      );
      res.json(rows);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/caf/assessments/:id/sections', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const assessment_id = parseInt(req.params.id);
      const { code, title, instructions, section_type = 'standard', time_limit_mins, question_count = 10,
        randomize = false, weight = 1.0, scoring_method = 'sum', sort_order = 0 } = req.body;
      if (!code || !title) return res.status(400).json({ error: 'code and title required' });
      const { rows: [s] } = await pool.query(
        `INSERT INTO caf_assessment_sections (assessment_id,code,title,instructions,section_type,time_limit_mins,question_count,randomize,weight,scoring_method,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [assessment_id, code, title, instructions || null, section_type, time_limit_mins || null, question_count, randomize, weight, scoring_method, sort_order]
      );
      res.status(201).json(s);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.patch('/api/caf/assessments/:aid/sections/:sid', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const sid = parseInt(req.params.sid);
      const allowed = ['title','instructions','section_type','time_limit_mins','question_count','randomize','weight','scoring_method','sort_order'];
      const sets: string[] = []; const params: unknown[] = [];
      for (const f of allowed) {
        if (req.body[f] !== undefined) { params.push(req.body[f]); sets.push(`${f}=$${params.length}`); }
      }
      if (!sets.length) return res.status(400).json({ error: 'No fields' });
      params.push(sid);
      const { rows: [s] } = await pool.query(`UPDATE caf_assessment_sections SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params);
      if (!s) return res.status(404).json({ error: 'Not found' });
      res.json(s);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.delete('/api/caf/assessments/:aid/sections/:sid', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await pool.query(`DELETE FROM caf_assessment_sections WHERE id=$1 AND assessment_id=$2`, [parseInt(req.params.sid), parseInt(req.params.aid)]);
      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Section Questions ────────────────────────────────────────────────────────
  app.get('/api/caf/sections/:id/questions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const sid = parseInt(req.params.id);
      const { rows } = await pool.query(
        `SELECT sq.*, q.code, q.stem, q.assessment_type, q.response_format, q.difficulty_tier, q.domain, q.level_code, q.status AS q_status
         FROM caf_section_questions sq JOIN caf_question_bank q ON q.id=sq.question_id
         WHERE sq.section_id=$1 ORDER BY sq.sort_order, sq.id`, [sid]
      );
      res.json(rows);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/caf/sections/:id/questions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const section_id = parseInt(req.params.id);
      const { question_id, is_fixed = true, pool_group, sort_order = 0 } = req.body;
      if (!question_id) return res.status(400).json({ error: 'question_id required' });
      const { rows: [sq] } = await pool.query(
        `INSERT INTO caf_section_questions (section_id,question_id,is_fixed,pool_group,sort_order)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT(section_id,question_id) DO UPDATE SET is_fixed=EXCLUDED.is_fixed, sort_order=EXCLUDED.sort_order RETURNING *`,
        [section_id, question_id, is_fixed, pool_group || null, sort_order]
      );
      res.status(201).json(sq);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.delete('/api/caf/sections/:id/questions/:qid', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await pool.query(`DELETE FROM caf_section_questions WHERE section_id=$1 AND question_id=$2`, [parseInt(req.params.id), parseInt(req.params.qid)]);
      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Randomization Rules ──────────────────────────────────────────────────────
  app.get('/api/caf/assessments/:id/randomization', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { rows: [rr] } = await pool.query(`SELECT * FROM caf_randomization_rules WHERE assessment_id=$1`, [parseInt(req.params.id)]);
      res.json(rr || null);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.put('/api/caf/assessments/:id/randomization', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const assessment_id = parseInt(req.params.id);
      const { strategy = 'stratified', stratify_by, difficulty_distribution, ensure_coverage, seed_mode = 'session', parallel_forms = 1 } = req.body;
      const { rows: [rr] } = await pool.query(
        `INSERT INTO caf_randomization_rules (assessment_id,strategy,stratify_by,difficulty_distribution,ensure_coverage,seed_mode,parallel_forms)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT(assessment_id) DO UPDATE SET strategy=EXCLUDED.strategy, stratify_by=EXCLUDED.stratify_by,
           difficulty_distribution=EXCLUDED.difficulty_distribution, ensure_coverage=EXCLUDED.ensure_coverage,
           seed_mode=EXCLUDED.seed_mode, parallel_forms=EXCLUDED.parallel_forms, updated_at=NOW()
         RETURNING *`,
        [assessment_id, strategy, stratify_by || null,
         difficulty_distribution ? JSON.stringify(difficulty_distribution) : null,
         ensure_coverage || null, seed_mode, parallel_forms]
      );
      res.json(rr);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });
}
