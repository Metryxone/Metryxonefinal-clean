---
name: Subscription package → entitlement identity bridge gap
description: Why package subscriptions are permanently entitlement-disjoint from CAPADEX email-keyed entitlement, and what would be required to fix it.
---

## The rule
Package subscriptions (`student_subscriptions`) are child-keyed (`children.id`). CAPADEX entitlement resolves by `guest_email` (from `capadex_payments`). The `users` table has **no email column** (7 cols live-DB-matched: id / username / password / fullName / role / roles / createdAt — `schema.ts:88`). The identity bridge `guest_email → users.email → children.studentUserId → children.id → student_subscriptions.childId` is **structurally impossible** without a migration adding `email` to `users` or a new linking table.

**Why:** The CAPADEX B2C flow is free-flow (no registration required; `guest_email` is client-asserted). Package subscriptions are B2B (parent purchases for child via `POST /api/parent/assign-package`). These two identity spaces have never been wired.

**How to apply:** Any work touching `package_entitlement_map` must either:
(a) accept it as **verified absent** until a migration adds `users.email` (or an email→child link table), OR
(b) scope the migration explicitly as a new entitlement architecture step (requires STOP-FOR-APPROVAL per user preferences).

Do NOT wire `reportType → STAGE_FEATURES` as a proxy — this fabricates CAPADEX stage ownership that packages don't sell.

## Current state (as of WC-C6B, pricing confirmed 2026-06-10)
- `subscription_packages`: 13 rows, all priced (₹299–₹1499) + validity (30–365d) + questionCount (20–150). **Pricing CONFIRMED by user 2026-06-10** (Entry ₹299/30d · Exam-Season ₹499/90d · Annual Core ₹999/365d · EDGE ₹1499/365d · Transition ₹399/90d).
- `student_subscriptions`: 0 rows (grant flow code-correct; requires a registered parent+child pair).
- `renewal-engine.ts`: correct as-is — reads `expiry_date IS NOT NULL`; will pick up grants automatically once a parent assigns a package.
- Seed lives in TWO places: `routes.ts` (HTTP endpoint, source of truth) + `scripts/wc-c6b/wc-c6b-audit.ts` (script, applied the initial DB rows). Keep in lockstep or remove the script copy.
