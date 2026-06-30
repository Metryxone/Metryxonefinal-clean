# CAPADEX 3.0 — Enterprise Launch Readiness · Master Repository Assessment

**Date:** 2026-06-30 · **Mode:** Repository assessment (read-only). No code, schema, business logic, or
configuration was modified. **Repository is the single source of truth.**

## What this is
A complete, *measured* assessment of what exists, what works, what is partial, duplicated, dormant, or
missing — and exactly what remains before CAPADEX can launch as an enterprise platform. This is **not** a
redesign, a new constitution, a new architecture, or a V2. It only measures, verifies, classifies,
prioritizes, and produces the launch execution roadmap.

## Honesty contract applied
- Repository overrides documentation · Runtime overrides assumptions · **Database overrides memory** ·
  Code overrides comments.
- Feature-flag OFF ≠ capability exists · Table existence ≠ implementation · API existence ≠ complete
  workflow · Documentation ≠ implementation.
- Never fabricate, never estimate. `null ≠ 0`. Coverage ⟂ Confidence ⟂ Evidence (never blended).
- Where evidence was insufficient to assert a verdict, the gap is reported honestly rather than guessed.

## Deliverables (this folder)
| # | File | Deliverable |
|---|------|-------------|
| 1 | `01_CAPABILITY_INVENTORY.md` | Complete Capability Inventory |
| 2 | `02_CAPABILITY_MATURITY_MATRIX.md` | Capability Maturity Matrix |
| 3 | `03_CUSTOMER_JOURNEY_MATRIX.md` | Customer Journey Matrix |
| 4 | `04_TECHNICAL_DEBT_REGISTER.md` | Technical Debt Register |
| 5 | `05_ARCHITECTURE_DEBT_REGISTER.md` | Architecture Debt Register |
| 6 | `06_AI_READINESS_REPORT.md` | AI Readiness Report |
| 7 | `07_SECURITY_READINESS_REPORT.md` | Security Readiness Report |
| 8 | `08_PERFORMANCE_READINESS_REPORT.md` | Performance Readiness Report |
| 9 | `09_ENTERPRISE_READINESS_REPORT.md` | Enterprise Readiness Report |
| 10 | `10_LAUNCH_BLOCKERS.md` | Launch Blockers (classified) |
| 11 | `11_EXECUTION_ROADMAP.md` | Recommended Execution Roadmap |

## Measured repository baseline (evidence for everything downstream)
All numbers below were measured on 2026-06-30 from the live repository and database.

| Dimension | Measured value | How measured |
|---|---|---|
| Backend service files | **434** | `ls backend/services/*.ts` |
| Backend route files | **323** | `ls backend/routes/*.ts` |
| Backend lib files | 10 | `ls backend/lib/*.ts` |
| Backend scripts | 225 | `ls backend/scripts/*.ts` |
| Backend test files | 62 | `ls backend/tests/*.ts` |
| `backend/routes.ts` size | **14,504 lines** | `wc -l` (monolith) |
| API endpoints (approx) | **~4,000** | 300 `registerXRoutes()` + 473 inline in routes.ts + 3,570 across routes/*.ts |
| Frontend components | **545** | `find frontend/src/components -name '*.tsx'` |
| Frontend pages | 89 | `find frontend/src/pages -name '*.tsx'` |
| Largest FE files | EmployerPortalPage **10,160**, CareerBuilderPage **8,754**, UnifiedParentDashboard 5,948 | `wc -l` |
| Feature flags (file registry) | **190** (32 default-ON, **158 default-OFF**) | `backend/config/feature-flags.ts` |
| Feature flags (DB table) | 11 rows loaded at boot | `[feature-flags] initialised — 11 flags loaded` |
| Migrations | **234** | `ls backend/migrations/*.sql` |
| **Live Postgres tables** | **1,441** (public schema) | `information_schema.tables` |
| Canonical Drizzle tables | **134** | `pgTable(` in `shared/schema.ts` |
| Files doing lazy `CREATE TABLE` | **178** | `rg -l 'CREATE TABLE'` |
| Largest live table | 1,792 rows (`aig_monitoring_metrics`) | `pg_stat_user_tables` |
| Docs | 26 | `ls docs/*.md` |
| Engineering memory topics | 282 | `ls .agents/memory/*.md` |
| Real TODO/FIXME/HACK markers | **~2** (rest are scanner pattern strings) | verified by reading matches |
| `-v2` parallel files | **20** (9 route + 11 service) | `ls *-v2.ts` |
| Background jobs (setInterval/Immediate) | 34 occurrences | `rg` |
| Frontend production build | **PASSES** (46s) | `build` workflow log |

## Headline honest verdict
CAPADEX is a **large, structurally mature, security-hardened pre-launch platform** whose **core
customer-facing product runtime is implemented and ON**, while a very large **meta-intelligence layer
(MX-700 lifecycle + MX-800 enterprise intelligence) is built but dormant (OFF by design)**. The platform is
**STRUCTURALLY READY** but **NOT YET PRODUCTION-CERTIFIED**, for one fundamental, honest reason: **there is
no production traffic or realized-outcome data** (the live DB holds essentially zero real usage rows), so
runtime confidence, accuracy, performance under load, and outcome validity **cannot be measured today**.

- **Structural readiness: HIGH.** Core journeys implemented; build passes; security controls present.
- **Production confidence: WITHHELD (null, not zero).** No runtime/outcome evidence exists to measure it.
- The launch blockers are therefore **operational/validation gaps**, not large missing features. See
  `10_LAUNCH_BLOCKERS.md` and `11_EXECUTION_ROADMAP.md`.

> Integrated ≠ Certified ≠ Production-Ready. Built ≠ Activated. Validated ≠ Production-Ready.
> Human approval mandatory before any remediation, merge, or deploy. **No deployment performed.**
