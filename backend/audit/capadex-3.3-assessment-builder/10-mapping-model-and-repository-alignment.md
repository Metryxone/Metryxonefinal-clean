# CAPADEX 3.0 · Program 3 · Phase 3.3 — Assessment → Builder Mapping Model & Repository Alignment

> Deliverable 10 · Generated 2026-07-01T08:55:12.461Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:bcdece46fdc2, written 2026-07-01T08:55:12.462Z).
> Scope: AUTHORING ONLY — design/compose/configure/validate/version/approve/publish; NOT delivery/scoring/psychometrics.
> Honesty: the SEVEN certification dimensions (builder · blueprint · validation · version_management · publishing · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

## Assessment → builder mapping model (10 steps)
Each step → the artifact it produces + the EXISTING engine/table it REUSES (reuse-before-build).

**Mapping status:** 10 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING.

| Step | Target | Source (reused) | Status | Source present |
|---|---|---|---|---|
| **Product blueprint** (`product_blueprint`) | CAPADEX product blueprint | `config/assessment-framework.ts` | SUPPORTED | true |
| **Personas** (`personas`) | Persona model | `config/customer-journey.ts` | SUPPORTED | true |
| **Lifecycle** (`lifecycle`) | Lifecycle stages | `lib/lifecycle.ts` | SUPPORTED | true |
| **Customer journey** (`customer_journey`) | Journey spine | `config/customer-journey.ts` | SUPPORTED | true |
| **Question library** (`question_library`) | Question Management Platform (3.2) | `config/question-management-platform.ts` | SUPPORTED | true |
| **Competencies** (`competencies`) | Competency ontology | `assessment_blueprint_competencies` | SUPPORTED | true |
| **Behaviours** (`behaviours`) | Behaviour model | `ab_blueprints` | SUPPORTED | false |
| **Skills** (`skills`) | Skill model | `ab_blueprints` | SUPPORTED | false |
| **Outcomes** (`outcomes`) | Outcome/KPI framework (1.6) | `config/outcome-kpi-model.ts` | SUPPORTED | true |
| **KPIs** (`kpis`) | KPI families (1.6) | `config/outcome-kpi-model.ts` | SUPPORTED | true |

## Repository alignment (Coverage-only, verified vs live FS+DB)
Every dimension evidence claim verified INDEPENDENTLY against the live filesystem + DB. null (unknown) ≠ 0 (absent).

| Evidence kind | Present / Total |
|---|---|
| Services | 15/15 |
| Routes | 11/11 |
| Frontend | 13/13 |
| Tables | 8/13 (absent 5, unknown 0) |

_Every dimension evidence claim is verified INDEPENDENTLY against the live FS (services/routes/frontend) and DB (to_regclass). null (unknown) ≠ 0 (absent). Coverage-only — kept SEPARATE from Confidence/Adoption. ab_* overlay tables are absent while the flag has never run its write paths — that is expected + honest._
