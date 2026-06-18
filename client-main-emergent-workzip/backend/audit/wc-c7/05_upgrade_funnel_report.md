# WC-C7 · Deliverable 5 — Upgrade Funnel Report

**Date:** 2026-06-10T09:23:04.546Z
**Audit:** WC-C7 Upsell & Expansion Intelligence Audit
**Phase:** AUDIT ONLY · READ ONLY

---

## Objective

Map the end-to-end upgrade funnel from session start to revenue conversion.

---

## Funnel Stages

```
Sessions started       27  (all CAPADEX sessions)
        ↓
Sessions completed     9  (33.3% completion rate)
        ↓
Journey routed         9  (100% of completed → product recommendation)
        ↓
Routed to real product 8  (88.9% non-stub routes)
        ↓
High-confidence (≥0.7) 2  (22.2% meet D6 auto-recommend threshold)
        ↓
Prior paid stage        0  (prerequisite for ladder upsell)
        ↓
Payment initiated       6  (22.2% of sessions; all pending)
        ↓
Payment completed       0  (₹0 revenue)
```

---

## Journey Route Distribution (completed sessions)

| Route key | Product label | Sessions | Product status |
|---|---|---|---|
| lbi | LBI Behavioural Intelligence | 2 | real |
| competitive_exam | Competitive Exam Intelligence | 1 | ⚠ STUB |
| mentoring | Mentoring | 6 | real |

**Key findings:**
- **Mentoring fallback dominance**: 6/9 sessions (66.7%) routed to mentoring at confidence 0.2. This is the engine's correct deterministic fallback (catch-all route), not a measurement failure. It indicates the CAPADEX signal spine is not yet strong enough to route most sessions to a specific intelligence product.
- **High-confidence routes**: 2 sessions routed to LBI at 0.97 — these sessions would pass D6 and receive an auto-recommendation if a prior payment existed.
- **Stub route**: 1 session routed to competitive_exam (confidence 0.51 — CORPUS_PENDING). The offer engine's stub guard would suppress any commercial recommendation.

---

## Funnel Bottlenecks

| Bottleneck | Impact | Structural or Activation? |
|---|---|---|
| Low completion rate (33.3%) | Reduces the addressable population for any recommendation | Activation |
| Mentoring fallback dominance (66.7%) | Low-confidence routes → no auto-recommend | Structural (signal spine density) |
| 0 paid identities | Upsell requires prior purchase; upgrade funnel bottoms out here | Activation |
| Forecast series: 0 data points | Forecast-driven upgrade triggers unavailable | Activation (no history yet) |

---

## Forecast-to-Upgrade Readiness

The forecast contract requires ≥ 2 monthly data points per series (WC-L2 standard). Current state:

| Series | Points | Status |
|---|---|---|
| Paid revenue by month | 0 | insufficient_data |
| Paid transactions by month | 0 | insufficient_data |
| New package subscriptions by month | 0 | insufficient_data |
| Subscription expiries by month | 0 | insufficient_data |

**Forecast-driven upgrade recommendations: not available.** The forecast infrastructure is real and correct — it will populate automatically as transactions accumulate. Minimum to unlock: 2 paid transactions in 2 different months.

---

## Funnel Conversion Summary

| Stage | Count | Rate |
|---|---|---|
| Started → Completed | 9 / 27 | 33.3% |
| Completed → Routed to non-stub | 8 / 9 | 88.9% |
| Routed → High-confidence | 2 / 9 | 22.2% |
| High-confidence → Paid | 0 / 2 | 0% |
| Payment initiated → Completed | 0 / 6 | 0% |
