# 15 · Assessment Analytics Blueprint (Layer 12)

**Mode:** Read-only / planning-only. No changes. **Layer status: SUPPORTED.**

## Canonical Definition
Assessment Analytics rolls individual results up to cohort, organization, longitudinal, predictive, and executive intelligence. Primary implementation: the `anl_*` **star-schema warehouse** in `services/enterprise-analytics-schema.ts`, served by `routes/enterprise-analytics.ts`.

## Capability Evidence
| Capability | Status | Repository Evidence |
| :-- | :-- | :-- |
| Individual Analytics | SUPPORTED | `dynamic-report.ts` (per-session pattern insights). |
| Cohort Analytics | SUPPORTED | `enterprise-analytics-schema.ts` (`anl_cohort_analysis`, `anl_dim_cohort`); `/api/analytics/cohorts`. |
| Organization Analytics | SUPPORTED | `routes/enterprise-analytics.ts` (executive cockpit, KPI daily summaries). |
| Longitudinal Analytics | SUPPORTED | `anl_fact_scores` (scores over time); `wc3_longitudinal_snapshots`. |
| Predictive Analytics | SUPPORTED | `anl_predictive_features` (targets: `target_at_risk`, `target_high_performer`). |
| Executive Analytics | SUPPORTED | `/api/analytics/executive`. |

## Analytics Integrity
- **Star-schema separation:** dims (`anl_dim_*`) and facts (`anl_fact_*`) are kept distinct; KPI rollups live in `anl_kpi_daily`.
- **Predictive features are declared, not fabricated:** `anl_predictive_features` stores feature targets; predictions carry confidence/adoption honesty (cold-start until sufficient real data).
- **Population-count honesty:** exact `COUNT(*)` (not `n_live_tup`) is used for empty/dormant verdicts (bulk-seeded tables under-report via stale stats).

## Gaps
None at Layer 12. (KPI computation is by existing enterprise-analytics/benchmark/employability engines — no new KPI engine, consistent with the outcome-KPI framework.)

## Freeze Position
**FREEZE.** The `anl_*` star-schema is the canonical analytics warehouse. New analytics compose facts/dims/KPIs there, never a parallel warehouse.
