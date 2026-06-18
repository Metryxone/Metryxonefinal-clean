# WC-C7 · Deliverable 1 — Upgrade Path Report

**Date:** 2026-06-10T09:23:04.546Z
**Audit:** WC-C7 Upsell & Expansion Intelligence Audit
**Phase:** AUDIT ONLY · READ ONLY

---

## Objective

Map every product upgrade path that exists in the live platform.

---

## Product Families

| Family | Products | Model | Upgrade Path |
|---|---|---|---|
| B2C Stage Ladder | CAP_INS (₹499) / CAP_GRW (₹999) / CAP_MAS (₹1,999) | One-time progressive unlock | Linear: INS → GRW → MAS |
| Subscription Packages | 13 packages (₹299–₹1,499, 30–365d) | Validity-window renewable | **ABSENT** |

---

## B2C Ladder Upgrade Path (REAL)

The stage ladder is the only live upgrade path in the platform.

### Upgrade mechanism
- Engine: `subscription-engine.ts` + `upsell-engine.ts` (WC-7C)
- Path: each paid stage unlocks the next rung as an upsell target
- Gate: D6 confidence ≥ 0.7 required for auto-recommend; below threshold → `show_options`
- Safety: D7 crisis/escalation event suppresses all commerce (`safety_override`)
- Trigger built: **stage_ladder_progression** (user completes a stage → next rung offered)
- Triggers NOT built (by design): `behavioural_at_risk`, `behavioural_power_user`
- ⚠ **STAGE_PRICES lockstep**: `STAGE_PRICES` is defined independently in BOTH `subscription-engine.ts` and `upsell-engine.ts`, mirroring `routes/capadex-payments.ts`. All three must stay in lockstep — a price change in any one source without updating the others will cause upsell offers to quote incorrect prices.

### Ladder rungs
| Code | Label | Price | Status |
|---|---|---|---|
| CAP_INS | Insight | ₹499 | Live (Razorpay) |
| CAP_GRW | Growth | ₹999 | Live (Razorpay) |
| CAP_MAS | Mastery | ₹1,999 | Live (Razorpay) |

### Live activation state
- Total payments: **6** (all CAP_INS, all `pending`)
- Paid identities: **0** (no completed purchases)
- Upsell-eligible population: **not_measurable** (requires ≥1 paid identity)
- Full-ladder owners: **0**

The upgrade path is structurally complete and correctly engineered. It cannot activate until at least one user completes a CAP_INS purchase.

---

## Package → Package Upgrade Path (ABSENT)

- No upgrade field, upgrade logic, or upgrade route exists in `subscription_packages`
- 13 packages exist in the catalog (WC-C6B) but are sold as independent SKUs
- No ladder or tier relationship is defined between packages

**This is a structural gap, not an activation gap.** The schema would need new fields (e.g. `upgrades_to_package_id`) and engine logic before any activation could be possible.

---

## Package ↔ B2C Ladder Cross-Upgrade (ABSENT)

- The B2C ladder is email-keyed (`capadex_payments`)
- Package subscriptions are child-keyed (`student_subscriptions.children_id`)
- The `users` table has no `email` column — the identity bridge required to link these two models does not exist
- No route, engine, or mapping connects a package SKU to a ladder stage or vice versa

**Impact:** A package subscriber cannot be identified as a potential ladder upsell candidate, and a paid-ladder user cannot be offered a package upgrade. Cross-product expansion is structurally blocked at the identity layer.

---

## Summary

| Path | Structural | Activation | Reason |
|---|---|---|---|
| B2C ladder upsell (INS→GRW→MAS) | REAL | not_measurable | 0 paid identities |
| Package renewal | REAL (engine) | not_measurable | 0 subscriptions |
| B2C ↔ package cross-upgrade | ABSENT | not_applicable | identity bridge missing |
| Package → package upgrade | ABSENT | not_applicable | no upgrade path defined |

---

*Next step requires user decision: identity bridge (email column on users) is the keystone unlock for cross-SKU expansion.*
