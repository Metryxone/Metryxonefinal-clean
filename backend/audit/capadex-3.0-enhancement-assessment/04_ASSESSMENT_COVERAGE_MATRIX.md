# 4 · Assessment Coverage Matrix

Measured from the assessment engines/routes/tables. Classified by lifecycle stage (Entry / Progress / Exit).

| Assessment | Evidence (service · route · table) | Stage | Notes |
|---|---|---|---|
| CAPADEX (behavioral) | `routes/capadex.ts`; `capadex_sessions` | **Entry / diagnostic** | flagship free entry assessment |
| SDI (strength discovery) | `routes/sdi.ts`, `services/framework-parity.ts`; `sdi_responses` | **Entry / diagnostic** | overlaps CAPADEX on psychometric traits (different UI module) |
| LBI (learner behavior) | `services/lbi-profile-builder.ts`; `lbi_scores`, `lbi_learning_trends` | **Progress / in-journey** | longitudinal student tracking |
| Competency assessment | `routes/competency-assessment-runtime.ts`; `onto_competency_score_runs` | **Progress + Exit** | runtime scoring; growth via sequential runs |
| Adaptive questioning | `services/adaptive/adaptive-question-pipeline.ts`; `ADAPTIVE_QUESTION_BANK_V2` | **In-journey + Exit** | V2 contradiction probes + adaptive length; multiple adaptive variants exist |
| Exam-portal readiness | `CompetitiveExamPortal.tsx`; `exam_portal_profiles`, `exam_portal_mock_scores` | **Progress / diagnostic** | readiness scores + mock tracking |
| Hiring assessment | `services/hiring-assessment-engine.ts`; `assessment_invites` | **Transition (entry/exit of hiring)** | **composes** existing CAPADEX/competency scores (aggregator, not its own scorer) |
| Custom modules | `routes/assessment-writer.ts`; `custom_assessment_modules` | **Configurable** | admin-authored, variable stage |

## Overlaps / duplication (review candidates, not defects)
- **OV-1** CAPADEX (behavioral) ⟂ SDI (strength) measure overlapping psychometric traits via different UI
  modules, reconciled by `framework-parity.ts`. *Enhancement:* document the canonical separation so customers
  understand why both exist (do **not** merge — they serve different framings).
- **OV-2** Multiple adaptive variants (`V2`, `AdaptiveCausal`, `AdaptiveOrchestration`) — V2 is the modern
  path. *Enhancement:* explicit deprecation decision for the older adaptive logic (lifecycle engine exists for
  this). Aligns with the parallel-v1/v2 architecture-debt finding.
- **OV-3** *(observation — not a backlog item)* Hiring assessment is correctly a **composer** over existing
  scores (no duplicate scoring) — this is good design, not debt. Worth calling out as a model pattern.

## Stage-coverage gaps (honest)
| ID | Gap | Severity | Enhancement (no new business logic) |
|---|---|---|---|
| AC-1 | **No dedicated Exit / pre-vs-post growth assessment.** Growth is a *delta between sequential progress runs*, not an explicit controlled pre/post or certification module | **HIGH (product value)** | add an explicit "Exit / Re-test" *view* that composes the existing sequential runs into a pre-vs-post growth report — reuses existing data, no new scorer |
| AC-2 | Coding/MCQ assessment is thin — mentioned in types/Employability Studio but lacks a robust dedicated backend engine vs the psychometric/competency engines | **MEDIUM** | strengthen the curated coding-MCQ bank surfacing (Employability Studio already has a no-sandbox MCQ path); honest about no live code-execution sandbox |
| AC-3 | Employability Studio leans to **job-fit scoring** more than active skill-building/retesting | **MEDIUM** | expose a retest loop on the existing employability substrate |
| AC-4 *(observation — not a backlog item; its action = AC-1)* | Entry coverage is strong (CAPADEX/SDI), progress is strong (LBI/competency); **the lifecycle is front- and middle-loaded, exit-light** | **HIGH** | AC-1 closes the lifecycle; this is the single highest-value assessment enhancement |

## Assessment enhancement summary
- **Entry & Progress: mature and well-instrumented** (CAPADEX, SDI, LBI, competency, adaptive).
- **Exit: the real gap** — there is no explicit growth/certification assessment closing the loop (AC-1/AC-4).
  Closing it is **compositional** (re-shape existing sequential runs), not a new engine — fully within the
  "enhancement only" constraint.
- **Governance is strong:** Question Factory keeps generated questions in `draft` until human approval;
  hiring engine distinguishes "Unmeasured" vs "Zero" (null≠0). These are model honesty patterns to preserve.
