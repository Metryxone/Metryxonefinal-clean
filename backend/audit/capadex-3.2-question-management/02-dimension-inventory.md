# CAPADEX 3.0 · Program 3 · Phase 3.2 — Dimension Inventory (8 certification dimensions)

> Deliverable 02 · Generated 2026-07-01T07:48:38.862Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:ad51a1f32457, written 2026-07-01T07:48:38.866Z).
> Honesty: the EIGHT certification dimensions (platform · library · metadata · governance · version_management · workflow · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The 8 INDEPENDENT dimensions. Status is a **Coverage** axis (does an implementation exist + is it wired?), kept SEPARATE from Confidence/Adoption. Evidence is VERIFIED vs the live FS+DB.

**Status:** 8 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING.

### Question Platform (single unified layer) (`platform`) — SUPPORTED
_ONE canonical platform layer COMPOSES the 13 existing question services under one registry (capadex_question_registry) + the additive qmp_* overlay. No duplicate platform; no V2._

- **Services**: services/question-management-engine.ts, services/question-management-mechanisms.ts, services/question-registry-service.ts, services/question-utility-index.ts
- **Routes**: routes/question-management.ts
- **Frontend**: components/superadmin/QuestionManagementPanel.tsx
- **Tables**: capadex_question_registry, qmp_question_metadata
- **Verified**: svc 4/4 · rt 1/1 · fe 1/1 · tbl 1/2
- **Absent tables (honest — overlay not yet written while flag OFF)**: qmp_question_metadata

### Question Library (unified over all banks) (`library`) — SUPPORTED
_ONE library abstraction over the existing physical banks (clarity · psychometric · competency · interview · CAF · LBI · exam) + qmp_collections for folders/collections. Banks are NOT merged (no breaking change) — they are unified by reference (LIBRARY_SCOPES) with collection grouping._

- **Services**: services/question-blueprint.ts, services/question-factory.ts, services/interview-question-store.ts, services/question-management-mechanisms.ts
- **Routes**: routes/capadex-questions.ts, routes/competency-questions.ts, routes/interview-questions.ts, routes/caf-question-framework.ts
- **Frontend**: components/superadmin/QuestionBankPanel.tsx, components/superadmin/CompetencyQuestionsPanel.tsx, pages/InterviewQuestionBankPage.tsx, components/superadmin/caf/CAFQuestionBankPanel.tsx
- **Tables**: psychometric_question_bank, lbi_question_bank, exam_questions, qmp_collections
- **Verified**: svc 4/4 · rt 4/4 · fe 4/4 · tbl 3/4
- **Absent tables (honest — overlay not yet written while flag OFF)**: qmp_collections

### Metadata Standard (canonical, unified) (`metadata`) — SUPPORTED
_ONE canonical metadata standard (METADATA_STANDARD) persisted in the additive qmp_question_metadata overlay — a superset spanning identity/authoring/pedagogy/psychometrics/governance/lifecycle. Existing per-bank columns remain the source of already-captured facts; the overlay UNIFIES them without migration._

- **Services**: services/question-metadata-ranking.ts, services/question-management-mechanisms.ts
- **Routes**: routes/question-management.ts
- **Frontend**: components/superadmin/QuestionManagementPanel.tsx
- **Tables**: qmp_question_metadata, capadex_question_registry
- **Verified**: svc 2/2 · rt 1/1 · fe 1/1 · tbl 1/2
- **Absent tables (honest — overlay not yet written while flag OFF)**: qmp_question_metadata

### Question Governance (ownership · review · audit · access) (`governance`) — SUPPORTED
_Governance control-plane REUSES the existing registry governance (buildGovernanceData/transitionStatus) + hypothesis-question-governance + the additive qmp_workflow audit ledger. Ownership/reviewer/approver + status-change audit + access via super-admin gate. Change history in qmp_question_versions._

- **Services**: services/question-registry-service.ts, services/hypothesis-question-governance.ts, services/question-certification.ts, services/question-management-mechanisms.ts
- **Routes**: routes/capadex-question-registry.ts, routes/question-management.ts
- **Frontend**: components/superadmin/QuestionRegistryPanel.tsx
- **Tables**: capadex_question_registry, qmp_workflow
- **Verified**: svc 4/4 · rt 2/2 · fe 1/1 · tbl 1/2
- **Absent tables (honest — overlay not yet written while flag OFF)**: qmp_workflow

### Version Management (history · compare · rollback · clone/fork/merge) (`version_management`) — SUPPORTED
_Version history + major/minor increment + compare + rollback + clone/fork/merge on the additive qmp_question_versions ledger. REUSES the existing registry integer version as the baseline pointer; each transition snapshots content so rollback/compare are lossless. Append-only (no destructive edit)._

- **Services**: services/question-management-mechanisms.ts, services/question-registry-service.ts
- **Routes**: routes/question-management.ts
- **Frontend**: components/superadmin/QuestionManagementPanel.tsx
- **Tables**: qmp_question_versions, capadex_question_registry
- **Verified**: svc 2/2 · rt 1/1 · fe 1/1 · tbl 1/2
- **Absent tables (honest — overlay not yet written while flag OFF)**: qmp_question_versions

### Question Workflow (draft → review → approve → publish → retire) (`workflow`) — SUPPORTED
_The 9-state canonical lifecycle (LIFECYCLE_STATES) mapped onto the existing 6-state registry CHECK via LIFECYCLE_MAPPING, with review→approve→publish transitions recorded in qmp_workflow. REUSES the existing transitionStatus writer; the additive states (under_review/approved/published/suspended/retired) are tracked in the overlay so the legacy CHECK is NOT broken (no breaking change)._

- **Services**: services/question-management-mechanisms.ts, services/question-registry-service.ts
- **Routes**: routes/question-management.ts
- **Frontend**: components/superadmin/QuestionManagementPanel.tsx
- **Tables**: qmp_workflow, capadex_question_registry
- **Verified**: svc 2/2 · rt 1/1 · fe 1/1 · tbl 1/2
- **Absent tables (honest — overlay not yet written while flag OFF)**: qmp_workflow

### Question APIs (unified read + governed write) (`apis`) — SUPPORTED
_ONE unified API surface (routes/question-management.ts) COMPOSES the existing per-bank route files (clarity · registry · competency · interview · CAF · factory) into a single certified read layer + governed write paths (metadata/version/collection/search/bulk/workflow). Existing routes are unchanged._

- **Services**: services/question-management-engine.ts
- **Routes**: routes/question-management.ts, routes/capadex-clarity-questions.ts, routes/capadex-question-registry.ts, routes/question-factory.ts
- **Frontend**: components/superadmin/QuestionManagementPanel.tsx
- **Tables**: capadex_question_registry
- **Verified**: svc 1/1 · rt 4/4 · fe 1/1 · tbl 1/1

### Question Frontend (unified super-admin console) (`frontend`) — SUPPORTED
_ONE flag-gated super-admin console (QuestionManagementPanel) COMPOSES the existing question panels (registry · bank · factory · competency · CAF · clarity · interview) into a single certified experience. Existing panels are unchanged; the console links to them (no fork)._

- **Services**: services/question-management-engine.ts
- **Routes**: routes/question-management.ts
- **Frontend**: components/superadmin/QuestionManagementPanel.tsx, components/superadmin/QuestionRegistryPanel.tsx, components/superadmin/QuestionFactoryPanel.tsx, components/superadmin/CapadexClarityQuestionsPanel.tsx, components/superadmin/CompetencyQuestionMapPanel.tsx
- **Tables**: —
- **Verified**: svc 1/1 · rt 1/1 · fe 5/5 · tbl 0/0
