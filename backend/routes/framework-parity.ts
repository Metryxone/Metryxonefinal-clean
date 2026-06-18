/**
 * /app/backend/routes/framework-parity.ts
 *
 * Replicates the Professional Competency Framework architecture for LBI & SDI:
 *   • Clusters + Cluster Map
 *   • Subdomain Norms (per age-band / stage × subdomain)
 *   • Age-Band / Stage Weights
 *   • Versions (snapshots)
 *   • Learning Mappings
 *   • SDI Stages (school-stage taxonomy)
 *
 * All endpoints are admin-protected. Public mirrors via /api/{lbi|sdi}/{resource}.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';

type Auth = (req: Request, res: Response, next: NextFunction) => void;

// Helper: build PATCH SET clause from req.body
function buildSet(body: any, allowed: string[]): { sets: string[]; vals: any[] } {
  const sets: string[] = []; const vals: any[] = [];
  allowed.forEach(f => { if (body[f] !== undefined) { sets.push(`${f} = $${sets.length + 1}`); vals.push(body[f]); }});
  return { sets, vals };
}

// Generic CRUD factory — produces 4 endpoints for a (table, allowed-fields, key-field) tuple.
function crud(app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth, opts: {
  base: string;            // e.g. '/api/lbi/admin/clusters'
  publicGet?: string;      // optional public GET path
  table: string;
  fields: string[];        // updatable field list
  required: string[];      // required for create
  orderBy?: string;        // e.g. 'created_at DESC'
}) {
  // List
  const listHandler = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const r = await pool.query(`SELECT * FROM ${opts.table} ORDER BY ${opts.orderBy || 'id'}`);
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  };
  app.get(opts.base, requireAuth, requireSuperAdmin, listHandler);
  if (opts.publicGet) app.get(opts.publicGet, listHandler);

  // Create
  app.post(opts.base, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      for (const f of opts.required) if (!req.body[f]) return res.status(400).json({ error: `${f} required` });
      const cols: string[] = []; const vals: any[] = []; const ph: string[] = [];
      opts.fields.forEach(f => { if (req.body[f] !== undefined) { cols.push(f); vals.push(req.body[f]); ph.push(`$${ph.length + 1}`); }});
      const r = await pool.query(`INSERT INTO ${opts.table} (${cols.join(',')}) VALUES (${ph.join(',')}) RETURNING *`, vals);
      res.status(201).json(r.rows[0]);
    } catch (err) { next(err); }
  });

  // Update
  app.patch(`${opts.base}/:id`, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { sets, vals } = buildSet(req.body, opts.fields);
      if (sets.length === 0) return res.status(400).json({ error: 'no fields' });
      vals.push(req.params.id);
      const r = await pool.query(`UPDATE ${opts.table} SET ${sets.join(',')} WHERE id = $${vals.length} RETURNING *`, vals);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  // Delete
  app.delete(`${opts.base}/:id`, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const r = await pool.query(`DELETE FROM ${opts.table} WHERE id = $1`, [req.params.id]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });
}

export function registerFrameworkParityRoutes(app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth) {
  // ─── LBI parity ──────────────────────────────────────────────────────
  // Read-only proxy for age bands (existing table, no CRUD here — managed elsewhere)
  app.get('/api/lbi/admin/age-bands', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query('SELECT id, band_code, band_name, min_age, max_age, grade_range, status FROM lbi_age_bands ORDER BY min_age');
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  // LBI clusters — custom list includes subdomain_codes array
  const lbiClusterList = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const r = await pool.query(`
        SELECT cl.*,
          COALESCE(array_agg(m.subdomain_code) FILTER (WHERE m.subdomain_code IS NOT NULL), '{}') AS subdomain_codes
        FROM lbi_clusters cl
        LEFT JOIN lbi_cluster_map m ON m.cluster_id = cl.id
        GROUP BY cl.id ORDER BY cl.code
      `);
      res.json(r.rows);
    } catch (err: any) { if (err?.code === '42P01') return res.json([]); next(err); }
  };
  app.get('/api/lbi/admin/clusters', requireAuth, requireSuperAdmin, lbiClusterList);
  app.get('/api/lbi/clusters', lbiClusterList);
  app.post('/api/lbi/admin/clusters', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { code, name, description, is_active } = req.body || {};
      if (!code || !name) return res.status(400).json({ error: 'code and name required' });
      const r = await pool.query(
        `INSERT INTO lbi_clusters (code, name, description, is_active) VALUES ($1, $2, $3, $4) RETURNING *`,
        [code, name, description || null, is_active ?? true]
      );
      res.status(201).json({ ...r.rows[0], subdomain_codes: [] });
    } catch (err) { next(err); }
  });
  app.patch('/api/lbi/admin/clusters/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { sets, vals } = buildSet(req.body, ['code','name','description','is_active']);
      if (!sets.length) return res.status(400).json({ error: 'no fields' });
      vals.push(req.params.id);
      const r = await pool.query(`UPDATE lbi_clusters SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });
  app.delete('/api/lbi/admin/clusters/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const r = await pool.query(`DELETE FROM lbi_clusters WHERE id=$1`, [req.params.id]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  crud(app, pool, requireAuth, requireSuperAdmin, {
    base: '/api/lbi/admin/subdomain-norms',
    publicGet: '/api/lbi/subdomain-norms',
    table: 'lbi_subdomain_norms',
    fields: ['age_band_code','subdomain_code','min_score','median_score','top10_score'],
    required: ['age_band_code','subdomain_code'],
    orderBy: 'age_band_code, subdomain_code',
  });

  crud(app, pool, requireAuth, requireSuperAdmin, {
    base: '/api/lbi/admin/age-band-weights',
    publicGet: '/api/lbi/age-band-weights',
    table: 'lbi_age_band_weights',
    fields: ['age_band_code','subdomain_code','weight','weight_type'],
    required: ['age_band_code','subdomain_code'],
    orderBy: 'age_band_code, subdomain_code',
  });

  crud(app, pool, requireAuth, requireSuperAdmin, {
    base: '/api/lbi/admin/learning-mappings',
    publicGet: '/api/lbi/learning-mappings',
    table: 'lbi_learning_mappings',
    fields: ['subdomain_code','level','action_type','title','resource_link'],
    required: ['subdomain_code'],
    orderBy: 'subdomain_code, level',
  });

  // LBI versions — list + snapshot
  app.get('/api/lbi/admin/versions', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query('SELECT * FROM lbi_versions ORDER BY created_at DESC, version DESC');
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  app.post('/api/lbi/admin/versions', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const v = await pool.query('SELECT COALESCE(MAX(version), 0) + 1 AS next FROM lbi_versions');
      const nextV = v.rows[0]?.next || 1;
      const summary = await pool.query(`SELECT jsonb_build_object(
        'domains', (SELECT count(*) FROM lbi_domains),
        'subdomains', (SELECT count(*) FROM lbi_subdomains),
        'age_bands', (SELECT count(*) FROM lbi_age_bands),
        'norms', (SELECT count(*) FROM lbi_subdomain_norms),
        'weights', (SELECT count(*) FROM lbi_age_band_weights),
        'clusters', (SELECT count(*) FROM lbi_clusters),
        'learning_mappings', (SELECT count(*) FROM lbi_learning_mappings)
      ) AS s`);
      const r = await pool.query(
        `INSERT INTO lbi_versions (version, label, notes, changed_by, change_summary) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [nextV, req.body?.label || `v${nextV}.0`, req.body?.notes || null, (req as any).user?.id || null, summary.rows[0].s]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) { next(err); }
  });

  // LBI engine summary — counts only, but admin-gated to match sibling /api/lbi/admin/* routes
  app.get('/api/lbi/admin/engine-summary', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query(`SELECT
        (SELECT count(*) FROM lbi_domains)::int AS domains,
        (SELECT count(*) FROM lbi_subdomains)::int AS subdomains,
        (SELECT count(*) FROM lbi_age_bands)::int AS age_bands,
        (SELECT count(*) FROM lbi_subdomain_norms)::int AS norms,
        (SELECT count(*) FROM lbi_age_band_weights)::int AS weights,
        (SELECT count(*) FROM lbi_clusters)::int AS clusters,
        (SELECT count(*) FROM lbi_learning_mappings)::int AS learning_mappings,
        (SELECT count(*) FROM lbi_versions)::int AS versions,
        (SELECT MAX(version) FROM lbi_versions)::int AS current_version
      `);
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  // LBI cluster mapping endpoints
  app.post('/api/lbi/admin/clusters/:id/subdomains', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      await pool.query('DELETE FROM lbi_cluster_map WHERE cluster_id = $1', [req.params.id]);
      const codes: string[] = Array.isArray(req.body?.subdomain_codes) ? req.body.subdomain_codes : [];
      for (const c of codes) {
        await pool.query('INSERT INTO lbi_cluster_map (cluster_id, subdomain_code) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, c]);
      }
      res.json({ ok: true, mapped: codes.length });
    } catch (err) { next(err); }
  });
  app.get('/api/lbi/admin/clusters/:id/subdomains', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const r = await pool.query('SELECT subdomain_code FROM lbi_cluster_map WHERE cluster_id = $1', [req.params.id]);
      res.json(r.rows.map(x => x.subdomain_code));
    } catch (err) { next(err); }
  });

  // ─── LBI domain admin CRUD (targeting lbi_domains directly) ─────────
  app.get('/api/lbi/admin/domains', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query(
        `SELECT id, domain_code, domain_name, description, display_order, status
         FROM lbi_domains ORDER BY display_order, domain_code`
      );
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  app.post('/api/lbi/admin/domains', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const { domain_code, domain_name, description, display_order, status } = req.body || {};
    if (!domain_code || !domain_name) return res.status(400).json({ error: 'domain_code and domain_name required' });
    try {
      const r = await pool.query(
        `INSERT INTO lbi_domains (domain_code, domain_name, description, display_order, status) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [domain_code, domain_name, description || null, display_order ?? 99, status || 'Active']
      );
      res.status(201).json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.patch('/api/lbi/admin/domains/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const flds = ['domain_code','domain_name','description','display_order','status'];
    const sets: string[] = []; const vals: any[] = [];
    flds.forEach(f => { if (req.body[f] !== undefined) { sets.push(`${f} = $${sets.length+1}`); vals.push(req.body[f]); } });
    if (!sets.length) return res.status(400).json({ error: 'no fields' });
    vals.push(req.params.id);
    try {
      const r = await pool.query(`UPDATE lbi_domains SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.delete('/api/lbi/admin/domains/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const r = await pool.query('DELETE FROM lbi_domains WHERE id=$1', [req.params.id]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ─── LBI subdomain admin CRUD (lbi_subdomains with domain_code JOIN) ─
  app.get('/api/lbi/admin/subdomain-list', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query(
        `SELECT s.id, s.subdomain_code, s.subdomain_name, s.description, s.display_order, d.domain_code
         FROM lbi_subdomains s
         JOIN lbi_domains d ON d.id = s.domain_id
         ORDER BY d.display_order, s.display_order, s.subdomain_code`
      );
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  app.post('/api/lbi/admin/subdomain-list', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const { domain_code, subdomain_code, subdomain_name, description, display_order } = req.body || {};
    if (!domain_code || !subdomain_code || !subdomain_name)
      return res.status(400).json({ error: 'domain_code, subdomain_code and subdomain_name required' });
    try {
      const d = await pool.query('SELECT id FROM lbi_domains WHERE domain_code=$1', [domain_code]);
      if (d.rowCount === 0) return res.status(404).json({ error: `Domain not found for code: ${domain_code}` });
      const r = await pool.query(
        `INSERT INTO lbi_subdomains (domain_id, subdomain_code, subdomain_name, description, display_order) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [d.rows[0].id, subdomain_code, subdomain_name, description || null, display_order ?? 99]
      );
      res.status(201).json({ ...r.rows[0], domain_code });
    } catch (err) { next(err); }
  });

  app.patch('/api/lbi/admin/subdomain-list/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const flds = ['subdomain_code','subdomain_name','description','display_order'];
    const sets: string[] = []; const vals: any[] = [];
    flds.forEach(f => { if (req.body[f] !== undefined) { sets.push(`${f} = $${sets.length+1}`); vals.push(req.body[f]); } });
    if (!sets.length) return res.status(400).json({ error: 'no fields' });
    vals.push(req.params.id);
    try {
      const r = await pool.query(`UPDATE lbi_subdomains SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.delete('/api/lbi/admin/subdomain-list/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const r = await pool.query('DELETE FROM lbi_subdomains WHERE id=$1', [req.params.id]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ─── Competency items PATCH (pool-based since routes.ts uses Drizzle) ─
  app.patch('/api/competency/items/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const flds = ['question','item_type','difficulty','level','expected_time','is_active','code'];
    const sets: string[] = []; const vals: any[] = [];
    flds.forEach(f => { if (req.body[f] !== undefined) { sets.push(`${f} = $${sets.length+1}`); vals.push(req.body[f]); } });
    if (!sets.length) return res.status(400).json({ error: 'no fields' });
    vals.push(req.params.id);
    try {
      const r = await pool.query(`UPDATE competency_assessment_items SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  // ─── SDI parity ──────────────────────────────────────────────────────
  crud(app, pool, requireAuth, requireSuperAdmin, {
    base: '/api/sdi/admin/stages',
    publicGet: '/api/sdi/stages',
    table: 'sdi_stages',
    fields: ['stage_code','stage_name','min_grade','max_grade','description','display_order','is_active'],
    required: ['stage_code','stage_name'],
    orderBy: 'display_order, id',
  });

  // SDI clusters — custom list includes subdomain_codes array
  const sdiClusterList = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const r = await pool.query(`
        SELECT cl.*,
          COALESCE(array_agg(m.subdomain_code) FILTER (WHERE m.subdomain_code IS NOT NULL), '{}') AS subdomain_codes
        FROM sdi_clusters cl
        LEFT JOIN sdi_cluster_map m ON m.cluster_id = cl.id
        GROUP BY cl.id ORDER BY cl.code
      `);
      res.json(r.rows);
    } catch (err: any) { if (err?.code === '42P01') return res.json([]); next(err); }
  };
  app.get('/api/sdi/admin/clusters', requireAuth, requireSuperAdmin, sdiClusterList);
  app.get('/api/sdi/clusters', sdiClusterList);
  app.post('/api/sdi/admin/clusters', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { code, name, description, is_active } = req.body || {};
      if (!code || !name) return res.status(400).json({ error: 'code and name required' });
      const r = await pool.query(
        `INSERT INTO sdi_clusters (code, name, description, is_active) VALUES ($1, $2, $3, $4) RETURNING *`,
        [code, name, description || null, is_active ?? true]
      );
      res.status(201).json({ ...r.rows[0], subdomain_codes: [] });
    } catch (err) { next(err); }
  });
  app.patch('/api/sdi/admin/clusters/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { sets, vals } = buildSet(req.body, ['code','name','description','is_active']);
      if (!sets.length) return res.status(400).json({ error: 'no fields' });
      vals.push(req.params.id);
      const r = await pool.query(`UPDATE sdi_clusters SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });
  app.delete('/api/sdi/admin/clusters/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const r = await pool.query(`DELETE FROM sdi_clusters WHERE id=$1`, [req.params.id]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  crud(app, pool, requireAuth, requireSuperAdmin, {
    base: '/api/sdi/admin/subdomain-norms',
    publicGet: '/api/sdi/subdomain-norms',
    table: 'sdi_subdomain_norms',
    fields: ['stage_code','subdomain_code','min_score','median_score','top10_score'],
    required: ['stage_code','subdomain_code'],
    orderBy: 'stage_code, subdomain_code',
  });

  crud(app, pool, requireAuth, requireSuperAdmin, {
    base: '/api/sdi/admin/stage-weights',
    publicGet: '/api/sdi/stage-weights',
    table: 'sdi_stage_weights',
    fields: ['stage_code','subdomain_code','weight','weight_type'],
    required: ['stage_code','subdomain_code'],
    orderBy: 'stage_code, subdomain_code',
  });

  crud(app, pool, requireAuth, requireSuperAdmin, {
    base: '/api/sdi/admin/learning-mappings',
    publicGet: '/api/sdi/learning-mappings',
    table: 'sdi_learning_mappings',
    fields: ['subdomain_code','level','action_type','title','resource_link'],
    required: ['subdomain_code'],
    orderBy: 'subdomain_code, level',
  });

  // SDI versions
  app.get('/api/sdi/admin/versions', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query('SELECT * FROM sdi_versions ORDER BY created_at DESC, version DESC');
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  app.post('/api/sdi/admin/versions', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const v = await pool.query('SELECT COALESCE(MAX(version), 0) + 1 AS next FROM sdi_versions');
      const nextV = v.rows[0]?.next || 1;
      const summary = await pool.query(`SELECT jsonb_build_object(
        'domains', (SELECT count(*) FROM sdi_domains),
        'subdomains', (SELECT count(*) FROM sdi_subdomains),
        'stages', (SELECT count(*) FROM sdi_stages),
        'norms', (SELECT count(*) FROM sdi_subdomain_norms),
        'weights', (SELECT count(*) FROM sdi_stage_weights),
        'items', (SELECT count(*) FROM sdi_items),
        'clusters', (SELECT count(*) FROM sdi_clusters),
        'learning_mappings', (SELECT count(*) FROM sdi_learning_mappings)
      ) AS s`);
      const r = await pool.query(
        `INSERT INTO sdi_versions (version, label, notes, changed_by, change_summary) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [nextV, req.body?.label || `v${nextV}.0`, req.body?.notes || null, (req as any).user?.id || null, summary.rows[0].s]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) { next(err); }
  });

  // SDI engine summary — counts only, but admin-gated to match sibling /api/sdi/admin/* routes
  app.get('/api/sdi/admin/engine-summary', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query(`SELECT
        (SELECT count(*) FROM sdi_domains)::int AS domains,
        (SELECT count(*) FROM sdi_subdomains)::int AS subdomains,
        (SELECT count(*) FROM sdi_stages)::int AS stages,
        (SELECT count(*) FROM sdi_items)::int AS items,
        (SELECT count(*) FROM sdi_subdomain_norms)::int AS norms,
        (SELECT count(*) FROM sdi_stage_weights)::int AS weights,
        (SELECT count(*) FROM sdi_clusters)::int AS clusters,
        (SELECT count(*) FROM sdi_learning_mappings)::int AS learning_mappings,
        (SELECT count(*) FROM sdi_versions)::int AS versions,
        (SELECT MAX(version) FROM sdi_versions)::int AS current_version,
        (SELECT count(*) FROM sdi_user_responses)::int AS responses
      `);
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  // ─── GENERATE DEFAULTS: LBI norms + weights ─────────────────────────────
  app.post('/api/lbi/admin/generate-defaults', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      // These are SYNTHETIC placeholder norms (arbitrary anchors), NOT computed
      // from real responses. They are stamped source='synthetic_default' and
      // is_provisional=true so the percentile engine never treats them as a real
      // norm-referenced distribution. Use POST /api/admin/lbi/compute-norms to
      // derive genuine norms once real assessment data exists.
      const { ensureLbiNormsSchema } = await import('../services/lbi-norms-engine');
      await ensureLbiNormsSchema(pool);

      const bandsR = await pool.query('SELECT band_code, row_number() OVER (ORDER BY min_age) AS ord FROM lbi_age_bands');
      const bands = bandsR.rows;
      if (bands.length === 0) return res.status(400).json({ error: 'No age bands defined. Add age bands first.' });

      const subR = await pool.query('SELECT subdomain_code FROM lbi_subdomains');
      const subs = subR.rows;

      let normsAdded = 0, weightsAdded = 0;
      for (const b of bands) {
        const minScore = +(18 + (+b.ord) * 1.5).toFixed(1);
        const medScore = +(46 + (+b.ord) * 1.8).toFixed(1);
        const top10   = +(80 + (+b.ord) * 1.5).toFixed(1);
        for (const s of subs) {
          const nr = await pool.query(
            `INSERT INTO lbi_subdomain_norms (age_band_code, subdomain_code, min_score, median_score, top10_score, source, is_provisional)
             VALUES ($1,$2,$3,$4,$5,'synthetic_default',true) ON CONFLICT (age_band_code, subdomain_code) DO NOTHING`,
            [b.band_code, s.subdomain_code, minScore, medScore, top10]
          );
          normsAdded += nr.rowCount ?? 0;
          const wr = await pool.query(
            `INSERT INTO lbi_age_band_weights (age_band_code, subdomain_code, weight, weight_type)
             VALUES ($1,$2,1.0,'core') ON CONFLICT (age_band_code, subdomain_code) DO NOTHING`,
            [b.band_code, s.subdomain_code]
          );
          weightsAdded += wr.rowCount ?? 0;
        }
      }
      res.json({ ok: true, normsAdded, weightsAdded, bands: bands.length, subdomains: subs.length });
    } catch (err) { next(err); }
  });

  // ─── GENERATE DEFAULTS: SDI norms + weights ──────────────────────────────
  app.post('/api/sdi/admin/generate-defaults', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const stagesR = await pool.query('SELECT stage_code, display_order FROM sdi_stages ORDER BY display_order');
      const stages = stagesR.rows;
      if (stages.length === 0) return res.status(400).json({ error: 'No school stages defined. Add stages first.' });

      const subR = await pool.query('SELECT subdomain_code FROM sdi_subdomains');
      const subs = subR.rows;

      let normsAdded = 0, weightsAdded = 0;
      for (const st of stages) {
        const ord = +(st.display_order) || 1;
        const minScore = +(16 + ord * 2.0).toFixed(1);
        const medScore = +(44 + ord * 2.2).toFixed(1);
        const top10   = +(78 + ord * 1.8).toFixed(1);
        for (const s of subs) {
          const nr = await pool.query(
            `INSERT INTO sdi_subdomain_norms (stage_code, subdomain_code, min_score, median_score, top10_score)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT (stage_code, subdomain_code) DO NOTHING`,
            [st.stage_code, s.subdomain_code, minScore, medScore, top10]
          );
          normsAdded += nr.rowCount ?? 0;
          const wr = await pool.query(
            `INSERT INTO sdi_stage_weights (stage_code, subdomain_code, weight, weight_type)
             VALUES ($1,$2,1.0,'core') ON CONFLICT (stage_code, subdomain_code) DO NOTHING`,
            [st.stage_code, s.subdomain_code]
          );
          weightsAdded += wr.rowCount ?? 0;
        }
      }
      res.json({ ok: true, normsAdded, weightsAdded, stages: stages.length, subdomains: subs.length });
    } catch (err) { next(err); }
  });

  // ─── GENERATE DEFAULTS: Competency stage norms + role weights ────────────
  app.post('/api/competency/admin/generate-defaults', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const stages = [
        { stage_code: 'ENTRY',   stage_name: 'Entry Level (0–2 yrs)',    ord: 1 },
        { stage_code: 'JUNIOR',  stage_name: 'Junior (2–5 yrs)',          ord: 2 },
        { stage_code: 'MID',     stage_name: 'Mid Level (5–8 yrs)',       ord: 3 },
        { stage_code: 'SENIOR',  stage_name: 'Senior (8–12 yrs)',         ord: 4 },
        { stage_code: 'LEAD',    stage_name: 'Lead / Principal (12+ yrs)',ord: 5 },
      ];
      const roles = [
        { role_code: 'IC',    role_name: 'Individual Contributor' },
        { role_code: 'TL',    role_name: 'Team Lead' },
        { role_code: 'MGR',   role_name: 'Manager' },
        { role_code: 'SR_MGR',role_name: 'Senior Manager' },
        { role_code: 'DIR',   role_name: 'Director' },
        { role_code: 'VP',    role_name: 'Vice President' },
        { role_code: 'CXO',   role_name: 'C-Suite Executive' },
      ];
      // Get competency codes from competency_domains as a proxy if library is empty
      const compR = await pool.query(`
        SELECT COALESCE(cl.competency_number::text, cd.code) AS competency_code
        FROM (SELECT code FROM competency_domains) cd
        LEFT JOIN competency_library cl ON true
        LIMIT 0
      `);
      // Use competency_domains as fallback
      const domR = await pool.query('SELECT code AS competency_code FROM competency_domains ORDER BY display_order');
      const comps = domR.rows;

      if (comps.length === 0) return res.status(400).json({ error: 'No competency domains found. Add domains first.' });

      let normsAdded = 0, weightsAdded = 0;
      for (const st of stages) {
        for (const c of comps) {
          const nr = await pool.query(
            `INSERT INTO competency_stage_norms (stage_code, stage_name, subdomain_code, min_score, median_score, top10_score)
             VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (stage_code, subdomain_code) DO NOTHING`,
            [st.stage_code, st.stage_name, c.competency_code,
             +(20 + st.ord * 2).toFixed(1), +(45 + st.ord * 3).toFixed(1), +(78 + st.ord * 2).toFixed(1)]
          );
          normsAdded += nr.rowCount ?? 0;
        }
      }
      for (const r of roles) {
        for (const c of comps) {
          const wr = await pool.query(
            `INSERT INTO competency_role_weights (role_code, role_name, subdomain_code, weight, weight_type)
             VALUES ($1,$2,$3,1.0,'core') ON CONFLICT (role_code, subdomain_code) DO NOTHING`,
            [r.role_code, r.role_name, c.competency_code]
          );
          weightsAdded += wr.rowCount ?? 0;
        }
      }
      res.json({ ok: true, normsAdded, weightsAdded });
    } catch (err) { next(err); }
  });

  // ─── Competency stage norms CRUD ─────────────────────────────────────────
  crud(app, pool, requireAuth, requireSuperAdmin, {
    base: '/api/competency/admin/stage-norms',
    publicGet: '/api/competency/stage-norms',
    table: 'competency_stage_norms',
    fields: ['stage_code','stage_name','subdomain_code','min_score','median_score','top10_score'],
    required: ['stage_code','subdomain_code'],
    orderBy: 'stage_code, subdomain_code',
  });

  // ─── Competency role weights CRUD ────────────────────────────────────────
  crud(app, pool, requireAuth, requireSuperAdmin, {
    base: '/api/competency/admin/role-weights',
    publicGet: '/api/competency/role-weights',
    table: 'competency_role_weights',
    fields: ['role_code','role_name','subdomain_code','weight','weight_type'],
    required: ['role_code','subdomain_code'],
    orderBy: 'role_code, subdomain_code',
  });

  // SDI cluster mapping
  app.post('/api/sdi/admin/clusters/:id/subdomains', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      await pool.query('DELETE FROM sdi_cluster_map WHERE cluster_id = $1', [req.params.id]);
      const codes: string[] = Array.isArray(req.body?.subdomain_codes) ? req.body.subdomain_codes : [];
      for (const c of codes) {
        await pool.query('INSERT INTO sdi_cluster_map (cluster_id, subdomain_code) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, c]);
      }
      res.json({ ok: true, mapped: codes.length });
    } catch (err) { next(err); }
  });
  app.get('/api/sdi/admin/clusters/:id/subdomains', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const r = await pool.query('SELECT subdomain_code FROM sdi_cluster_map WHERE cluster_id = $1', [req.params.id]);
      res.json(r.rows.map(x => x.subdomain_code));
    } catch (err) { next(err); }
  });
}
