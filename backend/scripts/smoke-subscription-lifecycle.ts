/**
 * PHASE 6.2 — End-to-end subscription LIFECYCLE smoke (TEST/demo mode, self-cleaning).
 *
 * Drives every one of the 7 lifecycle behaviours against the REAL comm_* schema, in-process via the
 * write-surface runtime (services/commercial/subscription-lifecycle-runtime.ts), and asserts the
 * comm_subscriptions state + the append-only comm_subscription_events ledger after each step:
 *
 *   1. start trial            createSubscription(trial_days>0)        → status trial
 *   2. activate               activateSubscription                    → status active, period opened
 *   3. renew                  renewSubscription                       → period extended, no gap
 *   4. upgrade (proration)    changePlan(upgrade)                     → upgraded event + proration meta
 *   5. downgrade (proration)  changePlan(downgrade)                   → downgraded event + credit
 *   6. cancel                 cancelSubscription(atPeriodEnd + now)   → flag, then terminal cancelled
 *   7. grace-period expiry    markPastDue → graceState → sweepGrace   → past_due → (grace) → expired
 *
 * Also proves: deterministic grace window (in_grace inside, grace_elapsed after), markPastDue
 * idempotence, and exactly-once transition via withIdempotency (a duplicate key renews only once).
 *
 * Honesty-first: all rows are @example.com / SMOKE-tagged and removed in a finally block, so a re-run
 * is deterministic and leaves the DB byte-identical. Grace/sweep assertions are scoped to THIS smoke's
 * own subscription ids (the shared dev DB may legitimately hold other past_due rows).
 *
 * Run:  cd backend && npx tsx scripts/smoke-subscription-lifecycle.ts
 */
import { Pool } from 'pg';
import {
  upsertCustomer, createSubscription, activateSubscription, renewSubscription,
  changePlan, cancelSubscription, markPastDue, sweepGraceExpirations,
  graceState, GRACE_DAYS,
  type SubscriptionRow,
} from '../services/commercial/subscription-lifecycle-runtime.js';
import { withIdempotency } from '../services/commercial/idempotency.js';

const SMOKE_EMAIL = 'phase62-lifecycle-smoke@example.com';
const SMOKE_TAG = 'SMOKE62L';
const DAY = 86_400_000;
const T0 = new Date('2026-01-01T00:00:00.000Z');
const at = (days: number) => new Date(T0.getTime() + days * DAY);

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures += 1; console.log(`  ✗ FAIL: ${msg}`); }
}

const ALLOWED_EVENTS = new Set([
  'created', 'trial_started', 'activated', 'renewed', 'upgraded',
  'downgraded', 'cancelled', 'expired', 'payment_succeeded', 'payment_failed',
]);

async function loadSub(pool: Pool, id: string): Promise<SubscriptionRow> {
  return (await pool.query(`SELECT * FROM comm_subscriptions WHERE id=$1`, [id])).rows[0];
}
async function eventCount(pool: Pool, customerId: string): Promise<number> {
  return Number((await pool.query(
    `SELECT COUNT(*)::int n FROM comm_subscription_events WHERE customer_id=$1`, [customerId])).rows[0].n);
}
async function lastEvent(pool: Pool, subId: string): Promise<any> {
  return (await pool.query(
    `SELECT * FROM comm_subscription_events WHERE subscription_id=$1 ORDER BY created_at DESC, id DESC LIMIT 1`,
    [subId])).rows[0];
}

