# WC-C6B · Deliverable 2 — Renewable SKU Report
_Generated 2026-06-10T08:58:08.502Z. read-only._

## Summary
- **Renewable SKUs**: **13** (all have validity_days > 0 → will generate non-null expiry_date on grant)
- **Priced SKUs**: **13** (all have price > 0 → sellable)
- **Fully ready** (price + validity + questionCount): **13**

## By category
### Entry (Micro Check)
  - **Mini Learning Check** (Any Class) — ₹299 / 30d / 20 questions / Basic
  - **Stress Check** (Any Class) — ₹299 / 30d / 20 questions / Basic
  - **Snapshot Lite** (Any Class) — ₹299 / 30d / 30 questions / Basic
  - **Confidence Check** (Class 8+) — ₹299 / 30d / 20 questions / Basic
  - **Habit Check** (Class 6+) — ₹299 / 30d / 20 questions / Basic

### Exam-Season Special
  - **ExamReadiness Index™** (Class 10 Boards) — ₹499 / 90d / 60 questions / Comprehensive
  - **ExamReadiness Index™** (Class 12 Boards + Entrance) — ₹499 / 90d / 60 questions / Comprehensive
  - **ExamReadiness Index™** (Competitive Exams) — ₹499 / 90d / 60 questions / Comprehensive

### Annual Core
  - **FOUNDATION** (Class 6–8) — ₹999 / 365d / 80 questions / Detailed
  - **PERFORMANCE** (Class 9–10) — ₹999 / 365d / 100 questions / Detailed
  - **READINESS** (Class 11–12) — ₹999 / 365d / 120 questions / Detailed

### Premium / High-Pressure
  - **EDGE** (Competitive Aspirants) — ₹1499 / 365d / 150 questions / Comprehensive

### Post-Exam / Transition
  - **Transition Check** (Class 10→11 / 12→College) — ₹399 / 90d / 40 questions / Detailed

## Renewal-engine compatibility
The renewal-engine (`buildRenewalPipeline`) queries:
```sql
WHERE status='active' AND expiry_date IS NOT NULL        -- renewable_active
AND expiry_date >= now() AND expiry_date < now()+14d     -- due_soon
```
Since every grant will now derive `expiry_date = now() + validity_days × 86400000`, all future subscriptions from this catalog are renewal-ELIGIBLE from day 1.

## What stays absent
- **Package→entitlement feature map**: ABSENT (identity bridge impossible — users table has no email col). A package grant does not yet unlock any CAPADEX feature for the purchasing identity.
- **Self-serve checkout**: ABSENT (packages are granted by admin/parent, not by a buyer Razorpay order).
