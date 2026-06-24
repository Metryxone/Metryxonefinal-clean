# MX-75X · Section 6 — Retention-Outcome Validation Framework

**Task:** MX-75X-VALIDATION-LOOP-AND-OUTCOME-INTELLIGENCE-ACTIVATION
**Scope of this document:** Section 6 only. Read-only, evidence-based. No code changed.
**Date:** 2026-06-24
**Method:** Static code/route/schema inspection of the validation-loop subsystem.
**Honesty-first:** Coverage (asset exists / wired) and Confidence/Calibration-trust are reported as
SEPARATE axes. Nothing is fabricated. `null` = missing, never a fabricated `0`.

---

## 0. Headline

Retention is the fourth first-class realized-outcome type in the loop
(`OUTCOME_TYPES = ['hiring','performance','promotion','retention']`,
`backend/services/validation-loop-engine.ts:30`) and the terminal outcome stage before calibration:
`Assessment → Hiring → Performance → Promotion → Retention → Outcome → Calibration → Prediction`
(`backend/routes/validation-loop.ts:4-5`). The retention intake, schema, and calibration
compose-path EXIST and are reachable. What does **not** exist today is **realized, non-demo retention
data**: there are **0** realized non-demo retention outcomes carrying a decision-time prediction.
Empirical retention-prediction accuracy is therefore **ABSTAINED** until **≥30** such outcomes
accrue (`VALIDATION_K_MIN = 30`, `backend/services/validation-loop-engine.ts:28`).

This is **developmental validation only** — never a hiring/promotion/suitability prediction product.

---

## 1. Retention / attrition as a realized binary outcome vs a decision-time prediction

Retention and attrition are two encodings of the same binary event. The loop records the realized
outcome and the decision-time prediction it validates, in `validation_loop_outcomes`
(`backend/migrations/20260623_validation_loop_outcomes.sql`):

| Quantity | Column | Meaning for retention |
|---|---|---|
| Realized outcome | `outcome_value` (binary `0/1`) | Retention encoding — e.g. `1` = retained, `0` = attrited (encoding fixed by the recorder; UNVERIFIED canonical polarity) |
| Outcome shape | `outcome_kind` (`binary` \| `continuous`) | Binary for calibration; `continuous` could carry a measured tenure delta (recorded, not calibration-eligible) |
| Decision-time prediction | `predicted_prob_at_decision` (`0..1`) | Probability assigned **at decision time** the realized outcome validates |
| Prediction provenance | `predicted_basis` | Engine/source of the prediction (UNVERIFIED which engine feeds retention) |
| Subject | `subject_email` / `subject_user_id` | Who the outcome is about |
| Validated assessment | `assessment_ref` | The assessment/session the outcome validates |
| Demo guard | `is_demo` | `true` rows EXCLUDED from realized/evidence-backed claims |

Intake validation (`POST /api/validation-loop/outcomes`, `backend/routes/validation-loop.ts:83-140`)
requires a valid `outcome_type` (`:88`), a `subject_email` (`:92`), and — for binary — an
`outcome_value` of exactly `0` or `1` (`:97-99`). A supplied `predicted_prob_at_decision` must be
finite and within `[0,1]` else `400` (`:101-104`). Only rows carrying BOTH a finite in-range
prediction AND a binary outcome become calibration evidence via `toCalibrationPairs`
(`backend/services/validation-loop-engine.ts:66-83`), which drops missing/empty/non-finite
predictions (`:72-75`), non-`0/1` outcomes (`:76`), and out-of-range probabilities (`:79`, dropped —
**never** clamped/coerced).

---

## 2. Time-horizon considerations (honest limitations)

Retention is intrinsically **time-bounded** ("retained at 6 / 12 / 24 months"), which creates honest
constraints the current schema does **not** explicitly encode:

| Consideration | What the code provides | Honest gap |
|---|---|---|
| Decision time | `decision_at` (TIMESTAMPTZ) — when the prediction was made (`migration:27`) | Present |
| Observation time | `observed_at` (TIMESTAMPTZ, default `now()`) — when the outcome was recorded (`migration:28`) | Present |
| Retention horizon | — | **No dedicated horizon column.** A horizon (e.g. 12-month) would live in the free-form `detail` JSONB (`migration:33`) — UNVERIFIED whether any convention exists |
| Censoring | — | No survival/censoring handling. A subject still employed before the horizon is neither retained nor attrited yet; the binary model has no "not-yet-observed" state. Recording such a row prematurely would bias calibration |
| Maturation lag | `observed_at − decision_at` | Retention outcomes mature slowly, so the ≥30 milestone for retention is expected to be the **slowest** of the four types to reach |

**Implication:** a retention pair should only be recorded once its horizon has elapsed and the binary
outcome is genuinely realized. Until then, absence must be reported as absence (`null` / awaiting),
never as a fabricated `0`. The calibration math itself is horizon-agnostic — it sees only
`{predicted, outcome}` pairs — so horizon discipline is a **recording-side** honesty obligation, not
something the engine enforces (UNVERIFIED any horizon guard in code).

---

## 3. Honest current availability (Coverage vs Confidence)

