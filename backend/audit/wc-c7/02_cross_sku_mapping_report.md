# WC-C7 · Deliverable 2 — Cross-SKU Mapping Report

**Date:** 2026-06-10T09:23:04.546Z
**Audit:** WC-C7 Upsell & Expansion Intelligence Audit
**Phase:** AUDIT ONLY · READ ONLY

---

## Objective

Determine whether users can move between product SKU families (B2C ladder ↔ subscription packages).

---

## Finding: Cross-SKU Path Is STRUCTURALLY ABSENT

Cross-SKU readiness is not a data-availability gap — it is a **structural gap** at the identity layer.

### Root cause

| Requirement | Status | Detail |
|---|---|---|
| Identity bridge (email on users table) | ABSENT | `users` table has 7 cols, no `email` |
| B2C→package cross-sell route | ABSENT | No route maps a paid ladder stage to a package SKU |
| Package→B2C ladder upsell route | ABSENT | No route maps a package subscriber to a ladder stage |
| Cross-SKU offer engine logic | ABSENT | `offer-engine.ts` bundles subscription+report+product only (all within-ladder) |
| Package feature entitlement | ABSENT | `subscription_packages` has no feature column (WC-C2 finding) |

### What exists on each side

**B2C ladder identity surface:**
- `capadex_payments` table: keyed by `lower(email)` (string)
- `subscription-engine.ts` reads `capadex_payments WHERE lower(email) = $1`
- Works when CAPADEX session carries a `guest_email` (client-asserted)

**Package subscription identity surface:**
- `student_subscriptions` table: keyed by `children_id` (FK to `children` table)
- Children are linked to parents via `parent_id`
- No email anywhere in this chain that would connect to `capadex_payments`

**The join that would be needed:**
```
capadex_payments.email → users.email (MISSING COL) → children.parent_id → student_subscriptions
```
This chain cannot be built without a migration adding `email` to `users`.

---

## Cross-SKU Readiness Score

| Axis | Score | Denominator |
|---|---|---|
| Structural | 0/1 | Identity bridge required but absent |
| Activation | not_applicable | No path to activate |
| Coverage | 0% | No sessions can receive a cross-SKU recommendation |
| Confidence | not_applicable | No recommendation fires |

---

## Impact Assessment

| Scenario | Current state |
|---|---|
| Package subscriber offered ladder upsell | Impossible |
| Paid-ladder user offered a relevant package | Impossible |
| Journey route maps to a package SKU | Impossible (journey routes point to product PATHS, not package IDs) |
| Renewal trigger leads to ladder upsell | Impossible |

---

## What would unlock this

This is a user decision (requires a migration and new architecture work):
1. **Migration**: Add `email VARCHAR` column to `users` table
2. **Identity bridge**: Link `capadex_payments.email` to `users.email` → `children` → `student_subscriptions`
3. **Cross-sell engine**: New logic to compose ladder ownership + package ownership into a cross-sell recommendation
4. **Journey routes**: Extend `wc3_journey_routes` to include package SKUs as product targets

All four steps are out of scope for this audit phase (AUDIT ONLY).
