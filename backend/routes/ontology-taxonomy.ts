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
import { isFlagEnabled } from '../config/feature-flags.js';
import { resolveBestOntRole, type RoleMatchType } from '../services/role-crosswalk.js';

type Auth = (req: Request, res: Response, next: () => void) => void;

/** Middleware that 503s when the Ontology Hierarchy Completion flag is off. */
const hierarchyGate: Auth = (_req, res, next) => {
  if (!isFlagEnabled('ontologyHierarchyV2')) {
    return res.status(503).json({ error: 'Ontology hierarchy completion is not enabled' });
  }
  next();
};

/** Match method → confidence band for the persisted role crosswalk. */
const MATCH_CONFIDENCE: Record<string, string> = {
  code: 'high',
  exact_title: 'high',
  alias: 'medium',
  partial_title: 'low',
};

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

/**
 * Additive schema for the Ontology Hierarchy Completion phase (Task #51).
 * Mirrors migration `20260622_ontology_hierarchy_completion.sql` (no runner).
 *
 * Only ever invoked from behind `hierarchyGate`, so when the flag is off the
 * DDL never runs and existing endpoints/panels are byte-identical to legacy
 * (no new tables, no `sector_id` column on `ont_industries`).
 *
 * Calls `ensureTaxonomySchema` first so the parent tables it references
 * (`ont_industries`, `ont_roles`) exist before the FKs are added.
 */
