/**
 * Task #7 — Usage metering engine.
 *
 * Records metered actions to the append-only comm_usage_events ledger and evaluates plan quotas by
 * COUNTing rows in the current billing period. NO FLAG here (the route gates the flag + ensure-schema);
 * these functions assume the table exists.
 *
 * Quota semantics (honest, fail-closed):
 *   - A quota applies only where the identity's ACTIVE subscription plan DECLARES a limit for that
 *     usage type (comm_plans.metadata.quotas — see plan-features.ts). Multiple active plans → the most
 *     generous (MAX) limit applies.
 *   - No active subscription OR no declared limit → UNMETERED (allowed=true, reason explains why). The
 *     meter is a measurement layer, not a paywall; access is gated separately by the entitlement engine.
 *   - When a limit exists and used >= limit → allowed=false (FAIL CLOSED). The recording endpoint
 *     refuses (429) and does NOT write the over-quota event.
 */
import type { Pool } from 'pg';
import { parsePlanFeatures, isUsageType, usageTypeKind, type UsageType } from './plan-features';
import { getCreditBalance, applyCredit, type CreditMutationResult } from './credit-ledger-runtime';

// A pool OR a transaction client — both expose .query. Reads accept either so they can run inside the
// serialized record transaction (see recordUsage) without a second connection.
type Queryable = Pick<Pool, 'query'>;