async function cleanup(pool: Pool) {
  await pool.query(
    `DELETE FROM comm_subscription_events WHERE customer_id IN (SELECT id FROM comm_customers WHERE email=$1)`,
    [SMOKE_EMAIL]).catch(() => {});
  await pool.query(
    `DELETE FROM comm_subscriptions WHERE customer_id IN (SELECT id FROM comm_customers WHERE email=$1)`,
    [SMOKE_EMAIL]).catch(() => {});
  await pool.query(`DELETE FROM comm_plans WHERE code LIKE '${SMOKE_TAG}%'`).catch(() => {});
  await pool.query(`DELETE FROM comm_products WHERE code LIKE '${SMOKE_TAG}%'`).catch(() => {});
  await pool.query(`DELETE FROM comm_customers WHERE email=$1`, [SMOKE_EMAIL]).catch(() => {});
  await pool.query(`DELETE FROM comm_idempotency_keys WHERE idempotency_key LIKE 'sub:%${SMOKE_TAG}%'`).catch(() => {});
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('PHASE 6.2 — subscription lifecycle smoke (TEST/demo, self-cleaning)\n');
    await cleanup(pool);

    // ── Seed customer + product + two priced monthly plans (for proration) ──
    const customer = await upsertCustomer(pool, { email: SMOKE_EMAIL, name: 'Phase6.2 Lifecycle', segment: 'career_builder' });
    const productId = (await pool.query(
      `INSERT INTO comm_products (code, name, segment) VALUES ($1,$2,'career_builder') RETURNING id`,
      [`${SMOKE_TAG}_PROD`, 'Phase6.2 Smoke Product'])).rows[0].id;
    const basicPlan = (await pool.query(
      `INSERT INTO comm_plans (product_id, code, name, billing_interval, interval_count, price_paise, currency)
       VALUES ($1,$2,'Basic','monthly',1,99900,'INR') RETURNING id`,
      [productId, `${SMOKE_TAG}_BASIC`])).rows[0].id;
    const proPlan = (await pool.query(
      `INSERT INTO comm_plans (product_id, code, name, billing_interval, interval_count, price_paise, currency)
       VALUES ($1,$2,'Pro','monthly',1,199900,'INR') RETURNING id`,
      [productId, `${SMOKE_TAG}_PRO`])).rows[0].id;
    const beforeEvents = await eventCount(pool, customer.id);

    // ── 1. Start trial ──
    console.log('[1] start trial');
    let a = await createSubscription(pool, {
      customer_id: customer.id, plan_id: basicPlan, segment: 'career_builder',
      billing_interval: 'monthly', trial_days: 14, amount_paise: 99900, now: T0,
    });
    assert(a.status === 'trial', `subscription opens in trial (got ${a.status})`);
    assert(!!a.trial_end, 'trial_end is set');
    {
      const ev = (await pool.query(
        `SELECT event_type FROM comm_subscription_events WHERE subscription_id=$1 ORDER BY created_at ASC, id ASC`, [a.id]
      )).rows.map((r) => r.event_type);
      assert(ev.includes('created') && ev.includes('trial_started'), `created + trial_started events appended (got ${ev.join(',')})`);
    }

    // ── 2. Activate ──
    console.log('\n[2] activate');
    a = (await activateSubscription(pool, a.id, { amount_paise: 99900, now: at(14) }))!;
    assert(a.status === 'active', `trial → active (got ${a.status})`);
    assert(!!a.current_period_start && !!a.current_period_end, 'billing period opened');
    assert((await lastEvent(pool, a.id)).event_type === 'activated', 'activated event appended');

    // ── 3. Renew ──
    console.log('\n[3] renew');
    const endBeforeRenew = new Date(a.current_period_end!).getTime();
    a = (await renewSubscription(pool, a.id, { amount_paise: 99900, now: at(14) }))!;
    assert(new Date(a.current_period_end!).getTime() > endBeforeRenew, 'renew extends the period forward (no gap)');
    assert((await lastEvent(pool, a.id)).event_type === 'renewed', 'renewed event appended');

    // Re-anchor a clean 30-day window starting T0+14 so proration is deterministic.
    await pool.query(
      `UPDATE comm_subscriptions SET current_period_start=$2, current_period_end=$3 WHERE id=$1`,
      [a.id, at(14).toISOString(), at(44).toISOString()]);

    // ── 4. Upgrade (mid-period proration: 50% remaining) ──
    console.log('\n[4] upgrade (proration)');
    a = (await changePlan(pool, a.id, { to_plan_id: proPlan, direction: 'upgrade', now: at(29) }))!;
    assert(a.plan_id === proPlan && a.status === 'active', 'plan switched to Pro, still active');
    {
      const ev = await lastEvent(pool, a.id);
      const pr = ev.metadata?.proration;
      assert(ev.event_type === 'upgraded', 'upgraded event appended');
      assert(ev.from_plan_id === basicPlan && ev.to_plan_id === proPlan, 'event records from_plan → to_plan');
      assert(!!pr, 'proration breakdown recorded in event metadata');
      assert(Math.abs(pr.remaining_fraction - 0.5) < 0.02, `~50% of period remaining (got ${pr?.remaining_fraction})`);
      assert(pr.unused_credit_paise === 49950 && pr.new_charge_paise === 99950, `credit 49950 / charge 99950 (got ${pr?.unused_credit_paise}/${pr?.new_charge_paise})`);
      assert(Number(ev.amount_paise) === 50000, `net charge 50000 paise on upgrade (got ${ev.amount_paise})`);
    }

    // ── 5. Downgrade (mid-period credit) ──
    console.log('\n[5] downgrade (proration credit)');
    a = (await changePlan(pool, a.id, { to_plan_id: basicPlan, direction: 'downgrade', now: at(29) }))!;
    {
      const ev = await lastEvent(pool, a.id);
      assert(ev.event_type === 'downgraded', 'downgraded event appended');
      assert(Number(ev.amount_paise) < 0, `downgrade nets a credit (negative amount; got ${ev.amount_paise})`);
      assert(ev.metadata?.amount_source === 'computed', 'amount_source = computed (no explicit override)');
    }

    // ── 6. Cancel — at period end, then immediate (terminal) ──
    console.log('\n[6] cancel');
    a = (await cancelSubscription(pool, a.id, { atPeriodEnd: true, reason: 'smoke', now: at(31) }))!;
    assert(a.cancel_at_period_end === true && a.status === 'active', 'cancel-at-period-end flags but keeps active');
    assert((await lastEvent(pool, a.id)).metadata?.at_period_end === true, 'cancelled event records at_period_end:true');
    a = (await cancelSubscription(pool, a.id, { atPeriodEnd: false, reason: 'smoke', now: at(31) }))!;
    assert(a.status === 'cancelled' && !!a.cancelled_at, 'immediate cancel → terminal cancelled');

    // ── 7. Grace-period expiry (active → past_due → grace → expired) ──
    console.log('\n[7] grace-period expiry');
    let b = await createSubscription(pool, {
      customer_id: customer.id, plan_id: basicPlan, segment: 'career_builder',
      billing_interval: 'monthly', trial_days: 0, amount_paise: 99900, now: T0,
    }); // active, period T0..T0+30
    b = (await markPastDue(pool, b.id, { reason: 'renewal_failed', now: at(31) }))!;
    assert(b.status === 'past_due', `active → past_due (got ${b.status})`);
    {
      const ev = await lastEvent(pool, b.id);
      assert(ev.event_type === 'payment_failed' && ev.to_status === 'past_due', 'payment_failed event records the lapse');
      assert(!!ev.metadata?.grace_until && ev.metadata?.grace_days === GRACE_DAYS, `grace_until + grace_days(${GRACE_DAYS}) in metadata`);
    }
    // grace window: in_grace just after the boundary, grace_elapsed after GRACE_DAYS.
    assert(graceState(b, at(31)).in_grace === true, 'in_grace TRUE inside the grace window');
    assert(graceState(b, at(31)).grace_elapsed === false, 'grace not yet elapsed inside the window');
    assert(graceState(b, at(30 + GRACE_DAYS + 1)).grace_elapsed === true, 'grace_elapsed TRUE after the window');

    // markPastDue is idempotent — a second call on a past_due sub appends no new event.
    const evBeforeDup = await eventCount(pool, customer.id);
    await markPastDue(pool, b.id, { now: at(31) });
    assert((await eventCount(pool, customer.id)) === evBeforeDup, 'markPastDue idempotent (no duplicate event when already past_due)');

    // sweep INSIDE grace → our sub is NOT expired.
    const sweepInside = await sweepGraceExpirations(pool, { now: at(31) });
    assert(!sweepInside.expired.includes(b.id), 'grace sweep inside window does NOT expire the sub');
    assert((await loadSub(pool, b.id)).status === 'past_due', 'sub remains past_due inside grace');

    // sweep AFTER grace → our sub IS expired.
    const sweepAfter = await sweepGraceExpirations(pool, { now: at(30 + GRACE_DAYS + 1) });
    assert(sweepAfter.expired.includes(b.id), 'grace sweep after window expires the sub');
    assert((await loadSub(pool, b.id)).status === 'expired', 'past_due → expired after grace');
    assert((await lastEvent(pool, b.id)).event_type === 'expired', 'expired event appended');
    const sweepAgain = await sweepGraceExpirations(pool, { now: at(30 + GRACE_DAYS + 1) });
    assert(!sweepAgain.expired.includes(b.id), 'sweep is idempotent (an expired sub is not re-expired)');

    // ── 8. Exactly-once transition via withIdempotency (duplicate key renews ONCE) ──
    console.log('\n[8] idempotent transition (exactly-once)');
    let c = await createSubscription(pool, {
      customer_id: customer.id, plan_id: basicPlan, segment: 'career_builder',
      billing_interval: 'monthly', trial_days: 0, amount_paise: 99900, now: T0,
    });
    const idemKey = `sub:renew:${c.id}:${SMOKE_TAG}_k1`;
    const r1 = await withIdempotency(pool, idemKey, 'sub_renew', () => renewSubscription(pool, c.id, { now: at(1) }));
    const r2 = await withIdempotency(pool, idemKey, 'sub_renew', () => renewSubscription(pool, c.id, { now: at(2) }));
    assert(r1.replayed === false && r2.replayed === true, 'duplicate Idempotency-Key replays (exactly-once)');
    const renewEvents = Number((await pool.query(
      `SELECT COUNT(*)::int n FROM comm_subscription_events WHERE subscription_id=$1 AND event_type='renewed'`, [c.id])).rows[0].n);
    assert(renewEvents === 1, `renew applied exactly once despite two calls (got ${renewEvents} renewed events)`);

    // ── 9. Ledger invariants (append-only, valid types, monotonic growth) ──
    console.log('\n[9] ledger invariants');
    const afterEvents = await eventCount(pool, customer.id);
    assert(afterEvents > beforeEvents, `event ledger grew (${beforeEvents} → ${afterEvents})`);
    const types = (await pool.query(
      `SELECT DISTINCT event_type FROM comm_subscription_events WHERE customer_id=$1`, [customer.id])).rows.map((r) => r.event_type);
    assert(types.every((t) => ALLOWED_EVENTS.has(t)), `all event_types are in the canonical set (${types.join(',')})`);
    const bad = Number((await pool.query(
      `SELECT COUNT(*)::int n FROM comm_subscriptions s
         WHERE s.customer_id=$1 AND s.current_period_end IS NOT NULL AND s.current_period_start IS NOT NULL
           AND s.current_period_end < s.current_period_start`, [customer.id])).rows[0].n);
    assert(bad === 0, 'no subscription has period_end < period_start');
  } finally {
    await cleanup(pool);
    const remCust = Number((await pool.query('SELECT COUNT(*)::int n FROM comm_customers WHERE email=$1', [SMOKE_EMAIL])).rows[0].n);
    const remPlan = Number((await pool.query(`SELECT COUNT(*)::int n FROM comm_plans WHERE code LIKE '${SMOKE_TAG}%'`)).rows[0].n);
    assert(remCust === 0 && remPlan === 0, 'self-clean complete — no @example.com / SMOKE rows remain');
    await pool.end();
  }
  console.log(`\n${failures === 0 ? 'SMOKE PASSED ✅' : `SMOKE FAILED ❌ (${failures} assertion failure(s))`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('smoke crashed:', e); process.exit(1); });
