# Deliverable 2 — Lever A: Decision-Driven Activation

Generated: 2026-06-08T15:51:32.846Z · 9 completed sessions

| Slot | Consumption Rate | Activation Readiness |
|------|------------------|----------------------|
| Product | 9/9 (100.0%) | 0/9 (0.0%) |
| Growth Plan | 9/9 (100.0%) | 0/9 (0.0%) |
| Mentor | 9/9 (100.0%) | 9/9 (100.0%) |
| Commercial (subscription) | 9/9 (100.0%) | 0/9 (0.0%) |

**Consumption** = the slot was evaluated against the `UnifiedDecision` (product route mirrors
`decision.route`; Growth/Mentor/Commercial produced a grounded reason, not a flag-off sentinel).
**Readiness** = the slot fired `ready:true`.

## All activations decision-driven (structural proof)
- 9/9 (100.0%) completed sessions have an envelope whose
  `composed_from` is non-empty AND whose product slot's `route_key` equals `decision.route.route_key`
  (or both honestly null). This proves the activations are composed FROM the decision, not static defaults.

## Growth Plan — reason histogram
- `no_outcome_models`: 9

## Mentor — reason histogram
- `derived_from_concern_keyword`: 9

## Commercial — reason histogram
- `show_options`: 5
- `no_billing_identity`: 4

> A slot can be **consumed but not ready**: e.g. Commercial reads `decision.confidence` and
> correctly returns `show_options` (consumed, not ready) on a low-confidence cold-start session —
> by design it never auto-recommends on low confidence. Readiness rises as sessions resolve richer
> outcomes; nothing is forced ready.

## Measurement integrity — reason classification audit
Every distinct slot reason encountered (across all measured sessions) and how the consumption
classifier treated it. Flag-off/no-envelope sentinels and any `*error*/*fail*` reason are treated
as **NOT consumed**, so an unexpected reason code can never silently inflate the Consumption Rate.

**growth**
- `no_outcome_models` → **consumed** (consumed:36 / not:0)

**mentor**
- `derived_from_concern_keyword` → **consumed** (consumed:36 / not:0)

**commercial**
- `show_options` → **consumed** (consumed:21 / not:0)
- `no_billing_identity` → **consumed** (consumed:15 / not:0)
