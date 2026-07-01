---
name: Enterprise Benchmark Intelligence Platform (CAPADEX 3.0 3.9)
description: Durable lessons for the benchmarkIntelligence phase — the benchmark & comparison certification + reuse-before-build mechanisms composing the benchmark substrate; scope/field/deliverable traps vs prior phases (esp. 3.8).
---

# Enterprise Benchmark Intelligence Platform (CAPADEX 3.0 · Program 3 · Phase 3.9)

Flag `benchmarkIntelligence` / `FF_BENCHMARK_INTELLIGENCE` (default OFF, byte-identical incl. schema). READ-ONLY certification + reuse-before-build mechanisms mirroring 3.3–3.8. Detail in `docs/BENCHMARK_INTELLIGENCE.md`.

## Scope is BENCHMARK + COMPARISON of a STANDARDIZED result, NOT scoring/standardization/norm-building
Turns a STANDARDIZED score (3.8) + a reference group into cohort-relative z-scores, percentiles, deltas, quartiles, trends and multi-group comparisons. It NEVER re-scores, re-standardizes, re-validates or builds a norm (3.5 / 3.6 / 3.8). **AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE** — later phases. There is NO AI here; every output is deterministic. The reused benchmark substrate (`peer-benchmark` / `m5-org-benchmark` / `mei-benchmark-engine` / `adaptive-benchmark` / `benchmark-engine` / `comparative-intelligence`) is composed by EXISTENCE — **never invoked at compose time**.

## NINE dimensions (3.9 has 9, unlike 3.8's 10)
Axes = `benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis · testing · documentation`. All nine `axis_dimensions` SUPPORTED. PARTIAL entries live inside the CATALOGS (benchmark_types 7S/10P, comparison_dimensions 7S/4P, time_modes 1S/7P) and are **data-availability / upstream-input boundaries, NOT gaps** — institutional/geographic benchmark types are already reachable via generic custom groups; finer sub_domain/skill/trait inputs + historical/longitudinal modes are upstream.

## The `testing` SUPPORTED claim needs a REAL runnable suite (fabrication trap — repeated from 3.8)
The config first flipped `testing` to SUPPORTED with a statusNote citing `tests/capadex-3.9-benchmark-intelligence.test.ts` that DID NOT EXIST — a fabrication. Honest fix = create the real suite (20 node:test cases: pure mechanisms — percentile/z/delta/quartile + ABSTAIN below k_min, group suppression, trend direction, distribution binning, empirical percentile rank, structured-AST eval + a no-eval source guard — + read-only engine composition against the live DB) and run it green. **Any SUPPORTED path whose evidence arrays are empty (testing / documentation) MUST cite a file that physically exists — grep/create it before claiming.** Run with `npx tsx --test backend/tests/capadex-3.9-benchmark-intelligence.test.ts`. The `documentation` dim likewise needs `docs/BENCHMARK_INTELLIGENCE.md` to physically exist.

## Composite benchmark index MUST be a STRUCTURED AST — no eval/new Function
`evaluateBenchmarkFormula` reuses the 3.8 engine (`validateFormula` → `evaluateFormula`) with the canonical `FormulaNode` shape `{type:'op',op:'+'|'-'|'*'|'/',args:[…]}` / `{type:'var',name}` / `{type:'const',value}` (+ weighted / clamp / standardize). NEVER `eval` / `new Function`. Invalid AST → `valid:false / value:null` with validator errors (never a fabricated value). The test asserts the mechanism sources contain no `eval(` / `new Function(`.

## EXACTLY 16 deliverables (NOT 3.8's 15)
Generator emits 01→16 with 16 = Phase-3.9 Certification, asserting `count === 16`. 3.9 adds `13-benchmark-substrate-reuse.md` over 3.8's set. Re-count deliverables per phase — the number is not stable. (The earlier "generator exit 2" was a chained `ls` on a not-yet-created subdir; the generator itself exits 0.)

## Summary fields: `ready_for_certification` + `enterprise_ready`, NO `loop_closure`
Same as 3.8: verdict lives in `summary.enterprise_ready.verdict` (top-level `scan.verdict` is None by design). Summary has `ready_for_certification{ready,verdict,note}` + per-catalog `{count,status_counts}` rollups + `repository_alignment` + `adoption` + `gap_counts`/`resolved_gap_counts`. A copied 3.6 generator referencing `ready_for_phase_*` / `loop_closure` hits a missing field.

## Engine export shapes — scan imports must match
`composeDimensions/Traceability/RepositoryAlignment/Adoption/composeSummary` + `classifiedGaps` are `export async function`; `composeBenchmarkTypes/composeComparisonDimensions/composeTimeModes` are `export const` (pure catalogRollup, no pool); the `verifyControls`-backed `composeBenchmarkConfig/GovernanceStates/SuperAdminSurfaces/FrontendSurfaces/UxCriteria/ApiGroups` are `export const` that TAKE a pool.

## public-config is a SEPARATE import site (500-trap)
`routes/capadex.ts` `/public-config` `benchmark_intelligence` must `import { isBenchmarkIntelligenceEnabled }` from `config/feature-flags` or the endpoint 500s (no tsc here).

## OFF contract
`/api/benchmark-intelligence/enabled` → 503 (flagGate 503-before-auth). `/api/admin/benchmark-intelligence/*` → 401 (GLOBAL `/api/admin` gate, not the phase flag). public-config `benchmark_intelligence:false`. 0 `abmk_*` tables (all 6 overlay DDL runs only on flag-gated write paths). **New route wiring requires a Backend API RESTART.** OFF smoke ∈ {401, 403, 503}. SuperAdmin nav tab hidden OFF via `/enabled` res.ok probe; the panel uses the `GitCompare` lucide icon.

## Overlay = 6 `abmk_*` tables (repo-align tallies 9 table references)
`abmk_groups` · `abmk_configs` · `abmk_results` · `abmk_governance_log` · `abmk_audit_log` · `abmk_saved_views`. repo-align reports `tbl 0/9` (9 table references across dimensions, all ABSENT OFF — HONEST not a defect). `count()` returns null on error / 0 on no rows (null≠0); reads NEVER CREATE TABLE (write paths only, via `ensureBenchmarkSchema` after `assertEnabled`).

## Engineering closure ⟂ Adoption
Every gap engineering-CLOSED via reuse; `gaps` = 3 OPEN (0 Launch-Critical · 2 Medium GAP-BMK-1/2 · 1 Future GAP-BMK-3) + 10 RESOLVED (GAP-BMK-R1..R10). Real benchmarked/governed/audited/saved VOLUME is honest-low/0 — a usage axis reported SEPARATELY, NEVER a gap, NEVER fabricated. Benchmarking ABSTAINS < k_min=30 real members (suppressed:true/abstained:true + explicit reason). Coverage⟂Confidence⟂Adoption never composited; null≠0. STOP for approval (flag stays OFF).
