# CAPADEX 3.0 · Program 3 · Phase 3.6 — Reliability Report (dimension 2 · reliability)

> Deliverable 03 · Generated 2026-07-01T13:21:02.503Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9daf1995737b, written 2026-07-01T13:21:02.501Z).
> Scope: INSTRUMENT / QUESTION QUALITY ONLY — item analysis/reliability/validity/quality governance/blueprint validation/frontend/ux/APIs that measure how GOOD the assessment/question is; it NEVER scores or interprets a candidate and does NOT do norms/standardization/benchmarking/AI-interpretation/reports (= Phase 3.7+).
> Honesty: the EIGHT certification dimensions (item_analysis · reliability · validity · quality_governance · blueprint_validation · frontend · ux · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Item-level statistics ABSTAIN below k_min=30 real responses. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Internal consistency (Cronbach α), split-half (Spearman-Brown), test-retest, inter-rater (Cohen κ), parallel-forms, SEM and a score confidence interval — via the pure `computeReliability` mechanism over a respondents × items matrix + the additive `asci_reliability` overlay. ABSTAINS below k_min=30 respondents.

**Reliability types:** 6 SUPPORTED · 1 PARTIAL · 0 DEAD_END · 0 MISSING (7 total).

| Capability | Status | Anchors |
|---|---|---|
| **Internal consistency (Cronbach α)** (`internal_consistency`) | SUPPORTED | services/sci-psychometric-engine.ts, services/assessment-science-mechanisms.ts, asci_reliability |
| **Split-half reliability** (`split_half`) | SUPPORTED | services/assessment-science-mechanisms.ts, asci_reliability |
| **Test-retest reliability** (`test_retest`) | SUPPORTED | services/sci-psychometric-engine.ts, asci_reliability |
| **Inter-rater reliability (Cohen κ)** (`inter_rater`) | SUPPORTED | services/sci-psychometric-engine.ts, asci_reliability |
| **Parallel-forms reliability** (`parallel_forms`) | PARTIAL | services/assessment-science-mechanisms.ts, asci_reliability |
| **Standard error of measurement (SEM)** (`sem`) | SUPPORTED | services/assessment-science-mechanisms.ts, asci_reliability |
| **Score confidence interval** (`confidence_interval`) | SUPPORTED | services/assessment-science-mechanisms.ts, asci_reliability |

### Reliability (`reliability`) — SUPPORTED
_ONE canonical reliability layer (asci_reliability) composing the EXISTING reliability engines — Cronbach α (sci-psychometric-engine.cronbachAlpha), test-retest, Cohen κ inter-rater, split-half, SEM & score CI via the pure computeReliability mechanism. Parallel-forms stays PARTIAL until a second equated form exists. Reliability ABSTAINS below k_min respondents. No duplicate reliability engine._

- **Services**: services/sci-psychometric-engine.ts, services/reliability-engine.ts, services/assessment-science-mechanisms.ts, services/assessment-science-engine.ts
- **Routes**: routes/assessment-science.ts
- **Frontend**: components/science/PsychometricsWorkbench.tsx
- **Tables**: capadex_sessions, capadex_responses, asci_reliability
- **Verified**: svc 4/4 · rt 1/1 · fe 1/1 · tbl 2/3

