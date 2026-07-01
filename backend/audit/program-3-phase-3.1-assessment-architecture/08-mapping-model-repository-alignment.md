# CAPADEX 3.0 · Program 3 · Phase 3.1 — Mapping Model & Repository Alignment (Axis 5)

> Deliverable 08 · Generated 2026-07-01T06:40:17.982Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:5aa01cf06010, written 2026-07-01T06:40:17.982Z).
> Honesty: the FIVE certification axes (architecture · lifecycle · governance · metadata · repository-alignment) are reported SEPARATELY and NEVER composited. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

## Question → Outcome mapping model (15 steps)
Each canonical spine step → its owning registry + the EXISTING engine/table it REUSES (reuse-before-build).

| Step | Owning registry | Reused engine / table |
|---|---|---|
| **Question** | config/assessment-framework.ts | question-factory.ts · psychometric_question_bank |
| **Assessment** | config/assessment-framework.ts | routes/capadex.ts · caf_assessments · capadex_sessions |
| **Delivery** | config/customer-journey.ts | FreeAssessmentModal.tsx · caf-runtime.ts |
| **Scoring** | config/assessment-framework.ts | dimension-scoring-engine.ts · caf/scoring-engine.ts |
| **Norms** | (norm engine) | lbi-norms-engine.ts · lbi_subdomain_norms |
| **Standardization** | (standardization) | lbi-norms-engine.ts · reliability-engine.ts |
| **Benchmarking** | config/assessment-framework.ts | benchmark-engine.ts (k=30) · ti_* |
| **AI Interpretation** | config/ai-orchestration-model.ts | ai-reasoning-engine.ts · ai_reasoning_chains |
| **Recommendations** | config/ai-orchestration-model.ts | recommendation-intelligence-engine.ts · development_recommendations |
| **Learning** | config/progression-model.ts | learning-path-engine.ts · learning_recommendations |
| **Progression** | config/progression-model.ts | wc3_stage_state · wc3_longitudinal_snapshots |
| **Reports** | config/ai-orchestration-model.ts | report-factory-schema.ts · capadex_reports |
| **Analytics** | config/outcome-kpi-model.ts | enterprise-analytics-schema.ts · anl_* |
| **Outcomes** | config/outcome-kpi-model.ts | validation_loop_outcomes |
| **KPIs** | config/outcome-kpi-model.ts | anl_kpi_daily |

## Repository alignment (Axis 5 — Coverage-only, verified vs live FS+DB)
Every architecture evidence claim verified INDEPENDENTLY against the live filesystem + DB. null (unknown) ≠ 0 (absent).

| Evidence kind | Present / Total |
|---|---|
| Services | 31/32 |
| Routes | 9/9 |
| Frontend | 3/6 |
| Tables | 33/33 (absent 0, unknown 0) |

_Every architecture evidence claim is verified INDEPENDENTLY against the live filesystem (services/routes/frontend) and DB (to_regclass). null (unknown) ≠ 0 (absent). This axis is Coverage-only — it certifies the architecture MAPS to real repository artifacts, kept SEPARATE from Confidence/Adoption._
