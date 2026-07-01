# CAPADEX 3.0 · Program 3 · Phase 3.9 — Comparison Engine Report (dimension 2 · comparison_engine)

> Deliverable 03 · Generated 2026-07-01T18:15:29.031Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:cfbd7d362773, written 2026-07-01T18:15:29.033Z).
> Scope: BENCHMARKING & COMPARISON ONLY — benchmark engine/comparison engine/governance/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) into percentile / z / delta / quartile against a reference group across multiple comparison dimensions + time modes; it NEVER re-scores, re-standardizes or builds a norm. AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the NINE certification dimensions (benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Benchmarking ABSTAINS below k_min=30 real members in the reference group. The composite benchmark index is a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Multi-dimension / multi-group / multi-mode comparison — self vs peer / cohort / organization / industry / global reference groups, across comparison dimensions + time modes, with trend and distribution views — via the pure `computeGroupComparison` / `computeTrend` / `computeDistribution` mechanisms + a STRUCTURED-AST composite benchmark index (`evaluateBenchmarkFormula`, reusing the 3.8 whitelisted interpreter — NO eval / new Function). Comparisons over reference groups below k_min ABSTAIN — never fabricated.

**Comparison dimensions:** 7 SUPPORTED · 4 PARTIAL · 0 DEAD_END · 0 MISSING (11 total).

| Capability | Status | Note |
|---|---|---|
| **Overall** (`overall`) | SUPPORTED | Overall standardized score benchmarked against the reference group — benchmark-engine + astd_standard_scores.overall. |
| **Domain** (`domain`) | SUPPORTED | Per-domain benchmarking reuses adaptive-benchmark (family/domain) + comparative-intelligence. |
| **Sub-domain** (`sub_domain`) | PARTIAL | Sub-domain benchmarking depends on a finer-grained standardized sub-domain input that is not uniformly present upstream (3.5/3.6/3.8) — reachable when the standardized substrate exposes sub-domain scores (GAP-BMK-2). |
| **Competency** (`competency`) | SUPPORTED | Per-competency benchmarking reuses adaptive-benchmark (competency) + comparative-intelligence. |
| **Behaviour** (`behaviour`) | SUPPORTED | Per-behaviour benchmarking reuses benchmark-engine behaviour metrics + the standardized behaviour scores. |
| **Skill** (`skill`) | PARTIAL | Skill-level benchmarking depends on a finer-grained standardized skill input not uniformly present upstream (GAP-BMK-2). |
| **Trait** (`trait`) | PARTIAL | Trait-level benchmarking depends on a standardized trait input not uniformly present upstream (GAP-BMK-2). |
| **Learning outcome** (`learning_outcome`) | PARTIAL | Learning-outcome benchmarking depends on a standardized learning-outcome input not uniformly present upstream (GAP-BMK-2). |
| **Employability** (`employability`) | SUPPORTED | Employability benchmarking reuses services/mei-benchmark-engine.ts (MEI) — ABSTAINS below k_min. |
| **Leadership** (`leadership`) | SUPPORTED | Leadership benchmarking reuses m5-org-benchmark leadership references + comparative-intelligence. |
| **Readiness** (`readiness`) | SUPPORTED | Readiness benchmarking reuses benchmark-engine + comparative-intelligence readiness metrics. |

**Time modes:** 1 SUPPORTED · 7 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Note |
|---|---|---|
| **Current (point-in-time)** (`current`) | SUPPORTED | A point-in-time benchmark of the subject's current standardized score against the reference group — fully computable now. |
| **Historical** (`historical`) | PARTIAL | Mechanism present (timestamped/versioned abmk_results + /results/list ordered by time); real historical benchmark VOLUME is an ADOPTION axis (honest 0), reported SEPARATELY, never a gap. |
| **Trend** (`trend`) | PARTIAL | Mechanism present (pure computeTrend over a benchmark series + POST /compute/trend); real time-series VOLUME across abmk_results is an ADOPTION axis (honest 0). |
| **Growth** (`growth`) | PARTIAL | Mechanism present (computeTrend delta/direction over a benchmark series); real longitudinal benchmark VOLUME is an ADOPTION axis (honest 0). |
| **Improvement** (`improvement`) | PARTIAL | Mechanism present (computeTrend positive-slope detection); real time-series VOLUME is an ADOPTION axis (honest 0). |
| **Regression (backward slide)** (`regression`) | PARTIAL | Mechanism present (computeTrend negative-slope / decline detection); real time-series VOLUME is an ADOPTION axis (honest 0). Distinct from formula/version regression validation. |
| **Longitudinal** (`longitudinal`) | PARTIAL | Mechanism present (computeTrend over the full benchmark series); real longitudinal benchmark VOLUME is an ADOPTION axis (honest 0). |
| **Cohort progression** (`cohort_progression`) | PARTIAL | Mechanism present (computeGroupComparison over successive cohort snapshots); real cohort-snapshot VOLUME is an ADOPTION axis (honest 0). |

### Comparison Engine (`comparison_engine`) — SUPPORTED
_Multi-dimensional + multi-mode comparison: computeGroupComparison + per-dimension benchmarking across 7 SUPPORTED comparison dimensions (overall / domain / competency / behaviour / employability / leadership / readiness) — the 4 finer dimensions (sub_domain / skill / trait / learning_outcome) are PARTIAL, depending on a finer-grained standardized input upstream (GAP-BMK-2). Point-in-time (current) comparison is SUPPORTED; 7 time-series modes (historical / trend / growth / improvement / regression / longitudinal / cohort_progression) are mechanism-present (pure computeTrend + timestamped/versioned abmk_results) with real time-series VOLUME an ADOPTION axis (honest 0), never a gap._

- **Services**: services/benchmark-intelligence-mechanisms.ts, services/benchmark-intelligence-engine.ts, services/comparative-intelligence.ts, services/adaptive-benchmark.ts
- **Routes**: routes/benchmark-intelligence.ts
- **Frontend**: components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx
- **Tables**: abmk_results, abmk_configs
- **Verified**: svc 4/4 · rt 1/1 · fe 1/1 · tbl 0/2


_The composite benchmark index is a STRUCTURED AST evaluated by a whitelisted interpreter — no `eval`, no `new Function`. Unknown operators / variables / non-finite results are rejected by validation, not executed._
