# CAPADEX 3.0 · Program 3 · Phase 3.8 — Frontend Report (dimension 6 · frontend)

> Deliverable 09 · Generated 2026-07-01T15:58:21.450Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:71e5cbf5bb8c, written 2026-07-01T15:58:21.449Z).
> Scope: STANDARDIZATION & INTERPRETATION ONLY — standard scores/structured-AST formula engine/interpretation rules/governance/super admin/frontend/ux/APIs/testing/documentation that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance bands and interpretation-rule verdicts; it NEVER re-scores or re-validates the instrument. Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the TEN certification dimensions (standardization · formula · interpretation · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced standardization ABSTAINS below k_min=30 real members. Formulas are a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The super-admin standardization console (`ScoreStandardizationPanel`) + the interactive `StandardizationWorkbench` (standard scores · structured-AST formulas · bands · interpretation · validation) that exercises the pure standardization mechanisms live. Verified vs the live frontend tree.

**Frontend evidence (verified):** fe 8/8.

**Frontend surfaces:** 9 SUPPORTED · 1 PARTIAL · 0 DEAD_END · 0 MISSING (10 total).

| Capability | Status | Anchors |
|---|---|---|
| **Standardization console** (`standardization_console`) | SUPPORTED | components/superadmin/ScoreStandardizationPanel.tsx |
| **Formula builder** (`formula_builder`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Rule builder** (`rule_builder`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Band builder** (`band_builder`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Distribution viewer** (`distribution_viewer`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Percentile explorer** (`percentile_explorer`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Version manager** (`version_manager`) | SUPPORTED | components/superadmin/ScoreStandardizationPanel.tsx |
| **Validation dashboard** (`validation_dashboard`) | SUPPORTED | components/superadmin/ScoreStandardizationPanel.tsx |
| **Preview screen** (`preview_screen`) | SUPPORTED | components/standardization/StandardizationWorkbench.tsx |
| **Comparison screen** (`comparison_screen`) | PARTIAL | components/standardization/StandardizationWorkbench.tsx |

### Frontend (`frontend`) — SUPPORTED
_Interactive standardization workbench (formula builder / rule builder / band builder / distribution viewer / percentile explorer / preview) + super-admin console (standardization console / version manager / validation dashboard). Comparison screen stays PARTIAL (single-artefact preview shipped; multi-version diff is a follow-on)._

- **Services**: —
- **Routes**: —
- **Frontend**: components/superadmin/ScoreStandardizationPanel.tsx, components/standardization/StandardizationWorkbench.tsx
- **Tables**: —
- **Verified**: svc 0/0 · rt 0/0 · fe 2/2 · tbl 0/0


_The workbench renders honest ABSTAIN / empty / loading / error states — a value below k_min renders as an explicit "abstained" marker, never a fabricated number; null (unreadable) renders as "not measurable", distinct from 0 (empty). Comparison screen is PARTIAL — a follow-on surface, not a gap._
