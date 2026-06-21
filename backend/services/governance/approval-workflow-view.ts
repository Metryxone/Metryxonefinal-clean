/**
 * Phase 6.9 — Enterprise Governance · Approval Workflow view (deliverable: approval_engine). READ-ONLY.
 *
 * COMPOSES (never recomputes) the TWO existing approval substrates into one workflow view:
 *   • rbac_approval_requests   — generalized governance approvals (refund / role_assignment / …)
 *   • intervention_approvals   — ethics-governance intervention approvals (per-user interventions)
 *
 * GET-NEVER-WRITES: to_regclass probes only, NEVER ensureGovernanceSchema (DDL). Absent table →
 * substrate=false honest zeros. Never throws, never fabricates.
 */
import type { Pool } from 'pg';

async function tableExists(pool: Pool, name: string, onError?: () => void): Promise<boolean> {
  try {
    const { rows } = await pool.query(`SELECT to_regclass($1) AS oid`, [name]);
    return rows[0]?.oid != null;
  } catch {
    onError?.();
    return false;
  }
}

interface ApprovalQueueItem {
  source: 'rbac' | 'intervention';
  id: any;
  type: string;
  label: string | null;
  status: string;
  requested_by: string | null;
  created_at: any;
}

export interface ApprovalWorkflowView {
  generated_at: string;
  degraded: boolean;
  substrate: { rbac_approval_requests: boolean; intervention_approvals: boolean };
  totals: { total: number; pending: number; approved: number; rejected: number; other: number };
  rbac_approvals: { total: number; by_status: { status: string; count: number }[]; by_type: { type: string; count: number }[] };
  intervention_approvals: { total: number; by_status: { status: string; count: number }[]; by_priority: { priority: string; count: number }[] };
  pending_queue: ApprovalQueueItem[];
  notes: string[];
}

function tally(rows: any[], key: string): { k: string; count: number }[] {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const v = (r[key] ?? 'unknown') as string;
    m[v] = (m[v] || 0) + 1;
  }
  return Object.entries(m).map(([k, count]) => ({ k, count })).sort((a, b) => b.count - a.count);
}

/** Phase 6.9 read-only approval workflow view. Never throws, never fabricates. */
export async function buildApprovalWorkflowView(pool: Pool): Promise<ApprovalWorkflowView> {
  let degraded = false;
  const fail = () => { degraded = true; };
  const notes: string[] = [];

  const hasRbac = await tableExists(pool, 'public.rbac_approval_requests', fail);
  const hasIntv = await tableExists(pool, 'public.intervention_approvals', fail);

  const out: ApprovalWorkflowView = {
    generated_at: new Date().toISOString(),
    degraded,
    substrate: { rbac_approval_requests: hasRbac, intervention_approvals: hasIntv },
    totals: { total: 0, pending: 0, approved: 0, rejected: 0, other: 0 },
    rbac_approvals: { total: 0, by_status: [], by_type: [] },
    intervention_approvals: { total: 0, by_status: [], by_priority: [] },
    pending_queue: [],
    notes,
  };

  const queue: ApprovalQueueItem[] = [];

  if (hasRbac) {
    try {
      const rows = (
        await pool.query(
          `SELECT id, request_type, target_label, status, requested_by_email, created_at
           FROM rbac_approval_requests ORDER BY created_at DESC LIMIT 500`
        )
      ).rows;
      out.rbac_approvals.total = rows.length;
      out.rbac_approvals.by_status = tally(rows, 'status').map((x) => ({ status: x.k, count: x.count }));
      out.rbac_approvals.by_type = tally(rows, 'request_type').map((x) => ({ type: x.k, count: x.count }));
      for (const r of rows) {
        if (r.status === 'pending') {
          queue.push({
            source: 'rbac', id: r.id, type: r.request_type, label: r.target_label,
            status: r.status, requested_by: r.requested_by_email, created_at: r.created_at,
          });
        }
      }
    } catch {
      degraded = true;
      notes.push('rbac_approval_requests read failed — RBAC approvals may be incomplete.');
    }
  } else {
    notes.push('rbac_approval_requests absent — no governance approvals recorded yet (honest no_substrate).');
  }

  if (hasIntv) {
    try {
      const rows = (
        await pool.query(
          `SELECT id, intervention_type, user_email, requester_email, status, priority, created_at
           FROM intervention_approvals ORDER BY created_at DESC LIMIT 500`
        )
      ).rows;
      out.intervention_approvals.total = rows.length;
      out.intervention_approvals.by_status = tally(rows, 'status').map((x) => ({ status: x.k, count: x.count }));
      out.intervention_approvals.by_priority = tally(rows, 'priority').map((x) => ({ priority: x.k, count: x.count }));
      for (const r of rows) {
        if (r.status === 'pending') {
          queue.push({
            source: 'intervention', id: r.id, type: r.intervention_type, label: r.user_email,
            status: r.status, requested_by: r.requester_email, created_at: r.created_at,
          });
        }
      }
    } catch {
      degraded = true;
      notes.push('intervention_approvals read failed — intervention approvals may be incomplete.');
    }
  } else {
    notes.push('intervention_approvals absent — no intervention approvals recorded yet (honest no_substrate).');
  }

  // Combined totals across both sources (status normalised).
  const allStatuses = [
    ...out.rbac_approvals.by_status,
    ...out.intervention_approvals.by_status,
  ];
  for (const s of allStatuses) {
    out.totals.total += s.count;
    if (s.status === 'pending') out.totals.pending += s.count;
    else if (s.status === 'approved') out.totals.approved += s.count;
    else if (s.status === 'rejected') out.totals.rejected += s.count;
    else out.totals.other += s.count;
  }

  queue.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  out.pending_queue = queue.slice(0, 50);
  out.degraded = degraded;
  return out;
}
