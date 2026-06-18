# WC-C1 · Deliverable 6 — Upgrade Path Report
_Generated 2026-06-10T05:14:29.718Z. Assessment → Product → Subscription → Renewal → Upsell. (Scope: the progression MECHANICS & transitions; the upsell engine's eligible-population readiness is deliverable 08.)_

## The intended flow & its real transitions
```
Assessment (CAPADEX) → Product (stage unlock) → Subscription (ladder/package) → Renewal → Upsell
```
| Transition | Mechanism | Status |
|---|---|---|
| Assessment → Product | CAPADEX session completes → stage_code; deeper stage = next product | **REAL** (9 completed sessions) |
| Product → Subscription | capadex-payments order for next stage (STAGE_PRICES) | **REAL code / DEMO only** (no real keys; 0 paid) |
| Subscription → next stage access | should unlock deeper experience | **BROKEN/missing** — no access-time entitlement guard consumes ownership |
| Subscription → Renewal | package validity window (renewal-engine) | **GATED-REAL** (B2C ladder = renewal_not_applicable_b2c; packages empty) |
| Renewal → Upsell | next unowned rung (upsell-engine, prior-paid gate) | **GATED-REAL** (0 paid → 0 eligible) |

## Existing upgrade routes
- **Stage ladder progression** is the spine: Curiosity(free) → Insight(₹499) → Growth(₹999) → Mastery(₹1999), each a one-time unlock.
- **Decision Orchestrator** composes stage/outcome/journey into a unified decision and surfaces a `product` slot by L3 journey route (career_builder / mentoring), behind the D6 gate.

## Missing / broken transitions
- **No purchase→access enforcement** (the single biggest break in the chain — a paid stage does not gate anything).
- **No decision→package mapping** — a detected outcome/journey does not map to a specific package (packages carry only a `student_segment` label + `is_recommended`).
- **No real payment has traversed the chain** (DEMO only).

## Honest finding
The upgrade-path **mechanics exist front-to-back** but the chain has a **structural break at "paid → access"** and is **unexercised** (no real money). Fixing the access guard + adding real keys makes the whole chain live without new engines.
