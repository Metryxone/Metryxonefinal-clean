/**
 * Phase 6.3 smoke — refund ledger + credit wallet + invoice credit_note over comm_refund.
 * Self-cleaning: all rows hang off a single @example.com customer, deleted on exit (FK CASCADE).
 * Run: cd backend && FF_COMMERCIAL_SUBSCRIPTIONS=1 npx tsx scripts/smoke-payment-engine.ts
 */
process.env.FF_COMMERCIAL_SUBSCRIPTIONS = '1';
process.env.FF_COMMERCIAL_CATALOG = '1';
process.env.FF_INVOICE_GST_ENGINE = '1';

import { Pool } from 'pg';
import { ensureCommercialSchema } from '../services/commercial/catalog-schema';
import {
  upsertCustomer, createSubscription, recordPaymentEvent, refundSubscription,
} from '../services/commercial/subscription-lifecycle-runtime';
import {
  getCreditBalance, issueCredit, applyCredit, listCreditEntries,
} from '../services/commercial/credit-ledger-runtime';
import { generateInvoice } from '../services/invoice/invoice-runtime';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const EMAIL = `smoke.payengine.${Date.now()}@example.com`;
let ok = true;
const check = (label: string, cond: boolean, detail?: unknown) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `  ${JSON.stringify(detail)}` : ''}`);
  if (!cond) ok = false;
};

async function main() {
  await ensureCommercialSchema(pool);

  // ── fixtures ──
  const customer = await upsertCustomer(pool, { email: EMAIL, name: 'Smoke PayEngine', segment: 'career_builder' });
  const code = `smoke_${Date.now()}`;
  const product = (await pool.query(
    `INSERT INTO comm_products (code, name, segment, is_active)
     VALUES ($1, 'Smoke Product', 'career_builder', true) RETURNING *`, [`prod_${code}`],
  )).rows[0];
  const plan = (await pool.query(
    `INSERT INTO comm_plans (product_id, code, name, billing_interval, price_paise, currency, is_active)
     VALUES ($1, $2, 'Smoke Plan', 'monthly', 49900, 'INR', true) RETURNING *`, [product.id, `plan_${code}`],
  )).rows[0];
  const sub = await createSubscription(pool, {
    customer_id: customer.id, plan_id: plan.id, segment: 'career_builder',
    billing_interval: 'monthly', amount_paise: 49900,
  });
  await recordPaymentEvent(pool, {
    subscription_id: sub.id, succeeded: true, amount_paise: 49900,
    metadata: { razorpay_payment_id: 'pay_SMOKE123' },
  });

  // ── A: refund resolves amount from the recorded payment (never fabricated) ──
  const r1 = await refundSubscription(pool, sub.id, { reason: 'smoke full refund' });
  check('refund: created', !!r1?.refund?.id);
  check('refund: amount = recorded payment (49900)', r1?.refund.amount_paise === 49900, r1?.refund.amount_paise);
  check('refund: carried razorpay_payment_id', r1?.refund.razorpay_payment_id === 'pay_SMOKE123');
  check('refund: status processed', r1?.refund.status === 'processed');
  // subscription status MUST be unchanged (refund is financial, not lifecycle)
  const subAfter = (await pool.query(`SELECT status FROM comm_subscriptions WHERE id=$1`, [sub.id])).rows[0];
  check('refund: subscription status unchanged (active)', subAfter.status === sub.status, subAfter.status);
  // no comm_subscription_events 'refunded' row (CHECK has none)
  const evRefunded = (await pool.query(
    `SELECT count(*)::int n FROM comm_subscription_events WHERE subscription_id=$1 AND event_type='refunded'`, [sub.id])).rows[0].n;
  check('refund: no refunded lifecycle event', evRefunded === 0);

  // ── A: explicit partial override is honoured ──
  const r2 = await refundSubscription(pool, sub.id, { amount_paise: 10000, reason: 'smoke partial' });
  check('refund: explicit amount override', r2?.refund.amount_paise === 10000, r2?.refund.amount_paise);

  // ── A: invoice credit_note over the comm_refund (relaxed abstain). The comm_refund SOURCE must be
  // accepted (no "source type not valid" rejection). A downstream GST-determinability abstain is the
  // pre-existing seller-config guard, not our relax — so we assert success OR a GST abstain, never a
  // source-type rejection. (We don't mutate the shared singleton seller config from a smoke.)
  try {
    const inv = await generateInvoice(pool, {
      docType: 'credit_note', sourceType: 'comm_refund' as any, sourceId: r1!.refund.id,
    });
    check('invoice: credit_note generated over comm_refund', !!(inv as any)?.id);
    check('invoice: is a credit note', (inv as any).doc_type === 'credit_note', (inv as any).doc_type);
  } catch (e: any) {
    const sourceRejected = e?.status === 400 && /source type .*not valid/.test(e?.message ?? '');
    const gstAbstain = e?.status === 422 && /GST is not determinable/.test(e?.message ?? '');
    check('invoice: comm_refund source accepted (no source-type rejection)', !sourceRejected, e?.message);
    check('invoice: only abstains on GST determinability (pre-existing guard)', gstAbstain, e?.message);
  }

  // ── B: credit wallet ──
  const c1 = await issueCredit(pool, { customer_id: customer.id, amount_paise: 20000, reason: 'smoke goodwill' });
  check('credit: issue 20000', c1?.balance_paise === 20000, c1?.balance_paise);
  const c2 = await issueCredit(pool, { customer_id: customer.id, amount_paise: 5000, reason: 'smoke top-up' });
  check('credit: balance 25000 after second issue', c2?.balance_paise === 25000, c2?.balance_paise);
  const bal = await getCreditBalance(pool, customer.id);
  check('credit: derived balance = 25000', bal === 25000, bal);
  const a1 = await applyCredit(pool, { customer_id: customer.id, amount_paise: 15000, reason: 'smoke spend' });
  check('credit: apply 15000 → 10000', a1?.balance_paise === 10000, a1?.balance_paise);

  // ── B: fail-closed overdraw ──
  let overdrawBlocked = false;
  try {
    await applyCredit(pool, { customer_id: customer.id, amount_paise: 999999, reason: 'smoke overdraw' });
  } catch (e: any) {
    overdrawBlocked = e?.status === 400 && /insufficient_credit_balance/.test(e?.message);
  }
  check('credit: overdraw fails closed (400)', overdrawBlocked);
  const balFinal = await getCreditBalance(pool, customer.id);
  check('credit: balance unchanged after blocked overdraw (10000)', balFinal === 10000, balFinal);
  const ledger = await listCreditEntries(pool, customer.id);
  check('credit: ledger has 3 entries (2 credit + 1 debit)', ledger.length === 3, ledger.length);
}

main()
  .catch((e) => { console.error('SMOKE ERROR', e); ok = false; })
  .finally(async () => {
    // self-clean: delete the customer (CASCADE removes subscription/events/refunds/credit_ledger),
    // then the orphan smoke plan.
    await pool.query(`DELETE FROM comm_customers WHERE email=$1`, [EMAIL]).catch(() => {});
    await pool.query(`DELETE FROM comm_plans WHERE name='Smoke Plan' AND price_paise=49900`).catch(() => {});
    await pool.end();
    console.log(ok ? '\nSMOKE: ALL PASS' : '\nSMOKE: FAILURES PRESENT');
    process.exit(ok ? 0 : 1);
  });
