# MX-75X · Section 4 — Performance-Outcome Validation Framework

**Task:** MX-75X-VALIDATION-LOOP-AND-OUTCOME-INTELLIGENCE-ACTIVATION
**Scope of this document:** Section 4 only. Read-only, evidence-based. No code changed.
**Date:** 2026-06-24
**Method:** Static code/route/schema inspection of the validation loop, the calibration engine, and the
existing outcome substrates.
**Honesty-first:** Coverage and Confidence/Calibration-trust are SEPARATE axes. `null` = missing,
never a fabricated 0. Demo / `@example.com` rows are excluded from evidence-backed claims.

---

## 0. Headline

Performance is the second stage of the loop
(`Assessment → Hiring → **Performance** → Promotion → Retention → Outcome → Calibration → Prediction`)
and one of the four `OUTCOME_TYPES` (`backend/services/validation-loop-engine.ts:30`). Unlike hiring,
performance has **no live feeder** today: there is no automatic on-ramp from a performance system into
the validation loop. The intake *exists* (a row with `outcome_type='performance'` is fully valid), but
**no performance outcome has been recorded** and **none is realized**.

**Empirical state is ABSTAINED.** With **0 realized non-demo performance outcomes**, performance
calibration is `cold_start` and stays abstained until **≥30** realized non-demo binary performance
outcomes carrying a decision-time prediction accrue (`VALIDATION_K_MIN = 30`,
`validation-loop-engine.ts:28`). This is an outcome-accrual milestone — no code can shortcut it.

---

## 1. Evidence base

| Evidence | Source |
|---|---|
| `performance` ∈ `OUTCOME_TYPES` | `backend/services/validation-loop-engine.ts:30` |
| Intake row shape (`outcome_kind`, `outcome_value`, `predicted_prob_at_decision`) | `backend/migrations/20260623_validation_loop_outcomes.sql:20-33` |
| Intake validation (binary 0/1 vs continuous numeric) | `backend/routes/validation-loop.ts:94-104` |
| Pair contract (binary-only, finite, in-range) | `backend/services/validation-loop-engine.ts:66-83` |
| Calibration engine (reused) | `backend/routes/employer-tig.ts:211-274` |
| k_min gating + status labels | `backend/routes/employer-tig.ts:226-229`; `validation-loop-engine.ts:28` |
| Per-type intake counts (incl. `performance`) | `backend/routes/validation-loop.ts:148-163` |
| Evidence verdict / abstention | `backend/services/validation-loop-engine.ts:159-171` |
| `career_outcomes` (disconnected, continuous-capable) | `backend/migrations/20260618_career_outcomes.sql:12-32` |
| Coverage counts (`null` if table absent) | `backend/routes/validation-loop.ts:58-65`, `:198-206` |

---

## 2. `outcome_kind` for performance (binary vs continuous)

Performance is the outcome type where the **continuous** kind matters most, because performance is
naturally measured as a *magnitude*, not just a yes/no:

| `outcome_kind` | Example performance signal | Intake rule | Calibration |
|---|---|---|---|
| `binary` | "met the bar at review" (1) vs "did not" (0) | must be exactly 0/1 (`validation-loop.ts:97-99`) | **Eligible** — becomes a `{predicted, outcome}` pair |
| `continuous` | a measured rating delta (e.g. +0.4 on a review scale) | any finite numeric (`validation-loop.ts:95-96`) | **Captured for coverage only** — not a pair |

The pair contract `toCalibrationPairs` skips any row whose `outcome_kind !== 'binary'`
(`validation-loop-engine.ts:69`). So a continuous performance measurement is **recorded and counted
on the coverage axis** but is **excluded from the empirical-accuracy axis** until a continuous
calibration method exists. **No such continuous-calibration method exists in code today (UNVERIFIED).**

---

## 3. What a performance outcome row looks like

A performance outcome is a normal `validation_loop_outcomes` row
(`migration 20260623_validation_loop_outcomes.sql:14-35`) with `outcome_type='performance'`. The
shape, illustratively:

| Column | Binary example | Continuous example |
|---|---|---|
| `outcome_type` | `performance` | `performance` |
| `outcome_kind` | `binary` | `continuous` |
| `outcome_value` | `1` (met bar) / `0` (did not) | `0.4` (measured review delta) |
| `predicted_prob_at_decision` | `0.72` (probability snapshotted at hire/placement) | (often `NULL` for a delta) |
| `predicted_basis` | engine/source that produced the prediction | — |
| `subject_email` / `subject_user_id` | the assessed subject | the assessed subject |
| `assessment_ref` | the assessment/session this outcome validates | same |
| `decision_at` / `observed_at` | when the decision was made / observed | same |
| `is_demo` | `false` for real evidence | `false` for real evidence |
| `ref_id` | idempotency key (originating decision id) | same |

> Note (illustrative, not a record of data): the values above are *examples of the schema*, not
> existing rows. **No performance row exists** — see §4.

For a performance row to become **evidence**, it must be `binary`, carry a finite
`predicted_prob_at_decision` in `[0,1]`, have `outcome_value ∈ {0,1}`, and be non-demo
(`validation-loop-engine.ts:69-80`).

