---
name: WC-7C Commercial Activation & Revenue Intelligence
description: Discipline + invariants for CAPADEX commercial layer (subscription/offer slots + revenue intelligence) — compose-only over the live ledger, fail-closed safety.
---

# WC-7C — Commercial Intelligence & Subscription Activation

Additive commercial layer composed over the live CAPADEX progressive-stage ladder (the real
Razorpay SKU). Two flags, both default OFF: `commercialActivation` (Wave 1: fills the activation
envelope's `subscription` slot + adds an `offer` slot inside the Decision Orchestrator) and
`revenueIntelligence` (Wave 0: read-only admin route). Reuses existing tables only —
`capadex_payments`, `capadex_audit_events`, `capadex_sessions`. No new tables.

## Durable invariants (these are the lessons, not the file list)

- **Commerce reads must fail CLOSED, never fail open.** Two engine guards swallow errors in a
  way that would enable a *dishonest* upsell, so they invert the usual "catch → neutral" habit:
  - The safety (D7) check (`checkSafetyOverride`, reads `capadex_audit_events` for
    crisis/escalation event types) returns `true` (block) on query error — and the orchestrator's
    own `.catch` is also `() => true`. If we cannot verify safety, we suppress commerce.
  - The ledger ownership read (`loadOwnedStages`) deliberately does NOT swallow errors. A read
    failure must not look like "owns nothing" (that could recommend a stage already paid for) →
    the caller maps the throw to `reason:'billing_ledger_unavailable'`, `ready:false`, no target.
  **Why:** an architect honesty pass failed the first cut precisely because both were fail-open.
  Fabricating "no crisis" or "owns nothing" is a safety/honesty violation, not a harmless default.

- **D6: never auto-recommend on low confidence.** High-confidence gate = `confidence ≥ 0.7 AND
  ambiguity === 'low'`. Below it → `reason:'show_options'`, `confidence_gated:true`, target is
  surfaced but `ready:false` (UI shows options, must not auto-recommend).

- **Never sell into a stub.** The offer engine flags products whose route_key/path matches the
  stub list (`employability`, `competitive_exam`/`competitive-exam`, `exam_intelligence`) as
  `sellable:false / status:'product_not_ready'`. The stage ladder itself is the live product, so
  the *subscription* target is always real; the stub guard lives on the routed *product* slot.

- **`offer_fit` is DIRECTIONAL, not a probability.** Carries an explicit `offer_fit_kind:
  'directional'` so it can't be read as a conversion estimate. Revenue Intelligence numbers, by
  contrast, are MEASURED real payment rows (not estimates) — keep that distinction.

- **STAGE_PRICES / LADDER are THREE-WAY duplicated**: `subscription-engine.ts`,
  `upsell-engine.ts`, AND `routes/capadex-payments.ts` all define `{CAP_INS:499,CAP_GRW:999,
  CAP_MAS:1999}` independently. Canonical source is `routes/capadex-payments.ts` (the other two
  can't import it without pulling Razorpay/email deps). **Keep all three in lockstep** — a price
  change in one without updating the others causes upsell offers to quote wrong prices. Stage→ladder
  floor: clarity/growth→GRW, mastery→MAS, else INS.

- **No circular import wc7b↔wc7c.** wc7b/decision-orchestrator imports the wc7c engines; the wc7c
  engines take NARROW input types (`CommercialDecisionInput`, `OfferEngineInput`), never importing
  `DecisionContext` back. Keep that direction.

- **Byte-identical when OFF.** Flag OFF → `subscription` stays the literal
  `{ready:false, reason:'out_of_scope_tier_b'}`, no `offer` key, `meta.bridges` stays
  `{growthPlan, mentor}`. `commercial:true` and the `offer` field appear ONLY when ON.
