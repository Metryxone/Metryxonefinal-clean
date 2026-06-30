# CAPADEX 3.0 · Phase 1.6 — Remaining Gaps (classified)

> Deliverable 14 · Generated 2026-06-30T14:35:35.480Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:8d7228dfcd7b, written 2026-06-30T14:35:35.479Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

**OPEN engineering gaps: 0** (Launch-Critical 0 · High 0 · Medium 0 · Low 0 · Future 0).

The assessment→intervention→outcome→KPI chain is mechanism-complete via REUSE-before-build (MX-102X outcome-intelligence + Phase-1.3 capture + the existing enterprise-analytics/benchmark/mei/employability KPI engines), gated by `outcomeFrameworkKpiEngine` (byte-identical OFF). The dominant remaining axes are **CONFIDENCE** (calibrated effectiveness, deliberately abstained) and **ADOPTION** (real outcome/KPI volume) — reported SEPARATELY (deliverables 06/07/08), NOT gaps. Coverage⟂Confidence⟂Outcome⟂Adoption are never composited; null≠0; nothing fabricated.

## Open engineering gaps
_None — all classified outcome/KPI gaps are engineering-closed._

## Resolved (mechanisms reused, not rebuilt)
### MECH-UNIVERSAL-OUTCOME-CAPTURE — Universal realized-outcome capture into the canonical ledger
- **Closure**: PRESENT via REUSE (MX-102X + Phase 1.3): outcome-intelligence-engine + captureProgressionOutcome/captureJourneyTailMilestone write realized outcomes (placement/hire/progression/mastery/engagement) into validation_loop_outcomes. Gated by longitudinalOutcomeCapture → byte-identical OFF. No new engine/table/DDL.
- **Residual (ADOPTION/CONFIDENCE, usage/data-driven — not a gap)**: ADOPTION: real realized-outcome volume is usage-driven (honest-low/0; reported by composeOutcomeAdoption — Adoption⟂Coverage, null≠0).

### MECH-KPI-SUBSTRATE — KPI computation substrate (enterprise analytics + benchmark + scoring)
- **Closure**: PRESENT via REUSE: the existing enterprise-analytics (anl_kpi_daily/anl_cohort_analysis/anl_benchmark_snapshot) + benchmark/mei/employability scoring engines compute the 10 KPI families. The composer READS coverage of this substrate; it never re-computes a KPI or builds a second KPI engine.
- **Residual (ADOPTION/CONFIDENCE, usage/data-driven — not a gap)**: ADOPTION: KPI population is usage-driven (Coverage⟂Adoption, null≠0).

### MECH-LONGITUDINAL-IMPROVEMENT — Longitudinal improvement-validation substrate
- **Closure**: PRESENT via REUSE: longitudinal-memory + wc3 longitudinal-foundation record the trend that validates improvement vs baseline (the measured-outcome input). The composer READS it, never re-derives.
- **Residual (ADOPTION/CONFIDENCE, usage/data-driven — not a gap)**: CONFIDENCE + ADOPTION: improvement is measurable once >1 non-demo datapoint exists; calibrated accuracy is abstained by design (Coverage⟂Confidence⟂Adoption, null≠0).

### MECH-EFFECTIVENESS-CALIBRATION-WIRED — Recommendation/intervention → outcome effectiveness is WIRED to the calibration mechanism (formerly GAP-O1)
- **Closure**: CLOSED via REUSE (no new engine/table/DDL): composeEffectiveness now READS the EXISTING validation-loop calibration mechanism — recordValidationOutcome captures the decision-time prediction (predicted_prob_at_decision); calibrationFromRows/toCalibrationPairs turn non-demo prediction+outcome rows into a calibrated effectiveness block with a k_min gate. The link is end-to-end: when ≥ k_min real pairs accrue, status flips to calibrated and effectiveness_rate lights up automatically. Demo excluded; nothing fabricated.
- **Residual (ADOPTION/CONFIDENCE, usage/data-driven — not a gap)**: CONFIDENCE: until ≥ k_min real non-demo prediction+outcome pairs accrue the status is cold_start/provisional and effectiveness_rate stays null (abstained, NEVER fabricated). This is a Confidence/Adoption axis — reported via the `calibration` block, never a gap. Coverage⟂Confidence⟂Adoption, null≠0.

