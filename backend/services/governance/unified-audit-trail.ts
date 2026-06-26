/**
 * Unified Audit Trail (READ-ONLY).
 *
 * The platform writes audit events to FOUR separate tables with no single
 * queryable trail:
 *   • admin_audit_logs   — mutating /api/admin/* HTTP actions + semantic governance events
 *   • platform_audit_log — super-admin ontology mutations (create/update/approve/...)
 *   • capadex_audit_events — CAPADEX runtime/admin events (score_computed, status changes, ...)
 *   • rbac_failed_logins — captured authentication failures
 *
 * This composer normalises all four into ONE chronological stream with a
 * `source` discriminator, plus per-source substrate flags and counts. It is
 * strictly read-only: each table is probed with to_regclass (NO ensure-schema /
 * DDL), every source query is independently guarded, and a failure degrades that
 * source rather than throwing. Never fabricates rows.
 *
 * Privacy: the unified stream surfaces only event METADATA (actor, action,
 * category, target, ip, timestamp) — it never selects the raw
 * previous_state/new_state/before_state/after_state/payload blobs, so legacy
 * rows written before write-time redaction can never leak through this API.
 */
import type { Pool } from 'pg';
import { deriveCategory } from './audit-engine';

export type AuditSource =
  | 'admin_action'
  | 'platform_mutation'
  | 'capadex_event'
  | 'failed_login';

export interface UnifiedAuditEntry {
  source: AuditSource;
  id: string | number;
  actor: string | null;
  action: string | null;
  category: string;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  created_at: any;
}

export interface UnifiedAuditTrail {
  generated_at: string;
  degraded: boolean;
  /** Per-source presence (table exists) and recorded row totals. */
  sources: {
    source: AuditSource;
    table: string;
    present: boolean;
    total: number;
  }[];
  totals: { events: number; sources_present: number };
  by_category: { category: string; events: number }[];
  by_source: { source: AuditSource; events: number }[];
  /** Most-recent normalised events across ALL present sources, newest first. */
  recent: UnifiedAuditEntry[];
  notes: string[];
}

async function tableExists(pool: Pool, name: string, onError: () => void): Promise<boolean> {
  try {
    const { rows } = await pool.query(`SELECT to_regclass($1) AS oid`, [name]);
    return rows[0]?.oid != null;
  } catch {
    onError();
    return false;
  }
}

async function countRows(pool: Pool, table: string, onError: () => void): Promise<number> {
  try {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
    return Number(rows[0]?.c) || 0;
  } catch {
    onError();
    return 0;
  }
}

const str = (v: any): string | null => (v == null ? null : String(v));

/**
 * Build the unified, read-only audit trail. `limit` caps the merged recent
 * stream (default 100, max 500). Never throws, never fabricates.
 */
