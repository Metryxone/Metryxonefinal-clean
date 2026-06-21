/**
 * Phase 6.8 — Customer Success Intelligence · retention engine (READ-ONLY).
 *
 * COMPOSES (never recomputes) the commercial substrate into Retention-Risk and
 * Expansion-Opportunity signals:
 *   • Retention risk      (comm_subscriptions by status, past-due at-risk count, 30-day payment
 *                          failures, plus the renewals window COMPOSED from buildRecurringRevenue)
 *   • Expansion           (high-usage customers from comm_usage_events, repeat one-time CAPADEX
 *                          buyers as subscription-upsell candidates)
 *
 * GET-NEVER-WRITES: to_regclass probes, no schema creation, honest empties on absence/failure.
 * Expansion signals are DIRECTIONAL (heuristic ranking of real usage), never a prediction — every
 * row is a real recorded count, never fabricated.
 */
import type { Pool } from 'pg';
import { buildRecurringRevenue, type RecurringRevenue } from '../wc7c/revenue-intelligence';

async function tableExists(pool: Pool, name: string, onError?: () => void): Promise<boolean> {
  try {
    const { rows } = await pool.query(`SELECT to_regclass($1) AS oid`, [name]);
    return rows[0]?.oid != null;
  } catch {
    // Probe FAILED (not a genuine absence) — flag degraded so a fault is never
    // silently reported as "no substrate". Returns false but the caller knows.
    onError?.();
    return false;
  }
}

export interface RetentionRisk {
  subscriptions_by_status: { status: string; count: number }[];
  active: number;
  at_risk: number; // past_due subscriptions (in dunning, not yet cancelled)
  payment_failures_30d: number;
  /** Composed from buildRecurringRevenue — NOT recomputed here. */
  renewals: RecurringRevenue['renewals'];
}
export interface ExpansionCustomer {
  email: string;
  usage_events: number;
  quantity: number;
}
export interface UpsellCandidate {
  email: string;
  paid_purchases: number;
}
export interface ExpansionOpportunity {
  high_usage_customers: ExpansionCustomer[];
  repeat_onetime_buyers: UpsellCandidate[];
  note: string;
}

export interface RetentionAnalytics {
  generated_at: string;
  degraded: boolean;
  substrate: {
    comm_subscriptions: boolean;
    comm_subscription_events: boolean;
    comm_usage_events: boolean;
    capadex_payments: boolean;
  };
  retention_risk: RetentionRisk;
  expansion: ExpansionOpportunity;
  notes: string[];
}

/** Phase 6.8 retention + expansion analytics. Read-only, never throws, never fabricates. */
export async function buildRetentionAnalytics(pool: Pool): Promise<RetentionAnalytics> {
  let degraded = false;
  const fail = () => { degraded = true; };
  const notes: string[] = [];

  const substrate = {
    comm_subscriptions: await tableExists(pool, 'comm_subscriptions', fail),
    comm_subscription_events: await tableExists(pool, 'comm_subscription_events', fail),
    comm_usage_events: await tableExists(pool, 'comm_usage_events', fail),
    capadex_payments: await tableExists(pool, 'capadex_payments', fail),
  };

  // ── Renewals — COMPOSED from buildRecurringRevenue (not recomputed) ───────────────────────────────
  const recurring = await buildRecurringRevenue(pool).catch(() => { fail(); return null; });
  if (recurring?.degraded) degraded = true;

  // ── Retention risk (subscription lifecycle) ───────────────────────────────────────────────────────
  const retention_risk: RetentionRisk = {
    subscriptions_by_status: [],
    active: 0,
    at_risk: 0,
    payment_failures_30d: 0,
    renewals: recurring?.renewals ?? { window_days: 30, due_soon: 0, in_grace: 0, churning: 0 },
  };
  if (substrate.comm_subscriptions) {
    const rows = await pool
      .query(`SELECT COALESCE(status,'unknown') AS status, COUNT(*) AS count FROM comm_subscriptions GROUP BY 1 ORDER BY count DESC`)
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    for (const r of rows) {
      const status = String(r.status);
      const count = Number(r.count ?? 0);
      retention_risk.subscriptions_by_status.push({ status, count });
      if (status === 'active') retention_risk.active += count;
      if (status === 'past_due') retention_risk.at_risk += count;
    }
  }
  if (substrate.comm_subscription_events) {
    retention_risk.payment_failures_30d = Number(
      (await pool
        .query(`SELECT COUNT(*) AS n FROM comm_subscription_events WHERE event_type='payment_failed' AND created_at >= now() - interval '30 days'`)
        .then((r) => r.rows)
        .catch(() => { fail(); return [] as any[]; }))[0]?.n ?? 0,
    );
  }

  // ── Expansion opportunity (directional, grounded in real usage) ──────────────────────────────────
  const expansion: ExpansionOpportunity = {
    high_usage_customers: [],
    repeat_onetime_buyers: [],
    note: 'Expansion signals are directional rankings of real recorded usage, not predictions.',
  };
  if (substrate.comm_usage_events) {
    const rows = await pool
      .query(
        `SELECT email, COUNT(*) AS usage_events, COALESCE(SUM(quantity),0) AS quantity
           FROM comm_usage_events WHERE email IS NOT NULL
          GROUP BY email ORDER BY quantity DESC, usage_events DESC LIMIT 25`,
      )
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    expansion.high_usage_customers = rows
      .map((r) => ({ email: String(r.email), usage_events: Number(r.usage_events ?? 0), quantity: Number(r.quantity ?? 0) }))
      .filter((c) => c.usage_events > 0 || c.quantity > 0);
  } else {
    notes.push('High-usage expansion signal unavailable (comm_usage_events table absent).');
  }
  if (substrate.capadex_payments) {
    const rows = await pool
      .query(
        `SELECT email, COUNT(*) AS paid FROM capadex_payments
          WHERE status='paid' AND email IS NOT NULL
          GROUP BY email HAVING COUNT(*) >= 2
          ORDER BY paid DESC LIMIT 25`,
      )
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    expansion.repeat_onetime_buyers = rows.map((r) => ({ email: String(r.email), paid_purchases: Number(r.paid ?? 0) }));
  }

  if (!substrate.comm_subscriptions) notes.push('No subscription substrate present — retention risk is zeroed.');

  return {
    generated_at: new Date().toISOString(),
    degraded,
    substrate,
    retention_risk,
    expansion,
    notes,
  };
}
