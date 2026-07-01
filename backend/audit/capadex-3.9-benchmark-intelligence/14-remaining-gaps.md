# CAPADEX 3.0 · Program 3 · Phase 3.9 — Remaining Gaps (OPEN · engineering-closed via reuse)

> Deliverable 14 · Generated 2026-07-01T18:15:29.031Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:cfbd7d362773, written 2026-07-01T18:15:29.033Z).
> Scope: BENCHMARKING & COMPARISON ONLY — benchmark engine/comparison engine/governance/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) into percentile / z / delta / quartile against a reference group across multiple comparison dimensions + time modes; it NEVER re-scores, re-standardizes or builds a norm. AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the NINE certification dimensions (benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Benchmarking ABSTAINS below k_min=30 real members in the reference group. The composite benchmark index is a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

**3 OPEN gaps: 0 Launch-Critical · 0 High · 2 Medium · 0 Low · 1 Future.**

All 10 former engineering gaps are **ENGINEERING-CLOSED** — a canonical benchmark-result layer, a multi-dimension / multi-mode comparison engine, a safe versioned structured-AST composite index, scoped benchmark configuration + custom groups, governance / version history, benchmark APIs and the console / workbench UI — via REUSE-before-build (pure compute mechanisms + own additive overlay tables), each gated by `benchmarkIntelligence` (byte-identical OFF incl. schema; DDL only on the flag-gated write paths). The composite benchmark index is a STRUCTURED AST (no eval); benchmarking ABSTAINS below k_min=30 real members. The honest BOUNDARIES that remain are coverage-breadth / upstream-input boundaries reported in-line, **NOT** Launch-Critical. What remains beyond them is **ADOPTION** — real benchmarked / governed / saved volume — a usage axis reported SEPARATELY, NEVER a gap. Coverage⟂Confidence⟂Adoption never composited; never fabricated.

## Open gaps
### Medium
#### GAP-BMK-1 — Dedicated institutional & geographic reference-cohort substrate deferred
- **Axis**: benchmark_engine
- **Detail**: class / batch / school / college / university / coaching / department / team / national / regional benchmark types are reachable ONLY via generic custom benchmark groups (abmk_groups with an explicit member/geo scope) computed by computeBenchmarkComparison; a first-class institutional-roster / geo-cohort ingestion + aggregation pipeline is NOT built in 3.9. PARTIAL (mechanism-present via custom groups), never MISSING. Closing it needs roster/geo data ingestion (integration + adoption), not a new benchmark engine.

#### GAP-BMK-2 — Fine-grained comparison dimensions PARTIAL
- **Axis**: comparison_engine
- **Detail**: sub_domain / skill / trait / learning_outcome comparison depends on a finer-grained standardized input that the upstream standardized substrate (3.5 / 3.6 / 3.8) does not uniformly expose; overall / domain / competency / behaviour / employability / leadership / readiness are SUPPORTED. Closing it depends on finer standardized inputs upstream, not the comparison engine itself.

### Future
#### GAP-BMK-3 — Cross-version benchmark re-baselining
- **Axis**: benchmark_engine
- **Detail**: Auto-migrating a subject's historical benchmark results when a benchmark config version supersedes another is a Future enhancement; full version lineage (assessment / norm / standardization / benchmark version) is already carried on every abmk_results row today, so re-baselining is additive, not a correctness gap.

## Resolved gaps (10) — engineering-closed via reuse
Severity of resolved work: 0 Launch-Critical · 2 High · 4 Medium · 4 Low · 0 Future.

| ID | Severity (was) | Axis | Gap | Resolution (reuse-before-build) |
|---|---|---|---|---|
| **GAP-BMK-R1** | High | `benchmark_engine` | No canonical benchmark layer | ENGINEERING-CLOSED via reuse: abmk_results + computeBenchmarkComparison reusing the pure psychometric zFromValue/zToPercentile + COMPOSING peer-benchmark / m5-org-benchmark / mei-benchmark-engine / adaptive-benchmark / benchmark-engine / comparative-intelligence — percentile / z / delta / quartile across 7 dedicated-substrate reference-group types. ABSTAINS below k_min. |
| **GAP-BMK-R2** | High | `comparison_engine` | No multi-dimension comparison | ENGINEERING-CLOSED via reuse: computeGroupComparison + per-dimension benchmarking across overall / domain / competency / behaviour / employability / leadership / readiness (7 SUPPORTED) composing comparative-intelligence + adaptive-benchmark. |
| **GAP-BMK-R3** | Medium | `governance` | No governance / version history for benchmark artefacts | ENGINEERING-CLOSED: abmk_governance_log + abmk_audit_log + recordGovernanceTransition moving artefacts through draft→…→retire with append-only version history + rollback + audit trail (never destructive). |
| **GAP-BMK-R4** | Medium | `apis` | No benchmark / comparison / trend / historical / configuration APIs | ENGINEERING-CLOSED: routes/benchmark-intelligence.ts exposing benchmark / comparison / trend / historical / configuration endpoints (GET certifications, pure POST computes, flag-gated POST writes). |
| **GAP-BMK-R5** | Medium | `frontend` | No benchmark console / workbench UI | ENGINEERING-CLOSED: BenchmarkIntelligencePanel (super-admin console) + BenchmarkIntelligenceWorkbench (benchmark explorer / comparison workspace / trend dashboard / heat maps / radar / scatter / distribution / cohort & historical comparison) nested in the competency-framework admin shell. |
| **GAP-BMK-R6** | Medium | `super_admin` | No benchmark library / config / rules / version / org-mapping / approval / audit console | ENGINEERING-CLOSED: BenchmarkIntelligencePanel surfaces (benchmark library / configuration / rules / version manager / organization mapping / approval / audit console). |
| **GAP-BMK-R7** | Low | `benchmark_engine` | Custom benchmark groups authored but not resolvable / applied | ENGINEERING-CLOSED via reuse: abmk_groups (benchmark_type + scope + inclusion/exclusion rules + min_sample_size + effective dates) + abmk_configs + resolveConfig + CONFIG_SCOPE_PRECEDENCE (organization > institution > custom > industry > country > lifecycle > persona > assessment, most-specific-wins) exposed as POST /configs/resolve. Real populated custom groups are an ADOPTION axis (honest 0), never a coverage gap. |
| **GAP-BMK-R8** | Low | `ux` | No saved views / side-by-side / drill-down | ENGINEERING-CLOSED: abmk_saved_views + saveView/listViews + workbench side-by-side + drill-down + interactive filtering + compare-multiple-groups. |
| **GAP-BMK-R9** | Low | `benchmark_engine` | No composite benchmark index | ENGINEERING-CLOSED via reuse: evaluateBenchmarkFormula reusing the 3.8 structured-AST formula engine (evaluateFormula/validateFormula — const/var/op/weighted/clamp/standardize, NO eval/new Function) to compose a weighted composite benchmark index, validated before evaluation. |
| **GAP-BMK-R10** | Low | `ux` | No distribution / bell-curve / heat-map / radar / scatter visualization | ENGINEERING-CLOSED via reuse: computeDistribution + computeGroupComparison + workbench SVG/table viz cards (distribution / bell curve / heat map / radar / scatter) rendering REAL computed data. Non-finite values are ignored, never fabricated. |
