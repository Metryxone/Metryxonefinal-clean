# CAPADEX 3.0 · Phase 1.6 — Lifecycle ↔ Outcome / KPI Matrix

> Deliverable 09 · Generated 2026-06-30T14:35:35.480Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:8d7228dfcd7b, written 2026-06-30T14:35:35.479Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

For each coded lifecycle stage (Curiosity→Insight→Growth→Mastery): the outcome types that realize there + the KPI families they update + the measurable outcome definition. REFERENCES the EXISTING readiness + outcome machinery — no new gate, no new KPI engine.

| Stage | Status | Outcomes at stage | KPIs updated | Measurable outcome |
|---|---|---|---|---|
| CAP_CUR Curiosity | SUPPORTED | assessment_completion, diagnosis_delivered | individual, assessment, ai | A scored baseline + first AI diagnosis exist (the entry outcome of every chain). |
| CAP_INS Insight | SUPPORTED | recommendation_engagement, intervention_uptake, learning_progress | individual, learning, ai, journey | A recommendation + learning/intervention plan is generated and acted on. |
| CAP_GRW Growth | PARTIAL | reassessment_completed, competency_improvement, readiness_uplift, realized_outcome | individual, lifecycle, business, organizational | A reassessment validates improvement vs the baseline; a realized outcome is captured. |
| CAP_MAS Mastery | PARTIAL | stage_promotion, mastery_achievement, realized_outcome | lifecycle, business, platform | A reached-mastery + realized outcome is captured; the optimization loop re-enters. |

## Honesty notes
- **CAP_CUR Curiosity** (SUPPORTED) — Entry → baseline → diagnosis is the most mature outcome segment.
- **CAP_INS Insight** (SUPPORTED) — Recommendation + learning + intervention generation is well-supported (reused engines).
- **CAP_GRW Growth** (PARTIAL) — Reassessment + improvement MECHANISM present (Phase 1.3 reuse + longitudinal trend); validation is ADOPTION-pending (>1 non-demo datapoint). Coverage⟂Adoption⟂Confidence never composited.
- **CAP_MAS Mastery** (PARTIAL) — reached_mastery + exit-eligibility MECHANISM present (progression-outcome-capture + getReassessmentSignal). Continuous re-entry cadence is adoption-gated; realized mastery volume honest-low/0 (Adoption⟂Coverage, null≠0).
