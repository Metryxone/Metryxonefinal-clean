# CAPADEX 3.0 · Program 3 · Phase 3.9 — Benchmark Configuration & Scoping Report

> Deliverable 05 · Generated 2026-07-01T18:15:29.031Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:cfbd7d362773, written 2026-07-01T18:15:29.033Z).
> Scope: BENCHMARKING & COMPARISON ONLY — benchmark engine/comparison engine/governance/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) into percentile / z / delta / quartile against a reference group across multiple comparison dimensions + time modes; it NEVER re-scores, re-standardizes or builds a norm. AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the NINE certification dimensions (benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Benchmarking ABSTAINS below k_min=30 real members in the reference group. The composite benchmark index is a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

A benchmark configuration (reference group + comparison dimensions + composite index + min sample size) can be scoped — organization / institution / industry / country / custom — stored via `saveConfig` and resolved most-specific-wins via `resolveConfig` + `CONFIG_SCOPE_PRECEDENCE`, over the additive `abmk_configs` overlay.

**Benchmark config controls:** 7 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (7 total).

| Capability | Status | Anchors |
|---|---|---|
| **Benchmark group definitions** (`benchmark_groups`) | SUPPORTED | services/benchmark-intelligence-mechanisms.ts, abmk_groups |
| **Inclusion rules** (`inclusion_rules`) | SUPPORTED | services/benchmark-intelligence-mechanisms.ts, abmk_groups |
| **Exclusion rules** (`exclusion_rules`) | SUPPORTED | services/benchmark-intelligence-mechanisms.ts, abmk_groups |
| **Minimum sample size (k_min)** (`min_sample_size`) | SUPPORTED | services/benchmark-intelligence-mechanisms.ts, abmk_groups |
| **Benchmark versioning** (`versioning`) | SUPPORTED | services/benchmark-intelligence-mechanisms.ts, abmk_configs, abmk_governance_log |
| **Effective dates** (`effective_dates`) | SUPPORTED | services/benchmark-intelligence-mechanisms.ts, abmk_groups |
| **Organization overrides (scope precedence)** (`organization_overrides`) | SUPPORTED | services/benchmark-intelligence-mechanisms.ts, routes/benchmark-intelligence.ts, abmk_configs |

_Scoped configs + custom groups are WIRED: stored (`saveConfig` / `saveGroup`) AND resolved most-specific-wins (`resolveConfig`). A real populated config / group per scope is an ADOPTION axis (honest 0), NOT a coverage gap._
