/**
 * Smoke test — Phase 6.13 Automation Engine console.
 *
 * Verifies:
 *   1. Unauthenticated: every console route returns 401/403/503 (global gate, byte-identical legacy).
 *   2. Authenticated super-admin + flag OFF (live server): console routes return 503 — proving the
 *      console-flag gate is distinct from the auth gate (the flag-OFF byte-identical guarantee).
 *   3. Flag ON over HTTP (ephemeral in-process app with stubbed auth + flags forced on): the GET
 *      console routes return 200 with honest, well-formed composed output against real data.
 *   4. Engines run read-only and return honest, well-formed output (direct invocation).
 *
 * Run: cd backend && npx tsx scripts/smoke-automation-engine-613.ts
 */
import pg from 'pg';
import express from 'express';
import type { AddressInfo } from 'net';
import { buildAutomationOverview, AUTOMATION_TYPES } from '../services/automation/automation-engine';
import { buildWorkflowOverview } from '../services/automation/workflow-engine';
import { buildCampaignOverview } from '../services/automation/campaign-engine';
import { buildAutomationValidation } from '../services/automation/automation-validation';
import { getExecutionStatus } from '../services/automation/automation-execution';
import { registerAutomationEngineRoutes } from '../routes/automation-engine';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:8080';
const SA_USER = process.env.SUPER_ADMIN_EMAIL || 'support@metryxone.com';
const SA_PASS = process.env.SUPER_ADMIN_PASSWORD || 'admin123';

const ROUTES = [
  '/api/admin/automation/console/ping',
  '/api/admin/automation/console/automations',
  '/api/admin/automation/console/workflows',
  '/api/admin/automation/console/campaigns',
  '/api/admin/automation/console/execution',
  '/api/admin/automation/console/validation',
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
  process.env.FF_AUTOMATION_ENGINE = '1';
  process.env.FF_AUTOMATION_EXECUTION = '1';
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const app = express();
  app.use(express.json());
  const pass = (_req: any, _res: any, next: any) => next();
  registerAutomationEngineRoutes(app, pool, pass, pass);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const local = `http://127.0.0.1:${port}`;
  let allOk = true;
  try {
    for (const r of ROUTES) {
      const res = await fetch(`${local}${r}`);
      const ok = res.status === 200;
      if (!ok) allOk = false;
      console.log(`  ${ok ? 'PASS' : 'FAIL'} ${r} → ${res.status}`);
    }
    // Honest-shape assertions on the flag-ON HTTP payloads.
    const auto: any = await (await fetch(`${local}/api/admin/automation/console/automations`)).json();
    if (!Array.isArray(auto.automation_types) || auto.automation_types.length !== AUTOMATION_TYPES.length) {
      throw new Error(`automation_types expected ${AUTOMATION_TYPES.length}, got ${auto.automation_types?.length}`);
    }
    const negative = auto.automation_types.filter((t: any) => t.eligible_now != null && t.eligible_now < 0);
    if (negative.length) throw new Error('eligible_now must never be negative');
    const fabricated = auto.automation_types.filter((t: any) => !t.measured && t.eligible_now != null);
    if (fabricated.length) throw new Error('unmeasured types must report eligible_now=null (no fabricated 0)');
    const exec: any = await (await fetch(`${local}/api/admin/automation/console/execution`)).json();
    if (exec.execution_flag !== true) throw new Error('execution_flag should be ON in flag-ON HTTP run');
    console.log(`  automations: ${auto.totals.measurable}/${auto.totals.types} measurable, eligible_total=${auto.totals.eligible_total}`);
    console.log(`  execution: schema_ready=${exec.schema_ready}, tables=${exec.tables.map((t: any) => `${t.table}:${t.exists}`).join(', ')}`);
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
    const a = await buildAutomationOverview(pool);
    console.log(`  automation: ${a.totals.measurable}/${a.totals.types} measurable, eligible_total=${a.totals.eligible_total}, degraded=${a.degraded}`);
    for (const t of a.automation_types) console.log(`    - ${t.key}: eligible_now=${t.eligible_now} measured=${t.measured} (${t.present_sources.join(',') || 'no source'})`);
    const w = await buildWorkflowOverview(pool);
    console.log(`  workflow: provisioned=${w.provisioned}, defs=${w.summary.total_definitions}, instances=${w.summary.total_instances}`);
    const c = await buildCampaignOverview(pool);
    console.log(`  campaign: provisioned=${c.provisioned}, defs=${c.summary.total_definitions}, eios=${c.composed.eios_campaigns?.count ?? 'null'}, outreach=${c.composed.employer_outreach?.total ?? 'null'}`);
    const e = await getExecutionStatus(pool);
    console.log(`  execution: schema_ready=${e.schema_ready}`);
    const v = await buildAutomationValidation(pool);
    console.log(`  validation: overall=${v.overall} (${v.summary.pass}P/${v.summary.warn}W/${v.summary.fail}F)`);
    // Honesty assertions.
    if (a.totals.types !== AUTOMATION_TYPES.length) throw new Error('totals.types mismatch');
    const neg = a.automation_types.filter((t) => t.eligible_now != null && t.eligible_now < 0);
    if (neg.length) throw new Error('eligible_now out of bounds (negative)');
    const fab = a.automation_types.filter((t) => !t.measured && t.eligible_now != null);
    if (fab.length) throw new Error('unmeasured type fabricated a non-null eligible_now');
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
