/**
 * platform-audit.ts
 * Best-effort audit logger for all super-admin ontology mutations.
 * Never throws — failures are swallowed so they never break a request.
 */
import type { Pool } from 'pg';
import type { Request } from 'express';

export type AuditAction =
  | 'create' | 'update' | 'archive' | 'delete'
  | 'import' | 'export'
  | 'submit_review' | 'approve' | 'reject';

export interface AuditEntry {
  action:       AuditAction;
  entityType:   string;
  entityId?:    string | number | null;
  entityLabel?: string | null;
  before?:      unknown;
  after?:       unknown;
  metadata?:    unknown;
}

let _schemaReady = false;

async function ensureAuditSchema(pool: Pool): Promise<void> {
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
  `);
  _schemaReady = true;
}

export function actorFromReq(req: Request): { actorId: string; actorEmail?: string; ip?: string } {
  const s = (req as unknown as { session?: { userId?: string; user?: { email?: string } } }).session;
  return {
    actorId:    s?.userId ?? (req.headers['x-actor-id'] as string) ?? 'unknown',
    actorEmail: s?.user?.email,
    ip:         (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
                ?? req.socket?.remoteAddress,
  };
}

export async function logAudit(
  pool: Pool,
  req: Request,
  entry: AuditEntry,
): Promise<void> {
  try {
    await ensureAuditSchema(pool);
    const { actorId, actorEmail, ip } = actorFromReq(req);
    await pool.query(
      `INSERT INTO platform_audit_log
         (actor_id, actor_email, action, entity_type, entity_id, entity_label,
          before_state, after_state, metadata, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        actorId,
        actorEmail ?? null,
        entry.action,
        entry.entityType,
        entry.entityId != null ? String(entry.entityId) : null,
        entry.entityLabel ?? null,
        entry.before  != null ? JSON.stringify(entry.before)  : null,
        entry.after   != null ? JSON.stringify(entry.after)   : null,
        entry.metadata != null ? JSON.stringify(entry.metadata) : null,
        ip ?? null,
      ],
    );
  } catch {
    /* audit is best-effort — never propagate */
  }
}
