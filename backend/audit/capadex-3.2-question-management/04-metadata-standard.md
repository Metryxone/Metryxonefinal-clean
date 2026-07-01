# CAPADEX 3.0 · Program 3 · Phase 3.2 — Metadata Standard & Source Coverage (dimension 3)

> Deliverable 04 · Generated 2026-07-01T07:48:38.862Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:ad51a1f32457, written 2026-07-01T07:48:38.866Z).
> Honesty: the EIGHT certification dimensions (platform · library · metadata · governance · version_management · workflow · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The canonical **36-field** question-metadata standard (9 required), persisted in the additive `qmp_question_metadata` overlay. A field only counts as "covered" when at least one source is VERIFIED present (null/absent sources do not inflate coverage).

**Union coverage:** 15/36 fields have ≥1 verified source. Uncovered (honest): external_ref, library_scope, domain, subdomain, competency, construct, bloom_level, cognitive_load, age_band, persona, tags, keywords, marks, weight, discrimination, owner, author, reviewer, approver, source_provenance, published_at.

## The 36-field standard
| Field | Required | Group | Source (where the fact lives today) |
|---|---|---|---|
| `question_id` | required | identity | capadex_question_registry |
| `external_ref` | optional | identity | qmp_question_metadata |
| `library_scope` | required | identity | qmp_question_metadata |
| `question_type` | required | identity | psychometric_question_bank |
| `question_text` | required | identity | bank tables |
| `language` | required | identity | psychometric_question_bank |
| `domain` | optional | pedagogy | competency/psychometric domain |
| `subdomain` | optional | pedagogy | psychometric_subdomains |
| `competency` | optional | pedagogy | competency_question_templates |
| `construct` | optional | pedagogy | clarity bridge tag |
| `bloom_level` | optional | pedagogy | qmp_question_metadata |
| `difficulty` | optional | pedagogy | psychometric_question_bank |
| `cognitive_load` | optional | pedagogy | qmp_question_metadata |
| `age_band` | optional | pedagogy | psychometric_age_bands |
| `persona` | optional | pedagogy | qmp_question_metadata |
| `tags` | optional | pedagogy | qmp_question_metadata |
| `keywords` | optional | pedagogy | qmp_question_metadata |
| `marks` | optional | psychometrics | qmp_question_metadata |
| `weight` | optional | psychometrics | qmp_question_metadata |
| `scoring_logic` | optional | psychometrics | psychometric_question_bank |
| `reverse_scored` | optional | psychometrics | psychometric_question_bank |
| `discrimination` | optional | psychometrics | qmp_question_metadata |
| `signal_value` | optional | psychometrics | capadex_question_registry |
| `quality_score` | optional | psychometrics | capadex_question_registry |
| `usage_count` | optional | psychometrics | capadex_question_registry |
| `coverage_dimension` | optional | psychometrics | capadex_question_registry |
| `owner` | optional | governance | qmp_question_metadata |
| `author` | optional | authoring | qmp_question_metadata |
| `reviewer` | optional | governance | qmp_workflow |
| `approver` | optional | governance | qmp_workflow |
| `source_provenance` | optional | authoring | qmp_question_metadata |
| `version` | required | lifecycle | capadex_question_registry |
| `status` | required | lifecycle | capadex_question_registry |
| `created_at` | required | lifecycle | capadex_question_registry |
| `updated_at` | required | lifecycle | capadex_question_registry |
| `published_at` | optional | lifecycle | qmp_workflow |

## Per-source coverage crosswalk (verified vs live FS+DB)
| Source | Present | Fields | Note |
|---|---|---|---|
| `capadex_question_registry` | true | 9 | Governance overlay — the canonical id/version/status + quality/usage/signal facts. |
| `psychometric_question_bank` | true | 6 | Psychometric bank — type/text/language + scoring facts. |
| `qmp_question_metadata` | false | 13 | Additive canonical overlay — the fields no legacy bank captured; unifies without migration. |
| `qmp_workflow` | false | 3 | Additive workflow ledger — review/approval/publish authorship + timestamps. |

_`present` — `true`=verified, `false`=absent, `—`=unknown (unreadable ≠ absent; null≠0). Overlay tables are absent while the flag has never run its write paths — expected + honest._
