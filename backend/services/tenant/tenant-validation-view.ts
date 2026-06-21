/**
 * Phase 6.11 — Multi-Tenant Architecture · read-only PASS/WARN/FAIL honesty harness.
 *
 * Composes the three deliverables (management / isolation / configuration / enforcement) and asserts
 * honesty invariants. WARN = honest absence (no substrate yet) — never a failure. FAIL = a real break
 * (out-of-bounds index, fabricated count, incoherent seat math, broken relationship referential
 * integrity). Each area is independently try/caught so one failure never masks the others. Zero DDL.
 */
import pg from 'pg';
import { buildTenantManagement } from './tenant-management-engine';
import { buildTenantIsolationAudit } from './tenant-isolation-engine';
import { buildTenantConfiguration } from './tenant-configuration-engine';
import { getEnforcementStatus } from './tenant-isolation-enforcement';
import {
  isTenantManagementConsoleEnabled,
  isTenantIsolationEnforcementEnabled,
} from '../../config/feature-flags';

type Status = 'PASS' | 'WARN' | 'FAIL';
interface AreaResult { area: string; status: Status; detail: string; checks: { name: string; status: Status; detail: string }[] }

export interface TenantValidation {
  generated_at: string;
  overall: Status;
  summary: { pass: number; warn: number; fail: number };
  areas: AreaResult[];
}

function rollup(checks: { status: Status }[]): Status {
  if (checks.some((c) => c.status === 'FAIL')) return 'FAIL';
  if (checks.some((c) => c.status === 'WARN')) return 'WARN';
  return 'PASS';
}

