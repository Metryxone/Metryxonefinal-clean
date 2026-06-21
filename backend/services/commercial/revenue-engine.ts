/**
 * Phase 6.6 — Revenue Intelligence · revenue analytics engine (READ-ONLY).
 *
 * COMPOSES (never recomputes) the existing recurring-revenue engine
 * (services/wc7c/revenue-intelligence.ts `buildRecurringRevenue` → MRR / ARR / collections /
 * renewals / forecast) and ADDS the revenue-by-dimension breakdowns required by Phase 6.6:
 *   • by Product   (recurring comm_products + one-time capadex stages, tagged by source)
 *   • by Customer  (union of recurring + one-time spend per email, top 25)
 *   • by Segment   (career_builder / employer / institution / enterprise / government)
 *   • by Institution / by Employer  (segment-scoped customer breakdowns)
 *   • by Geography (inv_invoices.buyer_state_code GST proxy + invoiced-coverage %)
 *
 * GET-NEVER-WRITES: this engine NEVER creates schema. It probes table existence with to_regclass
 * and degrades to honest empties when the substrate is absent or a read fails — it never bootstraps
 * DDL on a read path. Every figure describes REAL recorded rows (measurement, not estimation). We
 * never fabricate: "no_substrate" (table absent) and an empty result over a present table (honest
 * zero) are DISTINCT states, surfaced via the `substrate` flags + `notes`.
 *
 * All money is INR paise in the ledgers; surfaced as integer rupees (paise / 100, rounded).
 */
import type { Pool } from 'pg';
import { buildRecurringRevenue, type RecurringRevenue } from '../wc7c/revenue-intelligence';

const paise2rupees = (p: unknown) => Math.round(Number(p ?? 0) / 100);

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(`SELECT to_regclass($1) AS oid`, [name]);
    return rows[0]?.oid != null;
  } catch {
    return false;
  }
}

export interface RevenueByProduct {
  source: 'subscription' | 'capadex_stage';
  product_code: string;
  product_name: string;
  segment: string | null;
  payments: number;
  rupees: number;
}
export interface RevenueByCustomer {
  email: string;
  name: string | null;
  segment: string | null;
  payments: number;
  rupees: number;
}
export interface RevenueBySegment {
  segment: string;
  customers: number;
  payments: number;
  rupees: number;
}
export interface RevenueByOrg {
  email: string;
  name: string | null;
  payments: number;
  rupees: number;
}
export interface RevenueByGeography {
  state_code: string;
  invoices: number;
  rupees: number;
}

export interface RevenueAnalytics {
  generated_at: string;
  degraded: boolean;
  substrate: {
    capadex_payments: boolean;
    comm_subscription_events: boolean;
    comm_subscriptions: boolean;
    comm_products: boolean;
    comm_customers: boolean;
    inv_invoices: boolean;
  };
  /** Composed from buildRecurringRevenue — NOT recomputed here. */
  recurring: {
    mrr_rupees: number;
    arr_rupees: number;
    active_subscriptions: number;
    by_interval: RecurringRevenue['mrr']['by_interval'];
    renewals: RecurringRevenue['renewals'];
    forecast: RecurringRevenue['forecast'];
  };
  totals: {
    recurring_collections_rupees: number;
    onetime_rupees: number;
    total_rupees: number;
  };
  by_product: RevenueByProduct[];
  by_customer: RevenueByCustomer[];
  by_segment: RevenueBySegment[];
  by_institution: RevenueByOrg[];
  by_employer: RevenueByOrg[];
  by_geography: {
    rows: RevenueByGeography[];
    invoiced_rupees: number;
    coverage_pct: number; // invoiced revenue / total collected revenue (geography is invoice-derived)
  };
  notes: string[];
}

const RECURRING_EVENT_FILTER = `event_type IN ('payment_succeeded','renewed') AND amount_paise IS NOT NULL`;

