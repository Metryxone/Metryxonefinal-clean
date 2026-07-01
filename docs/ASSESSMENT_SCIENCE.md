# Assessment Science / Psychometrics / Item Intelligence (CAPADEX 3.0 · Program 3 · Phase 3.6)

> Single source of truth for the Assessment Science layer. Detail lives here + `.agents/memory/assessment-science.md`; the Feature Map pointer in `replit.md` is a navigation stub only.

## What it is
The **ONE canonical Assessment Science / Psychometrics / Item Intelligence layer** — a single certified **INSTRUMENT-QUALITY** layer that COMPOSES the existing psychometric services (`psychometric-intelligence-engine`, `sci-psychometric-engine`, `reliability-engine`, `quality-validator`, `assessment-blueprint-engine`) under one registry (`config/assessment-science.ts`) plus an additive `asci_*` overlay. **No duplicate psychometric engine, no V2, no breaking change.** Mirrors Phases 1.3–1.7 / 3.1–3.5.

## Scope (freeze — ASCI-D2/D3)
INSTRUMENT / QUESTION QUALITY ONLY — it measures how **GOOD the assessment/question is** (item analysis · reliability · validity · quality governance · blueprint validation) and:
- **NEVER** scores or interprets a candidate.
- Does **NOT** run norms, standardization, benchmarking, AI-interpretation, recommendations, report intelligence, or candidate-performance analytics — **that is Phase 3.7**.

## The eight INDEPENDENT dimensions (reported SEPARATELY — never composited)
`item_analysis · reliability · validity · quality_governance · blueprint_validation · frontend · ux · apis`

| # | Dimension | Result (scan) |
|---|---|---|
| 1 | Item analysis (9 metrics) | 6 SUPPORTED · 3 PARTIAL |
| 2 | Reliability (7 types) | 6 SUPPORTED · 1 PARTIAL |
| 3 | Validity (8 types) | 5 SUPPORTED · 3 PARTIAL |
| 4 | Quality & governance (6 checks · 7 stages) | 6 SUPPORTED / 6 SUPPORTED · 1 PARTIAL |
| 5 | Blueprint validation (8 controls) | 7 SUPPORTED · 1 PARTIAL |
| 6 | Frontend | fe 10/10 |
| 7 | UX | interactive workbench (ABSTAIN/empty/loading/error states) |
| 8 | APIs — mapping (10 steps) | 9 SUPPORTED · 1 PARTIAL |

Every `axis_dimensions` entry is SUPPORTED; the PARTIAL entries live inside the catalogs (IRT/exposure/DIF, parallel-forms, face/concurrent/predictive validity, pilot-testing, learning-objective coverage) and are Phase-3.7 boundaries, not gaps.

## Mechanisms (reuse-before-build — pure, no DB unless `persist=true`)
- `computeItemAnalysis` — difficulty (p-value) · discrimination (point-biserial) · distractor analysis · facility · exposure · IRT item-information (3PL primitive) · quality score · DIF (adverse-impact primitive) · retirement recommendation. Reuses `pearsonR`/`variance` + `irt3PL`/`adverseImpact`.
- `computeReliability` — Cronbach α · split-half (Spearman-Brown) · test-retest · inter-rater (Cohen κ) · parallel-forms · SEM · score CI. Reuses `sci-psychometric-engine` + `reliability-engine`.
- `computeValidity` — face · content · construct · criterion · concurrent · predictive · convergent · discriminant. Reuses `constructValidity`/`factorLoading` + blueprint content coverage.
- `validateQuestionQuality` — duplicate/ambiguity/bias/readability/option-balance/clarity (pure authoring gate; composes `quality-validator`).
- `validateBlueprint` — competency/behaviour/domain/skill/objective coverage + Bloom/difficulty/time distribution (composes `assessment-blueprint-engine.generateBlueprint`).

**All item-level statistics ABSTAIN below `ASCI_K_MIN=30` real responses — never fabricated on thin data.**

## Files
- `backend/config/assessment-science.ts` — registry (`ASCI_DIMENSIONS`, `ITEM_ANALYSIS_METRICS`, `QUALITY_CHECKS`, `RELIABILITY_TYPES`, `VALIDITY_TYPES`, `GOVERNANCE_STAGES`, `BLUEPRINT_COVERAGE`, `MAPPING_MODEL`, `ASCI_DECISIONS`, `ASCI_GAPS=[]`, `RESOLVED_ASCI_GAPS`=6).
- `backend/services/assessment-science-mechanisms.ts` — pure compute/validate mechanisms + `asci_*` overlay ensure-schema/save (**DDL only on flag-gated write paths**).
- `backend/services/assessment-science-engine.ts` — read-only composer (`composeDimensions`/`composeMapping`/`composeRepositoryAlignment`/`composeAdoption`/`composeSummary` + `classifiedGaps`; `readScalar`/`readRows` null-on-error, `to_regclass` + fs probes only).
- `backend/routes/assessment-science.ts` — `/api/assessment-science/enabled` flag probe + super-admin cert GETs + pure mechanism POSTs + overlay writes.
- `frontend/src/components/superadmin/AssessmentSciencePanel.tsx` + `frontend/src/components/science/PsychometricsWorkbench.tsx`.
- `backend/scripts/capadex-3.6-assessment-science-scan.ts` → `backend/audit/capadex-3.6-assessment-science/scan.json`; `capadex-3.6-generate-deliverables.ts` reads ONLY scan.json → **13 deliverables** (`01-executive-summary`…`13-phase-3.6-certification`).

## Flag & wiring
- Flag `assessmentScience` / env `FF_ASSESSMENT_SCIENCE` (default OFF). `isAssessmentScienceEnabled()` in `config/feature-flags.ts`.
- `routes.ts` — `registerAssessmentScienceRoutes(...)`.
- **public-config dual import-site:** `routes/capadex.ts` `/public-config` `assessment_science` must IMPORT `isAssessmentScienceEnabled` or the endpoint 500s.
- `SuperAdminDashboard.tsx` — lazy panel + `/enabled` probe + conditional-spread nav (tab hidden OFF).

## OFF behaviour (byte-identical incl. schema)
- `/api/assessment-science/enabled` → 503; `/api/admin/assessment-science/*` → 401 (global `/api/admin` gate); public-config `assessment_science:false`.
- Cert GETs are read-only (`to_regclass`/fs probes) — no DDL at read time. The `asci_*` overlay DDL runs **ONLY** on the flag-gated mechanism write paths → **OFF creates 0 tables** (scan reads tbl 6/13, the 7 `asci_*` overlay tables ABSENT until a flag-gated write runs — honest, not a defect).
- OFF smoke ∈ {401, 403, 503}.

## Verdict
`STRUCTURAL_COMPLETE_ADOPTION_PENDING` — 8/8 `axis_dimensions` SUPPORTED · repo-align svc 19/19 · rt 6/6 · fe 10/10 · tbl 6/13. **`ASCI_GAPS=[]` (0 OPEN) · 6 RESOLVED via reuse** (GAP-ASCI-1..6: 3 High · 3 Medium). **ready_for_phase_3_7: YES.**

## Honesty invariants (ASCI-D1..D5)
- Coverage ⟂ Confidence ⟂ Adoption — never composited; no single composite score.
- Adoption (real analysed-item / response volume) is a SEPARATE usage axis, **never a gap**, never fabricated as adopted.
- Item-level statistics ABSTAIN below k_min=30; null (unreadable) ≠ 0 (empty).
- Phase-3.7 boundaries (norms/standardization/benchmarking/AI/reports/candidate-performance) are scope boundaries reported in-line, **NOT gaps**.
