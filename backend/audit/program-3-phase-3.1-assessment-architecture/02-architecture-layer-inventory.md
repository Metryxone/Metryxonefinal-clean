# CAPADEX 3.0 · Program 3 · Phase 3.1 — Architecture Layer Inventory (Axis 1)

> Deliverable 02 · Generated 2026-07-01T06:40:17.982Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:5aa01cf06010, written 2026-07-01T06:40:17.982Z).
> Honesty: the FIVE certification axes (architecture · lifecycle · governance · metadata · repository-alignment) are reported SEPARATELY and NEVER composited. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The FROZEN 13-layer canonical decomposition. Status is a **Coverage** axis (does an implementation exist?), kept SEPARATE from Confidence/Adoption. Evidence is VERIFIED vs the live FS+DB.

**Status:** 11 SUPPORTED · 2 PARTIAL · 0 DEAD_END · 0 MISSING.

## Assessment families (2) — overlapping-by-design, ONE platform
- **CAPADEX behavioural / signal family** (`behavioural_signal`) — The consumer flow producing behavioural signals scored by dimension/weighting engines and interpreted through the CAPADEX runtime (concern/clarity, adaptive-next).
- **CAF competency / academic family** (`caf_competency`) — Authored rubric/IRT/CTT/SJT/BARS assessments built in the CAF builder and scored by caf/scoring-engine.

## Layers
### L1 · Assessment Foundation (`foundation`) — SUPPORTED
What an assessment IS: type, category, template, metadata, version, lifecycle, governance, publishing. SSoT = the frozen assessment-framework registry.

- **Services**: config/assessment-framework.ts, services/governance/admin-lifecycle.ts, services/platform-lifecycle.ts
- **Routes**: routes/assessment-framework.ts, routes/assessment-writer.ts
- **Tables**: assessment_templates, assessment_template_questions, exams
- **Frontend**: components/FreeAssessmentModal.tsx
- **Verified**: svc 3/3 · rt 2/2 · fe 1/1 · tbl 3/3

### L2 · Question Platform (`question_platform`) — SUPPORTED
Authoring, banking and governance of items across the behavioural + competency families.

- **Services**: services/question-factory.ts, services/question-registry-service.ts
- **Routes**: routes/capadex.ts
- **Tables**: psychometric_question_bank, capadex_question_registry, onto_competency_question_map
- **Frontend**: —
- **Verified**: svc 2/2 · rt 1/1 · fe 0/0 · tbl 3/3

### L3 · Assessment Authoring (`authoring`) — SUPPORTED
The CAF builder — authored, rubric/IRT/CTT/SJT/BARS assessments with sections, scoring and randomization rules.

- **Services**: services/caf/scoring-engine.ts
- **Routes**: routes/caf-assessment-builder.ts
- **Tables**: caf_assessments, caf_assessment_sections, caf_score_rules, caf_randomization_rules
- **Frontend**: —
- **Verified**: svc 1/1 · rt 1/1 · fe 0/0 · tbl 4/4

### L4 · Assessment Delivery (`delivery`) — SUPPORTED
Runtime delivery of both families — the flagship consumer flow and the flag-gated adaptive/CAF runtime.

- **Services**: adaptive/adaptive-question-pipeline.ts
- **Routes**: routes/caf-runtime.ts
- **Tables**: caf_sessions, capadex_sessions
- **Frontend**: components/FreeAssessmentModal.tsx, components/AdaptiveAssessmentRuntime.tsx
- **Verified**: svc 0/1 · rt 1/1 · fe 1/2 · tbl 2/2

### L5 · Scoring Engine (`scoring`) — SUPPORTED
Dimension/weighting scoring for the behavioural family + rubric/IRT/CTT scoring for the CAF family (two intentional sciences).

- **Services**: services/dimension-scoring-engine.ts, services/weighting-engine.ts, services/caf/scoring-engine.ts, services/reliability-engine.ts
- **Routes**: —
- **Tables**: capadex_signal_profiles, spe_behavioural_scores
- **Frontend**: —
- **Verified**: svc 4/4 · rt 0/0 · fe 0/0 · tbl 2/2

### L6 · Norm Engine (`norms`) — PARTIAL
Population norm-referencing. Age norms exist; gender/education/competitive-exam norms are data-coverage gaps computed by the same engine when a real, k-sufficient distribution exists.

_Honest note: Only age norms are populated. Gender/education-tier/competitive-exam norm-referencing is a DATA-coverage gap (GAP-AA-4/5/6), not an architecture gap — the same engine computes them once a real k≥k_min distribution exists; never fabricated._

