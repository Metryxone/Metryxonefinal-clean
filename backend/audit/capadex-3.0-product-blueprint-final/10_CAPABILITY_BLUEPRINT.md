# 10 · Capability Blueprint

ONE capability map. Defines the capability surface, its measured size, the domain each capability cluster
belongs to, and the activation/orchestration posture. Promotes Operating-Model (`16/17`) to blueprint depth.
**Capability = product function** (never a competency; per 04 dictionary).

## Measured capability surface (repo SSoT, 2026-06-30)
| Metric | Value | Source |
|---|---|---|
| Backend services | **589** | `find backend/services -name '*.ts'` |
| Route files | **325** | `find backend/routes -name '*.ts'` |
| `routes.ts` size | **14,509 lines** | `wc -l` |
| Feature flags (file registry) | **192** (32 ON / 160 OFF) | `feature-flags.ts` |
| Migrations | **235** | `backend/migrations/*.sql` |
| Canonical Drizzle tables | **134** | `pgTable(` in `schema.ts` |
| Live PG tables | **~1,441** | lazy ensure-schema sprawl (measured) |
| Report builders | **22** | `report-pack.ts` |
| Frontend pages / components | **89 / 559** | `find frontend/src/{pages,components}` |

## Capability clusters → domain ownership (canonical)
| Cluster | Owning domain | Activation |
|---|---|---|
| CAPADEX assessment / signal / clarity | D2 | ON |
| Competency genome + runtime scoring | D3 | ON |
| Career Builder / readiness / match / passport | D4 | ON |
| Lifecycle / progression engines | D5 | partial |
| AI reasoning / inference / explainability / governance | D6 | ON (LLM unvalidated) |
| Recommendation / intervention / growth plan (M5) | D7 | ON |
| Report Factory / dashboards / benchmarks | D8 | ON |
| Employer portal / hiring funnel / TIG | D9 | ON |
| Institutional intelligence (k-anon) | D10 | partial |
| Commercial / entitlement / payments / GST | D11 | partial |
| MX-700 lifecycle + MX-800 intelligence tiers | D12 | **DORMANT (160/192 flags OFF)** |
| Outcome composer (MX-102X) + KPI surfaces | D13 | machinery present, data null |

## Capability posture (honest)
- **Breadth is exceptional** (589 services / 192 flags) — structurally feature-complete and then some.
- **83% of flags OFF (160/192)** — a vast **dormant** surface (MX-700/MX-800). This is honest default-OFF
  dormancy (byte-identical), **not** scope drift — but it confirms **Connected ≠ Orchestrated**: capabilities
  exist but aren't activated/coordinated as one product.
- **Maintainability debt (not functional gaps):** `routes.ts` at 14.5k lines; 3 frontend monoliths; schema
  sprawl (~1,441 live vs 134 canonical, guarded by `to_regclass` probes).

## Canonical decisions (FROZEN)
1. Every capability belongs to **exactly one** owning domain (table above); cross-domain **composition** is
   allowed, **ownership** is singular.
2. The maturity-limiting factor is **orchestration + activation discipline**, not capability count — do **not**
   build more breadth; activate dormant tiers deliberately, resolve `-v2` review-candidates, decompose
   monoliths.
3. `-v2` files are **review-candidates** (≠ redundant) — no deletion authorized by this blueprint.

## Verdict
**ONE capability map: STRUCTURALLY COMPLETE · OVER-BUILT · UNDER-ORCHESTRATED. FROZEN.** The enhancement is
activation + consolidation, not expansion.
