# WC-C6A · Deliverable 9 — Gap Analysis
_Generated 2026-06-10T08:50:05.250Z. read-only._

## Full capability tier map (20 capabilities)
| id | layer | structural tier | activation | reason |
|---|---|---|---|---|
| `ladder_catalog_skus` | catalog_definition | real (5/5) | ✅ | 3 priced SKUs defined + B2C order route live (catalog is non-empty & presentable). NB: 0 paid, 6 pending (demo). |
| `package_catalog_schema` | catalog_definition | real (5/5) | — | 0 catalog rows → nothing to serve |
| `package_catalog_population` | catalog_definition | absent (1/5) | — | 0 active products → catalog empty |
| `package_seed_completeness` | catalog_definition | stub (2/5) | — | seed never run AND would emit unpriced/null-validity rows → no sellable+renewable row exists |
| `b2c_pricing_model` | pricing | real (5/5) | ✅ | Prices defined and applied by the live order route. |
| `package_pricing_definition` | pricing | partial (3/5) | — | 0 priced products (price never set) |
| `pricing_tiers_discounting` | pricing | absent (1/5) | — | capability absent in code |
| `stage_feature_map` | entitlement_packaging | real (5/5) | — | 0 paying identities → no stage features ever granted live |
| `package_entitlement_map` | entitlement_packaging | absent (1/5) | — | capability absent in code |
| `entitlement_enforcement_gate` | entitlement_packaging | gated_real (4/5) | — | flag commercialEntitlementEnforcement OFF by default → dormant |
| `b2c_order_payment_flow` | sales_order | gated_real (4/5) | — | Razorpay keys NOT configured → demo posture; the 6 pending rows cannot capture real money (WC-C1 payments_demo=6). |
| `package_grant_flow` | sales_order | gated_real (4/5) | — | 0 package subscriptions → grant flow never exercised |
| `self_serve_package_checkout` | sales_order | absent (1/5) | — | capability absent in code |
| `progressive_ladder` | ladder_upgrade | real (5/5) | — | 0 paid climbs → ladder progression never fires commercially |
| `upgrade_offer_engine` | ladder_upgrade | gated_real (4/5) | — | flag commercialActivation OFF + 0 owners to offer an upgrade to |
| `cross_package_upgrade` | ladder_upgrade | absent (1/5) | — | capability absent in code |
| `renewal_candidate_engine` | renewal_recurring | real (5/5) | — | 0 renewable population → no due_soon/in_grace candidates |
| `renewal_reminder_loop` | renewal_recurring | absent (1/5) | — | capability absent in code |
| `recurring_or_repurchase_loop` | renewal_recurring | absent (1/5) | — | capability absent in code |
| `consumer_offer_engine` | consumer_offer | gated_real (4/5) | — | flag commercialActivation OFF → offer_fit dormant |

## Gaps by severity
- **ABSENT (7)**: `package_catalog_population`, `pricing_tiers_discounting`, `package_entitlement_map`, `self_serve_package_checkout`, `cross_package_upgrade`, `renewal_reminder_loop`, `recurring_or_repurchase_loop`.
- **STUB (1)**: `package_seed_completeness` — the seed gap is here (would produce unsellable rows).
- **PARTIAL (1)**: `package_pricing_definition`.
- **GATED-REAL (5)**: `entitlement_enforcement_gate`, `b2c_order_payment_flow`, `package_grant_flow`, `upgrade_offer_engine`, `consumer_offer_engine` — built, dormant behind a flag or unexercised.

## Shortest path to 90% Commercial Activation
**Principle:** 90% Activation is EARNED via real revenue (real keys + real paid rows + live renewable population + ≥2 monthly points), NOT engineering-grantable. Only Structural readiness is reachable by wiring. Path below is DESCRIBED, not executed (creating products/pricing is out of audit scope).

**Structural path (described, not executed):**
- 1. FIX the package seed to emit price + validity_days + question_count (current seed yields unpriced/null-expiry rows → unsellable + unrenewable). Seeding alone is NOT sufficient.
- 2. Populate the package catalog with priced, validity-bearing products (turns package_catalog_population absent→real).
- 3. Wire a self-serve package checkout (buyer Razorpay order → student_subscription grant with finite expiry).
- 4. Add a package→entitlement/feature mapping (packages are entitlement-disjoint today) and turn ON commercialEntitlementEnforcement.
- 5. Wire a renewal reminder → repurchase/recurring loop on the renewal-engine output.
- 6. Configure real Razorpay keys for capture (currently demo).

**Highest-leverage first move:** Define a SELLABLE+renewable package catalog (fix seed → populate). Every downstream subscription/renewal/recurring metric is currently zero-denominated by the empty, unpriced catalog.
