/**
 * Task #5 — Commercial Runtime Spine · Customer + subscription lifecycle runtime.
 *
 * WRITE surface for the new commercial spine (distinct from the read-only WC-7C projection in
 * services/wc7c/subscription-lifecycle.ts). EMAIL is the stable customer identity key — it bridges
 * the existing email-keyed capadex_payments / capadex_sessions. We NEVER Number()-coerce id spaces
 * (student_subscriptions is child-keyed; this spine is UUID-keyed).
 *
 * Lifecycle state machine (status): trial → active → (renewed | upgraded | downgraded) → cancelled | expired.
 * Every transition appends a row to comm_subscription_events (append-only — never mutated in place).
 */
import type { Pool } from 'pg';
import { createRazorpayRefund, isRazorpayConfigured } from './razorpay-client';

export type Segment = 'career_builder' | 'employer' | 'institution' | 'enterprise' | 'government';
export type SubStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
export type BillingInterval = 'one_time' | 'trial' | 'monthly' | 'quarterly' | 'annual';
export type LifecycleEvent =
  | 'created' | 'trial_started' | 'activated' | 'renewed' | 'upgraded'
  | 'downgraded' | 'cancelled' | 'expired' | 'payment_succeeded' | 'payment_failed';

const SEGMENTS: Segment[] = ['career_builder', 'employer', 'institution', 'enterprise', 'government'];
export function isSegment(v: unknown): v is Segment {
  return typeof v === 'string' && (SEGMENTS as string[]).includes(v);
}

const INTERVAL_MS: Record<Exclude<BillingInterval, 'one_time' | 'trial'>, number> = {
  monthly: 30 * 86_400_000,
  quarterly: 90 * 86_400_000,
  annual: 365 * 86_400_000,
};

/**
 * Grace window (days) a subscription stays recoverable AFTER its paid-through boundary lapses
 * before the lifecycle moves it to `expired`. Matches the read-only renewal-engine's GRACE_DAYS so
 * the two surfaces agree on the window length. Grace is NOT a status value (the comm_subscriptions
 * CHECK has no 'grace') — it is a DERIVED window over the `past_due` state.
 */
export const GRACE_DAYS = 7;

function periodEnd(interval: BillingInterval, from: Date): Date | null {
  if (interval === 'one_time' || interval === 'trial') return null;
  return new Date(from.getTime() + INTERVAL_MS[interval]);
}

export interface GraceState {
  /** the paid-through boundary (current_period_end ?? trial_end) has lapsed. */
  period_overdue: boolean;
  /** deterministic grace deadline = boundary + GRACE_DAYS (null when there is no finite boundary). */
  grace_until: Date | null;
  /** sub is `past_due` and still inside its grace window — recoverable. */
  in_grace: boolean;
  /** sub is `past_due` and its grace window has fully elapsed — eligible for expiry. */
  grace_elapsed: boolean;
}

/**
 * PURE derivation of the grace window for a subscription. Grace is a window over `past_due`, not a
 * status value. The boundary is the paid-through date (`current_period_end`) or, for a never-activated
 * trial, `trial_end`. With no finite boundary the window is undefined (never auto-expires via sweep).
 */
export function graceState(
  sub: Pick<SubscriptionRow, 'status' | 'current_period_end' | 'trial_end'>,
  now: Date = new Date(),
): GraceState {
  const boundary = sub.current_period_end
    ? new Date(sub.current_period_end)
    : sub.trial_end
      ? new Date(sub.trial_end)
      : null;
  const graceUntil = boundary ? new Date(boundary.getTime() + GRACE_DAYS * 86_400_000) : null;
  const periodOverdue = !!boundary && boundary.getTime() <= now.getTime();
  const isPastDue = sub.status === 'past_due';
  const inGrace = isPastDue && !!graceUntil && now.getTime() < graceUntil.getTime();
  const graceElapsed = isPastDue && !!graceUntil && now.getTime() >= graceUntil.getTime();
  return { period_overdue: periodOverdue, grace_until: graceUntil, in_grace: inGrace, grace_elapsed: graceElapsed };
}

const norm = (email: string) => email.trim().toLowerCase();

export interface CustomerRow {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  segment: Segment;
  user_id: string | null;
  razorpay_customer_id: string | null;
  created_at: string;
}

