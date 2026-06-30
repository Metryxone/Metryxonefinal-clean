# CAPADEX 3.0 · Phase 1.3 — Customer Journey ↔ Assessment Matrix

> Deliverable 06 · Generated 2026-06-30T11:44:25.490Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9b3be5dcc291, written 2026-06-30T11:44:25.495Z).
> Honesty: Coverage⟂Confidence⟂Outcome (never composited); null ≠ 0; never fabricated.

| Canonical Type | Status | Journey position | Entry criteria | Completion criteria |
|---|---|---|---|---|
| Entry Assessment (`entry`) | IMPLEMENTED | Acquisition → first session (FreeAssessmentModal IntroPhase). | New/anonymous session opened; no prior persona on capadex_user_profiles. | Persona + concern selected; IntroPhase progressive form valid. |
| Baseline Assessment (`baseline`) | IMPLEMENTED | First scored assessment after entry. | Entry complete; first competency/EI/behaviour run begins. | First employability_scoring_runs row persisted for the subject. |
| Diagnostic Assessment (`diagnostic`) | IMPLEMENTED | Curiosity→Insight; clarity loop resolves ambiguous signals. | Concern selected; behavioural questionnaire served. | Signals analysed; clarity resolved; concern→signal mapping produced. |
| Behaviour Assessment (`behaviour`) | IMPLEMENTED | Runs underneath every CAPADEX session. | Any CAPADEX questionnaire session active. | Behavioural signals processed into behavioural_insights. |
| Competency Assessment (`competency`) | IMPLEMENTED | Insight→Growth→Mastery; candidate-side for employers. | Competency/Role-DNA assessment selected; adaptive bank served. | Competency scores persisted; level bands assigned. |
| Learning Assessment (`learning`) | PARTIAL | Growth — between competency runs. | Learning/practice module selected (exam-ready / curated MCQ). | Item set submitted; score computed. |
| Performance Assessment (`performance`) | PARTIAL | Growth→Mastery; employer hiring funnel. | Role/job context present; candidate competency substrate available. | Role-fit / readiness score computed. |
| Progress Assessment (`progress`) | IMPLEMENTED | Growth→Mastery; longitudinal. | A baseline + at least one re-run exists for the subject. | Delta computed vs baseline. |
| Exit Assessment (`exit`) | IMPLEMENTED | Stage/lifecycle boundary. | Subject reaches a stage-exit boundary (evidence-gated progression). | Re-run gate passes/fails; exit recorded. |
| Continuous Assessment (`continuous`) | IMPLEMENTED | Ongoing across the lifecycle. | Interval/trigger reached for a returning subject. | Interval re-run completed; trend updated. |
