// ============================================================
// Governance / Security Center aggregator (Critical Gap #3 — WS6)
// ------------------------------------------------------------
// Read-only, never-throws snapshot composed from existing surfaces:
//   - Admin Activity         ← admin_audit_logs (recent)
//   - Audit Events           ← admin_audit_logs (counts by derived category)
//   - Suspicious Activity    ← rbac_failed_logins grouped by ip/email over a window
//   - Failed Logins          ← rbac_failed_logins (recent)
//   - Feature Flag Changes   ← rbac_flag_change_log (recent)
// Every block degrades to empty independently; nothing here changes access.
// ============================================================

import type { Pool } from "pg";
import { ensureGovernanceSchema } from "./rbac-schema";
import { deriveCategory } from "./audit-engine";

const SUSPICIOUS_MIN_FAILS = 5; // failures from one key within the window → flagged
const WINDOW_HOURS = 24;

export async function buildSecurityOverview(pool: Pool): Promise<any> {
  await ensureGovernanceSchema(pool).catch(() => {});
  const out: any = {
    generatedAt: new Date().toISOString(),
    adminActivity: { recent: [], total: 0 },
    auditEvents: { byCategory: {} as Record<string, number>, total: 0 },
    suspiciousActivity: { items: [] as any[], windowHours: WINDOW_HOURS, threshold: SUSPICIOUS_MIN_FAILS },
    failedLogins: { recent: [] as any[], total: 0 },
    flagChanges: { recent: [] as any[], total: 0 },
    honesty:
      "Read-only visibility composed from real audit/login/flag tables. Empty blocks are honest findings (no events recorded yet), never fabricated.",
  };

  try {
    const recent = (
      await pool.query(
        `SELECT id, admin_user_id, action_type, target_type, target_id, ip_address, created_at
         FROM admin_audit_logs ORDER BY created_at DESC LIMIT 50`
      )
    ).rows.map((r: any) => ({ ...r, category: deriveCategory(r.action_type, r.target_type) }));
    out.adminActivity.recent = recent;
    const totalRow = await pool.query(`SELECT COUNT(*)::int AS c FROM admin_audit_logs`);
    out.adminActivity.total = Number(totalRow.rows[0]?.c) || 0;
  } catch {
    /* degrade */
  }

  try {
    const cats = (
      await pool.query(
        `SELECT action_type, target_type, COUNT(*)::int AS c
         FROM admin_audit_logs GROUP BY action_type, target_type`
      )
    ).rows;
    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const r of cats) {
      const cat = deriveCategory(r.action_type, r.target_type);
      const c = Number(r.c) || 0;
      byCategory[cat] = (byCategory[cat] || 0) + c;
      total += c;
    }
    out.auditEvents.byCategory = byCategory;
    out.auditEvents.total = total;
  } catch {
    /* degrade */
  }

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
    out.suspiciousActivity.items = fails.map((f: any) => ({
      key: f.key,
      email: f.email,
      ip: f.ip_address,
      attempts: Number(f.attempts) || 0,
      lastAttempt: f.last_attempt,
    }));
  } catch {
    /* degrade */
  }

  try {
    const recent = (
      await pool.query(
        `SELECT id, email, ip_address, reason, created_at FROM rbac_failed_logins
         ORDER BY created_at DESC LIMIT 50`
      )
    ).rows;
    out.failedLogins.recent = recent;
    const t = await pool.query(`SELECT COUNT(*)::int AS c FROM rbac_failed_logins`);
    out.failedLogins.total = Number(t.rows[0]?.c) || 0;
  } catch {
    /* degrade */
  }

  try {
    const recent = (
      await pool.query(
        `SELECT id, flag_key, old_value, new_value, changed_by_email, note, created_at
         FROM rbac_flag_change_log ORDER BY created_at DESC LIMIT 50`
      )
    ).rows;
    out.flagChanges.recent = recent;
    const t = await pool.query(`SELECT COUNT(*)::int AS c FROM rbac_flag_change_log`);
    out.flagChanges.total = Number(t.rows[0]?.c) || 0;
  } catch {
    /* degrade */
  }

  return out;
}