/** Idempotent upsert of a customer keyed on lower-cased email. */
export async function upsertCustomer(
  pool: Pool,
  args: { email: string; name?: string | null; phone?: string | null; segment?: Segment; user_id?: string | null },
): Promise<CustomerRow> {
  const email = norm(args.email);
  const segment: Segment = isSegment(args.segment) ? args.segment : 'career_builder';
  const { rows } = await pool.query(
    `INSERT INTO comm_customers (email, name, phone, segment, user_id)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (email) DO UPDATE SET
       name    = COALESCE(EXCLUDED.name, comm_customers.name),
       phone   = COALESCE(EXCLUDED.phone, comm_customers.phone),
       user_id = COALESCE(EXCLUDED.user_id, comm_customers.user_id),
       updated_at = now()
     RETURNING id, email, name, phone, segment, user_id, razorpay_customer_id, created_at`,
    [email, args.name ?? null, args.phone ?? null, segment, args.user_id ?? null],
  );
  return rows[0] as CustomerRow;
}

export interface SubscriptionRow {
  id: string;
  customer_id: string;
  plan_id: string | null;
  bundle_id: string | null;
  segment: Segment;
  status: SubStatus;
  billing_interval: BillingInterval;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  razorpay_subscription_id: string | null;
  started_at: string;
  cancelled_at: string | null;
}

