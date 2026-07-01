# CAPADEX 3.0 · Program 3 · Phase 3.8 — Governance Report (dimension 4 · governance)

> Deliverable 05 · Generated 2026-07-01T17:13:35.500Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:470cd868e0df, written 2026-07-01T17:13:35.497Z).
> Scope: STANDARDIZATION & INTERPRETATION ONLY — standard scores/structured-AST formula engine/interpretation rules/governance/super admin/frontend/ux/APIs/testing/documentation that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance bands and interpretation-rule verdicts; it NEVER re-scores or re-validates the instrument. Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the TEN certification dimensions (standardization · formula · interpretation · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced standardization ABSTAINS below k_min=30 real members. Formulas are a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Formulas / bands / rules / configs move through **draft → review → validate → approve → publish → archive → retire** with version history, rollback and an audit trail — recorded in the additive `astd_governance_log` overlay via the flag-gated governance transition path.

**Governance states:** 10 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (10 total).

| Capability | Status | Anchors |
|---|---|---|
| **Draft** (`draft`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_governance_log |
| **Review** (`review`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_governance_log |
| **Validate** (`validate`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_validations, astd_governance_log |
| **Approve** (`approve`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_governance_log |
| **Publish** (`publish`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_governance_log |
| **Archive** (`archive`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_governance_log |
| **Retire** (`retire`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_governance_log |
| **Version history** (`version_history`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_governance_log |
| **Rollback** (`rollback`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_governance_log |
| **Audit trail** (`audit_trail`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_governance_log |

### Governance (`governance`) — SUPPORTED
_ONE canonical governance layer (astd_governance_log) moving every standardization artefact (formula / band set / rule / config) through draft→review→validate→approve→publish→archive→retire with append-only version history, rollback (restore a prior version) and a full audit trail. State transitions are recorded, never destructive._

- **Services**: services/score-standardization-mechanisms.ts, services/score-standardization-engine.ts
- **Routes**: routes/score-standardization.ts
- **Frontend**: components/superadmin/ScoreStandardizationPanel.tsx
- **Tables**: astd_governance_log, astd_formulas, astd_configs
- **Verified**: svc 2/2 · rt 1/1 · fe 1/1 · tbl 0/3

