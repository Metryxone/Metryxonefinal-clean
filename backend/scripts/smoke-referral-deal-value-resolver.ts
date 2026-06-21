/**
 * Smoke test (LIVE DB) — referral deal-value resolution against the real ledger queries.
 *
 * Task #45 locked `resolveReferredTenantDealValue`'s BEHAVIOUR with fast, DB-free unit tests
 * (a fake pg.Pool that pattern-matches the SQL). That fake cannot catch a real regression in the
 * actual ledger queries — a renamed column (`amount_paise`, `contact_email`), a changed join
 * (`comm_subscription_events` → `comm_customers`, `capadex_payments` by email), a status/event-type
 * filter drift, or a paise→rupees conversion error — because the fake answers whatever SQL it is given.
 *
 * This check seeds a disposable tenant + @example.com ledger rows in the REAL tables, runs the REAL
 * resolver, and asserts the rupee total + provenance. It also asserts the two honest-gap paths
 * (no email, no realized revenue) return null. All @example.com seed rows are purged afterward
 * (shared dev/prod DB — everything must be cleanable).
 *
 * Run: cd backend && npx tsx scripts/smoke-referral-deal-value-resolver.ts
 */
import pg from 'pg';
import { ensureCommercialSchema } from '../services/commercial/catalog-schema';
import { resolveReferredTenantDealValue } from '../services/tenant/partner-ecosystem-actions';

const STAMP = Date.now();
const RECURRING_EMAIL = `smoke-recurring-${STAMP}@example.com`;
const ONETIME_EMAIL = `smoke-onetime-${STAMP}@example.com`;
const COMBINED_EMAIL = `smoke-combined-${STAMP}@example.com`;
const NOREV_EMAIL = `smoke-norev-${STAMP}@example.com`;

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
    [`SMOKE-RDV-${STAMP}-${suffix}`, `smoke-rdv-${STAMP}-${suffix}@example.com`, contactEmail],
  );
  return Number(r.rows[0].id);
}

