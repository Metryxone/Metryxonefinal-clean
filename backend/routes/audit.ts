/**
 * Unified Audit Log API
 * Sources from `capadex_audit_events` — the canonical audit table.
 *
 * GET /api/admin/audit/events     — filterable audit log
 * GET /api/admin/audit/governance — governance stats for Ethics panel
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import type { Pool } from 'pg';

type Auth = RequestHandler;

export function registerAuditRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Auth,
  requireSuperAdmin: Auth,
) {

  // ── GET /api/admin/audit/events ───────────────────────────────────────────
  app.get('/api/admin/audit/events', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        event_type = '',
        actor      = '',
        from       = '',
        to         = '',
        limit      = '100',
        offset     = '0',
      } = req.query as Record<string, string>;

      const limitNum  = Math.min(Math.max(parseInt(limit,  10) || 100, 1), 1000);
      const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

      const conds: string[] = [];
      const params: unknown[] = [];
      let p = 1;

      if (event_type) { conds.push(`e.event_type = $${p++}`); params.push(event_type); }
      if (actor)      { conds.push(`e.actor ILIKE $${p++}`); params.push(`%${actor}%`); }
      if (from)       { conds.push(`e.created_at >= $${p++}`); params.push(from); }
      if (to)         { conds.push(`e.created_at <= $${p++}`); params.push(to); }

      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

      const [rowsRes, countRes, typesRes] = await Promise.all([
        pool.query(`
          SELECT
            e.id,
            e.event_type,
            e.actor,
            e.user_id,
            e.session_id,
            e.payload,
            e.created_at
          FROM capadex_audit_events e
          ${where}
          ORDER BY e.created_at DESC
          LIMIT $${p} OFFSET $${p + 1}
        `, [...params, limitNum, offsetNum]),

        pool.query(
          `SELECT COUNT(*) FROM capadex_audit_events e ${where}`,
          params
        ),

        pool.query(`
          SELECT event_type, COUNT(*) AS count
          FROM capadex_audit_events
          ${where}
          GROUP BY event_type
          ORDER BY count DESC
        `, params),
      ]);

      res.json({
        rows:        rowsRes.rows,
        total:       parseInt(countRes.rows[0].count),
        event_types: typesRes.rows,
      });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/platform-audit — platform-wide admin action log ────────
  app.get('/api/admin/platform-audit', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        entity_type = '',
        action      = '',
        actor       = '',
        from        = '',
        to          = '',
        search      = '',
        limit       = '100',
        offset      = '0',
      } = req.query as Record<string, string>;

      const limitNum  = Math.min(Math.max(parseInt(limit,  10) || 100, 1), 500);
      const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

      // Lazy ensure schema exists (mirrors service helper)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS platform_audit_log (
          id           BIGSERIAL PRIMARY KEY,
          actor_id     VARCHAR(120) NOT NULL,
          actor_email  VARCHAR(200),
          actor_role   VARCHAR(40)  NOT NULL DEFAULT 'superadmin',
          action       VARCHAR(40)  NOT NULL,
          entity_type  VARCHAR(60)  NOT NULL,
          entity_id    VARCHAR(40),
          entity_label VARCHAR(250),
          before_state JSONB,
          after_state  JSONB,
          metadata     JSONB,
          ip_address   VARCHAR(60),
          created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pal_created ON platform_audit_log(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_pal_entity  ON platform_audit_log(entity_type, entity_id);
      `).catch(() => null);

      const conds: string[] = [];
      const params: unknown[] = [];
      let p = 1;

      if (entity_type) { conds.push(`entity_type = $${p++}`); params.push(entity_type); }
      if (action)      { conds.push(`action = $${p++}`);      params.push(action); }
      if (actor)       { conds.push(`(actor_id ILIKE $${p} OR actor_email ILIKE $${p})`); params.push(`%${actor}%`); p++; }
      if (from)        { conds.push(`created_at >= $${p++}`); params.push(from); }
      if (to)          { conds.push(`created_at <= $${p++}`); params.push(to); }
      if (search)      { conds.push(`(entity_label ILIKE $${p} OR entity_id ILIKE $${p} OR action ILIKE $${p})`); params.push(`%${search}%`); p++; }

      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

      const [rowsRes, countRes, typesRes] = await Promise.all([
        pool.query(
          `SELECT id, actor_id, actor_email, actor_role, action, entity_type, entity_id, entity_label, before_state, after_state, metadata, ip_address, created_at
           FROM platform_audit_log ${where}
           ORDER BY created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
          [...params, limitNum, offsetNum]
        ),
        pool.query(`SELECT COUNT(*)::int AS count FROM platform_audit_log ${where}`, params),
        pool.query(
          `SELECT entity_type, COUNT(*)::int AS count FROM platform_audit_log GROUP BY entity_type ORDER BY count DESC`
        ),
      ]);

      res.json({
        rows:         rowsRes.rows,
        total:        countRes.rows[0]?.count ?? 0,
        entity_types: typesRes.rows,
      });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/audit/governance ──────────────────────────────────────
  // Returns stats for the Ethics & Governance panel
  app.get('/api/admin/audit/governance', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [
        consentRes,
        eventVolumeRes,
        retentionRes,
      ] = await Promise.all([
        // Consent counts
        pool.query(`
          SELECT
            COUNT(*)                                           AS total,
            COUNT(*) FILTER (WHERE consented = true)          AS active,
            COUNT(*) FILTER (WHERE consented = false)         AS withdrawn,
            COUNT(DISTINCT COALESCE(guest_email, user_id::text)) AS unique_users
          FROM capadex_consent_records
        `).catch(() => ({ rows: [{ total: 0, active: 0, withdrawn: 0, unique_users: 0 }] })),

        // Audit event volume by type — last 30 days
        pool.query(`
          SELECT
            event_type,
            COUNT(*) AS count,
            DATE(MAX(created_at)) AS last_seen
          FROM capadex_audit_events
          WHERE created_at >= now() - interval '30 days'
          GROUP BY event_type
          ORDER BY count DESC
        `).catch(() => ({ rows: [] })),

        // Data retention row counts
        pool.query(`
          SELECT
            (SELECT COUNT(*) FROM capadex_users)     AS users,
            (SELECT COUNT(*) FROM capadex_sessions)  AS sessions,
            (SELECT COUNT(*) FROM capadex_reports)   AS reports,
            (SELECT COUNT(*) FROM capadex_responses) AS responses
        `).catch(() => ({ rows: [{ users: 0, sessions: 0, reports: 0, responses: 0 }] })),
      ]);

      res.json({
        consent:       consentRes.rows[0],
        event_volume:  eventVolumeRes.rows,
        retention:     retentionRes.rows[0],
      });
    } catch (err) { next(err); }
  });
}
