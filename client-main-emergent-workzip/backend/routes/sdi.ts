/**
 * /app/backend/routes/sdi.ts
 * Student Development Index (SDI) — full CRUD + assessment items.
 * Mounted at /api/sdi by registerRoutes() in routes.ts.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';

type Auth = (req: Request, res: Response, next: NextFunction) => void;

export function registerSdiRoutes(app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth) {
  // ─── Domains ──────────────────────────────────────────────────────────
  app.get('/api/sdi/admin/domains', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query(
        `SELECT id, domain_code, domain_name, description, icon_key, color, category,
                weightage, display_order, status, is_active, created_at, updated_at
         FROM sdi_domains ORDER BY display_order ASC, id ASC`
      );
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  app.get('/api/sdi/domains', async (_req, res, next) => {
    try {
      const r = await pool.query(
        `SELECT id, domain_code, domain_name, description, icon_key, color, category, display_order
         FROM sdi_domains WHERE is_active = true ORDER BY display_order ASC`
      );
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  app.post('/api/sdi/admin/domains', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const { domain_code, domain_name, description, icon_key, color, category, weightage, display_order, is_active } = req.body || {};
    if (!domain_code || !domain_name) return res.status(400).json({ error: 'domain_code and domain_name required' });
    try {
      const r = await pool.query(
        `INSERT INTO sdi_domains (domain_code, domain_name, description, icon_key, color, category, weightage, display_order, status, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [domain_code, domain_name, description || null, icon_key || 'Layers', color || '#344E86',
         category || null, weightage ?? 1, display_order ?? 99,
         (is_active === false) ? 'Inactive' : 'Active', is_active !== false]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.patch('/api/sdi/admin/domains/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const fields = ['domain_code','domain_name','description','icon_key','color','category','weightage','display_order','status','is_active'];
    const sets: string[] = []; const vals: any[] = [];
    fields.forEach(f => { if (req.body[f] !== undefined) { sets.push(`${f} = $${sets.length+1}`); vals.push(req.body[f]); }});
    if (sets.length === 0) return res.status(400).json({ error: 'no fields' });
    vals.push(req.params.id);
    try {
      const r = await pool.query(`UPDATE sdi_domains SET ${sets.join(', ')}, updated_at=now() WHERE id=$${vals.length} RETURNING *`, vals);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.delete('/api/sdi/admin/domains/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const r = await pool.query('DELETE FROM sdi_domains WHERE id=$1', [req.params.id]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ─── Subdomains ───────────────────────────────────────────────────────
  app.get('/api/sdi/subdomains', async (req, res, next) => {
    try {
      const dc = req.query.domain_code as string | undefined;
      const r = await pool.query(
        dc
          ? `SELECT id, domain_code, subdomain_code, subdomain_name, description, display_order, is_active
             FROM sdi_subdomains WHERE domain_code = $1 ORDER BY display_order, id`
          : `SELECT id, domain_code, subdomain_code, subdomain_name, description, display_order, is_active
             FROM sdi_subdomains ORDER BY domain_code, display_order, id`,
        dc ? [dc] : []
      );
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  app.post('/api/sdi/admin/subdomains', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const { domain_code, subdomain_code, subdomain_name, description, display_order, is_active } = req.body || {};
    if (!domain_code || !subdomain_code || !subdomain_name) {
      return res.status(400).json({ error: 'domain_code, subdomain_code, subdomain_name required' });
    }
    try {
      const r = await pool.query(
        `INSERT INTO sdi_subdomains (domain_code, subdomain_code, subdomain_name, description, display_order, is_active)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [domain_code, subdomain_code, subdomain_name, description || null, display_order ?? 99, is_active !== false]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.patch('/api/sdi/admin/subdomains/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const fields = ['subdomain_code','subdomain_name','description','display_order','is_active'];
    const sets: string[] = []; const vals: any[] = [];
    fields.forEach(f => { if (req.body[f] !== undefined) { sets.push(`${f} = $${sets.length+1}`); vals.push(req.body[f]); }});
    if (sets.length === 0) return res.status(400).json({ error: 'no fields' });
    vals.push(req.params.id);
    try {
      const r = await pool.query(`UPDATE sdi_subdomains SET ${sets.join(', ')}, updated_at=now() WHERE id=$${vals.length} RETURNING *`, vals);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.delete('/api/sdi/admin/subdomains/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const r = await pool.query('DELETE FROM sdi_subdomains WHERE id=$1', [req.params.id]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ─── Items ────────────────────────────────────────────────────────────
  app.get('/api/sdi/items', async (req, res, next) => {
    try {
      const sub = req.query.subdomain_code as string | undefined;
      const r = await pool.query(
        sub
          ? `SELECT i.*, COALESCE(json_agg(json_build_object('id',o.id,'option_text',o.text,'score_value',o.score_value,'display_order',o.display_order) ORDER BY o.display_order) FILTER (WHERE o.id IS NOT NULL), '[]'::json) AS options
             FROM sdi_items i LEFT JOIN sdi_item_options o ON o.item_id = i.id
             WHERE i.subdomain_code = $1 GROUP BY i.id ORDER BY i.created_at, i.id`
          : `SELECT i.*, COALESCE(json_agg(json_build_object('id',o.id,'option_text',o.text,'score_value',o.score_value,'display_order',o.display_order) ORDER BY o.display_order) FILTER (WHERE o.id IS NOT NULL), '[]'::json) AS options
             FROM sdi_items i LEFT JOIN sdi_item_options o ON o.item_id = i.id
             GROUP BY i.id ORDER BY i.subdomain_code, i.created_at, i.id`,
        sub ? [sub] : []
      );
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  app.post('/api/sdi/admin/items', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const { subdomain_code, item_code, item_type, difficulty, question, expected_time, scoring_type, language_code, options } = req.body || {};
    if (!subdomain_code || !item_code || !question) return res.status(400).json({ error: 'subdomain_code, item_code, question required' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `INSERT INTO sdi_items (subdomain_code, item_code, item_type, difficulty, question, expected_time, scoring_type, language_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [subdomain_code, item_code, item_type || 'likert5', difficulty ?? 3, question, expected_time ?? 30, scoring_type || 'auto', language_code || 'en']
      );
      const item = r.rows[0];
      // Insert options if provided. Default likert5 options when missing.
      const opts = (Array.isArray(options) && options.length ? options : [
        { option_text: 'Strongly disagree', score_value: 0 },
        { option_text: 'Disagree',          score_value: 25 },
        { option_text: 'Neutral',           score_value: 50 },
        { option_text: 'Agree',             score_value: 75 },
        { option_text: 'Strongly agree',    score_value: 100 },
      ]);
      for (let i = 0; i < opts.length; i++) {
        const o = opts[i];
        await client.query(
          `INSERT INTO sdi_item_options (item_id, text, score_value, display_order) VALUES ($1,$2,$3,$4)`,
          [item.id, o.option_text || o.text || `Option ${i+1}`, Number(o.score_value) || 0, o.display_order ?? i]
        );
      }
      await client.query('COMMIT');
      const full = await pool.query(
        `SELECT i.*, COALESCE(json_agg(json_build_object('id',o.id,'option_text',o.text,'score_value',o.score_value,'display_order',o.display_order) ORDER BY o.display_order) FILTER (WHERE o.id IS NOT NULL), '[]'::json) AS options
         FROM sdi_items i LEFT JOIN sdi_item_options o ON o.item_id = i.id
         WHERE i.id = $1 GROUP BY i.id`, [item.id]
      );
      res.status(201).json(full.rows[0]);
    } catch (err) { await client.query('ROLLBACK'); next(err); } finally { client.release(); }
  });

  app.patch('/api/sdi/admin/items/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const flds = ['subdomain_code','item_code','item_type','difficulty','question','expected_time','scoring_type','language_code','is_active'];
    const sets: string[] = []; const vals: any[] = [];
    flds.forEach(f => { if (req.body[f] !== undefined) { sets.push(`${f} = $${sets.length+1}`); vals.push(req.body[f]); } });
    if (!sets.length) return res.status(400).json({ error: 'no fields' });
    vals.push(req.params.id);
    try {
      const r = await pool.query(`UPDATE sdi_items SET ${sets.join(', ')}, updated_at=now() WHERE id=$${vals.length} RETURNING *`, vals);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.delete('/api/sdi/admin/items/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const r = await pool.query('DELETE FROM sdi_items WHERE id=$1', [req.params.id]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ─── Scoring & Reports tabs (mirrors LBI architecture) ───────────────

  app.get('/api/sdi/admin/scoring-rules', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query(`
        SELECT
          sd.id,
          sd.subdomain_code,
          sd.subdomain_name,
          sd.domain_code,
          d.domain_name,
          d.category,
          CASE d.category
            WHEN 'Academic'        THEN 'ACADEMIC'
            WHEN 'Social-Emotional' THEN 'SOCIAL'
            WHEN 'Wellness'        THEN 'WELLNESS'
            ELSE 'GROWTH'
          END AS report_type_code,
          'mean'  AS calculation_type,
          20      AS max_score,
          '{"needs_attention":40,"developing":60,"proficient":80,"advanced":100}'::jsonb AS cutoffs,
          false   AS is_anchor_subdomain,
          CASE WHEN sd.is_active THEN 'Active' ELSE 'Inactive' END AS status
        FROM sdi_subdomains sd
        JOIN sdi_domains d ON d.domain_code = sd.domain_code
        ORDER BY d.display_order, sd.subdomain_code
      `);
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  app.get('/api/sdi/admin/report-types', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query(`
        SELECT
          type_code,
          MAX(type_name)        AS type_name,
          MAX(description)      AS description,
          SUM(subdomain_count)::int AS subdomain_count,
          0                     AS anchor_subdomain_count
        FROM (
          SELECT
            CASE d.category
              WHEN 'Academic'         THEN 'ACADEMIC'
              WHEN 'Social-Emotional' THEN 'SOCIAL'
              WHEN 'Wellness'         THEN 'WELLNESS'
              ELSE 'GROWTH'
            END AS type_code,
            CASE d.category
              WHEN 'Academic'         THEN 'Academic Development'
              WHEN 'Social-Emotional' THEN 'Social & Emotional'
              WHEN 'Wellness'         THEN 'Wellness & Health'
              ELSE 'Growth & Character'
            END AS type_name,
            CASE d.category
              WHEN 'Academic'         THEN 'Cognitive, language, mathematical and scientific reasoning capabilities'
              WHEN 'Social-Emotional' THEN 'Emotional intelligence, social skills and leadership formation'
              WHEN 'Wellness'         THEN 'Physical health awareness and holistic well-being'
              ELSE 'Life skills, values, digital literacy, creative and entrepreneurial growth'
            END AS description,
            COUNT(DISTINCT sd.id) AS subdomain_count,
            MIN(d.display_order)  AS sort_order
          FROM sdi_domains d
          LEFT JOIN sdi_subdomains sd ON sd.domain_code = d.domain_code AND sd.is_active = true
          GROUP BY d.category
        ) t
        GROUP BY type_code
        ORDER BY MIN(sort_order)
      `);
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  app.get('/api/sdi/admin/report-types/:code/subdomains', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const code = req.params.code;
    const catCondition = code === 'ACADEMIC'  ? `d.category = 'Academic'`
                       : code === 'SOCIAL'    ? `d.category = 'Social-Emotional'`
                       : code === 'WELLNESS'  ? `d.category = 'Wellness'`
                       : `d.category NOT IN ('Academic','Social-Emotional','Wellness')`;
    try {
      const r = await pool.query(`
        SELECT
          sd.subdomain_code, sd.subdomain_name, sd.domain_code, d.domain_name,
          false AS is_anchor_subdomain, 0 AS anchor_item_count
        FROM sdi_subdomains sd
        JOIN sdi_domains d ON d.domain_code = sd.domain_code
        WHERE ${catCondition} AND sd.is_active = true
        ORDER BY d.display_order, sd.subdomain_code
      `);
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  app.get('/api/sdi/admin/cluster-correlations', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query(`
        SELECT
          cl.id,
          cl.code        AS cluster_code,
          cl.name        AS cluster_name,
          cl.description AS cluster_description,
          COALESCE(
            json_agg(
              json_build_object(
                'subdomain_code',   sd.subdomain_code,
                'subdomain_name',   sd.subdomain_name,
                'domain_code',      sd.domain_code,
                'report_type_code', CASE d.category
                  WHEN 'Academic'         THEN 'ACADEMIC'
                  WHEN 'Social-Emotional' THEN 'SOCIAL'
                  WHEN 'Wellness'         THEN 'WELLNESS'
                  ELSE 'GROWTH'
                END,
                'is_anchor', false
              ) ORDER BY sd.subdomain_code
            ) FILTER (WHERE sd.id IS NOT NULL), '[]'
          ) AS subdomains
        FROM sdi_clusters cl
        LEFT JOIN sdi_cluster_map m  ON m.cluster_id = cl.id
        LEFT JOIN sdi_subdomains sd  ON sd.subdomain_code = m.subdomain_code
        LEFT JOIN sdi_domains d      ON d.domain_code = sd.domain_code
        GROUP BY cl.id, cl.code, cl.name, cl.description
        ORDER BY cl.code
      `);
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  // ─── Stats summary for the SDI Admin page ────────────────────────────
  app.get('/api/sdi/admin/stats', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query(`
        SELECT
          (SELECT count(*) FROM sdi_domains)::int                     AS domains,
          (SELECT count(*) FROM sdi_domains WHERE is_active)::int     AS domains_active,
          (SELECT count(*) FROM sdi_subdomains)::int                  AS subdomains,
          (SELECT count(*) FROM sdi_subdomains WHERE is_active)::int  AS subdomains_active,
          (SELECT count(*) FROM sdi_items)::int                       AS items,
          (SELECT count(*) FROM sdi_items WHERE is_active)::int       AS items_active,
          (SELECT count(*) FROM sdi_item_options)::int                AS options
      `);
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });
}
