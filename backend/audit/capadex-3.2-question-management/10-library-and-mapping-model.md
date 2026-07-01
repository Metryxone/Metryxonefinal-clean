# CAPADEX 3.0 · Program 3 · Phase 3.2 — Library Scopes, Mapping Model & Repository Alignment (dimensions 1–2)

> Deliverable 10 · Generated 2026-07-01T07:48:38.862Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:ad51a1f32457, written 2026-07-01T07:48:38.866Z).
> Honesty: the EIGHT certification dimensions (platform · library · metadata · governance · version_management · workflow · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

## Library scopes (6) — physical banks unified by REFERENCE (never merged)
| Scope | Physical table | Status | Table present |
|---|---|---|---|
| **CAPADEX clarity (behavioural)** (`clarity`) | `capadex_question_registry` | SUPPORTED | true |
| **Psychometric** (`psychometric`) | `psychometric_question_bank` | SUPPORTED | true |
| **Competency (CAF)** (`competency`) | `competency_question_templates` | SUPPORTED | true |
| **Interview** (`interview`) | `interview_questions` | SUPPORTED | true |
| **Learning behaviour (LBI)** (`lbi`) | `lbi_question_bank` | SUPPORTED | true |
| **Exam-ready** (`exam`) | `exam_questions` | SUPPORTED | true |

Banks are unified by reference (LIBRARY_SCOPES) + `qmp_collections` folders — NOT merged (no breaking change).

## Question → platform mapping model (8 steps)
Each step → the dimension it belongs to + the EXISTING engine/table it REUSES (reuse-before-build).

| Step | Dimension | Action | Reused services | Reused tables |
|---|---|---|---|---|
| 1 | `platform` | Register question in canonical registry | services/question-registry-service.ts | capadex_question_registry |
| 2 | `library` | Assign to library scope + collection | services/question-management-mechanisms.ts | qmp_collections |
| 3 | `metadata` | Populate canonical metadata overlay | services/question-metadata-ranking.ts | qmp_question_metadata |
| 4 | `workflow` | Submit → review → approve → publish | services/question-management-mechanisms.ts | qmp_workflow |
| 5 | `version_management` | Snapshot version on each transition | services/question-management-mechanisms.ts | qmp_question_versions |
| 6 | `governance` | Enforce ownership + audit + access | services/question-registry-service.ts | capadex_question_registry |
| 7 | `apis` | Serve via unified read + governed write API | services/question-management-engine.ts | — |
| 8 | `frontend` | Manage via unified super-admin console | services/question-management-engine.ts | — |

## Repository alignment (Coverage-only, verified vs live FS+DB)
Every dimension evidence claim verified INDEPENDENTLY against the live filesystem + DB. null (unknown) ≠ 0 (absent).

| Evidence kind | Present / Total |
|---|---|
| Services | 20/20 |
| Routes | 15/15 |
| Frontend | 15/15 |
| Tables | 9/15 (absent 6, unknown 0) |

_Every dimension evidence claim is verified INDEPENDENTLY against the live FS (services/routes/frontend) and DB (to_regclass). null (unknown) ≠ 0 (absent). Coverage-only — kept SEPARATE from Confidence/Adoption. qmp_* overlay tables are absent while the flag has never run its write paths — that is expected + honest._
