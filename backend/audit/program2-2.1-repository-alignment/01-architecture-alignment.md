# Program 2 · Phase 2.1 — 01 · Architecture Alignment Report

**Mode:** Enhancement-Only · Search-Before-Modify · Repository-evidence only. No new features/architecture/V2.
**Precondition:** Program 1 Certification = COMPLETE (verified). Phase 2.1 cleared to run.

## 1. Topology (measured)
Node.js + Express + tsx backend in `backend/`. No compile step in prod (runs on tsx); the only build gate is the frontend Vite build.

| Layer | Location | Count |
|---|---|---|
| Route modules | `backend/routes/*.ts` | 332 |
| Main route monolith | `backend/routes.ts` | 1 file, 14,524 lines |
| Services / engines | `backend/services/*.ts` | 442 |
| Shared libs | `backend/lib/*.ts` | 11 |
| Config (incl. flag registry) | `backend/config/*.ts` | 7 |
| Drizzle schema | `backend/shared/schema.ts` | 3,569 lines |
| Scripts (seeds/audits/smokes) | `backend/scripts/*.ts` | 247 |
| Tests | `backend/tests/*.ts` | 63 |

Largest source files: `routes.ts` (14,524), `storage.ts` (5,057), `routes/capadex.ts` (4,462), `shared/schema.ts` (3,569), `routes/capadex-concern-intelligence.ts` (3,117), `config/feature-flags.ts` (2,928), `services/competency-runtime.ts` (2,827), `routes/employer-portal.ts` (2,495).

## 2. Architectural patterns that ARE consistent (keep)
- **Engine/route separation** — business logic lives in `services/*-engine.ts`; routes compose them. Heavily reused engines (evidence, ontology, validation-loop, cohort-gating/`K_MIN`).
- **Flag-gated additive phases** — every additive phase ships behind a file-registry flag; flag-OFF is byte-identical incl. schema. Confirmed for all CAPADEX 3.0 phases (1.2–1.8): flag + public-config + config + service + route + getter all present.
- **Lazy `ensureSchema()` + canonical migration mirror** — newer tables created on first flag-ON write; OFF creates 0 tables.
- **Idempotency via `ON CONFLICT`** rather than long transactions.
- **Never-throws read composers** — GET composers return null-on-error, never 500 on absent data (`null ≠ 0`).

## 3. Architectural drift / inconsistency (evidence-backed, NOT yet changed)
| # | Drift | Evidence | Severity |
|---|---|---|---|
| A1 | **Route monolith** — 14.5k-line `routes.ts` mixes ~all domains alongside 332 modular route files | `routes.ts` line count; modular files exist in parallel | Medium (maintainability) |
| A2 | **Duplicate route registrations** — same method+path registered twice in `routes.ts` (later one is dead in Express) | 7 confirmed pairs (see report 03) | High (correctness/security) |
| A3 | **Dual schema source-of-truth** — Drizzle `schema.ts` vs raw-SQL `ensureSchema()`; many lazy tables absent from `schema.ts` | per DB explore; e.g. `mei_scores`, `prediction_registry`, `jt_*` | Medium (drift risk) |
| A4 | **`-v2` + bare both registered** — for several domains both the `-v2` and the original route module are imported/registered | `routes.ts` imports: predictive-intelligence(171/181), workforce-os(135/180), governance(172/214), competency-runtime(94/132), adaptive-assessment(133/320) | Medium (intentional? needs per-route confirmation) |
| A5 | **Mixed API conventions** — validation/response/error/logging are inconsistent between legacy `routes.ts` and newer modular routes | see report 03 | Low–Medium |

## 4. Honest position on `-v2` (A4)
`-v2` naming does **not** imply dead code. The flag registry shows `advancedCompetencyRuntimeV2`, `adaptiveAssessmentRuntimeV2`, `contextualScoringV2`, `workforceOSV2` default **ON** — i.e. the `-v2` modules are the **active** runtime. Both `-v2` and bare modules are imported and registered (almost certainly at different base paths). **No `-v2` module was removed**; doing so without per-route path/behavior confirmation would risk regressions. Reconciliation is listed in report 06 as approval-gated.

## 5. Verdict
Architecture is **stable and internally coherent** for a platform of this size. Drift is concentrated in (a) the route monolith + duplicate registrations and (b) schema dual-truth. None of these were altered in this phase beyond the single zero-risk cleanup (report 04). Structural alignment is **preserved**, not redesigned — consistent with Enhancement-Only.
