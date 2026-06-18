/**
 * CAF — Question Framework + Scenario Framework + Difficulty + Level Framework
 *
 * GET/POST/PATCH/DELETE /api/caf/questions
 * GET/POST/PATCH/DELETE /api/caf/questions/:id/options
 * GET/POST/PATCH/DELETE /api/caf/scenarios
 * GET/POST/PATCH/DELETE /api/caf/scenarios/:id/branches
 * GET/POST/PATCH        /api/caf/difficulty-calibrations
 * GET/POST/PATCH/DELETE /api/caf/level-frameworks
 * GET/POST/PATCH/DELETE /api/caf/level-anchors
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

type Auth = (req: Request, res: Response, next: () => void) => void;

async function ensureCAFQuestionSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS caf_question_bank (
      id SERIAL PRIMARY KEY, code VARCHAR(40) NOT NULL UNIQUE,
      assessment_type VARCHAR(30) NOT NULL DEFAULT 'behavioral',
      stem TEXT NOT NULL, response_format VARCHAR(30) NOT NULL DEFAULT 'likert_5',
      competency_id INTEGER, indicator_id INTEGER, level_code VARCHAR(20),
      domain VARCHAR(80), sub_domain VARCHAR(80), scenario_id INTEGER,
      difficulty_tier VARCHAR(10) NOT NULL DEFAULT 'medium',
      irt_a NUMERIC(6,4), irt_b NUMERIC(6,4), irt_c NUMERIC(6,4),
      p_value NUMERIC(5,4), point_biserial NUMERIC(5,4),
      time_estimate_secs SMALLINT NOT NULL DEFAULT 90,
      instructions TEXT, media_url TEXT, tags TEXT[], persona_filter TEXT[],
      age_band_min SMALLINT, age_band_max SMALLINT,
      polarity VARCHAR(10) NOT NULL DEFAULT 'positive',
      reverse_score BOOLEAN NOT NULL DEFAULT false,
      is_anchor_item BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS caf_question_options (
      id SERIAL PRIMARY KEY, question_id INTEGER NOT NULL REFERENCES caf_question_bank(id) ON DELETE CASCADE,
      option_key VARCHAR(10) NOT NULL, option_text TEXT NOT NULL,
      score_value NUMERIC(6,3) NOT NULL DEFAULT 0,
      is_correct BOOLEAN NOT NULL DEFAULT false,
      distractor_quality VARCHAR(10), sort_order SMALLINT NOT NULL DEFAULT 0,
      UNIQUE(question_id, option_key)
    );
    CREATE TABLE IF NOT EXISTS caf_scenarios (
      id SERIAL PRIMARY KEY, code VARCHAR(40) NOT NULL UNIQUE,
      title VARCHAR(180) NOT NULL, scenario_type VARCHAR(30) NOT NULL DEFAULT 'situational_judgment',
      assessment_type VARCHAR(30) NOT NULL DEFAULT 'behavioral',
      context_narrative TEXT NOT NULL, situation_prompt TEXT NOT NULL,
      character_personas JSONB, constraints JSONB,
      difficulty_tier VARCHAR(10) NOT NULL DEFAULT 'medium',
      estimated_duration_mins SMALLINT NOT NULL DEFAULT 15,
      competency_tags TEXT[], is_active BOOLEAN NOT NULL DEFAULT true,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS caf_scenario_branches (
      id SERIAL PRIMARY KEY, scenario_id INTEGER NOT NULL REFERENCES caf_scenarios(id) ON DELETE CASCADE,
      branch_key VARCHAR(30) NOT NULL, condition_logic JSONB NOT NULL,
      next_scenario_id INTEGER REFERENCES caf_scenarios(id),
      next_question_code VARCHAR(40), outcome_label TEXT,
      score_modifier NUMERIC(5,3) NOT NULL DEFAULT 0, sort_order SMALLINT NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS caf_difficulty_calibrations (
      id SERIAL PRIMARY KEY, calibration_set_code VARCHAR(40) NOT NULL UNIQUE,
      name VARCHAR(180) NOT NULL, assessment_type VARCHAR(30) NOT NULL,
      tier_definitions JSONB NOT NULL, passing_thresholds JSONB NOT NULL,
      calibration_method VARCHAR(30) NOT NULL DEFAULT 'classical',
      sample_size INTEGER, calibration_date DATE,
      is_active BOOLEAN NOT NULL DEFAULT true, status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS caf_level_frameworks (
      id SERIAL PRIMARY KEY, code VARCHAR(30) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL, assessment_type VARCHAR(30) NOT NULL,
      description TEXT, levels JSONB NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true, status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS caf_level_anchors (
      id SERIAL PRIMARY KEY, framework_id INTEGER NOT NULL REFERENCES caf_level_frameworks(id) ON DELETE CASCADE,
      level_code VARCHAR(20) NOT NULL, competency_domain VARCHAR(80) NOT NULL,
      anchor_statement TEXT NOT NULL, observable_behaviors TEXT[], typical_examples TEXT[],
      sort_order SMALLINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export function registerCAFQuestionFrameworkRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {

  // ── Questions ────────────────────────────────────────────────────────────────
  app.get('/api/caf/questions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFQuestionSchema(pool);
      const { search = '', type = 'all', status = 'all', difficulty = 'all', domain = '', page = '1', limit = '100' } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (type !== 'all') { params.push(type); conds.push(`assessment_type = $${params.length}`); }
      if (status !== 'all') { params.push(status); conds.push(`status = $${params.length}`); }
      if (difficulty !== 'all') { params.push(difficulty); conds.push(`difficulty_tier = $${params.length}`); }
      if (domain.trim()) { params.push(`%${domain.trim()}%`); conds.push(`domain ILIKE $${params.length}`); }
      if (search.trim()) {
        params.push(`%${search.trim()}%`);
        conds.push(`(code ILIKE $${params.length} OR stem ILIKE $${params.length})`);
      }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(200, parseInt(limit));
      params.push(parseInt(limit)); params.push(offset);
      const { rows } = await pool.query(
        `SELECT q.*, (SELECT COUNT(*) FROM caf_question_options WHERE question_id=q.id) AS option_count
         FROM caf_question_bank q ${where} ORDER BY q.assessment_type, q.domain, q.id DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`, params
      );
      const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM caf_question_bank ${where}`, params.slice(0, -2));
      res.json({ questions: rows, total: parseInt(count) });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/caf/questions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFQuestionSchema(pool);
      const { code, assessment_type, stem, response_format = 'likert_5', competency_id, indicator_id,
        level_code, domain, sub_domain, scenario_id, difficulty_tier = 'medium',
        time_estimate_secs = 90, instructions, media_url, tags, persona_filter,
        age_band_min, age_band_max, polarity = 'positive', reverse_score = false,
        is_anchor_item = false, status = 'draft' } = req.body;
      if (!code || !stem || !assessment_type) return res.status(400).json({ error: 'code, assessment_type, and stem are required' });
      const user = (req as Request & { user?: { email?: string } }).user?.email ?? 'superadmin';
      const { rows: [q] } = await pool.query(
        `INSERT INTO caf_question_bank (code,assessment_type,stem,response_format,competency_id,indicator_id,
          level_code,domain,sub_domain,scenario_id,difficulty_tier,time_estimate_secs,instructions,media_url,
          tags,persona_filter,age_band_min,age_band_max,polarity,reverse_score,is_anchor_item,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
         RETURNING *`,
        [code, assessment_type, stem, response_format, competency_id || null, indicator_id || null,
         level_code || null, domain || null, sub_domain || null, scenario_id || null,
         difficulty_tier, time_estimate_secs, instructions || null, media_url || null,
         tags || null, persona_filter || null, age_band_min || null, age_band_max || null,
         polarity, reverse_score, is_anchor_item, status, user]
      );
      res.status(201).json(q);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.patch('/api/caf/questions/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const fields = ['stem','assessment_type','response_format','competency_id','indicator_id','level_code',
        'domain','sub_domain','scenario_id','difficulty_tier','time_estimate_secs','instructions','media_url',
        'tags','persona_filter','age_band_min','age_band_max','polarity','reverse_score','is_anchor_item',
        'is_active','status','irt_a','irt_b','irt_c','p_value','point_biserial'];
      const sets: string[] = []; const params: unknown[] = [];
      for (const f of fields) {
        if (req.body[f] !== undefined) { params.push(req.body[f]); sets.push(`${f}=$${params.length}`); }
      }
      if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
      params.push(id);
      const { rows: [q] } = await pool.query(
        `UPDATE caf_question_bank SET ${sets.join(',')}, updated_at=NOW() WHERE id=$${params.length} RETURNING *`, params
      );
      if (!q) return res.status(404).json({ error: 'Not found' });
      res.json(q);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.delete('/api/caf/questions/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [inUse] } = await pool.query(
        `SELECT 1 FROM caf_section_questions sq
         JOIN caf_assessment_sections s ON s.id=sq.section_id
         JOIN caf_assessments a ON a.id=s.assessment_id
         WHERE sq.question_id=$1 AND a.status != 'draft' LIMIT 1`, [id]
      );
      if (inUse) return res.status(409).json({ error: 'Question is used in a published assessment. Set is_active=false instead.' });
      await pool.query(`DELETE FROM caf_question_bank WHERE id=$1`, [id]);
      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Question Options ─────────────────────────────────────────────────────────
  app.get('/api/caf/questions/:id/options', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { rows } = await pool.query(`SELECT * FROM caf_question_options WHERE question_id=$1 ORDER BY sort_order,id`, [id]);
      res.json(rows);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/caf/questions/:id/options', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const question_id = parseInt(req.params.id);
      const { option_key, option_text, score_value = 0, is_correct = false, distractor_quality, sort_order = 0 } = req.body;
      if (!option_key || !option_text) return res.status(400).json({ error: 'option_key and option_text required' });
      const { rows: [o] } = await pool.query(
        `INSERT INTO caf_question_options (question_id,option_key,option_text,score_value,is_correct,distractor_quality,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(question_id,option_key) DO UPDATE
         SET option_text=EXCLUDED.option_text,score_value=EXCLUDED.score_value,is_correct=EXCLUDED.is_correct,
             distractor_quality=EXCLUDED.distractor_quality,sort_order=EXCLUDED.sort_order RETURNING *`,
        [question_id, option_key, option_text, score_value, is_correct, distractor_quality || null, sort_order]
      );
      res.status(201).json(o);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.delete('/api/caf/questions/:id/options/:oid', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await pool.query(`DELETE FROM caf_question_options WHERE id=$1 AND question_id=$2`, [parseInt(req.params.oid), parseInt(req.params.id)]);
      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Scenarios ────────────────────────────────────────────────────────────────
  app.get('/api/caf/scenarios', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFQuestionSchema(pool);
      const { search = '', type = 'all', status = 'all' } = req.query as Record<string, string>;
      const params: unknown[] = []; const conds: string[] = [];
      if (type !== 'all') { params.push(type); conds.push(`assessment_type=$${params.length}`); }
      if (status !== 'all') { params.push(status); conds.push(`status=$${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(title ILIKE $${params.length} OR code ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(`SELECT * FROM caf_scenarios ${where} ORDER BY assessment_type, scenario_type, id DESC LIMIT 200`, params);
      res.json(rows);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/caf/scenarios', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFQuestionSchema(pool);
      const { code, title, scenario_type = 'situational_judgment', assessment_type, context_narrative,
        situation_prompt, character_personas, constraints, difficulty_tier = 'medium',
        estimated_duration_mins = 15, competency_tags, status = 'draft' } = req.body;
      if (!code || !title || !assessment_type || !context_narrative || !situation_prompt)
        return res.status(400).json({ error: 'code, title, assessment_type, context_narrative, situation_prompt required' });
      const user = (req as Request & { user?: { email?: string } }).user?.email ?? 'superadmin';
      const { rows: [s] } = await pool.query(
        `INSERT INTO caf_scenarios (code,title,scenario_type,assessment_type,context_narrative,situation_prompt,
          character_personas,constraints,difficulty_tier,estimated_duration_mins,competency_tags,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [code, title, scenario_type, assessment_type, context_narrative, situation_prompt,
         character_personas ? JSON.stringify(character_personas) : null,
         constraints ? JSON.stringify(constraints) : null,
         difficulty_tier, estimated_duration_mins, competency_tags || null, status, user]
      );
      res.status(201).json(s);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.patch('/api/caf/scenarios/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const fields = ['title','scenario_type','assessment_type','context_narrative','situation_prompt',
        'character_personas','constraints','difficulty_tier','estimated_duration_mins','competency_tags','is_active','status'];
      const sets: string[] = []; const params: unknown[] = [];
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]);
          sets.push(`${f}=$${params.length}`);
        }
      }
      if (!sets.length) return res.status(400).json({ error: 'No fields' });
      params.push(id);
      const { rows: [s] } = await pool.query(`UPDATE caf_scenarios SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length} RETURNING *`, params);
      if (!s) return res.status(404).json({ error: 'Not found' });
      res.json(s);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.delete('/api/caf/scenarios/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      await pool.query(`DELETE FROM caf_scenarios WHERE id=$1`, [id]);
      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Scenario Branches ────────────────────────────────────────────────────────
  app.get('/api/caf/scenarios/:id/branches', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM caf_scenario_branches WHERE scenario_id=$1 ORDER BY sort_order,id`, [parseInt(req.params.id)]);
      res.json(rows);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/caf/scenarios/:id/branches', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const scenario_id = parseInt(req.params.id);
      const { branch_key, condition_logic, next_scenario_id, next_question_code, outcome_label, score_modifier = 0, sort_order = 0 } = req.body;
      if (!branch_key || !condition_logic) return res.status(400).json({ error: 'branch_key and condition_logic required' });
      const { rows: [b] } = await pool.query(
        `INSERT INTO caf_scenario_branches (scenario_id,branch_key,condition_logic,next_scenario_id,next_question_code,outcome_label,score_modifier,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [scenario_id, branch_key, JSON.stringify(condition_logic), next_scenario_id || null, next_question_code || null, outcome_label || null, score_modifier, sort_order]
      );
      res.status(201).json(b);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.delete('/api/caf/scenarios/:id/branches/:bid', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await pool.query(`DELETE FROM caf_scenario_branches WHERE id=$1 AND scenario_id=$2`, [parseInt(req.params.bid), parseInt(req.params.id)]);
      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Difficulty Calibrations ──────────────────────────────────────────────────
  app.get('/api/caf/difficulty-calibrations', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFQuestionSchema(pool);
      const { rows } = await pool.query(`SELECT * FROM caf_difficulty_calibrations ORDER BY assessment_type, name`);
      res.json(rows);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/caf/difficulty-calibrations', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFQuestionSchema(pool);
      const { calibration_set_code, name, assessment_type, tier_definitions, passing_thresholds,
        calibration_method = 'classical', sample_size, calibration_date, status = 'draft' } = req.body;
      if (!calibration_set_code || !name || !assessment_type || !tier_definitions || !passing_thresholds)
        return res.status(400).json({ error: 'calibration_set_code, name, assessment_type, tier_definitions, passing_thresholds required' });
      const user = (req as Request & { user?: { email?: string } }).user?.email ?? 'superadmin';
      const { rows: [d] } = await pool.query(
        `INSERT INTO caf_difficulty_calibrations (calibration_set_code,name,assessment_type,tier_definitions,passing_thresholds,calibration_method,sample_size,calibration_date,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [calibration_set_code, name, assessment_type, JSON.stringify(tier_definitions), JSON.stringify(passing_thresholds),
         calibration_method, sample_size || null, calibration_date || null, status, user]
      );
      res.status(201).json(d);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.patch('/api/caf/difficulty-calibrations/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const fields = ['name','tier_definitions','passing_thresholds','calibration_method','sample_size','calibration_date','is_active','status'];
      const sets: string[] = []; const params: unknown[] = [];
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]);
          sets.push(`${f}=$${params.length}`);
        }
      }
      if (!sets.length) return res.status(400).json({ error: 'No fields' });
      params.push(id);
      const { rows: [d] } = await pool.query(`UPDATE caf_difficulty_calibrations SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length} RETURNING *`, params);
      if (!d) return res.status(404).json({ error: 'Not found' });
      res.json(d);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Level Frameworks ─────────────────────────────────────────────────────────
  app.get('/api/caf/level-frameworks', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFQuestionSchema(pool);
      const { rows } = await pool.query(`SELECT * FROM caf_level_frameworks ORDER BY assessment_type, name`);
      res.json(rows);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/caf/level-frameworks', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFQuestionSchema(pool);
      const { code, name, assessment_type, description, levels, is_default = false, status = 'draft' } = req.body;
      if (!code || !name || !assessment_type || !levels) return res.status(400).json({ error: 'code, name, assessment_type, levels required' });
      const user = (req as Request & { user?: { email?: string } }).user?.email ?? 'superadmin';
      const { rows: [f] } = await pool.query(
        `INSERT INTO caf_level_frameworks (code,name,assessment_type,description,levels,is_default,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [code, name, assessment_type, description || null, JSON.stringify(levels), is_default, status, user]
      );
      res.status(201).json(f);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.patch('/api/caf/level-frameworks/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const fields = ['name','description','levels','is_default','is_active','status'];
      const sets: string[] = []; const params: unknown[] = [];
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]);
          sets.push(`${f}=$${params.length}`);
        }
      }
      if (!sets.length) return res.status(400).json({ error: 'No fields' });
      params.push(id);
      const { rows: [lf] } = await pool.query(`UPDATE caf_level_frameworks SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length} RETURNING *`, params);
      if (!lf) return res.status(404).json({ error: 'Not found' });
      res.json(lf);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.delete('/api/caf/level-frameworks/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      await pool.query(`DELETE FROM caf_level_frameworks WHERE id=$1`, [id]);
      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Level Anchors ────────────────────────────────────────────────────────────
  app.get('/api/caf/level-anchors', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { framework_id } = req.query as Record<string, string>;
      const where = framework_id ? 'WHERE framework_id=$1' : '';
      const params = framework_id ? [parseInt(framework_id)] : [];
      const { rows } = await pool.query(`SELECT * FROM caf_level_anchors ${where} ORDER BY level_code, competency_domain`, params);
      res.json(rows);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/caf/level-anchors', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { framework_id, level_code, competency_domain, anchor_statement, observable_behaviors, typical_examples, sort_order = 0 } = req.body;
      if (!framework_id || !level_code || !competency_domain || !anchor_statement)
        return res.status(400).json({ error: 'framework_id, level_code, competency_domain, anchor_statement required' });
      const { rows: [a] } = await pool.query(
        `INSERT INTO caf_level_anchors (framework_id,level_code,competency_domain,anchor_statement,observable_behaviors,typical_examples,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [framework_id, level_code, competency_domain, anchor_statement, observable_behaviors || null, typical_examples || null, sort_order]
      );
      res.status(201).json(a);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.patch('/api/caf/level-anchors/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const { anchor_statement, observable_behaviors, typical_examples, sort_order } = req.body;
      const sets: string[] = []; const params: unknown[] = [];
      if (anchor_statement !== undefined) { params.push(anchor_statement); sets.push(`anchor_statement=$${params.length}`); }
      if (observable_behaviors !== undefined) { params.push(observable_behaviors); sets.push(`observable_behaviors=$${params.length}`); }
      if (typical_examples !== undefined) { params.push(typical_examples); sets.push(`typical_examples=$${params.length}`); }
      if (sort_order !== undefined) { params.push(sort_order); sets.push(`sort_order=$${params.length}`); }
      if (!sets.length) return res.status(400).json({ error: 'No fields' });
      params.push(id);
      const { rows: [a] } = await pool.query(`UPDATE caf_level_anchors SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params);
      if (!a) return res.status(404).json({ error: 'Not found' });
      res.json(a);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.delete('/api/caf/level-anchors/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await pool.query(`DELETE FROM caf_level_anchors WHERE id=$1`, [parseInt(req.params.id)]);
      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });
}
