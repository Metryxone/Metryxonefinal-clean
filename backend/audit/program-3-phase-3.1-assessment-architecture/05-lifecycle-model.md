# CAPADEX 3.0 · Program 3 · Phase 3.1 — Assessment Lifecycle Model (Axis 2)

> Deliverable 05 · Generated 2026-07-01T06:40:17.982Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:5aa01cf06010, written 2026-07-01T06:40:17.982Z).
> Honesty: the FIVE certification axes (architecture · lifecycle · governance · metadata · repository-alignment) are reported SEPARATELY and NEVER composited. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

ONE canonical **10-state** assessment lifecycle mapped onto the EXISTING per-artifact lifecycle states (zero DDL — no new lifecycle engine).

**Mapping status:** 3 SUPPORTED · 3 PARTIAL · 0 DEAD_END · 0 MISSING.

## The 10-state canonical lifecycle
| # | State | Description | Maps onto (existing) |
|---|---|---|---|
| 1 | **Draft** (`draft`) | Authored, not yet reviewed. | exams.status=Draft; caf_assessments.status=draft; question_registry status=draft |
| 2 | **Review** (`review`) | Submitted for content/SME review. | governance/admin-lifecycle.ts review transition; question-registry human review |
| 3 | **Pilot** (`pilot`) | Limited pilot administration to gather item statistics. | assessment_templates pilot rows; caf pilot sessions (caf_sessions) |
| 4 | **Validation** (`validation`) | Reliability/validity checked before approval. | services/reliability-engine.ts outputs; validation_loop_outcomes |
| 5 | **Approval** (`approval`) | Human/governance approval to publish. | services/governance/admin-lifecycle.ts approve; question_registry status=approved |
| 6 | **Published** (`published`) | Published/available but not yet the served default. | exams.status=Published; caf_assessments.published_at |
| 7 | **Active** (`active`) | Live and being administered to users. | capadex_sessions (live runs); caf_sessions (live) |
| 8 | **Suspended** (`suspended`) | Temporarily withdrawn (issue/hold) — reversible. | services/platform-lifecycle.ts suspend; feature-flag gate OFF (reversible) |
| 9 | **Deprecated** (`deprecated`) | Superseded by a newer version; retained for continuity. | services/platform-lifecycle.ts deprecate; methodology_versions superseded |
| 10 | **Archived** (`archived`) | Retired from service; retained for audit only. | services/platform-lifecycle.ts archive; lbi_questions_legacy (archived bank) |

## Per-artifact lifecycle reconciliation (verified vs live FS+DB)
| Artifact | States | Source | Status | Source present |
|---|---|---|---|---|
| exams | Draft → Published | `exams.status` | PARTIAL | true |
| caf_assessments | draft → published (published_at) | `caf_assessments.status + published_at` | PARTIAL | true |
| question registry | draft → approved | `capadex_question_registry status` | PARTIAL | true |
| platform lifecycle | active → suspended → deprecated → archived | `services/platform-lifecycle.ts` | SUPPORTED | false |
| governance lifecycle | review → approval | `services/governance/admin-lifecycle.ts` | SUPPORTED | false |
| CAPADEX lifecycle stages | CAP_CUR → CAP_INS → CAP_GRW → CAP_MAS (subject journey, distinct axis) | `lib/lifecycle.ts` | SUPPORTED | false |

_`source present` — `true`=verified, `false`=absent, `—`=unknown (unreadable ≠ absent; null≠0)._
