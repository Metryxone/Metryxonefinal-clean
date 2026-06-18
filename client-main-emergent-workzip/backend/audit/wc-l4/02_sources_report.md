# WC-L4 · Deliverable 2 — Sources Report
_Generated 2026-06-10T04:02:53.569Z. Read-only._

The ONLY generating layer is **outcome** (library-backed). Every other layer is a priority/context
**annotation** and can never generate an intervention. Degraded journey / decision sources contribute
**ZERO** (only the degraded marker is recorded).

## Generator — outcome models (by intervention count)
| model_key | interventions |
|---|---|
| confidence_stability | 6 |

- Multi-model interventions (same library row surfaced by >1 model; MAX-confidence kept, no blend): **4**

## Annotation layers (per intervention)
| Annotation | Real contribution | Degraded (ZERO contribution) |
|---|---|---|
| Stage (L1) | 6 | — |
| Journey (L3) | 2 | 4 |
| Decision (WC-11) | 0 | 6 |
| User persona (WC-L0) | 6 | — |
| Trend concern (WC-L1) | 0 | — |
| Forecast concern (WC-L2) | 0 | — |

## Honest finding — decision is fully degraded today
Decision routing is currently **0 real / 6 degraded** across persisted
interventions: the WC-11 decision layer resolves to the mentoring-fallback / NULL-outcome path for these
sessions, which by canon is a routing guarantee — **not** evidence of intervention need. It therefore
contributes zero. This is a true data ceiling (reported, not engineered around).
