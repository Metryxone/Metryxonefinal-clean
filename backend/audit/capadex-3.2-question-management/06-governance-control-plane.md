# CAPADEX 3.0 · Program 3 · Phase 3.2 — Governance / Control-Plane (dimension 5)

> Deliverable 06 · Generated 2026-07-01T07:48:38.862Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:ad51a1f32457, written 2026-07-01T07:48:38.866Z).
> Honesty: the EIGHT certification dimensions (platform · library · metadata · governance · version_management · workflow · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The question governance control-plane REUSES the existing registry governance + adds the `qmp_workflow` audit ledger. Status is Coverage; `evidence present` is verified vs live FS+DB.

**Controls:** 8 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Ownership / authorship** (`ownership`) | SUPPORTED | true | qmp_question_metadata, services/question-management-mechanisms.ts |
| **Review workflow** (`review`) | SUPPORTED | true | qmp_workflow, services/question-management-mechanisms.ts |
| **Approval gate** (`approval`) | SUPPORTED | false | qmp_workflow |
| **Publish control** (`publish`) | SUPPORTED | false | qmp_workflow |
| **Status-change audit trail** (`audit_trail`) | SUPPORTED | true | capadex_question_registry, qmp_workflow |
| **Change history** (`change_history`) | SUPPORTED | false | qmp_question_versions |
| **Access control (super-admin gate)** (`access_control`) | SUPPORTED | true | routes/question-management.ts |
| **Quality / signal governance** (`quality_governance`) | SUPPORTED | true | services/question-registry-service.ts, services/question-certification.ts |

_Access control is the super-admin gate on every route; change history is the append-only `qmp_question_versions` ledger; status-change audit reuses the registry + workflow ledger._
