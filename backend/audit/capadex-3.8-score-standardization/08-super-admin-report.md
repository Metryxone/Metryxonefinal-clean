# CAPADEX 3.0 · Program 3 · Phase 3.8 — Super Admin Report (dimension 5 · super_admin)

> Deliverable 08 · Generated 2026-07-01T15:58:21.450Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:71e5cbf5bb8c, written 2026-07-01T15:58:21.449Z).
> Scope: STANDARDIZATION & INTERPRETATION ONLY — standard scores/structured-AST formula engine/interpretation rules/governance/super admin/frontend/ux/APIs/testing/documentation that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance bands and interpretation-rule verdicts; it NEVER re-scores or re-validates the instrument. Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the TEN certification dimensions (standardization · formula · interpretation · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced standardization ABSTAINS below k_min=30 real members. Formulas are a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The super-admin standardization console (`ScoreStandardizationPanel`) surfaces standardization config, interpretation rule manager, band config, formula config, version control, org overrides, approval workflow and audit console. Verified vs the live frontend tree.

**Super-admin surfaces:** 7 SUPPORTED · 1 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Anchors |
|---|---|---|
| **Standardization configuration** (`standardization_config`) | SUPPORTED | components/superadmin/ScoreStandardizationPanel.tsx |
| **Interpretation rule manager** (`rule_manager`) | SUPPORTED | components/superadmin/ScoreStandardizationPanel.tsx |
| **Band configuration** (`band_config`) | SUPPORTED | components/superadmin/ScoreStandardizationPanel.tsx |
| **Formula configuration** (`formula_config`) | SUPPORTED | components/superadmin/ScoreStandardizationPanel.tsx |
| **Version control** (`version_control`) | SUPPORTED | components/superadmin/ScoreStandardizationPanel.tsx |
| **Organization overrides** (`org_overrides`) | PARTIAL | components/superadmin/ScoreStandardizationPanel.tsx |
| **Approval workflow** (`approval_workflow`) | SUPPORTED | components/superadmin/ScoreStandardizationPanel.tsx |
| **Audit console** (`audit_console`) | SUPPORTED | components/superadmin/ScoreStandardizationPanel.tsx |

### Super Admin (`super_admin`) — SUPPORTED
_Super-admin certification + management console (standardization configuration / interpretation rule manager / band configuration / formula configuration / version control / organization overrides / approval workflow / audit console) nested in the competency-framework admin shell. Organization overrides stay PARTIAL until real org override sets are populated._

- **Services**: —
- **Routes**: routes/score-standardization.ts
- **Frontend**: components/superadmin/ScoreStandardizationPanel.tsx
- **Tables**: —
- **Verified**: svc 0/0 · rt 1/1 · fe 1/1 · tbl 0/0


_Organization overrides are PARTIAL: the surface exists but real org-override configs are a data-availability boundary, NOT an engineering gap._
