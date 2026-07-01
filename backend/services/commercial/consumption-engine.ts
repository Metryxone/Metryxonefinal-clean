/**
 * Phase 6.5 — Usage Metering · Consumption engine (READ-ONLY).
 *
 * Composes the append-only usage ledger (comm_usage_events) + credit ledger (comm_credit_ledger) into:
 *   - a per-identity consumption view (used / limit / remaining per dimension + credit balance), and
 *   - a system-wide admin overview broken down by the eight business dimensions.
 *
 * GET-NEVER-WRITES: this engine NEVER creates schema. It probes table existence with to_regclass and
 * degrades to honest empties when the substrate is absent or a read fails — it never bootstraps DDL on a
 * read path. Counts are derived live from the ledgers (never pre-aggregated), and we never fabricate:
 * "no substrate" / "no customer" / "no declared quota" are distinct honest states, not silent zeros.
 */
import type { Pool } from 'pg';
import {
  BUSINESS_DIMENSIONS, dimensionKind, type BusinessDimension, type DimensionKind, type UsageType,
} from './plan-features';
import { checkQuota, checkCreditDimension } from './metering-engine';

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(`SELECT to_regclass($1) AS oid`, [name]);
    return rows[0]?.oid != null;
  } catch {
    return false;
  }
}

export interface DimensionConsumption {
  dimension: BusinessDimension;
  kind: DimensionKind;
  used: number | null;        // period count / current level / null when not applicable
  limit: number | null;       // declared quota; null = unmetered (no declared quota)
  remaining: number | null;   // null when unmetered / not applicable
  balance: number | null;     // credit balance (credits dimension only); null otherwise
  reason: string;             // honest state (within_quota | no_declared_quota | no_substrate | …)
}

export interface IdentityConsumption {
  email: string;
  generated_at: string;
  degraded: boolean;          // true when any dimension read failed
  dimensions: DimensionConsumption[];
}

/** Per-identity consumption across all eight business dimensions for the current period. Never throws. */
export async function buildIdentityConsumption(pool: Pool, email: string): Promise<IdentityConsumption> {
  let degraded = false;
  const hasUsage = await tableExists(pool, 'comm_usage_events');
  const hasCredit = (await tableExists(pool, 'comm_credit_ledger')) && (await tableExists(pool, 'comm_customers'));
  const dimensions: DimensionConsumption[] = [];

  for (const dimension of BUSINESS_DIMENSIONS) {
    const kind = dimensionKind(dimension);
    try {
      if (dimension === 'credits') {
        if (!hasCredit) {
          dimensions.push({ dimension, kind, used: null, limit: null, remaining: null, balance: 0, reason: 'no_substrate' });
          continue;
        }
        const c = await checkCreditDimension(pool, email);
        dimensions.push({ dimension, kind, used: null, limit: null, remaining: null, balance: c.balance, reason: c.reason });
        continue;
      }

      if (!hasUsage) {
        dimensions.push({ dimension, kind, used: 0, limit: null, remaining: null, balance: null, reason: 'no_substrate' });
        continue;
      }
      const q = await checkQuota(pool, email, dimension as UsageType);
      dimensions.push({ dimension, kind, used: q.used, limit: q.limit, remaining: q.remaining, balance: null, reason: q.reason });
    } catch (err) {
      console.error('[consumption identity]', dimension, err);
      degraded = true;
      dimensions.push({ dimension, kind, used: null, limit: null, remaining: null, balance: dimension === 'credits' ? 0 : null, reason: 'degraded' });
    }
  }

  return { email, generated_at: new Date().toISOString(), degraded, dimensions };
}

export interface DimensionOverviewRow {
  dimension: BusinessDimension;
  kind: DimensionKind;
  events: number;             // ledger rows (usage dims); credit ledger entries (credits)
  quantity: number;           // SUM(quantity) usage dims; net balance across customers (credits)
  identities: number;         // distinct emails (usage dims); distinct customers w/ balance (credits)
}

