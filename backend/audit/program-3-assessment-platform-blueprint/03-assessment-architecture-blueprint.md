# 03 · Assessment Architecture Blueprint

**Mode:** Read-only / planning-only. No changes. Evidence-cited.

## 13-Layer Canonical Architecture
| # | Layer | Primary Implementation Anchors | Status |
| :-- | :-- | :-- | :-- |
| 1 | Assessment Foundation | `config/assessment-framework.ts`, `assessment_templates`, `exams`, `governance/admin-lifecycle.ts` | SUPPORTED |
| 2 | Question Platform | `psychometric_question_bank`, `capadex_question_registry`, `services/question-factory.ts`, `question-registry-service.ts` | SUPPORTED |
| 3 | Assessment Authoring | `routes/caf-assessment-builder.ts`, `caf_assessments`+sections+rules, `services/caf/*` | SUPPORTED |
| 4 | Assessment Delivery | `FreeAssessmentModal.tsx`, `AdaptiveAssessmentRuntime.tsx`, `routes/caf-runtime.ts`, `adaptive/adaptive-question-pipeline.ts` | SUPPORTED |
| 5 | Scoring Engine | `dimension-scoring-engine.ts`, `weighting-engine.ts`, `caf/scoring-engine.ts`, `reliability-engine.ts` | SUPPORTED |
| 6 | Norm Engine | `lbi-norms-engine.ts` (`lbi_subdomain_norms`, `lbi_age_bands`), `weighting-engine.ts` policies | **PARTIAL** |
| 7 | Standardization | `lbi-norms-engine.ts` (percentile/z/std), `caf/scoring-engine.ts`, `dimension-scoring-engine.ts` bands | **PARTIAL** |
| 8 | Benchmark Engine | `benchmark-engine.ts` (k=30), `talent-benchmark-engine.ts`, `m5-org-benchmark.ts`, `ti_*` tables | SUPPORTED |
| 9 | AI Interpretation | `ai-orchestration-engine.ts`, `ai-reasoning-engine.ts`, `capadex-explainability-engine.ts`, `recommendation-intelligence-engine.ts` | SUPPORTED |
| 10 | Report Intelligence | `services/report-factory-schema.ts` (`rf_*`), `dynamic-report.ts`, `report-pack.ts`, `pdf-renderer.ts` | SUPPORTED |
| 11 | Visualization | `viz-data-resolver.ts`, `benchmark-engine.ts`, `lib/intelligence/progressLedger.ts` | SUPPORTED |
| 12 | Assessment Analytics | `enterprise-analytics-schema.ts` (`anl_*` star-schema), `routes/enterprise-analytics.ts` | SUPPORTED |
| 13 | Assessment Administration | `ReportFactoryPanel.tsx`, `question-factory` admin, `platform-audit-routes.ts`, `rf_white_label_configs` | SUPPORTED (AI-prompt mgmt MISSING) |

## Assessment Families (one platform, multiple families)
The architecture intentionally hosts **two complementary assessment families** under one platform:
1. **CAPADEX behavioural / signal family** — the consumer flow (`FreeAssessmentModal.tsx`) that produces behavioural signals scored by `dimension-scoring-engine.ts` / `weighting-engine.ts` and interpreted through the CAPADEX runtime (concern/clarity, adaptive-next).
2. **CAF competency / academic family** — the authored, rubric/IRT/CTT/SJT/BARS assessments built in the CAF builder (`caf_assessments`) and scored by `caf/scoring-engine.ts`.

These are **overlapping-but-intentional** (different measurement science for different question types), not accidental duplication. The freeze keeps both, unified under the one canonical registry and traceability model, with the reconciliation notes recorded in `18-capability-gap-register.md`.

## Data-Layer Anchors (representative, not exhaustive)
- **Foundation/questions:** `assessment_templates`, `assessment_template_questions`, `test_blueprints`, `psychometric_question_bank`, `psychometric_domains`, `capadex_question_registry`, `onto_competency_question_map`, `competency_library`.
- **Authoring/delivery:** `caf_assessments`, `caf_assessment_sections`, `caf_score_rules`, `caf_randomization_rules`, `caf_sessions`, `capadex_sessions`.
- **Scoring/norms:** `capadex_signal_profiles`, `spe_behavioural_scores`, `lbi_subdomain_norms`, `lbi_age_bands`, `onto_role_weights`.
- **Benchmark/analytics:** `ti_industry_benchmarks`, `ti_role_benchmarks`, `ti_layer_benchmarks`, `anl_fact_scores`, `anl_cohort_analysis`, `anl_predictive_features`, `anl_kpi_daily`, `rf_benchmark_configs`.
- **AI/reports/outcomes:** `ai_reasoning_chains`, `development_recommendations`, `capadex_interventions`, `capadex_reports`, `rf_templates`, `rf_template_sections`, `rf_language_packs`, `validation_loop_outcomes`.

## Control Plane
- **Feature flags:** `config/feature-flags.ts` — assessment-relevant flags include `assessmentFrameworkCompletion`, `customerJourneyCompletion`, `progressionEngineCompletion`, `outcomeFrameworkKpiEngine`, `aiRecommendationReportOrchestration`, `questionFactory`, `longitudinalOutcomeCapture`, `personaModelAlignment`, `personaModelExpansion`, `adaptiveDifficultyActivation`.
- **Governance/admin gate:** super-admin routes (`requireAuth` + `requireSuperAdmin`) front every management surface; the global `/api/admin` gate applies platform-wide.
- **Read/verify surfaces:** each canonical registry exposes a read-only composer + `/enabled` probe + super-admin coverage/gaps endpoints (assessment-framework, customer-journey, progression, outcome-kpi, ai-orchestration, operational-readiness).

## Architecture Invariants (freeze conditions)
1. The 13-layer decomposition is canonical and frozen.
2. The Question→Outcome spine is canonical and frozen.
3. Both assessment families remain under one registry + one traceability model.
4. Enhancements are additive, flag-gated, byte-identical-off.
5. Coverage ⟂ Confidence ⟂ Adoption; never composited.
