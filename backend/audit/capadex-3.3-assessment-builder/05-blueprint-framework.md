# CAPADEX 3.0 · Program 3 · Phase 3.3 — Blueprint Framework (dimension 2)

> Deliverable 05 · Generated 2026-07-01T08:55:12.461Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:bcdece46fdc2, written 2026-07-01T08:55:12.462Z).
> Scope: AUTHORING ONLY — design/compose/configure/validate/version/approve/publish; NOT delivery/scoring/psychometrics.
> Honesty: the SEVEN certification dimensions (builder · blueprint · validation · version_management · publishing · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The blueprint framework binds a distribution + mix + time/marks contract onto an assessment. REUSES the existing blueprint-builder + assembly engines; the binding + framework link are persisted to the additive `ab_blueprints` overlay (by reference to `assessment_blueprints`).

**Blueprint capabilities:** 8 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Blueprint template** (`blueprint_template`) | SUPPORTED | true | services/blueprint-builder.ts, ab_blueprints, assessment_blueprints |
| **Competency distribution** (`competency_distribution`) | SUPPORTED | true | services/assessment-blueprint-engine.ts, assessment_blueprint_competencies, onto_blueprint_competency_map |
| **Behaviour distribution** (`behaviour_distribution`) | SUPPORTED | true | services/assessment-blueprint-engine.ts, ab_blueprints |
| **Domain distribution** (`domain_distribution`) | SUPPORTED | true | services/blueprint-builder.ts, blueprint_sections, ab_blueprints |
| **Question-type mix** (`question_type_mix`) | SUPPORTED | true | services/question-blueprint.ts, ab_blueprints |
| **Difficulty mix** (`difficulty_mix`) | SUPPORTED | true | services/adaptive-blueprint-generation-engine.ts, ab_blueprints |
| **Time allocation** (`time_allocation`) | SUPPORTED | true | services/blueprint-builder.ts, ab_blueprints |
| **Marks distribution** (`marks_distribution`) | SUPPORTED | true | services/blueprint-builder.ts, ab_blueprints |
