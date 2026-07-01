# CAPADEX 3.0 · Program 3 · Phase 3.1 — Governance / Control-Plane Model (Axis 3)

> Deliverable 06 · Generated 2026-07-01T07:15:13.791Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:6a98bbfa5f18, written 2026-07-01T07:15:13.862Z).
> Honesty: the FIVE certification axes (architecture · lifecycle · governance · metadata · repository-alignment) are reported SEPARATELY and NEVER composited. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The assessment governance control-plane. Status is Coverage; `evidence present` is verified vs live FS+DB.

**Status:** 7 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING.

| Control | Status | Evidence present | Anchors |
|---|---|---|---|
| **Super-admin gate** (`admin_gate`) | SUPPORTED | true | services/governance/admin-lifecycle.ts, lib/admin-path-gate.ts |
| **Feature-flag control plane** (`feature_flags`) | SUPPORTED | true | config/feature-flags.ts |
| **Lifecycle governance** (`lifecycle_governance`) | SUPPORTED | true | services/governance/admin-lifecycle.ts, services/platform-lifecycle.ts |
| **Audit trail** (`audit_trail`) | SUPPORTED | true | admin_audit_logs, routes/platform-audit-routes.ts |
| **Question/registry governance** (`question_governance`) | SUPPORTED | true | services/question-registry-service.ts, capadex_question_registry |
| **AI-prompt governance** (`prompt_governance`) | SUPPORTED | true | services/prompt-registry-activation.ts, aig_prompts, aig_prompt_versions |
| **Ethics / norm-fabrication gate** (`ethics_gate`) | SUPPORTED | true | services/lbi-norms-engine.ts |

## Descriptions
- **Super-admin gate** — requireAuth + requireSuperAdmin front every management surface; global /api/admin gate applies platform-wide.
- **Feature-flag control plane** — Every additive phase ships behind a default-OFF flag; OFF is byte-identical incl. schema.
- **Lifecycle governance** — Review/approval transitions governed by admin-lifecycle; no parallel lifecycle engine.
- **Audit trail** — Admin actions written to a redacted, unified audit trail.
- **Question/registry governance** — Item status transitions are human-only; served bank reads only approved rows.
- **AI-prompt governance** — Code-embedded prompts registered into aig_prompts/aig_prompt_versions with an active version; resolvePrompt reads through the registry with a code-literal fallback (byte-identical OFF).
- **Ethics / norm-fabrication gate** — Group norms compute only from real, k-sufficient distributions; gender norms are owner/legal-gated; never fabricated.

_Ethics/norm-fabrication gate: group norms compute ONLY from real k-sufficient distributions; gender norms are owner/legal-gated; never fabricated._
