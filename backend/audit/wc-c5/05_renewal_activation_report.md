# WC-C5 · Deliverable 5 — Renewal Activation Report
_Generated 2026-06-10T07:53:25.872Z. Activation = per-capability BINARY "can fire on live renewal data NOW?"_

## Activation Readiness = 0% (0/12 capabilities can fire)
| Capability | Fires now? | Reason |
|---|---|---|
| Expiry / validity-window tracking | ❌ no | 0 package subscriptions → nothing to track/classify/sell-against |
| Lifecycle state classifier (active/expiring_soon/expired/cancelled) | ❌ no | 0 package subscriptions → nothing to track/classify/sell-against |
| Package-subscription sales flow (creates the renewable population) | ❌ no | 0 package subscriptions → nothing to track/classify/sell-against |
| Renewal candidate identification (due_soon / in_grace) | ❌ no | 0 renewable population → no due_soon/in_grace candidates |
| Behaviour signal engine (WC-L0 trend inputs) | ❌ no | 2/5 identities have ≥2 sessions, but 0 PAID identities do → no RENEWAL-relevant trend |
| Longitudinal value engine (WC-L1 recurring constructs) | ❌ no | 2/5 identities have ≥2 sessions, but 0 PAID identities do → no RENEWAL-relevant trend |
| Commercial forecast input contract (revenue / expiries series) | ❌ no | 0/4 series reach ≥2 monthly points |
| Renewal scoring / propensity composition (fuses behaviour+longitudinal+engagement → renewal likelihood) | ❌ no | capability absent in code |
| Commercial retention / churn cohort analysis | ❌ no | capability absent in code |
| Entitlement enforcement gate (renewal-aware access control) | ❌ no | flag commercialEntitlementEnforcement OFF by default → dormant |
| Renewal reminder / notification loop | ❌ no | capability absent in code |
| Recurring / auto-renew billing OR package-repurchase loop | ❌ no | capability absent in code |

## Why activation is 0%
Activation Readiness is a function of **real subscriptions sold and renewed over time** — it cannot be granted by an audit or an engineering pass. With 0 package subscriptions and 0 renewable population, no renewal capability has anything to act on. Wiring the absent capabilities raises **Structural** readiness; it cannot raise Activation until a renewable population exists.

## The activation gap, concretely
1. **No renewable population** — the package sales flow exists but has never been exercised (0 rows).
2. **No reminder loop** — renewal candidates are surfaced read-only on an admin route; nothing notifies a user or admin to act.
3. **No recurring/repurchase loop** — there is no mechanism to convert a due_soon/in_grace candidate into a new paid term (and the B2C ladder is renewal_not_applicable by design).
