/**
 * Smoke test — Phase 6.14 Super Admin Command Center console.
 *
 * Verifies:
 *   1. Unauthenticated: every console route returns 401/403/503 (global gate, byte-identical legacy).
 *   2. Authenticated super-admin + flag OFF (live server): console routes return 503 — proving the
 *      console-flag gate is distinct from the auth gate (the flag-OFF byte-identical guarantee).
 *   3. Flag ON over HTTP (ephemeral in-process app with stubbed auth + flag forced on): the GET
 *      console routes return 200 with honest, well-formed composed output against real data.
 *   4. Engines run read-only and return honest, well-formed output (direct invocation).
 *
 * Run: cd backend && npx tsx scripts/smoke-command-center-614.ts
 */
import pg from 'pg';
import express from 'express';
import type { AddressInfo } from 'net';
import { buildCommandCenterOverview, DOMAIN_SPECS } from '../services/command-center/command-center-engine';
import { buildControlTower } from '../services/command-center/control-tower-engine';
import { buildGlobalMonitoring } from '../services/command-center/global-monitoring-engine';
import { buildCommandCenterValidation } from '../services/command-center/command-center-validation';
import { registerCommandCenterRoutes } from '../routes/superadmin-command-center';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:8080';
const SA_USER = process.env.SUPER_ADMIN_EMAIL || 'support@metryxone.com';
const SA_PASS = process.env.SUPER_ADMIN_PASSWORD || 'admin123';

const GET_ROUTES = [
  '/api/admin/command-center/console/ping',
  '/api/admin/command-center/console/unified',
  '/api/admin/command-center/console/control-tower',
  '/api/admin/command-center/console/monitoring',
  '/api/admin/command-center/console/validation',
];

// 1. Unauthenticated → gated.
async function checkRouteGating(): Promise<boolean | null> {
  let allGated = true;
  let reachable = false;
  for (const r of GET_ROUTES) {
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
  for (const r of GET_ROUTES) {
    const res = await fetch(`${BASE}${r}`, { headers: { cookie: sessionCookie } });
    const ok = res.status === 503; // authed but flag OFF
    if (!ok) all503 = false;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${r} → ${res.status} (expect 503: authed + flag OFF)`);
  }
  return all503;
}

// 3. Flag ON over HTTP — ephemeral app, stubbed auth, flag forced on.
async function checkFlagOnHttp(): Promise<boolean> {
  process.env.FF_COMMAND_CENTER = '1';
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const app = express();
  app.use(express.json());
  const pass = (_req: any, _res: any, next: any) => next();
  registerCommandCenterRoutes(app, pool, pass, pass);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const local = `http://127.0.0.1:${port}`;
  let allOk = true;
  try {
    for (const r of GET_ROUTES) {
      const res = await fetch(`${local}${r}`);
      const ok = res.status === 200;
      if (!ok) allOk = false;
      console.log(`  ${ok ? 'PASS' : 'FAIL'} ${r} → ${res.status}`);
    }
    // Honest-shape assertions on the flag-ON HTTP payloads.
    const unified: any = await (await fetch(`${local}/api/admin/command-center/console/unified`)).json();
    if (!Array.isArray(unified.domains) || unified.domains.length !== DOMAIN_SPECS.length) {
      throw new Error(`domains expected ${DOMAIN_SPECS.length}, got ${unified.domains?.length}`);
    }
    const negative = unified.domains.flatMap((d: any) =>
      d.metrics.filter((m: any) => m.value != null && m.value < 0));
    if (negative.length) throw new Error('domain metric values must never be negative');
    const fabricated = unified.domains.flatMap((d: any) =>
      d.metrics.filter((m: any) => !m.present && m.value != null));
    if (fabricated.length) throw new Error('absent-source metrics must report null (no fabricated 0)');
    const tower: any = await (await fetch(`${local}/api/admin/command-center/console/control-tower`)).json();
    const measuredSum = tower.pending_actions.reduce((a: number, p: any) => a + (p.count ?? 0), 0);
    if (tower.pending_total != null && tower.pending_total !== measuredSum) {
      throw new Error(`pending_total ${tower.pending_total} != sum of parts ${measuredSum}`);
    }
    const mon: any = await (await fetch(`${local}/api/admin/command-center/console/monitoring`)).json();
    if ((mon.alerts?.critical_escalations ?? 0) > 0 && mon.status === 'operational') {
      throw new Error("monitoring status 'operational' despite critical escalations");
    }
    console.log(`  unified: ${unified.totals.measurable}/${unified.totals.domains} measurable, degraded=${unified.degraded}`);
    console.log(`  control-tower: pending_total=${tower.pending_total}, users=${tower.platform?.total_users}`);
    console.log(`  monitoring: status=${mon.status}, subsystems=${mon.subsystem_coverage?.measurable}/${mon.subsystem_coverage?.total}`);
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
    const o = await buildCommandCenterOverview(pool);
    console.log(`  overview: ${o.totals.measurable}/${o.totals.domains} measurable, degraded=${o.degraded}`);
    for (const d of o.domains) console.log(`    - ${d.key}: measurable=${d.measurable} headline=${d.headline?.value ?? 'null'} (${d.present_sources.join(',') || 'no source'})`);
    const c = await buildControlTower(pool);
    console.log(`  control-tower: pending_total=${c.pending_total}, users=${c.platform.total_users}, sessions=${c.platform.active_sessions}`);
    const m = await buildGlobalMonitoring(pool);
    console.log(`  monitoring: status=${m.status}, gov_alerts=${m.alerts.active_governance_alerts}, crit=${m.alerts.critical_escalations}`);
    const v = await buildCommandCenterValidation(pool);
    console.log(`  validation: overall=${v.overall} (${v.summary.pass}P/${v.summary.warn}W/${v.summary.fail}F)`);
    for (const a of v.areas) console.log(`    - ${a.area}: ${a.status} — ${a.detail}`);
    // Honesty assertions.
    if (o.totals.domains !== DOMAIN_SPECS.length) throw new Error('totals.domains mismatch');
    const neg = o.domains.flatMap((d) => d.metrics.filter((mm) => mm.value != null && mm.value < 0));
    if (neg.length) throw new Error('domain metric out of bounds (negative)');
    const fab = o.domains.flatMap((d) => d.metrics.filter((mm) => !mm.present && mm.value != null));
    if (fab.length) throw new Error('absent-source metric fabricated a non-null value');
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
  const hardFail = !flagOn || !engines || gated === false || authedOff === false;
  process.exit(hardFail ? 1 : 0);
})();
