---
name: Enterprise Score Standardization & Interpretation Framework (CAPADEX 3.0 3.8)
description: Durable lessons for the scoreStandardization phase — standardization & interpretation certification layer composing the psychometric substrate; scope/field/deliverable traps vs prior phases.
---

# Enterprise Score Standardization & Interpretation Framework (CAPADEX 3.0 · Program 3 · Phase 3.8)

Flag `scoreStandardization` / `FF_SCORE_STANDARDIZATION` (default OFF, byte-identical incl. schema). READ-ONLY certification + reuse-before-build mechanisms mirroring 3.3–3.7. Detail in `docs/SCORE_STANDARDIZATION.md`.

## Scope is STANDARDIZATION + INTERPRETATION of a scored result, NOT scoring/validation/benchmark
Turns a SCORED result + norm reference into standard scores, performance bands and interpretation-rule verdicts. It NEVER re-scores, re-validates, or builds a norm (3.5 / 3.6). **Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE** — do not fold them in here; they are later phases. This is a narrower scope than 3.7 (which owned interpretation + reporting + benchmarking).

## Ten dimensions (3.8 HAS `ux`, unlike 3.7)
Axes = `standard_scores · formula_engine · interpretation_rules · governance · super_admin · frontend · ux · apis · testing · documentation`. 3.7 dropped `ux`; **3.8 restores it** as a first-class dimension. After the "fix 100%" cycle **every catalog leaf is SUPPORTED — 0 PARTIAL across all dimensions AND all paths**; the former 10 PARTIALs (custom org bands, industry/org/country/institution/custom configs, comparison screen, heat maps, regression validation, org overrides) were engineering-closed via real wired code (pure mechanisms + routes + workbench cards). The ONLY honest boundaries left are perf / accessibility / full-HTTP tests + an end-user guide — reported IN-LINE in statusNotes, NEVER as gaps.

## The `testing` SUPPORTED claim needs a REAL runnable suite (fabrication trap)
`testing` was first flipped to SUPPORTED with a statusNote citing a test file that DID NOT EXIST — a fabrication. Honest fix = create the real suite `scripts/test-score-standardization.ts` (53 assertions: unit mechanisms + integration/composer against the live DB) and keep the statusNote scoped to what it actually covers (perf/accessibility/full-HTTP stay follow-ons). Any SUPPORTED path whose evidence arrays are empty (testing/documentation) MUST cite a file that physically exists — grep for it before claiming.

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

## Workbench default AST must use the CANONICAL FormulaNode shape
Every default formula the workbench seeds into a textarea (`StandardizationWorkbench.tsx`) MUST be the canonical `FormulaNode` shape `{type:'op',op:'+'|'-'|'*'|'/',args:[…]}` / `{type:'var',name}` / `{type:'const',value}` — NOT the ergonomic-looking `{op:'add',var:'x',const:0.5}`. The wrong shape passes esbuild/tsc (it's just JSON in a string) but the live `evaluateFormula` returns `unknown_node_type`/null, so the "Validate + evaluate" demo silently fails on first render — which quietly undermines the SUPPORTED frontend/workbench claim. Verify EVERY seeded default (primary formula AND regression baseline/candidate) by round-tripping it through `evaluateFormula` (e.g. `70 + 40*0.5 → 90`), not by build alone.

## Engineering closure ⟂ Adoption
Every gap engineering-CLOSED via reuse; `gaps` = 0 OPEN + 12 RESOLVED. Real standardized/interpreted/governed VOLUME is honest-low/0 — a usage axis reported SEPARATELY, NEVER a gap, NEVER fabricated. Norm-referenced standardization ABSTAINS < k_min=30. Coverage⟂Confidence⟂Adoption never composited; null≠0. STOP for approval (flag stays OFF).
