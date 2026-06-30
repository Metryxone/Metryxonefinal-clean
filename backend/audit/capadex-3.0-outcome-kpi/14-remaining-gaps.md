# CAPADEX 3.0 · Phase 1.6 — Remaining Gaps (classified)

> Deliverable 14 · Generated 2026-06-30T14:10:24.976Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:93309b17121a, written 2026-06-30T14:10:24.975Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

**OPEN engineering gaps: 3** (Launch-Critical 0 · High 0 · Medium 1 · Low 1 · Future 1).

The assessment→intervention→outcome→KPI chain is mechanism-complete via REUSE-before-build (MX-102X outcome-intelligence + Phase-1.3 capture + the existing enterprise-analytics/benchmark/mei/employability KPI engines), gated by `outcomeFrameworkKpiEngine` (byte-identical OFF). The dominant remaining axes are **CONFIDENCE** (calibrated effectiveness, deliberately abstained) and **ADOPTION** (real outcome/KPI volume) — reported SEPARATELY (deliverables 06/07/08), NOT gaps. Coverage⟂Confidence⟂Outcome⟂Adoption are never composited; null≠0; nothing fabricated.

## Open engineering gaps
### Launch-Critical
_None._

### High
_None._

### Medium
#### GAP-O1-EFFECTIVENESS-ABSTAINED — Calibrated recommendation/intervention → outcome effectiveness is deliberately abstained
- **Evidence**: recommendation/intervention rows carry NO decision-time prediction (predicted_prob_at_decision is NULL by design), so empirical effectiveness/accuracy of the recommendation→outcome and intervention→outcome links cannot be calibrated yet. This is a CONFIDENCE-axis abstention, honestly reported as null — NOT a fabricated rate.
- **Remediation**: FUTURE/ADDITIVE: once real non-demo outcome volume + a decision-time prediction substrate exist, compute effectiveness/calibration over the EXISTING ledger (validation_loop_outcomes). Never fabricate effectiveness before the data exists. Not Launch-Critical.

### Low
#### GAP-O2-PERSONA-KPI-NO-LEDGER-DIM — Per-persona KPI roll-up is a read-time join, not a persisted persona dimension
- **Evidence**: persona KPIs are computed by JOINING validation_loop_outcomes to capadex_user_profiles.persona at READ time; the outcome ledger has no persona column, so per-persona counts depend on the join being readable + k≥k_min. Coverage present; this is a deliberate zero-DDL choice.
- **Remediation**: OPTIONAL/ADDITIVE: if a persisted persona dimension is later required, REUSE the existing profile substrate via a materialized read-model (no change to the canonical ledger). Low priority.

### Future
#### GAP-O3-PLATFORM-KPI-ADOPTION-DRIVEN — Platform / organizational KPI population depends on analytics adoption
- **Evidence**: platform/organizational KPI families roll up over anl_kpi_daily/anl_cohort_analysis, whose population is adoption-driven (real volume). The substrate + computing engine exist (Coverage); current values are honest-low/0 (Adoption⟂Coverage, null≠0).
- **Remediation**: FUTURE: as real usage accrues, the existing enterprise-analytics engine populates the KPI substrate — no new engine required. Reported on the Adoption axis, never as an engineering gap.

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

## Outcome/KPI decisions (not silent merges)
- **Single outcome + KPI engine (no V2)** → `COMPOSE_EXISTING` — Realized outcomes are captured by EXISTING engines (outcome-intelligence-engine → validation_loop_outcomes, Phase-1.3 progression-outcome-capture); KPIs are computed by the EXISTING enterprise-analytics + benchmark + mei/employability engines. This phase adds ONE read-only composer/registry, never a parallel outcome or KPI engine.
- **KPI computation** → `REUSE_ENTERPRISE_ANALYTICS` — KPI families roll up over the existing anl_kpi_daily/anl_cohort_analysis/anl_benchmark_snapshot substrate + benchmark/mei/employability engines. No second KPI engine, no new KPI table. Population is adoption-driven (Coverage⟂Adoption, null≠0).
- **Recommendation / intervention effectiveness** → `ABSTAIN_UNTIL_VOLUME` — No decision-time prediction is recorded (predicted_prob_at_decision is NULL by design), so calibrated effectiveness/accuracy of the recommendation→outcome and intervention→outcome links is honestly ABSTAINED (Confidence axis), distinct from Coverage. Never fabricate effectiveness before the data exists.
- **Outcome capture** → `REUSE_VALIDATION_LOOP` — Realized outcomes write to the EXISTING canonical ledger (validation_loop_outcomes) via reuse of MX-102X + Phase-1.3 capture, gated by longitudinalOutcomeCapture → byte-identical OFF. No new outcome table, no new DDL.
- **Revenue / commercial KPIs** → `KEEP_SEPARATE` — Revenue lives in the SEPARATE commerce ledger (capadex_payments) and is reported on its own axis — never composited into outcome/growth KPIs. Business KPIs here mean placement/hiring realized outcomes, not money.
