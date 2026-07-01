---
name: Enterprise Score Standardization & Interpretation Framework (CAPADEX 3.0 3.8)
description: Durable lessons for the scoreStandardization phase — standardization & interpretation certification layer composing the psychometric substrate; scope/field/deliverable traps vs prior phases.
---

# Enterprise Score Standardization & Interpretation Framework (CAPADEX 3.0 · Program 3 · Phase 3.8)

Flag `scoreStandardization` / `FF_SCORE_STANDARDIZATION` (default OFF, byte-identical incl. schema). READ-ONLY certification + reuse-before-build mechanisms mirroring 3.3–3.7. Detail in `docs/SCORE_STANDARDIZATION.md`.

## Scope is STANDARDIZATION + INTERPRETATION of a scored result, NOT scoring/validation/benchmark
Turns a SCORED result + norm reference into standard scores, performance bands and interpretation-rule verdicts. It NEVER re-scores, re-validates, or builds a norm (3.5 / 3.6). **Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE** — do not fold them in here; they are later phases. This is a narrower scope than 3.7 (which owned interpretation + reporting + benchmarking).

## Ten dimensions (3.8 HAS `ux`, unlike 3.7)
Axes = `standard_scores · formula_engine · interpretation_rules · governance · super_admin · frontend · ux · apis · testing · documentation`. 3.7 dropped `ux`; **3.8 restores it** as a first-class dimension. All ten are SUPPORTED; PARTIALs live inside the catalogs (custom org bands, industry/org/country/institution/custom configs, comparison screen, heat maps, regression validation, org overrides, end-user guide) and are data-availability / follow-on boundaries, NOT gaps.

## Formulas MUST be a STRUCTURED AST — no eval/new Function
Composite formula capability is evaluated by a whitelisted AST interpreter (`evaluateFormula`). This is a hard phase requirement — never `eval` / `new Function`. Same rule as 3.5's formula framework.

## EXACTLY 15 deliverables (NOT 3.7's 13)
Generator emits 01→15 with 15 = Phase-3.8 Certification, and asserts `count === 15` by an EXPECTED array. 3.7 was 13 (separate adoption + cert). When mirroring, re-count deliverables per phase — the number is not stable across phases.

## Summary fields: `ready_for_certification` + `enterprise_ready`, NO `ready_for_phase_*`, NO `loop_closure`
Summary exposes `ready_for_certification{ready,verdict,note}` + `enterprise_ready{verdict,note}`. Verdict lives in `summary.enterprise_ready.verdict` (top-level `scan.verdict` is None by design — read the summary). Generator reads these; a copied 3.6 generator referencing `ready_for_phase_3_7` / `loop_closure` would hit a missing field.

## Engine export shapes differ — scan imports must match
`composeDimensions/Traceability/RepositoryAlignment/Adoption/composeSummary` + `classifiedGaps` are `export async function`; the 10 catalog/control composers (`composeStandardScoreTypes/PerformanceBands/InterpretationRuleTypes/ConfigScopes/FormulaCapabilities/GovernanceStates/ValidationChecks/SuperAdminSurfaces/FrontendSurfaces/UxCriteria`) are `export const`. The scan must import each with the right shape.

## public-config is a SEPARATE import site (500-trap)
`routes/capadex.ts` `/public-config` `score_standardization` must `import { isScoreStandardizationEnabled }` from `config/feature-flags` or the endpoint 500s (no tsc here).

## OFF contract (verified post-restart)
`/api/score-standardization/enabled` → 503 (flagGate 503-before-auth). `/api/admin/score-standardization/*` → 401 (GLOBAL `/api/admin` gate, not the phase flag). public-config `score_standardization:false`. 0 `astd_*` tables (all 7 overlay DDL runs only on flag-gated write paths). **New route wiring requires a Backend API RESTART** — before restart `/enabled` was 404 and public-config omitted the key even though the code was correct.

## Engineering closure ⟂ Adoption
Every gap engineering-CLOSED via reuse; `gaps` = 0 OPEN + 6 RESOLVED. Real standardized/interpreted/governed VOLUME is honest-low/0 — a usage axis reported SEPARATELY, NEVER a gap, NEVER fabricated. Norm-referenced standardization ABSTAINS < k_min=30. Coverage⟂Confidence⟂Adoption never composited; null≠0. STOP for approval (flag stays OFF).