export interface DimensionOverview {
  generated_at: string;
  degraded: boolean;
  by_dimension: DimensionOverviewRow[];
}

/** System-wide consumption overview by business dimension (admin). Read-only; honest zeros when empty. */
export async function buildDimensionOverview(pool: Pool): Promise<DimensionOverview> {
  let degraded = false;
  const fail = () => { degraded = true; };

  const usageRows = (await tableExists(pool, 'comm_usage_events'))
    ? await pool
        .query(
          `SELECT usage_type,
                  COUNT(*) AS events,
                  COALESCE(SUM(quantity), 0) AS quantity,
                  COUNT(DISTINCT lower(email)) AS identities
             FROM comm_usage_events
            GROUP BY usage_type`,
        )
        .then((r) => r.rows)
        .catch(() => { fail(); return [] as any[]; })
    : [];
  const usageByType = new Map<string, any>(usageRows.map((r) => [String(r.usage_type), r]));

  // LEVEL dimensions (e.g. storage) are gauges: the meaningful system-wide quantity is the CURRENT
  // total = SUM of the LATEST reading per identity, NOT a SUM of every historical reading (which would
  // overcount). Compute it separately and override the period_count SUM for those dimensions.
  const levelTypes = BUSINESS_DIMENSIONS.filter(
    (d) => d !== 'credits' && dimensionKind(d) === 'level',
  ) as unknown as string[];
  const levelQuantity = new Map<string, number>();
  if (levelTypes.length && (await tableExists(pool, 'comm_usage_events'))) {
    await pool
      .query(
        `SELECT usage_type, COALESCE(SUM(latest_qty), 0) AS quantity
           FROM (
             SELECT DISTINCT ON (lower(email), usage_type) usage_type, quantity AS latest_qty
               FROM comm_usage_events
              WHERE usage_type = ANY($1)
              ORDER BY lower(email), usage_type, occurred_at DESC, created_at DESC
           ) t
          GROUP BY usage_type`,
        [levelTypes],
      )
      .then((r) => { for (const row of r.rows) levelQuantity.set(String(row.usage_type), Number(row.quantity ?? 0)); })
      .catch(() => { fail(); });
  }

  let creditAgg = { entries: 0, balance: 0, customers: 0 };
  if ((await tableExists(pool, 'comm_credit_ledger'))) {
    creditAgg = await pool
      .query(
        `SELECT COUNT(*) AS entries,
                COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount_paise ELSE -amount_paise END), 0) AS balance,
                COUNT(DISTINCT customer_id) AS customers
           FROM comm_credit_ledger`,
      )
      .then((r) => ({
        entries: Number(r.rows[0]?.entries ?? 0),
        balance: Number(r.rows[0]?.balance ?? 0),
        customers: Number(r.rows[0]?.customers ?? 0),
      }))
      .catch(() => { fail(); return { entries: 0, balance: 0, customers: 0 }; });
  }

  const by_dimension: DimensionOverviewRow[] = BUSINESS_DIMENSIONS.map((dimension) => {
    const kind = dimensionKind(dimension);
    if (dimension === 'credits') {
      return { dimension, kind, events: creditAgg.entries, quantity: creditAgg.balance, identities: creditAgg.customers };
    }
    const r = usageByType.get(dimension);
    return {
      dimension,
      kind,
      events: Number(r?.events ?? 0),
      // Period-count: SUM(quantity). Level (storage): current total = SUM of latest-per-identity.
      quantity: kind === 'level' ? (levelQuantity.get(dimension as unknown as string) ?? 0) : Number(r?.quantity ?? 0),
      identities: Number(r?.identities ?? 0),
    };
  });

  return { generated_at: new Date().toISOString(), degraded, by_dimension };
}