export async function buildUnifiedAuditTrail(
  pool: Pool,
  limit = 100,
): Promise<UnifiedAuditTrail> {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 500);
  let degraded = false;
  const fail = () => { degraded = true; };
  const notes: string[] = [];

  const SOURCES: { source: AuditSource; table: string }[] = [
    { source: 'admin_action', table: 'public.admin_audit_logs' },
    { source: 'platform_mutation', table: 'public.platform_audit_log' },
    { source: 'capadex_event', table: 'public.capadex_audit_events' },
    { source: 'failed_login', table: 'public.rbac_failed_logins' },
  ];

  const present: Record<AuditSource, boolean> = {
    admin_action: false, platform_mutation: false, capadex_event: false, failed_login: false,
  };
  const sources: UnifiedAuditTrail['sources'] = [];

  for (const s of SOURCES) {
    const exists = await tableExists(pool, s.table, fail);
    present[s.source] = exists;
    const total = exists ? await countRows(pool, s.table, fail) : 0;
    if (!exists) {
      notes.push(`${s.table} absent — no ${s.source} events recorded yet (honest no_substrate).`);
    }
    sources.push({ source: s.source, table: s.table, present: exists, total });
  }

  const merged: UnifiedAuditEntry[] = [];

  if (present.admin_action) {
    try {
      const rows = (await pool.query(
        `SELECT id, admin_user_id, action_type, target_type, target_id, ip_address, created_at
         FROM admin_audit_logs ORDER BY created_at DESC LIMIT $1`, [cap],
      )).rows;
      for (const r of rows) {
        merged.push({
          source: 'admin_action',
          id: r.id,
          actor: str(r.admin_user_id),
          action: str(r.action_type),
          category: deriveCategory(r.action_type, r.target_type),
          target_type: str(r.target_type),
          target_id: str(r.target_id),
          ip_address: str(r.ip_address),
          created_at: r.created_at,
        });
      }
    } catch { degraded = true; notes.push('admin_audit_logs read failed — trail may be incomplete.'); }
  }

  if (present.platform_mutation) {
    try {
      const rows = (await pool.query(
        `SELECT id, actor_id, actor_email, action, entity_type, entity_id, ip_address, created_at
         FROM platform_audit_log ORDER BY created_at DESC LIMIT $1`, [cap],
      )).rows;
      for (const r of rows) {
        merged.push({
          source: 'platform_mutation',
          id: r.id,
          actor: str(r.actor_email) || str(r.actor_id),
          action: str(r.action),
          category: deriveCategory(r.action, r.entity_type),
          target_type: str(r.entity_type),
          target_id: str(r.entity_id),
          ip_address: str(r.ip_address),
          created_at: r.created_at,
        });
      }
    } catch { degraded = true; notes.push('platform_audit_log read failed — trail may be incomplete.'); }
  }

  if (present.capadex_event) {
    try {
      const rows = (await pool.query(
        `SELECT id, event_type, actor, user_id, session_id, created_at
         FROM capadex_audit_events ORDER BY created_at DESC LIMIT $1`, [cap],
      )).rows;
      for (const r of rows) {
        merged.push({
          source: 'capadex_event',
          id: r.id,
          actor: str(r.actor) || str(r.user_id),
          action: str(r.event_type),
          category: deriveCategory(r.event_type, 'capadex'),
          target_type: 'capadex_session',
          target_id: str(r.session_id),
          ip_address: null,
          created_at: r.created_at,
        });
      }
    } catch { degraded = true; notes.push('capadex_audit_events read failed — trail may be incomplete.'); }
  }

  if (present.failed_login) {
    try {
      const rows = (await pool.query(
        `SELECT id, email, ip_address, reason, created_at
         FROM rbac_failed_logins ORDER BY created_at DESC LIMIT $1`, [cap],
      )).rows;
      for (const r of rows) {
        merged.push({
          source: 'failed_login',
          id: r.id,
          actor: str(r.email),
          action: str(r.reason) || 'failed_login',
          category: 'login',
          target_type: 'auth',
          target_id: str(r.email),
          ip_address: str(r.ip_address),
          created_at: r.created_at,
        });
      }
    } catch { degraded = true; notes.push('rbac_failed_logins read failed — trail may be incomplete.'); }
  }

  // Merge chronologically (newest first) across sources, then cap.
  merged.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
  const recent = merged.slice(0, cap);

  const byCat: Record<string, number> = {};
  const bySrc: Record<string, number> = {};
  for (const e of merged) {
    byCat[e.category] = (byCat[e.category] || 0) + 1;
    bySrc[e.source] = (bySrc[e.source] || 0) + 1;
  }

  const sourcesPresent = sources.filter((s) => s.present).length;
  if (sourcesPresent === 0) {
    notes.push('No audit substrate present — unified trail is empty (honest no_substrate).');
  }

  return {
    generated_at: new Date().toISOString(),
    degraded,
    sources,
    totals: {
      events: sources.reduce((acc, s) => acc + s.total, 0),
      sources_present: sourcesPresent,
    },
    by_category: Object.entries(byCat)
      .map(([category, events]) => ({ category, events }))
      .sort((a, b) => b.events - a.events),
    by_source: Object.entries(bySrc)
      .map(([source, events]) => ({ source: source as AuditSource, events }))
      .sort((a, b) => b.events - a.events),
    recent,
    notes,
  };
}
