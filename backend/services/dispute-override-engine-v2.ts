/**
 * Dispute / Override V2 — SLA + escalation chain. Reads dispute lifecycle
 * from existing wos_disputes; layered SLA policy from wos_v2_dispute_sla.
 */
import type { Pool } from 'pg';

export const DISPUTE_OVERRIDE_V2_VERSION = '2.0.0';

export type SLAEnvelope = {
  dispute_id: string;
  status: string;
  triage_hours_budget: number;
  resolve_hours_budget: number;
  age_hours: number;
  triage_breached: boolean;
  resolve_breached: boolean;
  next_escalation: string | null;
  rationale: string;
};

export type SLAPolicy = {
  triage_hours: number;
  resolve_hours: number;
  escalation_chain: string[];
};

export async function loadSLAPolicy(pool: Pool, tenantId: number | null, disputeType = 'default'): Promise<SLAPolicy> {
  try {
    const r = await pool.query<{ triage_hours: number; resolve_hours: number; escalation_chain: string[] }>(
      `SELECT triage_hours, resolve_hours, escalation_chain
       FROM wos_v2_dispute_sla
       WHERE dispute_type = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
       ORDER BY tenant_id NULLS LAST LIMIT 1`,
      [disputeType, tenantId],
    );
    if (r.rowCount && r.rows[0]) return r.rows[0];
  } catch { /* fall through */ }
  return { triage_hours: 24, resolve_hours: 120, escalation_chain: ['ops_lead', 'compliance_lead', 'exec_sponsor'] };
}

// ── Gap #2: SLA breach sweeper ────────────────────────────────────────────
//
// Marks open/in-review disputes whose age exceeds their SLA budgets with
// `escalated_at`, `escalation_level`, `escalation_target`. Idempotent: a
// dispute already escalated at the highest level its age warrants is
// skipped (no re-marking, no audit-log spam). Lazy ALTER guards make this
// safe to call even when migration 20260810 has not yet run.
export type BreachMark = {
  dispute_id: string;
  prior_level: number | null;
  new_level: number;
  target: string;
  age_hours: number;
};
export async function markBreachedDisputes(pool: Pool, opts: {
  tenant_id?: number | null;
  disputeType?: string;
  now?: Date;
  limit?: number;
} = {}): Promise<{ scanned: number; escalated: BreachMark[] }> {
  const now = opts.now ?? new Date();
  try {
    await pool.query(`ALTER TABLE wos_disputes ADD COLUMN IF NOT EXISTS escalated_at       TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE wos_disputes ADD COLUMN IF NOT EXISTS escalation_level   INT`);
    await pool.query(`ALTER TABLE wos_disputes ADD COLUMN IF NOT EXISTS escalation_target  TEXT`);
    await pool.query(`ALTER TABLE wos_disputes ADD COLUMN IF NOT EXISTS last_sla_check_at  TIMESTAMPTZ`);
  } catch { /* best-effort */ }

  const policy = await loadSLAPolicy(pool, opts.tenant_id ?? null, opts.disputeType ?? 'default');
  const params: unknown[] = [];
  const where: string[] = [`status NOT IN ('resolved_upheld','resolved_overturned','withdrawn')`];
  if (opts.tenant_id != null) { params.push(opts.tenant_id); where.push(`tenant_id = $${params.length}`); }
  const limit = Math.max(1, Math.min(opts.limit ?? 500, 5000));
  const sql = `SELECT id, status, created_at, escalation_level
                 FROM wos_disputes
                 WHERE ${where.join(' AND ')}
                 ORDER BY created_at ASC
                 LIMIT ${limit}`;
  const rows = (await pool.query<{ id: string; status: string; created_at: string; escalation_level: number | null }>(sql, params)).rows;

  const escalated: BreachMark[] = [];
  const chain = policy.escalation_chain ?? [];
  for (const r of rows) {
    const env = evaluateSLA({ id: r.id, status: r.status, createdAt: new Date(r.created_at) }, policy, now);
    if (!env.triage_breached && !env.resolve_breached) continue;
    // Triage-only breach → level 1 / chain[0]. Resolve breach → escalate further along the chain.
    const level = env.resolve_breached ? Math.min(chain.length, 3) : 1;
    const target = env.resolve_breached
      ? (chain[Math.max(0, level - 1)] ?? chain[0] ?? 'ops_lead')
      : (chain[0] ?? 'ops_lead');
    if ((r.escalation_level ?? 0) >= level) continue; // already at/above this level (best-effort guard)
    // Race-safe conditional UPDATE — only one concurrent sweeper can win per dispute.
    const upd = await pool.query<{ id: string }>(
      `UPDATE wos_disputes
          SET escalated_at = COALESCE(escalated_at, $1),
              escalation_level = $2,
              escalation_target = $3,
              last_sla_check_at = $1,
              updated_at = NOW()
        WHERE id = $4
          AND COALESCE(escalation_level, 0) < $2
        RETURNING id`,
      [now, level, target, r.id],
    );
    if (upd.rowCount && upd.rowCount > 0) {
      escalated.push({ dispute_id: r.id, prior_level: r.escalation_level ?? null, new_level: level, target, age_hours: env.age_hours });
    }
  }
  // Best-effort: stamp last_sla_check_at on all scanned rows so dashboards can show "swept N minutes ago".
  if (rows.length) {
    try {
      await pool.query(
        `UPDATE wos_disputes SET last_sla_check_at = $1 WHERE id = ANY($2::text[])`,
        [now, rows.map(r => r.id)],
      );
    } catch { /* schema mismatch shouldn't break the sweep */ }
  }
  return { scanned: rows.length, escalated };
}

export function evaluateSLA(d: { id: string; status: string; createdAt: Date }, policy: SLAPolicy, now = new Date()): SLAEnvelope {
  const age = Math.max(0, (now.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60));
  const triageBreached = age > policy.triage_hours && d.status === 'open';
  const resolveBreached = age > policy.resolve_hours && d.status !== 'resolved';
  const escIdx = age > policy.resolve_hours ? Math.min(policy.escalation_chain.length - 1, 2)
               : age > policy.triage_hours ? 1 : 0;
  return {
    dispute_id: d.id,
    status: d.status,
    triage_hours_budget: policy.triage_hours,
    resolve_hours_budget: policy.resolve_hours,
    age_hours: +age.toFixed(2),
    triage_breached: triageBreached,
    resolve_breached: resolveBreached,
    next_escalation: resolveBreached || triageBreached ? (policy.escalation_chain[escIdx] ?? null) : null,
    rationale: `Age ${age.toFixed(1)}h vs triage ${policy.triage_hours}h / resolve ${policy.resolve_hours}h; ${
      resolveBreached ? 'resolve-SLA breached → escalate.' : triageBreached ? 'triage-SLA breached → escalate.' : 'within SLA.'
    }`,
  };
}
