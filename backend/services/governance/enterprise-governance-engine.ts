/**
 * Phase 6.9 — Enterprise Governance · composite engine (deliverable: enterprise_governance). READ-ONLY.
 *
 * COMPOSES (never recomputes) the three Phase-6.9 read-only views — Audit Trail, Approval Workflows,
 * Security Center — and adds the genuinely-missing layers:
 *   • Data Governance — governance_events (consent_captured / data_accessed / risk_flag_*) by type + severity
 *   • Compliance      — a TRANSPARENT posture index over measurable pillars only:
 *        rbac_defined        (a formal RBAC role+permission catalogue exists)
 *        audit_active        (admin actions are being recorded)
 *        approvals_resolved  (share of approval requests not left pending)
 *        datagov_tracked     (data-governance events are being captured)
 *     Each pillar is included ONLY when measurable; weights of included pillars renormalise to 1 and
 *     `pillars` discloses exactly which were used. No measurable pillar → score null + reason. Never
 *     a fabricated score.
 *
 * GET-NEVER-WRITES: composes read-only views + to_regclass-guarded reads; no schema creation; honest
 * empties on absence. Never throws.
 */
import type { Pool } from 'pg';
import { buildAuditTrailView, type AuditTrailView } from './audit-trail-view';
import { buildApprovalWorkflowView, type ApprovalWorkflowView } from './approval-workflow-view';
import { buildSecurityCenterView, type SecurityCenterView } from './security-center-view';

async function tableExists(pool: Pool, name: string, onError?: () => void): Promise<boolean> {
  try {
    const { rows } = await pool.query(`SELECT to_regclass($1) AS oid`, [name]);
    return rows[0]?.oid != null;
  } catch {
    onError?.();
    return false;
  }
}

export interface DataGovernanceView {
  substrate: { governance_events: boolean };
  total: number;
  last_30d: number;
  consent_events: number;
  data_access_events: number;
  risk_flag_events: number;
  by_type: { event_type: string; count: number }[];
  by_severity: { severity: string; count: number }[];
}

export interface CompliancePillar {
  key: 'rbac_defined' | 'audit_active' | 'approvals_resolved' | 'datagov_tracked';
  value: number; // 0..1
  weight: number; // renormalised weight actually applied
}
export interface ComplianceIndex {
  measurable: boolean;
  score: number | null; // 0..100
  pillars: CompliancePillar[];
  reason?: string;
}

export interface EnterpriseGovernanceOverview {
  generated_at: string;
  degraded: boolean;
  headline: {
    roles: number;
    permissions: number;
    audit_events_30d: number;
    pending_approvals: number;
    failed_logins_24h: number;
    data_governance_events_30d: number;
    compliance_score: number | null;
  };
  compliance: ComplianceIndex;
  data_governance: DataGovernanceView;
  audit: AuditTrailView;
  approvals: ApprovalWorkflowView;
  security: SecurityCenterView;
  notes: string[];
}

const RAW_WEIGHTS = {
  rbac_defined: 0.3,
  audit_active: 0.3,
  approvals_resolved: 0.2,
  datagov_tracked: 0.2,
} as const;

