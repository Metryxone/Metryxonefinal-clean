# Assessment Intelligence / Interpretation & Reporting (CAPADEX 3.0 · Program 3 · Phase 3.7)

> Single source of truth for the Assessment Intelligence layer. Detail lives here + `.agents/memory/assessment-intelligence.md`; the Feature Map pointer in `replit.md` is a navigation stub only.

## What it is
The **ONE canonical Assessment Intelligence / Interpretation & Reporting layer** — a single certified **INTERPRETATION** layer that COMPOSES the existing interpretation services (`psychometric-standardization`, `benchmark-engine`, `peer-benchmark`, `intelligence-narrative-engine`, `ai-reasoning-engine`, `dynamic-report`) under one registry (`config/assessment-intelligence.ts`) plus an additive `aint_*` overlay. **No duplicate interpretation / benchmark / narrative / report engine, no V2, no breaking change.** Mirrors Phases 1.3–1.7 / 3.1–3.6.

## Scope (freeze — AINT-D1/D2/D3)
INTERPRETATION & REPORTING ONLY — it turns a **SCORED + VALIDATED** result (3.5 Scoring + 3.6 Science) into **MEANING** (norm-referencing · standardization · benchmarking · AI-interpretation · report intelligence · candidate performance) and:
- **NEVER** re-scores or re-validates the instrument (that is 3.5 / 3.6).
- Consumes measurable scores (3.5) + the reliability/validity/norm handoff (3.6) downstream.
- Realized outcomes & KPI roll-up are the downstream Outcome/KPI scope, not this layer.

## The eight INDEPENDENT dimensions (reported SEPARATELY — never composited)
`norms · standardization · benchmarking · ai_interpretation · report_intelligence · candidate_performance · frontend · apis`

| # | Dimension | Result (scan) |
|---|---|---|
| 1 | Norm referencing (7 types) | 4 SUPPORTED · 3 PARTIAL |
| 2 | Standardization (8 types) | 6 SUPPORTED · 2 PARTIAL |
| 3 | Benchmarking (6 scopes) | 4 SUPPORTED · 2 PARTIAL |
| 4 | AI interpretation (6 capabilities) | 5 SUPPORTED · 1 PARTIAL |
| 5 | Report intelligence (8 sections) | 7 SUPPORTED · 1 PARTIAL |
| 6 | Candidate performance (8 metrics) | 6 SUPPORTED · 2 PARTIAL |
| 7 | Frontend | fe 9/9 |
| 8 | APIs — mapping (9 steps) | 8 SUPPORTED · 1 PARTIAL |

Every `axis_dimensions` entry is SUPPORTED; the PARTIAL entries live inside the catalogs (age/national/custom norms, NCE/scaled scores, institution/national benchmarks, interpretation confidence, next-steps action plans, response consistency/timing) and are **data-availability / first-class-objective boundaries**, not gaps.

## Mechanisms (reuse-before-build — pure, no DB unless `persist=true`)
- `computeNormReference` — cohort / role / stage / self (ipsative) / age / national / custom norm-referencing. Reuses `peer-benchmark` (cohort) + `benchmark-engine` (role) + stage bands + longitudinal snapshots (self) + the `aint_norm_tables` overlay. **ABSTAINS below `AINT_K_MIN=30` real members.**
- `computeStandardScores` — percentile · z · T (μ=50,σ=10) · stanine (1–9) · sten (1–10) · deviation (μ=100,σ=15). Reuses the pure `psychometric-standardization` functions (`zToPercentile`/`zFromValue`/`zToT`/`zToStanine`/`zToSten`/`zToDeviationScore`).
- `computeBenchmark` — peer-cohort · role · stage · temporal-self · institution · national. Reuses `peer-benchmark` + `benchmark-engine` + `wc3_longitudinal_snapshots`. **ABSTAINS below k_min.**
- `computeInterpretation` — narrative generation · strength · development-area · reasoning chain · recommendation. Reuses `intelligence-narrative-engine` + `ai-reasoning-engine` + `development_recommendations`. **Confidence stays honest-null while cold-start.**
- `computeReport` — overview → score summary → norm → benchmark → narrative → strengths/development → recommendations → next steps. Reuses `dynamic-report` + the interpretation artefacts.
- `computePerformance` — overall standing · dimension profile · percentile · peer-relative · growth trajectory · readiness band · response consistency · response-time. Reuses standardization + `peer-benchmark` + longitudinal substrate. **ABSTAINS below k_min where a reference group is required.**

