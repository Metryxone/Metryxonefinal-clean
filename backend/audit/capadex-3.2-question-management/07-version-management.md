# CAPADEX 3.0 · Program 3 · Phase 3.2 — Version Management (dimension 6)

> Deliverable 07 · Generated 2026-07-01T07:48:38.862Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:ad51a1f32457, written 2026-07-01T07:48:38.866Z).
> Honesty: the EIGHT certification dimensions (platform · library · metadata · governance · version_management · workflow · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Full version lifecycle on the additive append-only `qmp_question_versions` ledger — REUSES the existing registry integer version as the baseline pointer; each transition snapshots content so rollback/compare are lossless (no destructive edit).

**Version capabilities:** 7 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (7 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Full version history** (`history`) | SUPPORTED | false | qmp_question_versions |
| **Major / minor increment** (`increment`) | SUPPORTED | true | services/question-management-mechanisms.ts |
| **Version compare / diff** (`compare`) | SUPPORTED | true | services/question-management-mechanisms.ts |
| **Rollback to prior version** (`rollback`) | SUPPORTED | false | qmp_question_versions |
| **Clone question** (`clone`) | SUPPORTED | true | services/question-management-mechanisms.ts |
| **Fork (branch)** (`fork`) | SUPPORTED | false | qmp_question_versions |
| **Merge branch** (`merge`) | SUPPORTED | true | services/question-management-mechanisms.ts |