// ── Time-series trend (Task #21) ─────────────────────────────────────────────────────────────────
// The overview above answers "where do we stand NOW"; the trend answers "how is consumption MOVING".
// Both read the SAME append-only ledgers (comm_usage_events + comm_credit_ledger) — never a second,
// pre-aggregated store — so the trend is always reconcilable with the current totals. We bucket by
// calendar week or month via date_trunc, and align every dimension to the SAME set of bucket starts
// (generated in-DB so the boundaries match the GROUP BY keys exactly).
//
// HONESTY: when a substrate table is absent the series is EMPTY and `substrate:false` — never a row of
// fabricated zeros. When the substrate EXISTS but a bucket had no activity, that bucket is a real 0
// (distinguishable from no_substrate). Level dimensions (storage) are gauges: per bucket we take the
// LATEST reading per identity and sum them (mirrors the overview's current-total semantics), never a
// running SUM which would overcount.

export type TrendGranularity = 'week' | 'month';

export interface TrendPoint {
  period: string;   // ISO timestamp of the bucket start (date_trunc-aligned)
  events: number;   // ledger rows in the bucket (distinct identities for level dims / debit entries for credits)
  quantity: number; // SUM(quantity) period-count · latest-per-identity total (level) · paise SPENT (credits)
}

export interface DimensionTrend {
  dimension: BusinessDimension;
  kind: DimensionKind;
  substrate: boolean;      // false → the backing ledger table is absent (series is honestly empty)
  series: TrendPoint[];    // aligned to `periods`, oldest→newest (empty when substrate is false)
}

export interface UsageTrend {
  generated_at: string;
  degraded: boolean;
  granularity: TrendGranularity;
  periods: string[];       // bucket starts (ISO), oldest→newest — shared x-axis for every dimension
  by_dimension: DimensionTrend[];
}

const TREND_DEFAULT_PERIODS: Record<TrendGranularity, number> = { week: 8, month: 6 };
const TREND_MAX_PERIODS = 52;

/**
 * System-wide consumption TREND per business dimension over the last N calendar weeks/months.
 * Read-only; never throws; honest empty when the substrate is absent.
 */
