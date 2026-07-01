# 04 · Assessment Foundation Blueprint (Layer 1)

**Mode:** Read-only / planning-only. No changes. **Layer status: SUPPORTED.**

## Canonical Definition
The Assessment Foundation defines *what an assessment is* in CAPADEX: its type, category, template, metadata, version, lifecycle, governance, and publishing state. The single source of truth is the FROZEN registry `backend/config/assessment-framework.ts`.

## Capability Evidence
| Capability | Status | Repository Evidence |
| :-- | :-- | :-- |
| Assessment Types | SUPPORTED | `config/assessment-framework.ts` — frozen **10-type taxonomy** (Entry / Baseline / Diagnostic / Behaviour / Competency + Progress / Exit / Continuous + Learning / Performance). `SPEC_19_CROSSWALK` maps 19 legacy spec names into the canon. |
| Assessment Categories | SUPPORTED | `assessment_templates.category` (Academic / Practice / Olympiad, etc.). |
| Assessment Templates | SUPPORTED | `assessment_templates`, `assessment_template_questions`, `test_blueprints`; `routes/short-assessments.ts`. |
| Assessment Metadata | SUPPORTED | Per-type metadata in `assessment-framework.ts` (purpose, business value, personas, scoring method, lifecycle stage, status). |
| Assessment Versioning | SUPPORTED | `routes/assessment-writer.ts` `/api/career/assessment/_meta/version`; `methodology_versions` (competency-graph runtime). |
| Assessment Lifecycle | SUPPORTED | Types map to lifecycle stages `CAP_CUR / CAP_INS / CAP_GRW / CAP_MAS`; `services/platform-lifecycle.ts`. |
| Assessment Governance | SUPPORTED | `services/governance/admin-lifecycle.ts`; `routes/assessment-framework.ts` super-admin coverage/gaps/summary/lifecycle-closure endpoints. |
| Assessment Publishing | SUPPORTED | `exams.status` (Draft / Published); `caf_assessments.status` + `published_at`; `routes/short-assessments.ts`. |

## Taxonomy Health (from `assessment-framework.ts`)
- **IMPLEMENTED (8):** Entry, Baseline, Diagnostic, Behaviour, Competency, Progress, Exit, Continuous.
- **PARTIAL (2):** Learning, Performance (content breadth residual — 1 Medium item tracked in the Assessment Framework phase; not launch-critical).
- **KNOWN_OVERLAPS** are recorded as recommend-only consolidation candidates (LBI ⟂ Competency stay separate by design).

## Governance & Lifecycle Closure
The foundation is closed-loop by REUSE: Progress/Exit/Continuous are instrumented through the pre-existing `services/capadex/progression-outcome-capture.ts` (milestones into `validation_loop_outcomes`, read-derived reassessment freshness), gated by the separate `longitudinalOutcomeCapture` flag. No parallel lifecycle engine exists.

## Gaps
None at Layer 1. The Learning/Performance PARTIAL status is content-breadth, tracked separately, and not a foundation gap.

## Freeze Position
**FREEZE.** The 10-type taxonomy, the metadata schema, and the lifecycle/governance/publishing model are canonical. Future assessment types must be added into this registry, never as a parallel taxonomy.
