# MX-75X · Section 2 — The Unified Outcome-Intelligence Model

**Task:** MX-75X-VALIDATION-LOOP-AND-OUTCOME-INTELLIGENCE-ACTIVATION
**Scope of this document:** Section 2 only. Read-only, evidence-based. No code changed.
**Date:** 2026-06-24
**Method:** Static code/route/schema inspection of the Phase-7 validation loop + the MX-75X connection.
**Honesty-first:** Coverage (asset exists / wired) and Confidence/Calibration-trust are reported as
SEPARATE axes. `null` = missing, never a fabricated 0. Nothing is invented.

---

## 0. Headline

The platform has **one** unified outcome-intelligence model, not four. Every realized outcome —
whatever its domain — is reduced to the **same `{predicted, outcome}` pair contract** and fed to the
**same** calibration engine (`buildCalibrationModel`). The four "outcome types" are just *labels on
the same intake row*; they do not each get a bespoke engine. This is what makes the loop honest and
auditable: one contract, one math path, one abstention rule.

**Current empirical state:** there are **0 realized non-demo outcomes** on the platform today, so the
model **ABSTAINS** from every empirical-accuracy claim. Calibration status is `cold_start`, and stays
abstained until **≥30 realized non-demo binary outcomes carrying a decision-time prediction** accrue
(`VALIDATION_K_MIN = 30`, `backend/services/validation-loop-engine.ts:28`). This is an
outcome-accrual milestone, not a code milestone — no additive code can lift it.

---

## 1. Evidence base

| Evidence | Source |
|---|---|
| `OUTCOME_TYPES = ['hiring','performance','promotion','retention']` | `backend/services/validation-loop-engine.ts:30` |
| `{predicted, outcome}` pair contract (`toCalibrationPairs`) | `backend/services/validation-loop-engine.ts:66-83` |
| `outcome_kind` binary vs continuous + intake schema | `backend/migrations/20260623_validation_loop_outcomes.sql:20-23` |
| Intake validation (binary 0/1, prob ∈ [0,1]) | `backend/routes/validation-loop.ts:94-104` |
| Calibration engine (reused) | `backend/routes/employer-tig.ts:211-274` (`buildCalibrationModel`) |
| `calibrationFromRows` / `calibrationSummary` composers | `backend/services/validation-loop-engine.ts:85-115` |
| Demo exclusion (`is_demo`) | `backend/routes/validation-loop.ts:168-169`, migration `:31` |
| Evidence verdict / k_min gating | `backend/services/validation-loop-engine.ts:159-171` |
| Language policy (coverage vs confidence) | `backend/services/validation-loop-engine.ts:33-48` |
| Flag default ON (reversible) | `backend/config/feature-flags.ts:139` (`validationLoop: true`) |
| Route registration | `backend/routes.ts:208` (import), `:13806` (register) |

---

## 2. The four outcome types (one model, four labels)

`OUTCOME_TYPES` is a closed enum of exactly four strings
(`backend/services/validation-loop-engine.ts:30`), each a stage in the closed loop
`Assessment → Hiring → Performance → Promotion → Retention → Outcome → Calibration → Prediction`:

| `outcome_type` | What it records | Loop stage it validates |
|---|---|---|
| `hiring` | Did a candidate get hired vs rejected? | Hiring |
| `performance` | Did the hire perform (rating / delta)? | Performance |
| `promotion` | Was the person promoted? | Promotion |
| `retention` | Did the person stay (vs churn)? | Retention |

Each type is just a discriminator column on one intake table (`validation_loop_outcomes`). They are
NOT four separate engines, four schemas, or four accuracy numbers — they share the single pair
contract and the single calibration path described below. `isValidOutcomeType`
(`validation-loop-engine.ts:50-52`) is the only gatekeeper; intake rejects anything else with
`invalid_outcome_type` (`validation-loop.ts:88-90`).

**Language policy (enforced):** these are *developmental validation* signals only. The system never
issues hiring / promotion / suitability *predictions* about people — the disallowed list is explicit
in `VALIDATION_LANGUAGE_POLICY.disallowed` (`validation-loop-engine.ts:41-46`).

---

## 3. The `{predicted, outcome}` pair contract

The entire model rests on one tuple: a **decision-time prediction** paired with the **realized
result** it was supposed to anticipate. Every intake row carries both halves:

- `predicted_prob_at_decision` — the model's probability (0..1) snapshotted **at the moment a
  decision was made** (`migration :24-25`). This is the prediction half. It is nullable: a realized
  outcome with no prediction snapshot is recorded but cannot become a calibration pair.
- `outcome_value` + `outcome_kind` — the realized result (`migration :21-23`). This is the outcome
  half.

`toCalibrationPairs` (`validation-loop-engine.ts:66-83`) is the **pure** function that converts rows
into pairs, and its filters define the contract precisely. A row qualifies **only if**:

1. `outcome_kind` is `binary` (continuous rows are skipped — line 69);
2. both `predicted_prob_at_decision` and `outcome_value` are present and finite (lines 72-75);
3. `outcome_value` is exactly `0` or `1` (line 76);
4. the prediction is in `[0,1]` — out-of-range rows are **dropped, never clamped** (lines 77-79).

> **Honesty rule made mechanical:** a malformed or backfilled row that falls outside `[0,1]` is
> discarded rather than coerced into a "valid" pair. Bad data can never masquerade as evidence.

---

## 4. `outcome_kind`: binary vs continuous

`outcome_kind` (`migration :22`, default `'binary'`) splits realized outcomes into two families:

| `outcome_kind` | `outcome_value` meaning | Calibration eligibility |
|---|---|---|
| `binary` | `0` or `1` (e.g. hired / not, retained / churned) | **Eligible** — becomes a `{predicted, outcome}` pair |
| `continuous` | a measured delta / score (e.g. performance-rating change) | **Not** a calibration pair (skipped at line 69) |

Intake enforces this split: binary rows must be exactly 0 or 1
(`validation-loop.ts:97-99`), continuous rows accept any finite numeric (`:95-96`). Calibration —
which is fundamentally about *probability-vs-frequency* — is defined only for binary outcomes today.
Continuous outcomes are **captured for coverage** (they prove the outcome occurred) but are
**excluded from the empirical-accuracy axis** until a continuous-calibration method is added
(UNVERIFIED — no such method exists in code today).

---

## 5. How realized outcomes flow into calibration

The flow is deliberately short and reuses the existing employer-TIG engine — **no new engine was
built** (`validation-loop-engine.ts:7-11`):

```
validation_loop_outcomes  (rows)
        │  filter !is_demo                              [validation-loop.ts:168]
        ▼
toCalibrationPairs(rows)   →  {predicted, outcome}[]    [validation-loop-engine.ts:66]
        │  (+ connected feeder pairs, see §6 of hiring doc)
        ▼
buildCalibrationModel(pairs)                            [employer-tig.ts:211]
   · reliability bins (5 bands)                         [employer-tig.ts:136-142]
   · Beta–Binomial (α-smoothing) toward band prior      [employer-tig.ts:242]
   · Brier score + ECE on RAW predictions               [employer-tig.ts:248-259]
   · Isotonic / PAV curve once calibrated               [employer-tig.ts:174-205, 265-270]
        ▼
calibrationSummary(model)  →  honest display block      [validation-loop-engine.ts:86-105]
```

The status label is gated purely on the **count of realized own-outcomes**
(`employer-tig.ts:226-229`):

- `cold_start` — 0 realized outcomes → calibration is the **identity map** (raw === calibrated).
- `provisional` — `1 .. 29` realized outcomes → mostly the α-smoothed prior; applied as a best
  estimate but **never claimed validated**.
- `calibrated` — `≥30` realized outcomes → isotonic mapping is trusted.

`brier` and `ece` are `null` until at least one realized outcome exists (`employer-tig.ts:249-259`,
surfaced as `null` by `calibrationSummary` lines 92-93) — **`null`, not a fabricated 0**.

---

## 6. Demo exclusion (the firewall)

Demo / illustrative rows exist **only** to prove the mechanism *runs*; they are never evidence:

- `validation_loop_outcomes.is_demo` (`migration :31`) flags synthetic rows; the status route splits
  `allRows = !is_demo` from `demoRows = is_demo` (`validation-loop.ts:168-169`) and reports demo
  calibration under a separate `demo_illustrative` key (`:220`).
- The connected employer feeder excludes `@example.com` rows explicitly
  (`terminalCandidatesToPairs`, `validation-loop-engine.ts:139-140`).
- The migration header states demo rows are "ALWAYS EXCLUDED from evidence-backed / realized
  calibration claims" (`migration :6-8`).

Demo data therefore can move the **demo_illustrative** numbers but can never touch `realized`,
`connected`, `platform_realized`, or the evidence verdict.

---

## 7. Coverage vs Confidence (two axes, never conflated)

The model reports **three distinct axes**, mirroring the Section-1 framing:

| Axis | Question it answers | Where in code | Today |
|---|---|---|---|
| **Coverage** | Does realized outcome data exist / is it wired? | `status.coverage{}` `validation-loop.ts:223-233` | counts per substrate; `null` if a table is absent |
| **Confidence** | How much does the model trust *itself* (reliability/consistency)? | `status.confidence{}` `validation-loop.ts:252-256` | `model_confidence`, explicitly ≠ accuracy |
| **Calibration / Accuracy** | Do predictions match realized frequencies? | `status.calibration{}` `validation-loop.ts:216-221` | **ABSTAINED** (`cold_start`, 0 realized) |

The code states the separation in plain language: *"Model confidence
(reliability/consistency/evidence) ≠ empirical accuracy; the latter requires realized outcomes
(abstained)"* (`validation-loop.ts:255`). Coverage being non-zero does **not** raise Confidence, and
Confidence being high does **not** imply Accuracy. Only realized `{predicted, outcome}` pairs reaching
`k_min` can move the calibration/accuracy axis.

---

## 8. The evidence verdict (abstention contract)

`evidenceVerdict(realizedPairs)` (`validation-loop-engine.ts:159-171`) is the single source of truth
for whether the model may claim evidence:

- `evidence_backed = realizedPairs >= VALIDATION_K_MIN` (30).
- Below k_min the reason is either `awaiting_outcomes` (0 pairs) or `insufficient_outcomes (n/30)`.
- The status route folds the connected feeder into the count, so the verdict reflects **all** real
  evidence (`validation-loop.ts:209`), then renders the headline verdict string at `:258-260`.

---

## Honesty / abstention note

- Empirical accuracy is **ABSTAINED**: the platform has **0 realized non-demo outcomes** today, so the
  unified model reports `cold_start` and `evidence_backed = false`.
- Calibration vocabulary is strictly `cold_start / provisional / calibrated`; `calibrated` is
  impossible below 30 realized outcomes (`employer-tig.ts:226-229`).
- Coverage, Confidence, and Calibration/Accuracy are reported on **separate axes**; `null` denotes a
  missing substrate, never a fabricated 0.
- This document changed no code. It documents the existing Phase-7 + MX-75X-connection model only.
