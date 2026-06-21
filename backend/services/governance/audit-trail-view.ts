/**
 * Phase 6.9 — Enterprise Governance · Audit Trail view (deliverable: audit_engine). READ-ONLY.
 *
 * COMPOSES (never recomputes) the EXISTING audit substrate that the canonical security-center
 * middleware + governance audit engine already write:
 *   • admin_audit_logs   — every mutating admin HTTP action + semantic governance events
 *   • rbac_failed_logins — captured auth failures (suspicious-activity feed)
 *
 * GET-NEVER-WRITES: probes table existence with to_regclass; NEVER calls ensureGovernanceSchema
 * (that path runs DDL). Absent table → substrate=false honest zeros (distinct from an empty present
 * table). Never throws, never fabricates. Reuses the PURE deriveCategory() classifier (no DDL).
 */
import type { Pool } from 'pg';
import { deriveCategory } from './audit-engine';

async function tableExists(pool: Pool, name: string, onError?: () => void): Promise<boolean> {
  try {
    const { rows } = await pool.query(`SELECT to_regclass($1) AS oid`, [name]);
    return rows[0]?.oid != null;
  } catch {
    onError?.();
    return false;
  }
}

export interface AuditTrailView {
  generated_at: string;
  degraded: boolean;
  substrate: { admin_audit_logs: boolean; rbac_failed_logins: boolean };
  audit: {
    total: number;
    last_30d: number;
    by_category: { category: string; events: number }[];
    recent: {
      id: any;
      admin_user_id: string | null;
      action_type: string | null;
      target_type: string | null;
      target_id: string | null;
      category: string;
      ip_address: string | null;
      created_at: any;
    }[];
  };
  failed_logins: {
    total: number;
    last_24h: number;
    recent: { id: any; email: string | null; ip_address: string | null; reason: string | null; created_at: any }[];
  };
  notes: string[];
}

/** Phase 6.9 read-only audit trail view. Never throws, never fabricates. */
export async function buildAuditTrailView(pool: Pool): Promise<AuditTrailView> {
  let degraded = false;
  const fail = () => { degraded = true; };
  const notes: string[] = [];

  const hasAudit = await tableExists(pool, 'public.admin_audit_logs', fail);
  const hasFails = await tableExists(pool, 'public.rbac_failed_logins', fail);

  const out: AuditTrailView = {
    generated_at: new Date().toISOString(),
    degraded,
    substrate: { admin_audit_logs: hasAudit, rbac_failed_logins: hasFails },
    audit: { total: 0, last_30d: 0, by_category: [], recent: [] },
    failed_logins: { total: 0, last_24h: 0, recent: [] },
    notes,
  };

  if (hasAudit) {
    try {
      const totals = (
        await pool.query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS last_30d
           FROM admin_audit_logs`
        )
      ).rows[0];
      out.audit.total = Number(totals?.total) || 0;
      out.audit.last_30d = Number(totals?.last_30d) || 0;

      const cats = (
        await pool.query(
          `SELECT action_type, target_type, COUNT(*)::int AS c
           FROM admin_audit_logs GROUP BY action_type, target_type`
        )
      ).rows;
      const byCat: Record<string, number> = {};
      for (const r of cats) {
        const cat = deriveCategory(r.action_type, r.target_type);
        byCat[cat] = (byCat[cat] || 0) + (Number(r.c) || 0);
      }
      out.audit.by_category = Object.entries(byCat)
        .map(([category, events]) => ({ category, events }))
        .sort((a, b) => b.events - a.events);

      out.audit.recent = (
        await pool.query(
          `SELECT id, admin_user_id, action_type, target_type, target_id, ip_address, created_at
           FROM admin_audit_logs ORDER BY created_at DESC LIMIT 50`
        )
      ).rows.map((r: any) => ({
        id: r.id,
        admin_user_id: r.admin_user_id,
        action_type: r.action_type,
        target_type: r.target_type,
        target_id: r.target_id,
        category: deriveCategory(r.action_type, r.target_type),
        ip_address: r.ip_address,
        created_at: r.created_at,
      }));
    } catch {
      degraded = true;
      notes.push('Audit log read failed — audit figures may be incomplete.');
    }
  } else {
    notes.push('admin_audit_logs absent — no audit trail recorded yet (honest no_substrate).');
  }

  if (hasFails) {
    try {
      const totals = (
        await pool.query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS last_24h
           FROM rbac_failed_logins`
        )
      ).rows[0];
      out.failed_logins.total = Number(totals?.total) || 0;
      out.failed_logins.last_24h = Number(totals?.last_24h) || 0;
      out.failed_logins.recent = (
        await pool.query(
          `SELECT id, email, ip_address, reason, created_at
           FROM rbac_failed_logins ORDER BY created_at DESC LIMIT 50`
        )
      ).rows;
    } catch {
      degraded = true;
      notes.push('Failed-login read failed — security feed may be incomplete.');
    }
  } else {
    notes.push('rbac_failed_logins absent — no failed logins captured yet (honest no_substrate).');
  }

  out.degraded = degraded;
  return out;
}
