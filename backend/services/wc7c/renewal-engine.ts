/**
 * CAPADEX Commercial Wave 2 — Renewal Engine.
 *
 * COMPOSE-ONLY · READ-ONLY · NEVER-THROWS · NO NEW TABLES · NEVER auto-charges.
 *
 * The B2C CAPADEX stage ladder is a ONE-TIME progressive purchase with NO renewal concept
 * (`renewal_not_applicable_b2c`, matching subscription-engine). Renewal applies ONLY to the
 * validity-window package model (`student_subscriptions.expiry_date`, `subscription_packages.validity_days`).
 * Identifies renewal candidates from the live substrate:
 *   • due_soon — active, expiry within `DUE_SOON_DAYS`
 *   • in_grace — expired within the last `GRACE_DAYS`
 * Read-only: it surfaces candidates; it never renews or charges.
 */
import type { Pool } from 'pg';

const DUE_SOON_DAYS = 14;
const GRACE_DAYS = 7;

export interface RenewalPipeline {
  generated_at: string;
  degraded: boolean;
  b2c_ladder: { renewal_applicable: false; reason: 'renewal_not_applicable_b2c' };
  package_model: {
    renewal_applicable: true;
    due_soon_window_days: number;
    grace_days: number;
    /** active subscriptions with a finite expiry — the renewable population. */
    renewable_active: number;
    due_soon: number;
    in_grace: number;
  };
}

export async function buildRenewalPipeline(pool: Pool): Promise<RenewalPipeline> {
  let degraded = false;

  const row = await pool
    .query(
      `SELECT
          COUNT(*) FILTER (WHERE status='active' AND expiry_date IS NOT NULL) renewable_active,
          COUNT(*) FILTER (WHERE status='active' AND expiry_date IS NOT NULL
                           AND expiry_date >= now()
                           AND expiry_date <  now() + make_interval(days => $1::int)) due_soon,
          COUNT(*) FILTER (WHERE status IS DISTINCT FROM 'cancelled'
                           AND expiry_date IS NOT NULL
                           AND expiry_date <  now()
                           AND expiry_date >= now() - make_interval(days => $2::int)) in_grace
         FROM student_subscriptions`,
      [DUE_SOON_DAYS, GRACE_DAYS],
    )
    .then((r) => r.rows[0])
    .catch(() => { degraded = true; return null; });

  return {
    generated_at: new Date().toISOString(),
    degraded,
    b2c_ladder: { renewal_applicable: false, reason: 'renewal_not_applicable_b2c' },
    package_model: {
      renewal_applicable: true,
      due_soon_window_days: DUE_SOON_DAYS,
      grace_days: GRACE_DAYS,
      renewable_active: Number(row?.renewable_active ?? 0),
      due_soon: Number(row?.due_soon ?? 0),
      in_grace: Number(row?.in_grace ?? 0),
    },
  };
}
