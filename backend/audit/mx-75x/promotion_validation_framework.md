# MX-75X · Section 5 — Promotion-Outcome Validation Framework

**Task:** MX-75X-VALIDATION-LOOP-AND-OUTCOME-INTELLIGENCE-ACTIVATION
**Scope of this document:** Section 5 only. Read-only, evidence-based. No code changed.
**Date:** 2026-06-24
**Method:** Static code/route/schema inspection of the validation-loop subsystem.
**Honesty-first:** Coverage (asset exists / wired) and Confidence/Calibration-trust are reported as
SEPARATE axes. Nothing is fabricated. `null` = missing, never a fabricated `0`.

---

## 0. Headline

The validation loop treats **promotion** as one of four first-class realized-outcome types
(`OUTCOME_TYPES = ['hiring','performance','promotion','retention']`,
`backend/services/validation-loop-engine.ts:30`). The intake, schema, and calibration compose-path
for promotion already EXIST and are reachable. What does **not** exist today is **realized,
non-demo promotion data**: there are **0** realized non-demo promotion outcomes carrying a
decision-time prediction. Therefore empirical promotion-prediction accuracy is **ABSTAINED** until
**≥30** such outcomes accrue (`VALIDATION_K_MIN = 30`,
`backend/services/validation-loop-engine.ts:28`).

This document describes promotion as a **realized binary outcome validated against a decision-time
prediction** — strictly developmental validation, **never** a hiring/promotion/suitability
prediction product.

---

## 1. Promotion as a realized binary outcome vs a decision-time prediction

The loop chain is `Assessment → Hiring → Performance → Promotion → Retention → Outcome →
Calibration → Prediction` (`backend/routes/validation-loop.ts:4-5`). Promotion sits in the
front-half **outcome** position. Two distinct quantities are recorded per row in
`validation_loop_outcomes` (migration `backend/migrations/20260623_validation_loop_outcomes.sql`):

| Quantity | Column | Meaning for promotion |
|---|---|---|
| Realized outcome | `outcome_value` (binary `0/1`) | Did the promotion happen? `1` = promoted, `0` = not promoted |
| Outcome shape | `outcome_kind` (`binary` \| `continuous`) | Promotion is recorded as `binary` for calibration eligibility |
| Decision-time prediction | `predicted_prob_at_decision` (NUMERIC, `0..1`) | The probability the engine assigned **at decision time** (snapshot) |
| Prediction provenance | `predicted_basis` | Engine/source that produced the prediction (UNVERIFIED which engine feeds promotion) |
| Subject | `subject_email` / `subject_user_id` | Who the outcome is about |
| Validated assessment | `assessment_ref` | The assessment/session the outcome validates |
| Demo guard | `is_demo` | `true` rows are EXCLUDED from realized/evidence-backed claims |

The intake (`POST /api/validation-loop/outcomes`, `backend/routes/validation-loop.ts:83`) accepts a
promotion outcome only when `outcome_type` is a valid type (`isValidOutcomeType`,
`:88`), `subject_email` is present (`:92`), and — for binary — `outcome_value` is exactly `0` or `1`
(`:97-99`). A supplied `predicted_prob_at_decision` must be finite and within `[0,1]` or the request
is rejected `400` (`:101-104`). This is the contract that makes a promotion row eligible to become a
`{predicted, outcome}` calibration pair.

**Why both quantities matter:** a promotion-outcome row with only the realized value (no
`predicted_prob_at_decision`) records that a promotion happened but **cannot** validate any
prediction. Only rows that carry BOTH a finite in-range prediction AND a binary outcome become
calibration evidence — see `toCalibrationPairs` (`backend/services/validation-loop-engine.ts:66-83`),
which drops rows with a missing/empty/non-finite prediction (`:72-75`), non-`0/1` outcome (`:76`), or
an out-of-range probability (`:79`, dropped, **never** clamped).

---

## 2. Honest current availability (Coverage vs Confidence)

Coverage (does the substrate exist / is it wired) and Confidence/Calibration-trust (is the result
empirically validated) are **separate axes**.

| Axis | Promotion status | Evidence |
|---|---|---|
| Intake wired | ✅ yes | `POST /api/validation-loop/outcomes` accepts `outcome_type='promotion'` (`validation-loop.ts:83-140`); `OUTCOME_TYPES` includes `promotion` (`validation-loop-engine.ts:30`) |
| Schema present (post-activation) | ✅ yes (POST-path only) | `ensureSchema` creates `validation_loop_outcomes` on first POST (`validation-loop.ts:41-48`); GET handlers PROBE via `to_regclass` and never DDL (`:67-74`) |
| Flag/activation | ✅ default ON | `validationLoop: true` (`backend/config/feature-flags.ts:139`); reversible via `FF_VALIDATION_LOOP=0`; routes 503 when OFF (`validation-loop.ts:50-55`) |
| Calibration compose-path | ✅ yes | `toCalibrationPairs` → `buildCalibrationModel` → `calibrationSummary` (`validation-loop-engine.ts:66,86,111`) |
| Realized non-demo promotion outcomes | **0** | No realized non-demo promotion rows exist today |
| Decision-time prediction feeder for promotion | ❓ null / UNVERIFIED | The connected feeder (`terminalCandidatesToPairs`) maps **hiring** terminal stages (Hired/Rejected), NOT promotions (`validation-loop-engine.ts:136-153`). No automatic promotion feeder is wired |
| Empirical promotion accuracy | **ABSTAINED** | `< VALIDATION_K_MIN` realized outcomes → predictions stay abstained (`evidenceVerdict`, `validation-loop-engine.ts:159-171`) |

