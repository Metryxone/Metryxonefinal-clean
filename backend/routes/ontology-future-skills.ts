/**
 * Ontology Future Skills Routes — M16
 *
 * GET/POST/PATCH/DELETE /api/ontology/future-skills
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { logAudit } from '../services/platform-audit.js';

type Auth = (req: Request, res: Response, next: () => void) => void;

async function ensureFutureSkillsSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ont_future_skills (
      id SERIAL PRIMARY KEY, code VARCHAR(40) NOT NULL UNIQUE, name VARCHAR(180) NOT NULL,
      description TEXT,
      skill_category VARCHAR(30) NOT NULL DEFAULT 'digital',
      emergence_horizon VARCHAR(20) NOT NULL DEFAULT 'now',
      demand_trend VARCHAR(20) NOT NULL DEFAULT 'growing',
      relevance_industries TEXT[], relevance_functions TEXT[], related_competency_codes TEXT[],
      is_active BOOLEAN NOT NULL DEFAULT true, status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export function registerOntologyFutureSkillsRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {
  app.get('/api/ontology/future-skills', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureFutureSkillsSchema(pool);
      const { search = '', status = 'all', skill_category = 'all', demand_trend = 'all' } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (status !== 'all') { params.push(status); conds.push(`status = $${params.length}`); }
      if (skill_category !== 'all') { params.push(skill_category); conds.push(`skill_category = $${params.length}`); }
      if (demand_trend !== 'all') { params.push(demand_trend); conds.push(`demand_trend = $${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length} OR description ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(`SELECT * FROM ont_future_skills ${where} ORDER BY skill_category, demand_trend, name LIMIT 500`, params);
      return res.json({ items: rows, total: rows.length });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch future skills' }); }
  });

  app.post('/api/ontology/future-skills', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureFutureSkillsSchema(pool);
      const { code, name, description, skill_category = 'digital', emergence_horizon = 'now', demand_trend = 'growing', relevance_industries, relevance_functions, related_competency_codes } = req.body ?? {};
      if (!code || !name) return res.status(400).json({ error: 'code and name required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_future_skills (code, name, description, skill_category, emergence_horizon, demand_trend, relevance_industries, relevance_functions, related_competency_codes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [code, name, description, skill_category, emergence_horizon, demand_trend, relevance_industries || null, relevance_functions || null, related_competency_codes || null]
      );
      void logAudit(pool, req, { action: 'create', entityType: 'future-skill', entityId: row.id, entityLabel: `${code} — ${name}`, after: row });
      return res.status(201).json({ item: row });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ error: 'Code already exists' });
      return res.status(500).json({ error: 'Failed to create future skill' });
    }
  });

  app.patch('/api/ontology/future-skills/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureFutureSkillsSchema(pool);
      const id = parseInt(req.params.id);
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_future_skills WHERE id=$1`, [id]);
      const { name, description, skill_category, emergence_horizon, demand_trend, relevance_industries, relevance_functions, related_competency_codes, status, is_active } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE ont_future_skills SET name=COALESCE($1,name), description=COALESCE($2,description),
         skill_category=COALESCE($3,skill_category), emergence_horizon=COALESCE($4,emergence_horizon),
         demand_trend=COALESCE($5,demand_trend), relevance_industries=COALESCE($6,relevance_industries),
         relevance_functions=COALESCE($7,relevance_functions), related_competency_codes=COALESCE($8,related_competency_codes),
         status=COALESCE($9,status), is_active=COALESCE($10,is_active), updated_at=NOW()
         WHERE id=$11 RETURNING *`,
        [name, description, skill_category, emergence_horizon, demand_trend, relevance_industries, relevance_functions, related_competency_codes, status, is_active, id]
      );
      if (!row) return res.status(404).json({ error: 'Not found' });
      void logAudit(pool, req, { action: 'update', entityType: 'future-skill', entityId: id, entityLabel: row.name, before: before ?? null, after: row });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to update future skill' }); }
  });

  app.delete('/api/ontology/future-skills/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureFutureSkillsSchema(pool);
      await pool.query(`UPDATE ont_future_skills SET status='archived', is_active=false, updated_at=NOW() WHERE id=$1`, [parseInt(req.params.id)]);
      void logAudit(pool, req, { action: 'archive', entityType: 'future-skill', entityId: req.params.id });
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to delete future skill' }); }
  });
}
