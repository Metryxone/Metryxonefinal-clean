# CAPADEX 3.0 · Phase 1.7 — AI Recommendation Report Orchestration

> Canonical doc. The MEASURED numbers live in `backend/audit/capadex-3.0-ai-orchestration/scan.json`
> (SSoT) and the 13 deliverables + completion-certification generated from it. This file is the
> stable navigation pointer.

## What it answers
**"assessment → AI analysis → confidence → explainability → recommendation → intervention →
outcome-validation → report → KPI."** Does CAPADEX have ONE coherent AI Recommendation Report
Orchestration layer that audits every EXISTING AI / recommendation / report / analytics /
explainability / orchestration capability into a single, non-duplicative model?

## Design (mirrors Phase 1.3 / 1.4 / 1.5 / 1.6 EXACTLY)
- **Enhancement-only · reuse-before-build · NO new AI / recommendation / report engine · NO V2.**
- **Flag** `aiRecommendationReportOrchestration` / `FF_AI_RECOMMENDATION_REPORT_ORCHESTRATION`
  (default **OFF**), getter `isAiRecommendationReportOrchestrationEnabled()`, public-config key
  `ai_recommendation_report_orchestration`.
- **Byte-identical-OFF incl. schema — ZERO DDL.** No migration; the engine only READS
  (`to_regclass` probes + filesystem checks). OFF → data routes 503, public-config false, no tables.
- **Engines are read by existence / persisted-output, NEVER invoked.** The composer checks that a
  service file exists on disk and/or that its persisted output table exists — it never calls an
  engine, runs a scheduler, or triggers an AI completion.

## Files
- `backend/config/ai-orchestration-model.ts` — the ONE canonical AI Orchestration Model (pure data):
  - **FROZEN 12-step AI orchestration spine** `assessment → evidence_collection → ai_analysis →
    confidence → explainability → recommendation → intervention → learning_plan → progress →
    outcome_validation → report → kpi_update`. Each step `reuses` a verified EXISTING engine + table.
  - **12 AI capabilities** (analysis / reasoning / recommendation / intervention / explainability /
    report / analytics / orchestration), each referencing an EXISTING service + table.
  - **6 recommendation-completeness criteria**, **6 explainability criteria**, **8 report sections**,
    **8 dashboard surfaces** (by audience).
  - **9 per-persona AI paths**, **8 axes** (persona / lifecycle / assessment / ai_analysis /
    explainability / recommendation / report / kpi), `AI_ORCHESTRATION_DECISIONS`,
    `AI_ORCHESTRATION_GAPS`, `RESOLVED_AI_ORCHESTRATION_GAPS`.
- `backend/services/ai-orchestration-engine.ts` — read-only composer/verifier:
  `composeCoverage` (verify evidence vs live FS+DB), `composeCapabilityInventory`,
  `composeRecommendationCompleteness`, `composeExplainability`, `composeReportValidation`,
  `composeDashboardValidation`, `composeEffectiveness` (recommendation + intervention substrate +
  loop-level calibration; rate ABSTAINED null), `composeAdoption`, `composePersonaAiLinkage`
  (read-time join, k_min=30), `composeSummary`. GET-only, never-throws, `readScalar` returns null on
  ERROR / 0 on no-rows (null≠0).
- `backend/routes/ai-orchestration.ts` — `GET /api/ai-orchestration/enabled` (flag probe) +
  super-admin `/model`, `/coverage`, `/capabilities`, `/recommendations`, `/explainability`,
  `/reports`, `/dashboards`, `/matrices`, `/effectiveness`, `/adoption`, `/gaps`, `/summary`,
  `/personas/linkage`. Flag-gate 503 → `requireAuth` → `requireSuperAdmin`, never-throws.
- `backend/scripts/capadex-1.7-ai-orchestration-scan.ts` — SSoT scan →
  `backend/audit/capadex-3.0-ai-orchestration/scan.json`.
- `backend/scripts/capadex-1.7-generate-deliverables.ts` — reads ONLY scan.json → 13 deliverables +
  completion-certification (docs can never drift from the scan).

## Wiring (additive edits)
- `backend/config/feature-flags.ts` — flag + getter (default OFF).
- `backend/routes.ts` — import + `registerAiOrchestrationRoutes(...)`.
- `backend/routes/capadex.ts` — public-config key `ai_recommendation_report_orchestration` (the
  getter is a SEPARATE import site — it must IMPORT `isAiRecommendationReportOrchestrationEnabled`
  or `/public-config` 500s).

## Honesty contract
- **Coverage ⟂ Confidence ⟂ Outcome ⟂ Adoption — never composited.** null ≠ 0; never fabricate.
- **Effectiveness is WIRED via REUSE, then ABSTAINED until k_min.** `composeEffectiveness` READS the
  EXISTING validation-loop calibration mechanism (`recordValidationOutcome` captures
  `predicted_prob_at_decision`; `calibrationFromRows`/`toCalibrationPairs` calibrate non-demo
  prediction+outcome rows with a `k_min` gate) and surfaces a loop-level `calibration` block. The
  link is end-to-end (no new engine/table/DDL): status is `cold_start`/`provisional` → rate `null`
  until ≥ `k_min` real pairs accrue, then it flips to `calibrated` and the rate lights up
  automatically. Per-channel rec/intervention rates stay null (predictions are recorded loop-level).
- **Adoption is a SEPARATE axis, never a gap.** AI/report/outcome/KPI volume is usage-driven; current
  values are honest (reasoning chains / recommendations / interventions / reports currently 0,
  `anl_kpi_daily` seeded) — null≠0, nothing fabricated.

## Measured verdict (scan.json)
**STRUCTURAL_COMPLETE_ADOPTION_PENDING.** 9 paths: 5 SUPPORTED · 4 PARTIAL · 0 DEAD_END · 0 MISSING.
Capabilities 10 SUPPORTED · 2 PARTIAL of 12. Evidence verified present: services 22/22, routes 11/11,
frontend 12/12, tables 21/21. Spine reachability 63/108. OPEN engineering gaps = 0 Launch-Critical
(GAP-AI-1 Medium explainability-depth, GAP-AI-2 Low report-engagement) + 6 reused-mechanism resolved.
The chain is mechanism-complete via REUSE; the dominant remaining axes are CONFIDENCE (calibrated
effectiveness, abstained) and ADOPTION (real volume) — reported separately, never composited.
