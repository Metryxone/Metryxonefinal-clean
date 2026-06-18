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
