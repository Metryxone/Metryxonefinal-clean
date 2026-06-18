/**
 * Platform Approval Workflow Routes
 *
 * Lightweight review queue for all ontology module changes.
 * Any super-admin can submit items; reviewers approve or reject with a comment.
 *
 * POST   /api/admin/approvals/submit     — submit an item for review
 * GET    /api/admin/approvals            — list requests (filterable, paginated)
 * POST   /api/admin/approvals/:id/decide — approve | reject | cancel
 * GET    /api/admin/approvals/stats      — counts by status/entity_type
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { logAudit } from '../services/platform-audit.js';

type Auth = (req: Request, res: Response, next: () => void) => void;

let _schemaReady = false;

async function ensureApprovalSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_approval_requests (
      id               BIGSERIAL   PRIMARY KEY,
      entity_type      VARCHAR(60) NOT NULL,
      entity_id        VARCHAR(40) NOT NULL,
      entity_label     VARCHAR(250),
      change_summary   TEXT        NOT NULL,
      submitter_id     VARCHAR(120) NOT NULL,
      submitter_email  VARCHAR(200),
      reviewer_id      VARCHAR(120),
      reviewer_email   VARCHAR(200),
      status           VARCHAR(20) NOT NULL DEFAULT 'pending',
      reviewer_comment TEXT,
      priority         VARCHAR(20) NOT NULL DEFAULT 'normal',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      decided_at       TIMESTAMPTZ,
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_par_status    ON platform_approval_requests(status);
    CREATE INDEX IF NOT EXISTS idx_par_entity    ON platform_approval_requests(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_par_submitter ON platform_approval_requests(submitter_id);
    CREATE INDEX IF NOT EXISTS idx_par_created   ON platform_approval_requests(created_at DESC);
  `);
  _schemaReady = true;
}

function actorFromReq(req: Request) {
  const s = (req as unknown as { session?: { userId?: string; user?: { email?: string } } }).session;
  return {
    id:    s?.userId ?? (req.headers['x-actor-id'] as string) ?? 'unknown',
    email: s?.user?.email ?? null,
  };
}

export function registerPlatformApprovalRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {

  // ── Submit for review ──────────────────────────────────────────────────────
  app.post('/api/admin/approvals/submit', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureApprovalSchema(pool);
      const { entity_type, entity_id, entity_label, change_summary, priority = 'normal' } = req.body ?? {};
      if (!entity_type || !entity_id || !change_summary) {
        return res.status(400).json({ error: 'entity_type, entity_id and change_summary are required' });
      }
      const VALID_PRIORITIES = ['low', 'normal', 'high', 'critical'];
      if (!VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: 'priority must be low|normal|high|critical' });
      }
      const actor = actorFromReq(req);

      // Cancel any still-pending request for this same entity
      await pool.query(
        `UPDATE platform_approval_requests SET status='cancelled', updated_at=NOW()
         WHERE entity_type=$1 AND entity_id=$2 AND status='pending'`,
        [entity_type, String(entity_id)]
      );

      const { rows: [row] } = await pool.query(
        `INSERT INTO platform_approval_requests
           (entity_type, entity_id, entity_label, change_summary, submitter_id, submitter_email, priority)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [entity_type, String(entity_id), entity_label ?? null, change_summary, actor.id, actor.email, priority]
      );
      void logAudit(pool, req, {
        action: 'submit_review',
        entityType: entity_type,
        entityId:   entity_id,
        entityLabel: entity_label ?? null,
        after: { approval_id: row.id, change_summary },
      });
      return res.status(201).json({ request: row });
    } catch (err) {
      console.error('[platform-approval] submit error:', err);
      return res.status(500).json({ error: 'Failed to submit for review' });
    }
  });

  // ── List requests ──────────────────────────────────────────────────────────
  // Register /stats BEFORE /:id so param handler does not swallow it
  app.get('/api/admin/approvals/stats', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureApprovalSchema(pool);
      const { rows } = await pool.query(
        `SELECT status, entity_type, COUNT(*)::int AS count
         FROM platform_approval_requests
         GROUP BY status, entity_type
         ORDER BY status, entity_type`
      );
      const byStatus: Record<string, number> = {};
      const byType:   Record<string, number> = {};
      for (const r of rows) {
        byStatus[r.status]      = (byStatus[r.status] ?? 0) + r.count;
        byType[r.entity_type]   = (byType[r.entity_type] ?? 0) + r.count;
      }
      return res.json({ byStatus, byType, rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  app.get('/api/admin/approvals', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureApprovalSchema(pool);
      const {
        status = 'all',
        entity_type = 'all',
        submitter_id = '',
        priority = 'all',
        search = '',
        limit = '50',
        offset = '0',
      } = req.query as Record<string, string>;

      const params: unknown[] = [];
      const conds: string[] = [];
      if (status !== 'all') { params.push(status); conds.push(`status = $${params.length}`); }
      if (entity_type !== 'all') { params.push(entity_type); conds.push(`entity_type = $${params.length}`); }
      if (priority !== 'all') { params.push(priority); conds.push(`priority = $${params.length}`); }
      if (submitter_id) { params.push(submitter_id); conds.push(`submitter_id = $${params.length}`); }
      if (search.trim()) {
        params.push(`%${search.trim()}%`);
        conds.push(`(entity_label ILIKE $${params.length} OR change_summary ILIKE $${params.length} OR entity_id ILIKE $${params.length})`);
      }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT * FROM platform_approval_requests ${where}
         ORDER BY
           CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
           created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), parseInt(offset)]
      );
      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM platform_approval_requests ${where}`,
        params
      );
      return res.json({ requests: rows, total: count });
    } catch (err) {
      console.error('[platform-approval] list error:', err);
      return res.status(500).json({ error: 'Failed to fetch approvals' });
    }
  });

  // ── Decide (approve / reject / cancel) ────────────────────────────────────
  app.post('/api/admin/approvals/:id/decide', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureApprovalSchema(pool);
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const { decision, comment = '' } = req.body ?? {};
      const VALID_DECISIONS = ['approved', 'rejected', 'cancelled'];
      if (!VALID_DECISIONS.includes(decision)) {
        return res.status(400).json({ error: 'decision must be approved|rejected|cancelled' });
      }
      const { rows: [existing] } = await pool.query(
        `SELECT * FROM platform_approval_requests WHERE id=$1`, [id]
      );
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (existing.status !== 'pending') {
        return res.status(409).json({ error: `Request is already ${existing.status}` });
      }
      const actor = actorFromReq(req);
      const { rows: [row] } = await pool.query(
        `UPDATE platform_approval_requests
         SET status=$1, reviewer_id=$2, reviewer_email=$3, reviewer_comment=$4,
             decided_at=NOW(), updated_at=NOW()
         WHERE id=$5 RETURNING *`,
        [decision, actor.id, actor.email, comment || null, id]
      );
      void logAudit(pool, req, {
        action:      decision === 'approved' ? 'approve' : 'reject',
        entityType:  existing.entity_type,
        entityId:    existing.entity_id,
        entityLabel: existing.entity_label,
        metadata: { approval_id: id, decision, comment: comment || null },
      });
      return res.json({ request: row });
    } catch (err) {
      console.error('[platform-approval] decide error:', err);
      return res.status(500).json({ error: 'Failed to process decision' });
    }
  });

  // ── Single request detail ─────────────────────────────────────────────────
  app.get('/api/admin/approvals/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureApprovalSchema(pool);
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [row] } = await pool.query(`SELECT * FROM platform_approval_requests WHERE id=$1`, [id]);
      if (!row) return res.status(404).json({ error: 'Not found' });
      return res.json({ request: row });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch request' });
    }
  });
}