| Axis | Retention status | Evidence |
|---|---|---|
| Intake wired | ✅ yes | `outcome_type='retention'` accepted; `OUTCOME_TYPES` includes `retention` (`validation-loop-engine.ts:30`) |
| Schema present (post-activation) | ✅ yes (POST-path only) | `ensureSchema` on first POST (`validation-loop.ts:41-48`); GET probes via `to_regclass`, never DDL (`:67-74`) |
| Flag/activation | ✅ default ON | `validationLoop: true` (`backend/config/feature-flags.ts:139`); reversible via `FF_VALIDATION_LOOP=0`; 503 when OFF (`validation-loop.ts:50-55`) |
| Calibration compose-path | ✅ yes | `toCalibrationPairs` → `buildCalibrationModel` → `calibrationSummary` (`validation-loop-engine.ts:66,86,111`) |
| Realized non-demo retention outcomes | **0** | No realized non-demo retention rows exist today |
| Automatic retention feeder | ❓ null / UNVERIFIED | The connected feeder maps **hiring** terminal stages only (`terminalCandidatesToPairs`, `validation-loop-engine.ts:136-153`). No retention/attrition feeder is wired |
| Empirical retention accuracy | **ABSTAINED** | `< VALIDATION_K_MIN` realized pairs → abstained (`evidenceVerdict`, `validation-loop-engine.ts:159-171`) |

**Coverage ≠ Confidence:** the retention intake is fully wired (Coverage ✅), but the
Confidence/Calibration-trust axis is **`cold_start`** because there are zero realized non-demo
retention pairs — identity map, nothing claimed
(`buildCalibrationModel`, `employer-tig.ts:226-229,263,278-279`).

---

## 4. How a retention outcome flows through calibration

1. **Record** — retention outcome via `POST /api/validation-loop/outcomes`
   (`outcome_type='retention'`, `outcome_kind='binary'`, `outcome_value ∈ {0,1}`, decision-time
   prediction), once the horizon has elapsed.
2. **Filter** — demo (`is_demo=true`) separated from realized (`validation-loop.ts:168-169,281-282`).
3. **Pair** — `toCalibrationPairs` → `{predicted, outcome}` (`validation-loop-engine.ts:66-83`).
4. **Calibrate** — `buildCalibrationModel` (REUSED engine, `employer-tig.ts:211-274`): reliability
   bands, Beta–Binomial smoothing, Brier + ECE.
5. **Summarise** — `calibrationSummary` exposes status, counts, `remaining_to_calibrated`, Brier,
   ECE, method, populated bands (`validation-loop-engine.ts:86-105`).
6. **Verdict** — `evidenceVerdict` stays `evidence_backed=false` until the platform evidence axis
   reaches `k_min` (`validation-loop-engine.ts:159-171`).

> NOTE: Status/calibration endpoints build models over the **combined** realized + connected pairs
> across types (`validation-loop.ts:173-209`), not split per `outcome_type`. A retention-only
> calibration view is **UNVERIFIED / not separately surfaced** today.

---

## 5. Calibration path to "calibrated" (the retention milestone)

| Stage | Condition | Calibration status | What is claimed |
|---|---|---|---|
| Now | 0 realized non-demo retention pairs | `cold_start` | Nothing — identity map, abstained |
| Accruing | `1 … 29` realized pairs | `provisional` | Directional only; α-smoothed bins; never "validated" |
| Milestone | `≥ 30` realized pairs | `calibrated` | Isotonic mapping trusted; Brier/ECE reportable |

Thresholds are literal: `cold_start` at `realized.length === 0`, `provisional` below
`CALIB_MIN_OUTCOMES` (=30), `calibrated` at `≥30` (`employer-tig.ts:145,226-229`), mirrored as
`VALIDATION_K_MIN = 30` (`validation-loop-engine.ts:28`). `calibrationSummary` reports
`remaining_to_calibrated = max(0, k_min − total)` (`validation-loop-engine.ts:91`). Given retention's
maturation lag (§2), this milestone is expected to be reached **last** among the four types.

**Language policy:** developmental validation only; vocabulary is exclusively
`cold_start / provisional / calibrated`; never present as a hiring/promotion/suitability prediction
(`VALIDATION_LANGUAGE_POLICY`, `validation-loop-engine.ts:33-48`).

---

## 6. Gaps & honest next steps (no fabrication)

- **No automatic retention feeder.** Only the hiring feeder is connected
  (`terminalCandidatesToPairs`, `validation-loop-engine.ts:136-153`). Retention currently relies on
  **manual intake**. Whether `career_outcomes` (20260618) or `ti_outcome_predictions` carry
  retention/attrition semantics is **UNVERIFIED**.
- **No explicit horizon/censoring model.** Horizon would have to live in `detail` JSONB by
  convention (UNVERIFIED); the engine itself is horizon-agnostic. Premature recording risks biased
  calibration — a recording-side honesty obligation.
- **Empirical accuracy stays ABSTAINED** until ≥30 realized non-demo retention outcomes with
  decision-time predictions accrue. Demo rows only ever prove the mechanism RUNS.

---

## 7. Abstention note

As of this audit the platform holds **0 realized non-demo retention outcomes**. No retention/attrition
accuracy %, no outcome counts, and no PASS verdict are claimed. The retention validation framework is
**structurally ready, empirically PENDING** — honest verdict **PARTIAL (loop wired, evidence
PENDING)**, consistent with `evidenceVerdict` returning `evidence_backed=false` below `k_min`
(`validation-loop-engine.ts:159-171`).
