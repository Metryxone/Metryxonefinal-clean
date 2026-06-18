# WC-P2 — D10: Commercial Readiness
Generated: 2026-06-10T13:48:42.829Z

## Verdict: ❌ STRUCTURAL COMMERCIAL LAYER EXISTS, 0 SALES, 0 REVENUE

The subscription package catalog is the most developed LBI commercial component.
13 packages exist with INR pricing, but they are catalog metadata only — no
entitlement enforcement, no student subscriptions, no revenue.

## Subscription Package Catalog (13 packages)

| Product | Category | Segment | Price (INR) | Report Type | Domains |
|---------|----------|---------|------------|-------------|---------|
| Mini Learning Check | Entry (Micro Check) | Any Class | ₹299 | Basic | 1 |
| Stress Check | Entry (Micro Check) | Any Class | ₹299 | Basic | 1 |
| Snapshot Lite | Entry (Micro Check) | Any Class | ₹299 | Basic | 2 |
| Confidence Check | Entry (Micro Check) | Class 8+ | ₹299 | Basic | 1 |
| Habit Check | Entry (Micro Check) | Class 6+ | ₹299 | Basic | 1 |
| ExamReadiness Index™ | Exam-Season Special | Class 10 Boards | ₹499 | Comprehensive | 11 |
| ExamReadiness Index™ | Exam-Season Special | Class 12 Boards + Entrance | ₹499 | Comprehensive | 11 |
| ExamReadiness Index™ | Exam-Season Special | Competitive Exams | ₹499 | Comprehensive | 11 |
| FOUNDATION | Annual Core | Class 6–8 | ₹999 | Detailed | 8 |
| PERFORMANCE | Annual Core | Class 9–10 | ₹999 | Detailed | 11 |
| READINESS | Annual Core | Class 11–12 | ₹999 | Detailed | 12 |
| EDGE | Premium / High-Pressure | Competitive Aspirants | ₹1499 | Comprehensive | 1 |
| Transition Check | Post-Exam / Transition | Class 10→11 / 12→College | ₹399 | Detailed | 4 |

**Pricing range**: ₹299 (micro-check) → ₹1,499 (premium competitive)  
**Structural assessment**: Catalog is well-structured — 4 categories, clear segmentation,
report types declared.

## Commercial Infrastructure Gaps

| Component | State | Impact |
|-----------|-------|--------|
| Student subscriptions | 0 rows | ❌ 0 active |
| Payment integration | CAPADEX payments exist | ⚠️ Not wired to LBI packages |
| Entitlement enforcement | Not implemented for LBI | ❌ No access gate |
| Package→assessment binding | domains_covered is text[] only | ❌ Not machine-readable routing |
| Invoice / receipt generation | Not implemented | ❌ |
| Renewal / expiry tracking | validity_days field exists | ⚠️ Not enforced |

## Commercial Readiness Axes

| Axis | Score | Evidence |
|------|-------|---------|
| Structural (catalog exists) | 60% | 13 packages, correct schema, INR pricing |
| Activation (sold + delivered) | 0% | 0 student subscriptions, 0 deliveries |

## Pre-Requisites for Commercial Activation

1. **Framework seeding**: Cannot sell an assessment with 0 questions
2. **Payment routing to LBI**: capadex_payments is CAPADEX-specific; LBI needs its own payment ledger or a shared one
3. **Entitlement enforcement**: POST /api/lbi/sessions must check active subscription
4. **Report delivery gate**: Results should be unlocked upon purchase
5. **B2B institute billing**: Institute bulk purchase flow not designed

## Commercial Readiness: 0% Activation / 60% Structural
