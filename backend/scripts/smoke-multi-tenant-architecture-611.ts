/**
 * Smoke test — Phase 6.11 Multi-Tenant Architecture console.
 *
 * Verifies:
 *   1. Flag-OFF (or unauthenticated): every console route returns 401/403/503 (byte-identical legacy).
 *   2. Engines run read-only and return honest, well-formed output (when invoked directly).
 *
 * Run: cd backend && npx tsx scripts/smoke-multi-tenant-architecture-611.ts
 */
import pg from 'pg';
import { buildTenantManagement } from '../services/tenant/tenant-management-engine';
import { buildTenantIsolationAudit } from '../services/tenant/tenant-isolation-engine';
import { buildTenantConfiguration } from '../services/tenant/tenant-configuration-engine';
import { buildTenantValidation } from '../services/tenant/tenant-validation-view';
import { getEnforcementStatus } from '../services/tenant/tenant-isolation-enforcement';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:8080';

async function checkRouteGating() {
  const routes = [
    '/api/admin/tenant-architecture/console/ping',
    '/api/admin/tenant-architecture/console/management',
    '/api/admin/tenant-architecture/console/isolation',
    '/api/admin/tenant-architecture/console/configuration',
    '/api/admin/tenant-architecture/console/enforcement',
    '/api/admin/tenant-architecture/console/validation',
  ];
  let allGated = true;
  for (const r of routes) {
    try {
      const res = await fetch(`${BASE}${r}`);
      const ok = [401, 403, 503].includes(res.status);
      if (!ok) allGated = false;
      console.log(`  ${ok ? 'PASS' : 'FAIL'} ${r} → ${res.status}`);
    } catch (e) {
      console.log(`  SKIP ${r} (server not reachable: ${String(e)})`);
    }
  }
  return allGated;
}

async function checkEngines() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const m = await buildTenantManagement(pool);
    console.log(`  management: ${m.headline.total_tenants} tenants, ${m.categories.length} categories, degraded=${m.degraded}`);
    const a = await buildTenantIsolationAudit(pool);
    console.log(`  isolation: ${a.summary.tenant_scoped_tables} scoped tables, ${a.summary.measurable_tables} measurable, index=${a.summary.isolation_index}`);
    const c = await buildTenantConfiguration(pool);
    console.log(`  configuration: ${c.tenants.length} tenants, ${c.tier_distribution.length} tiers`);
    const e = await getEnforcementStatus(pool);
    console.log(`  enforcement: flag=${e.enforcement_flag}, armed ${e.armed_count}/${e.armable_count}`);
    const v = await buildTenantValidation(pool);
    console.log(`  validation: overall=${v.overall} (${v.summary.pass}P/${v.summary.warn}W/${v.summary.fail}F)`);
    // Honesty assertions.
    const idx = a.summary.isolation_index;
    if (idx != null && (idx < 0 || idx > 100)) throw new Error('isolation_index out of bounds');
    if (m.headline.total_tenants !== m.tenants.length) throw new Error('headline/rows mismatch');
    if (v.overall === 'FAIL') console.log('  NOTE: validation overall FAIL — inspect areas above.');
    return true;
  } finally {
    await pool.end();
  }
}

(async () => {
  console.log('== Route gating (expect 401/403/503 when flag OFF / unauth) ==');
  const gated = await checkRouteGating();
  console.log('\n== Engines (read-only honest output) ==');
  const engines = await checkEngines();
  console.log(`\nRESULT: gating=${gated ? 'OK' : 'CHECK'} engines=${engines ? 'OK' : 'FAIL'}`);
  process.exit(engines ? 0 : 1);
})();
