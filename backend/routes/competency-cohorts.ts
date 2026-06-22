/**
 * backend/routes/competency-cohorts.ts
 * Competency cohorts, versions, scoring-rules, report-types,
 * cluster-correlations and engine-summary.
 * Extracted from routes.ts (Phase 0 S4 cleanup).
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';

type Auth = (req: Request, res: Response, next: NextFunction) => void;

export function registerCompetencyCohortRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Auth,
  requireSuperAdmin: Auth,
) {
  // ─── Cohorts ──────────────────────────────────────────────────────────

  app.get('/api/competency/cohorts', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query(
        `SELECT id, name, role_code, role_name, experience_min, experience_max,
                location, industry, notes, is_active, created_at, updated_at
         FROM cohorts ORDER BY role_code, experience_min, name`
      );
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  app.post('/api/competency/cohorts', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const { name, role_code, role_name, experience_min, experience_max, location, industry, notes, is_active } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name is required' });
    try {
      const r = await pool.query(
        `INSERT INTO cohorts (name, role_code, role_name, experience_min, experience_max, location, industry, notes, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [name, role_code || null, role_name || null,
         Number.isFinite(experience_min) ? experience_min : 0,
         Number.isFinite(experience_max) ? experience_max : 99,
         location || null, industry || null, notes || null,
         is_active === false ? false : true]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.patch('/api/competency/cohorts/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const { id } = req.params;
    const fields = ['name','role_code','role_name','experience_min','experience_max','location','industry','notes','is_active'];
    const sets: string[] = []; const vals: any[] = [];
    fields.forEach(f => { if (req.body[f] !== undefined) { sets.push(`${f} = $${sets.length + 1}`); vals.push(req.body[f]); } });
    if (sets.length === 0) return res.status(400).json({ error: 'no fields to update' });
    vals.push(id);
    try {
      const r = await pool.query(
        `UPDATE cohorts SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING *`,
        vals
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'Cohort not found' });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.delete('/api/competency/cohorts/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const r = await pool.query('DELETE FROM cohorts WHERE id = $1', [req.params.id]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'Cohort not found' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ─── Versions ─────────────────────────────────────────────────────────

  app.get('/api/competency/versions', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query(
        `SELECT id, version, label, notes, changed_by, change_summary, created_at
         FROM competency_versions ORDER BY created_at DESC, version DESC`
      );
      res.json(r.rows);
    } catch (err: any) {
      if (err?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  app.post('/api/competency/versions', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const { label, notes } = req.body || {};
    try {
      const v = await pool.query('SELECT COALESCE(MAX(version), 0) + 1 AS next FROM competency_versions');
      const nextV = v.rows[0]?.next || 1;
      const summary = await pool.query(`
        SELECT jsonb_build_object(
          'domains', (SELECT count(*) FROM competency_domains),
          'competencies', (SELECT count(*) FROM competencies),
          'stage_norms', (SELECT count(*) FROM stage_competency_norms),
          'role_weights', (SELECT count(*) FROM role_competency_weights),
          'assessment_items', (SELECT count(*) FROM competency_assessment_items),
          'cohorts', (SELECT count(*) FROM cohorts),
          'scoring_configs', (SELECT count(*) FROM scoring_configs)
        ) AS s
      `);
      const r = await pool.query(
        `INSERT INTO competency_versions (version, label, notes, changed_by, change_summary)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [nextV, label || `v${nextV}.0`, notes || null, (req as any).user?.id || null, summary.rows[0].s]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) { next(err); }
  });

  // ─── Admin scoring / report / cluster views ───────────────────────────

  app.get('/api/competency/admin/scoring-rules', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query(`
        SELECT
          c.id,
          c.code          AS subdomain_code,
          c.name          AS subdomain_name,
          d.code          AS domain_code,
          d.name          AS domain_name,
          UPPER(c.competency_type) AS report_type_code,
          'mean'          AS calculation_type,
          25              AS max_score,
          '{"needs_attention":40,"developing":60,"proficient":80,"advanced":100}'::jsonb AS cutoffs,
          false           AS is_anchor_subdomain,
          CASE WHEN c.is_active THEN 'Active' ELSE 'Inactive' END AS status
        FROM competencies c
        JOIN competency_domains d ON d.id = c.domain_id
        ORDER BY d.display_order, c.display_order
      `);
      res.json(r.rows);
    } catch (err) { next(err); }
  });

  app.get('/api/competency/admin/report-types', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query(`
        SELECT
          UPPER(competency_type) AS type_code,
          INITCAP(competency_type) || ' Competencies' AS type_name,
          CASE competency_type
            WHEN 'core'        THEN 'Foundational competencies required across all roles and levels'
            WHEN 'technical'   THEN 'Specialised skills and domain-specific technical proficiencies'
            WHEN 'leadership'  THEN 'Competencies that drive influence, direction and team performance'
            WHEN 'functional'  THEN 'Role-specific operational competencies for effective job execution'
            WHEN 'behavioral'  THEN 'Observable workplace behaviours that shape culture and collaboration'
            ELSE 'Competencies of this type'
          END AS description,
          COUNT(*)::int AS subdomain_count,
          0             AS anchor_subdomain_count
        FROM competencies
        GROUP BY competency_type
        ORDER BY MIN(display_order)
      `);
      res.json(r.rows);
    } catch (err) { next(err); }
  });

  app.get('/api/competency/admin/report-types/:code/subdomains', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const code = req.params.code.toLowerCase();
    try {
      const r = await pool.query(`
        SELECT
          c.code AS subdomain_code, c.name AS subdomain_name,
          d.code AS domain_code,   d.name AS domain_name,
          false  AS is_anchor_subdomain,
          0      AS anchor_item_count
        FROM competencies c
        JOIN competency_domains d ON d.id = c.domain_id
        WHERE LOWER(c.competency_type) = $1
        ORDER BY d.display_order, c.display_order
      `, [code]);
      res.json(r.rows);
    } catch (err) { next(err); }
  });

  app.get('/api/competency/admin/cluster-correlations', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query(`
        SELECT
          cl.id, cl.code AS cluster_code, cl.name AS cluster_name,
          cl.description AS cluster_description,
          COALESCE(
            json_agg(
              json_build_object(
                'subdomain_code',    c.code,
                'subdomain_name',    c.name,
                'domain_code',       d.code,
                'report_type_code',  UPPER(c.competency_type),
                'is_anchor',         false
              ) ORDER BY c.code
            ) FILTER (WHERE c.id IS NOT NULL), '[]'
          ) AS subdomains
        FROM competency_clusters cl
        LEFT JOIN competency_cluster_map m ON m.cluster_id = cl.id
        LEFT JOIN competencies c           ON c.id = m.competency_id
        LEFT JOIN competency_domains d     ON d.id = c.domain_id
        GROUP BY cl.id, cl.code, cl.name, cl.description
        ORDER BY cl.code
      `);
      res.json(r.rows);
    } catch (err) { next(err); }
  });

  // ─── Engine summary (counts only, admin-gated to match sibling admin routes) ───

  app.get('/api/competency/engine-summary', requireAuth, requireSuperAdmin, async (_req, res) => {
    // Per-table guarded counts: a missing table yields null (honest "not migrated")
    // rather than throwing and darkening the whole card. The frontend hides null
    // entries and renders real counts (0 = migrated-but-empty, distinct from null).
    const tableExists = async (t: string): Promise<boolean> => {
      try {
        const r = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`public.${t}`]);
        return r.rows[0]?.ok === true;
      } catch { return false; }
    };
    const countOf = async (table: string, sql: string): Promise<number | null> => {
      if (!(await tableExists(table))) return null; // honest "not migrated"
      try {
        const r = await pool.query(sql);
        return Number(r.rows[0]?.n ?? 0);
      } catch (err) {
        // Table exists but the count failed = a real fault, not absence.
        // Keep the card alive (return null) but stay observable.
        console.error(`[competency/engine-summary] count failed for ${table}:`, err);
        return null;
      }
    };

    const [
      domains, competencies, active_competencies, clusters,
      assessment_items, stage_norms, role_weights, roles,
    ] = await Promise.all([
      countOf('competency_domains',          `SELECT count(*) AS n FROM competency_domains`),
      countOf('competencies',                `SELECT count(*) AS n FROM competencies`),
      countOf('competencies',                `SELECT count(*) AS n FROM competencies WHERE is_active`),
      countOf('competency_clusters',         `SELECT count(*) AS n FROM competency_clusters`),
      countOf('competency_assessment_items', `SELECT count(*) AS n FROM competency_assessment_items`),
      countOf('competency_stage_norms',      `SELECT count(*) AS n FROM competency_stage_norms`),
      countOf('competency_role_weights',     `SELECT count(*) AS n FROM competency_role_weights`),
      countOf('competency_role_weights',     `SELECT count(distinct role_code) AS n FROM competency_role_weights`),
    ]);

    res.json({
      domains, competencies, active_competencies, clusters,
      assessment_items, stage_norms, role_weights, roles,
    });
  });
}
