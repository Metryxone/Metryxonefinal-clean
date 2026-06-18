# WC-C1 · Deliverable 10 — Commercial Expansion Roadmap
_Generated 2026-06-10T05:14:29.718Z. Enabler checklist keyed to the axis cell each unlocks. NO projections, NO new engines — reuse existing assets only._

## Reading this roadmap
Each enabler names **which readiness cell it moves** and **which axis** (Structural raises the tier toward *real(5)*; Activation flips a binary enabler ❌→✅). No revenue/conversion numbers are projected — those are earned, not forecast here.

## Tier 0 — Paid Consumer Launch (smallest viable, B2C ladder only)
| # | Enabler | Axis · cell it unlocks | New engine/table? |
|---|---|---|---|
| 0.1 | Add real Razorpay keys (ID/SECRET/WEBHOOK_SECRET) | Activation · Revenue (keys, capture) | No (config) |
| 0.2 | Run ONE real payment end-to-end → `status='paid'` + `payment_completed` event | Structural · Revenue order/verify/webhook → *real(5)*; Activation · Revenue (paid>0, events>0) | No |
| 0.3 | Wire `requireEntitlement` consuming `entitlement-engine.deriveEntitlement(email)` | Structural · Product Monetization (access_enforcement); Entitlement hierarchy | No (one guard) |
| 0.4 | Un-gate `commercialActivation` (deploy default) + surface offer/activation envelope in UI | Activation · Commercial (flag ON + consumer) | No (flag + UI) |

## Tier 1 — Subscription & Renewal activation
| # | Enabler | Axis · cell it unlocks | New engine/table? |
|---|---|---|---|
| 1.1 | Seed `subscription_packages` (currently 0 rows) | Activation · Subscription (active packages>0) | No (data seed) |
| 1.2 | Create `parent_subscriptions` table in live DB (code already references it) | Structural · Subscription (parent_plans absent→real) | Table EXISTS in code, missing in DB |
| 1.3 | Un-gate `commercialEntitlement`/`commercialRenewal`/`commercialLifecycleState` + wire consumers | Structural+Activation · Commercial (entitlement/renewal/lifecycle → real) | No |
| 1.4 | Wire a renewal-reminder job to renewal-engine output | Structural · Renewal (reminders) | No (job) |

## Tier 2 — Upsell, offers, forecasting
| # | Enabler | Axis · cell it unlocks | New engine/table? |
|---|---|---|---|
| 2.1 | Un-gate `commercialUpsell` + surface next-rung offer | Structural+Activation · Commercial (upsell) | No |
| 2.2 | Add decision→package mapping (outcome/journey → package) | Structural · Upgrade-path (missing transition) | No (mapping table/config) |
| 2.3 | Un-gate `commercialForecastInputs`/`revenueIntelligence` admin surfaces | Structural · Commercial (forecast/revenue consumers) | No |
| 2.4 | Accrue ≥2 monthly points per commercial series (real commerce over time) | Activation · Commercial Forecast (forecastable series) | No (time + volume) |

## Tier 3 — Deferred / explicitly OUT of "reuse existing assets" scope
| # | Item | Why deferred |
|---|---|---|
| 3.1 | Behavioural upsell triggers (at_risk / power_user) | Would be a NEW intelligence engine |
| 3.2 | Mentor monetization (mentor_bookings table + live mentors) | Mentor product is a stub; needs substrate, not just commerce wiring |
| 3.3 | B2B institutional seats (institution_id / max_students) | subscription_packages lacks these columns; biggest revenue, biggest build |

## Honest summary
- **Structural → ~95%** is reachable by **un-gating + wiring live consumers + one access guard** (Tiers 0–2) — no new engine, no new intelligence.
- **Activation → high** is **earned by real commerce** (keys, paid volume, seeded catalog, accrued series), NOT by configuration. The shortest honest path to *paid* launch is **Tier 0** alone.
