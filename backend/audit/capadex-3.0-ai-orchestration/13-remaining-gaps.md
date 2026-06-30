# CAPADEX 3.0 · Phase 1.7 — Remaining Gaps (classified)

> Deliverable 13 · Generated 2026-06-30T15:05:09.697Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:88fda7ccb736, written 2026-06-30T15:05:09.695Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

**OPEN engineering gaps: 2** (Launch-Critical 0 · High 0 · Medium 1 · Low 1 · Future 0).

The assessment→AI→recommendation→explainability→report→KPI chain is mechanism-complete via REUSE-before-build (aiClient + ai-reasoning + recommendation-intelligence + explainability engines + PIL/omega report builders + the existing enterprise-analytics KPI engines), gated by `aiRecommendationReportOrchestration` (byte-identical OFF). The dominant remaining axes are **CONFIDENCE** (calibrated effectiveness, deliberately abstained) and **ADOPTION** (real AI/report/outcome/KPI volume) — reported SEPARATELY (deliverables 09/10), NOT gaps. Coverage⟂Confidence⟂Outcome⟂Adoption are never composited; null≠0; nothing fabricated.

## Open engineering gaps
### Launch-Critical
_None._

### High
_None._

### Medium
#### GAP-AI-1 — Per-token / per-feature recommendation attribution (explainability depth)
- **Evidence**: Recommendations trace to persisted signals (capadex_session_signals → development_recommendations) and a reasoning chain (ai_reasoning_chains), but full per-feature attribution weights are not persisted. This is an explainability-DEPTH residual, not a broken chain — the rationale IS rendered.
- **Remediation**: OPTIONAL future enhancement: persist per-feature attribution from the existing reasoning engine output. Not Launch-Critical; explainability is already human-readable. No DDL in this phase.

### Low
#### GAP-AI-2 — Report engagement instrumentation (report adoption signal)
- **Evidence**: Reports are generated + persisted (capadex_reports) but report-open / share engagement is not instrumented as a first-class KPI. Report VOLUME is measurable; report ENGAGEMENT is an Adoption axis currently honest-low.
- **Remediation**: OPTIONAL: reuse the existing analytics substrate to roll up report engagement as usage accrues. Adoption-driven, never fabricated. No new engine.

### Future
_None._

## Resolved (mechanisms reused, not rebuilt)
### MECH-AI-ANALYSIS — AI analysis + reasoning chain over assessment evidence
- **Closure**: PRESENT via REUSE: aiClient + ai-reasoning-engine generate narrative analysis + reasoning chains (ai_reasoning_chains) over the persisted assessment signals. The composer READS their existence/output; it never invokes them. Degrades honestly without OPENAI_API_KEY (null≠0).
- **Residual (ADOPTION/CONFIDENCE, usage/data-driven — not a gap)**: CONFIDENCE/ADOPTION: AI output volume is usage-driven; LLM-backed depth depends on the configured key (reported separately, null≠0).

### MECH-RECOMMENDATION-CHAIN — Recommendation → intervention → learning-plan chain
- **Closure**: PRESENT via REUSE: recommendation-intelligence + career-recommendation + mei-recommendation engines persist recommendations (development_recommendations/career_recommendations); intervention-intelligence selects interventions (capadex_interventions); learning-path-engine composes the plan. No new engine/table/DDL.
- **Residual (ADOPTION/CONFIDENCE, usage/data-driven — not a gap)**: ADOPTION: real recommendation/intervention volume is usage-driven (Coverage⟂Adoption, null≠0).

### MECH-EXPLAINABILITY — Explainability / rationale rendering
- **Closure**: PRESENT via REUSE: capadex-explainability-engine + runtime-explainability-engine render a human-readable rationale per recommendation/decision, surfaced in the generated report.
- **Residual (ADOPTION/CONFIDENCE, usage/data-driven — not a gap)**: CONFIDENCE: per-feature attribution depth is an optional future enhancement (GAP-AI-1) — the rationale IS rendered today.

