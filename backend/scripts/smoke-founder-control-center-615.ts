/**
 * Smoke test — Phase 6.15 Founder Control Center console.
 *
 * Verifies:
 *   1. Unauthenticated: every console route returns 401/403/503 (global gate, byte-identical legacy).
 *   2. Authenticated super-admin + flag OFF (live server): console routes return 503 — proving the
 *      console-flag gate is distinct from the auth gate (the flag-OFF byte-identical guarantee).
 *   3. Flag ON over HTTP (ephemeral in-process app with stubbed auth + flag forced on): the GET
 *      console routes return 200 with honest, well-formed composed output against real data.
 *   4. Engines run read-only and return honest, well-formed output (direct invocation).
 *
 * Run: cd backend && npx tsx scripts/smoke-founder-control-center-615.ts
 */
import pg from 'pg';
import express from 'express';
import type { AddressInfo } from 'net';
import { buildFounderDashboard } from '../services/founder-control-center/founder-dashboard-engine';
import { buildExecutiveIntelligence } from '../services/founder-control-center/executive-intelligence-engine';
import { buildStrategicInsights } from '../services/founder-control-center/strategic-insights-engine';
import { buildFounderControlCenterValidation } from '../services/founder-control-center/founder-control-center-validation';
import { healthBand } from '../services/founder-control-center/founder-control-center-lib';
import { registerFounderControlCenterRoutes } from '../routes/founder-control-center';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:8080';
const SA_USER = process.env.SUPER_ADMIN_EMAIL || 'support@metryxone.com';
const SA_PASS = process.env.SUPER_ADMIN_PASSWORD || 'admin123';

const GET_ROUTES = [
  '/api/admin/founder-control-center/console/ping',
  '/api/admin/founder-control-center/console/dashboard',
  '/api/admin/founder-control-center/console/executive',
  '/api/admin/founder-control-center/console/strategic',
  '/api/admin/founder-control-center/console/validation',
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
  process.env.FF_FOUNDER_CONTROL_CENTER = '1';
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const app = express();
  app.use(express.json());
  const pass = (_req: any, _res: any, next: any) => next();
  registerFounderControlCenterRoutes(app, pool, pass, pass);
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
    const dash: any = await (await fetch(`${local}/api/admin/founder-control-center/console/dashboard`)).json();
    const sectionKeys = (dash.sections || []).map((s: any) => s.key).sort();
    if (JSON.stringify(sectionKeys) !== JSON.stringify(['adoption', 'growth', 'retention', 'revenue'])) {
      throw new Error(`dashboard sections unexpected: ${sectionKeys.join(',')}`);
    }
    const allKpis = dash.sections.flatMap((s: any) => s.kpis);
    if (allKpis.some((k: any) => k.value != null && k.value < 0)) throw new Error('KPI value negative');
    if (allKpis.some((k: any) => !k.present && k.value != null)) throw new Error('absent-source KPI fabricated a value');
    if (allKpis.some((k: any) => k.trend && k.trend.delta_pct != null && (k.trend.previous == null || k.trend.previous <= 0))) {
      throw new Error('trend delta computed over a null/zero base');
    }

    const exec: any = await (await fetch(`${local}/api/admin/founder-control-center/console/executive`)).json();
    for (const d of exec.domains) {
      if (d.score != null && (d.score < 0 || d.score > 100)) throw new Error(`health score out of [0,100]: ${d.key}`);
      if (d.band !== healthBand(d.score)) throw new Error(`band≠score band: ${d.key}`);
      if (d.measurable !== (d.score != null)) throw new Error(`measurable flag incoherent: ${d.key}`);
    }

    const strat: any = await (await fetch(`${local}/api/admin/founder-control-center/console/strategic`)).json();
    if (strat.insights.some((i: any) => !i.metric_ref)) throw new Error('insight lacks metric_ref (fabricated)');
    if (strat.risk_indicators.some((r: any) => !r.measurable && r.severity !== 'info')) {
      throw new Error('unmeasurable risk raised above info');
    }

    console.log(`  dashboard: ${dash.sections.length} sections, ${allKpis.length} KPIs, degraded=${dash.degraded}`);
    console.log(`  executive: overall=${exec.overall_score ?? 'null'} (${exec.overall_band}), measurable=${exec.domains.filter((d: any) => d.measurable).length}/${exec.domains.length}`);
    console.log(`  strategic: ${strat.risk_indicators.length} risks (${strat.risk_summary.high}H/${strat.risk_summary.medium}M/${strat.risk_summary.low}L), ${strat.insights.length} insights`);
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
    const dash = await buildFounderDashboard(pool);
    console.log(`  dashboard: degraded=${dash.degraded}`);
    for (const s of dash.sections) console.log(`    - ${s.key}: ${s.kpis.map((k) => `${k.key}=${k.present ? (k.value ?? 'null') : 'absent'}`).join(', ')}`);
    const exec = await buildExecutiveIntelligence(pool);
    console.log(`  executive: overall=${exec.overall_score ?? 'null'} (${exec.overall_band})`);
    for (const d of exec.domains) console.log(`    - ${d.key}: score=${d.score ?? 'null'} band=${d.band} measurable=${d.measurable}`);
    const strat = await buildStrategicInsights(pool);
    console.log(`  strategic: ${strat.risk_indicators.length} risks, ${strat.insights.length} insights, degraded=${strat.degraded}`);
    const v = await buildFounderControlCenterValidation(pool);
    console.log(`  validation: overall=${v.overall}`);
    for (const a of v.areas) console.log(`    - ${a.area}: ${a.status} — ${a.detail}`);

    // Honesty assertions.
    const allKpis = dash.sections.flatMap((s) => s.kpis);
    if (allKpis.some((k) => k.value != null && k.value < 0)) throw new Error('KPI negative');
    if (allKpis.some((k) => !k.present && k.value != null)) throw new Error('absent-source KPI fabricated');
    for (const d of exec.domains) {
      if (d.score != null && (d.score < 0 || d.score > 100)) throw new Error('health out of bounds');
      if (d.band !== healthBand(d.score)) throw new Error('band incoherent');
    }
    if (strat.insights.some((i) => !i.metric_ref)) throw new Error('insight without provenance');
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
