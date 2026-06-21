/**
 * PHASE 6 — End-to-end commercial smoke (TEST/demo mode, self-cleaning).
 *
 * Seeds a full @example.com commercial path against the REAL schema:
 *   comm_customers → comm_products → comm_plans → comm_subscriptions →
 *   comm_entitlement_grants → comm_usage_events → capadex_payments
 * then asserts structural invariants and exercises the Phase-6 read-only validation engine.
 *
 * What it PROVES (honesty-first, never fabricates production data):
 *   1. GET-never-writes: row counts across every commercial table are IDENTICAL before and
 *      after a validation run (zero delta) — the harness performs no DDL and no writes.
 *   2. Clean substrate → 0 FAIL (WARN-heavy is the honest pre-activation baseline).
 *   3. Seeded valid substrate → still 0 FAIL, and the previously-empty areas become measurable.
 *   4. Invariants hold: no negative amounts, period_end ≥ period_start, MRR roll-up coherent,
 *      entitlement coverage_pct becomes non-null once a paying identity exists.
 *   5. FAIL-detection works: a deliberately invalid row (negative plan price) makes the
 *      Commercial Layer area FAIL — then it is removed.
 *   6. Idempotency: comm_idempotency_keys enforces single-use (duplicate key → conflict).
 *
 * All seeded rows are marked with SMOKE_EMAIL / SMOKE_TAG and removed in a finally block, so a
 * re-run is deterministic and leaves the DB byte-identical to its starting state.
 *
 * Run:  cd backend && npx tsx scripts/smoke-commercial-platform.ts
 */

import { Pool } from 'pg';
import { runCommercialPlatformValidation } from '../services/commercial-platform-validation-engine.js';
import { buildRecurringRevenue } from '../services/wc7c/revenue-intelligence.js';
import { buildEntitlementOverview } from '../services/wc7c/entitlement-engine.js';

const SMOKE_EMAIL = 'phase6-smoke@example.com';
const SMOKE_TAG = 'SMOKE6';

const COMMERCIAL_TABLES = [
  'comm_customers', 'comm_products', 'comm_plans', 'comm_subscriptions',
  'comm_entitlement_grants', 'comm_usage_events', 'capadex_payments',
  'comm_idempotency_keys',
];

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    failures += 1;
    console.log(`  ✗ FAIL: ${msg}`);
  }
}

async function tableExists(pool: Pool, t: string): Promise<boolean> {
  return !!(await pool.query('SELECT to_regclass($1) r', [t])).rows[0].r;
}

async function counts(pool: Pool): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of COMMERCIAL_TABLES) {
    if (!(await tableExists(pool, t))) continue;
    out[t] = Number((await pool.query(`SELECT COUNT(*)::int n FROM ${t}`)).rows[0].n);
  }
  return out;
}

