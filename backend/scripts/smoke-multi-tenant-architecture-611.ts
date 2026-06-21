/**
 * Smoke test — Phase 6.11 Multi-Tenant Architecture console.
 *
 * Verifies:
 *   1. Unauthenticated: every console route returns 401/403/503 (global gate, byte-identical legacy).
 *   2. Authenticated super-admin + flag OFF (live server): console routes return 503 — proving the
 *      console-flag gate is distinct from the auth gate (the flag-OFF byte-identical guarantee).
 *   3. Flag ON over HTTP (ephemeral in-process app with stubbed auth + flags forced on): the GET
 *      console routes return 200 with honest, well-formed composed output against real data.
 *   4. Engines run read-only and return honest, well-formed output (direct invocation).
 *
 * Run: cd backend && npx tsx scripts/smoke-multi-tenant-architecture-611.ts
 */
import pg from 'pg';
import express from 'express';
import type { AddressInfo } from 'net';
import { buildTenantManagement } from '../services/tenant/tenant-management-engine';
import { buildTenantIsolationAudit } from '../services/tenant/tenant-isolation-engine';
import { buildTenantConfiguration } from '../services/tenant/tenant-configuration-engine';
import { buildTenantValidation } from '../services/tenant/tenant-validation-view';
import { getEnforcementStatus } from '../services/tenant/tenant-isolation-enforcement';
import { registerMultiTenantArchitectureRoutes } from '../routes/multi-tenant-architecture';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:8080';
const SA_USER = process.env.SUPER_ADMIN_EMAIL || 'support@metryxone.com';
const SA_PASS = process.env.SUPER_ADMIN_PASSWORD || 'admin123';

const ROUTES = [
  '/api/admin/tenant-architecture/console/ping',
  '/api/admin/tenant-architecture/console/management',
  '/api/admin/tenant-architecture/console/isolation',
  '/api/admin/tenant-architecture/console/configuration',
  '/api/admin/tenant-architecture/console/enforcement',
  '/api/admin/tenant-architecture/console/validation',
];

// 1. Unauthenticated → gated.
async function checkRouteGating(): Promise<boolean | null> {
  let allGated = true;
  let reachable = false;
  for (const r of ROUTES) {
    try {
      const res = await fetch(`${BASE}${r}`);
      reachable = true;
      const ok = [401, 403, 503].includes(res.status);
      if (!ok) allGated = false;
      console.log(`  ${ok ? 'PASS' : 'FAIL'} ${r} → ${res.status}`);
    } catch (e) {
      console.log(`  SKIP ${r} (server not reachable: ${String(e)})`);
    }
  }
  return reachable ? allGated : null;
}

