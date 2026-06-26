// ============================================================
// Governance / Audit engine (Critical Gap #3)
// ------------------------------------------------------------
// REUSES the canonical admin_audit_logs table (no parallel audit system). The
// global middleware in security-center.ts records mutating HTTP actions; this
// engine adds SEMANTIC events (login/logout/role_change/...) and the categorized
// read surface, plus failed-login capture in rbac_failed_logins.
// Never throws — auditing must never break the action it observes.
// ============================================================

import type { Pool } from "pg";
import { ensureGovernanceSchema } from "./rbac-schema";
import { redactJson } from "../../lib/redact";

export type AuditCategory =
  | "login" | "logout" | "create" | "update" | "delete"
  | "payment" | "invoice" | "assessment" | "subscription"
  | "role_change" | "permission_change" | "other";

export const AUDIT_CATEGORIES: AuditCategory[] = [
  "login", "logout", "create", "update", "delete",
  "payment", "invoice", "assessment", "subscription",
  "role_change", "permission_change",
];

export interface AuditEntry {
  category: AuditCategory;
  adminUserId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  notes?: string | null;
  previousState?: any;
  newState?: any;
  ip?: string | null;
}

// Write a semantic audit row. action_type carries the category; fire-and-forget.
export async function recordGovernanceAudit(pool: Pool, e: AuditEntry): Promise<void> {
  try {
    await ensureGovernanceSchema(pool);
    await pool.query(
      `INSERT INTO admin_audit_logs
         (admin_user_id, action_type, target_type, target_id, previous_state, new_state, notes, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        e.adminUserId ?? null,
        e.category,
        e.targetType ?? e.category,
        e.targetId ?? e.category,
        redactJson(e.previousState, 4000),
        redactJson(e.newState, 4000),
        (e.notes ?? "").slice(0, 1000) || null,
        e.ip ?? null,
      ]
    );
  } catch {
    /* never throw from audit */
  }
}

export async function recordFailedLogin(
  pool: Pool,
  d: { email?: string | null; ip?: string | null; reason?: string | null; userAgent?: string | null }
): Promise<void> {
  try {
    await ensureGovernanceSchema(pool);
    await pool.query(
      `INSERT INTO rbac_failed_logins (email, ip_address, reason, user_agent)
       VALUES ($1,$2,$3,$4)`,
      [d.email ?? null, d.ip ?? null, (d.reason ?? "invalid_credentials").slice(0, 200), (d.userAgent ?? "").slice(0, 400) || null]
    );
  } catch {
    /* never throw */
  }
}

// Derive a stable category for rows the global middleware wrote with an HTTP
// method as action_type (the semantic helper already stores the category).
export function deriveCategory(actionType: string, targetType: string): AuditCategory {
  const a = (actionType || "").toLowerCase();
  if ((AUDIT_CATEGORIES as string[]).includes(a)) return a as AuditCategory;
  const t = (targetType || "").toLowerCase();
  if (/payment/.test(t)) return "payment";
  if (/invoice/.test(t)) return "invoice";
  if (/subscription/.test(t)) return "subscription";
  if (/assessment|capadex|competency/.test(t)) return "assessment";
  if (/role/.test(t)) return "role_change";
  if (/permission/.test(t)) return "permission_change";
  if (a === "post") return "create";
  if (a === "put" || a === "patch") return "update";
  if (a === "delete") return "delete";
  return "other";
}

export async function queryAuditEvents(
  pool: Pool,
  opts: { category?: string; limit?: number; targetType?: string } = {}
): Promise<{ events: any[]; total: number; byCategory: Record<string, number> }> {
  try {
    await ensureGovernanceSchema(pool);
    const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 1000);
    const rows = (
      await pool.query(
        `SELECT id, admin_user_id, action_type, target_type, target_id, notes, ip_address, created_at
         FROM admin_audit_logs ORDER BY created_at DESC LIMIT $1`,
        [limit]
      )
    ).rows;
    const enriched = rows.map((r: any) => ({
      ...r,
      category: deriveCategory(r.action_type, r.target_type),
    }));
    const byCategory: Record<string, number> = {};
    for (const r of enriched) byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    let events = enriched;
    if (opts.category) events = events.filter((e) => e.category === opts.category);
    if (opts.targetType) events = events.filter((e) => (e.target_type || "") === opts.targetType);
    return { events, total: events.length, byCategory };
  } catch {
    return { events: [], total: 0, byCategory: {} };
  }
}

export async function queryFailedLogins(pool: Pool, limit = 200): Promise<any[]> {
  try {
    await ensureGovernanceSchema(pool);
    const lim = Math.min(Math.max(Number(limit) || 200, 1), 1000);
    return (
      await pool.query(
        `SELECT id, email, ip_address, reason, user_agent, created_at
         FROM rbac_failed_logins ORDER BY created_at DESC LIMIT $1`,
        [lim]
      )
    ).rows;
  } catch {
    return [];
  }
}