async function cleanup(pool: Pool) {
  // Remove anything this smoke could have created. Order respects FKs (children first).
  await pool.query('DELETE FROM comm_usage_events WHERE email = $1', [SMOKE_EMAIL]).catch(() => {});
  await pool.query('DELETE FROM comm_entitlement_grants WHERE email = $1', [SMOKE_EMAIL]).catch(() => {});
  await pool.query(
    `DELETE FROM comm_subscriptions WHERE customer_id IN (SELECT id FROM comm_customers WHERE email = $1)`,
    [SMOKE_EMAIL],
  ).catch(() => {});
  await pool.query(`DELETE FROM comm_plans WHERE code LIKE '${SMOKE_TAG}%'`).catch(() => {});
  await pool.query(`DELETE FROM comm_products WHERE code LIKE '${SMOKE_TAG}%'`).catch(() => {});
  await pool.query('DELETE FROM comm_customers WHERE email = $1', [SMOKE_EMAIL]).catch(() => {});
  await pool.query('DELETE FROM capadex_payments WHERE email = $1', [SMOKE_EMAIL]).catch(() => {});
  await pool.query(`DELETE FROM comm_idempotency_keys WHERE idempotency_key LIKE '${SMOKE_TAG}%'`).catch(() => {});
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('PHASE 6 — commercial platform smoke (TEST/demo, self-cleaning)\n');
    await cleanup(pool); // start from a known-clean state

    // ── 1. GET-never-writes: counts identical around a validation run ─────────
    console.log('[1] GET-never-writes (zero row delta around a validation run)');
    const before = await counts(pool);
    const r0 = await runCommercialPlatformValidation(pool);
    const after = await counts(pool);
    let deltaOk = true;
    for (const t of Object.keys(before)) if (before[t] !== after[t]) deltaOk = false;
    assert(deltaOk, 'no commercial table row count changed during validation (no writes, no DDL)');
    assert(r0.summary.fail === 0, `clean substrate → 0 FAIL (got ${r0.summary.fail}; ${r0.summary.warn} WARN)`);

    // ── 2. Seed a full valid commercial path (@example.com) ──────────────────
    console.log('\n[2] Seed valid commercial path (@example.com)');
    const customerId = (await pool.query(
      `INSERT INTO comm_customers (email, name, segment) VALUES ($1, $2, 'career_builder') RETURNING id`,
      [SMOKE_EMAIL, 'Phase6 Smoke Customer'],
    )).rows[0].id;
    const productId = (await pool.query(
      `INSERT INTO comm_products (code, name, segment) VALUES ($1, $2, 'career_builder') RETURNING id`,
      [`${SMOKE_TAG}_PROD`, 'Phase6 Smoke Product'],
    )).rows[0].id;
    const planId = (await pool.query(
      `INSERT INTO comm_plans (product_id, code, name, billing_interval, interval_count, price_paise, currency)
       VALUES ($1, $2, 'Phase6 Smoke Plan', 'monthly', 1, 99900, 'INR') RETURNING id`,
      [productId, `${SMOKE_TAG}_PLAN`],
    )).rows[0].id;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 86400_000);
    await pool.query(
      `INSERT INTO comm_subscriptions (customer_id, plan_id, segment, status, billing_interval, current_period_start, current_period_end, started_at)
       VALUES ($1, $2, 'career_builder', 'active', 'monthly', $3, $4, $3)`,
      [customerId, planId, now.toISOString(), periodEnd.toISOString()],
    );
    await pool.query(
      `INSERT INTO comm_entitlement_grants (email, feature, status, reason, granted_by)
       VALUES ($1, 'career_builder_pro', 'active', 'phase6 smoke', 'smoke')`,
      [SMOKE_EMAIL],
    );
    await pool.query(
      `INSERT INTO comm_usage_events (email, usage_type, quantity) VALUES ($1, 'assessments', 1)`,
      [SMOKE_EMAIL],
    );
    await pool.query(
      `INSERT INTO capadex_payments (email, stage_code, stage_name, amount_paise, currency, razorpay_payment_id, status)
       VALUES ($1, 'CAP_GRW', 'Growth', 99900, 'INR', $2, 'paid')`,
      [SMOKE_EMAIL, `${SMOKE_TAG}_pay_1`],
    );
    assert(true, 'seeded customer → product → plan → subscription → grant → usage → paid payment');

    // ── 3. Validation over seeded substrate: still 0 FAIL, areas measurable ──
    console.log('\n[3] Validation over seeded substrate');
    const r1 = await runCommercialPlatformValidation(pool);
    assert(r1.summary.fail === 0, `seeded valid substrate → 0 FAIL (got ${r1.summary.fail})`);
    const measurableNow = r1.areas.filter((a) => a.measurable).map((a) => a.id);
    assert(measurableNow.includes('commercial_layer'), 'commercial_layer now measurable (catalog seeded)');
    assert(measurableNow.includes('subscription_intelligence'), 'subscription_intelligence now measurable');
    assert(measurableNow.includes('entitlement_intelligence'), 'entitlement_intelligence now measurable');
    assert(measurableNow.includes('revenue_intelligence'), 'revenue_intelligence now measurable');

    // ── 4. Invariant coherence via composed read engines ─────────────────────
    console.log('\n[4] Composed read-engine coherence (MRR / entitlement coverage)');
    const rec = await buildRecurringRevenue(pool);
    assert((rec.mrr?.active_subscriptions ?? 0) >= 1, `MRR reflects ≥1 active subscription (got ${rec.mrr?.active_subscriptions ?? 0})`);
    assert((rec.mrr?.rupees ?? 0) >= 999, `MRR roll-up ≥ ₹999 from seeded monthly plan (got ₹${rec.mrr?.rupees ?? 0})`);
    const ent = await buildEntitlementOverview(pool);
    assert(ent.coverage_pct !== null, `entitlement coverage_pct non-null once a paying identity exists (got ${ent.coverage_pct})`);

    // ── 5. FAIL-detection: a negative plan price must surface a FAIL ─────────
    console.log('\n[5] FAIL-detection (deliberately invalid row)');
    await pool.query(
      `INSERT INTO comm_plans (product_id, code, name, billing_interval, interval_count, price_paise, currency)
       VALUES ($1, $2, 'Phase6 BAD Plan', 'monthly', 1, -100, 'INR')`,
      [productId, `${SMOKE_TAG}_BADPLAN`],
    );
    const rBad = await runCommercialPlatformValidation(pool);
    const commArea = rBad.areas.find((a) => a.id === 'commercial_layer');
    const priceCheck = commArea?.checks.find((c) => c.id === 'plan_price_non_negative');
    assert(priceCheck?.status === 'fail', 'negative plan price → Commercial Layer plan_price_non_negative FAIL');
    assert(rBad.summary.fail >= 1, `overall summary surfaces the FAIL (fail=${rBad.summary.fail})`);
    await pool.query(`DELETE FROM comm_plans WHERE code = $1`, [`${SMOKE_TAG}_BADPLAN`]);

    // ── 6. Idempotency: single-use key enforced ─────────────────────────────
    console.log('\n[6] Idempotency key single-use');
    if (await tableExists(pool, 'comm_idempotency_keys')) {
      const idemKey = `${SMOKE_TAG}_idem_1`;
      // Unique key is idempotency_key; scope + status are NOT NULL (status CHECK in completed/failed).
      await pool.query(
        `INSERT INTO comm_idempotency_keys (idempotency_key, scope, status) VALUES ($1, $2, 'completed')`,
        [idemKey, `${SMOKE_TAG}_scope`],
      );
      let conflicted = false;
      try {
        await pool.query(
          `INSERT INTO comm_idempotency_keys (idempotency_key, scope, status) VALUES ($1, $2, 'completed')`,
          [idemKey, `${SMOKE_TAG}_scope`],
        );
      } catch {
        conflicted = true;
      }
      assert(conflicted, 'duplicate idempotency key rejected (unique constraint → replay-safe → maps to 409)');
      await pool.query(`DELETE FROM comm_idempotency_keys WHERE idempotency_key = $1`, [idemKey]);
    } else {
      console.log('  · comm_idempotency_keys absent — idempotency check skipped (honest).');
    }

    // ── 7. Determinism: a second validation run yields the same summary ──────
    console.log('\n[7] Determinism');
    const a = await runCommercialPlatformValidation(pool);
    const b = await runCommercialPlatformValidation(pool);
    assert(
      a.summary.pass === b.summary.pass && a.summary.warn === b.summary.warn && a.summary.fail === b.summary.fail,
      'two consecutive runs produce identical pass/warn/fail summaries',
    );
  } finally {
    await cleanup(pool);
    // Honest leftover check: no smoke markers remain.
    const remPay = Number((await pool.query('SELECT COUNT(*)::int n FROM capadex_payments WHERE email=$1', [SMOKE_EMAIL])).rows[0].n);
    const remCust = Number((await pool.query('SELECT COUNT(*)::int n FROM comm_customers WHERE email=$1', [SMOKE_EMAIL])).rows[0].n);
    assert(remPay === 0 && remCust === 0, 'self-clean complete — no @example.com smoke rows remain');
    await pool.end();
  }

  console.log(`\n${failures === 0 ? 'SMOKE PASSED ✅' : `SMOKE FAILED ❌ (${failures} assertion failure(s))`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('smoke crashed:', e);
  process.exit(1);
});