- **Services**: services/lbi-norms-engine.ts, services/weighting-engine.ts, services/contextual-norm-engine.ts
- **Routes**: —
- **Tables**: lbi_subdomain_norms, lbi_age_bands
- **Frontend**: —
- **Verified**: svc 3/3 · rt 0/0 · fe 0/0 · tbl 2/2

### L7 · Standardization (`standardization`) — PARTIAL
Percentile / z / standardized-score transforms. Percentile + z + deviation exist; canonical T(SD=10)/stanine/sten breadth is a Low additive gap.

_Honest note: Percentile/z/deviation transforms exist. Canonical T(M=50,SD=10)/stanine/sten breadth is a Low additive transform gap (GAP-AA-7); deviation SD=15 must not be mislabelled "T". Coverage⟂Confidence._

- **Services**: services/lbi-norms-engine.ts, services/reliability-engine.ts, services/dimension-scoring-engine.ts
- **Routes**: —
- **Tables**: lbi_subdomain_norms
- **Frontend**: —
- **Verified**: svc 3/3 · rt 0/0 · fe 0/0 · tbl 1/1

### L8 · Benchmark Engine (`benchmarking`) — SUPPORTED
Relative cohort/industry/role benchmarking with k-anonymity (k=30). Kept DISTINCT from Norms (standardized).

- **Services**: services/benchmark-engine.ts, services/m5-org-benchmark.ts, services/mei-benchmark-engine.ts, services/peer-benchmark.ts
- **Routes**: —
- **Tables**: ti_industry_benchmarks, ti_role_benchmarks, ti_layer_benchmarks, rf_benchmark_configs
- **Frontend**: —
- **Verified**: svc 4/4 · rt 0/0 · fe 0/0 · tbl 4/4

### L9 · AI Interpretation (`ai_interpretation`) — SUPPORTED
Reasoning, explainability, confidence and recommendation over scored assessments.

- **Services**: services/ai-orchestration-engine.ts, services/ai-reasoning-engine.ts, services/capadex-explainability-engine.ts, services/recommendation-intelligence-engine.ts
- **Routes**: routes/ai-orchestration.ts
- **Tables**: ai_reasoning_chains, development_recommendations, capadex_interventions
- **Frontend**: —
- **Verified**: svc 4/4 · rt 1/1 · fe 0/0 · tbl 3/3

### L10 · Report Intelligence (`report_intelligence`) — SUPPORTED
Report Factory — templated, multi-audience, multi-language report generation and PDF rendering.

- **Services**: services/report-factory-schema.ts, services/dynamic-report.ts, services/report-pack.ts, services/pdf-renderer.ts
- **Routes**: —
- **Tables**: rf_templates, rf_template_sections, rf_language_packs, capadex_reports
- **Frontend**: components/admin/ReportFactoryPanel.tsx
- **Verified**: svc 4/4 · rt 0/0 · fe 0/1 · tbl 4/4

### L11 · Visualization (`visualization`) — SUPPORTED
Chart/data resolution for reports and dashboards (radar/heatmap/benchmark/progress).

- **Services**: services/viz-data-resolver.ts, services/benchmark-engine.ts
- **Routes**: —
- **Tables**: —
- **Frontend**: lib/intelligence/progressLedger.ts
- **Verified**: svc 2/2 · rt 0/0 · fe 1/1 · tbl 0/0

### L12 · Assessment Analytics (`analytics`) — SUPPORTED
Enterprise analytics star-schema over assessment facts (scores, cohorts, predictive features, KPIs).

- **Services**: services/enterprise-analytics-schema.ts
- **Routes**: routes/enterprise-analytics.ts
- **Tables**: anl_fact_scores, anl_cohort_analysis, anl_predictive_features, anl_kpi_daily
- **Frontend**: —
- **Verified**: svc 1/1 · rt 1/1 · fe 0/0 · tbl 4/4

### L13 · Assessment Administration (`administration`) — SUPPORTED
Admin surfaces — report/question factory admin, platform audit, white-label config. AI-prompt management is a net-new additive gap.

_Honest note: Core admin surfaces exist. AI-prompt management (prompts code-embedded) is a Medium additive gap (GAP-AA-9), governable through existing aig_prompts/aig_prompt_versions — an enhancement over the frozen architecture, not an architecture gap._

- **Services**: —
- **Routes**: routes/platform-audit-routes.ts, routes/enterprise-analytics.ts
- **Tables**: rf_white_label_configs
- **Frontend**: components/admin/ReportFactoryPanel.tsx
- **Verified**: svc 0/0 · rt 2/2 · fe 0/1 · tbl 1/1
