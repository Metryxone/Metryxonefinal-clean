# WC-C6A · Deliverable 2 — Subscription Architecture Report
_Generated 2026-06-10T08:50:05.250Z. Recomputed via wc7c engines (read-only)._

## Two named metrics, shown side-by-side (NAME-COLLISION GUARD)
WC-C1 already defines **"Subscription Readiness"** (Success Metric 3, 6 subscription-system cells). We do **not** reuse that name on a new denominator. Below: WC-C1's metric recomputed on its **own** denominator, and our **distinct** subset metric.

| Metric | Denominator | Structural | Activation |
|---|---|---|---|
| **Subscription Readiness** (WC-C1 SM3, recomputed) | 6 subscription-system cells | **83.3%** | **0%** |
| **Subscription Model Readiness (WC-C6A)** | 11-capability SUBSET of Productization | **45.5%** | **0%** (0/11) |

> They differ because they measure different things: WC-C1's 6 cells credit the ladder catalog + persistence + admin CRUD (structurally high); the WC-C6A subset isolates the **renewable subscription product** machinery (population, seed completeness, package entitlement, self-serve checkout, cross-package upgrade, renewal reminder, recurring loop), which is largely absent. Both Activation figures collapse to near-zero because nothing is sold.

### WC-C1 SM3 cells (recomputed, original denominator)
- `b2c_ladder_catalog` — real (5/5)
- `package_catalog` — real (5/5)
- `package_persistence_expiry` — real (5/5)
- `parent_plans` — absent (1/5)
- `active_subscription_concept` — gated_real (4/5)
- `admin_crud` — real (5/5)

### Subscription Model Readiness (WC-C6A) — the 11 subset capabilities
| id | capability | structural tier | activation | reason |
|---|---|---|---|---|
| `package_catalog_schema` | Package catalog schema + admin CRUD | real (5/5) | — dormant | 0 catalog rows → nothing to serve |
| `package_catalog_population` | Populated package catalog (live product rows) | absent (1/5) | — dormant | 0 active products → catalog empty |
| `package_seed_completeness` | Package seed produces SELLABLE+renewable rows | stub (2/5) | — dormant | seed never run AND would emit unpriced/null-validity rows → no sellable+renewable row exists |
| `package_pricing_definition` | Package pricing definition (price + validity actually set) | partial (3/5) | — dormant | 0 priced products (price never set) |
| `package_entitlement_map` | Package→entitlement/feature mapping | absent (1/5) | — dormant | capability absent in code |
| `package_grant_flow` | Package grant flow (creates the renewable population) | gated_real (4/5) | — dormant | 0 package subscriptions → grant flow never exercised |
| `self_serve_package_checkout` | Self-serve package checkout (buyer-initiated package purchase) | absent (1/5) | — dormant | capability absent in code |
| `cross_package_upgrade` | Cross-package upgrade / proration | absent (1/5) | — dormant | capability absent in code |
| `renewal_candidate_engine` | Renewal candidate identification (due_soon / in_grace) | real (5/5) | — dormant | 0 renewable population → no due_soon/in_grace candidates |
| `renewal_reminder_loop` | Renewal reminder / notification loop | absent (1/5) | — dormant | capability absent in code |
| `recurring_or_repurchase_loop` | Recurring / auto-renew billing OR package-repurchase loop | absent (1/5) | — dormant | capability absent in code |

## Lifecycle state (recomputed via subscription-lifecycle.ts)
- B2C ladder rows: **6** — pending=6, fulfilled=0, abandoned=0.
- Package subscriptions: **0** — active=0, expiring_soon=0, expired=0, cancelled=0.

## Verdict
A subscription **product architecture** exists structurally for one-time unlocks, but the **subscription model** (renewable packages) is unpopulated and missing its decision/activation layers. Subscription is the true weak link, consistent with WC-6.
