/**
 * Phase 6.9 — Enterprise Governance console smoke test (read-only, non-destructive).
 *
 * Engine-level (direct DB): assert the four read-only views compose real substrate without throwing,
 * surface honest substrate flags (no_substrate vs empty), and that the composite Compliance posture
 * index is transparent (measurable→score∈[0,100] with renormalised pillar weights; else null+reason —
 * never fabricated). Plus HTTP flag-OFF 503 verification against the running Backend API (the workflow
 * runs WITHOUT FF_ENTERPRISE_GOVERNANCE_CONSOLE).
 *
 * Seeds nothing. Reads only. Never touches real identities.
 */
import pg from 'pg';
import { buildAuditTrailView } from '../services/governance/audit-trail-view';
import { buildApprovalWorkflowView } from '../services/governance/approval-workflow-view';
import { buildSecurityCenterView } from '../services/governance/security-center-view';
import { buildEnterpriseGovernance } from '../services/governance/enterprise-governance-engine';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : ''); }
};

async function main() {
  console.log('\n[1] audit trail view composes (never throws)');
  const audit = await buildAuditTrailView(pool);
  ok('returns object', !!audit && typeof audit === 'object');
  ok('substrate flags boolean', typeof audit.substrate.admin_audit_logs === 'boolean' && typeof audit.substrate.rbac_failed_logins === 'boolean', audit.substrate);
  ok('audit.total number ≥ 0', typeof audit.audit.total === 'number' && audit.audit.total >= 0, audit.audit.total);
  ok('failed_logins.last_24h number ≥ 0', typeof audit.failed_logins.last_24h === 'number' && audit.failed_logins.last_24h >= 0, audit.failed_logins);

  console.log('\n[2] approval workflow view composes (never throws)');
  const appr = await buildApprovalWorkflowView(pool);
  ok('returns object', !!appr && typeof appr === 'object');
  ok('substrate flags boolean', typeof appr.substrate.rbac_approval_requests === 'boolean' && typeof appr.substrate.intervention_approvals === 'boolean', appr.substrate);
  ok('totals sum coherent (pending ≤ total)', appr.totals.pending <= appr.totals.total, appr.totals);
  ok('pending_queue is array', Array.isArray(appr.pending_queue), appr.pending_queue?.length);

  console.log('\n[3] security center view composes (never throws)');
  const sec = await buildSecurityCenterView(pool);
  ok('returns object', !!sec && typeof sec === 'object');
  ok('rbac counts numeric', typeof sec.rbac.roles === 'number' && typeof sec.rbac.permissions === 'number', sec.rbac);
  ok('live_super_admins number|null (no_substrate distinct)', sec.live_vs_formal.live_super_admins === null || typeof sec.live_vs_formal.live_super_admins === 'number', sec.live_vs_formal);
  ok('suspicious_activity items array', Array.isArray(sec.suspicious_activity.items), sec.suspicious_activity);

  console.log('\n[4] enterprise governance composite + transparent compliance index');
  const ent = await buildEnterpriseGovernance(pool);
  ok('returns object', !!ent && typeof ent === 'object');
  ok('embeds audit + approvals + security + data_governance', !!ent.audit && !!ent.approvals && !!ent.security && !!ent.data_governance);
  ok('headline numeric fields', typeof ent.headline.roles === 'number' && typeof ent.headline.audit_events_30d === 'number', ent.headline);
  ok('data_governance substrate boolean', typeof ent.data_governance.substrate.governance_events === 'boolean', ent.data_governance.substrate);
  ok('compliance.measurable is boolean', typeof ent.compliance.measurable === 'boolean', ent.compliance);
  if (ent.compliance.measurable) {
    ok('measurable → score ∈ [0,100]', ent.compliance.score != null && ent.compliance.score >= 0 && ent.compliance.score <= 100, ent.compliance.score);
    const wsum = ent.compliance.pillars.reduce((a, p) => a + p.weight, 0);
    ok('pillar weights renormalise to ~1', Math.abs(wsum - 1) < 0.001, ent.compliance.pillars);
    ok('every pillar value ∈ [0,1]', ent.compliance.pillars.every((p) => p.value >= 0 && p.value <= 1), ent.compliance.pillars);
  } else {
    ok('not measurable → score null + reason', ent.compliance.score === null && !!ent.compliance.reason, ent.compliance);
  }

  // ── HTTP flag-OFF → 503/401 (Backend API runs WITHOUT FF_ENTERPRISE_GOVERNANCE_CONSOLE) ───────────
  console.log('\n[5] HTTP flag-OFF gated (503/401, not 200)');
  const base = `http://localhost:8080`;
  for (const path of [
    '/api/admin/governance/console/ping',
    '/api/admin/governance/console/overview',
    '/api/admin/governance/console/audit',
    '/api/admin/governance/console/approvals',
    '/api/admin/governance/console/security',
  ]) {
    try {
      const res = await fetch(`${base}${path}`, { headers: { 'content-type': 'application/json' } });
      ok(`GET ${path} gated`, res.status === 503 || res.status === 401, res.status);
    } catch (e: any) {
      ok(`GET ${path} reachable`, false, e?.message);
    }
  }

  await pool.end();
  console.log(`\n──────── ${pass} passed, ${fail} failed ────────`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('SMOKE FATAL', e);
  await pool.end().catch(() => {});
  process.exit(1);
});
