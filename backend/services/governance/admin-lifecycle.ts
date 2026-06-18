// ============================================================
// Governance / Admin lifecycle (Critical Gap #2 — WS3)
// ------------------------------------------------------------
// Admin directory + lifecycle status (active / suspended / terminated). Status
// is ADVISORY governance state recorded in rbac_admin_status — it is surfaced to
// operators but does NOT itself alter the live super_admin gate (we report that
// honestly). Reads never throw; status changes fail-closed + are audited.
// ============================================================

import type { Pool } from "pg";
import { ensureGovernanceSchema } from "./rbac-schema";
import { recordGovernanceAudit } from "./audit-engine";

const ADMIN_ROLES = ["super_admin", "admin", "platform_admin", "institution_admin", "employer_admin"];
export const ADMIN_STATUSES = ["active", "suspended", "terminated"] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];

export async function getAdminDirectory(pool: Pool): Promise<{ admins: any[]; total: number; byStatus: Record<string, number> }> {
  try {
    await ensureGovernanceSchema(pool);
    const placeholders = ADMIN_ROLES.map((_, i) => `$${i + 1}`).join(",");
    const rows = (
      await pool.query(
        `SELECT u.id, u.email, u.full_name, u.role, u.roles,
                COALESCE(s.status, 'active') AS status,
                s.reason, s.changed_by, s.changed_at
         FROM users u
         LEFT JOIN rbac_admin_status s ON s.admin_user_id = u.id::text
         WHERE u.role = ANY($${ADMIN_ROLES.length + 1}::text[])
            OR u.roles && $${ADMIN_ROLES.length + 1}::text[]
         ORDER BY u.role, u.email`,
        [...ADMIN_ROLES, ADMIN_ROLES]
      ).catch(async () => {
        // Fallback for schemas where roles array overlap operator differs.
        return pool.query(
          `SELECT u.id, u.email, u.full_name, u.role, u.roles,
                  COALESCE(s.status,'active') AS status, s.reason, s.changed_by, s.changed_at
           FROM users u LEFT JOIN rbac_admin_status s ON s.admin_user_id = u.id::text
           WHERE u.role IN (${placeholders}) ORDER BY u.role, u.email`,
          ADMIN_ROLES
        );
      })
    ).rows;
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    return { admins: rows, total: rows.length, byStatus };
  } catch {
    return { admins: [], total: 0, byStatus: {} };
  }
}

export async function setAdminStatus(
  pool: Pool,
  args: { adminUserId: string; status: AdminStatus; reason?: string | null; changedBy?: string | null }
): Promise<{ ok: boolean; status: AdminStatus }> {
  await ensureGovernanceSchema(pool);
  if (!ADMIN_STATUSES.includes(args.status)) {
    throw new Error(`invalid status: ${args.status}`);
  }
  const prev = (
    await pool.query(`SELECT status FROM rbac_admin_status WHERE admin_user_id=$1`, [args.adminUserId])
  ).rows[0]?.status ?? "active";
  await pool.query(
    `INSERT INTO rbac_admin_status (admin_user_id, status, reason, changed_by, changed_at)
     VALUES ($1,$2,$3,$4, now())
     ON CONFLICT (admin_user_id) DO UPDATE SET
       status = EXCLUDED.status, reason = EXCLUDED.reason,
       changed_by = EXCLUDED.changed_by, changed_at = now()`,
    [args.adminUserId, args.status, args.reason ?? null, args.changedBy ?? null]
  );
  await recordGovernanceAudit(pool, {
    category: "update",
    adminUserId: args.changedBy ?? null,
    targetType: "admin_status",
    targetId: args.adminUserId,
    previousState: { status: prev },
    newState: { status: args.status, reason: args.reason ?? null },
    notes: `admin lifecycle: ${prev} → ${args.status}`,
  });
  return { ok: true, status: args.status };
}
