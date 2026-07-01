# CAPADEX 3.0 · Program 3 · Phase 3.1 — Assessment Category Model

> Deliverable 04 · Generated 2026-07-01T06:40:17.982Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:5aa01cf06010, written 2026-07-01T06:40:17.982Z).
> Honesty: the FIVE certification axes (architecture · lifecycle · governance · metadata · repository-alignment) are reported SEPARATELY and NEVER composited. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Validated categories ⟂ non-validated scaffolds. Scaffolds are **boundary markers, NOT products** — never certified as validated or for clinical/diagnostic use.

## Validated categories
| Category | Validated | Clinical use | Description | Evidence |
|---|---|---|---|---|
| **Academic** (`academic`) | ✅ | no | Curriculum/competency academic assessments (CAF family). | assessment_templates.category, caf_assessments |
| **Behavioural** (`behavioural`) | ✅ | no | CAPADEX behavioural-signal assessments (concern/clarity). | capadex_sessions, capadex_signal_profiles |
| **Competency** (`competency`) | ✅ | no | Ontology-backed competency assessment (onto_* / LBI). | onto_competency_question_map, psychometric_question_bank |
| **Practice** (`practice`) | ✅ | no | Curated practice/MCQ delivery (learning sub-type). | assessment_templates.category |
| **Olympiad** (`olympiad`) | ✅ | no | Olympiad/short-assessment templates. | assessment_templates.category, routes/short-assessments.ts |

## Non-validated scaffolds (boundary markers only)
| Category | Validated | Clinical use | Disclaimer |
|---|---|---|---|
| Clinical Psychology (scaffold) (`clinical_psychology`) | ❌ not validated | ❌ not for clinical/diagnostic use | NOT VALIDATED / NOT FOR CLINICAL OR DIAGNOSTIC USE — boundary marker only. |
| Healthcare (scaffold) (`healthcare`) | ❌ not validated | ❌ not for clinical/diagnostic use | NOT VALIDATED / NOT FOR CLINICAL OR DIAGNOSTIC USE — boundary marker only. |
| Government / Public-Sector (scaffold) (`government`) | ❌ not validated | ❌ not for clinical/diagnostic use | NOT VALIDATED — scaffold registry entry, not a product. |