**Coverage ≠ Confidence:** the promotion intake is fully wired (Coverage ✅), but the
Confidence/Calibration-trust axis is **`cold_start`** because there are zero realized non-demo
promotion pairs. A `cold_start` model applies the identity map (raw === calibrated) and claims
nothing (`buildCalibrationModel`, `employer-tig.ts:226-229,263,278-279`).

---

## 3. How a promotion outcome flows through calibration

1. **Record** — a promotion outcome arrives via `POST /api/validation-loop/outcomes` with
   `outcome_type='promotion'`, `outcome_kind='binary'`, `outcome_value ∈ {0,1}`, and (ideally) a
   `predicted_prob_at_decision`.
2. **Filter** — demo (`is_demo=true`) rows are separated from realized rows in the status/calibration
   readers (`validation-loop.ts:168-169,281-282`).
3. **Pair** — `toCalibrationPairs` converts qualifying realized promotion rows into
   `{predicted, outcome}` pairs (`validation-loop-engine.ts:66-83`).
4. **Calibrate** — `buildCalibrationModel` (the REUSED engine, `employer-tig.ts:211-274`) bins the
   pairs into reliability bands, applies Beta–Binomial smoothing, and computes Brier + ECE.
5. **Summarise** — `calibrationSummary` exposes status, counts, `remaining_to_calibrated`, Brier,
   ECE, method, and populated bands (`validation-loop-engine.ts:86-105`).
6. **Verdict** — `evidenceVerdict` reports `evidence_backed=false` until promotion (folded into the
   platform evidence axis) reaches `k_min` (`validation-loop-engine.ts:159-171`).

> NOTE: In the current status/calibration endpoints the calibration models are built over the
> **combined** realized + connected pairs across types (`validation-loop.ts:173-209`), not split per
> `outcome_type`. A promotion-only calibration view is therefore **UNVERIFIED / not separately
> surfaced** today; promotion contributes to the platform evidence axis once recorded.

---

## 4. Calibration path to "calibrated" (the promotion milestone)

The path is an **outcome-accrual milestone**, not a code milestone. No additive code lifts the
status — only realized non-demo promotion outcomes do.

| Stage | Condition | Calibration status | What is claimed |
|---|---|---|---|
| Now | 0 realized non-demo promotion pairs | `cold_start` | Nothing — identity map, abstained |
| Accruing | `1 … 29` realized pairs | `provisional` | Directional only; α-smoothed bins; never "validated" |
| Milestone | `≥ 30` realized pairs | `calibrated` | Isotonic mapping trusted; Brier/ECE reportable |

Thresholds are literal in code: `cold_start` when `realized.length === 0`, `provisional` when
`< CALIB_MIN_OUTCOMES` (=30), `calibrated` at `≥30` (`employer-tig.ts:145,226-229`). The validation
loop mirrors this constant as `VALIDATION_K_MIN = 30`
(`validation-loop-engine.ts:28`), and `calibrationSummary` reports
`remaining_to_calibrated = max(0, k_min − total)` (`validation-loop-engine.ts:91`).

**Language policy (enforced by convention):** developmental validation only. The status vocabulary
is exclusively `cold_start / provisional / calibrated`. The system must **never** present this as a
hiring/promotion/suitability prediction (`VALIDATION_LANGUAGE_POLICY`,
`validation-loop-engine.ts:33-48`).

---

## 5. Gaps & honest next steps (no fabrication)

- **No automatic promotion feeder.** The only connected feeder maps **hiring** terminal decisions
  (`terminalCandidatesToPairs`, `validation-loop-engine.ts:136-153`). A promotion feeder (e.g. an HR
  promotion record carrying a decision-time prediction) does not exist; promotion currently relies on
  **manual intake**. Marked UNVERIFIED whether any disconnected substrate
  (`career_outcomes`, `ti_outcome_predictions`) carries promotion semantics.
- **No per-type promotion calibration surface.** Status/calibration build over combined pairs;
  a promotion-isolated reliability view is not surfaced (UNVERIFIED).
- **Empirical accuracy stays ABSTAINED** until ≥30 realized non-demo promotion outcomes with
  decision-time predictions accrue. Demo rows only ever prove the mechanism RUNS.

---

## 6. Abstention note

As of this audit the platform holds **0 realized non-demo promotion outcomes**. No promotion
accuracy %, no outcome counts, and no PASS verdict are claimed. The promotion validation framework is
**structurally ready, empirically PENDING**. The honest verdict is **PARTIAL (loop wired, evidence
PENDING)**, consistent with `evidenceVerdict` returning `evidence_backed=false` below `k_min`
(`validation-loop-engine.ts:159-171`).
