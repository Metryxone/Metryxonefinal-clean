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
