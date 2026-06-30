# CAPADEX 3.0 — Repository Enhancement & Product Maturity Assessment

**Date:** 2026-06-30 · **Mode:** Enhancement assessment (READ-ONLY). No redesign, no V2, no new
architecture, no duplicate capabilities, no business-logic change, no deploy. Search → Measure → Validate →
Cross-reference → Compare → Prioritize → Recommend → **STOP for approval.**

## What this is (and is NOT)
This is an **enhancement** assessment: it identifies *every measurable, repository-backed enhancement* that
would move CAPADEX toward a world-class enterprise platform **without changing business logic**. It is a
companion to — not a replacement for — the launch-readiness assessment in
`backend/audit/capadex-3.0-launch-readiness/` (which classifies blockers). Where that asked *"is it ready?"*,
this asks *"what enhancements deliver the greatest customer/enterprise value before go-live?"*

## Honesty contract (applied throughout)
- Existing capability ≠ Mature · Existing workflow ≠ Enterprise-ready · Existing AI ≠ Validated AI ·
  Existing UI ≠ Excellent UX · Existing reports ≠ Customer-ready reports.
- Repository overrides documentation · Runtime overrides assumptions · Database overrides memory.
- **Never fabricate. Never estimate.** `null ≠ 0`. Coverage ⟂ Confidence ⟂ Evidence (never blended).
- Every enhancement carries: repository evidence · business justification · customer impact · technical
  impact · dependencies · risk · effort · priority · launch impact.

## Deliverables (this folder)
| # | File | Purpose |
|---|---|---|
| 01 | `01_ENHANCEMENT_INVENTORY.md` | Master list of every identified enhancement |
| 02 | `02_CAPABILITY_ENHANCEMENT_MATRIX.md` | Per-capability maturity + enhancement opportunities |
| 03 | `03_PERSONA_COVERAGE_MATRIX.md` | Supported / Partial / Missing per persona |
| 04 | `04_ASSESSMENT_COVERAGE_MATRIX.md` | Entry/Progress/Exit assessment coverage + gaps |
| 05 | `05_CUSTOMER_JOURNEY_ENHANCEMENT_MATRIX.md` | Journey-stage enhancements |
| 06 | `06_AI_ENHANCEMENT_MATRIX.md` | Explainability/confidence/evidence/personalization enhancements |
| 07 | `07_UX_ENHANCEMENT_MATRIX.md` | Dashboards/reports/navigation/accessibility/mobile |
| 08 | `08_PERFORMANCE_ENHANCEMENT_MATRIX.md` | Bundle/runtime/scaling enhancements |
| 09 | `09_SECURITY_ENHANCEMENT_MATRIX.md` | Hardening enhancements |
| 10 | `10_TECHNICAL_DEBT_ENHANCEMENT_MATRIX.md` | Debt paydown enhancements |
| 11 | `11_PRODUCT_MATURITY_MATRIX.md` | Maturity level per domain |
| 12 | `12_PRIORITIZED_ENHANCEMENT_BACKLOG.md` | Ranked backlog + the final-question answer |

## Measured repository baseline (2026-06-30, repo as source of truth)
| Dimension | Measured | How |
|---|---|---|
| Backend services | 434 | `find backend/services -name '*.ts'` |
| Backend route files | 323 | `find backend/routes -name '*.ts'` |
| `routes.ts` size | 14,504 lines | `wc -l` |
| API endpoint registrations (counted sum) | 4,343 (300 `registerX` + 473 inline + 3,570 in routes/*.ts) — **not** de-duplicated to distinct paths (honest caveat, not an estimate) | grep counts |
| Feature flags (file registry) | **190** (32 ON / 158 OFF) | `backend/config/feature-flags.ts` |
| Migrations | 234 | `ls backend/migrations/*.sql` |
| Live Postgres tables | 1,441 | `information_schema.tables` |
| Canonical Drizzle tables | 134 | `pgTable(` in `shared/schema.ts` |
| Frontend components / pages | 545 / 89 | `find frontend/src` |
| Largest FE files | EmployerPortalPage 10,160 · CareerBuilderPage 8,754 · UnifiedParentDashboard 5,948 | `wc -l` |
| Frontend prod build | PASSES (46s); largest chunks index 1.62 MB / CareerBuilder 1.23 MB / EmployerPortal 1.16 MB | `build` workflow |

## Headline
CAPADEX is **broad and structurally strong** — most personas, journeys, AI surfaces, and reports already
exist, with genuinely good honesty engineering (source tags, confidence intervals, null≠0, k-anonymity). The
enhancement opportunity is therefore **not "build missing capability"** — it is **maturation**: decompose a
few unsustainable monoliths, validate AI quality, complete partial persona/journey paths, lift accessibility
to WCAG, and add the operational scaffolding (CI/coverage, load gate, observability) an enterprise buyer
expects. **No redesign required.** See `12_PRIORITIZED_ENHANCEMENT_BACKLOG.md` for the ranked answer.
