/**
 * CAPADEX Stage Pricing — SINGLE SOURCE OF TRUTH (backend).
 *
 * The per-stage price of each purchasable rung of the LIVE CAPADEX progressive-stage
 * ladder (the real Razorpay product). Authoritative definition owned by the payment
 * gateway (`routes/capadex-payments.ts`), extracted here so every consumer imports the
 * SAME values instead of hand-copying a "keep in lockstep" mirror.
 *
 * Consumers:
 *   • routes/capadex-payments.ts           — authoritative gateway (create-order amount)
 *   • services/wc7c/subscription-engine.ts — next-rung target price
 *   • services/wc7c/upsell-engine.ts       — upsell target price
 *
 * Curiosity (CAP_CUR) is the free pre-purchase stage and is NOT a purchasable rung, so
 * it carries no price and is absent from the ladder.
 *
 * Pure constants: no DB, no I/O, no side effects. Amounts are in whole INR (₹).
 */

/** Per-stage price (₹, INR) for the purchasable CAPADEX stages. */
export const STAGE_PRICES: Record<string, number> = {
  CAP_INS: 499,
  CAP_GRW: 999,
  CAP_MAS: 1999,
};

/** The purchasable ladder, in progression order (matches the priced stages above). */
export const PURCHASABLE_LADDER = ['CAP_INS', 'CAP_GRW', 'CAP_MAS'] as const;
