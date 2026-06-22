/**
 * Ontology Taxonomy Routes — M01 Industries · M02 Functions · M03 Departments · M04 Role Families + Roles
 *
 * GET  /api/ontology/industries          — list
 * POST /api/ontology/industries          — create
 * PATCH /api/ontology/industries/:id     — update
 * DELETE /api/ontology/industries/:id    — delete
 * (same pattern for /functions, /departments, /role-families, /roles)
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { logAudit } from '../services/platform-audit.js';

type Auth = (req: Request, res: Response, next: () => void) => void;

export async function ensureTaxonomySchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ont_industries (
      id SERIAL PRIMARY KEY, code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
      parent_sector VARCHAR(120), description TEXT, is_active BOOLEAN NOT NULL DEFAULT true,
      status VARCHAR(20) NOT NULL DEFAULT 'draft', sort_order INTEGER NOT NULL DEFAULT 0,
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ont_functions (
      id SERIAL PRIMARY KEY, code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
      description TEXT, is_cross_industry BOOLEAN NOT NULL DEFAULT false, is_active BOOLEAN NOT NULL DEFAULT true,
      status VARCHAR(20) NOT NULL DEFAULT 'draft', sort_order INTEGER NOT NULL DEFAULT 0,
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS map_industry_function (
      id SERIAL PRIMARY KEY, industry_id INTEGER NOT NULL REFERENCES ont_industries(id) ON DELETE CASCADE,
      function_id INTEGER NOT NULL REFERENCES ont_functions(id) ON DELETE CASCADE,
      is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (industry_id, function_id)
    );
    CREATE TABLE IF NOT EXISTS ont_departments (
      id SERIAL PRIMARY KEY, code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
      description TEXT, function_id INTEGER REFERENCES ont_functions(id) ON DELETE SET NULL,
      cost_centre_type VARCHAR(20), is_active BOOLEAN NOT NULL DEFAULT true,
      status VARCHAR(20) NOT NULL DEFAULT 'draft', sort_order INTEGER NOT NULL DEFAULT 0,
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ont_role_families (
      id SERIAL PRIMARY KEY, code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
      description TEXT, department_id INTEGER REFERENCES ont_departments(id) ON DELETE SET NULL,
      career_track_archetype VARCHAR(30), is_active BOOLEAN NOT NULL DEFAULT true,
      status VARCHAR(20) NOT NULL DEFAULT 'draft', sort_order INTEGER NOT NULL DEFAULT 0,
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ont_roles (
      id SERIAL PRIMARY KEY, code VARCHAR(30) NOT NULL UNIQUE, title VARCHAR(180) NOT NULL,
      role_family_id INTEGER REFERENCES ont_role_families(id) ON DELETE SET NULL,
      seniority_level VARCHAR(20) NOT NULL DEFAULT 'mid', description TEXT,
      responsibilities TEXT[], min_years_experience SMALLINT DEFAULT 0, is_leadership BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true, status VARCHAR(20) NOT NULL DEFAULT 'draft',
      sort_order INTEGER NOT NULL DEFAULT 0, created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function buildCrud(
  app: Express,
  pool: Pool,
  requireAuth: Auth,
  requireSuperAdmin: Auth,
  table: string,
  base: string,
  searchCols: string[],
  writableFields: string[],
) {
  // GET list
  app.get(`/api/ontology/${base}`, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureTaxonomySchema(pool);
      const { search = '', status = 'all', page = '1', limit = '100' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const params: unknown[] = [];
      const conditions: string[] = [];
      if (status !== 'all') { params.push(status); conditions.push(`status = $${params.length}`); }
      if (search.trim()) {
        const terms = searchCols.map(c => { params.push(`%${search.trim()}%`); return `${c} ILIKE $${params.length}`; });
        conditions.push(`(${terms.join(' OR ')})`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT * FROM ${table} ${where} ORDER BY sort_order ASC, name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), offset]
      );
      const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table} ${where}`, params);
      return res.json({ items: rows, total: count });
    } catch (err) {
      console.error(`[ontology/${base}] GET error:`, err);
      return res.status(500).json({ error: 'Failed to fetch' });
    }
  });

  // POST create
  app.post(`/api/ontology/${base}`, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureTaxonomySchema(pool);
      const body = req.body ?? {};
      const cols = writableFields.filter(f => f in body);
      if (!body.name) return res.status(400).json({ error: 'name is required' });
      if (!body.code) return res.status(400).json({ error: 'code is required' });
      const params = cols.map(f => body[f]);
      const { rows: [row] } = await pool.query(
        `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
        params
      );
      void logAudit(pool, req, { action: 'create', entityType: base, entityId: row.id, entityLabel: row.name ?? row.title ?? null, after: row });
      return res.status(201).json({ item: row });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ error: 'Code already exists' });
      console.error(`[ontology/${base}] POST error:`, err);
      return res.status(500).json({ error: 'Failed to create' });
    }
  });

  // POST bulk import (CSV-driven; upsert by code). Registered before /:id param routes.
  app.post(`/api/ontology/${base}/import`, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureTaxonomySchema(pool);
      const rowsIn = Array.isArray(req.body?.items) ? req.body.items : null;
      if (!rowsIn) return res.status(400).json({ error: 'items array required' });
      if (rowsIn.length === 0) return res.status(400).json({ error: 'No rows to import' });
      if (rowsIn.length > 1000) return res.status(400).json({ error: 'Too many rows (max 1000 per import)' });
      const nameCol = writableFields.includes('title') ? 'title' : 'name';
      const results = { total: rowsIn.length, created: 0, updated: 0, failed: 0, errors: [] as { row: number; code?: string; error: string }[] };
      for (let idx = 0; idx < rowsIn.length; idx++) {
        const raw = (rowsIn[idx] ?? {}) as Record<string, unknown>;
        const code = String(raw.code ?? '').trim().toUpperCase();
        const name = String(raw[nameCol] ?? raw.name ?? raw.title ?? '').trim();
        if (!code) { results.failed++; results.errors.push({ row: idx + 1, error: 'Missing code' }); continue; }
        if (!name) { results.failed++; results.errors.push({ row: idx + 1, code, error: `Missing ${nameCol}` }); continue; }
        const rec: Record<string, unknown> = {};
        for (const fld of writableFields) {
          if (fld === 'code') { rec.code = code; continue; }
          if (fld === nameCol) { rec[fld] = name; continue; }
          const v = raw[fld];
          if (v === undefined || v === null || v === '') continue;
          if (fld === 'is_active' || fld.startsWith('is_')) {
            rec[fld] = (v === true || ['true', '1', 'yes', 'y'].includes(String(v).toLowerCase()));
          } else if (fld === 'sort_order' || fld === 'min_years_experience' || fld.endsWith('_id')) {
            const n = parseInt(String(v), 10); if (!Number.isNaN(n)) rec[fld] = n;
          } else if (fld === 'responsibilities') {
            rec[fld] = String(v).split(/[;|]/).map(s => s.trim()).filter(Boolean);
          } else {
            rec[fld] = v;
          }
        }
        const cols = Object.keys(rec);
        const updateCols = cols.filter(c => c !== 'code');
        const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})
          ON CONFLICT (code) DO UPDATE SET ${updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = NOW()`;
        try {
          // Deterministic created-vs-updated: check existence before upsert (xmax heuristic is implementation-fragile).
          const { rowCount: exists } = await pool.query(`SELECT 1 FROM ${table} WHERE code = $1`, [code]);
          await pool.query(sql, cols.map(c => rec[c]));
          if (exists) results.updated++; else results.created++;
        } catch (e: any) {
          results.failed++;
          const msg = e?.code === '23505' ? 'Duplicate code'
            : e?.code === '23514' ? 'Invalid value (failed a check constraint)'
            : e?.code === '23502' ? 'Missing a required field'
            : e?.code === '22001' ? 'A value is too long'
            : 'Insert failed';
          results.errors.push({ row: idx + 1, code, error: msg });
        }
      }
      void logAudit(pool, req, { action: 'import', entityType: base, entityId: 0, entityLabel: `import: ${results.created} created, ${results.updated} updated, ${results.failed} failed` });
      return res.json(results);
    } catch (err) {
      console.error(`[ontology/${base}] IMPORT error:`, err);
      return res.status(500).json({ error: 'Import failed' });
    }
  });

  // PATCH update
  app.patch(`/api/ontology/${base}/:id`, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureTaxonomySchema(pool);
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const body = req.body ?? {};
      const cols = writableFields.filter(f => f in body && f !== 'code'); // code is immutable
      if (!cols.length) return res.status(400).json({ error: 'No fields to update' });
      const { rows: [before] } = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
      cols.push('updated_at');
      const params = [...cols.slice(0, -1).map(f => body[f]), new Date(), id];
      const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
      const { rows: [row] } = await pool.query(
        `UPDATE ${table} SET ${sets} WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (!row) return res.status(404).json({ error: 'Not found' });
      void logAudit(pool, req, { action: 'update', entityType: base, entityId: id, entityLabel: row.name ?? row.title ?? null, before: before ?? null, after: row });
      return res.json({ item: row });
    } catch (err) {
      console.error(`[ontology/${base}] PATCH error:`, err);
      return res.status(500).json({ error: 'Failed to update' });
    }
  });

  // DELETE
  app.delete(`/api/ontology/${base}/:id`, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureTaxonomySchema(pool);
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      await pool.query(`UPDATE ${table} SET status = 'archived', is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
      void logAudit(pool, req, { action: 'archive', entityType: base, entityId: id });
      return res.json({ ok: true });
    } catch (err) {
      console.error(`[ontology/${base}] DELETE error:`, err);
      return res.status(500).json({ error: 'Failed to delete' });
    }
  });
}

export function registerOntologyTaxonomyRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {
  const IND_FIELDS = ['code','name','parent_sector','description','is_active','status','sort_order'];
  const FN_FIELDS  = ['code','name','description','is_cross_industry','is_active','status','sort_order'];
  const DEPT_FIELDS = ['code','name','description','function_id','cost_centre_type','is_active','status','sort_order'];
  const RF_FIELDS  = ['code','name','description','department_id','career_track_archetype','is_active','status','sort_order'];
  const ROLE_FIELDS = ['code','title','role_family_id','seniority_level','description','responsibilities','min_years_experience','is_leadership','is_active','status','sort_order'];

  buildCrud(app, pool, requireAuth, requireSuperAdmin, 'ont_industries',    'industries',    ['name','code','parent_sector'], IND_FIELDS);
  buildCrud(app, pool, requireAuth, requireSuperAdmin, 'ont_functions',     'functions',     ['name','code'],                 FN_FIELDS);
  buildCrud(app, pool, requireAuth, requireSuperAdmin, 'ont_departments',   'departments',   ['name','code'],                 DEPT_FIELDS);
  buildCrud(app, pool, requireAuth, requireSuperAdmin, 'ont_role_families', 'role-families', ['name','code'],                 RF_FIELDS);
  buildCrud(app, pool, requireAuth, requireSuperAdmin, 'ont_roles',         'roles',         ['title','code'],                ROLE_FIELDS);

  // GET /api/ontology/roles - override to add role_family name join
  app.get('/api/ontology/roles', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureTaxonomySchema(pool);
      const { search = '', status = 'all', family_id = '' } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (status !== 'all') { params.push(status); conds.push(`r.status = $${params.length}`); }
      if (family_id) { params.push(parseInt(family_id)); conds.push(`r.role_family_id = $${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(r.title ILIKE $${params.length} OR r.code ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT r.*, rf.name AS role_family_name FROM ont_roles r LEFT JOIN ont_role_families rf ON rf.id = r.role_family_id ${where} ORDER BY r.seniority_level, r.title LIMIT 200`,
        params
      );
      return res.json({ items: rows, total: rows.length });
    } catch (err) {
      console.error('[ontology/roles] GET error:', err);
      return res.status(500).json({ error: 'Failed to fetch roles' });
    }
  });
}
