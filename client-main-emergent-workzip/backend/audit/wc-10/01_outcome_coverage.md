# WC-10 Report 1 — Outcome Coverage (reachability ceiling)

**Bank:** 30638 clarity questions. **Chain:** Question → Bridge Tag → Construct → Outcome Model.

| Layer | Questions | % bank |
|-------|-----------|--------|
| Outcome-covered (primary outcome ≠ null) | 24588 | 80.3% |
| — of which ungated outcome | 22948 | 74.9% |
| — of which gated-only (exam_readiness) | 1640 | 5.4% |
| Journey-covered (downstream of outcome) | 24588 | 80.3% |
| **NOT outcome-covered** | 6050 | 19.7% |

## Why coverage stops at 80.3% — the gap decomposed
| Cause of no-outcome | Questions | % bank | Fixable by… |
|---------------------|-----------|--------|-------------|
| UNMAPPED / ABSENT bridge tag (no construct at all) | 4405 | 14.4% | crosswalk review (REVIEW→HIGH, UNMAPPED→construct) — NOT outcome-model expansion |
| RESIDUAL construct (resolves to a real construct that is in NO outcome model) | 1645 | 5.4% | **outcome-model expansion (this audit's lever)** |

## The two ceilings
- **Construct-reachability ceiling** = questions whose bridge tag resolves to ≥1 construct = **26233 (85.6%)**. This is the absolute maximum outcome coverage achievable by outcome-model expansion ALONE (you cannot route a question to an outcome if it has no construct).
- **Current outcome coverage** = 24588 (80.3%). The distance to the construct ceiling (**1645 q, 5.4%**) is exactly the residual-construct set — recoverable by folding those constructs into existing models.
- ⛔ **Honest headline:** even if EVERY residual construct were folded into a model, outcome coverage caps at the construct ceiling **85.6%**. Reaching **90%+** additionally requires reducing the 14.4% UNMAPPED/ABSENT set via crosswalk work — outside outcome-model expansion. See Report 6.
