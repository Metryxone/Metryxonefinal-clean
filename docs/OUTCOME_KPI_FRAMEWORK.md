# CAPADEX 3.0 · Phase 1.6 — Outcome Framework / KPI Engine

> Canonical doc. The MEASURED numbers live in `backend/audit/capadex-3.0-outcome-kpi/scan.json`
> (SSoT) and the 14 deliverables generated from it. This file is the stable navigation pointer.

## What it answers
**"assessment → intervention → MEASURABLE OUTCOME → KPI."** Is CAPADEX able to track a subject from
a scored assessment, through AI diagnosis / recommendation / intervention / learning, to a realized,
MEASURABLE outcome — and roll that outcome up into KPIs?

## Design (mirrors Phase 1.3 / 1.4 / 1.5 EXACTLY)
- **Enhancement-only · reuse-before-build · NO new outcome or KPI engine · NO V2.**
- **Flag** `outcomeFrameworkKpiEngine` / `FF_OUTCOME_FRAMEWORK_KPI_ENGINE` (default **OFF**),
  getter `isOutcomeFrameworkKpiEngineEnabled()`, public-config key `outcome_framework_kpi_engine`.
- **Byte-identical-OFF incl. schema — ZERO DDL.** No migration; the engine only READS
  (`to_regclass` probes + filesystem checks). OFF → data routes 503, public-config false, no tables.

## Files
- `backend/config/outcome-kpi-model.ts` — the ONE canonical Outcome & KPI Model (pure data):
  - **FROZEN 12-step outcome spine** `assessment → evidence_collection → ai_interpretation →
    recommendation → intervention → learning → practice → reassessment → improvement →
    measured_outcome → kpi_update → continuous_optimization` (re-enters the loop). Each step `reuses`
    a verified EXISTING engine + table.
  - **11 outcome-tracking types** (engagement / progress / improvement / continuity / lifecycle /
    realized), each referencing an EXISTING table.
  - **10 KPI families** — Individual / Persona / Lifecycle / Assessment / Journey / AI / Learning /
    Business / Organizational / Platform. KPIs are COMPUTED by the EXISTING enterprise-analytics +
    benchmark + mei/employability engines — NO new KPI engine.
  - **4 per-lifecycle-stage outcome rules** (CAP_CUR / CAP_INS / CAP_GRW / CAP_MAS).
  - **9 per-persona outcome paths**, **8 axes** (persona/lifecycle/assessment/AI/recommendation/
    intervention/outcome/KPI), `OUTCOME_KPI_DECISIONS`, `OUTCOME_KPI_GAPS`, `RESOLVED_OUTCOME_KPI_GAPS`.
- `backend/services/outcome-kpi-engine.ts` — read-only composer/verifier:
  `composeCoverage` (verify evidence vs live FS+DB), `composeOutcomeTypeCoverage`,
  `composeKpiCoverage`, `composeEffectiveness` (recommendation + intervention substrate; rate
  ABSTAINED null), `composeOutcomeAdoption`, `composePersonaOutcomeLinkage` (read-time join,
  k_min=30), `composeSummary`. GET-only, never-throws, `readScalar` returns null on ERROR / 0 on
  no-rows (null≠0).
- `backend/routes/outcome-kpi.ts` — `GET /api/outcome-kpi/enabled` (flag probe) + super-admin
  `/model`, `/coverage`, `/outcomes`, `/kpis`, `/matrices`, `/effectiveness`, `/personas`, `/gaps`,
  `/summary`, `/outcomes/persona`. Flag-gate 503 → `requireAuth` → `requireSuperAdmin`, never-throws.
- `backend/scripts/capadex-1.6-outcome-kpi-scan.ts` — SSoT scan →
  `backend/audit/capadex-3.0-outcome-kpi/scan.json`.
- `backend/scripts/capadex-1.6-generate-deliverables.ts` — reads ONLY scan.json → 14 deliverables +
  completion-certification (docs can never drift from the scan).

## Wiring (additive edits)
- `backend/config/feature-flags.ts` — flag + getter (default OFF).
- `backend/routes.ts` — import + `registerOutcomeKpiRoutes(...)`.
- `backend/routes/capadex.ts` — public-config key `outcome_framework_kpi_engine` (the getter is a
  SEPARATE import site — it must IMPORT `isOutcomeFrameworkKpiEngineEnabled` or `/public-config` 500s).

## Honesty contract
- **Coverage ⟂ Confidence ⟂ Outcome ⟂ Adoption — never composited.** null ≠ 0; never fabricate.
- **Effectiveness is ABSTAINED** (recommendation→outcome / intervention→outcome): substrate is
  MEASURED, but the calibrated rate is null BY DESIGN because no decision-time prediction
  (`predicted_prob_at_decision`) is recorded — a rate would be fabricated (CONFIDENCE axis).
- **KPIs reuse the existing analytics substrate** (`anl_kpi_daily` / `anl_cohort_analysis` /
  `anl_benchmark_snapshot`); population is ADOPTION-driven.
- **Revenue stays separate** (commerce ledger `capadex_payments`) — never composited into outcome KPIs.
- **Verdict is STRUCTURAL-only:** `STRUCTURAL_COMPLETE_ADOPTION_PENDING`. The chain is
  engineering-complete via REUSE; remaining axes are CONFIDENCE (abstained) + ADOPTION
  (real outcome/KPI volume, honest-low/0), reported SEPARATELY, NEVER as gaps.

## Regenerate
From `backend/`: run the scan, THEN the generator:
```
npx tsx scripts/capadex-1.6-outcome-kpi-scan.ts
npx tsx scripts/capadex-1.6-generate-deliverables.ts
```
