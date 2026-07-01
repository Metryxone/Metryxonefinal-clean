# CAPADEX 3.0 · Program 3 · Phase 3.2 — Question Workflow (dimension 7)

> Deliverable 08 · Generated 2026-07-01T07:48:38.862Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:ad51a1f32457, written 2026-07-01T07:48:38.866Z).
> Honesty: the EIGHT certification dimensions (platform · library · metadata · governance · version_management · workflow · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The review→approve→publish→retire workflow recorded in `qmp_workflow`, REUSING the existing `transitionStatus` writer. The additive states are tracked in the overlay so the legacy CHECK is NOT broken.

**Workflow stages:** 7 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (7 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Submit for review** (`submit_review`) | SUPPORTED | false | qmp_workflow |
| **Review** (`review`) | SUPPORTED | false | qmp_workflow |
| **Approve** (`approve`) | SUPPORTED | false | qmp_workflow |
| **Reject / request changes** (`reject`) | SUPPORTED | false | qmp_workflow |
| **Publish** (`publish`) | SUPPORTED | false | qmp_workflow |
| **Suspend** (`suspend`) | SUPPORTED | false | qmp_workflow |
| **Retire** (`retire`) | SUPPORTED | false | qmp_workflow |
