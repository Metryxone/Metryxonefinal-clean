# CAPADEX 3.0 · Phase 1.3 — Assessment Inventory

> Deliverable 02 · Generated 2026-06-30T11:23:41.795Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9f33dfe717b5, written 2026-06-30T11:23:41.791Z).
> Honesty: Coverage⟂Confidence⟂Outcome (never composited); null ≠ 0; never fabricated.

Every canonical assessment type → the EXISTING implementations it REUSES (verified vs live FS+DB).

## Entry Assessment (`entry`) — IMPLEMENTED

- **Services**: services/behavioral-signal-engine.ts
- **Routes**: routes/capadex.ts
- **Tables**: capadex_user_profiles, capadex_sessions, capadex_session_telemetry
- **Frontend**: components/FreeAssessmentModal.tsx, components/assessment/phases/IntroPhase.tsx
- **Verified**: svc 1/1 · rt 1/1 · fe 2/2 · tbl 3/3

## Baseline Assessment (`baseline`) — IMPLEMENTED

- **Services**: services/capadex-report-synthesis.ts, services/behavioral-signal-engine.ts
- **Routes**: routes/capadex.ts
- **Tables**: employability_scoring_runs, capadex_sessions
- **Frontend**: components/assessment/phases/ReportPhase.tsx
- **Verified**: svc 2/2 · rt 1/1 · fe 1/1 · tbl 2/2

## Diagnostic Assessment (`diagnostic`) — IMPLEMENTED
_Deepest surface. Concern-diagnostic ⟂ Behaviour-signal are distinct subjects (boundary documented, not merged)._

- **Services**: services/behavioral-signal-engine.ts, services/behavioral-contradiction-engine.ts, services/capadex-intervention-engine.ts
- **Routes**: routes/capadex.ts, routes/behavioural-signals.ts
- **Tables**: behavioural_insights, capadex_session_interventions, contradiction_events
- **Frontend**: components/assessment/phases/CapadexClarifyPhase.tsx, components/career/BehavioralGrowthTab.tsx
- **Verified**: svc 3/3 · rt 2/2 · fe 2/2 · tbl 3/3

## Behaviour Assessment (`behaviour`) — IMPLEMENTED
_Personality folds in as a behavioural-trait surface — NOT a separate clinical personality test._

- **Services**: services/behavioral-signal-engine.ts, services/behavioral-contradiction-engine.ts
- **Routes**: routes/behavioural-signals.ts, routes/cognitive-load.ts
- **Tables**: behavioural_insights, contradiction_events
- **Frontend**: components/career/BehavioralGrowthTab.tsx, components/career/LBIDashboard.tsx
- **Verified**: svc 2/2 · rt 2/2 · fe 2/2 · tbl 2/2

## Competency Assessment (`competency`) — IMPLEMENTED
_Skill/Psychometric/Leadership/Career fold in as competency domains/lenses. LBI (lbi_*) ⟂ Competency (onto_*) are two products by design — NOT merged._

- **Services**: services/ai-competency-inference-engine.ts, services/role-dna-runtime-engine.ts, services/career-readiness-engine.ts
- **Routes**: routes/competency-runtime-v2.ts, routes/career-genome.ts, routes/role-dna-runtime.ts, routes/competency-questions.ts
- **Tables**: competency_question_templates, onto_competencies, onto_role_competency_profiles, role_dna_master_profiles
- **Frontend**: modules/career-builder/competency/views/AdaptiveAssessmentRuntime.tsx, components/career/HiringReadinessTab.tsx, components/career/MEIDashboard.tsx
- **Verified**: svc 3/3 · rt 4/4 · fe 3/3 · tbl 4/4

## Learning Assessment (`learning`) — PARTIAL
_Uneven across stages/personas; no-sandbox curated MCQ only. Coverage exists, learner back-half thin._

- **Services**: services/assessment-runtime-orchestrator.ts, services/caf/scoring-engine.ts
- **Routes**: routes/short-assessments.ts, routes/caf-runtime.ts
- **Tables**: assessment_templates, exam_attempts, short_assessment_questions
- **Frontend**: components/exam-ready/pages/AssessmentPage.tsx, components/exam-ready/pages/ReportViewPage.tsx
- **Verified**: svc 2/2 · rt 2/2 · fe 2/2 · tbl 3/3

## Performance Assessment (`performance`) — PARTIAL
_STRONG on the employer surface, thin on the learner back-half. Readiness/Career fold in here._

- **Services**: services/role-dna-runtime-engine.ts, services/career-readiness-engine.ts
- **Routes**: routes/role-dna-runtime.ts, routes/career-genome.ts
- **Tables**: role_dna_master_profiles, career_readiness_history, validation_loop_outcomes
- **Frontend**: components/career/HiringReadinessTab.tsx, components/career/FutureReadinessTab.tsx
- **Verified**: svc 2/2 · rt 2/2 · fe 2/2 · tbl 3/3

## Progress Assessment (`progress`) — PARTIAL
_Data + deltas EXIST but assessments are NOT systematically re-administered → "Progress (systematic)" is the depth gap._

- **Services**: services/longitudinal-memory.ts, services/bayesian-inference-engine.ts
- **Routes**: routes/longitudinal.ts, routes/memory-architecture.ts
- **Tables**: employability_scoring_runs, longitudinal_patterns, wc3_stage_progression
- **Frontend**: components/career/CareerMemoryTab.tsx
- **Verified**: svc 2/2 · rt 2/2 · fe 1/1 · tbl 3/3

## Exit Assessment (`exit`) — MISSING
_No exit-gate assessment event is instrumented. Forward work: re-administer existing assessments at exit — NOT a net-new engine (blueprint GAP-A4)._

- **Services**: — (none / forward-work)
- **Routes**: —
- **Tables**: —
- **Frontend**: —
- **Verified**: svc 0/0 · rt 0/0 · fe 0/0 · tbl 0/0

## Continuous Assessment (`continuous`) — MISSING
_Longitudinal/Bayesian SUBSTRATE exists, but there is NO scheduled re-administration of assessments. Gap = the scheduler/trigger, NOT the infra._

- **Services**: services/longitudinal-memory.ts, services/bayesian-inference-engine.ts
- **Routes**: routes/longitudinal.ts
- **Tables**: longitudinal_patterns
- **Frontend**: —
- **Verified**: svc 2/2 · rt 1/1 · fe 0/0 · tbl 1/1

## Known overlaps (decisions, not silent merges)
- **Concern-diagnostic ⟂ Behaviour-signal** → `KEEP_SEPARATE` — Distinct subjects (overlap in input only); boundary documented in blueprint 04 dictionary.
- **LBI (lbi_*) ⟂ Competency (onto_*)** → `KEEP_SEPARATE` — Two products by design; merging would break the LBI student product.
- **competency-runtime.ts ⟂ competency-runtime-v2.ts** → `CONSOLIDATION_CANDIDATE` — Migration-in-progress; consolidation is breaking-risk → recommend + human approval, do NOT silently merge.
- **FreeAssessmentModal ⟂ AdaptiveAssessmentRuntime** → `KEEP_SEPARATE` — Flagship consumer flow vs flag-gated standalone adaptive runtime (different entry points).
- **spe-scoring-engine ⟂ caf/scoring-engine** → `CONSOLIDATION_CANDIDATE` — Similar weighted scoring in different dirs; review for shared util — breaking-risk, recommend only.
- **lbi_questions_legacy** → `CONSOLIDATION_CANDIDATE` — Deprecated in favour of sdi_items / psychometric_question_bank; retire (archive) on approval, never delete blindly.