**All norm-referenced statistics + benchmarks ABSTAIN below `AINT_K_MIN=30` real members — never fabricated on thin data.**

## Files
- `backend/config/assessment-intelligence.ts` — registry (`AINT_DIMENSIONS`, `NORM_TYPES`, `STANDARD_SCORE_TYPES`, `BENCHMARK_SCOPES`, `AI_INTERPRETATION_CAPABILITIES`, `REPORT_SECTIONS`, `PERFORMANCE_METRICS`, `MAPPING_MODEL`, `AINT_DECISIONS` D1–D5, `AINT_K_MIN=30`, `AINT_GAPS=[]`, `RESOLVED_AINT_GAPS`=6).
- `backend/services/assessment-intelligence-mechanisms.ts` — pure compute mechanisms + `aint_*` overlay ensure-schema/save (**DDL only on flag-gated write paths**).
- `backend/services/assessment-intelligence-engine.ts` — never-throws read-only composer (`composeDimensions`/`composeMapping`/`composeRepositoryAlignment`/`composeAdoption`/`composeSummary` + `classifiedGaps`; catalog composers are INTERNAL to `composeSummary`).
- `backend/routes/assessment-intelligence.ts` — `/api/assessment-intelligence/enabled` probe + super-admin cert GETs + pure mechanism POSTs (`compute/{standard-scores,norm-reference,benchmark,interpretation,report,performance}`) + overlay writes (`{norm-tables,standard-scores,benchmarks,interpretations,reports,performance,repository}/save` + list GETs).
- `backend/scripts/capadex-3.7-assessment-intelligence-scan.ts` → `audit/capadex-3.7-assessment-intelligence/scan.json` (SSoT).
- `backend/scripts/capadex-3.7-generate-deliverables.ts` — reads ONLY scan.json → **13 deliverables** (`01-executive-summary` … `12-adoption-report`, `13-phase-3.7-certification`; asserts EXACTLY 13 by name).
- `frontend/src/components/superadmin/AssessmentIntelligencePanel.tsx` + `frontend/src/components/intelligence/InterpretationWorkbench.tsx` — super-admin console + interactive workbench (ABSTAIN/empty/loading/error states).

## Flag & wiring (byte-identical OFF)
- `config/feature-flags.ts`: `assessmentIntelligence:false` + `isAssessmentIntelligenceEnabled()` (env `FF_ASSESSMENT_INTELLIGENCE`).
- `routes.ts`: `registerAssessmentIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin)`.
- `routes/capadex.ts`: public-config `assessment_intelligence` (**dual import-site** — getter import + key; 500s if the getter import is missed).
- `SuperAdminDashboard.tsx`: lazy panel + `/enabled` probe + conditional-spread nav (hidden OFF).

## OFF contract (verified)
- `/api/assessment-intelligence/enabled` → **503** (flag-gate before auth).
- `/api/admin/assessment-intelligence/*` → **401** (global `/api/admin` gate). OFF smoke ∈ {401, 403, 503}.
- public-config `assessment_intelligence:false`.
- **0 `aint_*` tables** (DDL only on flag-gated write paths).

## Verdict
`STRUCTURAL_COMPLETE_ADOPTION_PENDING` · **ready_for_certification: YES** (0 Launch-Critical gaps).
- All 8 `axis_dimensions` SUPPORTED; repo-align svc 20/20 · rt 7/7 · fe 9/9 · **tbl 6/14** (the `aint_*` overlay tables read ABSENT until flag-gated mechanism POSTs run — HONEST, not a defect).
- `AINT_GAPS=[]` (0 OPEN) + `RESOLVED_AINT_GAPS`=6 (GAP-AINT-1..6: 3 High · 3 Medium) engineering-closed via reuse.

**Engineering closure ⟂ Adoption:** every gap's mechanism EXISTS, but real interpreted / standardized / benchmarked / narrated / reported VOLUME across the overlay is honest-low/0 — a usage axis reported SEPARATELY, NEVER a gap, NEVER fabricated as adopted; norm-referenced statistics + benchmarks ABSTAIN below k_min=30; AI narrative confidence stays honest-null while cold-start. The remaining PARTIAL entries are data-availability / first-class-objective boundaries, NOT gaps. Coverage⟂Confidence⟂Adoption never composited; null≠0; never fabricate.
