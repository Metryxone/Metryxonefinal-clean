# CAPADEX 3.0 · Program 3 · Phase 3.8 — Formula Engine Report (dimension 2 · formula)

> Deliverable 03 · Generated 2026-07-01T17:13:35.500Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:470cd868e0df, written 2026-07-01T17:13:35.497Z).
> Scope: STANDARDIZATION & INTERPRETATION ONLY — standard scores/structured-AST formula engine/interpretation rules/governance/super admin/frontend/ux/APIs/testing/documentation that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance bands and interpretation-rule verdicts; it NEVER re-scores or re-validates the instrument. Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the TEN certification dimensions (standardization · formula · interpretation · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced standardization ABSTAINS below k_min=30 real members. Formulas are a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Composite / weighted standardization formulas are a **STRUCTURED AST** — a JSON expression tree (`op`/`args`, `var`, `const`) evaluated by a **whitelisted interpreter** (`evaluateFormula`) with **NO `eval` / `new Function`**. Formulas are validated (`validateFormula`) before evaluation, versioned (`astd_formulas` + `astd_governance_log`) and safely previewed. An invalid AST returns validation errors and a null value — never an exception, never fabricated.

**Formula-engine capabilities:** 6 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (6 total).

| Capability | Status | Anchors |
|---|---|---|
| **Structured AST (no eval)** (`structured_ast`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_formulas |
| **Versioned formulas** (`versioned`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_formulas, astd_governance_log |
| **Weighted composite** (`weighted_composite`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_formulas |
| **Safe evaluation (whitelisted ops)** (`safe_evaluation`) | SUPPORTED | services/score-standardization-mechanisms.ts |
| **Formula validation** (`validation`) | SUPPORTED | services/score-standardization-mechanisms.ts, astd_validations |
| **Live preview evaluation** (`preview`) | SUPPORTED | services/score-standardization-mechanisms.ts, routes/score-standardization.ts |

### Formula Engine (`formula`) — SUPPORTED
_ONE canonical formula engine (astd_formulas) defining standardization / composite formulas as a STRUCTURED AST (const / var / op(+,-,*,/) / weighted / clamp / standardize nodes — NO eval, NO new Function) that is versioned, validated (validateFormula) and safely evaluated (evaluateFormula) with live preview. Governed through the standardization lifecycle with version history + rollback._

- **Services**: services/score-standardization-mechanisms.ts, services/score-standardization-engine.ts
- **Routes**: routes/score-standardization.ts
- **Frontend**: components/standardization/StandardizationWorkbench.tsx
- **Tables**: astd_formulas, astd_governance_log
- **Verified**: svc 2/2 · rt 1/1 · fe 1/1 · tbl 0/2


_Formulas are a STRUCTURED AST evaluated by a whitelisted interpreter — no `eval`, no `new Function`. Unknown operators / variables / non-finite results are rejected by validation, not executed._
