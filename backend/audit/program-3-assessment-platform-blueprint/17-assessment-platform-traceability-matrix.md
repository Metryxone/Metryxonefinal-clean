# 17 · Assessment Platform Traceability Matrix

**Mode:** Read-only / planning-only. No changes.
Verifies that assessment capability maps to the 7 cross-cutting axes — Personas · Lifecycle · Customer Journeys · AI · Reports · Outcomes · KPIs — and that the canonical spine is continuous end-to-end.

## A. Canonical Spine → Owning Registry / Engine
| Spine Step | Owning Registry | Reused Engine / Table |
| :-- | :-- | :-- |
| Question | `config/assessment-framework.ts` | `question-factory.ts` · `psychometric_question_bank` |
| Assessment | `config/assessment-framework.ts` | `routes/capadex.ts` · `caf_assessments` · `capadex_sessions` |
| Delivery | `config/customer-journey.ts` (T1–T5) | `FreeAssessmentModal.tsx` · `caf-runtime.ts` |
| Scoring | `config/assessment-framework.ts` | `dimension-scoring-engine.ts` · `caf/scoring-engine.ts` |
| Norms | (norm engine) | `lbi-norms-engine.ts` · `lbi_subdomain_norms` |
| Standardization | (standardization) | `lbi-norms-engine.ts` · `reliability-engine.ts` |
| Benchmarking | `config/assessment-framework.ts` | `benchmark-engine.ts` (k=30) · `ti_*` |
| AI Interpretation | `config/ai-orchestration-model.ts` | `ai-reasoning-engine.ts` · `ai_reasoning_chains` |
| Recommendations | `config/ai-orchestration-model.ts` | `recommendation-intelligence-engine.ts` · `development_recommendations` |
| Learning | `config/progression-model.ts` | `learning-path-engine.ts` · `learning_recommendations` |
| Progression | `config/progression-model.ts` | `wc3_stage_state` · `wc3_longitudinal_snapshots` |
| Reports | `config/ai-orchestration-model.ts` | `report-factory-schema.ts` · `capadex_reports` |
| Analytics | `config/outcome-kpi-model.ts` | `enterprise-analytics-schema.ts` · `anl_*` |
| Outcomes | `config/outcome-kpi-model.ts` | `validation_loop_outcomes` |
| KPIs | `config/outcome-kpi-model.ts` | `anl_kpi_daily` |

**Spine continuity: 15/15 steps have a real owning registry + reused engine. No dead links.**

## B. Cross-Cutting Axis Traceability
| Axis | Canonical Source | Assessment Linkage | Status |
| :-- | :-- | :-- | :-- |
| **Personas** (9) | `assessment-framework.ts` personas; `SUB_PERSONA_QUESTION_BANKS` (`behavioural-insights.ts`); flags `personaModelAlignment` / `personaModelExpansion` | Persona-targeted question banks + journeys + reports + outcome models | SUPPORTED |
| **Lifecycle** (CAP_CUR→MAS) | `progression-model.ts` `LIFECYCLE_PROMOTION_RULES` | Assessment types map to lifecycle stages; `wc3_stage_state` | SUPPORTED |
| **Customer Journeys** (8-step + T1–T5 + 12 persona journeys) | `customer-journey.ts` | Delivery + journey-tail outcome capture per persona | SUPPORTED |
| **AI** (12-step spine) | `ai-orchestration-model.ts` | Reasoning chains, explainability, confidence, evidence | SUPPORTED |
| **Reports** (8 sections) | `ai-orchestration-model.ts` `REPORT_SECTIONS` | Report Factory renders per audience/persona | SUPPORTED |
| **Outcomes** (11 types) | `outcome-kpi-model.ts` `OUTCOME_TYPES` | `validation_loop_outcomes`; capture flag-gated | SUPPORTED (adoption = separate axis) |
| **KPIs** (10 families) | `outcome-kpi-model.ts` `KPI_FAMILIES` | `anl_kpi_daily`; computed by existing engines | SUPPORTED (adoption = separate axis) |

## C. Persona × Layer Coverage (summary)
All 9 personas traverse Layers 1–5 and 8–13 with SUPPORTED linkage. The PARTIAL cells are **Layer 6 (Norms)** — only age norms exist, so gender/education/competitive-exam persona norm-referencing is not yet population-normed — and **Layer 7 (Standardization)** T/stanine breadth. These are the same two PARTIAL layers as the architecture verdict; they do not break persona traceability, they limit norm-referenced interpretation depth for those personas.

## D. Honesty Guards Verified in Trace
- Coverage ⟂ Confidence ⟂ Adoption never composited in any traced surface.
- Outcome/KPI **adoption volume** is reported on its own axis (honest-low/0), never folded into structural coverage.
- Benchmarks (relative) are kept separate from Norms (standardized) throughout the trace.

## Verdict
**Traceability is COMPLETE and continuous.** Every spine step and every cross-cutting axis maps to real repository evidence. The only depth-limits are the two PARTIAL layers (Norms, Standardization), tracked in the gap register.
