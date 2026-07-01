# CAPADEX 3.0 · Program 3 · Phase 3.9 — Benchmark Engine Report (dimension 1 · benchmark_engine)

> Deliverable 02 · Generated 2026-07-01T18:15:29.031Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:cfbd7d362773, written 2026-07-01T18:15:29.033Z).
> Scope: BENCHMARKING & COMPARISON ONLY — benchmark engine/comparison engine/governance/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) into percentile / z / delta / quartile against a reference group across multiple comparison dimensions + time modes; it NEVER re-scores, re-standardizes or builds a norm. AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the NINE certification dimensions (benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Benchmarking ABSTAINS below k_min=30 real members in the reference group. The composite benchmark index is a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

A standardized score is benchmarked against a reference distribution — percentile rank, z-score, delta-from-mean and quartile — via the pure `computeReferenceStats` / `computeBenchmarkComparison` / `computePercentileRank` mechanisms reusing the `psychometric-standardization` transforms (`zFromValue` / `zToPercentile`) + the additive `abmk_results` overlay. The transforms are pure functions of the score + reference distribution; benchmarking ABSTAINS below k_min=30 real members (returns `abstained=true`, values null) — never fabricated.

### Benchmark Engine (`benchmark_engine`) — SUPPORTED
_ONE canonical benchmark layer (abmk_results) turning a standardized score into a benchmark result (percentile / z / delta / quartile / cohort-size / suppressed) by COMPOSING the existing benchmark substrate (peer-benchmark / m5-org-benchmark / mei-benchmark-engine / adaptive-benchmark / benchmark-engine / comparative-intelligence) + the pure psychometric transforms (zFromValue/zToPercentile) — ABSTAINS below k_min real members, never fabricated. 7 reference-group TYPES are dedicated-substrate SUPPORTED (self/peer/organization/industry/functional/global/custom); the 10 institutional / geographic TYPES (class/batch/school/college/university/coaching/department/team/national/regional) are PARTIAL — reachable via generic custom benchmark groups, a first-class roster/geo-cohort ingestion is deferred (GAP-BMK-1), a coverage-breadth boundary NOT an engine gap. A composite benchmark index reuses the 3.8 structured-AST formula engine (no eval)._

- **Services**: services/benchmark-intelligence-mechanisms.ts, services/benchmark-intelligence-engine.ts, services/peer-benchmark.ts, services/m5-org-benchmark.ts, services/mei-benchmark-engine.ts, services/adaptive-benchmark.ts, services/benchmark-engine.ts, services/comparative-intelligence.ts, services/psychometric-standardization.ts
- **Routes**: routes/benchmark-intelligence.ts
- **Frontend**: components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx
- **Tables**: astd_standard_scores, abmk_results, abmk_groups
- **Verified**: svc 9/9 · rt 1/1 · fe 1/1 · tbl 0/3

