---
name: AI Recommendation Report Orchestration (CAPADEX 3.0 Phase 1.7)
description: Flag-gated read-only composer auditing every existing AI/recommendation/report/explainability capability into one model; the scaffold-mirror traps that differ from 1.6.
---

# AI Recommendation Report Orchestration (CAPADEX 3.0 Phase 1.7)

Flag `aiRecommendationReportOrchestration` / `FF_AI_RECOMMENDATION_REPORT_ORCHESTRATION`, default OFF,
byte-identical incl. schema, ZERO DDL. Mirrors the 1.6 (outcome-kpi) scaffold: pure-data registry
`config/ai-orchestration-model.ts` ⟂ read-only composer `services/ai-orchestration-engine.ts` ⟂
routes `routes/ai-orchestration.ts` ⟂ scan + generator `scripts/capadex-1.7-*`. Verdict
`STRUCTURAL_COMPLETE_ADOPTION_PENDING`.

## Traps that differ from the 1.6 mirror (these bit during the build)
- **Spine row shape changed.** 1.7 spine rows are `{step, label, description, reuses:{services,tables}}`
  — NOT 1.6's `{key, label, definition, reuses:string|string[]}`. The deliverables generator was
  copied from 1.6 and its sanity-check (`for f of ['key','label','definition']`) + spine renderer
  (`s.key`/`s.definition`/`Array.isArray(s.reuses)?join:s.reuses`) threw / would have rendered
  `[object Object]`. **Why:** a copied generator carries the PRIOR phase's field names; a renamed
  registry field silently corrupts the inventory unless the sanity-check is updated in lockstep.
  **How to apply:** when mirroring a generator, diff the registry row shape FIRST and update the
  field list + every `s.<field>` access + a `reuseStr()` helper for the object-shaped `reuses`.
- **Route path differs.** 1.7 persona endpoint is `/personas/linkage` (composer
  `composePersonaAiLinkage`), NOT 1.6's `/outcomes/persona`. Public-config key is
  `ai_recommendation_report_orchestration`.
- **13 deliverables + completion-certification** (1.6 had 14 — the effectiveness split was a 1.6
  specialization; do not pad to match).

## Honesty / contract (unchanged from the family)
- Coverage ⟂ Confidence ⟂ Outcome ⟂ Adoption — NEVER composited. null ≠ 0. Never fabricate.
- Engines read by **existence on disk + persisted-output table** via `to_regclass` + fs checks —
  NEVER invoked (no engine call, scheduler, or AI completion). `readScalar` returns null on ERROR /
  0 on no-rows so unreadable ≠ empty.
- Effectiveness is WIRED via REUSE of the validation-loop calibration mechanism
  (`recordValidationOutcome` → `predicted_prob_at_decision`; `calibrationFromRows`/`toCalibrationPairs`)
  and ABSTAINED (`rate:null`) while `cold_start`/`provisional`, lighting up only at `calibrated` ≥
  k_min=30 real non-demo pairs. Per-channel rec/intervention rates stay null (predictions are
  loop-level).
- `development_recommendations` has NO user_id (keyed `session_id`) → persona-linkage subject count
  degrades honest-null, identical to 1.6.
- public-config getter is a SEPARATE import site in `routes/capadex.ts` — must IMPORT the getter or
  `/public-config` 500s (no tsc here, so this only surfaces at runtime).

## OFF smoke (verified)
`/api/ai-orchestration/enabled` → 503; `/api/admin/ai-orchestration/*` → 401 (global `/api/admin`
gate); `/api/capadex/public-config` `ai_recommendation_report_orchestration` → false.
