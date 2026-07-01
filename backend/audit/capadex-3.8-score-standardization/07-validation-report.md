# CAPADEX 3.0 · Program 3 · Phase 3.8 — Validation & Testing Report (dimension 9 · testing)

> Deliverable 07 · Generated 2026-07-01T17:13:35.500Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:470cd868e0df, written 2026-07-01T17:13:35.497Z).
> Scope: STANDARDIZATION & INTERPRETATION ONLY — standard scores/structured-AST formula engine/interpretation rules/governance/super admin/frontend/ux/APIs/testing/documentation that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance bands and interpretation-rule verdicts; it NEVER re-scores or re-validates the instrument. Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the TEN certification dimensions (standardization · formula · interpretation · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced standardization ABSTAINS below k_min=30 real members. Formulas are a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Standardization artefacts are validated — formula validation, distribution validation (ABSTAINS below k_min=30), range, boundary, statistical, regression and exception handling — via the pure validation mechanisms; results are recorded in the additive `astd_validations` overlay.

**Validation checks:** 7 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (7 total).

| Capability | Status | Anchors |
|---|---|---|
| **Formula validation** (`formula`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_validations |
| **Distribution validation** (`distribution`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_validations |
| **Range validation** (`range`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_validations |
| **Boundary validation** (`boundary`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_validations |
| **Statistical validation** (`statistical`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_validations |
| **Regression validation** (`regression`) | SUPPORTED | services/score-standardization-mechanisms.ts, routes/score-standardization.ts, astd_validations |
| **Exception handling** (`exception`) | SUPPORTED | services/score-standardization-mechanisms.ts |

### Testing (`testing`) — SUPPORTED
_A runnable standardization test suite (scripts/test-score-standardization.ts, 53 assertions passing) covering standardization transforms, structured-AST formula evaluation + validation, band classification + per-cohort heat map, interpretation-rule verdicts, the validation checks (distribution / range / boundary / statistical / regression version-diff) and scope-precedence / governance-order invariants (UNIT), plus read-only engine composition against the live DB (INTEGRATION) — alongside the certification scan itself. Performance / accessibility / full HTTP-API tests stay a follow-on._

- **Services**: —
- **Routes**: —
- **Frontend**: —
- **Tables**: —
- **Verified**: svc 0/0 · rt 0/0 · fe 0/0 · tbl 0/0


_Regression validation is WIRED: `validateRegression` (formula + band modes) is exposed via POST /compute/validation (check_type=regression), proving a candidate does not silently diverge from a baseline across reference samples beyond tolerance. A real stored baseline to regress against is an ADOPTION axis (honest 0), NOT a coverage gap._
