# P-X1 — Shared Product Foundation Audit & Implementation Plan
_Generated 2026-06-10T14:38:00.263Z. READ-ONLY · AUDIT ONLY · STOP FOR APPROVAL._

## The Question
Which shared platform capabilities are blocking EI, LBI, and Career Builder simultaneously?

## The Answer (3 lines)
1. CAPADEX has already built the snapshot, memory, trend, recommendation, and intelligence layers.
2. EI and LBI do not consume any of it. Career Builder partially does.
3. Wiring the three products to the shared foundation (~25 engineering days) is the fastest path to simultaneous uplift.

## Deliverables
| # | File | Contents |
|---|---|---|
| 1 | `01_shared_foundation_gap_matrix.md` | 10 capabilities × 3 products gap matrix with live DB evidence |
| 2 | `02_product_dependency_map.md` | Directed dependency graph per product + cross-product critical path |
| 3 | `03_capability_reuse_analysis.md` | Impact/effort ranking + reusable asset inventory |
| 4 | `04_implementation_roadmap.md` | 4-phase roadmap (F1–F4, ~25 eng days) |
| 5 | `05_readiness_uplift_forecast.md` | Per-product coverage/confidence before→after each phase |
| 6 | `06_priority_sequencing.md` | Ranked capability list with quick wins + 70% path |
| 7 | `07_stop_for_approval.md` | Executive summary + decisions required + STOP FOR APPROVAL |

## Baseline Scores (audit evidence)
| Product | Coverage | Confidence |
|---|---|---|
| EI (Employability Index) | 32% | 23% |
| LBI (Learning Behavior Index) | 25% | 0% |
| Career Builder | 37% | 17% |

## Post-F4 Forecast (engineering only, no data actions)
| Product | Coverage | Confidence |
|---|---|---|
| EI | ~49% | ~36% |
| LBI | ~50% | ~8% |
| Career Builder | ~53% | ~32% |

_70% requires product-specific data actions beyond engineering (occupation data, LBI framework seeding, job/mentor supply)._
