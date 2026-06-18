/**
 * CAPADEX Commercial Wave 2 — Subscription Lifecycle State.
 *
 * READ-ONLY PROJECTION · NEVER-THROWS · NO NEW TABLES · NO new intelligence.
 *
 * Projects a formal lifecycle state machine over the two live commercial surfaces, fully
 * recomputable from `status` + `expiry_date` (so NO persistence — persisting a projection of an
 * empty substrate would only add staleness risk; see WC-7C "compose-only / no new tables"):
 *   • B2C stage ladder (`capadex_payments`):           pending → fulfilled(paid) / abandoned(failed)
 *   • Package subscriptions (`student_subscriptions`): active / expiring_soon / expired / cancelled
 */
import type { Pool } from 'pg';

const EXPIRING_SOON_DAYS = 14;

export type LadderState = 'pending' | 'fulfilled' | 'abandoned';
export type SubscriptionLifecycleStateName = 'active' | 'expiring_soon' | 'expired' | 'cancelled';

/** B2C one-time stage purchase state (no renewal/expiry — a paid rung is permanently fulfilled). */
export function classifyLadderState(status: string | null | undefined): LadderState {
  switch ((status || '').toLowerCase()) {
    case 'paid':
      return 'fulfilled';
    case 'failed':
      return 'abandoned';
    default:
      return 'pending'; // pending / created / unknown
  }
}

/** Validity-window package subscription state. */
export function classifySubscriptionState(
  status: string | null | undefined,
  expiry: Date | null,
  now: Date = new Date(),
): SubscriptionLifecycleStateName {
  if ((status || '').toLowerCase() === 'cancelled') return 'cancelled';
  if (expiry) {
    if (expiry.getTime() < now.getTime()) return 'expired';
    const days = (expiry.getTime() - now.getTime()) / 86_400_000;
    if (days <= EXPIRING_SOON_DAYS) return 'expiring_soon';
  }
  return 'active';
}

export interface SubscriptionLifecycle {
  generated_at: string;
  degraded: boolean;
  expiring_soon_window_days: number;
  b2c_ladder: { total: number; by_state: Record<LadderState, number> };
  package_subscriptions: { total: number; by_state: Record<SubscriptionLifecycleStateName, number> };
}

export async function buildSubscriptionLifecycle(pool: Pool): Promise<SubscriptionLifecycle> {
  let degraded = false;
  const fail = () => { degraded = true; };

  const ladderRows = await pool
    .query(`SELECT status FROM capadex_payments`)
    .then((r) => r.rows)
    .catch(() => { fail(); return [] as any[]; });
  const ladder: Record<LadderState, number> = { pending: 0, fulfilled: 0, abandoned: 0 };
  for (const r of ladderRows) ladder[classifyLadderState(r.status)]++;

  const subRows = await pool
    .query(`SELECT status, expiry_date FROM student_subscriptions`)
    .then((r) => r.rows)
    .catch(() => { fail(); return [] as any[]; });
  const subs: Record<SubscriptionLifecycleStateName, number> = {
    active: 0, expiring_soon: 0, expired: 0, cancelled: 0,
  };
  const now = new Date();
  for (const r of subRows) {
    const exp = r.expiry_date ? new Date(r.expiry_date) : null;
    subs[classifySubscriptionState(r.status, exp, now)]++;
  }

  return {
    generated_at: new Date().toISOString(),
    degraded,
    expiring_soon_window_days: EXPIRING_SOON_DAYS,
    b2c_ladder: { total: ladderRows.length, by_state: ladder },
    package_subscriptions: { total: subRows.length, by_state: subs },
  };
}