### AXIS-PERSONA-KPI-ARCHITECTURE — Per-persona KPI roll-up is a deliberate zero-DDL read-time join — an ARCHITECTURE axis, not a gap (formerly GAP-O2)
- **Closure**: RECLASSIFIED (not an engineering defect): persona KPIs are computed by JOINING validation_loop_outcomes to capadex_user_profiles.persona at READ time. This is a deliberate zero-DDL / byte-identical-OFF choice — Coverage IS present; "closing" it would mean adding a persisted persona column (DDL), which would VIOLATE this phase's contract. It is therefore an architecture axis, reported with k≥k_min masking, never an open gap.
- **Residual (ADOPTION/CONFIDENCE, usage/data-driven — not a gap)**: ARCHITECTURE (optional/future): if a persisted persona dimension is ever required, REUSE the existing profile substrate via a materialized read-model — no change to the canonical ledger, no DDL in this phase.

### AXIS-PLATFORM-KPI-ADOPTION — Platform / organizational KPI population is an ADOPTION axis, not a gap (formerly GAP-O3)
- **Closure**: RECLASSIFIED (not an engineering defect): platform/organizational KPI families roll up over anl_kpi_daily/anl_cohort_analysis. The substrate + computing engine ALREADY exist (Coverage present); values are honest-low/0 ONLY because real usage volume is low. Forcing them non-zero would mean seeding fabricated data. It is therefore an Adoption axis, reported via composeOutcomeAdoption, never an open gap.
- **Residual (ADOPTION/CONFIDENCE, usage/data-driven — not a gap)**: ADOPTION: as real usage accrues, the EXISTING enterprise-analytics engine populates the KPI substrate — no new engine required (Coverage⟂Adoption, null≠0; never fabricated).

## Outcome/KPI decisions (not silent merges)
- **Single outcome + KPI engine (no V2)** → `COMPOSE_EXISTING` — Realized outcomes are captured by EXISTING engines (outcome-intelligence-engine → validation_loop_outcomes, Phase-1.3 progression-outcome-capture); KPIs are computed by the EXISTING enterprise-analytics + benchmark + mei/employability engines. This phase adds ONE read-only composer/registry, never a parallel outcome or KPI engine.
- **KPI computation** → `REUSE_ENTERPRISE_ANALYTICS` — KPI families roll up over the existing anl_kpi_daily/anl_cohort_analysis/anl_benchmark_snapshot substrate + benchmark/mei/employability engines. No second KPI engine, no new KPI table. Population is adoption-driven (Coverage⟂Adoption, null≠0).
- **Recommendation / intervention effectiveness** → `WIRE_REUSE_CALIBRATION_ABSTAIN_UNTIL_KMIN` — The recommendation→outcome / intervention→outcome effectiveness link is WIRED via REUSE of the EXISTING validation-loop calibration mechanism (recordValidationOutcome captures predicted_prob_at_decision; calibrationFromRows/toCalibrationPairs calibrate non-demo prediction+outcome rows with a k_min gate) — zero new engine/table/DDL. The calibrated effectiveness_rate is honestly ABSTAINED (null) while status is cold_start/provisional and lights up ONLY at calibrated (≥ k_min real pairs); this is the Confidence axis, distinct from Coverage. Never fabricate a rate before the data exists.
- **Outcome capture** → `REUSE_VALIDATION_LOOP` — Realized outcomes write to the EXISTING canonical ledger (validation_loop_outcomes) via reuse of MX-102X + Phase-1.3 capture, gated by longitudinalOutcomeCapture → byte-identical OFF. No new outcome table, no new DDL.
- **Revenue / commercial KPIs** → `KEEP_SEPARATE` — Revenue lives in the SEPARATE commerce ledger (capadex_payments) and is reported on its own axis — never composited into outcome/growth KPIs. Business KPIs here mean placement/hiring realized outcomes, not money.
