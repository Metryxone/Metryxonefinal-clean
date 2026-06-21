---
name: Customer Success Intelligence (Phase 6.8)
description: Read-only flag-gated super-admin analytics composing product substrate into adoption/engagement/completion/retention/expansion + a transparent health index.
---

# Customer Success Intelligence (Phase 6.8)

Read-only super-admin analytics behind flag `commercialCustomerSuccess`
(env `FF_COMMERCIAL_CUSTOMER_SUCCESS`, default OFF → byte-identical legacy). Three engines under
`backend/services/commercial/`: `engagement-engine` (adoption/engagement/completion/product_usage),
`retention-engine` (retention_risk + expansion, COMPOSES `buildRecurringRevenue` for renewals),
`customer-success-engine` (composes both + health index). Route `routes/customer-success.ts`,
panel `superadmin/CustomerSuccessPanel.tsx`, nav id `customer-success` under Commercial group.

## Durable lessons

- **Probe failure ≠ no_substrate (honesty).** A `to_regclass` `tableExists()` that swallows its catch
  and returns `false` will silently report a DB/probe fault as "table absent" — a fabrication. Give the
  probe an `onError` callback that flips the engine's `degraded` flag, and pass `fail` at every call site.
  **Why:** never-fabricate requires distinguishing a genuine empty/absent substrate from an error.
  **How to apply:** any never-throws engine using `to_regclass` substrate probes must route probe errors
  into `degraded`, not just per-query `.catch`.

- **Health index renormalises over MEASURABLE components only.** Weights (engagement .40 / completion .30 /
  retention .30) are renormalised across whichever components are actually measurable; if none are, score is
  `null` + a `reason` string — never a fabricated 0. Smoke asserts component weights sum to ~1.

- **Compose, never recompute.** Renewals (due_soon/in_grace/churning) come from `buildRecurringRevenue`
  (wc7c/revenue-intelligence), not a re-implementation. The composite engine embeds the two sub-engine
  objects whole rather than re-querying.

- **Pattern parity with Phase 6.6.** Mirror revenue-intelligence: local `tableExists`, per-query
  `.catch(()=>{fail();return[]})`, substrate boolean map, `notes[]`, `degraded`. Flag gate lives in the
  route (503 OFF); the nav tab self-hides via a `/ping` probe `useQuery` so flag-OFF UI is byte-identical.