### MECH-REPORT-GENERATION — AI report generation
- **Closure**: PRESENT via REUSE: PIL + omega report builders compose human-readable AI reports persisted in capadex_reports and surfaced in the AI-powered report dashboards. No new report engine.
- **Residual (ADOPTION/CONFIDENCE, usage/data-driven — not a gap)**: ADOPTION: report volume + engagement are usage-driven (Coverage⟂Adoption; GAP-AI-2 for engagement instrumentation).

### MECH-EFFECTIVENESS-CALIBRATION-WIRED — Recommendation → outcome effectiveness wired to the calibration mechanism
- **Closure**: CLOSED via REUSE (no new engine/table/DDL): composeEffectiveness READS the EXISTING validation-loop calibration mechanism — recordValidationOutcome captures predicted_prob_at_decision; calibrationFromRows/toCalibrationPairs turn non-demo prediction+outcome rows into a calibrated effectiveness block with a k_min gate. When ≥ k_min real pairs accrue the status flips to calibrated and the rate lights up automatically. Demo excluded; nothing fabricated.
- **Residual (ADOPTION/CONFIDENCE, usage/data-driven — not a gap)**: CONFIDENCE: until ≥ k_min real non-demo prediction+outcome pairs accrue the status is cold_start/provisional and effectiveness_rate stays null (abstained, NEVER fabricated). Reported via the `calibration` block, never a gap.

### MECH-KPI-SUBSTRATE — KPI computation substrate (enterprise analytics + benchmark)
- **Closure**: PRESENT via REUSE: the existing enterprise-analytics (anl_kpi_daily) + benchmark engines compute the KPI families. The composer READS coverage of this substrate; it never re-computes a KPI or builds a second KPI engine.
- **Residual (ADOPTION/CONFIDENCE, usage/data-driven — not a gap)**: ADOPTION: KPI population is usage-driven (Coverage⟂Adoption, null≠0).

## AI-orchestration decisions (not silent merges)
- **Single AI-orchestration layer (no V2)** → `COMPOSE_EXISTING` — AI analysis, reasoning, recommendation, intervention, explainability, report and KPI computation are ALL performed by EXISTING engines. This phase adds ONE read-only composer/registry that audits and orchestrates the READING of those capabilities — never a parallel AI / recommendation / report / KPI engine.
- **Engines read, never invoked** → `READ_BY_EXISTENCE_AND_PERSISTED_OUTPUT` — The composer verifies each capability by filesystem existence + persisted-output COUNT (to_regclass + COUNT(*)). It NEVER invokes an AI/reasoning/recommendation/report engine — proving zero behaviour change (byte-identical OFF, and no side effects ON).
- **Recommendation / explainability effectiveness** → `WIRE_REUSE_CALIBRATION_ABSTAIN_UNTIL_KMIN` — Where a recommendation→outcome effectiveness rate is implied, it is WIRED via REUSE of the EXISTING validation-loop calibration mechanism (predicted_prob_at_decision; calibrationFromRows/toCalibrationPairs with a k_min gate) — zero new engine/table/DDL. The rate is honestly ABSTAINED (null) until ≥ k_min real non-demo pairs accrue (Confidence axis). Never fabricated.
- **Report / KPI population** → `REUSE_REPORT_AND_ANALYTICS_ENGINES` — Reports are composed by the existing PIL/omega builders (capadex_reports); KPI families roll up over the existing enterprise-analytics + benchmark substrate (anl_kpi_daily). Population is usage-driven (Adoption axis, null≠0) — no new report or KPI engine.
- **Honesty axes** → `KEEP_AXES_SEPARATE` — Coverage (a capability exists) ⟂ Confidence (calibrated/trustworthy) ⟂ Outcome (realized) ⟂ Adoption (real volume) are reported on their OWN axes and NEVER composited. null (unreadable) ≠ 0 (measured-empty). Revenue stays in capadex_payments and is never composited into AI/outcome KPIs.
