# Billing Readiness Report

> Generated 2026-06-17T17:23:33.074Z · Task #7 Commercial Monetization Spine certification
> Structural (code/table/route exists) and Activation (real non-demo data) are SEPARATE axes — never composited.
> Demo/seed (`%@example.com`, `DEMO_*`) is EXCLUDED from all Activation metrics. Emails masked to `user_<sha256>`.

## Billing substrate

| Component | Present |
|---|:--:|
| One-time ledger (`capadex_payments`) | ✅ |
| Plans (`comm_plans`) | ✅ |
| Customers (`comm_customers`) | ✅ |
| Subscriptions (`comm_subscriptions`) | ✅ |
| Subscription events (`comm_subscription_events`) | ✅ |
| Package subscriptions (`student_subscriptions`) | ❌ |

## Revenue metrics (non-demo)

| Metric | Value |
|---|---|
| Active recurring subscriptions | 0 |
| Recurring collections | ₹0 |
| One-time collections | ₹0 |
| Total collections | ₹0 |
| Months of payment history | 0 |
| Forecast available (≥2 months) | ❌ |

## Renewals & forecast
- Renewal pipeline classifies subscriptions into **due-soon** (next 30d), **in-grace** (past_due / lapsed) and **churning** (cancel-at-period-end). Live numbers are exposed at `GET /api/capadex/admin/recurring-revenue` (flag ON).
- The collections forecast reuses the existing `last + slope` contract and ABSTAINS below 2 months — currently ABSTAINING (insufficient history).

## Verdict
Billing structural readiness: **READY**. Revenue activation: **NOT ACTIVE (no real collections yet)** → **CONDITIONAL**.

> Per replit.md: do NOT deploy or enable production flags without explicit owner approval.
