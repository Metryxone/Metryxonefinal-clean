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

function periodEnd(interval: BillingInterval, from: Date): Date | null {
  if (interval === 'one_time' || interval === 'trial') return null;
  return new Date(from.getTime() + INTERVAL_MS[interval]);
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

/** Change plan up or down. `direction` decides the event_type; both keep status active. */
export async function changePlan(
  pool: Pool,
  subscriptionId: string,
  args: { to_plan_id: string; to_billing_interval?: BillingInterval; direction: 'upgrade' | 'downgrade'; amount_paise?: number | null; now?: Date },
): Promise<SubscriptionRow | null> {
  const sub = await loadSub(pool, subscriptionId);
  if (!sub) return null;
  const now = args.now ?? new Date();
  const interval = args.to_billing_interval ?? sub.billing_interval;
  const end = periodEnd(interval, now);
  const { rows } = await pool.query(
    `UPDATE comm_subscriptions
       SET plan_id=$2, billing_interval=$3, status='active',
           current_period_start=$4, current_period_end=$5, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [subscriptionId, args.to_plan_id, interval, now, end],
  );
  await appendEvent(pool, {
    subscription_id: sub.id, customer_id: sub.customer_id,
    event_type: args.direction === 'upgrade' ? 'upgraded' : 'downgraded',
    from_status: sub.status, to_status: 'active',
    from_plan_id: sub.plan_id, to_plan_id: args.to_plan_id, amount_paise: args.amount_paise ?? null,
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
