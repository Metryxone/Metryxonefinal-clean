/**
 * Smoke test (LIVE DB) — the ADMIN "repair a stuck referral's deal value" write path.
 *
 * The resolver check (smoke-referral-deal-value-resolver.ts, Task #45) proves the READ-side resolver,
 * and the write-path check (smoke-referral-deal-value-writepath.ts, Task #49) exercises the two
 * CONVERSION write paths (createChannelReferral / transitionReferral). Neither exercises the THIRD
 * write path: `resolveReferralDealValue` — the admin "repair" action that attaches a deal value (and
 * derives commission_amount = commission_pct × deal_value) to an ALREADY-converted referral that was
 * left with an honest coverage gap. Conversion is terminal, so this is a distinct write path; it
 * re-uses the same paise→rupee ledger math (resolveReferredTenantDealValue) and the same fail-closed
 * behaviour (no realized revenue → not_linkable). A regression here could silently mis-value a
 * manually repaired referral, and no automated check would catch it.
 *
 * This check seeds a disposable @example.com partner + referred tenants with REAL ledger revenue,
 * creates converted referrals WITHOUT a deal value (the honest gap), then repairs them through the
 * REAL resolveReferralDealValue and asserts:
 *   1. link_deal auto-resolution attaches the resolver's value + derives commission (source 'derived'),
 *   2. an explicit deal_value takes precedence ('manual') even when link_deal is also set,
 *   3. the fail-closed paths (no realized revenue → not_linkable/422, no referred tenant, non-converted,
 *      neither input) all error correctly and never fabricate,
 *   4. the repaired value reads back identically through buildPartnerEcosystem (payout) and
 *      buildPartnerEcosystemValidation (reconciliation) — all copies of the math agree.
 * Every @example.com seed row is purged afterward (shared dev/prod DB — everything must be cleanable).
 *
 * Run: cd backend && npx tsx scripts/smoke-referral-deal-value-repair.ts
 */
import pg from 'pg';
import { ensureCommercialSchema } from '../services/commercial/catalog-schema';
import {
  resolveReferredTenantDealValue,
  createChannelReferral,
  resolveReferralDealValue,
  PartnerActionError,
} from '../services/tenant/partner-ecosystem-actions';
import { buildPartnerEcosystem } from '../services/tenant/partner-ecosystem-engine';
import { buildPartnerEcosystemValidation } from '../services/tenant/partner-ecosystem-validation';

const STAMP = Date.now();
const REFERRED_A_EMAIL = `smoke-rdvr-a-${STAMP}@example.com`; // recurring + one-time → linked_ledger (auto-link repair)
const REFERRED_B_EMAIL = `smoke-rdvr-b-${STAMP}@example.com`; // recurring only → has revenue, repaired via MANUAL value
const REFERRED_C_EMAIL = `smoke-rdvr-c-${STAMP}@example.com`; // email but NO revenue → fail-closed not_linkable

const TENANT_CODE_LIKE = `SMOKE-RDVR-${STAMP}-%`;
const EMAIL_LIKE = `smoke-rdvr-%-${STAMP}@example.com`;

/** comm_customers ids seeded with a recurring subscription, tracked so cleanup can be PROVEN (not assumed). */
const seededCustomerIds: string[] = [];

