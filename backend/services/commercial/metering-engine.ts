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
import { parsePlanFeatures, isUsageType, type UsageType } from './plan-features';

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
async function resolveQuotaWindow(pool: Pool, email: string, usageType: UsageType): Promise<ActiveQuotaWindow> {
  const { rows } = await pool.query(
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

/** Count usage events for an identity + type within a period window (calendar month when no window). */
async function countUsage(
  pool: Pool,
  email: string,
  usageType: UsageType,
  periodStart: Date | null,
): Promise<number> {
  const start = periodStart ?? null;
  const { rows } = await pool.query(
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
export async function checkQuota(pool: Pool, email: string, usageType: UsageType): Promise<QuotaState> {
  const win = await resolveQuotaWindow(pool, email, usageType);
  const used = await countUsage(pool, email, usageType, win.period_start);

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
  const pre = await checkQuota(pool, input.email, input.usageType);

  // Over a declared quota → refuse (do not write). Unmetered (limit null) is always allowed.
  if (!pre.allowed) {
    return { recorded: false, quota: pre };
  }

  const { rows } = await pool.query(
    `INSERT INTO comm_usage_events (email, subscription_id, usage_type, quantity, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, usage_type, quantity, occurred_at`,
    [input.email, input.subscriptionId ?? null, input.usageType, quantity, input.metadata ?? null],
  );

  const post = await checkQuota(pool, input.email, input.usageType);
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

export { isUsageType };
