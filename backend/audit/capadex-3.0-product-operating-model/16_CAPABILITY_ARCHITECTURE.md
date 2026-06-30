# 16 · Capability Architecture

Measured capability surface (repo SSoT, 2026-06-30).

## Measured size
| Metric | Value | Command |
|---|---|---|
| Backend services | **587** | `find backend/services -name '*.ts' \| wc -l` |
| Route files | **323** | `find backend/routes -name '*.ts' \| wc -l` |
| `routes.ts` size | **14,504 lines** | `wc -l backend/routes.ts` |
| Feature flags (file registry) | **190** (32 ON / 158 OFF) | `feature-flags.ts` grep |
| Migrations | **234** | `ls backend/migrations/*.sql` |
| Canonical Drizzle tables | **134** | `pgTable(` in `schema.ts` |
| Live PG tables | **~1,441** | prior measured (lazy ensure-schema sprawl) |
| Report builders | **22** | `report-pack.ts` |
| Frontend pages / components | **89 / 545** | `find frontend/src/{pages,components}` |

## Capability-architecture findings (honest)
- **Capability *breadth* is exceptional** (587 services, 190 flags). The product is feature-complete-and-then-
  some structurally.
- **83% of flags are OFF (158/190)** — a vast **dormant** surface (MX-700/MX-800 tiers). This is honest
  default-OFF dormancy (byte-identical), **not** scope drift — but it confirms **Connected ≠ Orchestrated**:
  capabilities exist but aren't activated/coordinated as one product.
- **`routes.ts` at 14,504 lines and 3 monoliths** (EmployerPortalPage 10k, CareerBuilderPage 8.7k,
  UnifiedParentDashboard 5.9k) are maintainability debt, not functional gaps.
- **Schema sprawl (1,441 live vs 134 canonical)** is a coherence risk from lazy ensure-schema — well
  documented, guarded (`to_regclass` probes), but a long-term debt.

## Verdict
**Capability architecture: STRUCTURALLY COMPLETE, OVER-BUILT, UNDER-ORCHESTRATED.** The enhancement is
*activation discipline + consolidation* (turn dormant tiers on deliberately; resolve `-v2` duplication;
decompose monoliths), not building more. Maturity-limiting factor is orchestration, not capability count.
