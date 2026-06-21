/**
 * Phase 6.9 — Enterprise Governance · Security Center view (deliverable: security_center). READ-ONLY.
 *
 * COMPOSES (never recomputes) the EXISTING RBAC + security substrate into a posture snapshot:
 *   • RBAC posture        — role_definitions / permission_definitions / role_permissions /
 *                           rbac_role_hierarchies / rbac_permission_groups / rbac_admin_status counts
 *   • Live-vs-formal gap  — count of live super_admin users (users.role) vs formally-defined roles
 *   • Flag changes        — rbac_flag_change_log (recent + total)
 *   • Suspicious activity — rbac_failed_logins grouped over a 24h window above a threshold
 *
 * GET-NEVER-WRITES: to_regclass probes only, NEVER ensureGovernanceSchema (DDL). Absent table →
 * substrate=false honest zeros. Never throws, never fabricates.
 */
import type { Pool } from 'pg';

const SUSPICIOUS_MIN_FAILS = 5;
const WINDOW_HOURS = 24;

async function tableExists(pool: Pool, name: string, onError?: () => void): Promise<boolean> {
  try {
    const { rows } = await pool.query(`SELECT to_regclass($1) AS oid`, [name]);
    return rows[0]?.oid != null;
  } catch {
    onError?.();
    return false;
  }
}

async function count(pool: Pool, table: string, onError?: () => void): Promise<number> {
  try {
    const r = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
    return Number(r.rows[0]?.c) || 0;
  } catch {
    // Honesty: an unreadable PRESENT table is degraded substrate, NOT a true zero.
    onError?.();
    return 0;
  }
}

export interface SecurityCenterView {
  generated_at: string;
  degraded: boolean;
  substrate: {
    role_definitions: boolean;
    permission_definitions: boolean;
    role_permissions: boolean;
    rbac_role_hierarchies: boolean;
    rbac_permission_groups: boolean;
    rbac_admin_status: boolean;
    rbac_flag_change_log: boolean;
    rbac_failed_logins: boolean;
    users: boolean;
  };
  rbac: {
    roles: number;
    permissions: number;
    grants: number;
    hierarchies: number;
    permission_groups: number;
    admin_status_rows: number;
  };
  live_vs_formal: {
    live_super_admins: number | null; // null when users table/role col unreadable
    formal_roles: number;
    note: string;
  };
  flag_changes: { total: number; recent: { id: any; flag_key: string; old_value: string | null; new_value: string | null; changed_by_email: string | null; created_at: any }[] };
  suspicious_activity: { window_hours: number; threshold: number; items: { key: string; email: string | null; ip: string | null; attempts: number; last_attempt: any }[] };
  notes: string[];
}

/** Phase 6.9 read-only security center view. Never throws, never fabricates. */
export async function buildSecurityCenterView(pool: Pool): Promise<SecurityCenterView> {
  let degraded = false;
  const fail = () => { degraded = true; };
  const notes: string[] = [];

  const sub = {
    role_definitions: await tableExists(pool, 'public.role_definitions', fail),
    permission_definitions: await tableExists(pool, 'public.permission_definitions', fail),
    role_permissions: await tableExists(pool, 'public.role_permissions', fail),
    rbac_role_hierarchies: await tableExists(pool, 'public.rbac_role_hierarchies', fail),
    rbac_permission_groups: await tableExists(pool, 'public.rbac_permission_groups', fail),
    rbac_admin_status: await tableExists(pool, 'public.rbac_admin_status', fail),
    rbac_flag_change_log: await tableExists(pool, 'public.rbac_flag_change_log', fail),
    rbac_failed_logins: await tableExists(pool, 'public.rbac_failed_logins', fail),
    users: await tableExists(pool, 'public.users', fail),
  };

  const out: SecurityCenterView = {
    generated_at: new Date().toISOString(),
    degraded,
    substrate: sub,
    rbac: { roles: 0, permissions: 0, grants: 0, hierarchies: 0, permission_groups: 0, admin_status_rows: 0 },
    live_vs_formal: { live_super_admins: null, formal_roles: 0, note: '' },
    flag_changes: { total: 0, recent: [] },
    suspicious_activity: { window_hours: WINDOW_HOURS, threshold: SUSPICIOUS_MIN_FAILS, items: [] },
    notes,
  };

  const countFail = () => { degraded = true; notes.push('An RBAC count query failed — posture figures may be incomplete (unreadable substrate, not a true zero).'); };
  if (sub.role_definitions) out.rbac.roles = await count(pool, 'role_definitions', countFail);
  if (sub.permission_definitions) out.rbac.permissions = await count(pool, 'permission_definitions', countFail);
  if (sub.role_permissions) out.rbac.grants = await count(pool, 'role_permissions', countFail);
  if (sub.rbac_role_hierarchies) out.rbac.hierarchies = await count(pool, 'rbac_role_hierarchies', countFail);
  if (sub.rbac_permission_groups) out.rbac.permission_groups = await count(pool, 'rbac_permission_groups', countFail);
  if (sub.rbac_admin_status) out.rbac.admin_status_rows = await count(pool, 'rbac_admin_status', countFail);

  out.live_vs_formal.formal_roles = out.rbac.roles;
  if (sub.users) {
    try {
      const r = await pool.query(`SELECT COUNT(*)::int AS c FROM users WHERE role = 'super_admin'`);
      out.live_vs_formal.live_super_admins = Number(r.rows[0]?.c) || 0;
    } catch {
      degraded = true;
      out.live_vs_formal.live_super_admins = null;
    }
  }
  out.live_vs_formal.note =
    out.live_vs_formal.live_super_admins == null
      ? 'Live super_admin count unreadable — reporting formal RBAC only.'
      : `Live access is governed by the users.role super_admin gate (${out.live_vs_formal.live_super_admins}); formal RBAC defines ${out.rbac.roles} role(s). These are separate axes — formal RBAC is advisory, the live gate is authoritative.`;

  if (sub.rbac_flag_change_log) {
    try {
      out.flag_changes.total = await count(pool, 'rbac_flag_change_log', fail);
      out.flag_changes.recent = (
        await pool.query(
          `SELECT id, flag_key, old_value, new_value, changed_by_email, created_at
           FROM rbac_flag_change_log ORDER BY created_at DESC LIMIT 50`
        )
      ).rows;
    } catch {
      degraded = true;
      notes.push('rbac_flag_change_log read failed — flag-change history may be incomplete.');
    }
  }

  if (sub.rbac_failed_logins) {
    try {
      const fails = (
        await pool.query(
          `SELECT COALESCE(NULLIF(email,''), ip_address, 'unknown') AS key,
                  email, ip_address, COUNT(*)::int AS attempts, MAX(created_at) AS last_attempt
           FROM rbac_failed_logins
           WHERE created_at > now() - ($1 || ' hours')::interval
           GROUP BY 1, email, ip_address
           HAVING COUNT(*) >= $2
           ORDER BY attempts DESC LIMIT 100`,
          [String(WINDOW_HOURS), SUSPICIOUS_MIN_FAILS]
        )
      ).rows;
      out.suspicious_activity.items = fails.map((f: any) => ({
        key: f.key, email: f.email, ip: f.ip_address,
        attempts: Number(f.attempts) || 0, last_attempt: f.last_attempt,
      }));
    } catch {
      degraded = true;
      notes.push('Suspicious-activity scan failed — security feed may be incomplete.');
    }
  }

  if (!sub.role_definitions && !sub.permission_definitions) {
    notes.push('RBAC tables absent — governance subsystem not activated yet (honest no_substrate).');
  }

  out.degraded = degraded;
  return out;
}
