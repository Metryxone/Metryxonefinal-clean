# CAPADEX 3.0 · Phase 1.3 — Remaining Assessment Gaps (classified)

> Deliverable 12 · Generated 2026-06-30T11:23:41.795Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9f33dfe717b5, written 2026-06-30T11:23:41.791Z).
> Honesty: Coverage⟂Confidence⟂Outcome (never composited); null ≠ 0; never fabricated.

Counts: **0 Launch-Critical · 2 High · 3 Medium · 3 Low · 1 Future**.

## Launch-Critical
_None._

## High
### GAP-A-EXIT — Exit Assessment not instrumented (no stage/lifecycle exit gate event)
- **Evidence**: config/assessment-framework.ts exit.status=MISSING; no exit-gate re-administration surface in repo.
- **Remediation**: Re-administer existing baseline/competency assessments at the evidence-gated stage boundary — NO new engine.

### GAP-A-CONTINUOUS — Continuous Assessment has no scheduler/trigger (interval re-administration absent)
- **Evidence**: Longitudinal/Bayesian substrate exists (longitudinal_patterns) but no scheduled re-run of assessments.
- **Remediation**: Add an interval trigger that re-administers existing assessments; reuse longitudinal substrate.

## Medium
### GAP-A-PROGRESS — Progress is not systematically re-administered (deltas exist, cadence does not)
- **Evidence**: employability_scoring_runs deltas present; no systematic re-run policy → Progress = PARTIAL.
- **Remediation**: Define a re-measurement cadence per stage; reuse employability_scoring_runs + longitudinal_patterns.

### GAP-A-LEARNER-BACKHALF — Learning & Performance are thin on the learner back-half (strong employer-side)
- **Evidence**: 08_ASSESSMENT_BLUEPRINT: Learning PARTIAL (uneven), Performance PARTIAL (strong employer, thin learner).
- **Remediation**: Extend curated MCQ/practice + learner-side performance surfaces; reuse exam-ready + role-DNA.

### GAP-A-OUTCOME-PERSONA — Realized outcomes carry no persona dimension
- **Evidence**: validation_loop_outcomes has no persona column → outcome cannot be attributed per persona (G-F5 honest-null).
- **Remediation**: Add a persona dimension to outcome capture (future); currently abstains honestly.

## Low
### GAP-A-RUNTIME-DUP — competency-runtime ⟂ competency-runtime-v2 migration not consolidated
- **Evidence**: KNOWN_OVERLAPS CONSOLIDATION_CANDIDATE; two runtimes coexist (migration-in-progress).
- **Remediation**: Plan a deliberate, flag-gated migration; recommend + human approval. Do NOT silently merge (breaking-risk).

### GAP-A-SCORING-DUP — spe-scoring-engine ⟂ caf/scoring-engine share weighted-scoring logic
- **Evidence**: KNOWN_OVERLAPS CONSOLIDATION_CANDIDATE; similar logic in different dirs.
- **Remediation**: Extract a shared scoring util on approval; recommend only.

### GAP-A-LBI-LEGACY — lbi_questions_legacy deprecated table still present
- **Evidence**: Superseded by sdi_items / psychometric_question_bank.
- **Remediation**: Archive (retire) on approval; never delete blindly.

## Future
### GAP-A-CLINICAL-VERTICALS — Government / Healthcare / Clinical-Psychology assessment verticals deferred
- **Evidence**: Persona expansion G-F6 non-clinical scaffold only; "not validated / not for clinical use".
- **Remediation**: Out of scope; boundary marker only. Requires domain validation before any clinical claim.
