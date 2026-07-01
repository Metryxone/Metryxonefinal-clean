# CAPADEX 3.0 · Program 3 · Phase 3.9 — Benchmark Types Report

> Deliverable 04 · Generated 2026-07-01T18:15:29.031Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:cfbd7d362773, written 2026-07-01T18:15:29.033Z).
> Scope: BENCHMARKING & COMPARISON ONLY — benchmark engine/comparison engine/governance/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) into percentile / z / delta / quartile against a reference group across multiple comparison dimensions + time modes; it NEVER re-scores, re-standardizes or builds a norm. AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the NINE certification dimensions (benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Benchmarking ABSTAINS below k_min=30 real members in the reference group. The composite benchmark index is a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

A standardized score can be benchmarked against 17 reference-group types. The 7 SUPPORTED types are reachable directly today; the 10 PARTIAL types are reachable via generic **custom benchmark groups** (`saveGroup` inclusion/exclusion + `min_sample_size`) pending first-class roster ingestion — an ADOPTION / upstream-input boundary, NOT a coverage gap. Every benchmark ABSTAINS below k_min=30 real members.

**Benchmark types:** 7 SUPPORTED · 10 PARTIAL · 0 DEAD_END · 0 MISSING (17 total).

| Capability | Status | Note |
|---|---|---|
| **Self (own baseline / prior)** (`self`) | SUPPORTED | A subject benchmarked against its own standardized baseline (3.8 astd_standard_scores) — computeBenchmarkComparison against the subject's prior standard score. No cohort, no k_min gating. |
| **Peer cohort** (`peer`) | SUPPORTED | Peer benchmarking reuses services/peer-benchmark.ts (K=30 cohort) + comparative-intelligence — percentile / delta vs a peer group, ABSTAINS below k_min. |
| **Class** (`class`) | PARTIAL | Reachable via a generic custom benchmark group (abmk_groups with an explicit class member scope) computed by computeBenchmarkComparison; a first-class class roster/aggregation is deferred (GAP-BMK-1). PARTIAL, not MISSING. |
| **Batch** (`batch`) | PARTIAL | Reachable via a custom benchmark group (abmk_groups); a first-class batch roster/aggregation is deferred (GAP-BMK-1). |
| **School** (`school`) | PARTIAL | Reachable via a custom benchmark group (abmk_groups); a first-class school roster/aggregation is deferred (GAP-BMK-1). |
| **College** (`college`) | PARTIAL | Reachable via a custom benchmark group (abmk_groups); a first-class college roster/aggregation is deferred (GAP-BMK-1). |
| **University** (`university`) | PARTIAL | Reachable via a custom benchmark group (abmk_groups); a first-class university roster/aggregation is deferred (GAP-BMK-1). |
| **Coaching institute** (`coaching`) | PARTIAL | Reachable via a custom benchmark group (abmk_groups); a first-class coaching-institute roster/aggregation is deferred (GAP-BMK-1). |
| **Organization** (`organization`) | SUPPORTED | Organization benchmarking reuses services/m5-org-benchmark.ts — org-scoped percentile / delta, ABSTAINS below k_min. |
| **Department** (`department`) | PARTIAL | Reachable via a custom benchmark group (abmk_groups with a department member scope) computed over org substrate; a first-class department aggregation is deferred (GAP-BMK-1). |
| **Team** (`team`) | PARTIAL | Reachable via a custom benchmark group (abmk_groups with a team member scope); a first-class team aggregation is deferred (GAP-BMK-1). |
| **Industry** (`industry`) | SUPPORTED | Industry benchmarking reuses m5-org-benchmark industry references + mei-benchmark-engine + adaptive-benchmark (industry cohort) — ABSTAINS below k_min. |
| **Functional / role family** (`functional`) | SUPPORTED | Functional (role-family) benchmarking reuses adaptive-benchmark cohort resolution + benchmark-engine — ABSTAINS below k_min. |
| **National** (`national`) | PARTIAL | Reachable via a custom benchmark group (abmk_groups with a national geo scope); a first-class national geo-cohort ingestion is deferred (GAP-BMK-1). |
| **Regional** (`regional`) | PARTIAL | Reachable via a custom benchmark group (abmk_groups with a regional geo scope); a first-class regional geo-cohort ingestion is deferred (GAP-BMK-1). |
| **Global** (`global`) | SUPPORTED | Global benchmarking reuses adaptive-benchmark (global cohort) / benchmark-engine (unfiltered reference) — percentile vs the whole standardized population, ABSTAINS below k_min. |
| **Custom benchmark group** (`custom`) | SUPPORTED | Fully custom benchmark groups (abmk_groups: benchmark_type + scope + inclusion/exclusion rules + min_sample_size + effective dates) computed deterministically by computeBenchmarkComparison — the reuse path that makes every PARTIAL institutional / geo type reachable. Real populated custom groups are an ADOPTION axis (honest 0), never a coverage gap. |
