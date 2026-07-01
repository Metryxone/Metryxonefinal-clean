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
 * Frontend DISPLAY mirror: the Vite frontend cannot import backend modules, so
 * `frontend/src/lib/behavioural-insights.ts` (`CAPADEX_STAGE_PRICES_INR`) holds a
 * hand-mirror of these values (clarity→CAP_INS, growth→CAP_GRW, mastery→CAP_MAS).
 * `backend/tests/stage-price-lockstep.test.ts` asserts the two stay identical, so
 * the price shown to a customer can never drift from the price actually charged.
 * If you change a price here, update the frontend mirror (or the test fails).
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
