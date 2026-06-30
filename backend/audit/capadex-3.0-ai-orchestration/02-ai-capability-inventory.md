# CAPADEX 3.0 · Phase 1.7 — AI Capability Inventory

> Deliverable 02 · Generated 2026-06-30T15:05:09.697Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:88fda7ccb736, written 2026-06-30T15:05:09.695Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

The 12 EXISTING AI/recommendation/report/analytics/explainability/orchestration capabilities this layer composes (verified vs live FS+DB). `status` is a Coverage axis (does the capability exist); ADOPTION (real non-demo volume) is SEPARATE (deliverable 10). Engines are read by existence/persisted-output, NEVER invoked.

## Canonical AI orchestration spine (FROZEN, 12 steps)
1. **Assessment intake** (`assessment`) — A persona completes a CAPADEX / competency / behaviour assessment — the AI orchestration entry point.  _(reuses: services/outcome-intelligence-engine.ts, capadex_sessions)_
2. **Evidence collection** (`evidence_collection`) — Per-question signals + scores are persisted as the evidence substrate AI analysis reasons over.  _(reuses: services/validation-loop-engine.ts, capadex_session_signals)_
3. **AI analysis / reasoning** (`ai_analysis`) — The AI layer interprets the evidence (reasoning chains, narrative synthesis) over the collected signals.  _(reuses: services/aiClient.ts, services/ai-reasoning-engine.ts, ai_reasoning_chains)_
4. **Confidence scoring** (`confidence_scoring`) — Decision-time predictions are scored + calibrated (Brier/ECE) via the validation-loop mechanism — the Confidence axis.  _(reuses: services/validation-loop-engine.ts, services/wc7b/decision-orchestrator.ts, wc7b_decision_state)_
5. **Explainability** (`explainability`) — Each AI recommendation / decision is rendered into an explainable, human-readable rationale.  _(reuses: services/capadex-explainability-engine.ts, services/runtime-explainability-engine.ts)_
6. **Recommendation generation** (`recommendation_generation`) — Development / career / competency recommendations are generated and persisted per subject.  _(reuses: services/recommendation-intelligence-engine.ts, services/career-recommendation-engine.ts, services/mei-recommendation-engine.ts, development_recommendations, career_recommendations)_
7. **Intervention selection** (`intervention_selection`) — Recommendations are converted into actionable interventions matched to the subject.  _(reuses: services/intervention-intelligence.ts, capadex_interventions)_
8. **Learning plan** (`learning_plan`) — Interventions compose into a personalised learning plan / pathway.  _(reuses: services/learning-path-engine.ts, career_readiness_history)_
9. **Progress tracking** (`progress_tracking`) — Longitudinal snapshots track movement against baseline — the measured-progress input.  _(reuses: services/longitudinal-memory.ts, services/wc3/longitudinal-foundation.ts, wc3_longitudinal_snapshots)_
10. **Outcome validation** (`outcome_validation`) — Realized outcomes are captured into the canonical ledger and validated vs the decision-time prediction.  _(reuses: services/outcome-intelligence-engine.ts, services/capadex/progression-outcome-capture.ts, validation_loop_outcomes)_
11. **Report generation** (`report_generation`) — A human-readable AI report is composed from the analysis, recommendations, explainability + outcomes.  _(reuses: services/pil/report-builder.ts, services/omega-report-builder.ts, capadex_reports)_
12. **KPI update** (`kpi_update`) — Realized outcomes + report engagement roll up into the enterprise-analytics KPI substrate.  _(reuses: services/enterprise-analytics-schema.ts, services/benchmark-engine.ts, anl_kpi_daily)_

## AI capabilities (12)

| Item | Category/Audience | Status | Services | Tables | Absent (honest) |
|---|---|---|---|---|---|
| AI narrative analysis (LLM-backed) (`ai_narrative_analysis`) | analysis | SUPPORTED | 1/1 | 1/1 | — |
| AI reasoning chains (`ai_reasoning_chains`) | reasoning | SUPPORTED | 1/1 | 1/1 | — |
| Development recommendations (`development_recommendations`) | recommendation | SUPPORTED | 2/2 | 1/1 | — |
| Career recommendations (`career_recommendations`) | recommendation | SUPPORTED | 2/2 | 1/1 | — |
| Intervention selection (`intervention_selection`) | intervention | SUPPORTED | 1/1 | 1/1 | — |
| CAPADEX explainability (`capadex_explainability`) | explainability | SUPPORTED | 1/1 | 0/0 | — |
| Runtime explainability (`runtime_explainability`) | explainability | SUPPORTED | 2/2 | 0/0 | — |
| Confidence / calibration scoring (`confidence_calibration`) | analysis | PARTIAL | 2/2 | 2/2 | — |
| AI report generation (`report_generation`) | report | SUPPORTED | 2/2 | 1/1 | — |
| KPI / enterprise analytics roll-up (`kpi_analytics`) | analytics | PARTIAL | 2/2 | 1/1 | — |
| Decision orchestration (`decision_orchestration`) | orchestration | SUPPORTED | 1/1 | 1/1 | — |
| Runtime AI guidance (`runtime_guidance`) | orchestration | SUPPORTED | 1/1 | 0/0 | — |

## Definitions & honesty notes
- **AI narrative analysis (LLM-backed)** (`ai_narrative_analysis`, SUPPORTED) — LLM client wraps assessment evidence into narrative analysis; degrades honestly without OPENAI_API_KEY (null≠0).
- **AI reasoning chains** (`ai_reasoning_chains`, SUPPORTED) — Multi-step reasoning chains are generated + persisted; substrate present.
- **Development recommendations** (`development_recommendations`, SUPPORTED) — Competency-gap → development recommendation; persisted per subject.
- **Career recommendations** (`career_recommendations`, SUPPORTED) — Role / pathway recommendations generated + persisted.
- **Intervention selection** (`intervention_selection`, SUPPORTED) — Recommendations → actionable interventions; persisted per subject.
- **CAPADEX explainability** (`capadex_explainability`, SUPPORTED) — Recommendation / decision rationale rendered human-readable.
- **Runtime explainability** (`runtime_explainability`, SUPPORTED) — Runtime guidance + per-decision explainability over the live evidence.
- **Confidence / calibration scoring** (`confidence_calibration`, PARTIAL) — Decision-time predictions are calibrated (Brier/ECE) via the validation-loop mechanism; calibrated CONFIDENCE abstains until ≥ k_min real pairs accrue (Confidence axis, null≠0).
- **AI report generation** (`report_generation`, SUPPORTED) — PIL + omega report builders compose human-readable AI reports; persisted in capadex_reports.
- **KPI / enterprise analytics roll-up** (`kpi_analytics`, PARTIAL) — Enterprise-analytics + benchmark engines compute KPI families; population is usage-driven (Adoption axis, null≠0).
- **Decision orchestration** (`decision_orchestration`, SUPPORTED) — wc7b decision-orchestrator sequences the AI decision flow over the existing engines (orchestrates, never re-derives).
- **Runtime AI guidance** (`runtime_guidance`, SUPPORTED) — Per-persona runtime guidance lens composes the AI outputs into actionable next-steps.
