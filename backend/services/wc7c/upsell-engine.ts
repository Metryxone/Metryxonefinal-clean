/**
 * CAPADEX Commercial Wave 2 — Upsell Engine.
 *
 * COMPOSE-ONLY · NEVER-THROWS · NO NEW TABLES · NO new intelligence.
 *
 * Composes the EXISTING subscription-engine upsell signal — the next purchasable rung of the live
 * stage ladder, which by definition requires a PRIOR PAID purchase — with the D6 high-confidence
 * gate and the stub guard. It invents NO behavioural triggers (`behavioural_at_risk` /
 * `behavioural_power_user` are named as a future extension, deliberately NOT built — building them
 * would be a new intelligence engine, out of scope for this wave). Upsell with no prior paid stage →
 * not eligible (`no_prior_purchase`).
 *
 * STAGE_PRICES / LADDER mirror routes/capadex-payments.ts — keep in lockstep.
 */
import type { Pool } from 'pg';
import type { SubscriptionActivation } from './subscription-engine';

const STAGE_PRICES: Record<string, number> = { CAP_INS: 499, CAP_GRW: 999, CAP_MAS: 1999 };
const LADDER = ['CAP_INS', 'CAP_GRW', 'CAP_MAS'] as const;

export interface UpsellTarget { code: string; label: string; price: number; currency: 'INR'; }

export interface UpsellDecision {
  /** has a prior paid stage and a next rung to sell. */
  eligible: boolean;
  /** passed the D6 high-confidence gate AND product is not a stub. */
  ready: boolean;
  trigger: 'stage' | null;
  target: UpsellTarget | null;
  reason: string;
  confidence_gated: boolean;
  source: 'commercial_wave2_upsell';
}

/**
 * Pure per-user compose over the subscription-engine output. The subscription engine already:
 *   • sets `upsell.ready` only when a PRIOR paid stage exists (`prior_paid_stage`), and
 *   • applies the D6 high-confidence gate to `ready` / `target`.
 * Here we only add the stub guard and a typed upsell target — no recomputation.
 */
export function composeUpsell(
  subscription: SubscriptionActivation,
  opts: { productIsStub?: boolean } = {},
): UpsellDecision {
  const base: UpsellDecision = {
    eligible: false,
    ready: false,
    trigger: null,
    target: null,
    reason: subscription.upsell.reason,
    confidence_gated: subscription.confidence_gated,
    source: 'commercial_wave2_upsell',
  };

  // Upsell requires a prior paid stage (subscription-engine sets upsell.ready only then).
  if (!subscription.upsell.ready || subscription.upsell.trigger !== 'stage') {
    return base; // no_prior_purchase / renewal_not_applicable_b2c / none
  }
  base.eligible = true;

  // Never upsell into a stub product.
  if (opts.productIsStub) return { ...base, reason: 'product_not_ready' };

  const t = subscription.target;
  const target: UpsellTarget | null = t
    ? { code: t.code, label: t.label, price: STAGE_PRICES[t.code] ?? t.price, currency: 'INR' }
    : null;

  // D6 gate already applied inside subscription-engine (`ready` true only when high-confidence).
  return {
    ...base,
    ready: subscription.ready,
    trigger: 'stage',
    target,
    reason: subscription.ready ? 'upsell_recommend' : 'show_options',
  };
}

export interface UpsellOverview {
  generated_at: string;
  degraded: boolean;
  /** distinct paid emails who DON'T yet own the full ladder (the upsellable population). */
  eligible_identities: number;
  /** distinct paid emails who own all rungs (retention path, not upsell). */
  full_ladder_owners: number;
  next_rung_distribution: { stage: string; identities: number }[];
  trigger_taxonomy: { built: string[]; not_built: string[] };
}

function nextRung(owned: Set<string>): string | null {
  return LADDER.find((c) => !owned.has(c)) ?? null;
}

/** System-wide upsell overview (admin / audit). Eligibility requires a prior paid purchase. */
export async function buildUpsellOverview(pool: Pool): Promise<UpsellOverview> {
  let degraded = false;
  const rows = await pool
    .query(`SELECT lower(email) email, stage_code FROM capadex_payments WHERE status='paid' AND email IS NOT NULL`)
    .then((r) => r.rows)
    .catch(() => { degraded = true; return [] as any[]; });

  const byEmail = new Map<string, Set<string>>();
  for (const r of rows) {
    const e = String(r.email);
    if (!byEmail.has(e)) byEmail.set(e, new Set());
    byEmail.get(e)!.add(String(r.stage_code));
  }

  let eligible = 0;
  let full = 0;
  const dist = new Map<string, number>();
  for (const [, owned] of byEmail) {
    const next = nextRung(owned);
    if (!next) { full++; continue; }
    eligible++;
    dist.set(next, (dist.get(next) ?? 0) + 1);
  }

  return {
    generated_at: new Date().toISOString(),
    degraded,
    eligible_identities: eligible,
    full_ladder_owners: full,
    next_rung_distribution: LADDER
      .map((s) => ({ stage: s, identities: dist.get(s) ?? 0 }))
      .filter((x) => x.identities > 0),
    trigger_taxonomy: {
      built: ['stage_ladder_progression'],
      not_built: ['behavioural_at_risk', 'behavioural_power_user'],
    },
  };
}