async function buildDataGovernance(pool: Pool, onFail: () => void, notes: string[]): Promise<DataGovernanceView> {
  const has = await tableExists(pool, 'public.governance_events', onFail);
  const out: DataGovernanceView = {
    substrate: { governance_events: has },
    total: 0, last_30d: 0, consent_events: 0, data_access_events: 0, risk_flag_events: 0,
    by_type: [], by_severity: [],
  };
  if (!has) {
    notes.push('governance_events absent — no data-governance events captured yet (honest no_substrate).');
    return out;
  }
  try {
    const totals = (
      await pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS last_30d,
                COUNT(*) FILTER (WHERE event_type ILIKE 'consent%')::int AS consent,
                COUNT(*) FILTER (WHERE event_type ILIKE 'data_access%')::int AS data_access,
                COUNT(*) FILTER (WHERE event_type ILIKE 'risk_flag%')::int AS risk_flag
         FROM governance_events`
      )
    ).rows[0];
    out.total = Number(totals?.total) || 0;
    out.last_30d = Number(totals?.last_30d) || 0;
    out.consent_events = Number(totals?.consent) || 0;
    out.data_access_events = Number(totals?.data_access) || 0;
    out.risk_flag_events = Number(totals?.risk_flag) || 0;

    out.by_type = (
      await pool.query(
        `SELECT event_type, COUNT(*)::int AS c FROM governance_events GROUP BY event_type ORDER BY c DESC LIMIT 20`
      )
    ).rows.map((r: any) => ({ event_type: r.event_type, count: Number(r.c) || 0 }));

    out.by_severity = (
      await pool.query(
        `SELECT COALESCE(severity,'info') AS severity, COUNT(*)::int AS c FROM governance_events GROUP BY 1 ORDER BY c DESC`
      )
    ).rows.map((r: any) => ({ severity: r.severity, count: Number(r.c) || 0 }));
  } catch {
    onFail();
    notes.push('governance_events read failed — data-governance figures may be incomplete.');
  }
  return out;
}

/** Phase 6.9 composite Enterprise Governance overview. Read-only, never throws, never fabricates. */
export async function buildEnterpriseGovernance(pool: Pool): Promise<EnterpriseGovernanceOverview> {
  let degraded = false;
  const fail = () => { degraded = true; };
  const notes: string[] = [];

  const audit = await buildAuditTrailView(pool).catch(() => null);
  const approvals = await buildApprovalWorkflowView(pool).catch(() => null);
  const security = await buildSecurityCenterView(pool).catch(() => null);
  const dataGov = await buildDataGovernance(pool, fail, notes);

  if (!audit) { degraded = true; notes.push('Audit view failed to compose.'); }
  if (!approvals) { degraded = true; notes.push('Approval view failed to compose.'); }
  if (!security) { degraded = true; notes.push('Security view failed to compose.'); }
  if (audit?.degraded || approvals?.degraded || security?.degraded) degraded = true;

  // ── Transparent compliance posture index over measurable pillars only ───────────────────────────
  const rawPillars: { key: CompliancePillar['key']; value: number | null }[] = [];

  // rbac_defined: catalogue exists → 1 if any role+permission defined, else 0 (measurable when tables present).
  if (security?.substrate.role_definitions && security?.substrate.permission_definitions) {
    rawPillars.push({ key: 'rbac_defined', value: security.rbac.roles > 0 && security.rbac.permissions > 0 ? 1 : 0 });
  } else {
    rawPillars.push({ key: 'rbac_defined', value: null });
  }

  // audit_active: admin actions being recorded → 1 if any audit event exists, else 0 (measurable when table present).
  if (audit?.substrate.admin_audit_logs) {
    rawPillars.push({ key: 'audit_active', value: audit.audit.total > 0 ? 1 : 0 });
  } else {
    rawPillars.push({ key: 'audit_active', value: null });
  }

  // approvals_resolved: share of approval requests that are NOT pending (only measurable when requests exist).
  const apprTotal = approvals?.totals.total ?? 0;
  if (approvals && (approvals.substrate.rbac_approval_requests || approvals.substrate.intervention_approvals) && apprTotal > 0) {
    rawPillars.push({ key: 'approvals_resolved', value: (apprTotal - approvals.totals.pending) / apprTotal });
  } else {
    rawPillars.push({ key: 'approvals_resolved', value: null });
  }

  // datagov_tracked: data-governance events being captured → 1 if any exist, else 0 (measurable when table present).
  if (dataGov.substrate.governance_events) {
    rawPillars.push({ key: 'datagov_tracked', value: dataGov.total > 0 ? 1 : 0 });
  } else {
    rawPillars.push({ key: 'datagov_tracked', value: null });
  }

  const measured = rawPillars.filter((p) => p.value != null) as { key: CompliancePillar['key']; value: number }[];
  let compliance: ComplianceIndex;
  if (measured.length === 0) {
    compliance = { measurable: false, score: null, pillars: [], reason: 'No measurable compliance pillars (governance subsystem not activated and no audit/approval/data-governance events).' };
  } else {
    const weightSum = measured.reduce((acc, p) => acc + RAW_WEIGHTS[p.key], 0);
    const pillars: CompliancePillar[] = measured.map((p) => ({
      key: p.key,
      value: Math.round(p.value * 1000) / 1000,
      weight: Math.round((RAW_WEIGHTS[p.key] / weightSum) * 1000) / 1000,
    }));
    const score = pillars.reduce((acc, p) => acc + p.value * p.weight, 0) * 100;
    compliance = { measurable: true, score: Math.round(score * 10) / 10, pillars };
    if (measured.length < rawPillars.length) {
      notes.push(`Compliance index computed over ${measured.length}/${rawPillars.length} pillars (others unmeasurable); weights renormalised.`);
    }
  }

  const headline = {
    roles: security?.rbac.roles ?? 0,
    permissions: security?.rbac.permissions ?? 0,
    audit_events_30d: audit?.audit.last_30d ?? 0,
    pending_approvals: approvals?.totals.pending ?? 0,
    failed_logins_24h: audit?.failed_logins.last_24h ?? 0,
    data_governance_events_30d: dataGov.last_30d,
    compliance_score: compliance.score,
  };

  return {
    generated_at: new Date().toISOString(),
    degraded,
    headline,
    compliance,
    data_governance: dataGov,
    audit: audit ?? emptyAudit(),
    approvals: approvals ?? emptyApprovals(),
    security: security ?? emptySecurity(),
    notes,
  };
}

function emptyAudit(): AuditTrailView {
  return {
    generated_at: new Date().toISOString(), degraded: true,
    substrate: { admin_audit_logs: false, rbac_failed_logins: false },
    audit: { total: 0, last_30d: 0, by_category: [], recent: [] },
    failed_logins: { total: 0, last_24h: 0, recent: [] },
    notes: ['Audit view unavailable.'],
  };
}
function emptyApprovals(): ApprovalWorkflowView {
  return {
    generated_at: new Date().toISOString(), degraded: true,
    substrate: { rbac_approval_requests: false, intervention_approvals: false },
    totals: { total: 0, pending: 0, approved: 0, rejected: 0, other: 0 },
    rbac_approvals: { total: 0, by_status: [], by_type: [] },
    intervention_approvals: { total: 0, by_status: [], by_priority: [] },
    pending_queue: [], notes: ['Approval view unavailable.'],
  };
}
function emptySecurity(): SecurityCenterView {
  return {
    generated_at: new Date().toISOString(), degraded: true,
    substrate: {
      role_definitions: false, permission_definitions: false, role_permissions: false,
      rbac_role_hierarchies: false, rbac_permission_groups: false, rbac_admin_status: false,
      rbac_flag_change_log: false, rbac_failed_logins: false, users: false,
    },
    rbac: { roles: 0, permissions: 0, grants: 0, hierarchies: 0, permission_groups: 0, admin_status_rows: 0 },
    live_vs_formal: { live_super_admins: null, formal_roles: 0, note: 'Security view unavailable.' },
    flag_changes: { total: 0, recent: [] },
    suspicious_activity: { window_hours: 24, threshold: 5, items: [] },
    notes: ['Security view unavailable.'],
  };
}
