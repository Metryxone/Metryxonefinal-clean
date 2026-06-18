/**
 * Ontology Learning Paths Routes — M15
 * Step-based learning journeys with structured steps (different from existing learning_plans)
 *
 * GET/POST/PATCH/DELETE /api/ontology/learning-paths
 * GET/POST/PATCH/DELETE /api/ontology/learning-paths/:id/steps
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

type Auth = (req: Request, res: Response, next: () => void) => void;

async function ensureLearningPathSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ont_learning_paths (
      id SERIAL PRIMARY KEY, code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(180) NOT NULL,
      description TEXT, target_role_id INTEGER, competency_codes TEXT[], duration_weeks SMALLINT,
      difficulty VARCHAR(20) DEFAULT 'intermediate', delivery_mode VARCHAR(20) DEFAULT 'blended',
      is_active BOOLEAN NOT NULL DEFAULT true, status VARCHAR(20) NOT NULL DEFAULT 'draft',
      sort_order INTEGER NOT NULL DEFAULT 0, created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ont_learning_path_steps (
      id SERIAL PRIMARY KEY, learning_path_id INTEGER NOT NULL REFERENCES ont_learning_paths(id) ON DELETE CASCADE,
      step_number SMALLINT NOT NULL, title VARCHAR(200) NOT NULL, description TEXT,
      step_type VARCHAR(30) DEFAULT 'module', duration_hours NUMERIC(5,2),
      is_required BOOLEAN NOT NULL DEFAULT true, resources JSONB,
      sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export function registerOntologyLearningPathRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {
  // List
  app.get('/api/ontology/learning-paths', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureLearningPathSchema(pool);
      const { search = '', status = 'all', difficulty = 'all' } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (status !== 'all') { params.push(status); conds.push(`lp.status = $${params.length}`); }
      if (difficulty !== 'all') { params.push(difficulty); conds.push(`lp.difficulty = $${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(lp.name ILIKE $${params.length} OR lp.code ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT lp.*, r.title AS target_role_title,
           (SELECT COUNT(*) FROM ont_learning_path_steps WHERE learning_path_id = lp.id)::int AS step_count
         FROM ont_learning_paths lp LEFT JOIN ont_roles r ON r.id = lp.target_role_id
         ${where} ORDER BY lp.sort_order, lp.name LIMIT 200`,
        params
      );
      return res.json({ items: rows, total: rows.length });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch learning paths' }); }
  });

  // Create
  app.post('/api/ontology/learning-paths', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureLearningPathSchema(pool);
      const { code, name, description, target_role_id, competency_codes, duration_weeks, difficulty = 'intermediate', delivery_mode = 'blended', sort_order = 0 } = req.body ?? {};
      if (!code || !name) return res.status(400).json({ error: 'code and name required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_learning_paths (code, name, description, target_role_id, competency_codes, duration_weeks, difficulty, delivery_mode, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [code, name, description, target_role_id || null, competency_codes || null, duration_weeks || null, difficulty, delivery_mode, sort_order]
      );
      return res.status(201).json({ item: row });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ error: 'Code already exists' });
      return res.status(500).json({ error: 'Failed to create learning path' });
    }
  });

  // Update
  app.patch('/api/ontology/learning-paths/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureLearningPathSchema(pool);
      const id = parseInt(req.params.id);
      const { name, description, target_role_id, competency_codes, duration_weeks, difficulty, delivery_mode, status, sort_order, is_active } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE ont_learning_paths SET name=COALESCE($1,name), description=COALESCE($2,description),
         target_role_id=COALESCE($3,target_role_id), competency_codes=COALESCE($4,competency_codes),
         duration_weeks=COALESCE($5,duration_weeks), difficulty=COALESCE($6,difficulty),
         delivery_mode=COALESCE($7,delivery_mode), status=COALESCE($8,status),
         sort_order=COALESCE($9,sort_order), is_active=COALESCE($10,is_active), updated_at=NOW()
         WHERE id=$11 RETURNING *`,
        [name, description, target_role_id, competency_codes, duration_weeks, difficulty, delivery_mode, status, sort_order, is_active, id]
      );
      if (!row) return res.status(404).json({ error: 'Not found' });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to update' }); }
  });

  // Delete
  app.delete('/api/ontology/learning-paths/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureLearningPathSchema(pool);
      await pool.query(`UPDATE ont_learning_paths SET status='archived', is_active=false, updated_at=NOW() WHERE id=$1`, [parseInt(req.params.id)]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to delete' }); }
  });

  // Steps — GET
  app.get('/api/ontology/learning-paths/:id/steps', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureLearningPathSchema(pool);
      const { rows } = await pool.query(`SELECT * FROM ont_learning_path_steps WHERE learning_path_id=$1 ORDER BY step_number`, [req.params.id]);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch steps' }); }
  });

  // Steps — POST
  app.post('/api/ontology/learning-paths/:id/steps', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureLearningPathSchema(pool);
      const pid = parseInt(req.params.id);
      const { title, description, step_type = 'module', duration_hours, is_required = true, resources } = req.body ?? {};
      if (!title) return res.status(400).json({ error: 'title required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_learning_path_steps (learning_path_id, step_number, title, description, step_type, duration_hours, is_required, resources)
         VALUES ($1, (SELECT COALESCE(MAX(step_number),0)+1 FROM ont_learning_path_steps WHERE learning_path_id=$1), $2,$3,$4,$5,$6,$7) RETURNING *`,
        [pid, title, description, step_type, duration_hours || null, is_required, resources ? JSON.stringify(resources) : null]
      );
      return res.status(201).json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to add step' }); }
  });

  // Steps — PATCH
  app.patch('/api/ontology/learning-paths/:id/steps/:sid', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureLearningPathSchema(pool);
      const { title, description, step_type, duration_hours, is_required, resources, step_number } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE ont_learning_path_steps SET title=COALESCE($1,title), description=COALESCE($2,description),
         step_type=COALESCE($3,step_type), duration_hours=COALESCE($4,duration_hours),
         is_required=COALESCE($5,is_required), resources=COALESCE($6,resources), step_number=COALESCE($7,step_number)
         WHERE id=$8 AND learning_path_id=$9 RETURNING *`,
        [title, description, step_type, duration_hours, is_required, resources ? JSON.stringify(resources) : null, step_number, req.params.sid, req.params.id]
      );
      if (!row) return res.status(404).json({ error: 'Not found' });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to update step' }); }
  });

  // Steps — DELETE
  app.delete('/api/ontology/learning-paths/:id/steps/:sid', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureLearningPathSchema(pool);
      await pool.query(`DELETE FROM ont_learning_path_steps WHERE id=$1 AND learning_path_id=$2`, [req.params.sid, req.params.id]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to delete step' }); }
  });
}