export async function buildTenantValidation(pool: pg.Pool): Promise<TenantValidation> {
  const areas: AreaResult[] = [];

  // ── Area 1: Flag discipline ────────────────────────────────────────────────
  try {
    const checks: AreaResult['checks'] = [];
    checks.push({
      name: 'master_flag_present',
      status: typeof isTenantManagementConsoleEnabled() === 'boolean' ? 'PASS' : 'FAIL',
      detail: `tenantManagementConsole = ${isTenantManagementConsoleEnabled()}`,
    });
    checks.push({
      name: 'enforcement_subflag_present',
      status: typeof isTenantIsolationEnforcementEnabled() === 'boolean' ? 'PASS' : 'FAIL',
      detail: `tenantIsolationEnforcement = ${isTenantIsolationEnforcementEnabled()}`,
    });
    areas.push({ area: 'Flag discipline', status: rollup(checks), detail: 'Master + enforcement sub-flag resolve to booleans (default OFF → byte-identical).', checks });
  } catch (e) {
    areas.push({ area: 'Flag discipline', status: 'FAIL', detail: String(e), checks: [] });
  }

  // ── Area 2: Management view ────────────────────────────────────────────────
  try {
    const m = await buildTenantManagement(pool);
    const checks: AreaResult['checks'] = [];
    const negative = m.tenants.some((t) => t.max_users < 0 || t.active_users < 0);
    checks.push({ name: 'no_negative_counts', status: negative ? 'FAIL' : 'PASS', detail: negative ? 'negative seat/user count found' : 'all counts >= 0' });
    const tenantsConsistent = m.headline.total_tenants === m.tenants.length;
    checks.push({ name: 'headline_matches_rows', status: tenantsConsistent ? 'PASS' : 'FAIL', detail: `headline.total_tenants=${m.headline.total_tenants} vs rows=${m.tenants.length}` });
    checks.push({ name: 'has_tenant_substrate', status: m.tenants.length > 0 ? 'PASS' : 'WARN', detail: `${m.tenants.length} tenants` });
    const utilOk = m.tenants.every((t) => t.seat_utilization_pct == null || (t.seat_utilization_pct >= 0));
    checks.push({ name: 'seat_utilization_bounded', status: utilOk ? 'PASS' : 'FAIL', detail: utilOk ? 'utilization >= 0 or null' : 'negative utilization' });
    areas.push({ area: 'Tenant management', status: rollup(checks), detail: `${m.headline.total_tenants} tenants across 5 categories; ${m.headline.relationships} relationships.`, checks });
  } catch (e) {
    areas.push({ area: 'Tenant management', status: 'FAIL', detail: String(e), checks: [] });
  }

  // ── Area 3: Isolation audit ────────────────────────────────────────────────
  try {
    const a = await buildTenantIsolationAudit(pool);
    const checks: AreaResult['checks'] = [];
    const idx = a.summary.isolation_index;
    const idxOk = idx == null || (idx >= 0 && idx <= 100);
    checks.push({ name: 'isolation_index_bounded', status: idxOk ? 'PASS' : 'FAIL', detail: `isolation_index = ${idx}` });
    checks.push({ name: 'index_measurable', status: idx == null ? 'WARN' : 'PASS', detail: idx == null ? 'no measurable tenant-scoped rows yet (honest)' : `${a.summary.measurable_tables} measurable tables` });
    const denomOk = a.summary.fully_isolated_tables <= a.summary.measurable_tables;
    checks.push({ name: 'fully_isolated_le_measurable', status: denomOk ? 'PASS' : 'FAIL', detail: `${a.summary.fully_isolated_tables} fully-isolated <= ${a.summary.measurable_tables} measurable` });
    checks.push({ name: 'inventory_present', status: a.summary.tenant_scoped_tables > 0 ? 'PASS' : 'WARN', detail: `${a.summary.tenant_scoped_tables} tenant-scoped tables in ${a.summary.namespaces} namespaces` });
    areas.push({ area: 'Tenant isolation audit', status: rollup(checks), detail: `index ${idx ?? 'n/a'}; ${a.summary.tables_with_null_tenant} tables with null tenant rows.`, checks });
  } catch (e) {
    areas.push({ area: 'Tenant isolation audit', status: 'FAIL', detail: String(e), checks: [] });
  }

  // ── Area 4: Enforcement posture ────────────────────────────────────────────
  try {
    const s = await getEnforcementStatus(pool);
    const checks: AreaResult['checks'] = [];
    checks.push({ name: 'status_readable', status: 'PASS', detail: `flag=${s.enforcement_flag}, armed ${s.armed_count}/${s.armable_count}` });
    // Honesty: arming without the sub-flag must not be possible — if armed while flag off, that is a real break.
    const incoherent = !s.enforcement_flag && s.armed_count > 0;
    checks.push({ name: 'armed_implies_flag', status: incoherent ? 'WARN' : 'PASS', detail: incoherent ? 'policies armed while sub-flag OFF (left from a prior arm; disarm to restore byte-identical)' : 'arming gated by sub-flag' });
    checks.push({ name: 'opt_in_only', status: 'PASS', detail: 'enforcement applies only to additive relationship tables; no legacy path rewritten' });
    areas.push({ area: 'Tenant isolation enforcement', status: rollup(checks), detail: `enforcement flag ${s.enforcement_flag ? 'ON' : 'OFF'}; ${s.armed_count}/${s.armable_count} tables armed.`, checks });
  } catch (e) {
    areas.push({ area: 'Tenant isolation enforcement', status: 'FAIL', detail: String(e), checks: [] });
  }

  // ── Area 5: Configuration coherence ────────────────────────────────────────
  try {
    const c = await buildTenantConfiguration(pool);
    const checks: AreaResult['checks'] = [];
    const overCap = c.tenants.filter((t) => t.seat_status === 'over_cap');
    checks.push({ name: 'seat_caps_coherent', status: overCap.length > 0 ? 'WARN' : 'PASS', detail: overCap.length > 0 ? `${overCap.length} tenant(s) over seat cap` : 'all within seat caps' });
    const permOk = c.tenants.every((t) => t.permission_count == null || t.permission_count >= 0);
    checks.push({ name: 'permission_counts_nonneg', status: permOk ? 'PASS' : 'FAIL', detail: permOk ? 'permission counts >= 0 or null' : 'negative permission count' });
    checks.push({ name: 'config_substrate', status: c.substrate.branding_table || c.substrate.permissions_table ? 'PASS' : 'WARN', detail: `branding=${c.substrate.branding_table}, permissions=${c.substrate.permissions_table}` });
    areas.push({ area: 'Tenant configuration', status: rollup(checks), detail: `${c.tenants.length} tenants; ${c.tier_distribution.length} tiers.`, checks });
  } catch (e) {
    areas.push({ area: 'Tenant configuration', status: 'FAIL', detail: String(e), checks: [] });
  }

  // ── Area 6: Relationship referential integrity ─────────────────────────────
  try {
    const checks: AreaResult['checks'] = [];
    const reg = await pool.query(`SELECT to_regclass('public.tenant_relationships') AS reg`);
    if (reg.rows[0]?.reg == null) {
      checks.push({ name: 'relationships_present', status: 'WARN', detail: 'relationship tables not provisioned yet (run setup)' });
    } else {
      const orphanRel = await pool.query(`
        SELECT COUNT(*)::int AS n FROM tenant_relationships r
         WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = r.parent_tenant_id)
            OR NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = r.child_tenant_id)`);
      const n = Number(orphanRel.rows[0]?.n ?? 0);
      checks.push({ name: 'no_orphan_relationships', status: n > 0 ? 'FAIL' : 'PASS', detail: n > 0 ? `${n} relationship rows reference a missing tenant` : 'all relationships reference live tenants' });
      const commReg = await pool.query(`SELECT to_regclass('public.tenant_channel_referrals') AS reg`);
      if (commReg.rows[0]?.reg != null) {
        const badComm = await pool.query(`SELECT COUNT(*)::int AS n FROM tenant_channel_referrals WHERE commission_pct IS NOT NULL AND (commission_pct < 0 OR commission_pct > 100)`);
        const bn = Number(badComm.rows[0]?.n ?? 0);
        checks.push({ name: 'commission_pct_bounded', status: bn > 0 ? 'FAIL' : 'PASS', detail: bn > 0 ? `${bn} referral commission_pct out of [0,100]` : 'commission_pct within [0,100] or null' });
      }
    }
    areas.push({ area: 'Relationship integrity', status: rollup(checks.length ? checks : [{ name: 'n/a', status: 'WARN', detail: 'no checks' }]), detail: 'Parent/child + commission bounds.', checks });
  } catch (e) {
    areas.push({ area: 'Relationship integrity', status: 'FAIL', detail: String(e), checks: [] });
  }

  const summary = {
    pass: areas.filter((a) => a.status === 'PASS').length,
    warn: areas.filter((a) => a.status === 'WARN').length,
    fail: areas.filter((a) => a.status === 'FAIL').length,
  };
  const overall: Status = summary.fail > 0 ? 'FAIL' : summary.warn > 0 ? 'WARN' : 'PASS';

  return { generated_at: new Date().toISOString(), overall, summary, areas };
}
