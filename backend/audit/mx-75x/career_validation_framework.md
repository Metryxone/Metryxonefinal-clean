# MX-75X · Section 9 — Career-Trajectory / Progression Validation Framework

**Task:** MX-75X-VALIDATION-LOOP-AND-OUTCOME-INTELLIGENCE-ACTIVATION
**Scope of this document:** Section 9 only. Read-only, evidence-based. **No code changed.**
**Date:** 2026-06-24
**Method:** Static code/route/schema inspection of the trajectory + outcome + calibration assets.
**Honesty-first:** Coverage and Confidence/Calibration-trust are reported as **SEPARATE axes**.
Nothing fabricated. `null` = missing, never a fabricated `0`.

---

## 0. Headline finding

**Career-trajectory predictions are GENERATED and PERSISTED, but their progression accuracy is
EVIDENCE-PENDING.** The platform holds **0 realized non-demo outcomes** today, so empirical accuracy
of trajectory / progression forecasts is **ABSTAINED** and stays abstained until **≥
`VALIDATION_K_MIN` (30)** realized non-demo binary outcomes carrying a decision-time prediction
accrue (`backend/services/validation-loop-engine.ts:28,159-171`). This is an **outcome-accrual
milestone**, not a code milestone.

The progression loop exists structurally:

- **Prediction (trajectory)** — `trajectory_forecasts`
  (`backend/migrations/20260522_employability_knowledge_graph.sql:194-210`) persists
  `current_ei_score`, `projected_ei_score`, `time_horizon_months`, and a `milestones` JSON of
  `[{month, action, evidence_ref, expected_delta}]` (`:201`). `career_velocity` is also predicted
  by the talent engine (`backend/routes/talent-outcome-prediction.ts:134-137`).
- **Realized milestones** — `career_outcomes`
  (`backend/migrations/20260618_career_outcomes.sql:12-42`) records realized
  `goal_achieved | ei_lift | role_change | promotion | hire`, with the **prior score** that preceded
  the milestone (`prior_score_type / prior_score_value`, `:22-24`).
- **Calibration (reused)** — `buildCalibrationModel` (`backend/routes/employer-tig.ts:211-274`):
  Isotonic/PAV, Beta-Binomial smoothing, Brier + ECE, status `cold_start → provisional →
  calibrated`. No new engine is introduced.

---

## 1. Evidence base

| Evidence | Source |
|---|---|
| Trajectory forecast store (projected EI, horizon, milestones) | `trajectory_forecasts` (`20260522_employability_knowledge_graph.sql:194-210`) |
| Milestone schema `[{month, action, evidence_ref, expected_delta}]` | `:201` |
| Career-velocity prediction | `backend/routes/talent-outcome-prediction.ts:134-137` |
| Realized milestone substrate | `career_outcomes` (`20260618_career_outcomes.sql:12-42`) |
| Prior-score columns (decision-time prediction) | `prior_score_type / prior_score_value / prior_score_at` (`:22-24`) |
| Unified intake | `validation_loop_outcomes` (`20260623_validation_loop_outcomes.sql:14-44`) |
| Pair builder + k_min | `toCalibrationPairs`, `VALIDATION_K_MIN=30` (`validation-loop-engine.ts:66-83,28`) |
| Calibration engine (reused) | `buildCalibrationModel` (`employer-tig.ts:211-274`) |
| Coverage surface | `coverage.career_outcomes` in GET `/status` (`backend/routes/validation-loop.ts:200,227`) |
| Flag (default ON, reversible) | `validationLoop: true` (`backend/config/feature-flags.ts:139`), reverse `FF_VALIDATION_LOOP=0` |
| Honesty / abstention | `evidenceVerdict` (`validation-loop-engine.ts:159-171`); language policy (`:33-48`) |

---

## 2. How trajectory / progression validation WOULD work

1. **Snapshot the forecast.** When a trajectory is generated, `trajectory_forecasts` stores
   `projected_ei_score` and dated `milestones`
   (`20260522_employability_knowledge_graph.sql:199-201`). For binary progression validation, the
   decision-time probability (e.g. P(milestone reached by horizon)) is captured as
   `predicted_prob_at_decision` / `prior_score_value`.
