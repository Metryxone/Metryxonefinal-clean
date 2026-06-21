/**
 * Phase 6.6 — Revenue Intelligence smoke test (self-cleaning, @example.com only).
 *
 * Engine-level (direct DB): seed a recurring subscription + collection events and a one-time
 * capadex payment, then assert buildRevenueAnalytics composes MRR/ARR from buildRecurringRevenue
 * and surfaces the by-dimension breakdowns (product / customer / segment / institution / employer /
 * geography). Plus HTTP flag-OFF 503 verification against the running Backend API (the workflow runs
 * WITHOUT FF_COMMERCIAL_REVENUE_INTELLIGENCE).
 *
 * All test data is keyed by *@example.com and deleted at the end (and on failure). Never touches
 * real identities.
 */
import pg from 'pg';
import { buildRevenueAnalytics } from '../services/commercial/revenue-engine';
import { ensureCommercialSchema } from '../services/commercial/catalog-schema';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const EMAIL = 'revenue-intel-smoke@example.com';
const INST_EMAIL = 'revenue-intel-inst@example.com';
const EMP_EMAIL = 'revenue-intel-employer@example.com';
const PRODUCT_ID = '00000000-0000-0000-0000-0000000066bb';
const PLAN_ID = '00000000-0000-0000-0000-0000000066aa';
const CUST_ID = '00000000-0000-0000-0000-0000000066c1';
const INST_CUST_ID = '00000000-0000-0000-0000-0000000066c2';
const EMP_CUST_ID = '00000000-0000-0000-0000-0000000066c3';
const SUB_ID = '00000000-0000-0000-0000-0000000066d1';
const INST_SUB_ID = '00000000-0000-0000-0000-0000000066d2';
const EMP_SUB_ID = '00000000-0000-0000-0000-0000000066d3';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : ''); }
};

const GEO_REV_NUMBER = 'SMOKE66-GEO-REV';
const GEO_MANUAL_NUMBER = 'SMOKE66-GEO-MANUAL';
const GEO_STATE = 'ZZ'; // synthetic state code unique to this smoke

async function cleanup() {
  await pool.query(`DELETE FROM inv_invoices WHERE invoice_number IN ($1,$2)`, [GEO_REV_NUMBER, GEO_MANUAL_NUMBER]).catch(() => {});
  await pool.query(`DELETE FROM capadex_payments WHERE lower(email) = lower($1)`, [EMAIL]).catch(() => {});
  for (const sid of [SUB_ID, INST_SUB_ID, EMP_SUB_ID]) {
    await pool.query(`DELETE FROM comm_subscription_events WHERE subscription_id = $1`, [sid]).catch(() => {});
    await pool.query(`DELETE FROM comm_subscriptions WHERE id = $1`, [sid]).catch(() => {});
  }
  for (const cid of [CUST_ID, INST_CUST_ID, EMP_CUST_ID]) {
    await pool.query(`DELETE FROM comm_customers WHERE id = $1`, [cid]).catch(() => {});
  }
  await pool.query(`DELETE FROM comm_plans WHERE id = $1`, [PLAN_ID]).catch(() => {});
  await pool.query(`DELETE FROM comm_products WHERE id = $1`, [PRODUCT_ID]).catch(() => {});
}

