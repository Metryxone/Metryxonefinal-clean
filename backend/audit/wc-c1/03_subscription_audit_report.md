# WC-C1 · Deliverable 3 — Subscription Audit Report
_Generated 2026-06-10T05:14:29.718Z. Payment flows · Razorpay · tables · persistence · active/inactive plans._

## **Subscription Readiness** — Structural **83.3%** (25/30) · Activation **0%** (0/5) · _denominator: 6 subscription-system cells_

## Two parallel commercial tracks
- **B2C CAPADEX stage ladder** (`capadex_payments`) — one-time progressive unlock, **permanence model** (no expiry by design). Razorpay-backed.
- **Package / institute model** (`subscription_packages` → `student_subscriptions`) — **expiry model** (purchase_date/expiry_date/status).
- **Parent plans** (`parent_subscriptions`, basic/family/premium) — referenced in `frontend/server` code but the **table is ABSENT in the live DB** → non-functional here.

## Structural (does the mechanism exist?)
| Cell | Tier | Note |
|---|---|---|
| b2c_ladder_catalog | real (5/5) | STAGE_PRICES (CAP_INS 499 / CAP_GRW 999 / CAP_MAS 1999) defined in capadex-payments.ts; mirrored in subscription-engine.ts. |
| package_catalog | real (5/5) | subscription_packages table + admin CRUD exist (category/segment/price/validity/report_type). |
| package_persistence_expiry | real (5/5) | student_subscriptions has purchase_date/expiry_date/status — finite-validity model exists. |
| parent_plans | absent (1/5) | parent_subscriptions (basic/family/premium) referenced in frontend/server code BUT table ABSENT in live DB — non-functional here. |
| active_subscription_concept | gated-real (4/5) | subscription-lifecycle projects active/expiring_soon/expired; gated commercialLifecycleState (default OFF). Ladder = permanence model (no expiry by design). |
| admin_crud | real (5/5) | /api/admin/subscription-packages CRUD + PricingPanel/AdminPricingPage surfaces exist. |

## Activation (live data, deploy posture)
| Enabler | Present | Detail |
|---|---|---|
| active packages defined > 0 | ❌ | 0 of 0 |
| package subscriptions > 0 | ❌ | 0 rows |
| live (active, unexpired) subscriptions > 0 | ❌ | 0 |
| parent_subscriptions table present | ❌ | ABSENT |
| any paid ladder purchase > 0 | ❌ | 0 paid |

## Razorpay integration (payment flow)
- Wiring: `backend/routes/capadex-payments.ts` — order creation (paise), HMAC-SHA256 signature verification, webhooks (payment.captured / order.paid).
- **Env:** RAZORPAY_KEY_ID=ABSENT · RAZORPAY_KEY_SECRET=ABSENT · RAZORPAY_WEBHOOK_SECRET=ABSENT → **DEMO mode**.
- **Ledger:** 6 rows — paid=0, pending=6, failed=0; **6 are DEMO orders**. Captured revenue: **₹0**.

## What exists / partial / missing
- **EXISTS:** B2C ladder catalog + Razorpay code + package catalog + persistence schema + admin CRUD + lifecycle projection.
- **PARTIAL:** active-subscription concept (engine exists, flag OFF); package model present but **0 packages defined, 0 subscriptions**.
- **MISSING:** parent_subscriptions table (live DB); any real paid/active subscription; decision→package mapping.

## Honest ceiling
The subscription **machinery** is largely built; the **substrate is empty** (0 active packages, 0 subscriptions, 0 captured). Activation is a seeding + real-commerce problem, not a build problem.