let passed = 0;
let failed = 0;
function check(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  PASS ${msg}`); }
  else { failed++; console.log(`  FAIL ${msg}`); }
}

/** Assert that `fn` rejects with a PartnerActionError carrying the expected code (and optional status). */
async function expectError(fn: () => Promise<unknown>, code: string, status: number | null, msg: string) {
  try {
    await fn();
    check(false, `${msg} — expected error '${code}' but the call SUCCEEDED (would fabricate)`);
  } catch (e) {
    const pe = e as PartnerActionError;
    const codeOk = pe instanceof PartnerActionError && pe.code === code;
    const statusOk = status == null || (pe instanceof PartnerActionError && pe.status === status);
    check(codeOk && statusOk, `${msg} — errored '${pe?.code}'${status != null ? `/${pe?.status}` : ''} (expected '${code}'${status != null ? `/${status}` : ''})`);
  }
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
    [`SMOKE-RDVR-${STAMP}-${suffix}`, `smoke-rdvr-${STAMP}-${suffix}@example.com`, contactEmail],
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
  // Deleting the seed tenants cascades tenant_channel_referrals (+ events).
  try {
    await pool.query(`DELETE FROM tenants WHERE tenant_code LIKE $1`, [TENANT_CODE_LIKE]);
  } catch (e) { console.log(`  WARN tenant cleanup: ${String(e)}`); }
  for (const email of [REFERRED_A_EMAIL, REFERRED_B_EMAIL, REFERRED_C_EMAIL]) {
    try {
      await pool.query(`DELETE FROM capadex_payments WHERE LOWER(email) = LOWER($1)`, [email]);
      // comm_subscription_events / comm_subscriptions cascade off comm_customers delete.
      await pool.query(`DELETE FROM comm_customers WHERE LOWER(email) = LOWER($1)`, [email]);
    } catch (e) { console.log(`  WARN ledger cleanup (${email}): ${String(e)}`); }
  }
}

(async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log(`Seed markers (purge on abort): tenant_code LIKE '${TENANT_CODE_LIKE}' · emails: ${REFERRED_A_EMAIL}, ${REFERRED_B_EMAIL}, ${REFERRED_C_EMAIL}`);
  try {
    await ensureCommercialSchema(pool);

    // The repair path depends on the three real ledger tables; if any is missing this check cannot prove
    // anything, so FAIL loudly rather than silently exit 0 (a false-green would defeat the regression guard).
    const haveComm = (await tableExists(pool, 'comm_subscription_events')) && (await tableExists(pool, 'comm_customers'));
    const haveCapadex = await tableExists(pool, 'capadex_payments');
    if (!haveComm || !haveCapadex) {
      console.log(`\nFAIL: required ledger tables missing (comm=${haveComm} capadex=${haveCapadex}) — cannot validate the repair path.`);
      await pool.end();
      process.exit(1);
    }

    // ── Seed the partner + referred tenants with REAL realized revenue ───────────
    const partnerId = await seedTenant(pool, null, 'partner');
    await seedRecurring(pool, REFERRED_A_EMAIL, 40000); // ₹400
    await seedOnetime(pool, REFERRED_A_EMAIL, 25000);   // ₹250 → A total ₹650 (linked_ledger)
    const referredA = await seedTenant(pool, REFERRED_A_EMAIL, 'refA');
    await seedRecurring(pool, REFERRED_B_EMAIL, 50000); // ₹500 (B has revenue, but repaired via MANUAL value)
    const referredB = await seedTenant(pool, REFERRED_B_EMAIL, 'refB');
    const referredC = await seedTenant(pool, REFERRED_C_EMAIL, 'refC'); // email present, NO ledger revenue

    // Ground truth from the READ-side resolver.
    const resA = await resolveReferredTenantDealValue(pool, referredA);
    check(resA?.value === 650 && resA?.source === 'linked_ledger', `resolver A = ₹650 linked_ledger (got ${resA?.value} / ${resA?.source})`);

    const PCT_A = 10;       // → derived A = 0.10 × 650 = ₹65
    const PCT_B = 15;       // → derived B = 0.15 × manual ₹1000 = ₹150
    const MANUAL_B = 1000;  // deliberately ≠ B's ledger (₹500) to PROVE explicit precedence
    const expectedAmtA = Math.round((PCT_A / 100) * 650 * 100) / 100;
    const expectedAmtB = Math.round((PCT_B / 100) * MANUAL_B * 100) / 100;

    /** Create a referral that is ALREADY converted but carries NO deal value (link_deal:false = honest gap). */
    async function seedStuckConverted(referredId: number | null, pct: number | null, codeSuffix: string) {
      const r = await createChannelReferral(pool, {
        channel_partner_tenant_id: partnerId,
        referred_tenant_id: referredId,
        referral_code: `SMOKE-RDVR-${STAMP}-${codeSuffix}`,
        status: 'converted',
        commission_pct: pct,
        link_deal: false, // opt out of auto-resolution so it stays a stuck gap to be repaired
      });
      return r;
    }

    // ── 1. REPAIR via auto-link (link_deal:true) ─────────────────────────────────
    console.log('== 1. repair stuck referral via auto-link (resolveReferralDealValue link_deal:true) ==');
    const stuckA = await seedStuckConverted(referredA, PCT_A, 'A');
    check(stuckA.status === 'converted' && stuckA.deal_value == null && stuckA.commission_amount == null,
      'stuck referral A created converted with NO deal_value / commission (honest gap)');
    const fixedA = await resolveReferralDealValue(pool, Number(stuckA.id), { link_deal: true });
    check(Number(fixedA.deal_value) === resA?.value, `repaired deal_value ₹${fixedA.deal_value} matches resolver ₹${resA?.value}`);
    check(fixedA.deal_value_source === resA?.source, `repaired deal_value_source '${fixedA.deal_value_source}' matches resolver '${resA?.source}'`);
    check(Number(fixedA.commission_amount) === expectedAmtA, `derived commission_amount ₹${fixedA.commission_amount} = ${PCT_A}% × ₹650 (expected ₹${expectedAmtA})`);
    check(fixedA.commission_amount_source === 'derived', `commission_amount_source 'derived' (got '${fixedA.commission_amount_source}')`);

    // ── 2. REPAIR via explicit deal_value ('manual' precedence) ──────────────────
    console.log('== 2. repair via explicit deal_value — manual wins over link_deal ==');
    const stuckB = await seedStuckConverted(referredB, PCT_B, 'B');
    // Pass BOTH an explicit deal_value AND link_deal:true — the explicit value must win, NOT the ₹500 ledger.
    const fixedB = await resolveReferralDealValue(pool, Number(stuckB.id), { deal_value: MANUAL_B, link_deal: true });
    check(Number(fixedB.deal_value) === MANUAL_B, `repaired deal_value ₹${fixedB.deal_value} = explicit ₹${MANUAL_B} (NOT ledger ₹500)`);
    check(fixedB.deal_value_source === 'manual', `deal_value_source 'manual' (got '${fixedB.deal_value_source}')`);
    check(Number(fixedB.commission_amount) === expectedAmtB, `derived commission_amount ₹${fixedB.commission_amount} = ${PCT_B}% × ₹${MANUAL_B} (expected ₹${expectedAmtB})`);
    check(fixedB.commission_amount_source === 'derived', `commission_amount_source 'derived' (got '${fixedB.commission_amount_source}')`);

    // ── 3. FAIL-CLOSED paths — never fabricate ───────────────────────────────────
    console.log('== 3. fail-closed: repair refuses to invent a value ==');
    // 3a. referred tenant has an email but NO realized revenue → not_linkable / 422.
    const stuckC = await seedStuckConverted(referredC, PCT_A, 'C');
    await expectError(() => resolveReferralDealValue(pool, Number(stuckC.id), { link_deal: true }),
      'not_linkable', 422, 'auto-link with no realized revenue');
    // The row must still be a gap (the failed repair wrote nothing).
    const cAfter = await pool.query(`SELECT deal_value, commission_amount FROM tenant_channel_referrals WHERE id = $1`, [Number(stuckC.id)]);
    check(cAfter.rows[0]?.deal_value == null && cAfter.rows[0]?.commission_amount == null, 'failed auto-link left the row untouched (still an honest gap)');

    // 3b. no referred tenant at all → invalid_input (cannot auto-link).
    const stuckNoTenant = await seedStuckConverted(null, PCT_A, 'NOTEN');
    await expectError(() => resolveReferralDealValue(pool, Number(stuckNoTenant.id), { link_deal: true }),
      'invalid_input', null, 'auto-link with no referred tenant');

    // 3c. neither deal_value nor link_deal supplied → invalid_input.
    await expectError(() => resolveReferralDealValue(pool, Number(stuckNoTenant.id), {}),
      'invalid_input', null, 'no deal_value and no link_deal');

    // 3d. a non-converted referral cannot receive a deal value → invalid_state.
    const pendingRow = await createChannelReferral(pool, {
      channel_partner_tenant_id: partnerId,
      referred_tenant_id: referredA,
      referral_code: `SMOKE-RDVR-${STAMP}-PEND`,
      commission_pct: PCT_A,
    });
    check(pendingRow.status === 'pending', 'pending referral created for invalid_state guard');
    await expectError(() => resolveReferralDealValue(pool, Number(pendingRow.id), { deal_value: 100 }),
      'invalid_state', null, 'deal value on a non-converted referral');

    // 3e. unknown referral id → not_found / 404.
    await expectError(() => resolveReferralDealValue(pool, 2_000_000_000, { deal_value: 100 }),
      'not_found', 404, 'repair a non-existent referral');

    // ── 4. READ-BACK through payout engine + reconciliation harness ──────────────
    console.log('== 4. repaired values read back through buildPartnerEcosystem + validation ==');
    const eco = await buildPartnerEcosystem(pool);
    const mine = eco.referrals.filter((r) => r.channel_partner_tenant_id === partnerId);
    const ecoA = mine.find((r) => r.referral_code === `SMOKE-RDVR-${STAMP}-A`);
    const ecoB = mine.find((r) => r.referral_code === `SMOKE-RDVR-${STAMP}-B`);
    check(ecoA?.deal_value === resA?.value, `engine reads back A deal_value ₹${ecoA?.deal_value} (expected ₹${resA?.value})`);
    check(ecoA?.effective_commission_amount === expectedAmtA, `engine effective_commission_amount A ₹${ecoA?.effective_commission_amount} (expected ₹${expectedAmtA})`);
    check(
      ecoA?.deal_value_components?.recurring === 400 && ecoA?.deal_value_components?.onetime === 250 && ecoA?.deal_value_components?.reconciles === true,
      `engine re-resolves A split (recurring ₹400 / one-time ₹250, reconciles) — got ${JSON.stringify(ecoA?.deal_value_components)}`,
    );
    check(ecoB?.deal_value === MANUAL_B, `engine reads back B deal_value ₹${ecoB?.deal_value} (expected manual ₹${MANUAL_B})`);
    check(ecoB?.effective_commission_amount === expectedAmtB, `engine effective_commission_amount B ₹${ecoB?.effective_commission_amount} (expected ₹${expectedAmtB})`);
    // Manual source is (correctly) NOT ledger-reconciled — the engine skips the split for non-ledger sources.
    check(ecoB?.deal_value_components == null, `engine does NOT ledger-reconcile a manual deal_value (components null) — got ${JSON.stringify(ecoB?.deal_value_components)}`);

    const myPayout = eco.payouts.find((p) => p.channel_partner_tenant_id === partnerId);
    const expectedEarned = Math.round((expectedAmtA + expectedAmtB) * 100) / 100;
    check(myPayout != null, 'partner appears in the payout surface');
    check(myPayout?.earned_commission === expectedEarned, `partner earned_commission ₹${myPayout?.earned_commission} = ₹${expectedAmtA} + ₹${expectedAmtB} (expected ₹${expectedEarned})`);

    const validation = await buildPartnerEcosystemValidation(pool);
    const payoutArea = validation.areas.find((a) => a.area === 'Payout Reconciliation');
    const reconcileCheck = payoutArea?.checks.find((c) => c.name === 'payout_reconciles');
    check(reconcileCheck?.status === 'PASS', `reconciliation payout_reconciles PASS (got ${reconcileCheck?.status}: ${reconcileCheck?.detail})`);
    check(validation.overall !== 'FAIL', `validation overall is not FAIL (got ${validation.overall}) — repaired values reconcile everywhere`);
  } catch (e) {
    failed++;
    console.log(`\nFAIL (unexpected error): ${String(e)}`);
  } finally {
    await cleanup(pool);
    // Strict cleanup: a shared dev/prod DB must be left pristine. Any residual @example.com row is a FAIL.
    try {
      console.log('== cleanup verification ==');
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
        [TENANT_CODE_LIKE, EMAIL_LIKE, `SMOKE-RDVR-${STAMP}-%`, ids],
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
