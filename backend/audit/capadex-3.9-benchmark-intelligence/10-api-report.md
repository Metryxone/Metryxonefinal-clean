# CAPADEX 3.0 · Program 3 · Phase 3.9 — API Report (dimension 7 · apis)

> Deliverable 10 · Generated 2026-07-01T18:15:29.031Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:cfbd7d362773, written 2026-07-01T18:15:29.033Z).
> Scope: BENCHMARKING & COMPARISON ONLY — benchmark engine/comparison engine/governance/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) into percentile / z / delta / quartile against a reference group across multiple comparison dimensions + time modes; it NEVER re-scores, re-standardizes or builds a norm. AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the NINE certification dimensions (benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Benchmarking ABSTAINS below k_min=30 real members in the reference group. The composite benchmark index is a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The unified benchmark API surface at `/api/admin/benchmark-intelligence/*` (super-admin cert GETs) + `/api/benchmark-intelligence/enabled` (flag probe) + the mechanism POST paths (compute/{reference-stats,benchmark,group-comparison,trend,distribution,percentile-rank,formula}) and the overlay write paths (groups / configs / results / governance / audit / views save + list GETs).

**API groups:** 5 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (5 total).

| Capability | Status | Anchors |
|---|---|---|
| **Benchmark APIs** (`benchmark_apis`) | SUPPORTED | routes/benchmark-intelligence.ts, services/benchmark-intelligence-mechanisms.ts |
| **Comparison APIs** (`comparison_apis`) | SUPPORTED | routes/benchmark-intelligence.ts, services/benchmark-intelligence-mechanisms.ts |
| **Trend APIs** (`trend_apis`) | SUPPORTED | routes/benchmark-intelligence.ts, services/benchmark-intelligence-mechanisms.ts |
| **Historical APIs** (`historical_apis`) | SUPPORTED | routes/benchmark-intelligence.ts, abmk_results |
| **Configuration APIs** (`configuration_apis`) | SUPPORTED | routes/benchmark-intelligence.ts, abmk_configs, abmk_groups |

## Traceability model (5 standardized-score→benchmark-artefact links)
Each link → the artefact it carries + the EXISTING source it REUSES (reuse-before-build).

**Traceability status:** 5 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING.

| Link | Source (reused) | Status | Note |
|---|---|---|---|
| **Standardized score** (`standardized_score`) | `astd_standard_scores` | SUPPORTED | The standardized score (3.8) benchmarked — the benchmark input, carried on every benchmark result. |
| **Assessment version** (`assessment_version`) | `abmk_results.assessment_version` | SUPPORTED | The assessment version the standardized score was produced against — carried on every benchmark result. |
| **Norm version** (`norm_version`) | `aint_norm_tables (3.7) + abmk_results.norm_version` | SUPPORTED | The norm reference (3.7) the score was standardized against — carried on every benchmark result. |
| **Standardization version** (`standardization_version`) | `astd_configs + abmk_results.standardization_version` | SUPPORTED | The versioned standardization config (3.8) applied — carried on every benchmark result. |
| **Benchmark version** (`benchmark_version`) | `abmk_configs.version + abmk_results.benchmark_version` | SUPPORTED | The versioned benchmark config (group + dimension + time mode) applied — carried on every benchmark result. |

### APIs (`apis`) — SUPPORTED
_benchmark / comparison / trend / historical / configuration endpoints under /api/admin/benchmark-intelligence, composing the reused benchmark substrate + the abmk_* overlay. Read certifications are GET (to_regclass/fs probes); pure benchmark / comparison / trend / distribution / composite computes are pure POSTs; overlay writes + governance transitions are flag-gated POSTs. The trend / historical endpoints compute over abmk_results and return an honest empty/abstain when the series is empty._

- **Services**: services/benchmark-intelligence-engine.ts, services/benchmark-intelligence-mechanisms.ts
- **Routes**: routes/benchmark-intelligence.ts
- **Frontend**: —
- **Tables**: —
- **Verified**: svc 2/2 · rt 1/1 · fe 0/0 · tbl 0/0

## Contract
- Cert GETs are **read-only** (to_regclass / fs probes) — no DDL at read time.
- Mechanism POSTs (`compute/*`) are **PURE** (no DB, no eval) unless `persist=true`; the overlay save routes + governance transition are the **ONLY** DDL sites, gated by `benchmarkIntelligence` + super-admin.
- The composite benchmark index is a STRUCTURED AST evaluated by a whitelisted interpreter — no `eval` / `new Function`.
- Benchmarking ABSTAINS below k_min=30 real members — never fabricated.
- Flag OFF → `/enabled` 503, `/api/admin/benchmark-intelligence/*` 401, public-config `benchmark_intelligence:false`; benchmark flow + schema byte-identical.
