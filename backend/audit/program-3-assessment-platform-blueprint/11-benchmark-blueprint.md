# 11 · Benchmark Blueprint (Layer 8)

**Mode:** Read-only / planning-only. No changes. **Layer status: SUPPORTED (1 gap: country).**

## Canonical Definition
The Benchmark Engine positions an individual/cohort against reference groups: individual, peer, batch, class, department, organization, industry, country, historical, and goal. Two engines: `services/benchmark-engine.ts` (percentile cohort analysis, k-anonymity suppression k=30) and the Talent Benchmark suite (`talent-benchmark-engine.ts`, `m5-org-benchmark.ts`, `ti_*` tables).

## Capability Evidence
| Capability | Status | Repository Evidence |
| :-- | :-- | :-- |
| Individual | SUPPORTED | `benchmark-engine.ts` (`user_score`); `ti_user_benchmark_positions`; `/api/talent/benchmarks/position/:email`. |
| Peer | SUPPORTED | `benchmark-engine.ts` (`peer_mean`, `percentileRank`); `rf_benchmark_configs`; `m5-org-benchmark.ts`. |
| Batch | SUPPORTED | `anl_cohort_analysis`; `services/longitudinal-memory.ts`; `outcome-kpi-model.ts` organizational KPI. |
| Class | SUPPORTED | `benchmark-engine.ts` `CohortDefinition`; `student_segment`. |
| Department | SUPPORTED | `routes/m5-enterprise-workforce.ts` `/api/m5/wfi/departments`; `m5-workforce-intelligence.ts`. |
| Organization | SUPPORTED | `/api/m5/bench/org`; `m5-org-benchmark.ts`; `ti_layer_benchmarks`. |
| Industry | SUPPORTED | `talent-benchmark-engine.ts` `ti_industry_benchmarks`; `/api/admin/talent/benchmarks/industry`. |
| Country | **MISSING** | No country-level benchmark tables/resolvers. → GAP-AP-8 (Low). |
| Historical | SUPPORTED | `wc3_longitudinal_snapshots`; `longitudinal-memory.ts`; outcome-kpi `improvement` step. |
| Goal | SUPPORTED | `/api/m5/coach/growth-plan` (`target_scores`); `m5-ai-coaching.ts`. |

## Statistical Integrity
- **k-anonymity suppression (k=30):** benchmark cohorts below the k-threshold are suppressed — scores masked, roster still shown where appropriate. Coverage ⟂ Confidence preserved (a small cohort is honest-null, not a fabricated percentile).
- **Benchmark ≠ Norm:** benchmarks are relative peer comparisons; they are NOT standardized population norms (see Layer 6). This blueprint keeps the two concepts separate.

## Overlap Note
`benchmark-engine.ts` (cohort percentiles) and `talent-benchmark-engine.ts` (industry/role/layer) overlap in intent. The freeze keeps both (different granularities); a unified benchmark-provenance view is a **recommend-only** consolidation candidate.

## Gaps
- **GAP-AP-8 (Low):** Country-level benchmarks absent (industry/org/region present).

## Freeze Position
**FREEZE.** The benchmark cohort model + k=30 suppression + talent-benchmark suite are canonical. Country benchmarks are an additive extension of the existing `ti_*` pattern.
