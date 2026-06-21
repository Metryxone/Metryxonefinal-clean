/**
 * Smoke test (LIVE DB) — referral deal-value END-TO-END across all THREE copies of the ledger math.
 *
 * The resolver check (smoke-referral-deal-value-resolver.ts, Task #45) proves the READ-side resolver
 * (resolveReferredTenantDealValue) returns the right realized revenue against the real ledgers. But the
 * same paise→rupee conversion and the same three ledgers (comm_subscription_events/comm_customers,
 * capadex_payments) are re-implemented in THREE more places that the resolver check does not exercise:
 *
 *   1. WRITE path     — createChannelReferral / transitionReferral persist deal_value + derive
 *                       commission_amount = commission_pct × deal_value at conversion time.
 *   2. READ payout    — buildPartnerEcosystem re-resolves the recurring/one-time split and folds the
 *                       effective commission into per-partner payout totals.
 *   3. Reconciliation — buildPartnerEcosystemValidation re-derives earned = pct × deal_value and asserts
 *                       it reconciles with the engine's payout totals (FAIL on drift).
 *
 * A regression in ANY of those copies — a renamed ledger column/join, a status/event-type filter drift, a
 * paise→rupees error, or a broken pct × value derivation — could silently re-open the deal-value gap even
 * while the resolver check stays green. This test seeds a disposable @example.com partner + referred
 * tenants with REAL ledger revenue, CONVERTS referrals through the actual write paths, and then reads the
 * persisted value back through the payout engine and the reconciliation harness, asserting all three copies
 * agree with the resolver's value to the rupee. Every @example.com seed row is purged afterward (shared
 * dev/prod DB — everything must be cleanable).
 *
 * Run: cd backend && npx tsx scripts/smoke-referral-deal-value-writepath.ts
 */
import pg from 'pg';
import { ensureCommercialSchema } from '../services/commercial/catalog-schema';
import {
  resolveReferredTenantDealValue,
  createChannelReferral,
  transitionReferral,
} from '../services/tenant/partner-ecosystem-actions';
import { buildPartnerEcosystem } from '../services/tenant/partner-ecosystem-engine';
import { buildPartnerEcosystemValidation } from '../services/tenant/partner-ecosystem-validation';

const STAMP = Date.now();
const REFERRED_A_EMAIL = `smoke-rdvw-a-${STAMP}@example.com`; // recurring + one-time → linked_ledger
const REFERRED_B_EMAIL = `smoke-rdvw-b-${STAMP}@example.com`; // one-time only → capadex_payments

const TENANT_CODE_LIKE = `SMOKE-RDVW-${STAMP}-%`;
const EMAIL_LIKE = `smoke-rdvw-%-${STAMP}@example.com`;

/** comm_customers ids seeded with a recurring subscription, tracked so cleanup can be PROVEN (not assumed). */
const seededCustomerIds: string[] = [];

let passed = 0;
let failed = 0;
function check(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  PASS ${msg}`); }
  else { failed++; console.log(`  FAIL ${msg}`); }
}

async function tableExists(pool: pg.Pool, name: string): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass($1) AS reg`, [`public.${name}`]);
  return r.rows[0]?.reg != null;
}

/** Insert a disposable tenant; returns its id. tenant_code/contact_email use the @example.com marker. */
async function seedTenant(pool: pg.Pool, contactEmail: string | null, suffix: string): Promise<number> {
  const r = await pool.query(
    `INSERT INTO tenants (tenant_code, tenant_name, tenant_type, contact_email)
     VALUES ($1, $2, 'school', $3) RETURNING id`,
    [`SMOKE-RDVW-${STAMP}-${suffix}`, `smoke-rdvw-${STAMP}-${suffix}@example.com`, contactEmail],
  );
  return Number(r.rows[0].id);
}

