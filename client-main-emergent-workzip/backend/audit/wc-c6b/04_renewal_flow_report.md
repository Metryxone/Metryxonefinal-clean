# WC-C6B · Deliverable 4 — Renewal Flow Report
_Generated 2026-06-10T08:58:08.502Z. Recomputed via renewal-engine.ts (read-only)._

## Renewal engine state (live)
| Metric | Before WC-C6B | After WC-C6B |
|---|---|---|
| renewable_active | 0 | **0** (expected 0 — no live grants yet) |
| due_soon (≤14d) | 0 | 0 |
| in_grace (≤7d) | 0 | 0 |
| package_subscriptions total | 0 | 0 |

## Why renewable_active is still 0
No parent+child grant has been made yet → 0 `student_subscriptions` rows → the renewal engine has no population. This is expected and honest. The engine is correct; it has no data to process.

## What changes on first grant
Once a parent assigns a package to a child:
1. `student_subscriptions` gets a row with `expiry_date = now() + validity_days × 86400000` (non-null).
2. `buildRenewalPipeline` will count it in `renewable_active` immediately.
3. After `validity_days - 14` days, it will appear in `due_soon`.
4. No code changes are needed in the renewal engine.

## Remaining gaps (renewal layer)
- **renewal_reminder_loop**: ABSENT — no reminder/notification job wired to renewal-engine output. Out of scope per constraints.
- **recurring_or_repurchase_loop**: ABSENT — no repurchase route converts a due_soon/in_grace candidate into a new paid term. Out of scope per constraints.
