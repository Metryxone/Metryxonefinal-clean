/**
 * Smoke test — Phase 6.12 Partner Ecosystem (additive over the 6.11 console).
 *
 * Verifies:
 *   1. Unauthenticated: every partner route returns 401/403/503 (global gate, byte-identical legacy).
 *   2. Authenticated super-admin + flag OFF (live server): partner routes return 503 — proving the
 *      partnerEcosystem flag gate is distinct from the auth gate (flag-OFF byte-identical guarantee).
 *   3. Flag ON over HTTP (ephemeral in-process app, stubbed auth, flag forced on): GET routes 200 with
 *      honest composed output; the full lifecycle (setup → agreement → transition → referral → convert →
 *      payout) round-trips; invalid transitions are rejected; cleanup removes all test rows.
 *   4. Read engine + validation harness run read-only and return honest, well-formed output.
 *
 * Run: cd backend && npx tsx scripts/smoke-partner-ecosystem-612.ts
 */
import pg from 'pg';
import express from 'express';
import type { AddressInfo } from 'net';
import { buildPartnerEcosystem } from '../services/tenant/partner-ecosystem-engine';
import { buildPartnerEcosystemValidation } from '../services/tenant/partner-ecosystem-validation';
import { registerMultiTenantArchitectureRoutes } from '../routes/multi-tenant-architecture';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:8080';
const SA_USER = process.env.SUPER_ADMIN_EMAIL || 'support@metryxone.com';
const SA_PASS = process.env.SUPER_ADMIN_PASSWORD || 'admin123';
const P = '/api/admin/tenant-architecture/console/partner-ecosystem';