export async function buildUsageTrend(
  pool: Pool,
  opts?: { granularity?: string; periods?: unknown },
): Promise<UsageTrend> {
  const granularity: TrendGranularity = opts?.granularity === 'month' ? 'month' : 'week';
  const rawN = Number(opts?.periods);
  const n = Number.isFinite(rawN)
    ? Math.min(TREND_MAX_PERIODS, Math.max(1, Math.trunc(rawN)))
    : TREND_DEFAULT_PERIODS[granularity];
  const interval = granularity === 'week' ? '1 week' : '1 month';

  let degraded = false;
  const fail = () => { degraded = true; };

  const hasUsage = await tableExists(pool, 'comm_usage_events');
  // Trends read ONLY the append-only comm_credit_ledger (debit spend per bucket) — unlike the
  // per-identity overview, they do NOT join comm_customers, so the substrate gate must not require it
  // (a present ledger with no comm_customers table is still usable trend substrate).
  const hasCredit = await tableExists(pool, 'comm_credit_ledger');

  // Build the aligned bucket list in-DB via generate_series so the boundaries are IDENTICAL to the
  // date_trunc GROUP BY keys used by the aggregations below.
  let bucketDates: Date[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT g AS period
         FROM generate_series(
                date_trunc($1, now()) - (($2::int - 1) * $3::interval),
                date_trunc($1, now()),
                $3::interval
              ) g
        ORDER BY g`,
      [granularity, n, interval],
    );
    bucketDates = rows.map((r) => new Date(r.period));
  } catch (err) {
    console.error('[trend buckets]', err);
    fail();
  }
  const periods = bucketDates.map((d) => d.toISOString());
  const windowStart = bucketDates.length ? bucketDates[0] : null;

  const pcTypes = BUSINESS_DIMENSIONS.filter(
    (d) => d !== 'credits' && dimensionKind(d) === 'period_count',
  ) as unknown as string[];
  const levelTypes = BUSINESS_DIMENSIONS.filter(
    (d) => d !== 'credits' && dimensionKind(d) === 'level',
  ) as unknown as string[];

  // usage_type → (bucket ISO → point). Only populated when the usage ledger exists.
  const usageByType = new Map<string, Map<string, TrendPoint>>();
  const putUsage = (rows: any[]) => {
    for (const r of rows) {
      const type = String(r.usage_type);
      const iso = new Date(r.period).toISOString();
      let m = usageByType.get(type);
      if (!m) { m = new Map(); usageByType.set(type, m); }
      m.set(iso, { period: iso, events: Number(r.events ?? 0), quantity: Number(r.quantity ?? 0) });
    }
  };

  if (hasUsage && windowStart && pcTypes.length) {
    await pool
      .query(
        `SELECT usage_type,
                date_trunc($1, occurred_at) AS period,
                COUNT(*) AS events,
                COALESCE(SUM(quantity), 0) AS quantity
           FROM comm_usage_events
          WHERE usage_type = ANY($2) AND occurred_at >= $3 AND occurred_at <= now()
          GROUP BY usage_type, period`,
        [granularity, pcTypes, windowStart],
      )
      .then((r) => putUsage(r.rows))
      .catch((err) => { console.error('[trend period_count]', err); fail(); });
  }

  if (hasUsage && windowStart && levelTypes.length) {
    // Gauge dimensions: per bucket, the LATEST reading per identity, summed (never a running total).
    await pool
      .query(
        `SELECT usage_type, period,
                COUNT(*) AS events,
                COALESCE(SUM(latest_qty), 0) AS quantity
           FROM (
             SELECT DISTINCT ON (lower(email), usage_type, date_trunc($1, occurred_at))
                    usage_type,
                    date_trunc($1, occurred_at) AS period,
                    quantity AS latest_qty
               FROM comm_usage_events
              WHERE usage_type = ANY($2) AND occurred_at >= $3 AND occurred_at <= now()
              ORDER BY lower(email), usage_type, date_trunc($1, occurred_at),
                       occurred_at DESC, created_at DESC
           ) t
          GROUP BY usage_type, period`,
        [granularity, levelTypes, windowStart],
      )
      .then((r) => putUsage(r.rows))
      .catch((err) => { console.error('[trend level]', err); fail(); });
  }

  // Credits: paise SPENT (debit entries) per bucket from the append-only credit ledger.
  // We chart consumption (credits used), NOT net balance movement — a period's top-ups
  // must not mask the spend in that same period. events = debit entries in the bucket.
  const creditByBucket = new Map<string, TrendPoint>();
  if (hasCredit && windowStart) {
    await pool
      .query(
        `SELECT date_trunc($1, created_at) AS period,
                COUNT(*) FILTER (WHERE entry_type='debit') AS events,
                COALESCE(SUM(amount_paise) FILTER (WHERE entry_type='debit'), 0) AS quantity
           FROM comm_credit_ledger
          WHERE created_at >= $2 AND created_at <= now()
          GROUP BY period`,
        [granularity, windowStart],
      )
      .then((r) => {
        for (const row of r.rows) {
          const iso = new Date(row.period).toISOString();
          creditByBucket.set(iso, { period: iso, events: Number(row.events ?? 0), quantity: Number(row.quantity ?? 0) });
        }
      })
      .catch((err) => { console.error('[trend credits]', err); fail(); });
  }

  const by_dimension: DimensionTrend[] = BUSINESS_DIMENSIONS.map((dimension) => {
    const kind = dimensionKind(dimension);
    const substrate = dimension === 'credits' ? hasCredit : hasUsage;
    if (!substrate) return { dimension, kind, substrate: false, series: [] };

    const bucketMap = dimension === 'credits'
      ? creditByBucket
      : (usageByType.get(dimension as unknown as string) ?? new Map<string, TrendPoint>());

    // Fill EVERY bucket: a bucket the ledger never touched is a real 0 (substrate exists), NOT fabricated.
    const series = periods.map((iso) => bucketMap.get(iso) ?? { period: iso, events: 0, quantity: 0 });
    return { dimension, kind, substrate: true, series };
  });

  return {
    generated_at: new Date().toISOString(),
    degraded,
    granularity,
    periods,
    by_dimension,
  };
}