/** Phase 6.6 composite revenue analytics. Read-only, never throws, never fabricates. */
export async function buildRevenueAnalytics(pool: Pool): Promise<RevenueAnalytics> {
  let degraded = false;
  const fail = () => { degraded = true; };
  const notes: string[] = [];

  const substrate = {
    capadex_payments: await tableExists(pool, 'capadex_payments'),
    comm_subscription_events: await tableExists(pool, 'comm_subscription_events'),
    comm_subscriptions: await tableExists(pool, 'comm_subscriptions'),
    comm_products: await tableExists(pool, 'comm_products'),
    comm_customers: await tableExists(pool, 'comm_customers'),
    inv_invoices: await tableExists(pool, 'inv_invoices'),
  };

  const hasRecurringEvents = substrate.comm_subscription_events;
  const hasSubs = substrate.comm_subscriptions;
  const hasCustomers = substrate.comm_customers;

  // ── Recurring summary (MRR/ARR/collections/renewals/forecast) — COMPOSED, not recomputed ───────
  const recurring = await buildRecurringRevenue(pool).catch(() => { fail(); return null; });
  if (recurring?.degraded) degraded = true;

  // ── Revenue by PRODUCT ─────────────────────────────────────────────────────────────────────────
  const by_product: RevenueByProduct[] = [];
  if (hasRecurringEvents && hasSubs && substrate.comm_products) {
    const rows = await pool
      .query(
        `SELECT pr.code AS product_code, pr.name AS product_name, pr.segment AS segment,
                COUNT(*) AS payments,
                COALESCE(SUM(e.amount_paise), 0) AS paise
           FROM comm_subscription_events e
           JOIN comm_subscriptions s ON s.id = e.subscription_id
           JOIN comm_plans p        ON p.id = s.plan_id
           JOIN comm_products pr     ON pr.id = p.product_id
          WHERE ${RECURRING_EVENT_FILTER}
          GROUP BY pr.code, pr.name, pr.segment`,
      )
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    for (const r of rows) {
      by_product.push({
        source: 'subscription',
        product_code: String(r.product_code ?? 'unknown'),
        product_name: String(r.product_name ?? 'Unknown'),
        segment: r.segment != null ? String(r.segment) : null,
        payments: Number(r.payments ?? 0),
        rupees: paise2rupees(r.paise),
      });
    }
  }
  if (substrate.capadex_payments) {
    const rows = await pool
      .query(
        `SELECT stage_code AS product_code, stage_name AS product_name,
                COUNT(*) FILTER (WHERE status='paid') AS payments,
                COALESCE(SUM(amount_paise) FILTER (WHERE status='paid'), 0) AS paise
           FROM capadex_payments
          GROUP BY stage_code, stage_name`,
      )
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    for (const r of rows) {
      const payments = Number(r.payments ?? 0);
      const rupees = paise2rupees(r.paise);
      if (payments === 0 && rupees === 0) continue; // only realised revenue
      by_product.push({
        source: 'capadex_stage',
        product_code: String(r.product_code ?? 'unknown'),
        product_name: String(r.product_name ?? 'Unknown'),
        segment: 'career_builder', // capadex one-time ladder is B2C
        payments,
        rupees,
      });
    }
  }
  by_product.sort((a, b) => b.rupees - a.rupees);

  // ── Revenue by CUSTOMER (union recurring + one-time, keyed by lower(email)) ─────────────────────
  const customerAgg = new Map<string, RevenueByCustomer>();
  const bumpCustomer = (email: string, name: string | null, segment: string | null, payments: number, rupees: number) => {
    const key = email.toLowerCase();
    const cur = customerAgg.get(key) ?? { email, name, segment, payments: 0, rupees: 0 };
    cur.payments += payments;
    cur.rupees += rupees;
    if (cur.name == null && name != null) cur.name = name;
    if (cur.segment == null && segment != null) cur.segment = segment;
    customerAgg.set(key, cur);
  };
  if (hasRecurringEvents && hasCustomers) {
    const rows = await pool
      .query(
        `SELECT c.email, c.name, c.segment,
                COUNT(*) AS payments,
                COALESCE(SUM(e.amount_paise), 0) AS paise
           FROM comm_subscription_events e
           JOIN comm_customers c ON c.id = e.customer_id
          WHERE ${RECURRING_EVENT_FILTER}
          GROUP BY c.email, c.name, c.segment`,
      )
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    for (const r of rows) {
      if (!r.email) continue;
      bumpCustomer(String(r.email), r.name != null ? String(r.name) : null, r.segment != null ? String(r.segment) : null, Number(r.payments ?? 0), paise2rupees(r.paise));
    }
  }
  if (substrate.capadex_payments) {
    const rows = await pool
      .query(
        `SELECT email,
                COUNT(*) FILTER (WHERE status='paid') AS payments,
                COALESCE(SUM(amount_paise) FILTER (WHERE status='paid'), 0) AS paise
           FROM capadex_payments WHERE email IS NOT NULL
          GROUP BY email`,
      )
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    for (const r of rows) {
      const payments = Number(r.payments ?? 0);
      const rupees = paise2rupees(r.paise);
      if (payments === 0 && rupees === 0) continue;
      bumpCustomer(String(r.email), null, 'career_builder', payments, rupees);
    }
  }
  const by_customer = Array.from(customerAgg.values())
    .filter((c) => c.rupees > 0 || c.payments > 0)
    .sort((a, b) => b.rupees - a.rupees)
    .slice(0, 25);

  // ── Revenue by SEGMENT + by INSTITUTION / EMPLOYER (recurring only; segment lives on the sub) ───
  const by_segment: RevenueBySegment[] = [];
  const by_institution: RevenueByOrg[] = [];
  const by_employer: RevenueByOrg[] = [];
  if (hasRecurringEvents && hasSubs && hasCustomers) {
    const segRows = await pool
      .query(
        `SELECT s.segment AS segment,
                COUNT(DISTINCT e.customer_id) AS customers,
                COUNT(*) AS payments,
                COALESCE(SUM(e.amount_paise), 0) AS paise
           FROM comm_subscription_events e
           JOIN comm_subscriptions s ON s.id = e.subscription_id
          WHERE ${RECURRING_EVENT_FILTER}
          GROUP BY s.segment`,
      )
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    for (const r of segRows) {
      by_segment.push({
        segment: String(r.segment ?? 'unknown'),
        customers: Number(r.customers ?? 0),
        payments: Number(r.payments ?? 0),
        rupees: paise2rupees(r.paise),
      });
    }
    by_segment.sort((a, b) => b.rupees - a.rupees);

    const orgRows = await pool
      .query(
        `SELECT s.segment AS segment, c.email, c.name,
                COUNT(*) AS payments,
                COALESCE(SUM(e.amount_paise), 0) AS paise
           FROM comm_subscription_events e
           JOIN comm_subscriptions s ON s.id = e.subscription_id
           JOIN comm_customers c     ON c.id = e.customer_id
          WHERE ${RECURRING_EVENT_FILTER}
            AND s.segment IN ('institution','employer')
          GROUP BY s.segment, c.email, c.name`,
      )
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    for (const r of orgRows) {
      const dest = String(r.segment) === 'institution' ? by_institution : by_employer;
      dest.push({
        email: String(r.email ?? 'unknown'),
        name: r.name != null ? String(r.name) : null,
        payments: Number(r.payments ?? 0),
        rupees: paise2rupees(r.paise),
      });
    }
    by_institution.sort((a, b) => b.rupees - a.rupees);
    by_employer.sort((a, b) => b.rupees - a.rupees);
  }

  // ── Revenue by GEOGRAPHY (GST invoice state proxy) ─────────────────────────────────────────────
  let geoRows: RevenueByGeography[] = [];
  let invoicedPaise = 0;
  if (substrate.inv_invoices) {
    const rows = await pool
      .query(
        `SELECT COALESCE(NULLIF(buyer_state_code, ''), NULLIF(place_of_supply, ''), 'undeclared') AS state_code,
                COUNT(*) AS invoices,
                COALESCE(SUM(total_paise), 0) AS paise
           FROM inv_invoices
          WHERE status <> 'cancelled'
            AND doc_type IN ('tax','payment_receipt')
            AND source_type IN ('capadex_payment','comm_subscription')
          GROUP BY 1`,
      )
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    for (const r of rows) {
      const rupees = paise2rupees(r.paise);
      invoicedPaise += Number(r.paise ?? 0);
      geoRows.push({ state_code: String(r.state_code), invoices: Number(r.invoices ?? 0), rupees });
    }
    geoRows.sort((a, b) => b.rupees - a.rupees);
  } else {
    notes.push('Geography is derived from GST invoices (inv_invoices.buyer_state_code); no invoice substrate present.');
  }

  // ── Totals (from the composed recurring engine; honest zeros when empty) ────────────────────────
  const recurringCollections = recurring?.collections.subscription_rupees ?? 0;
  const onetime = recurring?.collections.onetime_rupees ?? 0;
  const totalCollected = recurringCollections + onetime;
  const coverage_pct = totalCollected > 0
    ? Math.round((paise2rupees(invoicedPaise) / totalCollected) * 1000) / 10
    : 0;

  if (!substrate.comm_subscription_events && !substrate.capadex_payments) {
    notes.push('No revenue substrate present (neither comm_subscription_events nor capadex_payments).');
  }
  if (by_product.length === 0 && (substrate.comm_subscription_events || substrate.capadex_payments)) {
    notes.push('Revenue substrate present but no realised payments yet — honest zero, not fabricated.');
  }

  return {
    generated_at: new Date().toISOString(),
    degraded,
    substrate,
    recurring: {
      mrr_rupees: recurring?.mrr.rupees ?? 0,
      arr_rupees: recurring?.arr.rupees ?? 0,
      active_subscriptions: recurring?.mrr.active_subscriptions ?? 0,
      by_interval: recurring?.mrr.by_interval ?? [],
      renewals: recurring?.renewals ?? { window_days: 30, due_soon: 0, in_grace: 0, churning: 0 },
      forecast: recurring?.forecast ?? { forecastable: false, reason: 'insufficient_periods', detail: 'No recurring substrate.' },
    },
    totals: {
      recurring_collections_rupees: recurringCollections,
      onetime_rupees: onetime,
      total_rupees: totalCollected,
    },
    by_product,
    by_customer,
    by_segment,
    by_institution,
    by_employer,
    by_geography: {
      rows: geoRows,
      invoiced_rupees: paise2rupees(invoicedPaise),
      coverage_pct,
    },
    notes,
  };
}