2. **Observe the realized milestone.** When the milestone actually occurs (or the horizon lapses),
   record it in `career_outcomes` as `role_change | promotion | goal_achieved` with
   `outcome_value ∈ {0,1}` and `is_demo = false` (`20260618_career_outcomes.sql:16-28`). Continuous
   deltas (e.g. realized EI lift vs `expected_delta`) use `outcome_kind = 'continuous'` (`:18-20`).
3. **Form pairs.** `toCalibrationPairs` keeps only binary rows with a finite in-range `[0,1]`
   prediction; non-binary / out-of-range / no-prediction rows are **dropped, never coerced**
   (`validation-loop-engine.ts:66-83`).
4. **Calibrate.** `buildCalibrationModel` produces per-band observed vs predicted progression rates,
   Brier + ECE, and an isotonic curve only at `calibrated` (`employer-tig.ts:226-273`).
5. **Report honestly.** Progression accuracy is reported only at `calibrated` (≥ 30 realized own
   outcomes); below that it is `cold_start` / `provisional` and abstained.

---

## 3. Coverage vs Confidence (reported SEPARATELY)

| Axis | What it measures | Current honest value | Source |
|---|---|---|---|
| **Coverage** | Trajectory forecasts persisted | `trajectory_forecasts` rows exist (per-user) | `20260522_…:194-210` |
| **Coverage** | Realized milestones wired | `career_outcomes` (non-demo) count; `null` if absent | `validation-loop.ts:200,227` |
| **Confidence (calibration-trust)** | Forecast empirical trustworthiness | `cold_start` at 0 realized pairs (identity) | `employer-tig.ts:226-229,278-279` |
| **Empirical accuracy** | Realized progression hit-rate | **ABSTAINED** (0 realized non-demo outcomes) | `validation-loop-engine.ts:159-171` |

**Independent axes.** A populated `trajectory_forecasts` table proves predictions are produced
(Coverage) — it says **nothing** about whether they come true (Confidence/Accuracy). Brier/ECE are
`null` until ≥1 realized outcome (`employer-tig.ts:249-259`).

---

## 4. Calibration status ladder (fixed vocabulary)

| Status | Trigger | Trajectory meaning |
|---|---|---|
| `cold_start` | 0 realized pairs | directional forecast only; abstained |
| `provisional` | 1 … 29 realized pairs | mostly prior; NOT trusted as validated |
| `calibrated` | ≥ 30 realized pairs | empirically calibrated; progression accuracy reportable |

Vocabulary is ONLY `cold_start / provisional / calibrated` (`employer-tig.ts:154-162`). **Never**
claim `calibrated` below k_min=30 (`employer-tig.ts:145,265`).

---

## 5. Honest current availability

- **Available now:** trajectory forecast generation + persistence, the realized-milestone substrate
  (`career_outcomes`), the unified intake, the reused calibration engine, and read-only coverage
  reporting in `/status`.
- **Realized progression outcomes wired into calibration:** **none today** — 0 realized non-demo
  outcomes. `career_outcomes` appears in the loop's **coverage** block (`validation-loop.ts:227`);
  whether a `career_outcomes → calibration pairs` on-ramp is wired into the realized calibration set
  is **UNVERIFIED** (the realized pairs in `/status` come from manual intake + the employer hiring
  feeder, `validation-loop.ts:173-195`). Do not assume; report as coverage, never as accuracy.
- **Pending (outcome-accrual, not code):** ≥ 30 realized non-demo progression outcomes carrying a
  decision-time forecast probability.

---

## 6. Honesty / abstention note (binding)

- **No fabricated accuracy %, milestone-hit counts, or results.** The platform has **0 realized
  non-demo outcomes**; trajectory empirical accuracy is **ABSTAINED** until ≥ 30 accrue
  (`validation-loop-engine.ts:28,159-171`).
- **Coverage ≠ Confidence ≠ Accuracy** — separate axes, reported separately. `null` = missing, never
  a fabricated `0`.
- **Language policy** (`validation-loop-engine.ts:33-48`): developmental validation ONLY. This
  framework concerns **calibration trust and milestone coverage** — it asserts **no** hiring /
  promotion / suitability prediction.
- **Demo exclusion:** `is_demo = true` / `@example.com` rows are EXCLUDED from every evidence-backed
  claim (`20260618_career_outcomes.sql:5-10`; `validation-loop-engine.ts:139-140`).
- **Verdict:** honestly **PARTIAL (forecasts produced, evidence PENDING)** — no PASS and no
  progression accuracy figure before the outcome-accrual milestone is met.
