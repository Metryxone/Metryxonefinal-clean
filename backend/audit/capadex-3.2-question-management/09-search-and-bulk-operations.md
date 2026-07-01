# CAPADEX 3.0 · Program 3 · Phase 3.2 — Search & Bulk Operations (dimension 8 · apis)

> Deliverable 09 · Generated 2026-07-01T07:48:38.862Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:ad51a1f32457, written 2026-07-01T07:48:38.866Z).
> Honesty: the EIGHT certification dimensions (platform · library · metadata · governance · version_management · workflow · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

ONE unified search + discovery surface + a governed bulk-operations ledger (`qmp_bulk_jobs`), COMPOSING the existing per-bank routes into a single certified read + write layer.

## Search & discovery
**Search capabilities:** 5 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (5 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Full-text search (ILIKE over text)** (`text_search`) | SUPPORTED | true | routes/question-management.ts |
| **Faceted filter (type/status/domain/tags)** (`faceted_filter`) | SUPPORTED | true | services/question-registry-service.ts |
| **Metadata filter (overlay)** (`metadata_filter`) | SUPPORTED | false | qmp_question_metadata |
| **Saved searches** (`saved_search`) | SUPPORTED | false | qmp_saved_searches |
| **Quality / signal ranking** (`quality_ranking`) | SUPPORTED | true | services/question-metadata-ranking.ts |

## Bulk operations
**Bulk operations:** 5 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (5 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Bulk import (CSV/JSON)** (`import`) | SUPPORTED | true | routes/capadex-clarity-questions.ts, qmp_bulk_jobs |
| **Bulk export** (`export`) | SUPPORTED | false | qmp_bulk_jobs |
| **Bulk tag / classify** (`bulk_tag`) | SUPPORTED | false | qmp_bulk_jobs |
| **Bulk status transition** (`bulk_status`) | SUPPORTED | true | qmp_bulk_jobs, services/question-registry-service.ts |
| **Bulk review / approve** (`bulk_review`) | SUPPORTED | false | qmp_bulk_jobs, qmp_workflow |

_Saved searches persist to `qmp_saved_searches`; bulk jobs to `qmp_bulk_jobs`. Both are additive overlays, flag-gated._
