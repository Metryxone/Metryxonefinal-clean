# WC-C6B · Deliverable 3 — Subscription Flow Report
_Generated 2026-06-10T08:58:08.502Z. Code-verified (no live test row inserted)._

## Grant route: `POST /api/parent/assign-package`
```
requireAuth  → parent must be logged in
→ verify child belongs to parent   (403 if not)
→ verify package exists + is_active (404 if not)
→ expiryDate = validityDays ? Date.now() + validityDays * 86400000 : null  ← KEY GATE
→ INSERT student_subscriptions (childId, packageId, expiryDate, status='active')
```

## Before vs. after fix
| Field | Before WC-C6B | After WC-C6B |
|---|---|---|
| `validityDays` on all 13 packages | **NULL** | 30 / 90 / 90 / 90 / 365 / 365 / 365 / 365 / 365 days (per category) |
| `expiryDate` computed on grant | **null** (→ NOT NULL guard fails, not renewable) | finite timestamp (→ counted by renewal engine) |
| `price` on all 13 packages | **NULL** | ₹299–₹1499 per SKU |

## Subscription lifecycle state (live, recomputed)
- student_subscriptions total: **0** (was 0 before WC-C6B; grants require a registered parent+child, none exist in dev).
- active_package_grants: **0**.

## Live test status
**NOT performed** — `/api/parent/assign-package` requires `requireAuth` and a registered parent user with a child record. No such pair exists in the dev DB. The flow is **code-verified only**:
1. Route correctly computes `expiryDate` from `validityDays` (confirmed above — routes.ts:10111).
2. All 13 packages now have non-null `validityDays` → all future grants will produce non-null `expiryDate`.
3. INSERT is correct (childId, packageId, expiryDate, status='active') — no schema change needed.

## Remaining blockers
- No registered parent+child pair in dev DB (grant route unreachable for automated test).
- No self-serve checkout (ABSENT per WC-C6A; out of scope per constraints).
- Package→entitlement: ABSENT (identity bridge impossible; out of scope per constraints).
