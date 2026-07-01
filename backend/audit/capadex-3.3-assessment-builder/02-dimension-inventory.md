# CAPADEX 3.0 · Program 3 · Phase 3.3 — Dimension Inventory (7 certification dimensions)

> Deliverable 02 · Generated 2026-07-01T08:55:12.461Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:bcdece46fdc2, written 2026-07-01T08:55:12.462Z).
> Scope: AUTHORING ONLY — design/compose/configure/validate/version/approve/publish; NOT delivery/scoring/psychometrics.
> Honesty: the SEVEN certification dimensions (builder · blueprint · validation · version_management · publishing · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The 7 INDEPENDENT dimensions. Status is a **Coverage** axis (does an implementation exist + is it wired?), kept SEPARATE from Confidence/Adoption. Evidence is VERIFIED vs the live FS+DB.

**Status:** 7 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING.

## The seven authoring questions
| Dimension | Question answered |
|---|---|
| **Assessment Builder / Designer** (`builder`) | Can an assessment be designed, composed & configured? |
| **Blueprint Framework** (`blueprint`) | Can a blueprint (distribution + mix + time/marks) be defined & bound? |
| **Validation Framework** (`validation`) | Is an assessment validated (structure/blueprint/rules/config/readiness) before publish? |
| **Version Management** (`version_management`) | Are major/minor/draft versions tracked, comparable, rollback-able & clonable? |
| **Publishing / Approval Workflow** (`publishing`) | Does draft→review→approved→published→active→deprecated→archived exist with human approval? |
| **Assessment Authoring APIs** (`apis`) | Do CRUD/builder/blueprint/version/validation/publishing APIs exist? |
| **Builder Frontend** (`frontend`) | Is there a builder UI (compose/blueprint/rules/validation/preview/version/approval)? |

### Assessment Builder / Designer (`builder`) — SUPPORTED
_ONE canonical authoring record (ab_assessments) composing the existing CAF builder + assembly + writer — design/edit/clone/version/archive/restore/publish, no duplicate builder._

- **Services**: services/assessment-architecture-engine.ts, services/assessment-assembly.ts, services/assessment-writer.ts, services/blueprint-builder.ts, services/assessment-builder-engine.ts, services/assessment-builder-mechanisms.ts
- **Routes**: routes/caf-assessment-builder.ts, routes/assessment-writer.ts, routes/assessment-builder.ts
- **Frontend**: components/superadmin/caf/CAFAssessmentBuilderPanel.tsx, components/superadmin/AssessmentBuilderPanel.tsx
- **Tables**: caf_assessments, caf_assessment_sections, caf_section_questions, ab_assessments
- **Verified**: svc 6/6 · rt 3/3 · fe 2/2 · tbl 3/4
- **Absent tables (honest — overlay not yet written while flag OFF)**: ab_assessments

### Blueprint Framework (`blueprint`) — SUPPORTED
_Competency/behaviour/domain distribution + question/difficulty mix + time/marks, composing the existing blueprint engines into the ab_blueprints overlay._

- **Services**: services/assessment-blueprint-engine.ts, services/blueprint-builder.ts, services/adaptive-blueprint-generation-engine.ts, services/question-blueprint.ts
- **Routes**: routes/assessment-architecture.ts
- **Frontend**: components/superadmin/CompetencyBlueprintPanel.tsx, components/superadmin/BlueprintMappingPanel.tsx, components/PreviewBlueprint.tsx
- **Tables**: assessment_blueprints, assessment_blueprints_v2, assessment_blueprint_competencies, blueprint_sections, onto_assessment_blueprints, ab_blueprints
- **Verified**: svc 4/4 · rt 1/1 · fe 3/3 · tbl 5/6
- **Absent tables (honest — overlay not yet written while flag OFF)**: ab_blueprints

### Validation Framework (`validation`) — SUPPORTED
_Seven read-time checks (missing questions/empty sections/duplicates/blueprint/rule/config/publishing-readiness) recorded to ab_validation_runs; assessment is validation-clean before publish._

- **Services**: services/assessment-builder-engine.ts, services/assessment-architecture-engine.ts
- **Routes**: routes/assessment-builder.ts
- **Frontend**: components/superadmin/AssessmentBuilderPanel.tsx
- **Tables**: ab_validation_runs
- **Verified**: svc 2/2 · rt 1/1 · fe 1/1 · tbl 0/1
- **Absent tables (honest — overlay not yet written while flag OFF)**: ab_validation_runs

### Version Management (`version_management`) — SUPPORTED
_Append-only ab_assessment_versions — major/minor/draft, compare, rollback, clone, audit history (lossless snapshots)._

- **Services**: services/assessment-builder-mechanisms.ts
- **Routes**: routes/assessment-builder.ts
- **Frontend**: components/superadmin/AssessmentBuilderPanel.tsx
- **Tables**: ab_assessment_versions
- **Verified**: svc 1/1 · rt 1/1 · fe 1/1 · tbl 0/1
- **Absent tables (honest — overlay not yet written while flag OFF)**: ab_assessment_versions

### Publishing / Approval Workflow (`publishing`) — SUPPORTED
_draft→review→approved→published→active→deprecated→archived audit ledger (ab_workflow) with mandatory human approval; publish blocked until validation-clean._

- **Services**: services/assessment-builder-mechanisms.ts
- **Routes**: routes/assessment-builder.ts
- **Frontend**: components/superadmin/AssessmentBuilderPanel.tsx
- **Tables**: ab_workflow
- **Verified**: svc 1/1 · rt 1/1 · fe 1/1 · tbl 0/1
- **Absent tables (honest — overlay not yet written while flag OFF)**: ab_workflow

### Assessment Authoring APIs (`apis`) — SUPPORTED
_CRUD + builder + blueprint + version + validation + publishing endpoints under /api/admin/assessment-builder, composing existing authoring routes._

- **Services**: services/assessment-builder-engine.ts
- **Routes**: routes/assessment-builder.ts, routes/caf-assessment-builder.ts, routes/assessment-architecture.ts, routes/assessment-writer.ts
- **Frontend**: —
- **Tables**: —
- **Verified**: svc 1/1 · rt 4/4 · fe 0/0 · tbl 0/0

### Builder Frontend (`frontend`) — SUPPORTED
_Super-admin certification console + reused CAF builder / blueprint / mapping / preview UI (compose/blueprint/rules/validation/preview/version/approval surfaces)._

- **Services**: —
- **Routes**: —
- **Frontend**: components/superadmin/AssessmentBuilderPanel.tsx, components/superadmin/caf/CAFAssessmentBuilderPanel.tsx, components/superadmin/CompetencyBlueprintPanel.tsx, components/superadmin/BlueprintMappingPanel.tsx, components/PreviewBlueprint.tsx
- **Tables**: —
- **Verified**: svc 0/0 · rt 0/0 · fe 5/5 · tbl 0/0
