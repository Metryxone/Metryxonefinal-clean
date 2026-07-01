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
import { parsePlanFeatures, isUsageType, usageTypeKind, isQuotaDimension, QUOTA_DIMENSIONS, type UsageType } from './plan-features';
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
 * Read a per-identity quota OVERRIDE (an admin-set limit for ONE identity + usage type, regardless of
 * their plan) or null when none exists / the substrate is absent. GET-never-writes: probe the table with
 * to_regclass first so a read on a DB without the overrides table degrades to "no override", never DDL.
 */
async function resolveIdentityOverride(db: Queryable, email: string, usageType: UsageType): Promise<number | null> {
  const probe = await db.query(`SELECT to_regclass('comm_usage_overrides') AS oid`);
  if (probe.rows[0]?.oid == null) return null;
  const { rows } = await db.query(
    `SELECT limit_value FROM comm_usage_overrides
      WHERE lower(email) = lower($1) AND usage_type = $2
      LIMIT 1`,
    [email, usageType],
  );
  if (!rows.length) return null;
  const n = Number(rows[0].limit_value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

/**
 * Resolve the binding quota window for an identity + usage type.
 * PRECEDENCE: a per-identity admin OVERRIDE wins over any plan-declared quota (it applies regardless of
 * the identity's subscription). Otherwise the most-generous (MAX) declared limit across ACTIVE
 * subscriptions wins; its plan's current period defines the counting window. When an override applies but
 * no plan quota does, we count within the identity's active subscription period if one exists (else the
 * calendar-month default in countUsage).
 */
async function resolveQuotaWindow(db: Queryable, email: string, usageType: UsageType): Promise<ActiveQuotaWindow> {
  // GET-never-writes: probe the catalog before reading; an absent substrate is an honest
  // "no active subscription" state, never a thrown error and never a lazy schema bootstrap.
  let hasActiveSub = false;
  let planBest: ActiveQuotaWindow | null = null;
  let fallbackPeriodStart: Date | null = null;
  let fallbackPeriodEnd: Date | null = null;

  const probe = await db.query(`SELECT to_regclass('comm_subscriptions') AS oid`);
  if (probe.rows[0]?.oid != null) {
    const { rows } = await db.query(
      `SELECT p.metadata, s.current_period_start, s.current_period_end
         FROM comm_subscriptions s
         JOIN comm_customers c ON c.id = s.customer_id
         JOIN comm_plans     p ON p.id = s.plan_id
        WHERE lower(c.email) = lower($1)
          AND s.status IN ('active','trial')
          AND (s.current_period_end IS NULL OR s.current_period_end >= now())
        ORDER BY s.current_period_start DESC NULLS LAST, s.id DESC`,
      [email],
    );

    if (rows.length > 0) {
      hasActiveSub = true;
      for (const r of rows) {
        // Remember the most recent active period as a counting-window fallback for an override
        // (rows are ordered newest-first, so the first row we see is deterministic).
        if (fallbackPeriodStart == null && r.current_period_start) fallbackPeriodStart = new Date(r.current_period_start);
        if (fallbackPeriodEnd == null && r.current_period_end) fallbackPeriodEnd = new Date(r.current_period_end);
        const q = parsePlanFeatures(r.metadata).quotas[usageType];
        if (q == null) continue;
        if (!planBest || q > (planBest.limit ?? -1)) {
          planBest = {
            limit: q,
            period_start: r.current_period_start ? new Date(r.current_period_start) : null,
            period_end: r.current_period_end ? new Date(r.current_period_end) : null,
            reason: 'quota_enforced',
          };
        }
      }
    }
  }

  // A per-identity override takes precedence over ANY plan-declared quota, regardless of subscription.
  const override = await resolveIdentityOverride(db, email, usageType);
  if (override != null) {
    return {
      limit: override,
      period_start: planBest?.period_start ?? fallbackPeriodStart,
      period_end: planBest?.period_end ?? fallbackPeriodEnd,
      reason: 'override_enforced',
    };
  }

  if (planBest) return planBest;
  if (!hasActiveSub) return { limit: null, period_start: null, period_end: null, reason: 'no_active_subscription' };
  return { limit: null, period_start: null, period_end: null, reason: 'no_declared_quota' };
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

// ── Admin quota configuration (per-plan) ─────────────────────────────────────────────────────────
// Declared quotas live on comm_plans.metadata.quotas (see plan-features.ts). Editing them is the
// canonical way to change the limits enforced by resolveQuotaWindow / surfaced in the consumption
// view — no code change required. These helpers list + upsert those quotas, touching ONLY the editable
// business dimensions (QUOTA_DIMENSIONS) and NEVER clobbering a plan's other metadata.

export interface PlanQuotaRow {
  plan_id: string;
  plan_code: string;
  plan_name: string;
  product_id: string | null;
  product_name: string | null;
  segment: string | null;
  is_active: boolean;
  billing_interval: string;
  quotas: Partial<Record<UsageType, number>>; // only the editable dimensions; absent = unmetered
}

export interface PlanQuotaOverview {
  generated_at: string;
  degraded: boolean;
  dimensions: UsageType[];      // editable dimension order (for the UI table)
  plans: PlanQuotaRow[];
}

/**
 * List every plan with its declared quotas for the editable business dimensions. GET-never-writes:
 * probe comm_plans with to_regclass and degrade to an honest empty catalog when absent, rather than
 * bootstrapping schema. Never throws.
 */
export async function listPlanQuotas(pool: Pool): Promise<PlanQuotaOverview> {
  const dimensions = [...QUOTA_DIMENSIONS];
  const probe = await pool.query(`SELECT to_regclass('comm_plans') AS oid`).catch(() => null);
  if (!probe || probe.rows[0]?.oid == null) {
    return { generated_at: new Date().toISOString(), degraded: false, dimensions, plans: [] };
  }
  let degraded = false;
  const rows = await pool
    .query(
      `SELECT p.id, p.code, p.name, p.billing_interval, p.is_active, p.metadata,
              pr.id AS product_id, pr.name AS product_name, pr.segment
         FROM comm_plans p
         LEFT JOIN comm_products pr ON pr.id = p.product_id
        ORDER BY pr.segment NULLS LAST, pr.sort_order NULLS LAST, p.sort_order, p.name`,
    )
    .then((r) => r.rows)
    .catch((e) => { console.error('[plan quotas list]', e); degraded = true; return [] as any[]; });

  const plans: PlanQuotaRow[] = rows.map((r) => {
    const declared = parsePlanFeatures(r.metadata).quotas;
    const quotas: Partial<Record<UsageType, number>> = {};
    for (const d of QUOTA_DIMENSIONS) if (declared[d] != null) quotas[d] = declared[d]!;
    return {
      plan_id: String(r.id),
      plan_code: String(r.code),
      plan_name: String(r.name),
      product_id: r.product_id ? String(r.product_id) : null,
      product_name: r.product_name ? String(r.product_name) : null,
      segment: r.segment ? String(r.segment) : null,
      is_active: r.is_active !== false,
      billing_interval: String(r.billing_interval ?? ''),
      quotas,
    };
  });
  return { generated_at: new Date().toISOString(), degraded, dimensions, plans };
}

export interface UpsertPlanQuotasResult {
  ok: boolean;
  reason?: 'not_found' | 'invalid';
  plan?: PlanQuotaRow;
}

/**
 * Upsert the editable per-dimension quotas for a plan into comm_plans.metadata.quotas WITHOUT
 * clobbering the plan's other metadata (feature_classes, and any quota declared for a NON-editable
 * usage_type such as legacy views/searches). Semantics per editable dimension:
 *   - present with a finite value >= 0 → set that limit
 *   - present but null / '' (empty) → clear the quota (→ unmetered)
 *   - absent from the payload → left exactly as-is
 * Read-modify-write under a FOR UPDATE row lock so concurrent admin edits can't lose an update.
 */
export async function upsertPlanQuotas(
  pool: Pool,
  planId: string,
  input: Record<string, unknown>,
): Promise<UpsertPlanQuotasResult> {
  // Sanitize the incoming map down to the editable dimensions only. null/'' = explicit clear.
  const clean = new Map<UsageType, number | null>();
  for (const d of QUOTA_DIMENSIONS) {
    if (!(d in input)) continue;
    const v = (input as Record<string, unknown>)[d];
    if (v == null || v === '') { clean.set(d, null); continue; }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return { ok: false, reason: 'invalid' };
    clean.set(d, Math.trunc(n));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT metadata FROM comm_plans WHERE id=$1 FOR UPDATE`, [planId]);
    if (!rows.length) { await client.query('ROLLBACK'); return { ok: false, reason: 'not_found' }; }
    const meta = (rows[0].metadata && typeof rows[0].metadata === 'object' && !Array.isArray(rows[0].metadata))
      ? { ...(rows[0].metadata as Record<string, unknown>) }
      : {};
    const quotas = (meta.quotas && typeof meta.quotas === 'object' && !Array.isArray(meta.quotas))
      ? { ...(meta.quotas as Record<string, unknown>) }
      : {};
    for (const [d, val] of clean) {
      if (val == null) delete quotas[d];
      else quotas[d] = val;
    }
    meta.quotas = quotas;
    await client.query(`UPDATE comm_plans SET metadata=$2::jsonb, updated_at=now() WHERE id=$1`, [planId, JSON.stringify(meta)]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const overview = await listPlanQuotas(pool);
  return { ok: true, plan: overview.plans.find((p) => p.plan_id === planId) };
}

// ── Per-identity quota overrides (admin) ─────────────────────────────────────────────────────────
// A quota override is an admin-set limit for ONE identity + usage type that takes PRECEDENCE over the
// identity's plan quota in resolveQuotaWindow (regardless of subscription). Stored uniquely by
// (lower(email), usage_type) in comm_usage_overrides; upsert replaces the standing override, delete
// clears it (the identity falls back to their plan quota). Only the editable QUOTA_DIMENSIONS are
// override-able (credits are a consumable balance, not a per-period quota).

export interface UsageOverrideRow {
  email: string;
  usage_type: UsageType;
  limit_value: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsageOverrideOverview {
  generated_at: string;
  degraded: boolean;
  dimensions: UsageType[];      // override-able dimension order (for the UI select)
  overrides: UsageOverrideRow[];
}

/**
 * List every standing per-identity quota override. GET-never-writes: probe comm_usage_overrides with
 * to_regclass and degrade to an honest empty list when absent, rather than bootstrapping schema. Never
 * throws.
 */
export async function listUsageOverrides(pool: Pool): Promise<UsageOverrideOverview> {
  const dimensions = [...QUOTA_DIMENSIONS];
  const probe = await pool.query(`SELECT to_regclass('comm_usage_overrides') AS oid`).catch(() => null);
  if (!probe || probe.rows[0]?.oid == null) {
    return { generated_at: new Date().toISOString(), degraded: false, dimensions, overrides: [] };
  }
  let degraded = false;
  const rows = await pool
    .query(
      `SELECT email, usage_type, limit_value, note, created_at, updated_at
         FROM comm_usage_overrides
        ORDER BY lower(email), usage_type`,
    )
    .then((r) => r.rows)
    .catch((e) => { console.error('[usage overrides list]', e); degraded = true; return [] as any[]; });

  const overrides: UsageOverrideRow[] = rows.map((r) => ({
    email: String(r.email),
    usage_type: r.usage_type as UsageType,
    limit_value: Number(r.limit_value),
    note: r.note != null ? String(r.note) : null,
    created_at: new Date(r.created_at).toISOString(),
    updated_at: new Date(r.updated_at).toISOString(),
  }));
  return { generated_at: new Date().toISOString(), degraded, dimensions, overrides };
}

export interface UpsertUsageOverrideResult {
  ok: boolean;
  reason?: 'invalid';
  override?: UsageOverrideRow;
}

/**
 * Set (or replace) a per-identity quota override. Validates the identity + dimension + non-negative
 * integer limit, then upserts on (lower(email), usage_type). Reflects immediately in resolveQuotaWindow
 * (and thus the consumption view) since that reads the override live.
 */
export async function upsertUsageOverride(
  pool: Pool,
  email: string,
  usageType: string,
  limit: unknown,
  note?: unknown,
): Promise<UpsertUsageOverrideResult> {
  const trimmedEmail = typeof email === 'string' ? email.trim() : '';
  if (!trimmedEmail) return { ok: false, reason: 'invalid' };
  if (!isQuotaDimension(usageType)) return { ok: false, reason: 'invalid' };
  const n = Number(limit);
  if (limit == null || limit === '' || !Number.isFinite(n) || n < 0) return { ok: false, reason: 'invalid' };
  const lim = Math.trunc(n);
  const cleanNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null;

  const { rows } = await pool.query(
    `INSERT INTO comm_usage_overrides (email, usage_type, limit_value, note)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (lower(email), usage_type)
     DO UPDATE SET limit_value = EXCLUDED.limit_value, note = EXCLUDED.note, updated_at = now()
     RETURNING email, usage_type, limit_value, note, created_at, updated_at`,
    [trimmedEmail, usageType, lim, cleanNote],
  );
  const r = rows[0];
  return {
    ok: true,
    override: {
      email: String(r.email),
      usage_type: r.usage_type as UsageType,
      limit_value: Number(r.limit_value),
      note: r.note != null ? String(r.note) : null,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    },
  };
}

export interface DeleteUsageOverrideResult {
  ok: boolean;
  reason?: 'invalid';
  deleted: boolean;
}

/** Clear a per-identity quota override (the identity falls back to their plan quota). */
export async function deleteUsageOverride(
  pool: Pool,
  email: string,
  usageType: string,
): Promise<DeleteUsageOverrideResult> {
  const trimmedEmail = typeof email === 'string' ? email.trim() : '';
  if (!trimmedEmail || !isQuotaDimension(usageType)) return { ok: false, reason: 'invalid', deleted: false };
  const res = await pool.query(
    `DELETE FROM comm_usage_overrides WHERE lower(email) = lower($1) AND usage_type = $2`,
    [trimmedEmail, usageType],
  );
  return { ok: true, deleted: (res.rowCount ?? 0) > 0 };
}

// ── Plan quota impact preview (super-admin) ──────────────────────────────────────────────────────
// Before an admin lowers a per-plan limit, they need to see WHO it affects: how many active
// identities are on the plan, and how many are already consuming MORE than the value they're about
// to set. This composer measures that live off the SAME substrate the meter enforces against
// (comm_subscriptions → comm_customers → comm_usage_events), honouring each dimension's counting kind
// (period_count vs level) and each subscription's current billing window — so the preview reconciles
// with what checkQuota / resolveQuotaWindow would decide. READ-ONLY, never throws, honest empties.
//
// used_values holds the CURRENT usage reading (numbers only — no emails/PII) for every active
// identity on the plan that has a NON-ZERO reading for that dimension. The frontend derives
// "N of M identities exceed the new value V" client-side as used_values.filter(u => u > V).length,
// so the count updates live as the admin types without a request per keystroke. Identities with a
// zero reading are omitted (they can never exceed a non-negative limit) but still counted in
// active_identities (the M denominator).

export interface PlanQuotaImpactRow {
  plan_id: string;
  active_subscriptions: number;                                   // active/trial subs on this plan
  active_identities: number;                                      // distinct emails among them
  usage: Partial<Record<UsageType, { measured_identities: number; used_values: number[] }>>;
}

export interface PlanQuotaImpactOverview {
  generated_at: string;
  degraded: boolean;
  dimensions: UsageType[];       // editable dimension order (mirrors listPlanQuotas)
  plans: PlanQuotaImpactRow[];
}

/**
 * Per-plan impact preview: active-subscription/identity counts and the current per-identity usage
 * distribution for each editable dimension. GET-never-writes: probes the substrate with to_regclass
 * and degrades to honest empties (never bootstraps schema). Never throws.
 */
export async function buildPlanQuotaImpact(pool: Pool): Promise<PlanQuotaImpactOverview> {
  const dimensions = [...QUOTA_DIMENSIONS];
  const generated_at = new Date().toISOString();

  const probe = await pool
    .query(`SELECT to_regclass('comm_subscriptions') AS subs, to_regclass('comm_customers') AS cust`)
    .catch(() => null);
  if (!probe || probe.rows[0]?.subs == null || probe.rows[0]?.cust == null) {
    // No subscription substrate → no identities to impact. Honest empty, not degraded.
    return { generated_at, degraded: false, dimensions, plans: [] };
  }

  let degraded = false;
  const fail = () => { degraded = true; };

  const rowByPlan = new Map<string, PlanQuotaImpactRow>();

  // Seed a row for EVERY plan in the catalog so the admin sees an honest count for each — including a
  // measured 0 (a plan with no active subscribers is real data, not fabricated). Only seed when the
  // catalog read succeeds; a failed read must degrade rather than invent 0s we didn't actually measure.
  const planRows = await pool
    .query(`SELECT id FROM comm_plans`)
    .then((r) => r.rows)
    .catch((e) => { console.error('[plan impact catalog]', e); fail(); return null as any[] | null; });
  if (planRows) {
    for (const r of planRows) {
      rowByPlan.set(String(r.id), {
        plan_id: String(r.id), active_subscriptions: 0, active_identities: 0, usage: {},
      });
    }
  }

  // Active/trial subscription + distinct-identity counts per plan (the M denominator).
  const countRows = await pool
    .query(
      `SELECT s.plan_id,
              COUNT(*)                         AS subs,
              COUNT(DISTINCT lower(c.email))   AS identities
         FROM comm_subscriptions s
         JOIN comm_customers c ON c.id = s.customer_id
        WHERE s.status IN ('active','trial')
          AND (s.current_period_end IS NULL OR s.current_period_end >= now())
        GROUP BY s.plan_id`,
    )
    .then((r) => r.rows)
    .catch((e) => { console.error('[plan impact counts]', e); fail(); return [] as any[]; });

  for (const r of countRows) {
    const id = String(r.plan_id);
    const existing = rowByPlan.get(id);
    if (existing) {
      existing.active_subscriptions = Number(r.subs ?? 0);
      existing.active_identities = Number(r.identities ?? 0);
    } else {
      // A subscription whose plan wasn't in the catalog read (or catalog read failed) — still honest.
      rowByPlan.set(id, {
        plan_id: id,
        active_subscriptions: Number(r.subs ?? 0),
        active_identities: Number(r.identities ?? 0),
        usage: {},
      });
    }
  }

  const usageProbe = await pool
    .query(`SELECT to_regclass('comm_usage_events') AS oid`)
    .catch(() => null);
  const hasUsage = usageProbe?.rows[0]?.oid != null;
  if (hasUsage && rowByPlan.size > 0) {
    const pcTypes = dimensions.filter((d) => usageTypeKind(d) === 'period_count') as string[];
    const levelTypes = dimensions.filter((d) => usageTypeKind(d) === 'level') as string[];

    // The set of active identities per plan + each identity's counting window (period_count uses the
    // subscription's current_period_start; a plan can carry several subs for one email → MIN window is
    // the most inclusive, matching the meter's "count since the period start" intent). Shared by both
    // the period_count and level aggregations below.
    const idsCte = `
      WITH ids AS (
        SELECT s.plan_id,
               lower(c.email) AS email,
               MIN(COALESCE(s.current_period_start, date_trunc('month', now()))) AS pstart
          FROM comm_subscriptions s
          JOIN comm_customers c ON c.id = s.customer_id
         WHERE s.status IN ('active','trial')
           AND (s.current_period_end IS NULL OR s.current_period_end >= now())
         GROUP BY s.plan_id, lower(c.email)
      )`;

    const pushUsage = (planId: string, dim: UsageType, used: number) => {
      const row = rowByPlan.get(planId);
      if (!row) return;
      let cell = row.usage[dim];
      if (!cell) { cell = { measured_identities: 0, used_values: [] }; row.usage[dim] = cell; }
      // Omit zero readings — they can never exceed a non-negative limit — but keep the honest count.
      if (used > 0) { cell.measured_identities += 1; cell.used_values.push(used); }
    };

    if (pcTypes.length) {
      // PERIOD_COUNT: SUM(quantity) since each identity's window start (INNER JOIN → only identities
      // with activity; zero-usage identities never exceed and are covered by active_identities).
      await pool
        .query(
          `${idsCte}
           SELECT i.plan_id, u.usage_type, COALESCE(SUM(u.quantity), 0) AS used
             FROM ids i
             JOIN comm_usage_events u
               ON lower(u.email) = i.email
              AND u.usage_type = ANY($1)
              AND u.occurred_at >= i.pstart
            GROUP BY i.plan_id, u.usage_type, i.email`,
          [pcTypes],
        )
        .then((r) => { for (const row of r.rows) pushUsage(String(row.plan_id), String(row.usage_type) as UsageType, Number(row.used ?? 0)); })
        .catch((e) => { console.error('[plan impact period_count]', e); fail(); });
    }

    if (levelTypes.length) {
      // LEVEL (storage): the current reading is the LATEST value per identity (a gauge), NOT a sum —
      // mirrors countUsage's level branch. Period window is irrelevant for a gauge.
      await pool
        .query(
          `${idsCte},
           latest AS (
             SELECT DISTINCT ON (lower(email), usage_type)
                    lower(email) AS email, usage_type, quantity
               FROM comm_usage_events
              WHERE usage_type = ANY($1)
              ORDER BY lower(email), usage_type, occurred_at DESC, created_at DESC
           )
           SELECT i.plan_id, l.usage_type, l.quantity AS used
             FROM ids i
             JOIN latest l ON l.email = i.email
            GROUP BY i.plan_id, l.usage_type, i.email, l.quantity`,
          [levelTypes],
        )
        .then((r) => { for (const row of r.rows) pushUsage(String(row.plan_id), String(row.usage_type) as UsageType, Number(row.used ?? 0)); })
        .catch((e) => { console.error('[plan impact level]', e); fail(); });
    }
  }

  return { generated_at, degraded, dimensions, plans: [...rowByPlan.values()] };
}

export { isUsageType };
