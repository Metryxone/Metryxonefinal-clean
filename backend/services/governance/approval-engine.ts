// ============================================================
// Governance / Approval workflows (Critical Gap #2 — WS5)
// ------------------------------------------------------------
// Generalized request → decision workflow for sensitive operations. This engine
// RECORDS and TRACKS approvals; it does not itself execute the underlying action
// (refund/role change/etc.) — that stays with the owning subsystem. Decisions are
// super-admin only (enforced at the route). Fail-closed: a decision only applies
// to a still-pending request; everything is audited.
// ============================================================

import type { Pool } from "pg";
import { ensureGovernanceSchema } from "./rbac-schema";
import { recordGovernanceAudit } from "./audit-engine";

export const APPROVAL_TYPES = [
  "refund",
  "invoice_override",
  "role_assignment",
  "permission_escalation",
  "subscription_change",
  "data_deletion",
] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;

export async function createApprovalRequest(
  pool: Pool,
  args: {
    requestType: string;
    targetRef?: string | null;
    targetLabel?: string | null;
    payload?: any;
    requestedBy?: string | null;
    requestedByEmail?: string | null;
  }
): Promise<any> {
  await ensureGovernanceSchema(pool);
  if (!(APPROVAL_TYPES as readonly string[]).includes(args.requestType)) {
    throw new Error(`invalid request_type: ${args.requestType}`);
  }
  const row = (
    await pool.query(
      `INSERT INTO rbac_approval_requests
         (request_type, target_ref, target_label, payload, requested_by, requested_by_email, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending')
       RETURNING *`,
      [
        args.requestType,
        args.targetRef ?? null,
        args.targetLabel ?? null,
        JSON.stringify(args.payload ?? {}),
        args.requestedBy ?? null,
        args.requestedByEmail ?? null,
      ]
    )
  ).rows[0];
  await recordGovernanceAudit(pool, {
    category: "create",
    adminUserId: args.requestedBy ?? null,
    targetType: "approval_request",
    targetId: String(row.id),
    newState: { request_type: args.requestType, status: "pending" },
    notes: `approval requested: ${args.requestType}`,
  });
  return row;
}

export async function decideApproval(
  pool: Pool,
  args: { id: string; decision: "approved" | "rejected"; decidedBy?: string | null; reason?: string | null }
): Promise<{ ok: boolean; status?: string; reason?: string }> {
  await ensureGovernanceSchema(pool);
  if (args.decision !== "approved" && args.decision !== "rejected") {
    throw new Error("decision must be approved or rejected");
  }
  // Fail-closed: only a currently-pending request can be decided.
  const current = (
    await pool.query(`SELECT id, request_type, status FROM rbac_approval_requests WHERE id=$1`, [args.id])
  ).rows[0];
  if (!current) return { ok: false, reason: "not_found" };
  if (current.status !== "pending") return { ok: false, reason: `already_${current.status}` };

  const updated = (
    await pool.query(
      `UPDATE rbac_approval_requests
         SET status=$2, decided_by=$3, decision_reason=$4, decided_at=now()
       WHERE id=$1 AND status='pending'
       RETURNING *`,
      [args.id, args.decision, args.decidedBy ?? null, args.reason ?? null]
    )
  ).rows[0];
  if (!updated) return { ok: false, reason: "race_lost" };

  await recordGovernanceAudit(pool, {
    category: "update",
    adminUserId: args.decidedBy ?? null,
    targetType: "approval_request",
    targetId: String(args.id),
    previousState: { status: "pending" },
    newState: { status: args.decision, request_type: current.request_type },
    notes: `approval ${args.decision}: ${current.request_type}`,
  });
  return { ok: true, status: args.decision };
}

export async function listApprovals(
  pool: Pool,
  opts: { status?: string; requestType?: string; limit?: number } = {}
): Promise<{ requests: any[]; total: number; byStatus: Record<string, number>; byType: Record<string, number> }> {
  try {
    await ensureGovernanceSchema(pool);
    const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 1000);
    const all = (
      await pool.query(
        `SELECT * FROM rbac_approval_requests ORDER BY created_at DESC LIMIT $1`,
        [limit]
      )
    ).rows;
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const r of all) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byType[r.request_type] = (byType[r.request_type] || 0) + 1;
    }
    let requests = all;
    if (opts.status) requests = requests.filter((r) => r.status === opts.status);
    if (opts.requestType) requests = requests.filter((r) => r.request_type === opts.requestType);
    return { requests, total: requests.length, byStatus, byType };
  } catch {
    return { requests: [], total: 0, byStatus: {}, byType: {} };
  }
}
