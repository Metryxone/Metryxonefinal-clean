# CAPADEX 3.0 · Program 3 · Phase 3.2 — Question Lifecycle Model (dimension 4)

> Deliverable 05 · Generated 2026-07-01T07:48:38.862Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:ad51a1f32457, written 2026-07-01T07:48:38.866Z).
> Honesty: the EIGHT certification dimensions (platform · library · metadata · governance · version_management · workflow · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

ONE canonical **9-state** question lifecycle mapped onto the EXISTING 6-state registry CHECK via the `qmp_workflow` overlay (zero CHECK widening — no breaking change, byte-identical OFF).

**Mapping status:** 9 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING.

## The 9-state canonical lifecycle
| # | State | Note |
|---|---|---|
| 1 | **Draft** (`draft`) | Authoring; not yet submitted. |
| 2 | **Under review** (`under_review`) | Submitted for review (qmp_workflow). |
| 3 | **Approved** (`approved`) | Review passed; awaiting publish (qmp_workflow). |
| 4 | **Published** (`published`) | Live-eligible; equivalent to legacy active (qmp_workflow). |
| 5 | **Active** (`active`) | In live rotation (registry status active). |
| 6 | **Suspended** (`suspended`) | Temporarily withheld (qmp_workflow). |
| 7 | **Deprecated** (`deprecated`) | Discouraged; kept for continuity (registry). |
| 8 | **Retired** (`retired`) | Removed from rotation, retained for audit (qmp_workflow). |
| 9 | **Archived** (`archived`) | Cold storage (registry status archived). |

## Mapping onto the existing 6-state registry CHECK (verified vs live FS+DB)
| Canonical state | Maps to (existing CHECK) | Source | Status | Source present |
|---|---|---|---|---|
| draft | `draft` | `capadex_question_registry` | SUPPORTED | true |
| under_review | `testing` | `qmp_workflow` | SUPPORTED | false |
| approved | `testing` | `qmp_workflow` | SUPPORTED | false |
| published | `active` | `qmp_workflow` | SUPPORTED | false |
| active | `active` | `capadex_question_registry` | SUPPORTED | true |
| suspended | `candidate_for_retirement` | `qmp_workflow` | SUPPORTED | false |
| deprecated | `deprecated` | `capadex_question_registry` | SUPPORTED | true |
| retired | `candidate_for_retirement` | `qmp_workflow` | SUPPORTED | false |
| archived | `archived` | `capadex_question_registry` | SUPPORTED | true |

_The 4 additive states (under_review/approved/published/suspended/retired) are tracked in `qmp_workflow`; the legacy CHECK is untouched._
