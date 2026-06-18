/**
 * CAPADEX WC-7C Wave 0 — Revenue Intelligence.
 *
 * READ-ONLY · NEVER-THROWS · NO NEW TABLES. Composes per-stage / per-concern conversion +
 * revenue attribution from the LIVE Razorpay ledger (`capadex_payments`) and conversion
 * telemetry (`capadex_audit_events` 'payment_completed'). Every figure here describes REAL
 * recorded payments — this is measurement, not estimation. Each query degrades to zero/empty
 * on error and sets `degraded:true`.
 */
import type { Pool } from 'pg';

export interface RevenueByKey { key: string; paid: number; rupees: number; }

export interface RevenueIntelligence {
  generated_at: string;
  degraded: boolean;
  overall: { total: number; paid: number; pending: number; failed: number; rupees: number };
  by_stage: RevenueByKey[];
  by_concern: RevenueByKey[];
  attribution: { paid_with_session: number; paid_total: number; coverage_pct: number };
  conversions: { payment_completed_events: number };
  funnel: { sessions: number; paid: number; rupees: number };
}

const paise2rupees = (p: unknown) => Math.round(Number(p ?? 0) / 100);

export async function buildRevenueIntelligence(pool: Pool): Promise<RevenueIntelligence> {
  let degraded = false;
  const fail = () => { degraded = true; };

  const overall = await pool
    .query(
      `SELECT COUNT(*) total,
              COUNT(*) FILTER (WHERE status='paid')    paid,
              COUNT(*) FILTER (WHERE status='pending') pending,
              COUNT(*) FILTER (WHERE status='failed')  failed,
              COALESCE(SUM(amount_paise) FILTER (WHERE status='paid'),0) paise
         FROM capadex_payments`,
    )
    .then((r) => r.rows[0])
    .catch(() => { fail(); return null; });

  const byStage = await pool
    .query(
      `SELECT stage_code key,
              COUNT(*) FILTER (WHERE status='paid') paid,
              COALESCE(SUM(amount_paise) FILTER (WHERE status='paid'),0) paise
         FROM capadex_payments GROUP BY stage_code ORDER BY paise DESC`,
    )
    .then((r) => r.rows)
    .catch(() => { fail(); return [] as any[]; });

  const byConcern = await pool
    .query(
      `SELECT concern_name key,
              COUNT(*) FILTER (WHERE status='paid') paid,
              COALESCE(SUM(amount_paise) FILTER (WHERE status='paid'),0) paise
         FROM capadex_payments WHERE concern_name IS NOT NULL
        GROUP BY concern_name ORDER BY paise DESC LIMIT 25`,
    )
    .then((r) => r.rows)
    .catch(() => { fail(); return [] as any[]; });

  const attr = await pool
    .query(
      `SELECT COUNT(*) FILTER (WHERE status='paid') paid_total,
              COUNT(*) FILTER (WHERE status='paid' AND session_id IS NOT NULL) paid_with_session
         FROM capadex_payments`,
    )
    .then((r) => r.rows[0])
    .catch(() => { fail(); return null; });

  const conv = await pool
    .query(`SELECT COUNT(*) c FROM capadex_audit_events WHERE event_type='payment_completed'`)
    .then((r) => Number(r.rows[0]?.c ?? 0))
    .catch(() => { fail(); return 0; });

  const sessions = await pool
    .query(`SELECT COUNT(*) c FROM capadex_sessions`)
    .then((r) => Number(r.rows[0]?.c ?? 0))
    .catch(() => { fail(); return 0; });

  const paidTotal = Number(attr?.paid_total ?? 0);
  const paidWithSession = Number(attr?.paid_with_session ?? 0);
  const rupees = paise2rupees(overall?.paise);
  const paid = Number(overall?.paid ?? 0);

  return {
    generated_at: new Date().toISOString(),
    degraded,
    overall: {
      total: Number(overall?.total ?? 0),
      paid,
      pending: Number(overall?.pending ?? 0),
      failed: Number(overall?.failed ?? 0),
      rupees,
    },
    by_stage: byStage.map((r) => ({ key: String(r.key ?? 'unknown'), paid: Number(r.paid ?? 0), rupees: paise2rupees(r.paise) })),
    by_concern: byConcern.map((r) => ({ key: String(r.key ?? 'unknown'), paid: Number(r.paid ?? 0), rupees: paise2rupees(r.paise) })),
    attribution: {
      paid_with_session: paidWithSession,
      paid_total: paidTotal,
      coverage_pct: paidTotal > 0 ? Math.round((paidWithSession / paidTotal) * 1000) / 10 : 0,
    },
    conversions: { payment_completed_events: conv },
    funnel: { sessions, paid, rupees },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Task #7 — Recurring Revenue Intelligence (MRR / ARR / collections / renewals / forecast).
//
// READ-ONLY · NEVER-THROWS · NO NEW TABLES. Composes the recurring-billing substrate (comm_subscriptions
// × comm_plans + comm_subscription_events) plus the existing one-time ledger (capadex_payments). Every
// figure describes REAL recorded rows — measurement, not estimation. Each query degrades to zero/empty
// on error and sets `degraded:true`. With the comm_* tables empty in dev this honestly reports zeros.
//
// The forecast REUSES the existing WC-L2 forecast CONTRACT (`last + slope`, and the SAME confidence-band
// thresholds as services/wc3/forecast-intelligence.ts `confidenceBand`) but NOT its function, because
// that clamps to 0..100 (a score range) whereas revenue is unbounded rupees. It needs ≥2 monthly points
// or it ABSTAINS (never fabricates a number). Confidence mirrors the trend-point scale: 2 pts→0.33,
// 3→0.67, 4+→1.0 (so a 2-point line is honestly `low`).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

type RevDirection = 'rising' | 'falling' | 'stable';

export type RecurringForecast =
  | {
      forecastable: true;
      metric: 'monthly_collections';
      horizon: 'next_month';
      points: number;
      last_value_rupees: number;
      slope_per_month_rupees: number;
      projected_value_rupees: number;
      projected_direction: RevDirection;
      forecast_confidence: number;
      confidence_band: 'low' | 'moderate' | 'high';
      basis: string;
    }
  | { forecastable: false; reason: 'insufficient_periods'; detail: string };

export interface RecurringRevenue {
  generated_at: string;
  degraded: boolean;
  mrr: {
    paise: number;
    rupees: number;
    active_subscriptions: number;
    by_interval: { interval: string; subscriptions: number; mrr_rupees: number }[];
  };
  arr: { paise: number; rupees: number };
  collections: {
    subscription_paise: number;
    subscription_rupees: number;
    onetime_paise: number;
    onetime_rupees: number;
    total_rupees: number;
  };
  renewals: { window_days: number; due_soon: number; in_grace: number; churning: number };
  monthly_series: { month: string; rupees: number }[];
  forecast: RecurringForecast;
}

/** Normalize a per-cycle price to a MONTHLY amount. one_time / trial are NOT recurring → 0 MRR. */
function monthlyPaise(pricePaise: number, interval: string, intervalCount: number): number {
  const count = Math.max(1, Math.trunc(Number(intervalCount)) || 1);
  const base = interval === 'monthly' ? 1 : interval === 'quarterly' ? 3 : interval === 'annual' ? 12 : 0;
  if (base === 0) return 0; // one_time / trial — excluded from recurring revenue
  return pricePaise / (base * count);
}

/** Mirrors services/wc3/forecast-intelligence.ts `confidenceBand` thresholds exactly. */
function confidenceBand(confidence: number): 'low' | 'moderate' | 'high' {
  if (confidence >= 0.84) return 'high';
  if (confidence >= 0.5) return 'moderate';
  return 'low';
}

/** Least-squares slope of a numeric series over its integer index (0..n-1). */
function leastSquaresSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export async function buildRecurringRevenue(pool: Pool): Promise<RecurringRevenue> {
  let degraded = false;
  const fail = () => { degraded = true; };

  // ── MRR — active subscriptions × plan price normalized to monthly ──────────────────────────────
  const mrrRows = await pool
    .query(
      `SELECT p.billing_interval, p.interval_count, p.price_paise
         FROM comm_subscriptions s
         JOIN comm_plans p ON p.id = s.plan_id
        WHERE s.status = 'active'`,
    )
    .then((r) => r.rows)
    .catch(() => { fail(); return [] as any[]; });

  let mrrPaise = 0;
  const intervalAgg = new Map<string, { subs: number; paise: number }>();
  for (const r of mrrRows) {
    const m = monthlyPaise(Number(r.price_paise ?? 0), String(r.billing_interval ?? 'monthly'), Number(r.interval_count ?? 1));
    mrrPaise += m;
    const key = String(r.billing_interval ?? 'monthly');
    const cur = intervalAgg.get(key) ?? { subs: 0, paise: 0 };
    cur.subs += 1;
    cur.paise += m;
    intervalAgg.set(key, cur);
  }

  // ── Collections — recurring payments (subscription events) + one-time ledger (capadex_payments) ─
  const subColl = await pool
    .query(
      `SELECT COALESCE(SUM(amount_paise), 0) AS paise
         FROM comm_subscription_events
        WHERE event_type IN ('payment_succeeded','renewed') AND amount_paise IS NOT NULL`,
    )
    .then((r) => Number(r.rows[0]?.paise ?? 0))
    .catch(() => { fail(); return 0; });

  const oneTimeColl = await pool
    .query(`SELECT COALESCE(SUM(amount_paise), 0) AS paise FROM capadex_payments WHERE status='paid'`)
    .then((r) => Number(r.rows[0]?.paise ?? 0))
    .catch(() => { fail(); return 0; });

  // ── Renewals — due-soon (next 30d), in-grace (past_due / lapsed), churning (cancel at period end) ─
  const RENEWAL_WINDOW_DAYS = 30;
  const renewals = await pool
    .query(
      `SELECT
         COUNT(*) FILTER (
           WHERE status='active' AND cancel_at_period_end = FALSE
             AND current_period_end IS NOT NULL
             AND current_period_end BETWEEN now() AND now() + interval '30 days'
         ) AS due_soon,
         COUNT(*) FILTER (
           WHERE status='past_due'
              OR (status='active' AND current_period_end IS NOT NULL AND current_period_end < now())
         ) AS in_grace,
         COUNT(*) FILTER (
           WHERE cancel_at_period_end = TRUE AND status IN ('active','past_due')
         ) AS churning
       FROM comm_subscriptions`,
    )
    .then((r) => r.rows[0])
    .catch(() => { fail(); return null; });

  // ── Monthly collections series (recurring + one-time) for the forecast ─────────────────────────
  const monthlyRows = await pool
    .query(
      `SELECT to_char(month, 'YYYY-MM') AS month, SUM(paise) AS paise FROM (
         SELECT date_trunc('month', created_at) AS month, COALESCE(amount_paise,0) AS paise
           FROM comm_subscription_events
          WHERE event_type IN ('payment_succeeded','renewed') AND amount_paise IS NOT NULL
         UNION ALL
         SELECT date_trunc('month', created_at) AS month, COALESCE(amount_paise,0) AS paise
           FROM capadex_payments WHERE status='paid'
       ) t
       GROUP BY month ORDER BY month`,
    )
    .then((r) => r.rows)
    .catch(() => { fail(); return [] as any[]; });

  const monthlySeries = monthlyRows.map((r) => ({ month: String(r.month), rupees: paise2rupees(r.paise) }));

  // ── Forecast — reuse the existing last+slope contract; abstain below 2 points ───────────────────
  let forecast: RecurringForecast;
  if (monthlySeries.length < 2) {
    forecast = {
      forecastable: false,
      reason: 'insufficient_periods',
      detail: `Needs ≥2 months of collections to form a trend; have ${monthlySeries.length}.`,
    };
  } else {
    const values = monthlySeries.map((m) => m.rupees);
    const last = values[values.length - 1];
    const slope = leastSquaresSlope(values);
    const projected = Math.max(0, Math.round(last + slope)); // revenue floors at 0, no upper clamp
    const confidence = Math.min(1, Math.max(0, (values.length - 1) / 3));
    forecast = {
      forecastable: true,
      metric: 'monthly_collections',
      horizon: 'next_month',
      points: values.length,
      last_value_rupees: last,
      slope_per_month_rupees: Math.round(slope),
      projected_value_rupees: projected,
      projected_direction: slope > 0 ? 'rising' : slope < 0 ? 'falling' : 'stable',
      forecast_confidence: Math.round(confidence * 100) / 100,
      confidence_band: confidenceBand(confidence),
      basis: `Linear extrapolation of monthly collections (${values.length} months): last ₹${last} + slope ₹${Math.round(slope)}/month.`,
    };
  }

  return {
    generated_at: new Date().toISOString(),
    degraded,
    mrr: {
      paise: Math.round(mrrPaise),
      rupees: paise2rupees(mrrPaise),
      active_subscriptions: mrrRows.length,
      by_interval: Array.from(intervalAgg.entries())
        .map(([interval, v]) => ({ interval, subscriptions: v.subs, mrr_rupees: paise2rupees(v.paise) }))
        .sort((a, b) => b.mrr_rupees - a.mrr_rupees),
    },
    arr: { paise: Math.round(mrrPaise * 12), rupees: paise2rupees(mrrPaise * 12) },
    collections: {
      subscription_paise: subColl,
      subscription_rupees: paise2rupees(subColl),
      onetime_paise: oneTimeColl,
      onetime_rupees: paise2rupees(oneTimeColl),
      total_rupees: paise2rupees(subColl + oneTimeColl),
    },
    renewals: {
      window_days: RENEWAL_WINDOW_DAYS,
      due_soon: Number(renewals?.due_soon ?? 0),
      in_grace: Number(renewals?.in_grace ?? 0),
      churning: Number(renewals?.churning ?? 0),
    },
    monthly_series: monthlySeries,
    forecast,
  };
}
