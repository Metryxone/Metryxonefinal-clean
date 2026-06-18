/**
 * RIE Admin Routes — all endpoints require requireAuth + requireSuperAdmin
 * Canonical schema lives in migration 20260507_rie_engine.sql. Since this
 * project has no migration runner, ensureRieSchema() below mirrors that
 * migration as a lazy, idempotent ensure-schema (CREATE TABLE/INDEX IF NOT
 * EXISTS) so the Crisis Inbox endpoints don't 500 in environments where the
 * migration was never applied (F2). Keep it in lockstep with the migration.
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { sendCounsellorAssignmentAlert } from '../email';

let rieSchemaPromise: Promise<void> | null = null;
function ensureRieSchema(pool: Pool): Promise<void> {
  if (!rieSchemaPromise) {
    rieSchemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS rie_intervention_context (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email TEXT NOT NULL,
        tenant_id UUID,
        session_id UUID,
        behavioural_state JSONB DEFAULT '{}',
        cognitive_state JSONB DEFAULT '{}',
        emotional_state JSONB DEFAULT '{}',
        resilience_state JSONB DEFAULT '{}',
        risk_profile JSONB DEFAULT '{}',
        opportunity_profile JSONB DEFAULT '{}',
        csi_score NUMERIC DEFAULT 0,
        csi_stage TEXT DEFAULT 'Forming',
        lbi_score NUMERIC DEFAULT 0,
        dropout_risk NUMERIC DEFAULT 0,
        burnout_probability NUMERIC DEFAULT 0,
        employability_readiness NUMERIC DEFAULT 0,
        leadership_emergence NUMERIC DEFAULT 0,
        emotional_load NUMERIC DEFAULT 0,
        cognitive_load NUMERIC DEFAULT 0,
        engagement_score NUMERIC DEFAULT 50,
        risk_score NUMERIC DEFAULT 0,
        composite_intensity NUMERIC DEFAULT 0,
        crisis_detected BOOLEAN DEFAULT FALSE,
        crisis_type TEXT,
        context_version INTEGER DEFAULT 1,
        computed_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_email)
      );
      CREATE INDEX IF NOT EXISTS idx_rie_ctx_email ON rie_intervention_context(user_email);
      CREATE INDEX IF NOT EXISTS idx_rie_ctx_risk ON rie_intervention_context(risk_score DESC);
      CREATE INDEX IF NOT EXISTS idx_rie_ctx_crisis ON rie_intervention_context(crisis_detected) WHERE crisis_detected = TRUE;

      CREATE TABLE IF NOT EXISTS rie_recommendations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email TEXT NOT NULL,
        tenant_id UUID,
        session_id UUID,
        rec_type TEXT NOT NULL,
        domain TEXT NOT NULL,
        title TEXT NOT NULL,
        rationale JSONB DEFAULT '[]',
        contributing_signals JSONB DEFAULT '[]',
        confidence NUMERIC DEFAULT 0.5,
        timing TEXT DEFAULT 'immediate',
        intensity TEXT DEFAULT 'moderate',
        priority INTEGER DEFAULT 2,
        expected_outcome TEXT,
        status TEXT DEFAULT 'active',
        reviewed_by TEXT,
        reviewed_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_rie_rec_email ON rie_recommendations(user_email);
      CREATE INDEX IF NOT EXISTS idx_rie_rec_type ON rie_recommendations(rec_type);
      CREATE INDEX IF NOT EXISTS idx_rie_rec_status ON rie_recommendations(status);
      CREATE INDEX IF NOT EXISTS idx_rie_rec_priority ON rie_recommendations(priority);

      CREATE TABLE IF NOT EXISTS rie_interventions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email TEXT NOT NULL,
        tenant_id UUID,
        session_id UUID,
        domain TEXT NOT NULL,
        intervention_mode TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to TEXT,
        escalation_level TEXT DEFAULT 'none',
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        outcome_notes TEXT,
        failure_reason TEXT,
        attempt_count INTEGER DEFAULT 0,
        saturation_detected BOOLEAN DEFAULT FALSE,
        diminishing_returns BOOLEAN DEFAULT FALSE,
        started_at TIMESTAMPTZ,
        due_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_rie_int_email ON rie_interventions(user_email);
      CREATE INDEX IF NOT EXISTS idx_rie_int_status ON rie_interventions(status);
      CREATE INDEX IF NOT EXISTS idx_rie_int_esc ON rie_interventions(escalation_level);

      CREATE TABLE IF NOT EXISTS rie_intervention_sequences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email TEXT NOT NULL,
        tenant_id UUID,
        sequence_step INTEGER NOT NULL,
        intervention_id UUID REFERENCES rie_interventions(id) ON DELETE SET NULL,
        action_type TEXT NOT NULL,
        action_label TEXT NOT NULL,
        rationale TEXT,
        status TEXT DEFAULT 'pending',
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_rie_seq_email ON rie_intervention_sequences(user_email);
      CREATE INDEX IF NOT EXISTS idx_rie_seq_step ON rie_intervention_sequences(user_email, sequence_step);

      CREATE TABLE IF NOT EXISTS rie_recovery_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email TEXT NOT NULL,
        tenant_id UUID,
        velocity NUMERIC DEFAULT 0,
        stability NUMERIC DEFAULT 0,
        sustainability NUMERIC DEFAULT 0,
        momentum_score NUMERIC DEFAULT 0,
        trajectory TEXT DEFAULT 'unknown',
        collapse_detected BOOLEAN DEFAULT FALSE,
        fatigue_detected BOOLEAN DEFAULT FALSE,
        saturation_detected BOOLEAN DEFAULT FALSE,
        sessions_analyzed INTEGER DEFAULT 0,
        score_history JSONB DEFAULT '[]',
        computed_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_email)
      );
      CREATE INDEX IF NOT EXISTS idx_rie_rec_profile_email ON rie_recovery_profiles(user_email);
      CREATE INDEX IF NOT EXISTS idx_rie_rec_profile_traj ON rie_recovery_profiles(trajectory);

      CREATE TABLE IF NOT EXISTS rie_outcomes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email TEXT NOT NULL,
        tenant_id UUID,
        intervention_id UUID REFERENCES rie_interventions(id) ON DELETE CASCADE,
        outcome_type TEXT NOT NULL,
        score_before NUMERIC,
        score_after NUMERIC,
        delta NUMERIC,
        success BOOLEAN DEFAULT FALSE,
        notes TEXT,
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_rie_outcome_intervention ON rie_outcomes(intervention_id);
      CREATE INDEX IF NOT EXISTS idx_rie_outcome_email ON rie_outcomes(user_email);

      CREATE TABLE IF NOT EXISTS rie_escalations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email TEXT NOT NULL,
        tenant_id UUID,
        session_id UUID,
        escalation_type TEXT NOT NULL,
        severity TEXT DEFAULT 'medium',
        trigger_reason TEXT,
        trigger_signals JSONB DEFAULT '[]',
        requires_counsellor BOOLEAN DEFAULT FALSE,
        requires_mentor BOOLEAN DEFAULT FALSE,
        requires_peer_support BOOLEAN DEFAULT FALSE,
        mandatory_human_review BOOLEAN DEFAULT FALSE,
        assigned_to TEXT,
        assigned_to_name TEXT,
        status TEXT DEFAULT 'pending',
        resolution_notes TEXT,
        resolved_by TEXT,
        resolved_at TIMESTAMPTZ,
        acknowledged_at TIMESTAMPTZ,
        acknowledged_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      -- Existing deployments may predate these columns (CREATE TABLE IF NOT
      -- EXISTS won't add them to an already-present table); add idempotently so
      -- the Crisis Inbox handlers (which SELECT/UPDATE them) don't 42703.
      ALTER TABLE rie_escalations ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;
      ALTER TABLE rie_escalations ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
      ALTER TABLE rie_escalations ADD COLUMN IF NOT EXISTS acknowledged_by TEXT;
      CREATE INDEX IF NOT EXISTS idx_rie_esc_email ON rie_escalations(user_email);
      CREATE INDEX IF NOT EXISTS idx_rie_esc_status ON rie_escalations(status);
      CREATE INDEX IF NOT EXISTS idx_rie_esc_sev ON rie_escalations(severity);
      CREATE INDEX IF NOT EXISTS idx_rie_esc_mandatory ON rie_escalations(mandatory_human_review) WHERE mandatory_human_review = TRUE;

      CREATE TABLE IF NOT EXISTS rie_opportunity_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email TEXT NOT NULL,
        tenant_id UUID,
        opportunity_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        cascade_model JSONB DEFAULT '[]',
        confidence NUMERIC DEFAULT 0.5,
        amplification_actions JSONB DEFAULT '[]',
        status TEXT DEFAULT 'active',
        actioned_by TEXT,
        actioned_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_rie_opp_email ON rie_opportunity_flags(user_email);
      CREATE INDEX IF NOT EXISTS idx_rie_opp_type ON rie_opportunity_flags(opportunity_type);
      CREATE INDEX IF NOT EXISTS idx_rie_opp_status ON rie_opportunity_flags(status);
    `).then(() => undefined).catch((err) => {
      rieSchemaPromise = null; // allow retry on next request if this attempt failed
      throw err;
    });
  }
  return rieSchemaPromise;
}

export function registerRIEAdminRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler
) {
  // F2: ensure RIE engine tables exist (idempotent) so Crisis Inbox endpoints
  // don't 500 where migration 20260507_rie_engine.sql was never applied.
  // Warm at registration (avoids first-hit latency)...
  void ensureRieSchema(pool).catch((err) => {
    console.error('[RIE] ensureRieSchema failed at registration:', err?.message || err);
  });
  // ...and gate every RIE handler on it so a request can never race ahead of the
  // DDL (the promise is memoized, so this is a no-op after the first success;
  // if the DDL failed, the promise is reset so this retries on the next request).
  // Registered before the RIE route handlers below; runs after the global
  // /api/admin auth gate (mounted earlier in routes.ts).
  app.use('/api/admin/rie', (_req: Request, res: Response, next: NextFunction) => {
    ensureRieSchema(pool).then(() => next()).catch(next);
  });
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