export async function ensureHierarchySchema(pool: Pool) {
  await ensureTaxonomySchema(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ont_sectors (
      id SERIAL PRIMARY KEY, code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
      description TEXT, is_active BOOLEAN NOT NULL DEFAULT true,
      status VARCHAR(20) NOT NULL DEFAULT 'draft', sort_order INTEGER NOT NULL DEFAULT 0,
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE ont_industries ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES ont_sectors(id) ON DELETE SET NULL;
    CREATE TABLE IF NOT EXISTS ont_industry_segments (
      id SERIAL PRIMARY KEY, code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
      description TEXT, industry_id INTEGER REFERENCES ont_industries(id) ON DELETE SET NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      status VARCHAR(20) NOT NULL DEFAULT 'draft', sort_order INTEGER NOT NULL DEFAULT 0,
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS map_ont_onto_role (
      id SERIAL PRIMARY KEY,
      onto_role_id TEXT NOT NULL UNIQUE,
      ont_role_id INTEGER REFERENCES ont_roles(id) ON DELETE SET NULL,
      ont_role_code VARCHAR(30),
      match_method VARCHAR(20) NOT NULL DEFAULT 'manual',
      confidence VARCHAR(10) NOT NULL DEFAULT 'medium',
      verified BOOLEAN NOT NULL DEFAULT false,
      notes TEXT,
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_map_ont_onto_role_ont ON map_ont_onto_role(ont_role_id);
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
  opts: { gate?: Auth; ensure?: (pool: Pool) => Promise<void> } = {},
) {
  const ensure = opts.ensure ?? ensureTaxonomySchema;
  const guards: Auth[] = opts.gate ? [opts.gate, requireAuth, requireSuperAdmin] : [requireAuth, requireSuperAdmin];
  // GET list
  app.get(`/api/ontology/${base}`, ...guards, async (req: Request, res: Response) => {
    try {
      await ensure(pool);
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
  app.post(`/api/ontology/${base}`, ...guards, async (req: Request, res: Response) => {
    try {
      await ensure(pool);
      const body = req.body ?? {};
      const cols = writableFields.filter(f => f in body);
      // Primary label column is `title` for entities that have one (e.g. ont_roles), else `name`.
      const nameCol = writableFields.includes('title') ? 'title' : 'name';
      if (!body[nameCol]) return res.status(400).json({ error: `${nameCol} is required` });
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
  app.post(`/api/ontology/${base}/import`, ...guards, async (req: Request, res: Response) => {
    try {
      await ensure(pool);
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
  app.patch(`/api/ontology/${base}/:id`, ...guards, async (req: Request, res: Response) => {
    try {
      await ensure(pool);
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
  app.delete(`/api/ontology/${base}/:id`, ...guards, async (req: Request, res: Response) => {
    try {
      await ensure(pool);
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
  const SECTOR_FIELDS = ['code','name','description','is_active','status','sort_order'];
  const SEG_FIELDS    = ['code','name','description','industry_id','is_active','status','sort_order'];

  // Flag-gated industries LIST override — adds sector_id (via SELECT *) + sector_name join.
  // Registered BEFORE buildCrud('industries') so it wins when the flag is ON; when OFF,
  // it calls next() and the original buildCrud handler responds (byte-identical to legacy).
  app.get('/api/ontology/industries', requireAuth, requireSuperAdmin, (req: Request, res: Response, next) => {
    if (!isFlagEnabled('ontologyHierarchyV2')) return next();
    void (async () => {
      try {
        await ensureHierarchySchema(pool);
        const { search = '', status = 'all', page = '1', limit = '100' } = req.query as Record<string, string>;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const params: unknown[] = [];
        const conds: string[] = [];
        if (status !== 'all') { params.push(status); conds.push(`i.status = $${params.length}`); }
        if (search.trim()) { params.push(`%${search.trim()}%`); const p = params.length; conds.push(`(i.name ILIKE $${p} OR i.code ILIKE $${p} OR i.parent_sector ILIKE $${p})`); }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const { rows } = await pool.query(
          `SELECT i.*, s.name AS sector_name FROM ont_industries i LEFT JOIN ont_sectors s ON s.id = i.sector_id ${where} ORDER BY i.sort_order ASC, i.name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, parseInt(limit), offset]
        );
        const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*)::int AS count FROM ont_industries i ${where}`, params);
        return res.json({ items: rows, total: count });
      } catch (err) {
        console.error('[ontology/industries] sector GET error:', err);
        return res.status(500).json({ error: 'Failed to fetch' });
      }
    })();
  });

  buildCrud(app, pool, requireAuth, requireSuperAdmin, 'ont_industries',    'industries',    ['name','code','parent_sector'], IND_FIELDS);
  buildCrud(app, pool, requireAuth, requireSuperAdmin, 'ont_functions',     'functions',     ['name','code'],                 FN_FIELDS);
  buildCrud(app, pool, requireAuth, requireSuperAdmin, 'ont_departments',   'departments',   ['name','code'],                 DEPT_FIELDS);
  buildCrud(app, pool, requireAuth, requireSuperAdmin, 'ont_role_families', 'role-families', ['name','code'],                 RF_FIELDS);
  // GET /api/ontology/roles — registered BEFORE the buildCrud('ont_roles') call below so
  // THIS handler wins the route match. ont_roles has no `name` column (it uses `title`),
  // so buildCrud's generic `ORDER BY sort_order, name` GET 500s against it; we only want
  // buildCrud's POST/PATCH/DELETE for roles, never its GET.
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
  // buildCrud AFTER the custom GET above: provides POST/PATCH/DELETE for roles; its
  // generic GET is shadowed by (and must stay after) the custom title-ordered handler.
  buildCrud(app, pool, requireAuth, requireSuperAdmin, 'ont_roles',         'roles',         ['title','code'],                ROLE_FIELDS);

  // ── Ontology Hierarchy Completion (Task #51) — all flag-gated via hierarchyGate ──
  buildCrud(app, pool, requireAuth, requireSuperAdmin, 'ont_sectors',          'sectors',           ['name','code'], SECTOR_FIELDS, { gate: hierarchyGate, ensure: ensureHierarchySchema });
  buildCrud(app, pool, requireAuth, requireSuperAdmin, 'ont_industry_segments','industry-segments', ['name','code'], SEG_FIELDS,    { gate: hierarchyGate, ensure: ensureHierarchySchema });

  // PATCH industry → sector assignment (distinct segment depth from /:id, so no collision).
  app.patch('/api/ontology/industries/:id/sector', hierarchyGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureHierarchySchema(pool);
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const raw = (req.body ?? {}).sector_id;
      const sid = raw === null || raw === undefined || raw === '' ? null : parseInt(String(raw));
      if (sid !== null && isNaN(sid)) return res.status(400).json({ error: 'Invalid sector_id' });
      const { rows: [row] } = await pool.query(
        `UPDATE ont_industries SET sector_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [sid, id]);
      if (!row) return res.status(404).json({ error: 'Not found' });
      void logAudit(pool, req, { action: 'update', entityType: 'industries', entityId: id, entityLabel: row.name ?? null, after: row });
      return res.json({ item: row });
    } catch (err) {
      console.error('[ontology/industries/:id/sector] error:', err);
      return res.status(500).json({ error: 'Failed to update sector' });
    }
  });

  // GET role crosswalk — every active onto_role with its persisted ont_role mapping (if any).
  app.get('/api/ontology/role-crosswalk', hierarchyGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureHierarchySchema(pool);
      const { search = '', mapped = 'all', page = '1', limit = '100' } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const conds: string[] = ['(o.deprecated IS NULL OR o.deprecated = false)'];
      if (search.trim()) { params.push(`%${search.trim()}%`); const p = params.length; conds.push(`(o.title ILIKE $${p} OR o.id ILIKE $${p})`); }
      if (mapped === 'mapped')   conds.push('m.ont_role_id IS NOT NULL');
      if (mapped === 'unmapped') conds.push('m.ont_role_id IS NULL');
      if (mapped === 'verified') conds.push('m.verified = true');
      const where = `WHERE ${conds.join(' AND ')}`;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const { rows } = await pool.query(
        `SELECT o.id AS onto_role_id, o.title AS onto_title,
                m.ont_role_id, m.ont_role_code, m.match_method, m.confidence, m.verified, m.notes,
                r.title AS ont_title, r.code AS ont_code
         FROM onto_roles o
         LEFT JOIN map_ont_onto_role m ON m.onto_role_id = o.id
         LEFT JOIN ont_roles r ON r.id = m.ont_role_id
         ${where}
         ORDER BY (m.ont_role_id IS NOT NULL) ASC, o.title ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), offset]
      );
      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM onto_roles o LEFT JOIN map_ont_onto_role m ON m.onto_role_id = o.id ${where}`, params);
      return res.json({ items: rows, total: count });
    } catch (err) {
      console.error('[role-crosswalk] GET error:', err);
      return res.status(500).json({ error: 'Failed to fetch crosswalk' });
    }
  });

  // POST manual crosswalk override (verified mapping or explicit clear).
  app.post('/api/ontology/role-crosswalk/override', hierarchyGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureHierarchySchema(pool);
      const { onto_role_id, ont_role_id, verified, notes } = req.body ?? {};
      if (!onto_role_id || typeof onto_role_id !== 'string') return res.status(400).json({ error: 'onto_role_id is required' });
      const ontId = ont_role_id === null || ont_role_id === undefined || ont_role_id === '' ? null : parseInt(String(ont_role_id));
      if (ontId !== null && isNaN(ontId)) return res.status(400).json({ error: 'Invalid ont_role_id' });
      const { rowCount: ontoOk } = await pool.query('SELECT 1 FROM onto_roles WHERE id = $1', [onto_role_id]);
      if (!ontoOk) return res.status(404).json({ error: 'onto_role not found' });
      let code: string | null = null;
      if (ontId !== null) {
        const { rows: [r] } = await pool.query('SELECT code FROM ont_roles WHERE id = $1', [ontId]);
        if (!r) return res.status(404).json({ error: 'ont_role not found' });
        code = r.code;
      }
      const isVerified = verified === true || verified === 'true';
      const confidence = isVerified ? 'high' : 'medium';
      const { rows: [row] } = await pool.query(
        `INSERT INTO map_ont_onto_role (onto_role_id, ont_role_id, ont_role_code, match_method, confidence, verified, notes, updated_at)
         VALUES ($1,$2,$3,'manual',$4,$5,$6,NOW())
         ON CONFLICT (onto_role_id) DO UPDATE SET ont_role_id = EXCLUDED.ont_role_id, ont_role_code = EXCLUDED.ont_role_code,
           match_method = 'manual', confidence = EXCLUDED.confidence, verified = EXCLUDED.verified, notes = EXCLUDED.notes, updated_at = NOW()
         RETURNING *`,
        [onto_role_id, ontId, code, confidence, isVerified, notes ?? null]);
      void logAudit(pool, req, { action: 'update', entityType: 'role-crosswalk', entityId: 0, entityLabel: onto_role_id, after: row });
      return res.json({ item: row });
    } catch (err) {
      console.error('[role-crosswalk/override] error:', err);
      return res.status(500).json({ error: 'Failed to save override' });
    }
  });

  // POST re-suggest — seed/refresh non-verified mappings from the runtime title matcher.
  // Never overwrites a human-verified row. Writes to the live DB → explicit admin action only.
  app.post('/api/ontology/role-crosswalk/resuggest', hierarchyGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureHierarchySchema(pool);
      const { rows: ontoRoles } = await pool.query(
        `SELECT id, title FROM onto_roles WHERE (deprecated IS NULL OR deprecated = false)`);
      let suggested = 0, cleared = 0, skipped = 0;
      for (const r of ontoRoles) {
        const { rows: [existing] } = await pool.query('SELECT verified FROM map_ont_onto_role WHERE onto_role_id = $1', [r.id]);
        if (existing?.verified) { skipped++; continue; }
        const match = await resolveBestOntRole(pool, r.title);
        if (!match) {
          await pool.query(
            `INSERT INTO map_ont_onto_role (onto_role_id, ont_role_id, ont_role_code, match_method, confidence, verified, updated_at)
             VALUES ($1, NULL, NULL, 'unresolved', 'low', false, NOW())
             ON CONFLICT (onto_role_id) DO UPDATE SET ont_role_id = NULL, ont_role_code = NULL, match_method = 'unresolved', confidence = 'low', updated_at = NOW()`,
            [r.id]);
          cleared++;
          continue;
        }
        const confidence = MATCH_CONFIDENCE[match.matchType] ?? 'low';
        await pool.query(
          `INSERT INTO map_ont_onto_role (onto_role_id, ont_role_id, ont_role_code, match_method, confidence, verified, updated_at)
           VALUES ($1,$2,$3,$4,$5,false,NOW())
           ON CONFLICT (onto_role_id) DO UPDATE SET ont_role_id = EXCLUDED.ont_role_id, ont_role_code = EXCLUDED.ont_role_code,
             match_method = EXCLUDED.match_method, confidence = EXCLUDED.confidence, updated_at = NOW()`,
          [r.id, match.id, match.code, match.matchType, confidence]);
        suggested++;
      }
      void logAudit(pool, req, { action: 'resuggest', entityType: 'role-crosswalk', entityId: 0, entityLabel: `suggested ${suggested}, cleared ${cleared}, skipped ${skipped}` });
      return res.json({ total: ontoRoles.length, suggested, cleared, skipped });
    } catch (err) {
      console.error('[role-crosswalk/resuggest] error:', err);
      return res.status(500).json({ error: 'Resuggest failed' });
    }
  });

  // POST backfill sectors from the existing free-text parent_sector values. Writes to the
  // live DB → explicit admin action only; never auto-invoked and never reached on a GET.
  app.post('/api/ontology/sectors/backfill-from-industries', hierarchyGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureHierarchySchema(pool);
      const { rows: sectorsRaw } = await pool.query(
        `SELECT DISTINCT TRIM(parent_sector) AS name FROM ont_industries WHERE parent_sector IS NOT NULL AND TRIM(parent_sector) <> ''`);
      let createdSectors = 0, linkedIndustries = 0;
      for (const s of sectorsRaw) {
        const name = s.name as string;
        const code = (name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30)) || 'SECTOR';
        const ins = await pool.query(
          `INSERT INTO ont_sectors (code, name, status, is_active) VALUES ($1,$2,'published',true)
           ON CONFLICT (code) DO NOTHING RETURNING id`, [code, name]);
        if (ins.rowCount) createdSectors++;
        const { rows: [sec] } = await pool.query('SELECT id FROM ont_sectors WHERE code = $1', [code]);
        if (sec) {
          const upd = await pool.query(
            `UPDATE ont_industries SET sector_id = $1, updated_at = NOW() WHERE TRIM(parent_sector) = $2 AND (sector_id IS DISTINCT FROM $1)`,
            [sec.id, name]);
          linkedIndustries += upd.rowCount ?? 0;
        }
      }
      void logAudit(pool, req, { action: 'backfill', entityType: 'sectors', entityId: 0, entityLabel: `created ${createdSectors} sectors, linked ${linkedIndustries} industries` });
      return res.json({ distinctSectors: sectorsRaw.length, createdSectors, linkedIndustries });
    } catch (err) {
      console.error('[sectors/backfill] error:', err);
      return res.status(500).json({ error: 'Backfill failed' });
    }
  });
}
