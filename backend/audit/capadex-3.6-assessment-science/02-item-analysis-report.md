# CAPADEX 3.0 · Program 3 · Phase 3.6 — Item Analysis Report (dimension 1 · item_analysis)

> Deliverable 02 · Generated 2026-07-01T13:21:02.503Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9daf1995737b, written 2026-07-01T13:21:02.501Z).
> Scope: INSTRUMENT / QUESTION QUALITY ONLY — item analysis/reliability/validity/quality governance/blueprint validation/frontend/ux/APIs that measure how GOOD the assessment/question is; it NEVER scores or interprets a candidate and does NOT do norms/standardization/benchmarking/AI-interpretation/reports (= Phase 3.7+).
> Honesty: the EIGHT certification dimensions (item_analysis · reliability · validity · quality_governance · blueprint_validation · frontend · ux · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Item-level statistics ABSTAIN below k_min=30 real responses. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Per-item difficulty (p-value), corrected item-total discrimination (point-biserial), distractor analysis, facility, exposure, IRT information, quality score, bias (DIF) primitive & retirement recommendation — via the pure `computeItemAnalysis` mechanism reusing the existing psychometric services + the additive `asci_item_stats` overlay. Every statistic ABSTAINS below k_min=30 real responses; nothing is fabricated on thin data.

**Item-analysis metrics:** 6 SUPPORTED · 3 PARTIAL · 0 DEAD_END · 0 MISSING (9 total).

| Capability | Status | Note |
|---|---|---|
| **Difficulty (p-value)** (`difficulty`) | SUPPORTED | Proportion answering an item in the keyed direction (mean item score / max) — pure computeItemAnalysis; ABSTAIN < k_min responses. |
| **Discrimination (point-biserial)** (`discrimination`) | SUPPORTED | Correlation of item score with total score (pearsonR) — how well the item separates high/low performers; ABSTAIN < k_min. |
| **Distractor analysis** (`distractor_analysis`) | SUPPORTED | Per-option selection frequency + non-functioning-distractor flag for MCQ items; ABSTAIN < k_min. |
| **Item facility** (`item_facility`) | SUPPORTED | Ease index (1 − difficulty) surfaced alongside p-value; ABSTAIN < k_min. |
| **Item exposure** (`item_exposure`) | PARTIAL | Times an item has been served (response volume). Overexposure control requires an adaptive delivery pool — a Phase-3.7 boundary. |
| **Item information (IRT)** (`item_information`) | PARTIAL | 3PL item-information function (irt3PL) available; full IRT calibration needs a large calibrated pool (k_min ≫ 30) — honest PARTIAL until adoption volume exists. |
| **Item quality score** (`item_quality_score`) | SUPPORTED | Composite of difficulty band + discrimination band + distractor health + quality flags — read-only classification, never candidate-facing. |
| **Item bias (DIF)** (`item_bias`) | PARTIAL | Differential-item-functioning / adverse-impact primitive (adverseImpact) available; group-level DIF needs demographic tags + k_min per group — ethics-gated + Phase-3.7 boundary. |
| **Retirement recommendation** (`retirement_recommendation`) | SUPPORTED | Read-only recommend-to-retire flag for items failing difficulty/discrimination/distractor thresholds — advisory only, never auto-retires. |

### Item Analysis (`item_analysis`) — SUPPORTED
_ONE canonical item-analysis layer (asci_item_stats) computing difficulty/discrimination/distractor/facility/quality/retirement per question via the pure computeItemAnalysis mechanism (reusing pearsonR/variance from psychometric-intelligence-engine + irt3PL/adverseImpact for the IRT/DIF primitives). Item statistics ABSTAIN below k_min real responses (currently honest-low volume). Full IRT calibration, exposure control & group-level DIF stay PARTIAL — Phase-3.7 boundaries, not gaps._

- **Services**: services/psychometric-intelligence-engine.ts, services/sci-psychometric-engine.ts, services/assessment-science-engine.ts, services/assessment-science-mechanisms.ts
- **Routes**: routes/assessment-science.ts
- **Frontend**: components/superadmin/AssessmentSciencePanel.tsx, components/science/PsychometricsWorkbench.tsx
- **Tables**: adaptive_question_bank, sdi_items, capadex_responses, asci_item_stats
- **Verified**: svc 4/4 · rt 1/1 · fe 2/2 · tbl 3/4


_IRT item-information (`item_information`) and DIF (`item_bias`) are PARTIAL: the primitives are implemented but full IRT calibration / group-level DIF need a large calibrated pool (k_min ≫ 30) + demographic tags (ethics-gated). That is a Phase-3.7 boundary + an adoption/data dependency, NOT an engineering gap._
