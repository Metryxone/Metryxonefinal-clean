/**
 * Phase 6.8 — Customer Success Intelligence smoke test (self-cleaning, @example.com only).
 *
 * Engine-level (direct DB): assert the three engines compose real substrate without throwing and
 * surface honest substrate flags + a transparent health index. Plus HTTP flag-OFF 503 verification
 * against the running Backend API (the workflow runs WITHOUT FF_COMMERCIAL_CUSTOMER_SUCCESS).
 *
 * Seeds nothing destructive: a single @example.com capadex repeat-buyer to exercise the upsell
 * expansion signal, removed at the end (and on failure). Never touches real identities.
 */
import pg from 'pg';
import { buildEngagementAnalytics } from '../services/commercial/engagement-engine';
import { buildRetentionAnalytics } from '../services/commercial/retention-engine';
import { buildCustomerSuccess } from '../services/commercial/customer-success-engine';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const EMAIL = 'cust-success-smoke@example.com';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : ''); }
};

async function tableExists(name: string): Promise<boolean> {
  const { rows } = await pool.query(`SELECT to_regclass($1) AS oid`, [name]).catch(() => ({ rows: [{ oid: null }] }) as any);
  return rows[0]?.oid != null;
}

async function cleanup() {
  await pool.query(`DELETE FROM capadex_payments WHERE lower(email) = lower($1)`, [EMAIL]).catch(() => {});
}

async function main() {
  await cleanup();

  // Seed a repeat one-time buyer (2 paid) so the expansion upsell signal has a real row to surface.
  const hasCapadexPayments = await tableExists('capadex_payments');
  if (hasCapadexPayments) {
    for (let i = 0; i < 2; i++) {
      await pool.query(
        `INSERT INTO capadex_payments (email, concern_name, stage_code, stage_name, amount_paise, status, created_at)
         VALUES ($1,'Smoke Concern','smoke_stage','Smoke Stage',50000,'paid', now())`,
        [EMAIL],
      ).catch(() => {});
    }
  }

  console.log('\n[1] engagement engine composes (never throws)');
  const eng = await buildEngagementAnalytics(pool);
  ok('returns object', !!eng && typeof eng === 'object');
  ok('substrate.users probed (boolean)', typeof eng.substrate.users === 'boolean', eng.substrate);
  ok('adoption.total_users is a number ≥ 0', typeof eng.adoption.total_users === 'number' && eng.adoption.total_users >= 0, eng.adoption);
  ok('completion_pct in [0,100]', eng.completion.capadex_completion_pct >= 0 && eng.completion.capadex_completion_pct <= 100, eng.completion);
  ok('active_sessions is number|null (no_substrate vs zero distinct)', eng.engagement.active_sessions === null || typeof eng.engagement.active_sessions === 'number', eng.engagement.active_sessions);

  console.log('\n[2] retention engine composes (never throws)');
  const ret = await buildRetentionAnalytics(pool);
  ok('returns object', !!ret && typeof ret === 'object');
  ok('renewals composed (window_days present)', typeof ret.retention_risk.renewals.window_days === 'number', ret.retention_risk.renewals);
  ok('at_risk is number ≥ 0', typeof ret.retention_risk.at_risk === 'number' && ret.retention_risk.at_risk >= 0, ret.retention_risk);
  if (hasCapadexPayments) {
    const buyer = ret.expansion.repeat_onetime_buyers.find((b) => b.email.toLowerCase() === EMAIL.toLowerCase());
    ok('expansion lists our repeat buyer (2 paid)', buyer?.paid_purchases === 2, buyer);
  } else {
    ok('capadex_payments absent → upsell signal honestly empty', ret.expansion.repeat_onetime_buyers.length === 0);
  }

  console.log('\n[3] customer success engine composes both + health index');
  const cs = await buildCustomerSuccess(pool);
  ok('returns object', !!cs && typeof cs === 'object');
  ok('embeds engagement + retention', !!cs.engagement && !!cs.retention);
  ok('headline numeric fields', typeof cs.headline.total_users === 'number' && typeof cs.headline.active_subscriptions === 'number', cs.headline);
  ok('health.measurable is boolean', typeof cs.health.measurable === 'boolean', cs.health);
  // Honesty: when measurable, score ∈ [0,100]; when not, score === null with a reason (never fabricated).
  if (cs.health.measurable) {
    ok('measurable → score ∈ [0,100]', cs.health.score != null && cs.health.score >= 0 && cs.health.score <= 100, cs.health);
    const wsum = cs.health.components.reduce((a, c) => a + c.weight, 0);
    ok('component weights renormalise to ~1', Math.abs(wsum - 1) < 0.001, cs.health.components);
  } else {
    ok('not measurable → score null + reason', cs.health.score === null && !!cs.health.reason, cs.health);
  }

  // ── HTTP flag-OFF → 503/401 (Backend API runs WITHOUT FF_COMMERCIAL_CUSTOMER_SUCCESS) ────────────
  console.log('\n[4] HTTP flag-OFF gated (503/401, not 200)');
  const base = `http://localhost:8080`;
  for (const path of [
    '/api/admin/commercial/success/ping',
    '/api/admin/commercial/success/analytics',
    '/api/admin/commercial/success/engagement',
    '/api/admin/commercial/success/retention',
  ]) {
    try {
      const res = await fetch(`${base}${path}`, { headers: { 'content-type': 'application/json' } });
      ok(`GET ${path} gated`, res.status === 503 || res.status === 401, res.status);
    } catch (e: any) {
      ok(`GET ${path} reachable`, false, e?.message);
    }
  }

  await cleanup();
  await pool.end();
  console.log(`\n──────── ${pass} passed, ${fail} failed ────────`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('SMOKE FATAL', e);
  await cleanup().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(1);
});
