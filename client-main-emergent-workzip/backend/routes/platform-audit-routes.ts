/**
 * Platform Audit Log — Read API
 *
 * GET /api/admin/platform-audit
 *   Filterable, paginated view of the platform_audit_log table.
 *   Query params:
 *     entity_type  — filter by module (e.g. "industries", "layers")
 *     action       — create | update | archive | delete | import | export | submit_review | approve | reject
 *     actor        — partial match on actor_id or actor_email
 *     search       — partial match on entity_label or entity_id
 *     from         — ISO date string (inclusive)
 *     to           — ISO date string (inclusive)
 *     limit        — default 50, max 200
 *     offset       — default 0
 *
 * Returns:
 *   { rows: AuditRow[]; total: number; entity_types: { entity_type: string; count: number }[] }
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

type Auth = (req: Request, res: Response, next: () => void) => void;

let _schemaReady = false;

async function ensureSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
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
    CREATE INDEX IF NOT EXISTS idx_pal_actor   ON platform_audit_log(actor_id);
    CREATE INDEX IF NOT EXISTS idx_pal_action  ON platform_audit_log(action);
  `);
  _schemaReady = true;
}

export function registerPlatformAuditRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {

  // ── Stats sidebar (entity-type distribution) ───────────────────────────────
  // Register /stats BEFORE the generic handler to avoid param-swallow
  app.get('/api/admin/platform-audit/stats', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const { rows: byType } = await pool.query(
        `SELECT entity_type, action, COUNT(*)::int AS count
         FROM platform_audit_log
         GROUP BY entity_type, action
         ORDER BY count DESC`
      );
      const { rows: [{ total }] } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM platform_audit_log`
      );
      return res.json({ byType, total });
    } catch (err) {
      console.error('[platform-audit] stats error:', err);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // ── Main paginated list ────────────────────────────────────────────────────
  app.get('/api/admin/platform-audit', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const {
        entity_type = '',
        action      = '',
        actor       = '',
        search      = '',
        from        = '',
        to          = '',
        limit       = '50',
        offset      = '0',
      } = req.query as Record<string, string>;

      const safeLimit  = Math.min(200, Math.max(1, parseInt(limit) || 50));
      const safeOffset = Math.max(0, parseInt(offset) || 0);

      const params: unknown[] = [];
      const conds: string[] = [];

      if (entity_type.trim()) {
        params.push(entity_type.trim());
        conds.push(`entity_type = $${params.length}`);
      }
      if (action.trim()) {
        params.push(action.trim());
        conds.push(`action = $${params.length}`);
      }
      if (actor.trim()) {
        params.push(`%${actor.trim()}%`);
        conds.push(`(actor_id ILIKE $${params.length} OR actor_email ILIKE $${params.length})`);
      }
      if (search.trim()) {
        params.push(`%${search.trim()}%`);
        conds.push(`(entity_label ILIKE $${params.length} OR entity_id ILIKE $${params.length})`);
      }
      if (from.trim()) {
        params.push(from.trim());
        conds.push(`created_at >= $${params.length}::date`);
      }
      if (to.trim()) {
        params.push(to.trim());
        conds.push(`created_at < ($${params.length}::date + INTERVAL '1 day')`);
      }

      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

      // Rows
      const { rows } = await pool.query(
        `SELECT * FROM platform_audit_log ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, safeLimit, safeOffset]
      );

      // Total count
      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM platform_audit_log ${where}`,
        params
      );

      // Entity-type facets (unfiltered by entity_type so pills always show)
      const { rows: entity_types } = await pool.query(
        `SELECT entity_type, COUNT(*)::int AS count
         FROM platform_audit_log
         GROUP BY entity_type
         ORDER BY count DESC`
      );

      return res.json({ rows, total: count, entity_types });
    } catch (err) {
      console.error('[platform-audit] list error:', err);
      return res.status(500).json({ error: 'Failed to fetch audit log' });
    }
  });
}