export interface RecordUsageInput {
  email: string;
  usageType: UsageType;
  quantity?: number;
  subscriptionId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface QuotaState {
  email: string;
  usage_type: UsageType;
  allowed: boolean;
  limit: number | null;          // null = unmetered (no declared quota)
  used: number;                  // events counted in the current period
  remaining: number | null;     // null when unmetered
  period_start: string | null;
  period_end: string | null;
  reason: string;
}

interface ActiveQuotaWindow {
  limit: number | null;
  period_start: Date | null;
  period_end: Date | null;
  reason: string;
}

/**
 * Resolve the binding quota window for an identity + usage type from its ACTIVE subscriptions.
 * Most-generous (MAX) declared limit wins; its plan's current period defines the counting window.
 */
async function resolveQuotaWindow(db: Queryable, email: string, usageType: UsageType): Promise<ActiveQuotaWindow> {
  // GET-never-writes: probe the catalog before reading; an absent substrate is an honest
  // "no active subscription" state, never a thrown error and never a lazy schema bootstrap.
  const probe = await db.query(`SELECT to_regclass('comm_subscriptions') AS oid`);
  if (probe.rows[0]?.oid == null) {
    return { limit: null, period_start: null, period_end: null, reason: 'no_active_subscription' };
  }
  const { rows } = await db.query(
    `SELECT p.metadata, s.current_period_start, s.current_period_end
       FROM comm_subscriptions s
       JOIN comm_customers c ON c.id = s.customer_id
       JOIN comm_plans     p ON p.id = s.plan_id
      WHERE lower(c.email) = lower($1)
        AND s.status IN ('active','trial')
        AND (s.current_period_end IS NULL OR s.current_period_end >= now())`,
    [email],
  );

  if (rows.length === 0) {
    return { limit: null, period_start: null, period_end: null, reason: 'no_active_subscription' };
  }

  let best: ActiveQuotaWindow | null = null;
  for (const r of rows) {
    const q = parsePlanFeatures(r.metadata).quotas[usageType];
    if (q == null) continue;
    if (!best || q > (best.limit ?? -1)) {
      best = {
        limit: q,
        period_start: r.current_period_start ? new Date(r.current_period_start) : null,
        period_end: r.current_period_end ? new Date(r.current_period_end) : null,
        reason: 'quota_enforced',
      };
    }
  }

  if (!best) return { limit: null, period_start: null, period_end: null, reason: 'no_declared_quota' };
  return best;
}

/**
 * Resolve the current "used" reading for an identity + type, honouring the dimension's counting kind:
 *   - period_count : SUM of event quantities since the period window start (calendar month default).
 *   - level        : the LATEST recorded absolute reading (a gauge) — NOT a running sum. Storage is a
 *                    current level, so summing every reading would double-count; the most recent row IS
 *                    the current usage. Period-independent by design.
 */
async function countUsage(
  db: Queryable,
  email: string,
  usageType: UsageType,
  periodStart: Date | null,
): Promise<number> {
  // GET-never-writes: absent ledger → honest 0, never a bootstrap.
  const probe = await db.query(`SELECT to_regclass('comm_usage_events') AS oid`);
  if (probe.rows[0]?.oid == null) return 0;
  if (usageTypeKind(usageType) === 'level') {
    const { rows } = await db.query(
      `SELECT quantity
         FROM comm_usage_events
        WHERE lower(email) = lower($1)
          AND usage_type = $2
        ORDER BY occurred_at DESC, created_at DESC
        LIMIT 1`,
      [email, usageType],
    );
    return Number(rows[0]?.quantity ?? 0);
  }

  const start = periodStart ?? null;
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(quantity), 0) AS used
       FROM comm_usage_events
      WHERE lower(email) = lower($1)
        AND usage_type = $2
        AND occurred_at >= COALESCE($3::timestamptz, date_trunc('month', now()))`,
    [email, usageType, start],
  );
  return Number(rows[0]?.used ?? 0);
}

/** Evaluate a quota WITHOUT recording. Fail-closed when a declared limit is reached. */
export async function checkQuota(db: Queryable, email: string, usageType: UsageType): Promise<QuotaState> {
  const win = await resolveQuotaWindow(db, email, usageType);
  const used = await countUsage(db, email, usageType, win.period_start);

  if (win.limit == null) {
    return {
      email, usage_type: usageType, allowed: true, limit: null, used, remaining: null,
      period_start: win.period_start?.toISOString() ?? null,
      period_end: win.period_end?.toISOString() ?? null,
      reason: win.reason, // no_active_subscription | no_declared_quota → unmetered
    };
  }

  const remaining = Math.max(0, win.limit - used);
  return {
    email, usage_type: usageType, allowed: used < win.limit, limit: win.limit, used, remaining,
    period_start: win.period_start?.toISOString() ?? null,
    period_end: win.period_end?.toISOString() ?? null,
    reason: used < win.limit ? 'within_quota' : 'quota_exceeded',
  };
}

export interface RecordResult {
  recorded: boolean;
  event?: { id: string; email: string; usage_type: UsageType; quantity: number; occurred_at: string };
  quota: QuotaState;
}

/**
 * Record a metered action — but FAIL CLOSED first: if the identity is already at/over a declared
 * quota, the event is refused (recorded=false) and the caller should surface 429. Otherwise the event
 * is appended and a fresh quota state (post-write) is returned.
 */
export async function recordUsage(pool: Pool, input: RecordUsageInput): Promise<RecordResult> {
  const quantity = Math.max(1, Math.trunc(Number(input.quantity ?? 1)) || 1);
  const isLevel = usageTypeKind(input.usageType) === 'level';

  // Fail-closed must hold under CONCURRENCY: a plain read-then-insert lets two writers both pass the
  // pre-check and overrun the limit. We serialize records for the SAME identity + usage_type with a
  // transaction-scoped advisory lock so the pre-check and the insert are atomic. The lock releases on
  // COMMIT/ROLLBACK and never blocks a DIFFERENT identity/type.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
      input.email.toLowerCase(),
      input.usageType,
    ]);

    const pre = await checkQuota(client, input.email, input.usageType);
    if (isLevel) {
      // LEVEL (storage): `quantity` is the NEW absolute reading, not an increment. Fail closed when the
      // new level would exceed a declared limit (a level AT the limit is allowed). No declared limit →
      // unmetered, always recorded.
      if (pre.limit != null && quantity > pre.limit) {
        await client.query('ROLLBACK');
        return { recorded: false, quota: { ...pre, allowed: false, reason: 'quota_exceeded' } };
      }
    } else if (pre.limit != null && pre.used + quantity > pre.limit) {
      // PERIOD_COUNT: refuse when the PROJECTED usage (already-used + this quantity) would cross the
      // declared quota — not just when already at/over the cap. A single large quantity must not be able
      // to bypass the limit. Unmetered (limit null) → allowed.
      await client.query('ROLLBACK');
      return { recorded: false, quota: { ...pre, allowed: false, reason: 'quota_exceeded' } };
    }

    const { rows } = await client.query(
      `INSERT INTO comm_usage_events (email, subscription_id, usage_type, quantity, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, usage_type, quantity, occurred_at`,
      [input.email, input.subscriptionId ?? null, input.usageType, quantity, input.metadata ?? null],
    );

    const post = await checkQuota(client, input.email, input.usageType);
    await client.query('COMMIT');
    return {
      recorded: true,
      event: {
        id: String(rows[0].id),
        email: String(rows[0].email),
        usage_type: rows[0].usage_type as UsageType,
        quantity: Number(rows[0].quantity),
        occurred_at: new Date(rows[0].occurred_at).toISOString(),
      },
      quota: post,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export interface UsageOverview {
  generated_at: string;
  degraded: boolean;
  total_events: number;
  distinct_identities: number;
  by_type: { usage_type: string; events: number; quantity: number; identities: number }[];
  last_30_days: { usage_type: string; events: number; quantity: number }[];
}

/** System-wide usage overview (admin / certification). Never throws; honest zeros when empty. */
export async function buildUsageOverview(pool: Pool): Promise<UsageOverview> {
  let degraded = false;
  const fail = () => { degraded = true; };

  const totals = await pool
    .query(
      `SELECT COUNT(*) AS events, COUNT(DISTINCT lower(email)) AS identities
         FROM comm_usage_events`,
    )
    .then((r) => r.rows[0])
    .catch(() => { fail(); return { events: 0, identities: 0 }; });

  const byType = await pool
    .query(
      `SELECT usage_type,
              COUNT(*) AS events,
              COALESCE(SUM(quantity), 0) AS quantity,
              COUNT(DISTINCT lower(email)) AS identities
         FROM comm_usage_events
        GROUP BY usage_type ORDER BY usage_type`,
    )
    .then((r) => r.rows)
    .catch(() => { fail(); return [] as any[]; });

  const recent = await pool
    .query(
      `SELECT usage_type, COUNT(*) AS events, COALESCE(SUM(quantity), 0) AS quantity
         FROM comm_usage_events
        WHERE occurred_at >= now() - interval '30 days'
        GROUP BY usage_type ORDER BY usage_type`,
    )
    .then((r) => r.rows)
    .catch(() => { fail(); return [] as any[]; });

  return {
    generated_at: new Date().toISOString(),
    degraded,
    total_events: Number(totals?.events ?? 0),
    distinct_identities: Number(totals?.identities ?? 0),
    by_type: byType.map((r) => ({
      usage_type: String(r.usage_type),
      events: Number(r.events ?? 0),
      quantity: Number(r.quantity ?? 0),
      identities: Number(r.identities ?? 0),
    })),
    last_30_days: recent.map((r) => ({
      usage_type: String(r.usage_type),
      events: Number(r.events ?? 0),
      quantity: Number(r.quantity ?? 0),
    })),
  };
}

// ── Credits dimension ──────────────────────────────────────────────────────────────────────────
// The "Credits" business dimension is a CONSUMABLE BALANCE, not a period count — it is backed by the
// append-only credit ledger (comm_credit_ledger), keyed by comm_customers.id. The metering layer is
// keyed by email, so we bridge email → customer_id. We NEVER fabricate a balance: no customer row is a
// distinct honest state (balance 0, can't spend), not a silent zero-allowance.

/** Resolve a metering email to its commercial customer id (null when the customer does not exist). */
export async function resolveCustomerId(pool: Queryable, email: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT id FROM comm_customers WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  return rows.length ? String(rows[0].id) : null;
}

export interface CreditDimensionState {
  email: string;
  dimension: 'credits';
  customer_id: string | null;
  balance: number;       // consumable units remaining (paise on the credit ledger)
  reason: string;        // has_customer | no_customer | no_substrate
}

/**
 * Read the current credit balance for an identity WITHOUT mutating. GET-never-writes: probe the
 * substrate with to_regclass and degrade honestly (no_substrate) when the commercial tables are
 * absent, rather than throwing or bootstrapping schema. No customer → honest 0.
 */
export async function checkCreditDimension(db: Queryable, email: string): Promise<CreditDimensionState> {
  const probe = await db.query(
    `SELECT to_regclass('comm_customers') AS customers, to_regclass('comm_credit_ledger') AS ledger`,
  );
  if (!probe.rows[0]?.customers || !probe.rows[0]?.ledger) {
    return { email, dimension: 'credits', customer_id: null, balance: 0, reason: 'no_substrate' };
  }
  const customerId = await resolveCustomerId(db, email);
  if (!customerId) {
    return { email, dimension: 'credits', customer_id: null, balance: 0, reason: 'no_customer' };
  }
  const balance = await getCreditBalance(db as Pool, customerId);
  return { email, dimension: 'credits', customer_id: customerId, balance, reason: 'has_customer' };
}

export interface CreditSpendResult {
  spent: boolean;
  amount: number;
  state: CreditDimensionState;
  reason: string; // spent | no_customer | insufficient_balance | invalid_amount
}

/**
 * Spend (draw down) credits for an identity. FAIL CLOSED: rejects when the customer does not exist or
 * the balance is insufficient — never overdraws and never fabricates allowance. Append-only (a debit
 * row) via the credit ledger's serialized writer.
 */
export async function spendCredits(
  pool: Pool,
  email: string,
  amount: number,
  opts: { reason?: string | null; refType?: string | null; refId?: string | null; metadata?: Record<string, unknown> | null } = {},
): Promise<CreditSpendResult> {
  const amt = Math.trunc(Number(amount));
  const customerId = await resolveCustomerId(pool, email);
  if (!customerId) {
    return { spent: false, amount: 0, state: { email, dimension: 'credits', customer_id: null, balance: 0, reason: 'no_customer' }, reason: 'no_customer' };
  }
  if (!Number.isFinite(amt) || amt <= 0) {
    const balance = await getCreditBalance(pool, customerId);
    return { spent: false, amount: 0, state: { email, dimension: 'credits', customer_id: customerId, balance, reason: 'has_customer' }, reason: 'invalid_amount' };
  }

  let result: CreditMutationResult | null;
  try {
    result = await applyCredit(pool, {
      customer_id: customerId,
      amount_paise: amt,
      reason: opts.reason ?? 'usage_metering_spend',
      ref_type: opts.refType ?? 'metering',
      ref_id: opts.refId ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch (err: any) {
    // applyCredit throws (status 400) when the balance is insufficient — fail closed, do not overdraw.
    const balance = await getCreditBalance(pool, customerId);
    if (err?.message === 'insufficient_credit_balance') {
      return { spent: false, amount: amt, state: { email, dimension: 'credits', customer_id: customerId, balance, reason: 'has_customer' }, reason: 'insufficient_balance' };
    }
    throw err;
  }

  // result is null only when the customer disappeared mid-flight (already resolved above) — treat as no_customer.
  if (!result) {
    return { spent: false, amount: amt, state: { email, dimension: 'credits', customer_id: null, balance: 0, reason: 'no_customer' }, reason: 'no_customer' };
  }
  return {
    spent: true,
    amount: amt,
    state: { email, dimension: 'credits', customer_id: customerId, balance: result.balance_paise, reason: 'has_customer' },
    reason: 'spent',
  };
}

export { isUsageType };
