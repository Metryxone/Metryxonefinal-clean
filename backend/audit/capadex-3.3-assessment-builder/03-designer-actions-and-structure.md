# CAPADEX 3.0 · Program 3 · Phase 3.3 — Designer Actions & Assessment Structure (dimension 1 · builder)

> Deliverable 03 · Generated 2026-07-01T08:55:12.461Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:bcdece46fdc2, written 2026-07-01T08:55:12.462Z).
> Scope: AUTHORING ONLY — design/compose/configure/validate/version/approve/publish; NOT delivery/scoring/psychometrics.
> Honesty: the SEVEN certification dimensions (builder · blueprint · validation · version_management · publishing · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The authoring surface: the 7 designer actions an author performs and the 10 structure levels an assessment is composed from + the 8 composition capabilities. All COMPOSE the existing CAF builder / assembly / writer by reference — no duplicate builder.

## Designer actions (7)
**Designer actions:** 7 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (7 total).

| Capability | Status | Note |
|---|---|---|
| **Create assessment** (`create`) | SUPPORTED | ab_assessments authoring record (composes caf_assessments/assessment_blueprints by reference). |
| **Edit assessment** (`edit`) | SUPPORTED | Structure/config JSONB edited in place; every save snapshots a version. |
| **Clone assessment** (`clone`) | SUPPORTED | Deep copy → new authoring record via cloneAssessment (reuse version snapshot). |
| **Version assessment** (`version`) | SUPPORTED | Append-only ab_assessment_versions (major/minor/draft). |
| **Archive assessment** (`archive`) | SUPPORTED | Workflow transition to archived (reversible, never destructive). |
| **Restore assessment** (`restore`) | SUPPORTED | Workflow transition back to draft/active from archived. |
| **Publish assessment** (`publish`) | SUPPORTED | Workflow transition to published/active after human approval + validation-clean. |

## Structure levels (10)
**Structure levels:** 10 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (10 total).

| Capability | Status | Note |
|---|---|---|
| **Section** (`section`) | SUPPORTED | caf_assessment_sections / structure JSONB sections[]. |
| **Page** (`page`) | SUPPORTED | Structure JSONB page grouping within a section. |
| **Group** (`group`) | SUPPORTED | Question grouping (pool / ordered block). |
| **Category** (`category`) | SUPPORTED | Category tag on a section/group. |
| **Domain** (`domain`) | SUPPORTED | caf_domains / competency domain binding. |
| **Subdomain** (`subdomain`) | SUPPORTED | Subdomain binding under a domain. |
| **Competency** (`competency`) | SUPPORTED | assessment_blueprint_competencies / onto_blueprint_competency_map. |
| **Behaviour** (`behaviour`) | SUPPORTED | Behaviour anchor on a section/competency. |
| **Skill** (`skill`) | SUPPORTED | Skill mapping in the blueprint. |
| **Learning objective** (`learning_objective`) | SUPPORTED | Learning-objective tag on a section/competency. |

## Composition capabilities (8)
**Composition capabilities:** 8 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Note |
|---|---|---|
| **Add question** (`add_question`) | SUPPORTED | Bind a question ref into a section (caf_section_questions / structure JSONB). |
| **Remove question** (`remove_question`) | SUPPORTED | Unbind a question ref (reversible). |
| **Reorder** (`reorder`) | SUPPORTED | Order index on section questions. |
| **Question pool** (`question_pool`) | SUPPORTED | Fixed pool of candidate questions per section. |
| **Random pool** (`random_pool`) | SUPPORTED | caf_randomization_rules / draw-N-of-M pool. |
| **Mandatory question** (`mandatory_question`) | SUPPORTED | Required flag on a bound question. |
| **Optional question** (`optional_question`) | SUPPORTED | Optional flag on a bound question. |
| **Section rule** (`section_rule`) | SUPPORTED | Per-section min/max/select rules in structure JSONB. |
