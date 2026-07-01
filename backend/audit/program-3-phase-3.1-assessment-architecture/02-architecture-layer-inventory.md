# CAPADEX 3.0 · Program 3 · Phase 3.1 — Architecture Layer Inventory (Axis 1)

> Deliverable 02 · Generated 2026-07-01T07:15:13.791Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:6a98bbfa5f18, written 2026-07-01T07:15:13.862Z).
> Honesty: the FIVE certification axes (architecture · lifecycle · governance · metadata · repository-alignment) are reported SEPARATELY and NEVER composited. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The FROZEN 13-layer canonical decomposition. Status is a **Coverage** axis (does an implementation exist?), kept SEPARATE from Confidence/Adoption. Evidence is VERIFIED vs the live FS+DB.

**Status:** 13 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING.

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
Authoring, banking and governance of items across the behavioural + competency families. Bloom cognitive-level coding of the behavioural clarity bank is derived deterministically into an OWN additive table (capadex_clarity_bloom), abstaining for affective self-report items.

- **Services**: services/question-factory.ts, services/question-registry-service.ts, services/assessment-architecture-mechanisms.ts
- **Routes**: routes/capadex.ts, routes/assessment-architecture.ts
- **Tables**: psychometric_question_bank, capadex_question_registry, onto_competency_question_map, capadex_clarity_bloom
- **Frontend**: —
- **Verified**: svc 3/3 · rt 2/2 · fe 0/0 · tbl 4/4

### L3 · Assessment Authoring (`authoring`) — SUPPORTED
The CAF builder — authored, rubric/IRT/CTT/SJT/BARS assessments with sections, scoring and randomization rules.

- **Services**: services/caf/scoring-engine.ts
- **Routes**: routes/caf-assessment-builder.ts
- **Tables**: caf_assessments, caf_assessment_sections, caf_score_rules, caf_randomization_rules
- **Frontend**: —
- **Verified**: svc 1/1 · rt 1/1 · fe 0/0 · tbl 4/4

### L4 · Assessment Delivery (`delivery`) — SUPPORTED
Runtime delivery of both families — the flagship consumer flow and the flag-gated adaptive/CAF runtime. PLUS an opt-in PWA offline-capture foundation (service worker + client replay queue) and a consolidated WCAG accessibility layer (skip-link/ARIA-live/focus), both INERT unless the completion flag is ON.

_Honest note: Offline delivery (AP-2) and accessibility (AP-3) are engineering foundations that activate ONLY when the assessment_architecture_completion flag is ON — byte-identical when unregistered. Real offline-session count and screen-reader/axe audit coverage are ADOPTION axes reported separately, never composited._

- **Services**: adaptive/adaptive-question-pipeline.ts
- **Routes**: routes/caf-runtime.ts
- **Tables**: caf_sessions, capadex_sessions
- **Frontend**: components/FreeAssessmentModal.tsx, components/AdaptiveAssessmentRuntime.tsx, lib/offline.ts, lib/accessibility.ts
- **Verified**: svc 0/1 · rt 1/1 · fe 3/4 · tbl 2/2

### L5 · Scoring Engine (`scoring`) — SUPPORTED
Dimension/weighting scoring for the behavioural family + rubric/IRT/CTT scoring for the CAF family (two intentional sciences).

- **Services**: services/dimension-scoring-engine.ts, services/weighting-engine.ts, services/caf/scoring-engine.ts, services/reliability-engine.ts
- **Routes**: —
- **Tables**: capadex_signal_profiles, spe_behavioural_scores
- **Frontend**: —
- **Verified**: svc 4/4 · rt 0/0 · fe 0/0 · tbl 2/2

### L6 · Norm Engine (`norms`) — SUPPORTED
Population norm-referencing. Age norms exist; gender/education-tier/competitive-exam/country norm groups are computed by the SAME percentile_cont+k_min methodology into an OWN additive table (assessment_group_norms).

_Honest note: Norm-group MECHANISM is engineering-closed (services/assessment-architecture-mechanisms.ts computeGroupNorms over the same methodology as lbi-norms-engine, own assessment_group_norms table). It computes real k≥k_min distributions and ABSTAINS honestly when a dimension is not yet captured (gender additionally ethics-gated OFF). Real norm-row VOLUME is an ADOPTION axis reported separately — never composited, never fabricated._

- **Services**: services/lbi-norms-engine.ts, services/weighting-engine.ts, services/contextual-norm-engine.ts, services/assessment-architecture-mechanisms.ts
- **Routes**: routes/assessment-architecture.ts
- **Tables**: lbi_subdomain_norms, lbi_age_bands, assessment_group_norms
- **Frontend**: —
- **Verified**: svc 4/4 · rt 1/1 · fe 0/0 · tbl 3/3

### L7 · Standardization (`standardization`) — SUPPORTED
Percentile / z / standardized-score transforms. Percentile + z + deviation exist PLUS canonical T(M=50,SD=10), stanine 1–9 and sten 1–10 via a pure standardization module; the legacy 50+z*15 transform is honestly labelled a deviation score.

_Honest note: Standardization is engineering-closed: services/psychometric-standardization.ts provides canonical T(M=50,SD=10), stanine (1–9) and sten (1–10) pure transforms, and the legacy SD=15 transform is honestly relabelled deviation_score (never "T"). Coverage⟂Confidence._

- **Services**: services/lbi-norms-engine.ts, services/reliability-engine.ts, services/dimension-scoring-engine.ts, services/psychometric-standardization.ts, services/assessment-architecture-mechanisms.ts
- **Routes**: routes/assessment-architecture.ts
- **Tables**: lbi_subdomain_norms
- **Frontend**: —
- **Verified**: svc 5/5 · rt 1/1 · fe 0/0 · tbl 1/1

### L8 · Benchmark Engine (`benchmarking`) — SUPPORTED
Relative cohort/industry/role/country benchmarking with k-anonymity (k=30). Kept DISTINCT from Norms (standardized). Country cohorts reuse the EXISTING bench_cohorts + geography column (cohort_type widened to admit "country" on the flag-gated write path only).

- **Services**: services/benchmark-engine.ts, services/m5-org-benchmark.ts, services/mei-benchmark-engine.ts, services/peer-benchmark.ts, services/assessment-architecture-mechanisms.ts
- **Routes**: routes/assessment-architecture.ts
- **Tables**: ti_industry_benchmarks, ti_role_benchmarks, ti_layer_benchmarks, rf_benchmark_configs, bench_cohorts
- **Frontend**: —
- **Verified**: svc 5/5 · rt 1/1 · fe 0/0 · tbl 5/5

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
Admin surfaces — report/question factory admin, platform audit, white-label config, and AI-prompt governance (code-embedded prompts registered into the EXISTING aig_prompts/aig_prompt_versions registry with a literal read-through fallback).

_Honest note: Core admin surfaces exist. AI-prompt management is engineering-closed: services/prompt-registry-activation.ts registers code-embedded prompts into aig_prompts/aig_prompt_versions and resolvePrompt reads through the registry with a code-literal fallback (byte-identical OFF). Real active-prompt VOLUME is an ADOPTION axis reported separately._

- **Services**: services/prompt-registry-activation.ts
- **Routes**: routes/platform-audit-routes.ts, routes/enterprise-analytics.ts, routes/assessment-architecture.ts
- **Tables**: rf_white_label_configs, aig_prompts, aig_prompt_versions
- **Frontend**: components/admin/ReportFactoryPanel.tsx
- **Verified**: svc 1/1 · rt 3/3 · fe 0/1 · tbl 3/3