/** Seed a recurring paid event for `email` worth `paise` (customer → subscription → payment_succeeded). */
async function seedRecurring(pool: pg.Pool, email: string, paise: number) {
  const cust = await pool.query(
    `INSERT INTO comm_customers (email, name, segment)
     VALUES (LOWER($1), 'smoke', 'career_builder')
     ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [email],
  );
  const customerId = cust.rows[0].id;
  seededCustomerIds.push(String(customerId));
  const sub = await pool.query(
    `INSERT INTO comm_subscriptions (customer_id, segment, status, billing_interval)
     VALUES ($1, 'career_builder', 'active', 'monthly') RETURNING id`,
    [customerId],
  );
  await pool.query(
    `INSERT INTO comm_subscription_events (subscription_id, customer_id, event_type, amount_paise)
     VALUES ($1, $2, 'payment_succeeded', $3)`,
    [sub.rows[0].id, customerId, paise],
  );
}

/** Seed a one-time paid capadex payment for `email` worth `paise`. */
async function seedOnetime(pool: pg.Pool, email: string, paise: number) {
  await pool.query(
    `INSERT INTO capadex_payments (email, stage_code, stage_name, amount_paise, currency, status)
     VALUES (LOWER($1), 'SMOKE', 'Smoke Stage', $2, 'INR', 'paid')`,
    [email, paise],
  );
}

async function cleanup(pool: pg.Pool) {
  // Deleting the seed tenants cascades tenant_channel_referrals + tenant_partner_agreements (+ events).
  try {
    await pool.query(`DELETE FROM tenants WHERE tenant_code LIKE $1`, [TENANT_CODE_LIKE]);
  } catch (e) { console.log(`  WARN tenant cleanup: ${String(e)}`); }
  for (const email of [REFERRED_A_EMAIL, REFERRED_B_EMAIL]) {
    try {
      await pool.query(`DELETE FROM capadex_payments WHERE LOWER(email) = LOWER($1)`, [email]);
      // comm_subscription_events / comm_subscriptions cascade off comm_customers delete.
      await pool.query(`DELETE FROM comm_customers WHERE LOWER(email) = LOWER($1)`, [email]);
    } catch (e) { console.log(`  WARN ledger cleanup (${email}): ${String(e)}`); }
  }
}

(async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log(`Seed markers (purge on abort): tenant_code LIKE '${TENANT_CODE_LIKE}' · emails: ${REFERRED_A_EMAIL}, ${REFERRED_B_EMAIL}`);
  try {
    await ensureCommercialSchema(pool);

    // The write/read/reconcile paths all depend on the three real ledger tables; if any is missing this
    // check cannot prove anything, so FAIL loudly rather than silently exit 0 (a false-green defeats it).
    const haveComm = (await tableExists(pool, 'comm_subscription_events')) && (await tableExists(pool, 'comm_customers'));
    const haveCapadex = await tableExists(pool, 'capadex_payments');
    if (!haveComm || !haveCapadex) {
      console.log(`\nFAIL: required ledger tables missing (comm=${haveComm} capadex=${haveCapadex}) — cannot validate the write/read paths.`);
      await pool.end();
      process.exit(1);
    }

    // ── Seed the partner + two referred tenants with REAL realized revenue ───────
    const partnerId = await seedTenant(pool, null, 'partner');
    await seedRecurring(pool, REFERRED_A_EMAIL, 40000); // ₹400
    await seedOnetime(pool, REFERRED_A_EMAIL, 25000);   // ₹250 → A total ₹650 (linked_ledger)
    const referredA = await seedTenant(pool, REFERRED_A_EMAIL, 'refA');
    await seedOnetime(pool, REFERRED_B_EMAIL, 30000);   // ₹300 → B total ₹300 (capadex_payments)
    const referredB = await seedTenant(pool, REFERRED_B_EMAIL, 'refB');

    // Ground truth: what the READ-side resolver says each referred tenant is worth.
    const resA = await resolveReferredTenantDealValue(pool, referredA);
    const resB = await resolveReferredTenantDealValue(pool, referredB);
    check(resA?.value === 650, `resolver A = ₹650 linked_ledger (got ${resA?.value} / ${resA?.source})`);
    check(resB?.value === 300, `resolver B = ₹300 capadex_payments (got ${resB?.value} / ${resB?.source})`);

    const PCT_A = 10; // → derived commission_amount A = 0.10 × 650 = ₹65
    const PCT_B = 20; // → derived commission_amount B = 0.20 × 300 = ₹60
    const expectedAmtA = Math.round((PCT_A / 100) * 650 * 100) / 100;
    const expectedAmtB = Math.round((PCT_B / 100) * 300 * 100) / 100;

    // ── 1. WRITE PATH (transitionReferral): pending → converted auto-resolves deal_value ─
    console.log('== 1. write path transitionReferral (pending → converted, auto-link) ==');
    const pendingA = await createChannelReferral(pool, {
      channel_partner_tenant_id: partnerId,
      referred_tenant_id: referredA,
      referral_code: `SMOKE-RDVW-${STAMP}-A`,
      commission_pct: PCT_A,
    });
    check(pendingA.status === 'pending' && pendingA.deal_value == null, 'pending referral created with no deal value yet');
    const convertedA = await transitionReferral(pool, Number(pendingA.id), 'converted');
    check(Number(convertedA.deal_value) === resA?.value, `persisted deal_value ₹${convertedA.deal_value} matches resolver ₹${resA?.value}`);
    check(convertedA.deal_value_source === resA?.source, `persisted deal_value_source '${convertedA.deal_value_source}' matches resolver '${resA?.source}'`);
    check(Number(convertedA.commission_amount) === expectedAmtA, `derived commission_amount ₹${convertedA.commission_amount} = ${PCT_A}% × ₹650 (expected ₹${expectedAmtA})`);
    check(convertedA.commission_amount_source === 'derived', `commission_amount_source 'derived' (got '${convertedA.commission_amount_source}')`);

    // ── 2. WRITE PATH (createChannelReferral): created-as-converted auto-resolves deal_value ─
    console.log('== 2. write path createChannelReferral (created converted, auto-link) ==');
    const convertedB = await createChannelReferral(pool, {
      channel_partner_tenant_id: partnerId,
      referred_tenant_id: referredB,
      referral_code: `SMOKE-RDVW-${STAMP}-B`,
      status: 'converted',
      commission_pct: PCT_B,
    });
    check(Number(convertedB.deal_value) === resB?.value, `persisted deal_value ₹${convertedB.deal_value} matches resolver ₹${resB?.value}`);
    check(convertedB.deal_value_source === resB?.source, `persisted deal_value_source '${convertedB.deal_value_source}' matches resolver '${resB?.source}'`);
    check(Number(convertedB.commission_amount) === expectedAmtB, `derived commission_amount ₹${convertedB.commission_amount} = ${PCT_B}% × ₹300 (expected ₹${expectedAmtB})`);
    check(convertedB.commission_amount_source === 'derived', `commission_amount_source 'derived' (got '${convertedB.commission_amount_source}')`);

    // ── 3. READ PATH (buildPartnerEcosystem payout engine) — same value, read back ─
    console.log('== 3. read path buildPartnerEcosystem (payout engine) ==');
    const eco = await buildPartnerEcosystem(pool);
    const myReferrals = eco.referrals.filter((r) => r.channel_partner_tenant_id === partnerId);
    const ecoA = myReferrals.find((r) => r.referral_code === `SMOKE-RDVW-${STAMP}-A`);
    const ecoB = myReferrals.find((r) => r.referral_code === `SMOKE-RDVW-${STAMP}-B`);
    check(ecoA?.deal_value === resA?.value, `engine reads back A deal_value ₹${ecoA?.deal_value} (expected ₹${resA?.value})`);
    check(ecoA?.effective_commission_amount === expectedAmtA, `engine effective_commission_amount A ₹${ecoA?.effective_commission_amount} (expected ₹${expectedAmtA})`);
    check(
      ecoA?.deal_value_components?.recurring === 400 && ecoA?.deal_value_components?.onetime === 250 && ecoA?.deal_value_components?.reconciles === true,
      `engine re-resolves A split (recurring ₹400 / one-time ₹250, reconciles) — got ${JSON.stringify(ecoA?.deal_value_components)}`,
    );
    check(ecoB?.deal_value === resB?.value, `engine reads back B deal_value ₹${ecoB?.deal_value} (expected ₹${resB?.value})`);
    check(ecoB?.effective_commission_amount === expectedAmtB, `engine effective_commission_amount B ₹${ecoB?.effective_commission_amount} (expected ₹${expectedAmtB})`);

    const myPayout = eco.payouts.find((p) => p.channel_partner_tenant_id === partnerId);
    const expectedEarned = Math.round((expectedAmtA + expectedAmtB) * 100) / 100;
    check(myPayout != null, 'partner appears in the payout surface');
    check(myPayout?.earned_commission === expectedEarned, `partner earned_commission ₹${myPayout?.earned_commission} = ₹${expectedAmtA} + ₹${expectedAmtB} (expected ₹${expectedEarned})`);

    // ── 4. RECONCILIATION (buildPartnerEcosystemValidation) — third copy agrees ───
    console.log('== 4. reconciliation buildPartnerEcosystemValidation ==');
    const validation = await buildPartnerEcosystemValidation(pool);
    const payoutArea = validation.areas.find((a) => a.area === 'Payout Reconciliation');
    const reconcileCheck = payoutArea?.checks.find((c) => c.name === 'payout_reconciles');
    check(reconcileCheck?.status === 'PASS', `reconciliation payout_reconciles PASS (got ${reconcileCheck?.status}: ${reconcileCheck?.detail})`);
    check(validation.overall !== 'FAIL', `validation overall is not FAIL (got ${validation.overall}) — all three copies of the math agree`);
  } catch (e) {
    failed++;
    console.log(`\nFAIL (unexpected error): ${String(e)}`);
  } finally {
    await cleanup(pool);
    // Strict cleanup: a shared dev/prod DB must be left pristine. Any residual @example.com row is a FAIL.
    try {
      console.log('== cleanup verification ==');
      // The recurring-ledger rows (comm_subscriptions / comm_subscription_events) cascade off
      // comm_customers, but verify the SEEDED customer ids carry no surviving rows rather than assuming it.
      const ids = seededCustomerIds.length ? seededCustomerIds : ['00000000-0000-0000-0000-000000000000'];
      const resid = await pool.query(
        `SELECT
           (SELECT count(*) FROM tenants WHERE tenant_code LIKE $1)::int            AS tenants,
           (SELECT count(*) FROM comm_customers WHERE email LIKE $2)::int           AS customers,
           (SELECT count(*) FROM capadex_payments WHERE email LIKE $2)::int         AS capadex,
           (SELECT count(*) FROM tenant_channel_referrals
              WHERE referral_code LIKE $3)::int                                     AS referrals,
           (SELECT count(*) FROM comm_subscriptions
              WHERE customer_id = ANY($4::uuid[]))::int                             AS subscriptions,
           (SELECT count(*) FROM comm_subscription_events
              WHERE customer_id = ANY($4::uuid[]))::int                             AS sub_events`,
        [TENANT_CODE_LIKE, EMAIL_LIKE, `SMOKE-RDVW-${STAMP}-%`, ids],
      );
      const r = resid.rows[0];
      const total = Number(r.tenants) + Number(r.customers) + Number(r.capadex) + Number(r.referrals)
        + Number(r.subscriptions) + Number(r.sub_events);
      check(total === 0, `no residual seed rows remain (tenants=${r.tenants} customers=${r.customers} capadex=${r.capadex} referrals=${r.referrals} subscriptions=${r.subscriptions} sub_events=${r.sub_events})`);
    } catch (e) {
      failed++;
      console.log(`  FAIL cleanup verification errored: ${String(e)}`);
    }
    await pool.end();
  }
  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