---

## 4. Current data availability (honest)

- **Realized non-demo performance outcomes: 0.** There is no live performance feeder and no recorded
  performance row. The status route initialises every type's counters to `{realized:0, demo:0}`
  (`validation-loop.ts:148-149`) and only increments from actual table rows (`:158-163`); with no
  rows, performance stays at zero.
- **No automatic on-ramp.** Hiring has the MX-75X connected feeder
  (`terminalCandidatesToPairs`); performance has **no equivalent feeder** in code (UNVERIFIED that any
  exists). Performance outcomes can today only arrive via manual `POST /api/validation-loop/outcomes`
  with `outcome_type='performance'` (`validation-loop.ts:83-140`).
- **`career_outcomes` is a related but disconnected substrate.** It can record performance-adjacent
  outcomes — its `outcome_type` enum includes `ei_lift`, `goal_achieved`, `role_change`, `promotion`,
  `hire` (`20260618_career_outcomes.sql:16-17`) — and it explicitly supports `outcome_kind`
  binary/continuous (`:18-19`) plus a `prior_score_*` snapshot (`:21-24`). However it is **not wired
  into the validation loop's calibration**; the loop only *counts* `career_outcomes` for coverage
  (`validation-loop.ts:200`), returning `null` if the table is absent (`safeCount`, `:58-65`).
  Routing it in would require a verified mapping from `prior_score_value` to a `[0,1]` prediction
  (UNVERIFIED — no such mapping exists today).

---

## 5. How performance WOULD calibrate (once outcomes accrue)

When realized binary performance pairs exist, they flow through the **same reused engine** as every
other outcome type — no performance-specific engine is built:

```
validation_loop_outcomes (outcome_type='performance', !is_demo)
        ▼  toCalibrationPairs  (binary-only, finite, [0,1])   [validation-loop-engine.ts:66]
   {predicted, outcome}[]
        ▼  buildCalibrationModel                              [employer-tig.ts:211]
   · 5 reliability bins                                       [employer-tig.ts:136-142]
   · Beta–Binomial α-smoothing toward band prior             [employer-tig.ts:242]
   · Brier + ECE on RAW predictions                          [employer-tig.ts:248-259]
   · Isotonic / PAV curve once calibrated                    [employer-tig.ts:174-205, 265-270]
        ▼  calibrationSummary                                 [validation-loop-engine.ts:86-105]
```

Status is gated purely on realized performance-pair count (`employer-tig.ts:226-229`):

| Realized performance pairs | Status | Behaviour |
|---|---|---|
| `0` (today) | `cold_start` | identity map; `brier`/`ece` = `null` |
| `1 .. 29` | `provisional` | α-smoothed band rate; best estimate, **never** "validated" |
| `≥30` | `calibrated` | isotonic mapping trusted |

`brier` and `ece` stay `null` until ≥1 realized performance outcome exists
(`employer-tig.ts:249-259`; surfaced as `null`, **not 0**, by `calibrationSummary` lines 92-93).

---

## 6. Coverage vs Confidence (performance)

| Axis | Today | Source |
|---|---|---|
| **Coverage** | performance intake count = 0; `career_outcomes` counted separately (`null` if absent) | `validation-loop.ts:148-163`, `:200` |
| **Confidence** | `model_confidence` — reliability/consistency, explicitly **≠ accuracy** | `validation-loop.ts:252-256` |
| **Calibration / Accuracy** | **ABSTAINED** — `cold_start`, 0 realized non-demo pairs | `validation-loop.ts:216-221`, `employer-tig.ts:226-229` |

Absence of performance data is reported as **absence** (count 0 / `null`), never as "0% accuracy".
Coverage existing elsewhere (`career_outcomes`) does not raise the Accuracy axis.

---

## 7. Abstention contract

`evidenceVerdict` (`validation-loop-engine.ts:159-171`) governs performance evidence exactly as it
does every type: `evidence_backed` only when the realized count reaches 30; below that the reason is
`awaiting_outcomes` (0) or `insufficient_outcomes (n/30)`. The platform verdict stays **PARTIAL** for
performance — structurally wired, empirically pending (`validation-loop.ts:260`).

---

## Honesty / abstention note

- Empirical performance accuracy is **ABSTAINED**: **0 realized non-demo performance outcomes** exist
  today → `cold_start`, `evidence_backed = false`. No accuracy %, no counts are fabricated.
- Performance has **no live feeder**; outcomes can only arrive via manual intake today. Any continuous
  performance measurement is captured for **coverage** but excluded from calibration (binary-only
  pair contract, `validation-loop-engine.ts:69`).
- Calibration vocabulary is strictly `cold_start / provisional / calibrated`; `calibrated` is
  impossible below 30 realized outcomes.
- `career_outcomes` is coverage that exists but does not feed calibration; wiring it needs a verified
  `prior_score → [0,1]` prediction mapping (UNVERIFIED today).
- This is *developmental validation* only — no performance/suitability predictions about people
  (`VALIDATION_LANGUAGE_POLICY`, `validation-loop-engine.ts:41-46`). No code was changed.
