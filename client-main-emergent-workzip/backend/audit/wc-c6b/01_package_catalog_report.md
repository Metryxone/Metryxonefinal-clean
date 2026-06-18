# WC-C6B · Deliverable 1 — Package Catalog Report
_Generated 2026-06-10T08:58:08.502Z. Implementation audit · additive only._

## Catalog state (AFTER seed)
- **Total products**: **13** (before: 0)
- **Active**: 13 · **Priced** (price > 0): 13 · **With validity**: 13 · **With question count**: 13
- **Seed result**: inserted=0, updated=0, skipped=13

## Full catalog
| Product | Category | Segment | Price (INR) | Validity | Questions | Report Type | Active |
|---|---|---|---|---|---|---|---|
| Mini Learning Check | Entry (Micro Check) | Any Class | ₹299 | 30d | 20 | Basic | ✓ |
| Stress Check | Entry (Micro Check) | Any Class | ₹299 | 30d | 20 | Basic | ✓ |
| Snapshot Lite | Entry (Micro Check) | Any Class | ₹299 | 30d | 30 | Basic | ✓ |
| Confidence Check | Entry (Micro Check) | Class 8+ | ₹299 | 30d | 20 | Basic | ✓ |
| Habit Check | Entry (Micro Check) | Class 6+ | ₹299 | 30d | 20 | Basic | ✓ |
| ExamReadiness Index™ | Exam-Season Special | Class 10 Boards | ₹499 | 90d | 60 | Comprehensive | ✓ |
| ExamReadiness Index™ | Exam-Season Special | Class 12 Boards + Entrance | ₹499 | 90d | 60 | Comprehensive | ✓ |
| ExamReadiness Index™ | Exam-Season Special | Competitive Exams | ₹499 | 90d | 60 | Comprehensive | ✓ |
| FOUNDATION | Annual Core | Class 6–8 | ₹999 | 365d | 80 | Detailed | ✓ |
| PERFORMANCE | Annual Core | Class 9–10 | ₹999 | 365d | 100 | Detailed | ✓ |
| READINESS | Annual Core | Class 11–12 | ₹999 | 365d | 120 | Detailed | ✓ |
| EDGE | Premium / High-Pressure | Competitive Aspirants | ₹1499 | 365d | 150 | Comprehensive | ✓ |
| Transition Check | Post-Exam / Transition | Class 10→11 / 12→College | ₹399 | 90d | 40 | Detailed | ✓ |

## Sellability
- All 13 products have price, validity_days, and question_count set → **sellable + renewable-capable**.
- Renewal requires `expiry_date IS NOT NULL` (renewal-engine.ts). Every grant from this catalog will now carry a finite expiry (formula: `Date.now() + validity_days × 86400000`).
- **No product change is needed** to make the grant or renewal flows work. The only remaining gate is a real parent+child pair to exercise the grant route.

## Pricing anchor consistency
B2C ladder: CAP_INS ₹499 / CAP_GRW ₹999 / CAP_MAS ₹1999. Package prices: ₹299 (Entry, 30d) → ₹399 (Transition, 90d) → ₹499 (Exam-Season, 90d) → ₹999 (Annual Core, 365d) → ₹1499 (EDGE, 365d) — all ≤ CAP_MAS ceiling. **PROPOSED DRAFT: confirm at STOP-FOR-APPROVAL.**