async function main() {
  await ensureCommercialSchema(pool);
  await cleanup();

  // ── Product + monthly plan (₹1,000/mo) ─────────────────────────────────────────────────────────
  await pool.query(
    `INSERT INTO comm_products (id, code, name, segment) VALUES ($1,'smoke_66_product','Smoke 6.6 Product','career_builder')
     ON CONFLICT (id) DO NOTHING`,
    [PRODUCT_ID],
  );
  await pool.query(
    `INSERT INTO comm_plans (id, product_id, code, name, billing_interval, interval_count, price_paise, currency)
     VALUES ($1,$2,'smoke_66_plan','Smoke 6.6 Plan','monthly',1,100000,'INR')
     ON CONFLICT (id) DO UPDATE SET price_paise = EXCLUDED.price_paise`,
    [PLAN_ID, PRODUCT_ID],
  );

  // ── 3 customers across segments, each an ACTIVE subscription + one collection event ─────────────
  const seed = async (custId: string, email: string, name: string, segment: string, subId: string) => {
    await pool.query(
      `INSERT INTO comm_customers (id, email, name, segment) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET segment = EXCLUDED.segment`,
      [custId, email, name, segment],
    );
    await pool.query(
      `INSERT INTO comm_subscriptions (id, customer_id, plan_id, segment, status)
       VALUES ($1,$2,$3,$4,'active')
       ON CONFLICT (id) DO UPDATE SET status='active', segment=EXCLUDED.segment`,
      [subId, custId, PLAN_ID, segment],
    );
    await pool.query(
      `INSERT INTO comm_subscription_events (customer_id, subscription_id, event_type, amount_paise, created_at)
       VALUES ($1,$2,'payment_succeeded',100000, now())`,
      [custId, subId],
    );
  };
  await seed(CUST_ID, EMAIL, 'Smoke B2C', 'career_builder', SUB_ID);
  await seed(INST_CUST_ID, INST_EMAIL, 'Smoke Institution', 'institution', INST_SUB_ID);
  await seed(EMP_CUST_ID, EMP_EMAIL, 'Smoke Employer', 'employer', EMP_SUB_ID);

  // ── One-time capadex payment (₹500) ────────────────────────────────────────────────────────────
  await pool.query(
    `INSERT INTO capadex_payments (email, concern_name, stage_code, stage_name, amount_paise, status, created_at)
     VALUES ($1,'Smoke Concern','smoke_stage','Smoke Stage',50000,'paid', now())`,
    [EMAIL],
  );

  // ── Geography invoices: one REVENUE invoice with null state (place_of_supply fallback) and one
  //    MANUAL (non-revenue) invoice that MUST be excluded from the geography aggregation. ──────────
  await pool.query(
    `INSERT INTO inv_invoices (invoice_number, doc_type, status, fiscal_year, source_type,
                              buyer_state_code, place_of_supply, total_paise)
     VALUES ($1,'tax','issued','2026-27','capadex_payment', NULL, $2, 70000)`,
    [GEO_REV_NUMBER, GEO_STATE],
  );
  await pool.query(
    `INSERT INTO inv_invoices (invoice_number, doc_type, status, fiscal_year, source_type,
                              buyer_state_code, place_of_supply, total_paise)
     VALUES ($1,'tax','issued','2026-27','manual', $2, $2, 9900000)`,
    [GEO_MANUAL_NUMBER, GEO_STATE],
  );

  // ── Engine assertions ──────────────────────────────────────────────────────────────────────────
  console.log('\n[1] buildRevenueAnalytics composition');
  const a = await buildRevenueAnalytics(pool);
  ok('does not throw / returns object', !!a && typeof a === 'object');
  ok('substrate flags present', a.substrate.comm_subscription_events === true && a.substrate.capadex_payments === true, a.substrate);

  // MRR composed from buildRecurringRevenue: 3 active monthly subs × ₹1,000 = ₹3,000 (≥, other real subs may exist)
  console.log('\n[2] MRR/ARR composed (not recomputed)');
  ok('MRR ≥ ₹3,000 (3 active monthly subs)', a.recurring.mrr_rupees >= 3000, a.recurring.mrr_rupees);
  ok('ARR == MRR×12', a.recurring.arr_rupees === a.recurring.mrr_rupees * 12, { mrr: a.recurring.mrr_rupees, arr: a.recurring.arr_rupees });
  ok('active_subscriptions ≥ 3', a.recurring.active_subscriptions >= 3, a.recurring.active_subscriptions);

  console.log('\n[3] by_product (recurring + one-time)');
  const prodRec = a.by_product.find((p) => p.product_code === 'smoke_66_product' && p.source === 'subscription');
  const prodCap = a.by_product.find((p) => p.product_code === 'smoke_stage' && p.source === 'capadex_stage');
  ok('recurring product present ₹3,000', prodRec?.rupees === 3000, prodRec);
  ok('one-time capadex stage present ₹500', prodCap?.rupees === 500, prodCap);

  console.log('\n[4] by_customer (union recurring + one-time)');
  const cust = a.by_customer.find((c) => c.email.toLowerCase() === EMAIL.toLowerCase());
  // B2C customer = ₹1,000 recurring + ₹500 one-time = ₹1,500
  ok('B2C customer union spend == ₹1,500', cust?.rupees === 1500, cust);

  console.log('\n[5] by_segment / by_institution / by_employer');
  const segInst = a.by_segment.find((s) => s.segment === 'institution');
  const segEmp = a.by_segment.find((s) => s.segment === 'employer');
  ok('institution segment ≥ ₹1,000', (segInst?.rupees ?? 0) >= 1000, segInst);
  ok('employer segment ≥ ₹1,000', (segEmp?.rupees ?? 0) >= 1000, segEmp);
  ok('by_institution lists our institution', a.by_institution.some((o) => o.email.toLowerCase() === INST_EMAIL.toLowerCase()), a.by_institution);
  ok('by_employer lists our employer', a.by_employer.some((o) => o.email.toLowerCase() === EMP_EMAIL.toLowerCase()), a.by_employer);

  console.log('\n[6] totals');
  ok('total = recurring + one-time', a.totals.total_rupees === a.totals.recurring_collections_rupees + a.totals.onetime_rupees, a.totals);
  ok('one-time collections ≥ ₹500', a.totals.onetime_rupees >= 500, a.totals.onetime_rupees);

  console.log('\n[7] never-fabricate honesty');
  ok('not degraded on healthy substrate', a.degraded === false, a.degraded);
  ok('geography coverage_pct is a number', typeof a.by_geography.coverage_pct === 'number', a.by_geography.coverage_pct);

  console.log('\n[7b] geography: source filtering + place_of_supply fallback');
  const geoZZ = a.by_geography.rows.find((g) => g.state_code === GEO_STATE);
  // revenue invoice (₹700) counted via place_of_supply fallback; manual ₹99,000 invoice EXCLUDED.
  ok('ZZ geography = ₹700 only (manual excluded, place_of_supply fallback)', geoZZ?.rupees === 700, geoZZ);
  ok('ZZ geography invoice count = 1 (revenue only)', geoZZ?.invoices === 1, geoZZ);

  // ── 8. HTTP flag-OFF → 503 (Backend API runs WITHOUT FF_COMMERCIAL_REVENUE_INTELLIGENCE) ────────
  console.log('\n[8] HTTP flag-OFF 503');
  const base = `http://localhost:8080`;
  for (const path of [
    '/api/admin/commercial/revenue/ping',
    '/api/admin/commercial/revenue/analytics',
  ]) {
    try {
      const res = await fetch(`${base}${path}`, { headers: { 'content-type': 'application/json' } });
      // 503 (flag) is the target; 401 (auth before flag) is also acceptable proof the route is gated, not open 200.
      ok(`GET ${path} gated (503/401, not 200)`, res.status === 503 || res.status === 401, res.status);
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
