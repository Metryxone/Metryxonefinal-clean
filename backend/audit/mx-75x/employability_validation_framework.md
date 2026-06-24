# MX-75X · Section 8 — Employability-Index / Readiness Validation Framework

**Task:** MX-75X-VALIDATION-LOOP-AND-OUTCOME-INTELLIGENCE-ACTIVATION
**Scope of this document:** Section 8 only. Read-only, evidence-based. **No code changed.**
**Date:** 2026-06-24
**Method:** Static code/route/schema inspection of the existing prediction + outcome + calibration assets.
**Honesty-first:** Coverage (asset exists / wired) and Confidence/Calibration-trust are reported as
**SEPARATE axes**. Nothing fabricated. `null` = missing, never a fabricated `0`.

---

## 0. Headline finding

**The employability / readiness validation loop is STRUCTURALLY present and now wired to an intake,
but it is EVIDENCE-PENDING.** The platform holds **0 realized non-demo outcomes** today, so empirical
accuracy for the employability index is **ABSTAINED** and stays abstained until **≥ `VALIDATION_K_MIN`
(30)** realized non-demo binary outcomes carrying a decision-time prediction accrue
(`backend/services/validation-loop-engine.ts:28`). This is an **outcome-accrual milestone**, not a code
milestone — no additive code can make it PASS.

The chain `Assessment → Prediction → Outcome → Calibration → Improved Prediction` exists:

- **Prediction** — `future_employability` is produced deterministically from composite + LBI + EI
  (`backend/routes/talent-outcome-prediction.ts:130-132`), persisted to `ti_outcome_predictions`
  (`:25-44`). It is a sigmoid composite, NOT an empirically-validated probability.
- **Outcome intake** — realized career outcomes already have a home: `career_outcomes`
  (`backend/migrations/20260618_career_outcomes.sql:12-32`) captures `outcome_type`
  (`goal_achieved | ei_lift | role_change | promotion | hire`), `outcome_kind`, `outcome_value`,
  plus the **prior score that preceded the outcome** (`prior_score_type / prior_score_value`,
  `:22-24`) — exactly the `{predicted, outcome}` pairing calibration needs.
- **Calibration** — reuses `buildCalibrationModel` (`backend/routes/employer-tig.ts:211-274`):
  Isotonic/PAV regression, Beta-Binomial (α-smoothed) band rates, Brier + ECE, status
  `cold_start → provisional → calibrated`. No new engine is built.

---

## 1. Evidence base

| Evidence | Source |
|---|---|
| Employability prediction (`future_employability` sigmoid) | `backend/routes/talent-outcome-prediction.ts:130-132` |
| Prediction persistence + confidence | `ti_outcome_predictions` (`talent-outcome-prediction.ts:25-44`); confidence = present-sources/4 (`:104`) |
| Realized career-outcome substrate | `career_outcomes` (`backend/migrations/20260618_career_outcomes.sql:12-42`) |
| Decision-time prior score columns | `prior_score_type / prior_score_value / prior_score_at` (`:22-24`) |
| Unified loop intake | `validation_loop_outcomes` (`backend/migrations/20260623_validation_loop_outcomes.sql:14-44`) |
| Pair builder + k_min | `toCalibrationPairs`, `VALIDATION_K_MIN=30` (`backend/services/validation-loop-engine.ts:66-83,28`) |
| Calibration engine (reused) | `buildCalibrationModel` (`backend/routes/employer-tig.ts:211-274`); `calibrateProbability` (`:278-284`) |
| Coverage surface | GET `/api/validation-loop/status` reports `coverage.career_outcomes` (`backend/routes/validation-loop.ts:200,227`) |
| Flag (now default ON, reversible) | `validationLoop: true` (`backend/config/feature-flags.ts:139`), reverse via `FF_VALIDATION_LOOP=0` |
| Honesty / abstention | `evidenceVerdict` (`validation-loop-engine.ts:159-171`); language policy (`:33-48`) |

---

## 2. How employability / readiness validation WOULD work

Legend — **Coverage** = data exists & wired. **Confidence** = calibration-trust axis (separate).

1. **Capture the prediction at decision time.** When the employability index / readiness score is
   surfaced, snapshot it as the `predicted_prob_at_decision` (validation loop) or
   `prior_score_value` (`career_outcomes`). The prediction itself is the composite sigmoid
   (`talent-outcome-prediction.ts:130-132`) — directional, not yet validated.