async function appendEvent(
  pool: Pool,
  e: {
    subscription_id: string;
    customer_id: string;
    event_type: LifecycleEvent;
    from_status?: SubStatus | null;
    to_status?: SubStatus | null;
    from_plan_id?: string | null;
    to_plan_id?: string | null;
    amount_paise?: number | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO comm_subscription_events
       (subscription_id, customer_id, event_type, from_status, to_status, from_plan_id, to_plan_id, amount_paise, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [
      e.subscription_id, e.customer_id, e.event_type,
      e.from_status ?? null, e.to_status ?? null,
      e.from_plan_id ?? null, e.to_plan_id ?? null,
      e.amount_paise ?? null,
      e.metadata ? JSON.stringify(e.metadata) : null,
    ],
  );
}

/**
 * Create a subscription instance. If `trialDays>0` it starts in `trial` (status=trial, trial_end set);
 * otherwise it starts `active` with a current period. Writes a `created` + (`trial_started`|`activated`) event.
 */
export async function createSubscription(
  pool: Pool,
  args: {
    customer_id: string;
    plan_id?: string | null;
    bundle_id?: string | null;
    segment: Segment;
    billing_interval: BillingInterval;
    trial_days?: number;
    amount_paise?: number | null;
    razorpay_subscription_id?: string | null;
    now?: Date;
  },
): Promise<SubscriptionRow> {
  const now = args.now ?? new Date();
  const trialDays = Math.max(0, args.trial_days ?? 0);
  const isTrial = trialDays > 0;
  const status: SubStatus = isTrial ? 'trial' : 'active';
  const trialEnd = isTrial ? new Date(now.getTime() + trialDays * 86_400_000) : null;
  const periodStart = isTrial ? null : now;
  const periodEndDate = isTrial ? null : periodEnd(args.billing_interval, now);

  const { rows } = await pool.query(
    `INSERT INTO comm_subscriptions
       (customer_id, plan_id, bundle_id, segment, status, billing_interval,
        current_period_start, current_period_end, trial_end, razorpay_subscription_id, started_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      args.customer_id, args.plan_id ?? null, args.bundle_id ?? null, args.segment, status,
      args.billing_interval, periodStart, periodEndDate, trialEnd,
      args.razorpay_subscription_id ?? null, now,
    ],
  );
  const sub = rows[0] as SubscriptionRow;

  await appendEvent(pool, {
    subscription_id: sub.id, customer_id: sub.customer_id, event_type: 'created',
    to_status: status, to_plan_id: args.plan_id ?? null, amount_paise: args.amount_paise ?? null,
  });
  await appendEvent(pool, {
    subscription_id: sub.id, customer_id: sub.customer_id,
    event_type: isTrial ? 'trial_started' : 'activated', to_status: status,
  });
  return sub;
}

async function loadSub(pool: Pool, id: string): Promise<SubscriptionRow | null> {
  const { rows } = await pool.query(`SELECT * FROM comm_subscriptions WHERE id=$1 LIMIT 1`, [id]);
  return (rows[0] as SubscriptionRow) ?? null;
}

/** Activate a trialing subscription (trial → active), opening a billing period. */
export async function activateSubscription(
  pool: Pool, subscriptionId: string, opts: { amount_paise?: number | null; now?: Date } = {},
): Promise<SubscriptionRow | null> {
  const sub = await loadSub(pool, subscriptionId);
  if (!sub) return null;
  const now = opts.now ?? new Date();
  const end = periodEnd(sub.billing_interval, now);
  const { rows } = await pool.query(
    `UPDATE comm_subscriptions
       SET status='active', current_period_start=$2, current_period_end=$3, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [subscriptionId, now, end],
  );
  await appendEvent(pool, {
    subscription_id: sub.id, customer_id: sub.customer_id, event_type: 'activated',
    from_status: sub.status, to_status: 'active', amount_paise: opts.amount_paise ?? null,
  });
  return rows[0] as SubscriptionRow;
}

/** Renew the current period forward (active → active, same plan). */
export async function renewSubscription(
  pool: Pool, subscriptionId: string, opts: { amount_paise?: number | null; now?: Date } = {},
): Promise<SubscriptionRow | null> {
  const sub = await loadSub(pool, subscriptionId);
  if (!sub) return null;
  const now = opts.now ?? new Date();
  // Renew from the later of now and the existing period end (no gaps, no overlap shrink).
  const base = sub.current_period_end && new Date(sub.current_period_end) > now ? new Date(sub.current_period_end) : now;
  const end = periodEnd(sub.billing_interval, base);
  const { rows } = await pool.query(
    `UPDATE comm_subscriptions
       SET status='active', current_period_start=$2, current_period_end=$3, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [subscriptionId, base, end],
  );
  await appendEvent(pool, {
    subscription_id: sub.id, customer_id: sub.customer_id, event_type: 'renewed',
    from_status: sub.status, to_status: 'active', amount_paise: opts.amount_paise ?? null,
  });
  return rows[0] as SubscriptionRow;
}

/** Read a plan's list price in paise. Returns null when the plan is absent/unpriced (never throws). */
async function planPricePaise(pool: Pool, planId: string | null): Promise<number | null> {
  if (!planId) return null;
  const { rows } = await pool
    .query(`SELECT price_paise FROM comm_plans WHERE id=$1 LIMIT 1`, [planId])
    .catch(() => ({ rows: [] as Array<{ price_paise: unknown }> }));
  if (!rows.length || rows[0].price_paise == null) return null;
  const n = Number(rows[0].price_paise);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export interface ProrationBreakdown {
  from_price_paise: number | null;
  to_price_paise: number | null;
  /** fraction of the current period still unused at the change instant (0..1). */
  remaining_fraction: number;
  period_days: number | null;
  remaining_days: number | null;
  /** unused value of the OLD plan over the remaining period (a credit). */
  unused_credit_paise: number;
  /** cost of the NEW plan over the remaining period. */
  new_charge_paise: number;
  /** net = new_charge − unused_credit (>0 customer owes, <0 customer is credited). */
  net_paise: number;
  /** the billing interval changed, so the period was re-anchored to a fresh cycle. */
  interval_changed: boolean;
}

/**
 * DETERMINISTIC proration for a mid-cycle plan change. Computes the unused credit of the current plan
 * and the prorated charge of the new plan over the SAME remaining period, from the live comm_plans
 * prices (never fabricated — a missing/unpriced plan contributes 0 to that leg). Period handling:
 *   • same interval  → preserve the paid-through window (keep current_period_start/end).
 *   • interval change → re-anchor to a fresh cycle (now .. now+interval); proration still credits the
 *     unused remainder of the old window.
 */
export function computeProration(
  args: {
    from_price_paise: number | null;
    to_price_paise: number | null;
    period_start: Date | null;
    period_end: Date | null;
    interval_changed: boolean;
    now: Date;
  },
): ProrationBreakdown {
  let remainingFraction = 0;
  let periodDays: number | null = null;
  let remainingDays: number | null = null;
  const { period_start: start, period_end: end, now } = args;
  if (start && end && end.getTime() > start.getTime()) {
    const total = end.getTime() - start.getTime();
    const remaining = Math.min(total, Math.max(0, end.getTime() - now.getTime()));
    remainingFraction = remaining / total;
    periodDays = Math.round(total / 86_400_000);
    remainingDays = Math.round(remaining / 86_400_000);
  }
  const unusedCredit = args.from_price_paise != null ? Math.round(args.from_price_paise * remainingFraction) : 0;
  const newCharge = args.to_price_paise != null ? Math.round(args.to_price_paise * remainingFraction) : 0;
  return {
    from_price_paise: args.from_price_paise,
    to_price_paise: args.to_price_paise,
    remaining_fraction: Math.round(remainingFraction * 1e6) / 1e6,
    period_days: periodDays,
    remaining_days: remainingDays,
    unused_credit_paise: unusedCredit,
    new_charge_paise: newCharge,
    net_paise: newCharge - unusedCredit,
    interval_changed: args.interval_changed,
  };
}

/**
 * Change plan up or down. `direction` decides the event_type; both keep status active. Computes
 * DETERMINISTIC proration from the live plan prices (recorded in event metadata + amount_paise; an
 * explicit `amount_paise` override always wins). Preserves the paid-through period for a same-interval
 * change, re-anchors a fresh cycle when the billing interval changes.
 */
export async function changePlan(
  pool: Pool,
  subscriptionId: string,
  args: { to_plan_id: string; to_billing_interval?: BillingInterval; direction: 'upgrade' | 'downgrade'; amount_paise?: number | null; now?: Date },
): Promise<SubscriptionRow | null> {
  const sub = await loadSub(pool, subscriptionId);
  if (!sub) return null;
  const now = args.now ?? new Date();
  const interval = args.to_billing_interval ?? sub.billing_interval;
  const intervalChanged = interval !== sub.billing_interval;

  const curStart = sub.current_period_start ? new Date(sub.current_period_start) : null;
  const curEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;

  const [fromPrice, toPrice] = await Promise.all([
    planPricePaise(pool, sub.plan_id),
    planPricePaise(pool, args.to_plan_id),
  ]);
  const proration = computeProration({
    from_price_paise: fromPrice, to_price_paise: toPrice,
    period_start: curStart, period_end: curEnd, interval_changed: intervalChanged, now,
  });

  // Same interval: keep the paid-through window. Interval change: re-anchor a fresh cycle.
  const newStart = intervalChanged ? now : (curStart ?? now);
  const newEnd = intervalChanged ? periodEnd(interval, now) : (curEnd ?? periodEnd(interval, now));

  const { rows } = await pool.query(
    `UPDATE comm_subscriptions
       SET plan_id=$2, billing_interval=$3, status='active',
           current_period_start=$4, current_period_end=$5, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [subscriptionId, args.to_plan_id, interval, newStart, newEnd],
  );
  const amount = args.amount_paise != null ? args.amount_paise : proration.net_paise;
  await appendEvent(pool, {
    subscription_id: sub.id, customer_id: sub.customer_id,
    event_type: args.direction === 'upgrade' ? 'upgraded' : 'downgraded',
    from_status: sub.status, to_status: 'active',
    from_plan_id: sub.plan_id, to_plan_id: args.to_plan_id, amount_paise: amount,
    metadata: { proration, amount_source: args.amount_paise != null ? 'explicit' : 'computed' },
  });
  return rows[0] as SubscriptionRow;
}

/**
 * Cancel a subscription. `atPeriodEnd` keeps it active until current_period_end (sets the flag);
 * otherwise it cancels immediately (status=cancelled, cancelled_at set).
 */
export async function cancelSubscription(
  pool: Pool, subscriptionId: string, opts: { atPeriodEnd?: boolean; reason?: string; now?: Date } = {},
): Promise<SubscriptionRow | null> {
  const sub = await loadSub(pool, subscriptionId);
  if (!sub) return null;
  const now = opts.now ?? new Date();
  if (opts.atPeriodEnd) {
    const { rows } = await pool.query(
      `UPDATE comm_subscriptions SET cancel_at_period_end=true, updated_at=now() WHERE id=$1 RETURNING *`,
      [subscriptionId],
    );
    await appendEvent(pool, {
      subscription_id: sub.id, customer_id: sub.customer_id, event_type: 'cancelled',
      from_status: sub.status, to_status: sub.status,
      metadata: { at_period_end: true, reason: opts.reason ?? null },
    });
    return rows[0] as SubscriptionRow;
  }
  const { rows } = await pool.query(
    `UPDATE comm_subscriptions SET status='cancelled', cancelled_at=$2, updated_at=now() WHERE id=$1 RETURNING *`,
    [subscriptionId, now],
  );
  await appendEvent(pool, {
    subscription_id: sub.id, customer_id: sub.customer_id, event_type: 'cancelled',
    from_status: sub.status, to_status: 'cancelled', metadata: { at_period_end: false, reason: opts.reason ?? null },
  });
  return rows[0] as SubscriptionRow;
}

/** Mark a subscription expired (period ended without renewal). */
export async function expireSubscription(
  pool: Pool, subscriptionId: string, opts: { now?: Date } = {},
): Promise<SubscriptionRow | null> {
  const sub = await loadSub(pool, subscriptionId);
  if (!sub) return null;
  const { rows } = await pool.query(
    `UPDATE comm_subscriptions SET status='expired', updated_at=now() WHERE id=$1 RETURNING *`,
    [subscriptionId],
  );
  await appendEvent(pool, {
    subscription_id: sub.id, customer_id: sub.customer_id, event_type: 'expired',
    from_status: sub.status, to_status: 'expired',
  });
  return rows[0] as SubscriptionRow;
}

/**
 * Lapse a subscription into `past_due` when a renewal is missed/failed (active|trial → past_due).
 * Idempotent: a subscription not in active/trial is returned unchanged (no duplicate event). Records a
 * `payment_failed` event (no dedicated past_due event_type exists) carrying the derived grace deadline.
 */
export async function markPastDue(
  pool: Pool, subscriptionId: string, opts: { reason?: string; now?: Date } = {},
): Promise<SubscriptionRow | null> {
  const sub = await loadSub(pool, subscriptionId);
  if (!sub) return null;
  if (sub.status !== 'active' && sub.status !== 'trial') return sub; // only a live sub can lapse
  const now = opts.now ?? new Date();
  const { rows } = await pool.query(
    `UPDATE comm_subscriptions SET status='past_due', updated_at=now() WHERE id=$1 RETURNING *`,
    [subscriptionId],
  );
  const updated = rows[0] as SubscriptionRow;
  const g = graceState(updated, now);
  await appendEvent(pool, {
    subscription_id: sub.id, customer_id: sub.customer_id, event_type: 'payment_failed',
    from_status: sub.status, to_status: 'past_due',
    metadata: { reason: opts.reason ?? 'renewal_due', grace_until: g.grace_until?.toISOString() ?? null, grace_days: GRACE_DAYS },
  });
  return updated;
}

/**
 * Deterministic grace sweep: expire every `past_due` subscription whose grace window has fully elapsed
 * (`graceState.grace_elapsed`). Subscriptions still inside grace, or with no finite boundary, are left
 * untouched. Drives the existing `expireSubscription` (append-only `expired` event). Read-bounded by
 * `limit`. Returns the scanned count and the ids expired.
 */
export async function sweepGraceExpirations(
  pool: Pool, opts: { now?: Date; limit?: number } = {},
): Promise<{ scanned: number; expired: string[] }> {
  const now = opts.now ?? new Date();
  const limit = Math.max(1, Math.min(5000, opts.limit ?? 500));
  const { rows } = await pool.query(
    `SELECT * FROM comm_subscriptions WHERE status='past_due' ORDER BY updated_at ASC LIMIT $1`,
    [limit],
  );
  const expired: string[] = [];
  for (const r of rows as SubscriptionRow[]) {
    if (graceState(r, now).grace_elapsed) {
      await expireSubscription(pool, r.id, { now });
      expired.push(r.id);
    }
  }
  return { scanned: rows.length, expired };
}

/** Record a payment outcome against a subscription (append-only; does not change status by itself). */
export async function recordPaymentEvent(
  pool: Pool,
  args: { subscription_id: string; succeeded: boolean; amount_paise?: number | null; metadata?: Record<string, unknown> },
): Promise<void> {
  const sub = await loadSub(pool, args.subscription_id);
  if (!sub) return;
  await appendEvent(pool, {
    subscription_id: sub.id, customer_id: sub.customer_id,
    event_type: args.succeeded ? 'payment_succeeded' : 'payment_failed',
    amount_paise: args.amount_paise ?? null, metadata: args.metadata ?? null,
  });
}

export interface RefundResult {
  refund: {
    id: string; subscription_id: string; customer_id: string;
    amount_paise: number; currency: string; reason: string | null;
    status: string; razorpay_payment_id: string | null; razorpay_refund_id: string | null;
    is_demo: boolean; created_at: string;
  };
  razorpay_configured: boolean;
  demo: boolean;
}

/**
 * Phase 6.3 — refund a subscription into the append-only comm_refunds ledger.
 *
 * Amount resolution (NEVER fabricated): explicit override → last `payment_succeeded` event amount →
 * plan price → ABSTAIN (throws 400). The gateway refund runs via createRazorpayRefund (demo fallback
 * when keyless). A refund is a FINANCIAL event, not a lifecycle transition, so the subscription status
 * is left unchanged and no comm_subscription_events row is written (its CHECK has no 'refunded').
 *
 * Returns null when the subscription does not exist.
 */
export async function refundSubscription(
  pool: Pool,
  subscriptionId: string,
  opts: { amount_paise?: number | null; reason?: string; razorpay_payment_id?: string | null } = {},
): Promise<RefundResult | null> {
  const sub = await loadSub(pool, subscriptionId);
  if (!sub) return null;

  // Resolve amount + the original gateway payment id from the last recorded successful payment.
  let amount: number | null =
    opts.amount_paise != null && Number.isFinite(Number(opts.amount_paise)) ? Math.trunc(Number(opts.amount_paise)) : null;
  let paymentId: string | null = opts.razorpay_payment_id ?? null;

  if (amount == null || paymentId == null) {
    const { rows } = await pool.query(
      `SELECT amount_paise, metadata FROM comm_subscription_events
       WHERE subscription_id=$1 AND event_type='payment_succeeded'
       ORDER BY created_at DESC LIMIT 1`,
      [subscriptionId],
    );
    if (rows.length) {
      if (amount == null && rows[0].amount_paise != null) amount = Number(rows[0].amount_paise);
      if (paymentId == null) {
        const md = (rows[0].metadata ?? {}) as Record<string, unknown>;
        paymentId = (md.razorpay_payment_id as string | undefined) ?? null;
      }
    }
  }

  // Plan price + currency (also the last-resort amount when no payment was recorded).
  let currency = 'INR';
  if (sub.plan_id) {
    const { rows } = await pool.query(`SELECT price_paise, currency FROM comm_plans WHERE id=$1 LIMIT 1`, [sub.plan_id]);
    if (rows.length) {
      currency = rows[0].currency || 'INR';
      if (amount == null && rows[0].price_paise != null) amount = Number(rows[0].price_paise);
    }
  }

  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    // Abstain rather than invent a refund amount.
    throw Object.assign(new Error('no recorded payment amount to refund; supply amount_paise'), { status: 400 });
  }

  // Gateway refund. With a real payment id + configured keys this hits Razorpay; otherwise a demo /
  // internal refund id is recorded — the ledger row is real either way (is_demo flags the difference).
  let razorpayRefundId: string;
  let configured = isRazorpayConfigured();
  let demo = true;
  if (paymentId) {
    const r = await createRazorpayRefund({ paymentId, amountPaise: amount, notes: { subscription_id: subscriptionId } });
    razorpayRefundId = r.data.id;
    configured = r.configured;
    demo = r.demo;
  } else {
    razorpayRefundId = `MANUAL_RFND_${Date.now()}`;
    demo = true; // no gateway payment to reverse — manual/internal refund
  }

  const { rows } = await pool.query(
    `INSERT INTO comm_refunds
       (subscription_id, customer_id, amount_paise, currency, reason, status, razorpay_payment_id, razorpay_refund_id, is_demo, metadata)
     VALUES ($1,$2,$3,$4,$5,'processed',$6,$7,$8,$9::jsonb) RETURNING *`,
    [sub.id, sub.customer_id, amount, currency, opts.reason ?? null, paymentId, razorpayRefundId, demo,
     JSON.stringify({ razorpay_configured: configured })],
  );
  return { refund: rows[0], razorpay_configured: configured, demo };
}

/** Read-only: bridge a customer to prior B2C stage purchases via EMAIL (never id-coerced). */
export async function getLinkedStagePayments(
  pool: Pool, email: string,
): Promise<Array<{ stage_code: string; amount_paise: number; status: string; created_at: string }>> {
  const { rows } = await pool.query(
    `SELECT stage_code, amount_paise, status, created_at
     FROM capadex_payments WHERE lower(email)=lower($1) ORDER BY created_at DESC`,
    [norm(email)],
  );
  return rows.map((r) => ({
    stage_code: String(r.stage_code),
    amount_paise: Number(r.amount_paise ?? 0),
    status: String(r.status),
    created_at: r.created_at,
  }));
}
