/**
 * RIE Admin Routes — all endpoints require requireAuth + requireSuperAdmin
 * Tables created by migration 20260507_rie_engine.sql — no DDL here
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { sendCounsellorAssignmentAlert } from '../email';

export function registerRIEAdminRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler
) {
  // GET /api/admin/rie/dashboard — KPIs
  app.get('/api/admin/rie/dashboard', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [kpiRes, crisisRes, recoveryRes, oppRes, recentRes] = await Promise.all([
        pool.query(`
          SELECT
            (SELECT COUNT(*) FROM rie_recommendations)::int                           AS total_recommendations,
            (SELECT COUNT(*) FROM rie_interventions WHERE status IN ('pending','active'))::int AS active_interventions,
            (SELECT COUNT(*) FROM rie_escalations WHERE status='pending')::int        AS pending_escalations,
            (SELECT COUNT(*) FROM rie_escalations WHERE mandatory_human_review=true AND status='pending')::int AS crisis_count,
            (SELECT COUNT(*) FROM rie_opportunity_flags WHERE status='active')::int   AS opportunity_detections,
            (SELECT COUNT(DISTINCT user_email) FROM rie_intervention_context)::int   AS users_in_context
        `),
        pool.query(`
          SELECT ROUND(AVG(momentum_score)::numeric, 1) AS avg_recovery_velocity,
                 COUNT(*) FILTER (WHERE collapse_detected=true)::int AS collapse_count,
                 COUNT(*) FILTER (WHERE trajectory='accelerating')::int AS accelerating_count,
                 COUNT(*) FILTER (WHERE trajectory='improving')::int AS improving_count
          FROM rie_recovery_profiles
        `),
        pool.query(`
          SELECT rec_type, COUNT(*) AS count FROM rie_recommendations
          GROUP BY rec_type ORDER BY count DESC LIMIT 7
        `),
        pool.query(`
          SELECT opportunity_type, COUNT(*) AS count FROM rie_opportunity_flags
          WHERE status='active' GROUP BY opportunity_type ORDER BY count DESC LIMIT 5
        `),
        pool.query(`
          SELECT user_email, rec_type, domain, title, priority, created_at
          FROM rie_recommendations ORDER BY created_at DESC LIMIT 10
        `),
      ]);

      const kpi = kpiRes.rows[0];
      const recovery = crisisRes.rows[0];
      res.json({
        kpi: {
          ...kpi,
          avg_recovery_velocity: Number(recovery?.avg_recovery_velocity || 0),
          collapse_count: recovery?.collapse_count || 0,
        },
        recovery_stats: crisisRes.rows[0],
        rec_type_breakdown: recoveryRes.rows,
        top_opportunities: oppRes.rows,
        recent_recommendations: recentRes.rows,
      });
    } catch (err) { next(err); }
  });

  // GET /api/admin/rie/recommendations
  app.get('/api/admin/rie/recommendations', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        rec_type, domain, confidence_min, reviewed, user,
        limit = '50', offset = '0', search,
      } = req.query as Record<string, string>;

      const params: any[] = [];
      const clauses: string[] = [];
      let p = 1;

      if (rec_type)       { clauses.push(`rec_type=$${p++}`);       params.push(rec_type); }
      if (domain)         { clauses.push(`domain=$${p++}`);         params.push(domain); }
      if (confidence_min) { clauses.push(`confidence>=$${p++}`);    params.push(parseFloat(confidence_min)); }
      if (reviewed === 'true')  clauses.push(`reviewed_at IS NOT NULL`);
      if (reviewed === 'false') clauses.push(`reviewed_at IS NULL`);
      if (user)   { clauses.push(`user_email ILIKE $${p++}`);  params.push(`%${user}%`); }
      if (search) {
        clauses.push(`(title ILIKE $${p} OR user_email ILIKE $${p + 1})`);
        params.push(`%${search}%`, `%${search}%`);
        p += 2;
      }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT * FROM rie_recommendations ${where} ORDER BY priority ASC, created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
        [...params, parseInt(limit), parseInt(offset)]
      );
      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*) FROM rie_recommendations ${where}`, params
      );
      res.json({ recommendations: rows, total: parseInt(count), limit: parseInt(limit), offset: parseInt(offset) });
    } catch (err) { next(err); }
  });

  // GET /api/admin/rie/interventions
  app.get('/api/admin/rie/interventions', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, domain, escalation_level, priority, limit = '50', offset = '0', search } = req.query as Record<string, string>;
      const params: any[] = [];
      const clauses: string[] = [];
      let p = 1;

      if (status)           { clauses.push(`status=$${p++}`);           params.push(status); }
      if (domain)           { clauses.push(`domain=$${p++}`);           params.push(domain); }
      if (escalation_level) { clauses.push(`escalation_level=$${p++}`); params.push(escalation_level); }
      if (priority)         { clauses.push(`priority=$${p++}`);         params.push(priority); }
      if (search) {
        clauses.push(`(title ILIKE $${p} OR user_email ILIKE $${p + 1})`);
        params.push(`%${search}%`, `%${search}%`);
        p += 2;
      }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT * FROM rie_interventions ${where} ORDER BY created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
        [...params, parseInt(limit), parseInt(offset)]
      );
      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*) FROM rie_interventions ${where}`, params
      );

      const { rows: stats } = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='pending')::int   AS pending,
          COUNT(*) FILTER (WHERE status='active')::int    AS active,
          COUNT(*) FILTER (WHERE status='completed')::int AS completed,
          COUNT(*) FILTER (WHERE status='failed')::int    AS failed,
          COUNT(*) FILTER (WHERE saturation_detected=true)::int AS saturated,
          COUNT(*) FILTER (WHERE escalation_level != 'none')::int AS escalated
        FROM rie_interventions
      `);

      res.json({ interventions: rows, total: parseInt(count), limit: parseInt(limit), offset: parseInt(offset), stats: stats[0] });
    } catch (err) { next(err); }
  });

  // GET /api/admin/rie/interventions/:id/sequences — ordered next-best-action steps
  app.get('/api/admin/rie/interventions/:id/sequences', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { rows: intervention } = await pool.query(
        `SELECT user_email, tenant_id FROM rie_interventions WHERE id=$1`, [id]
      );
      if (!intervention[0]) return res.status(404).json({ error: 'Intervention not found' });

      const { rows: sequences } = await pool.query(`
        SELECT * FROM rie_intervention_sequences
        WHERE user_email=$1 AND tenant_id=$2
        ORDER BY sequence_step ASC
        LIMIT 10
      `, [intervention[0].user_email, intervention[0].tenant_id]);
      res.json({ sequences });
    } catch (err) { next(err); }
  });

  // PATCH /api/admin/rie/interventions/:id
  app.patch('/api/admin/rie/interventions/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, outcome_notes, assigned_to } = req.body;
      const sets: string[] = ['updated_at=NOW()'];
      const vals: any[] = [];
      let p = 1;
      if (status)        { sets.push(`status=$${p++}`);        vals.push(status); }
      if (outcome_notes) { sets.push(`outcome_notes=$${p++}`); vals.push(outcome_notes); }
      if (assigned_to)   { sets.push(`assigned_to=$${p++}`);   vals.push(assigned_to); }
      if (status === 'completed') { sets.push('completed_at=NOW()'); }
      vals.push(id);
      const { rows: [row] } = await pool.query(
        `UPDATE rie_interventions SET ${sets.join(',')} WHERE id=$${p} RETURNING *`, vals
      );
      res.json({ intervention: row });
    } catch (err) { next(err); }
  });

  // GET /api/admin/rie/escalations/unread — crisis badge count + list
  app.get('/api/admin/rie/escalations/unread', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { rows: alerts } = await pool.query(`
        SELECT id, user_email, escalation_type, severity, trigger_reason,
               requires_counsellor, mandatory_human_review, assigned_to, assigned_to_name, created_at
        FROM rie_escalations
        WHERE mandatory_human_review = TRUE
          AND status = 'pending'
          AND acknowledged_at IS NULL
        ORDER BY created_at DESC
        LIMIT 20
      `);
      res.json({ count: alerts.length, alerts });
    } catch (err) { next(err); }
  });

  // PATCH /api/admin/rie/escalations/:id/acknowledge — dismiss from crisis inbox
  app.patch('/api/admin/rie/escalations/:id/acknowledge', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const adminEmail = (req as any).session?.adminEmail || 'superadmin';
      const { rows: [row] } = await pool.query(`
        UPDATE rie_escalations
        SET acknowledged_at = NOW(), acknowledged_by = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, acknowledged_at, acknowledged_by
      `, [adminEmail, id]);
      if (!row) return res.status(404).json({ error: 'Escalation not found' });
      res.json({ ok: true, escalation: row });
    } catch (err) { next(err); }
  });

  // GET /api/admin/rie/escalations
  app.get('/api/admin/rie/escalations', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, severity, type, limit = '50', offset = '0' } = req.query as Record<string, string>;
      const params: any[] = [];
      const clauses: string[] = [];
      let p = 1;

      if (status)   { clauses.push(`status=$${p++}`);           params.push(status); }
      if (severity) { clauses.push(`severity=$${p++}`);         params.push(severity); }
      if (type)     { clauses.push(`escalation_type=$${p++}`);  params.push(type); }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT * FROM rie_escalations ${where} ORDER BY mandatory_human_review DESC, created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
        [...params, parseInt(limit), parseInt(offset)]
      );
      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*) FROM rie_escalations ${where}`, params
      );
      const { rows: [summary] } = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='pending')::int                          AS pending_count,
          COUNT(*) FILTER (WHERE mandatory_human_review=true AND status='pending')::int AS crisis_pending,
          COUNT(*) FILTER (WHERE severity='critical')::int                       AS critical_count,
          COUNT(*) FILTER (WHERE severity='high')::int                           AS high_count,
          COUNT(*) FILTER (WHERE status='resolved')::int                         AS resolved_count
        FROM rie_escalations
      `);
      res.json({ escalations: rows, total: parseInt(count), limit: parseInt(limit), offset: parseInt(offset), summary });
    } catch (err) { next(err); }
  });

  // PATCH /api/admin/rie/escalations/:id
  app.patch('/api/admin/rie/escalations/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, assigned_to, resolution_notes, resolved_by } = req.body;
      const sets: string[] = ['updated_at=NOW()'];
      const vals: any[] = [];
      let p = 1;
      if (status)           { sets.push(`status=$${p++}`);           vals.push(status); }
      if (assigned_to)      { sets.push(`assigned_to=$${p++}`);      vals.push(assigned_to); }
      if (resolution_notes) { sets.push(`resolution_notes=$${p++}`); vals.push(resolution_notes); }
      if (resolved_by)      { sets.push(`resolved_by=$${p++}`);      vals.push(resolved_by); }
      if (status === 'resolved') { sets.push('resolved_at=NOW()'); }
      vals.push(id);
      const { rows: [row] } = await pool.query(
        `UPDATE rie_escalations SET ${sets.join(',')} WHERE id=$${p} RETURNING *`, vals
      );
      res.json({ escalation: row });
    } catch (err) { next(err); }
  });

  // GET /api/admin/rie/recovery-profiles
  app.get('/api/admin/rie/recovery-profiles', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { trajectory, limit = '50', offset = '0', search } = req.query as Record<string, string>;
      const params: any[] = [];
      const clauses: string[] = [];
      let p = 1;

      if (trajectory) { clauses.push(`trajectory=$${p++}`);       params.push(trajectory); }
      if (search)     { clauses.push(`user_email ILIKE $${p++}`); params.push(`%${search}%`); }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT * FROM rie_recovery_profiles ${where} ORDER BY momentum_score DESC LIMIT $${p} OFFSET $${p + 1}`,
        [...params, parseInt(limit), parseInt(offset)]
      );
      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*) FROM rie_recovery_profiles ${where}`, params
      );
      const { rows: [stats] } = await pool.query(`
        SELECT
          ROUND(AVG(momentum_score)::numeric, 1)    AS avg_momentum,
          ROUND(AVG(velocity)::numeric, 1)          AS avg_velocity,
          ROUND(AVG(stability)::numeric, 1)         AS avg_stability,
          COUNT(*) FILTER (WHERE collapse_detected=true)::int    AS collapse_count,
          COUNT(*) FILTER (WHERE fatigue_detected=true)::int     AS fatigue_count,
          COUNT(*) FILTER (WHERE saturation_detected=true)::int  AS saturation_count,
          COUNT(*) FILTER (WHERE trajectory='accelerating')::int AS accelerating_count,
          COUNT(*) FILTER (WHERE trajectory='improving')::int    AS improving_count,
          COUNT(*) FILTER (WHERE trajectory='collapsing')::int   AS collapsing_count
        FROM rie_recovery_profiles
      `);
      res.json({ profiles: rows, total: parseInt(count), limit: parseInt(limit), offset: parseInt(offset), stats });
    } catch (err) { next(err); }
  });

  // GET /api/admin/rie/counsellors — list active counsellors for assign dropdown (registry + fallback)
  app.get('/api/admin/rie/counsellors', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tableExists = await pool.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name='counsellors' LIMIT 1
      `);
      if (tableExists.rows.length > 0) {
        const { rows } = await pool.query(`
          SELECT email, name, specialisation FROM counsellors
          WHERE active = TRUE
          ORDER BY name ASC
          LIMIT 200
        `);
        if (rows.length > 0) return res.json({ counsellors: rows });
      }
      const { rows } = await pool.query(`
        SELECT DISTINCT assigned_to AS email, assigned_to AS name
        FROM rie_interventions
        WHERE assigned_to IS NOT NULL AND assigned_to <> ''
        ORDER BY assigned_to ASC
        LIMIT 100
      `);
      res.json({ counsellors: rows });
    } catch (err) { next(err); }
  });

  // GET /api/admin/rie/counsellors/directory — full directory with filters (admin CRUD view)
  app.get('/api/admin/rie/counsellors/directory', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tableExists = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='counsellors' LIMIT 1`);
      if (!tableExists.rows.length) return res.json({ counsellors: [], total: 0 });
      const { search = '', include_inactive = 'false' } = req.query as Record<string, string>;
      const params: any[] = [];
      const clauses: string[] = [];
      let p = 1;
      if (search) {
        clauses.push(`(name ILIKE $${p} OR email ILIKE $${p + 1})`);
        params.push(`%${search}%`, `%${search}%`);
        p += 2;
      }
      if (include_inactive !== 'true') {
        clauses.push(`active = TRUE`);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT id, name, email, specialisation, active, created_at FROM counsellors ${where} ORDER BY name ASC`,
        params
      );
      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*) FROM counsellors ${where}`, params
      );
      res.json({ counsellors: rows, total: parseInt(count) });
    } catch (err) { next(err); }
  });

  // POST /api/admin/rie/counsellors — create counsellor
  app.post('/api/admin/rie/counsellors', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, specialisation } = req.body;
      if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO counsellors (name, email, specialisation) VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, specialisation=EXCLUDED.specialisation, active=TRUE
         RETURNING *`,
        [name.trim(), email.trim().toLowerCase(), specialisation?.trim() || null]
      );
      res.status(201).json({ counsellor: row });
    } catch (err: any) {
      if (err.code === '23505') return res.status(409).json({ error: 'A counsellor with this email already exists' });
      next(err);
    }
  });

  // PATCH /api/admin/rie/counsellors/:id — update counsellor
  app.patch('/api/admin/rie/counsellors/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, specialisation, active } = req.body;
      const sets: string[] = [];
      const params: any[] = [];
      let p = 1;
      if (name !== undefined)          { sets.push(`name=$${p++}`);           params.push(name); }
      if (specialisation !== undefined) { sets.push(`specialisation=$${p++}`); params.push(specialisation || null); }
      if (active !== undefined)         { sets.push(`active=$${p++}`);         params.push(active); }
      if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
      params.push(parseInt(id));
      const { rows: [row] } = await pool.query(
        `UPDATE counsellors SET ${sets.join(', ')} WHERE id=$${p} RETURNING *`,
        params
      );
      if (!row) return res.status(404).json({ error: 'Counsellor not found' });
      res.json({ counsellor: row });
    } catch (err) { next(err); }
  });

  // DELETE /api/admin/rie/counsellors/:id — remove counsellor
  app.delete('/api/admin/rie/counsellors/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await pool.query(`DELETE FROM counsellors WHERE id=$1`, [parseInt(id)]);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // POST /api/admin/rie/escalations/:id/assign — assign counsellor + send notification
  app.post('/api/admin/rie/escalations/:id/assign', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { counsellor_email, counsellor_name } = req.body;
      if (!counsellor_email) return res.status(400).json({ error: 'counsellor_email is required' });

      const adminEmail = (req as any).session?.adminEmail || 'superadmin';

      const { rows: [row] } = await pool.query(`
        UPDATE rie_escalations
        SET assigned_to = $1, assigned_to_name = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING id, user_email, escalation_type, severity, trigger_reason, assigned_to, assigned_to_name
      `, [counsellor_email, counsellor_name || counsellor_email, id]);

      if (!row) return res.status(404).json({ error: 'Escalation not found' });

      sendCounsellorAssignmentAlert({
        counsellorEmail: counsellor_email,
        counsellorName: counsellor_name || counsellor_email,
        escalation: row,
        assignedBy: adminEmail,
      }).catch(() => {});

      res.json({ ok: true, escalation: row });
    } catch (err) { next(err); }
  });

  // GET /api/admin/rie/opportunity-flags
  app.get('/api/admin/rie/opportunity-flags', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { opportunity_type, status, limit = '50', offset = '0', search } = req.query as Record<string, string>;
      const params: any[] = [];
      const clauses: string[] = [];
      let p = 1;

      if (opportunity_type) { clauses.push(`opportunity_type=$${p++}`); params.push(opportunity_type); }
      if (status)           { clauses.push(`status=$${p++}`);           params.push(status); }
      if (search) {
        clauses.push(`(user_email ILIKE $${p} OR title ILIKE $${p + 1})`);
        params.push(`%${search}%`, `%${search}%`);
        p += 2;
      }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT * FROM rie_opportunity_flags ${where} ORDER BY confidence DESC, created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
        [...params, parseInt(limit), parseInt(offset)]
      );
      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*) FROM rie_opportunity_flags ${where}`, params
      );
      const { rows: typeDist } = await pool.query(`
        SELECT opportunity_type, COUNT(*) AS count, ROUND(AVG(confidence)::numeric, 2) AS avg_confidence
        FROM rie_opportunity_flags GROUP BY opportunity_type ORDER BY count DESC
      `);
      res.json({ flags: rows, total: parseInt(count), limit: parseInt(limit), offset: parseInt(offset), type_distribution: typeDist });
    } catch (err) { next(err); }
  });
}
