# CAPADEX 3.0 · Program 3 · Phase 3.6 — Remaining Gaps (OPEN · engineering-closed via reuse)

> Deliverable 11 · Generated 2026-07-01T13:21:02.503Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9daf1995737b, written 2026-07-01T13:21:02.501Z).
> Scope: INSTRUMENT / QUESTION QUALITY ONLY — item analysis/reliability/validity/quality governance/blueprint validation/frontend/ux/APIs that measure how GOOD the assessment/question is; it NEVER scores or interprets a candidate and does NOT do norms/standardization/benchmarking/AI-interpretation/reports (= Phase 3.7+).
> Honesty: the EIGHT certification dimensions (item_analysis · reliability · validity · quality_governance · blueprint_validation · frontend · ux · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Item-level statistics ABSTAIN below k_min=30 real responses. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

**0 OPEN gaps: 0 Launch-Critical · 0 High · 0 Medium · 0 Low · 0 Future.**

All 6 former engineering gaps are **ENGINEERING-CLOSED** — per-question difficulty/discrimination/distractor, α/split-half/test-retest/inter-rater/SEM reliability, content/construct/criterion validity, question-quality checks + governance, and blueprint coverage validation — via REUSE-before-build (pure compute/validate mechanisms + own additive overlay tables), each gated by `assessmentScience` (byte-identical OFF incl. schema; DDL only on the flag-gated write paths). Item-level statistics ABSTAIN below k_min=30 real responses. The honest BOUNDARIES that remain (norms/standardization/benchmarking/AI-interpretation/reports/candidate-performance = Phase 3.7) are scope boundaries reported in-line, **NOT gaps**. What remains beyond them is **ADOPTION** — real analysed-item / response volume — a usage axis reported SEPARATELY, NEVER a gap. Coverage⟂Confidence⟂Adoption never composited; never fabricated.

## Open gaps
_None — all engineering gaps are closed._

## Resolved gaps (6) — engineering-closed via reuse
Severity of resolved work: 0 Launch-Critical · 3 High · 3 Medium · 0 Low · 0 Future.

| ID | Severity (was) | Dimension | Gap | Mechanism (reuse-before-build) |
|---|---|---|---|---|
| **GAP-ASCI-1** | High | `item_analysis` | Per-question difficulty/discrimination/distractor/facility/quality/retirement statistics. | Pure computeItemAnalysis reusing pearsonR/variance (+irt3PL/adverseImpact primitives) over the additive asci_item_stats overlay; ABSTAIN < k_min (reuse-before-build). |
| **GAP-ASCI-2** | High | `reliability` | Cronbach α / split-half / test-retest / inter-rater / SEM / CI reliability. | Pure computeReliability reusing sci-psychometric-engine (cronbachAlpha/testRetest/cohensKappa) + reliability-engine over asci_reliability; ABSTAIN < k_min. |
| **GAP-ASCI-3** | High | `validity` | Content/construct/criterion/convergent/discriminant validity evidence. | Pure computeValidity reusing constructValidity/factorLoading + blueprint content coverage over asci_validity. |
| **GAP-ASCI-4** | Medium | `quality_governance` | 6 question-quality checks + scientific/SME/validation review, approval, versioning & audit trail. | Pure validateQuestionQuality (duplicate/ambiguity/bias/readability/option-balance/clarity) + governance workflow over asci_quality_flags/asci_governance (composing quality-validator). |
| **GAP-ASCI-5** | Medium | `blueprint_validation` | Competency/behaviour/domain/skill coverage + Bloom/difficulty/time distribution validation. | Pure validateBlueprint composing assessment-blueprint-engine.generateBlueprint over asci_blueprints. |
| **GAP-ASCI-6** | Medium | `apis` | Unified science API surface + versioned science repository. | routes/assessment-science.ts (item/reliability/validity/quality/blueprint/repository) over the additive asci_repository overlay. |
