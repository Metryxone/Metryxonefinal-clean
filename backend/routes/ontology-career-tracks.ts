/**
 * Ontology Career Tracks + Career Paths Routes — M05 + M14
 *
 * M05 Career Tracks:
 *   GET/POST/PATCH/DELETE /api/ontology/career-tracks
 *
 * M14 Career Paths:
 *   GET/POST/PATCH/DELETE /api/ontology/career-paths
 *   GET/POST/DELETE       /api/ontology/career-paths/:id/milestones
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { logAudit } from '../services/platform-audit.js';

type Auth = (req: Request, res: Response, next: () => void) => void;

async function ensureCareerSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ont_career_tracks (
      id SERIAL PRIMARY KEY, code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
      description TEXT, track_type VARCHAR(20) NOT NULL DEFAULT 'ic',
      industry_id INTEGER, function_id INTEGER,
      is_active BOOLEAN NOT NULL DEFAULT true, status VARCHAR(20) NOT NULL DEFAULT 'draft',
      sort_order INTEGER NOT NULL DEFAULT 0, created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS map_career_track_role (
      id SERIAL PRIMARY KEY, career_track_id INTEGER NOT NULL REFERENCES ont_career_tracks(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL, level_in_track SMALLINT NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (career_track_id, role_id)
    );
    CREATE TABLE IF NOT EXISTS ont_career_paths (
      id SERIAL PRIMARY KEY, code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(180) NOT NULL,
      description TEXT, from_role_id INTEGER, to_role_id INTEGER,
      path_type VARCHAR(20) NOT NULL DEFAULT 'linear', typical_months SMALLINT,
      difficulty VARCHAR(10) DEFAULT 'medium',
      is_active BOOLEAN NOT NULL DEFAULT true, status VARCHAR(20) NOT NULL DEFAULT 'draft',
      sort_order INTEGER NOT NULL DEFAULT 0, created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ont_career_path_milestones (
      id SERIAL PRIMARY KEY, career_path_id INTEGER NOT NULL REFERENCES ont_career_paths(id) ON DELETE CASCADE,
      step_number SMALLINT NOT NULL, title VARCHAR(200) NOT NULL, description TEXT,
      milestone_type VARCHAR(30) DEFAULT 'skill', is_required BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export function registerOntologyCareerRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {

  // ── M05 Career Tracks ──────────────────────────────────────────────────────
  app.get('/api/ontology/career-tracks', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCareerSchema(pool);
      const { search = '', status = 'all' } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (status !== 'all') { params.push(status); conds.push(`status = $${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(`SELECT * FROM ont_career_tracks ${where} ORDER BY sort_order, name LIMIT 200`, params);
      return res.json({ items: rows, total: rows.length });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch career tracks' }); }
  });

  app.post('/api/ontology/career-tracks', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCareerSchema(pool);
      const { code, name, description, track_type = 'ic', industry_id, function_id, sort_order = 0 } = req.body ?? {};
      if (!code || !name) return res.status(400).json({ error: 'code and name required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_career_tracks (code, name, description, track_type, industry_id, function_id, sort_order, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'draft') RETURNING *`,
        [code, name, description, track_type, industry_id || null, function_id || null, sort_order]
      );
      void logAudit(pool, req, { action: 'create', entityType: 'career-track', entityId: row.id, entityLabel: `${code} — ${name}`, after: row });
      return res.status(201).json({ item: row });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ error: 'Code already exists' });
      return res.status(500).json({ error: 'Failed to create career track' });
    }
  });

  app.patch('/api/ontology/career-tracks/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCareerSchema(pool);
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_career_tracks WHERE id=$1`, [id]);
      const { name, description, track_type, industry_id, function_id, status, sort_order, is_active } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE ont_career_tracks SET name=COALESCE($1,name), description=COALESCE($2,description),
         track_type=COALESCE($3,track_type), industry_id=COALESCE($4,industry_id),
         function_id=COALESCE($5,function_id), status=COALESCE($6,status),
         sort_order=COALESCE($7,sort_order), is_active=COALESCE($8,is_active), updated_at=NOW()
         WHERE id=$9 RETURNING *`,
        [name, description, track_type, industry_id, function_id, status, sort_order, is_active, id]
      );
      if (!row) return res.status(404).json({ error: 'Not found' });
      void logAudit(pool, req, { action: 'update', entityType: 'career-track', entityId: id, entityLabel: row.name, before: before ?? null, after: row });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to update' }); }
  });

  app.delete('/api/ontology/career-tracks/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCareerSchema(pool);
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      await pool.query(`UPDATE ont_career_tracks SET status='archived', is_active=false, updated_at=NOW() WHERE id=$1`, [id]);
      void logAudit(pool, req, { action: 'archive', entityType: 'career-track', entityId: id });
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to delete' }); }
  });

  // ── M14 Career Paths ──────────────────────────────────────────────────────
  app.get('/api/ontology/career-paths', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCareerSchema(pool);
      const { search = '', status = 'all' } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (status !== 'all') { params.push(status); conds.push(`p.status = $${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(p.name ILIKE $${params.length} OR p.code ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT p.*,
           fr.title AS from_role_title, tr.title AS to_role_title,
           (SELECT COUNT(*) FROM ont_career_path_milestones WHERE career_path_id = p.id)::int AS milestone_count
         FROM ont_career_paths p
         LEFT JOIN ont_roles fr ON fr.id = p.from_role_id
         LEFT JOIN ont_roles tr ON tr.id = p.to_role_id
         ${where} ORDER BY p.sort_order, p.name LIMIT 200`,
        params
      );
      return res.json({ items: rows, total: rows.length });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch career paths' }); }
  });

  app.post('/api/ontology/career-paths', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCareerSchema(pool);
      const { code, name, description, from_role_id, to_role_id, path_type = 'linear', typical_months, difficulty = 'medium', sort_order = 0 } = req.body ?? {};
      if (!code || !name) return res.status(400).json({ error: 'code and name required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_career_paths (code, name, description, from_role_id, to_role_id, path_type, typical_months, difficulty, sort_order, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft') RETURNING *`,
        [code, name, description, from_role_id || null, to_role_id || null, path_type, typical_months || null, difficulty, sort_order]
      );
      void logAudit(pool, req, { action: 'create', entityType: 'career-path', entityId: row.id, entityLabel: `${code} — ${name}`, after: row });
      return res.status(201).json({ item: row });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ error: 'Code already exists' });
      return res.status(500).json({ error: 'Failed to create career path' });
    }
  });

  app.patch('/api/ontology/career-paths/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCareerSchema(pool);
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_career_paths WHERE id=$1`, [id]);
      const { name, description, from_role_id, to_role_id, path_type, typical_months, difficulty, status, sort_order, is_active } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE ont_career_paths SET name=COALESCE($1,name), description=COALESCE($2,description),
         from_role_id=COALESCE($3,from_role_id), to_role_id=COALESCE($4,to_role_id),
         path_type=COALESCE($5,path_type), typical_months=COALESCE($6,typical_months),
         difficulty=COALESCE($7,difficulty), status=COALESCE($8,status),
         sort_order=COALESCE($9,sort_order), is_active=COALESCE($10,is_active), updated_at=NOW()
         WHERE id=$11 RETURNING *`,
        [name, description, from_role_id, to_role_id, path_type, typical_months, difficulty, status, sort_order, is_active, id]
      );
      if (!row) return res.status(404).json({ error: 'Not found' });
      void logAudit(pool, req, { action: 'update', entityType: 'career-path', entityId: id, entityLabel: row.name, before: before ?? null, after: row });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to update' }); }
  });

  app.delete('/api/ontology/career-paths/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCareerSchema(pool);
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      await pool.query(`UPDATE ont_career_paths SET status='archived', is_active=false, updated_at=NOW() WHERE id=$1`, [id]);
      void logAudit(pool, req, { action: 'archive', entityType: 'career-path', entityId: id });
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to delete' }); }
  });

  // Milestones
  app.get('/api/ontology/career-paths/:id/milestones', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCareerSchema(pool);
      const id = parseInt(req.params.id);
      const { rows } = await pool.query(`SELECT * FROM ont_career_path_milestones WHERE career_path_id=$1 ORDER BY step_number`, [id]);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch milestones' }); }
  });

  app.post('/api/ontology/career-paths/:id/milestones', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCareerSchema(pool);
      const id = parseInt(req.params.id);
      const { step_number, title, description, milestone_type = 'skill', is_required = true } = req.body ?? {};
      if (!title) return res.status(400).json({ error: 'title required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_career_path_milestones (career_path_id, step_number, title, description, milestone_type, is_required)
         VALUES ($1, COALESCE($2, (SELECT COALESCE(MAX(step_number),0)+1 FROM ont_career_path_milestones WHERE career_path_id=$1)), $3, $4, $5, $6) RETURNING *`,
        [id, step_number || null, title, description, milestone_type, is_required]
      );
      return res.status(201).json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to add milestone' }); }
  });

  app.delete('/api/ontology/career-paths/:id/milestones/:mid', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCareerSchema(pool);
      await pool.query(`DELETE FROM ont_career_path_milestones WHERE id=$1 AND career_path_id=$2`, [req.params.mid, req.params.id]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to delete milestone' }); }
  });
}