const ROUTES = [
  `${P}/ping`,
  `${P}/meta`,
  `${P}/validation`,
  P,
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

// 2. Authenticated super-admin + flag OFF (live server) → 503.
async function checkAuthenticatedFlagOff(): Promise<boolean | null> {
  let cookie: string | null = null;
  try {
    const login = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: SA_USER, password: SA_PASS }),
    });
    if (login.status !== 200) {
      console.log(`  SKIP (super-admin login returned ${login.status})`);
      return null;
    }
    const body: any = await login.json().catch(() => ({}));
    if (body?.mfaRequired) {
      console.log('  SKIP (MFA required — ZOHO configured)');
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
    const ok = res.status === 503;
    if (!ok) all503 = false;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${r} → ${res.status} (expect 503: authed + flag OFF)`);
  }
  return all503;
}

// 3. Flag ON over HTTP — ephemeral app, stubbed auth, flag forced on; full lifecycle round-trip.
async function checkFlagOnHttp(): Promise<boolean> {
  process.env.FF_PARTNER_ECOSYSTEM = '1';
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const app = express();
  app.use(express.json());
  const pass = (_req: any, _res: any, next: any) => next();
  registerMultiTenantArchitectureRoutes(app, pool, pass, pass);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const local = `http://127.0.0.1:${port}`;
  const j = (path: string, method = 'GET', body?: any) =>
    fetch(`${local}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

  let allOk = true;
  const created: { agreementIds: number[]; referralIds: number[] } = { agreementIds: [], referralIds: [] };
  // Pick two real tenants for attribution (partner + referred). Skip lifecycle if <2 exist.
  let partnerTenant: number | null = null;
  let referredTenant: number | null = null;
  try {
    for (const r of ROUTES) {
      const res = await j(r);
      const ok = res.status === 200;
      if (!ok) allOk = false;
      console.log(`  ${ok ? 'PASS' : 'FAIL'} ${r} → ${res.status}`);
    }

    const tr = await pool.query(`SELECT id FROM tenants ORDER BY id ASC LIMIT 2`);
    if (tr.rowCount && tr.rowCount >= 1) partnerTenant = Number(tr.rows[0].id);
    if (tr.rowCount && tr.rowCount >= 2) referredTenant = Number(tr.rows[1].id);

    if (partnerTenant == null) {
      console.log('  SKIP lifecycle (no tenants exist to attribute against)');
    } else {
      const stamp = Date.now();
      // setup
      const setup = await j(`${P}/setup`, 'POST', {});
      if (setup.status !== 200) throw new Error(`setup → ${setup.status}`);

      // create agreement (defaults draft)
      const agCode = `SMOKE-AGR-${stamp}`;
      const ag = await (await j(`${P}/agreements`, 'POST', {
        tenant_id: partnerTenant, partner_type: 'channel', agreement_code: agCode, commission_pct: 10,
      })).json();
      if (ag.status !== 'draft') throw new Error(`new agreement expected draft, got ${ag.status}`);
      created.agreementIds.push(ag.id);
      console.log(`  PASS agreement created id=${ag.id} status=draft inserted=${ag.inserted}`);

      // invalid transition draft → suspended must be rejected
      const bad = await j(`${P}/agreements/${ag.id}/transition`, 'POST', { status: 'suspended' });
      if (bad.status === 200) throw new Error('invalid transition draft→suspended was accepted');
      console.log(`  PASS invalid transition draft→suspended rejected (${bad.status})`);

      // valid draft → active
      const act = await (await j(`${P}/agreements/${ag.id}/transition`, 'POST', { status: 'active' })).json();
      if (act.status !== 'active') throw new Error(`transition to active failed: ${JSON.stringify(act)}`);
      console.log('  PASS agreement draft→active');

      // events log records both
      const ev = await (await j(`${P}/agreements/${ag.id}/events`)).json();
      if (!Array.isArray(ev.events) || ev.events.length < 2) throw new Error('agreement events not logged');
      console.log(`  PASS agreement events logged (${ev.events.length})`);

      // create referral (pending)
      const refCode = `SMOKE-REF-${stamp}`;
      const ref = await (await j(`${P}/referrals`, 'POST', {
        channel_partner_tenant_id: partnerTenant,
        referred_tenant_id: referredTenant,
        referral_code: refCode, commission_pct: 5,
      })).json();
      if (ref.status !== 'pending') throw new Error(`new referral expected pending, got ${ref.status}`);
      created.referralIds.push(ref.id);
      console.log(`  PASS referral created id=${ref.id} status=pending`);

      // duplicate referral code → 409
      const dup = await j(`${P}/referrals`, 'POST', {
        channel_partner_tenant_id: partnerTenant, referral_code: refCode,
      });
      if (dup.status !== 409) throw new Error(`duplicate referral expected 409, got ${dup.status}`);
      console.log('  PASS duplicate referral_code → 409');

      // convert referral with amount → payout should reflect it
      const conv = await (await j(`${P}/referrals/${ref.id}/transition`, 'POST', {
        status: 'converted', commission_amount: 2500,
      })).json();
      if (conv.status !== 'converted' || Number(conv.commission_amount) !== 2500) {
        throw new Error(`convert failed: ${JSON.stringify(conv)}`);
      }
      if (!conv.converted_at) throw new Error('converted referral missing converted_at');
      console.log('  PASS referral pending→converted (amount 2500)');

      // overview reflects the payout
      const eco = await (await j(P)).json();
      const payout = eco.payouts.find((p: any) => p.channel_partner_tenant_id === partnerTenant);
      if (!payout || payout.earned_commission < 2500) {
        throw new Error(`payout did not reflect converted amount: ${JSON.stringify(payout)}`);
      }
      console.log(`  PASS payout reflects earned=${payout.earned_commission}`);

      // validation harness should be PASS/WARN (never FAIL on healthy data)
      const val = await (await j(`${P}/validation`)).json();
      if (val.overall === 'FAIL') throw new Error(`validation FAIL: ${JSON.stringify(val.summary)}`);
      console.log(`  PASS validation overall=${val.overall} (${val.summary.pass}P/${val.summary.warn}W/${val.summary.fail}F)`);
    }
  } catch (e) {
    allOk = false;
    console.log(`  FAIL lifecycle: ${String(e)}`);
  } finally {
    // Cleanup all test rows (events cascade on agreement delete).
    try {
      for (const id of created.referralIds) await pool.query(`DELETE FROM tenant_channel_referrals WHERE id = $1`, [id]);
      for (const id of created.agreementIds) await pool.query(`DELETE FROM tenant_partner_agreements WHERE id = $1`, [id]);
    } catch (e) {
      console.log(`  WARN cleanup failed: ${String(e)}`);
    }
    server.close();
    await pool.end();
  }
  return allOk;
}

// 4. Direct engine + validation invocation (read-only honest output).
async function checkEngines(): Promise<boolean> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const eco = await buildPartnerEcosystem(pool);
    console.log(`  engine: ${eco.headline.total_agreements} agreements, ${eco.headline.total_referrals} referrals, earned=${eco.headline.total_earned_commission}, degraded=${eco.degraded}`);
    const val = await buildPartnerEcosystemValidation(pool);
    console.log(`  validation: overall=${val.overall} (${val.summary.pass}P/${val.summary.warn}W/${val.summary.fail}F)`);
    // Honesty assertions.
    const cr = eco.headline.conversion_rate_pct;
    if (cr != null && (cr < 0 || cr > 100)) throw new Error('conversion_rate_pct out of bounds');
    if (eco.headline.total_earned_commission < 0) throw new Error('earned commission negative');
    // Payout earned must reconcile with converted-referral amounts in the engine output.
    const derived = new Map<number, number>();
    for (const r of eco.referrals) {
      if (r.status === 'converted' && r.commission_amount != null) {
        derived.set(r.channel_partner_tenant_id, (derived.get(r.channel_partner_tenant_id) ?? 0) + r.commission_amount);
      }
    }
    for (const p of eco.payouts) {
      const d = Math.round((derived.get(p.channel_partner_tenant_id) ?? 0) * 100) / 100;
      if (Math.abs(d - p.earned_commission) > 0.01) throw new Error(`payout drift for partner ${p.channel_partner_tenant_id}`);
    }
    if (val.overall === 'FAIL') console.log('  NOTE: validation overall FAIL — inspect areas.');
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
  console.log('\n== 3. Flag ON over HTTP (ephemeral app → 200 + full lifecycle round-trip) ==');
  const flagOn = await checkFlagOnHttp();
  console.log('\n== 4. Engines + validation (read-only honest output) ==');
  const engines = await checkEngines();

  const fmt = (v: boolean | null) => (v === null ? 'SKIP' : v ? 'OK' : 'FAIL');
  console.log(`\nRESULT: gating=${fmt(gated)} authedFlagOff=${fmt(authedOff)} flagOnHttp=${fmt(flagOn)} engines=${fmt(engines)}`);
  const hardFail = !flagOn || !engines || gated === false || authedOff === false;
  process.exit(hardFail ? 1 : 0);
})();
