# Enterprise Question Management Platform (CAPADEX 3.0 · Program 3 · Phase 3.2)

**Flag** `questionManagementPlatform` (`FF_QUESTION_MANAGEMENT_PLATFORM`), default **OFF**. Byte-identical OFF **incl. schema** — DDL runs ONLY on the flag-gated write paths (mechanism POSTs), never at read time.

## What it is
The ONE canonical **Enterprise Question Management Platform**: a single certified layer that **COMPOSES the existing question services** under one registry (`capadex_question_registry`) + an additive `qmp_*` overlay — **NO duplicate platform, NO V2, NO breaking change**. It mirrors CAPADEX 1.3–1.7 / 3.1 exactly: a frozen pure-data registry + a read-only never-throws composer + flag-gated routes + a scan-locked deliverables generator, and it ALSO engineering-closes 8 gaps via reuse-before-build.

## Architecture
- **Registry (SSoT, pure data):** `backend/config/question-management-platform.ts`
  - 8 `QMP_DIMENSIONS` (platform · library · metadata · governance · version_management · workflow · apis · frontend)
  - 29-type `QUESTION_TYPES` catalog (14 SUPPORTED · 15 PARTIAL — types without a dedicated renderer are honestly PARTIAL, not fabricated as rendered)
  - 36-field `METADATA_STANDARD` + 4 `METADATA_SOURCE_COVERAGE` sources
  - 9 `LIFECYCLE_STATES` + `LIFECYCLE_MAPPING` onto the existing 6-state CHECK (no CHECK break)
  - `GOVERNANCE_CONTROLS` (8), `VERSION_CAPABILITIES` (7), `WORKFLOW_STAGES` (7), `SEARCH_CAPABILITIES` (5), `BULK_OPERATIONS` (5), 6 `LIBRARY_SCOPES`, 8-step `MAPPING_MODEL`, 5 `QMP_DECISIONS`
  - `QMP_GAPS = []` (0 open) + `RESOLVED_QMP_GAPS` (QM-1..QM-8)
- **Composer (read-only, never-throws):** `backend/services/question-management-engine.ts` — `composeDimensions` / `composeTypeCatalog` / `composeMetadata` / `composeLifecycle` / `composeGovernance` / `composeVersioning` / `composeWorkflow` / `composeSearch` / `composeBulkOps` / `composeLibrary` / `composeRepositoryAlignment` / `composeAdoption` / `composeSummary` / `classifiedGaps`. GET-only, `to_regclass`/fs probes, `readScalar` null-on-error / 0-on-no-rows. The EIGHT dimensions are reported **SEPARATELY and NEVER composited**.
- **Mechanisms (reuse-before-build, the ONLY DDL sites):** `backend/services/question-management-mechanisms.ts` — creates/writes the `qmp_*` overlay behind flag + super-admin.
- **Routes:** `backend/routes/question-management.ts` — `/api/question-management/enabled` (flag probe, 503-before-auth OFF) + super-admin `/api/admin/question-management/*` cert GETs + mechanism GET/POST.
- **public-config:** `routes/capadex.ts` `/public-config` exposes `question_management_platform` (**dual import-site** — must import `isQuestionManagementPlatformEnabled` or the endpoint 500s).
- **Frontend:** `frontend/src/components/superadmin/QuestionManagementPanel.tsx` — read-only certification console; conditional-spread nav item in `SuperAdminDashboard.tsx` (tab hidden when the flag is OFF).

## The 8 gaps — ENGINEERING-CLOSED via REUSE (0 OPEN · 8 RESOLVED)
Every former gap has a real mechanism behind the flag, over the EXISTING registry + an additive `qmp_*` overlay:

| ID | Sev | Dimension | Mechanism (reuse) |
|---|---|---|---|
| QM-1 | High | metadata | `qmp_question_metadata` overlay + `METADATA_STANDARD` unifying existing sources (no migration) |
| QM-2 | High | version_management | `qmp_question_versions` append-only ledger + snapshot/compare/rollback/clone/fork/merge |
| QM-3 | High | workflow | 9-state canonical model mapped onto the CHECK via `qmp_workflow` (no CHECK break) |
| QM-4 | Medium | governance | `qmp_question_metadata` owner/author + `qmp_workflow` reviewer/approver + reused registry audit |
| QM-5 | Medium | library | `LIBRARY_SCOPES` reference-unification + `qmp_collections` folders |
| QM-6 | Medium | apis | Unified read + governed write API + `qmp_saved_searches` + `qmp_bulk_jobs` ledger |
| QM-7 | Medium | frontend | `QuestionManagementPanel` composing the existing panels behind the flag |
| QM-8 | Low | platform | `question-management-engine` composer + registry as the canonical layer |

## Deliverables (SSoT-locked)
- Scan: `backend/scripts/capadex-3.2-question-management-scan.ts` → `backend/audit/capadex-3.2-question-management/scan.json` (repo+DB scan; SCAN_HASH sha256).
- Generator: `backend/scripts/capadex-3.2-generate-deliverables.ts` reads **ONLY** scan.json → **14 deliverables** (13 numbered `01`..`13` + `completion-certification.md`). Re-run scan **then** generator after any registry/panel change.

## Honesty invariant — engineering closure ⟂ adoption
The mechanism EXISTS for every gap, but real authored-question VOLUME across the overlay is honest-low/0 in dev. **Adoption is a SEPARATE usage axis — never a gap, never fabricated as adopted.** Repository-alignment reads tbl 9/15 because the 6 `qmp_*` overlay tables only exist after the flag-gated mechanism POSTs run — that is HONEST (do not create them at read time). Metadata 15/36 covered = Coverage. **Coverage ⟂ Confidence ⟂ Adoption never composited; null ≠ 0; nothing fabricated.**

## Verdict
`STRUCTURAL_COMPLETE_ADOPTION_PENDING` — all 8 dimensions SUPPORTED, 0 OPEN gaps, 8 RESOLVED via reuse. What remains is ADOPTION (real question volume), reported separately.

→ `.agents/memory/question-management-platform.md` for the durable traps.