2. **Record the realized outcome.** When a real career outcome occurs (`hire`, `promotion`,
   `role_change`, `goal_achieved`), capture it in `career_outcomes` with `is_demo = false`
   (`20260618_career_outcomes.sql:17,28`). Binary outcomes use `outcome_value ∈ {0,1}`.
3. **Form `{predicted, outcome}` pairs.** `toCalibrationPairs` keeps only binary rows carrying a
   finite in-range `[0,1]` prediction; everything else is **dropped, never coerced**
   (`validation-loop-engine.ts:66-83`). Demo rows are pre-filtered out.
4. **Calibrate.** `buildCalibrationModel` bins the pairs, computes per-band observed vs predicted
   rates with α-smoothing, Brier + ECE, and fits an isotonic curve **only at `calibrated` status**
   (`employer-tig.ts:226-273`).
5. **Report honestly.** Status flows `cold_start → provisional → calibrated`; `calibrated` is NEVER
   claimed below k_min=30 own outcomes (`employer-tig.ts:145,226-229`).

---

## 3. Coverage vs Confidence (reported SEPARATELY)

| Axis | What it measures | Current honest value | Source |
|---|---|---|---|
| **Coverage** | Realized employability outcomes wired into the loop | `career_outcomes` (non-demo) count; `null` if table absent | `validation-loop.ts:200,227` |
| **Coverage** | Prediction store wired | `ti_outcome_predictions` exists & populated by engine | `talent-outcome-prediction.ts:25-44` |
| **Confidence (calibration-trust)** | Whether the prediction is empirically trustworthy | `cold_start` at 0 realized pairs (identity map) | `employer-tig.ts:226-229,278-279` |
| **Confidence (model)** | Engine self-confidence (sources present / 4) | distinct from accuracy; never empirical | `talent-outcome-prediction.ts:104` |
| **Empirical accuracy** | Realized hit-rate of predictions | **ABSTAINED** (0 realized non-demo outcomes) | `validation-loop-engine.ts:159-171` |

**These are independent.** High model-confidence (many sources present) does NOT imply empirical
accuracy. Brier/ECE are `null` until ≥1 realized outcome exists (`employer-tig.ts:249-259`).

---

## 4. Calibration status ladder (vocabulary is fixed)

| Status | Trigger | Mapping applied | Employability meaning |
|---|---|---|---|
| `cold_start` | 0 realized pairs | identity (raw = calibrated) | directional only; abstained |
| `provisional` | 1 … 29 realized pairs | α-smoothed band rate | mostly prior; NOT trusted as validated |
| `calibrated` | ≥ 30 realized pairs | isotonic / PAV curve | empirically calibrated; accuracy reportable |

Vocabulary is ONLY `cold_start / provisional / calibrated` (`employer-tig.ts:154-162`). **Never**
claim `calibrated` below k_min=30 (`employer-tig.ts:145,265`).

---

## 5. What exists vs what is pending

- **Working:** the employability prediction engine, the `career_outcomes` substrate (incl. the
  prior-score columns), the unified intake, the reused calibration engine, and the read-only
  coverage surface in `/status`.
- **Disconnected / not yet feeding calibration:** `career_outcomes` is reported in the loop's
  **coverage** block (`validation-loop.ts:200,227`) but is not yet folded into the realized
  calibration pairs (the loop's realized pairs come from manual intake + the employer hiring
  feeder; the `career_outcomes → pairs` on-ramp is **UNVERIFIED as wired into calibration** —
  do not assume it). Reported honestly as a coverage figure, never as accuracy.
- **Pending (outcome-accrual, not code):** ≥ 30 realized non-demo outcomes carrying a decision-time
  employability/readiness prediction.

---

## 6. Honesty / abstention note (binding)

- **No fabricated accuracy %, outcome counts, or results.** The platform has **0 realized non-demo
  outcomes** today; employability empirical accuracy is **ABSTAINED** until ≥ 30 accrue
  (`validation-loop-engine.ts:28,159-171`).
- **Coverage ≠ Confidence ≠ Accuracy** — three separate axes, reported separately. `null` = missing.
- **Language policy** (`validation-loop-engine.ts:33-48`): developmental validation ONLY. This
  framework describes **calibration trust and realized-outcome coverage** — it makes **no**
  hiring / promotion / suitability prediction claims.
- **Demo exclusion:** `is_demo = true` / `@example.com` rows are EXCLUDED from every evidence-backed
  claim (`20260618_career_outcomes.sql:5-10`; `validation-loop-engine.ts:139-140`).
- **Verdict:** honestly **PARTIAL (loop wired, evidence PENDING)** — no PASS and no accuracy figure
  may be asserted before the outcome-accrual milestone is met.