// 2. Authenticated super-admin + flag OFF (live server) → 503 on console routes.
async function checkAuthenticatedFlagOff(): Promise<boolean | null> {
  // Dev login bypasses MFA when ZOHO_EMAIL is unset (returns the session directly).
  let cookie: string | null = null;
  try {
    const login = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: SA_USER, password: SA_PASS }),
    });
    if (login.status !== 200) {
      console.log(`  SKIP (super-admin login returned ${login.status}; cannot test authed path)`);
      return null;
    }
    const body: any = await login.json().catch(() => ({}));
    if (body?.mfaRequired) {
      console.log('  SKIP (MFA required — ZOHO configured; skipping authed-flag-off leg)');
      return null;
    }
    cookie = login.headers.get('set-cookie');
  } catch (e) {
    console.log(`  SKIP (login unreachable: ${String(e)})`);
    return null;
  }
  if (!cookie) {
    console.log('  SKIP (no session cookie returned)');
    return null;
  }
  const sessionCookie = cookie.split(';')[0];
  let all503 = true;
  for (const r of ROUTES) {
    const res = await fetch(`${BASE}${r}`, { headers: { cookie: sessionCookie } });
    const ok = res.status === 503; // authed but flag OFF
    if (!ok) all503 = false;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${r} → ${res.status} (expect 503: authed + flag OFF)`);
  }
  return all503;
}

// 3. Flag ON over HTTP — ephemeral app, stubbed auth, flags forced on.
async function checkFlagOnHttp(): Promise<boolean> {
  process.env.FF_TENANT_MANAGEMENT_CONSOLE = '1';
  process.env.FF_TENANT_ISOLATION_ENFORCEMENT = '1';
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const app = express();
  app.use(express.json());
  const pass = (_req: any, _res: any, next: any) => next();
  registerMultiTenantArchitectureRoutes(app, pool, pass, pass);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const local = `http://127.0.0.1:${port}`;
  let allOk = true;
  try {
    for (const r of ROUTES) {
      const res = await fetch(`${local}${r}`);
      const body: any = await res.json().catch(() => ({}));
      const ok = res.status === 200;
      if (!ok) allOk = false;
      console.log(`  ${ok ? 'PASS' : 'FAIL'} ${r} → ${res.status}`);
    }
    // Honest-shape assertions on the flag-ON HTTP payloads.
    const mgmt: any = await (await fetch(`${local}/api/admin/tenant-architecture/console/management`)).json();
    if (!mgmt.entity_counts || mgmt.entity_counts.tenant_partitioned !== false) {
      throw new Error('management.entity_counts missing or claims fabricated per-tenant partitioning');
    }
    if (mgmt.headline.total_tenants !== mgmt.tenants.length) throw new Error('headline/rows mismatch (HTTP)');
    const enf: any = await (await fetch(`${local}/api/admin/tenant-architecture/console/enforcement`)).json();
    if (enf.armable_count !== 4) throw new Error(`enforcement armable_count expected 4, got ${enf.armable_count}`);
    if (enf.enforcement_flag !== true) throw new Error('enforcement_flag should be ON in flag-ON HTTP run');
    console.log(`  entity_counts: employers=${mgmt.entity_counts.employers} institutes=${mgmt.entity_counts.institutes} users=${mgmt.entity_counts.users} sessions=${mgmt.entity_counts.sessions} (platform-wide, tenant_partitioned=false)`);
    console.log(`  enforcement: armable_count=${enf.armable_count} (${enf.tables.map((t: any) => t.table).join(', ')})`);
  } finally {
    server.close();
    await pool.end();
  }
  return allOk;
}

// 4. Direct engine invocation (read-only honest output).
async function checkEngines(): Promise<boolean> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const m = await buildTenantManagement(pool);
    console.log(`  management: ${m.headline.total_tenants} tenants, ${m.categories.length} categories, entity_partitioned=${m.entity_counts.tenant_partitioned}, degraded=${m.degraded}`);
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
    if (e.armable_count !== 4) throw new Error(`armable_count expected 4, got ${e.armable_count}`);
    if (m.entity_counts.tenant_partitioned !== false) throw new Error('entity_counts must not claim per-tenant partitioning');
    if (v.overall === 'FAIL') console.log('  NOTE: validation overall FAIL — inspect areas above.');
    return true;
  } finally {
    await pool.end();
  }
}

(async () => {
  console.log('== 1. Route gating (unauth → expect 401/403/503) ==');
  const gated = await checkRouteGating();
  console.log('\n== 2. Authenticated super-admin + flag OFF (live server → expect 503) ==');
  const authedOff = await checkAuthenticatedFlagOff();
  console.log('\n== 3. Flag ON over HTTP (ephemeral app → expect 200 + honest output) ==');
  const flagOn = await checkFlagOnHttp();
  console.log('\n== 4. Engines (read-only honest output) ==');
  const engines = await checkEngines();

  const fmt = (v: boolean | null) => (v === null ? 'SKIP' : v ? 'OK' : 'FAIL');
  console.log(`\nRESULT: gating=${fmt(gated)} authedFlagOff=${fmt(authedOff)} flagOnHttp=${fmt(flagOn)} engines=${fmt(engines)}`);
  // Hard requirements: flag-ON HTTP + engines must pass. Live-server legs may SKIP (server not up).
  const hardFail = !flagOn || !engines || gated === false || authedOff === false;
  process.exit(hardFail ? 1 : 0);
})();
