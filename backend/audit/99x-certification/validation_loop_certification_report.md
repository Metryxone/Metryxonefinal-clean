# §10 — Validation Loop Certification Report

**Date:** 2026-06-23 · Read-only · Evidence: `backend/scripts/audit-99x-certification.ts` + code trace

## Verdict: 🟡 PARTIAL — the back-half (Outcome→Calibration→Prediction) is wired and **honest**; a unified front-half realized-outcome **intake is now wired** (Phase 7, flag `validationLoop`, default OFF) but there are still **0 realized outcomes**. This axis **cannot reach PASS by code** — only by accruing real production outcomes.

## Loop: Assessment → Hiring → Performance → Promotion → Retention → Outcome → Calibration → Prediction

| Hop | Wired? | Evidence |
|---|---|---|
| Assessment → Hiring | 🟡 intake | Phase 7 `validation_loop_outcomes` records realized `hiring` outcomes against an `assessment_ref` (+ decision-time prediction). Capture is operator/hook-driven; not yet auto-fired from the journey. |
| Hiring → Performance | 🟡 intake | `outcome_type='performance'` capture available via the same intake. |
| Performance → Promotion | 🟡 intake | `outcome_type='promotion'` capture available. |
| Promotion → Retention | 🟡 intake | `outcome_type='retention'` capture available. |
| Retention → Outcome | ✅ (wired) | unified realized-outcome capture `POST /api/validation-loop/outcomes` (flag-gated, idempotent, append-only). |
| Outcome → Calibration | ✅ (wired) | `wc3/outcome-intelligence.ts` → `wc3_outcome_state`; Phase 7 composes the EXISTING `buildCalibrationModel` (employer-tig) over recorded (predicted, outcome) pairs. |
| Calibration → Prediction | ✅ (wired) | `pil/prediction-engine.ts` (7-hop KG lineage) + Phase-7 status surface ABSTAINS until ≥30 realized outcomes. |

## Phase 7 — Validation Loop intake (additive, flag `validationLoop`, default OFF)
- **Table** `validation_loop_outcomes` (migration `20260623_validation_loop_outcomes.sql`) — unified realized-outcome capture keyed by `subject_email`, with `assessment_ref` + `predicted_prob_at_decision` so the EXISTING calibration engine can train on (predicted, outcome) pairs. `is_demo` rows are EXCLUDED from evidence-backed claims; `ref_id` gives idempotency.
- **Routes** `routes/validation-loop.ts` — `POST /outcomes` (intake, requireSuperAdmin), `GET /status` + `GET /calibration` (read-only admin surface; to_regclass probe, never DDL on GET). OFF → all 503, ensure-schema never reached → byte-identical incl. schema.
- **Engine** `services/validation-loop-engine.ts` — PURE; composes `buildCalibrationModel`; no new calibration/prediction/confidence engine.
- **Status surface** reports Coverage (outcomes recorded) and Confidence (calibration trust) SEPARATELY, and keeps `prediction.abstained=true` / `evidence_backed=false` until ≥30 realized non-demo outcomes accrue (k_min=30).
- **Evidence** `backend/audit/validation-loop/validation-loop-evidence.md` (mechanism runs end-to-end on ONE demo outcome, then abstains; demo cleaned up). **Smoke** `scripts/smoke-validation-loop.ts` (17/17).

## Realized-outcome tables (all empty — honest baseline)
`validation_loop_outcomes`=0 (realized) · `career_outcomes`=0 · `hiring_outcomes`=0 · `interview_outcomes`=0 · `tig_calibration`=0 · `ti_outcome_predictions`=0

## Honesty guard (✅ the most important finding)
The predictive layer **makes NO empirical accuracy claim**. From `pil/prediction-validation.ts`:
*"There are NO realized longitudinal outcomes yet, so empirical accuracy CANNOT be claimed … We deliberately
make NO accuracy claim — only internal validity + explainability."* It reports **~0% outcome coverage**
and validates only determinism / monotonicity / calibration-sanity. **This is exactly correct behaviour** —
the system refuses to fabricate accuracy.

## Why this cannot be a PASS today
A closed validation loop requires **realized** hiring/performance/promotion/retention events captured over
time. Calibration (Brier/ECE) requires **≥30 realized outcomes**. No additive code can manufacture these
without fabricating data — which the honesty contract forbids. **The honest verdict is PARTIAL until real
production outcomes accrue.** Marking it PASS would be the single most dishonest move available in this
certification, and we decline it.

**Path to PASS:** (1) wire the front-half capture hooks (Assessment→…→Retention) as additive append-only
tables; (2) operate in production; (3) accrue ≥30 realized outcomes; (4) calibration + accuracy then become
claimable. Steps 2–3 are time/usage-gated, not engineering-gated.
