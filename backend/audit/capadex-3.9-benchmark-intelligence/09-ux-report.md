# CAPADEX 3.0 · Program 3 · Phase 3.9 — UX Report (dimension 6 · ux)

> Deliverable 09 · Generated 2026-07-01T18:15:29.031Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:cfbd7d362773, written 2026-07-01T18:15:29.033Z).
> Scope: BENCHMARKING & COMPARISON ONLY — benchmark engine/comparison engine/governance/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) into percentile / z / delta / quartile against a reference group across multiple comparison dimensions + time modes; it NEVER re-scores, re-standardizes or builds a norm. AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the NINE certification dimensions (benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Benchmarking ABSTAINS below k_min=30 real members in the reference group. The composite benchmark index is a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The benchmark UX — interactive comparison builder, composite-index builder, live preview, percentile / bell-curve / distribution / quartile visualization, cohort drill-down, export, progressive disclosure, responsive and accessible surfaces.

**UX criteria:** 8 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Anchors |
|---|---|---|
| **Interactive filtering** (`interactive_filtering`) | SUPPORTED | components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx |
| **Drill down** (`drill_down`) | SUPPORTED | components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx |
| **Compare multiple groups** (`compare_multiple_groups`) | SUPPORTED | components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx |
| **Side-by-side view** (`side_by_side`) | SUPPORTED | components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx |
| **Benchmark explorer** (`benchmark_explorer`) | SUPPORTED | components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx |
| **Saved views** (`saved_views`) | SUPPORTED | components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx, routes/benchmark-intelligence.ts, abmk_saved_views |
| **Responsive design** (`responsive`) | SUPPORTED | components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx |
| **Accessibility** (`accessibility`) | SUPPORTED | components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx |

### UX (`ux`) — SUPPORTED
_Interactive filtering, drill-down, compare-multiple-groups, side-by-side view, benchmark explorer, saved views (abmk_saved_views), responsive + accessible surfaces. Distribution / bell-curve / heat-map / radar / scatter visualizations render real computed data; non-finite values are ignored, never fabricated._

- **Services**: —
- **Routes**: —
- **Frontend**: components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx
- **Tables**: abmk_saved_views
- **Verified**: svc 0/0 · rt 0/0 · fe 1/1 · tbl 0/1


_Per-cohort distribution + quartile visualization is WIRED: `computeDistribution` (reusing the pure reference-stats mechanism). Non-finite values are ignored; never fabricated. A reference group below k_min ABSTAINS._
