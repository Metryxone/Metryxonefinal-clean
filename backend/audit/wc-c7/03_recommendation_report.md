# WC-C7 · Deliverable 3 — Recommendation Report

**Date:** 2026-06-10T09:23:04.546Z
**Audit:** WC-C7 Upsell & Expansion Intelligence Audit
**Phase:** AUDIT ONLY · READ ONLY

---

## Objective

Audit the commercial recommendation engine and upsell trigger taxonomy.

---

## Commercial Recommendation Engine (offer-engine)

### Architecture
The offer engine (`services/wc7c/offer-engine.ts`) is a **pure compose-only function** — it assembles a per-session offer from upstream intelligence without querying, recomputing, or fabricating.

**Input:** decision confidence + product slot + growthPlan slot + mentor slot + subscription activation
**Output:** `OfferActivation` — ready, reason, primary offer, bundle, offer_fit (directional)

### Bundle composition
| Slot | Sellable | Status |
|---|---|---|
| subscription | Yes (when ready) | Next ladder rung; sellable only when D6 high-confidence + prior payment |
| report | Yes (mirrors subscription) | Unlocked by same stage SKU |
| product | Yes (unless stub) | Route_key guard: competitive_exam / employability_index = never sell |
| growth_plan | No | Available as value-add when ready, not monetised |
| mentor | No | Available as value-add when ready, not monetised |

### Gates
| Gate | Behaviour |
|---|---|
| D6 (confidence < 0.7) | `show_options` — target surfaced but NOT auto-recommended |
| D7 (safety/crisis event) | `safety_override` — empty offer, commerce fully suppressed |
| Stub product | `product_not_ready` — never sells into competitive_exam / employability_index |
| No billing identity | `no_billing_identity` — target shown but no auto-recommend |
| All stages owned | `all_stages_owned` — retention path, no new ladder product to sell |

### Live activation state
- Paid identities: **0** → offer engine never reaches `primary=recommend` for anyone
- D6 gate hit rate (journey confidence ≥ 0.7): **2/9** = **22.2%** of completed sessions
- Sessions with stub route (competitive_exam): **1** → would trigger stub guard

---

## Upsell Trigger Taxonomy

### Built triggers
| Trigger | Status | Logic |
|---|---|---|
| stage_ladder_progression | **BUILT** | Next rung offered after confirmed prior paid stage; requires prior payment |

### Not-built triggers (by design — not scope gaps)
| Trigger | Status | Reason |
|---|---|---|
| behavioural_at_risk | NOT BUILT | Future extension; building it = new intelligence engine (out of scope) |
| behavioural_power_user | NOT BUILT | Future extension; building it = new intelligence engine (out of scope) |

The engine source (`upsell-engine.ts`) explicitly documents these as deliberate future extensions, not omissions.

### Trigger taxonomy scorecard
| Metric | Value |
|---|---|
| Triggers built | 1 / 3 |
| Trigger structural coverage | 33% |
| Triggers not built by design | 2 / 3 |
| Activation (upsell population) | **not_measurable** (0 paid identities) |

---

## Upsell Population Analysis

| Metric | Value |
|---|---|
| Total CAPADEX sessions | 27 |
| Completed sessions (journey resolved) | 9 |
| Paid identities | 0 |
| Upsell-eligible (prior paid, not full-ladder) | **not_measurable** |
| Full-ladder owners | **not_measurable** |
| Engine degraded | false |

The upsell overview engine (`buildUpsellOverview`) runs cleanly but returns 0 eligible and 0 full-ladder because the `capadex_payments` ledger has 0 paid rows.

---

## Recommendation Readiness Summary

| Dimension | Score | Note |
|---|---|---|
| Engine structural completeness | 5/7 capabilities real | All supporting capabilities built |
| Trigger taxonomy | 1/3 built | 2 deliberately not built (future extension) |
| D6 gate coverage (sessions can pass) | 22.2% | 2/9 sessions at ≥0.7 confidence |
| Upsell activation | **not_measurable** | Requires ≥1 paid identity |
| Cross-SKU recommendation | **not_applicable** | Identity bridge absent (Deliverable 2) |