/** Seed a recurring paid event for `email` worth `paise` (customer → subscription → payment_succeeded event). */
async function seedRecurring(pool: pg.Pool, email: string, paise: number) {
  const cust = await pool.query(
    `INSERT INTO comm_customers (email, name, segment)
     VALUES (LOWER($1), 'smoke', 'career_builder')
     ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [email],
  );
  const customerId = cust.rows[0].id;
  const sub = await pool.query(
    `INSERT INTO comm_subscriptions (customer_id, segment, status, billing_interval)
     VALUES ($1, 'career_builder', 'active', 'monthly') RETURNING id`,
    [customerId],
  );
  const subId = sub.rows[0].id;
  await pool.query(
    `INSERT INTO comm_subscription_events (subscription_id, customer_id, event_type, amount_paise)
     VALUES ($1, $2, 'payment_succeeded', $3)`,
    [subId, customerId, paise],
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
  // Purge every @example.com row this script could have created (idempotent, marker-scoped).
  try {
    await pool.query(`DELETE FROM tenants WHERE tenant_code LIKE $1`, [`SMOKE-RDV-${STAMP}-%`]);
  } catch (e) { console.log(`  WARN tenant cleanup: ${String(e)}`); }
  for (const email of [RECURRING_EMAIL, ONETIME_EMAIL, COMBINED_EMAIL, NOREV_EMAIL]) {
    try {
      await pool.query(`DELETE FROM capadex_payments WHERE LOWER(email) = LOWER($1)`, [email]);
      // comm_subscription_events / comm_subscriptions cascade off comm_customers delete.
      await pool.query(`DELETE FROM comm_customers WHERE LOWER(email) = LOWER($1)`, [email]);
    } catch (e) { console.log(`  WARN ledger cleanup (${email}): ${String(e)}`); }
  }
}

(async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  // Print the seed markers up front so a run that aborts mid-sequence can be purged by hand.
  console.log(`Seed markers (purge on abort): tenant_code LIKE 'SMOKE-RDV-${STAMP}-%' · emails: ${RECURRING_EMAIL}, ${ONETIME_EMAIL}, ${COMBINED_EMAIL}, ${NOREV_EMAIL}`);
  try {
    await ensureCommercialSchema(pool);

    // The resolver reads three real ledger tables; if any is missing this check cannot prove anything,
    // so FAIL loudly rather than silently exit 0 (a false-green would defeat the regression guarantee).
    const haveComm = (await tableExists(pool, 'comm_subscription_events')) && (await tableExists(pool, 'comm_customers'));
    const haveCapadex = await tableExists(pool, 'capadex_payments');
    if (!haveComm || !haveCapadex) {
      console.log(`\nFAIL: required ledger tables missing (comm=${haveComm} capadex=${haveCapadex}) — cannot validate the resolver.`);
      await pool.end();
      process.exit(1);
    }

    // ── 1. recurring-only → comm_subscriptions provenance, paise→rupees ──────────
    console.log('== 1. recurring-only ledger (comm_subscriptions) ==');
    await seedRecurring(pool, RECURRING_EMAIL, 50000); // ₹500
    const tRec = await seedTenant(pool, RECURRING_EMAIL, 'rec');
    const rec = await resolveReferredTenantDealValue(pool, tRec);
    check(rec != null, 'resolver returned a value');
    check(rec?.value === 500, `value is ₹500 (got ${rec?.value}) — paise/100 conversion correct`);
    check(rec?.source === 'comm_subscriptions', `provenance comm_subscriptions (got ${rec?.source})`);
    check(rec?.components.recurring === 500 && rec?.components.onetime === 0, 'components split correct (recurring 500 / onetime 0)');
    check(rec?.currency === 'INR', 'currency INR');

    // ── 2. one-time only → capadex_payments provenance ──────────────────────────
    console.log('== 2. one-time only ledger (capadex_payments) ==');
    await seedOnetime(pool, ONETIME_EMAIL, 30000); // ₹300
    const tOne = await seedTenant(pool, ONETIME_EMAIL, 'one');
    const one = await resolveReferredTenantDealValue(pool, tOne);
    check(one?.value === 300, `value is ₹300 (got ${one?.value})`);
    check(one?.source === 'capadex_payments', `provenance capadex_payments (got ${one?.source})`);
    check(one?.components.onetime === 300 && one?.components.recurring === 0, 'components split correct (onetime 300 / recurring 0)');

    // ── 3. both ledgers → linked_ledger, summed ─────────────────────────────────
    console.log('== 3. both ledgers (linked_ledger) ==');
    await seedRecurring(pool, COMBINED_EMAIL, 20000); // ₹200
    await seedOnetime(pool, COMBINED_EMAIL, 15000);   // ₹150
    const tBoth = await seedTenant(pool, COMBINED_EMAIL, 'both');
    const both = await resolveReferredTenantDealValue(pool, tBoth);
    check(both?.value === 350, `value is ₹350 = ₹200 + ₹150 (got ${both?.value})`);
    check(both?.source === 'linked_ledger', `provenance linked_ledger (got ${both?.source})`);
    check(both?.components.recurring === 200 && both?.components.onetime === 150, 'components split correct (200 / 150)');

    // ── 4. honest gaps: no email, no realized revenue → null (never fabricated) ──
    console.log('== 4. honest gaps return null ==');
    const tNoEmail = await seedTenant(pool, null, 'noemail');
    const noEmail = await resolveReferredTenantDealValue(pool, tNoEmail);
    check(noEmail === null, 'tenant with NULL contact_email → null (honest gap)');

    const tNoRev = await seedTenant(pool, NOREV_EMAIL, 'norev'); // email present, but no ledger rows
    const noRev = await resolveReferredTenantDealValue(pool, tNoRev);
    check(noRev === null, 'tenant with email but no realized revenue → null (never fabricated)');

    const missing = await resolveReferredTenantDealValue(pool, 2_000_000_000); // non-existent tenant
    check(missing === null, 'non-existent tenant → null');

    // ── 5. filter discipline: a non-paid / non-success ledger row must NOT count ──
    console.log('== 5. status / event-type filters exclude non-realized revenue ==');
    // A capadex_payments row with status != 'paid' must be ignored (status filter drift guard).
    await pool.query(
      `INSERT INTO capadex_payments (email, stage_code, stage_name, amount_paise, currency, status)
       VALUES (LOWER($1), 'SMOKE', 'Smoke Pending', 99900, 'INR', 'pending')`,
      [NOREV_EMAIL],
    );
    // A comm_subscription_events row that is not payment_succeeded/renewed must be ignored.
    const c = await pool.query(
      `INSERT INTO comm_customers (email, name, segment) VALUES (LOWER($1), 'smoke', 'career_builder')
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW() RETURNING id`, [NOREV_EMAIL]);
    const s = await pool.query(
      `INSERT INTO comm_subscriptions (customer_id, segment, status, billing_interval)
       VALUES ($1, 'career_builder', 'trial', 'monthly') RETURNING id`, [c.rows[0].id]);
    await pool.query(
      `INSERT INTO comm_subscription_events (subscription_id, customer_id, event_type, amount_paise)
       VALUES ($1, $2, 'payment_failed', 88800)`, [s.rows[0].id, c.rows[0].id]);
    const filtered = await resolveReferredTenantDealValue(pool, tNoRev);
    check(filtered === null, 'pending capadex + payment_failed event are both excluded → still null');
  } catch (e) {
    failed++;
    console.log(`\nFAIL (unexpected error): ${String(e)}`);
  } finally {
    await cleanup(pool);
    // Strict cleanup: a shared dev/prod DB must be left pristine. Any residual @example.com row is a FAIL.
    try {
      console.log('== cleanup verification ==');
      const resid = await pool.query(
        `SELECT
           (SELECT count(*) FROM tenants WHERE tenant_code LIKE $1)::int            AS tenants,
           (SELECT count(*) FROM comm_customers WHERE email LIKE $2)::int            AS customers,
           (SELECT count(*) FROM capadex_payments WHERE email LIKE $2)::int          AS capadex`,
        [`SMOKE-RDV-${STAMP}-%`, `smoke-%-${STAMP}@example.com`],
      );
      const r = resid.rows[0];
      const total = Number(r.tenants) + Number(r.customers) + Number(r.capadex);
      check(total === 0, `no residual seed rows remain (tenants=${r.tenants} customers=${r.customers} capadex=${r.capadex})`);
    } catch (e) {
      failed++;
      console.log(`  FAIL cleanup verification errored: ${String(e)}`);
    }
    await pool.end();
  }
  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
