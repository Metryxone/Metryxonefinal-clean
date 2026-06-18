---
name: Commercial Spine — entitlement classes / metering / recurring revenue
description: Durable lessons for the Commercial Monetization Spine final phase (feature-class entitlement, usage metering, recurring revenue + certification).
---

# Commercial Monetization Spine — entitlement classes, metering, recurring revenue

## Revenue forecast must NOT reuse projectForecast
`services/wc3/forecast-intelligence.ts` `projectForecast` CLAMPS to 0..100 (a score range). Revenue is
unbounded rupees, so reuse only the **formula** (`last + slope`) and the SAME `confidenceBand`
thresholds (≥0.84 high / ≥0.5 moderate / else low), confidence = `(points-1)/3` clamped 0..1, and
floor the projection at 0 (no upper clamp). Abstain below 2 monthly points — never fabricate.
**Why:** literal reuse would silently cap MRR/collections at ₹100.

## Certification: exclude demo on EVERY activation metric, including JOIN-based ones
Easy to filter the obvious ledgers and forget the join-derived ones. Recurring collections come from
`comm_subscription_events` which has NO email — must `JOIN comm_customers c ON c.id=e.customer_id` and
filter `c.email NOT LIKE '%@example.com'`. Months-of-history over `capadex_payments` must also apply
the full demo predicate, not bare `status='paid'`.
**Why:** an architect review caught these two unfiltered metrics overstating Activation.

## capadex_payments demo identification
No `source` column. Demo = `email LIKE '%@example.com'` OR `razorpay_order_id`/`razorpay_payment_id`
`LIKE 'DEMO_%'`. Don't claim a "Demo Seed source" exclusion here — that source convention is the
EMPLOYER tables, not this ledger.

## Byte-identical-OFF: flag gate BEFORE ensure-schema in the route chain
Build the middleware chain as `[requireAuth, requireFlag, ensureSchema]` so a flag-OFF request 503s
before any lazy DDL runs → the live schema is byte-identical (the new entitlement-grant / usage-event
tables are never created until the flag is ON).

## Metered identity = server principal, NEVER a client-supplied email (IDOR)
A metering record/check route must derive the billing identity from the authenticated
`req.user.email`/`req.session.email`. A client `body.email`/`query.email` may be honoured ONLY for a
super-admin (acting-on-behalf); for a normal user it MUST be ignored.
**Why:** a code review flagged that a client email fallback lets any authed user burn or inspect
another identity's quota (IDOR / quota sabotage). Same trap exists in the stage gate — identity is
always server-side.

## Feature-class enforcement is a SEPARATE primitive from the stage-report gate
The WC-C4 `requireEntitlement` middleware only enforces `STAGE_REPORT_FEATURE[stage]` and does NOT
enforce the generalized classes (views/searches/reports/exports/assessments/ai/api). To gate those,
add a distinct `evaluateFeatureClassEntitlement(pool,email,class)` decision fn + `requireFeatureClass`
middleware (flag-first on BOTH the enforcement switch and the classes-computation flag; fail closed
402/503). Wire it where a class is actually consumed — e.g. a metered action whose `usage_type` IS a
feature class requires entitlement to that class (usage-only types unlocks/downloads carry no class).

## Grants intentionally honour arbitrary feature strings
A manual grant's `feature` is unioned into `entitled_features` verbatim; only the subset that passes
`isFeatureClass` also surfaces in `feature_classes`. This is deliberate (honour what was granted), not
a missing validation — don't add a write-time `isFeatureClass` reject.
