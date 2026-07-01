# CAPADEX 3.0 · Program 3 · Phase 3.3 — Assessment Rules & Configuration (dimension 6 · apis)

> Deliverable 06 · Generated 2026-07-01T08:55:12.461Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:bcdece46fdc2, written 2026-07-01T08:55:12.462Z).
> Scope: AUTHORING ONLY — design/compose/configure/validate/version/approve/publish; NOT delivery/scoring/psychometrics.
> Honesty: the SEVEN certification dimensions (builder · blueprint · validation · version_management · publishing · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The authoring rules (10) + configuration options (8) that make an assessment enforceable + deliverable-ready (passing criteria, attempts, timing, languages, accessibility, …). Persisted to the `ab_assessments` authoring record.

## Rule types (10)
**Rule types:** 9 SUPPORTED · 1 PARTIAL · 0 DEAD_END · 0 MISSING (10 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Passing criteria** (`passing_criteria`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |
| **Completion criteria** (`completion_criteria`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |
| **Eligibility rules** (`eligibility`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |
| **Navigation rules** (`navigation`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |
| **Branching rules** (`branching`) | SUPPORTED | true | services/assessment-architecture-engine.ts, assessment_branching_rules, ab_assessments |
| **Adaptive rule (placeholder)** (`adaptive_placeholder`) | PARTIAL | true | services/adaptive-assessment-engine.ts, ab_assessments |
| **Mandatory sections** (`mandatory_sections`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |
| **Optional sections** (`optional_sections`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |
| **Time rules** (`time_rules`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |
| **Attempt rules** (`attempt_rules`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |

## Config options (8)
**Config options:** 8 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Languages** (`languages`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |
| **Instructions** (`instructions`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |
| **Welcome screen** (`welcome_screen`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |
| **Completion screen** (`completion_screen`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |
| **Branding** (`branding`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |
| **Logos** (`logos`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |
| **Themes** (`themes`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |
| **Accessibility** (`accessibility`) | SUPPORTED | true | services/assessment-builder-mechanisms.ts, ab_assessments |
