# MX-75X · Section 7 — The Prediction-Calibration Framework

**Task:** MX-75X-VALIDATION-LOOP-AND-OUTCOME-INTELLIGENCE-ACTIVATION
**Scope of this document:** Section 7 only. Read-only, evidence-based. No code changed.
**Date:** 2026-06-24
**Method:** Line-by-line read of `buildCalibrationModel` and its helpers in
`backend/routes/employer-tig.ts`, plus the compose-path in
`backend/services/validation-loop-engine.ts` and the readers in
`backend/routes/validation-loop.ts`.
**Honesty-first:** Coverage (asset exists / wired) and Confidence/Calibration-trust are SEPARATE
axes. Nothing is fabricated. `null` = missing, never a fabricated `0`. This describes ONLY what the
code actually does.

---

## 0. Headline

The platform has ONE calibration engine, `buildCalibrationModel`
(`backend/routes/employer-tig.ts:211-274`), originally built for the Talent Intelligence Graph
(Engine 8). The validation loop does **not** add a second engine — it **composes** this one
(`backend/services/validation-loop-engine.ts:22`, `import { buildCalibrationModel } …`). Because the
platform holds **0 realized non-demo outcomes** today, every model the loop builds over realized data
is `cold_start`, the identity map, and empirical accuracy is **ABSTAINED** until **≥30** realized
non-demo outcomes accrue (`VALIDATION_K_MIN = 30` mirroring `CALIB_MIN_OUTCOMES = 30`;
`validation-loop-engine.ts:28`, `employer-tig.ts:145`).

---

## 1. Inputs and output shape

`buildCalibrationModel(realized, priorByBand?)` (`employer-tig.ts:211-214`) takes:

- `realized: { predicted: number; outcome: 0 | 1 }[]` — realized `{decision-time prediction, binary
  outcome}` pairs.
- `priorByBand?: Record<string, number>` — an OPTIONAL globally-pooled per-band prior rate (E5). When
  absent, an uninformative band-midpoint prior is used.

It returns a `CalibrationModel` (`employer-tig.ts:154-162`):

| Field | Type | Meaning |
|---|---|---|
| `status` | `'calibrated' \| 'provisional' \| 'cold_start'` | TRUST label gated on `realized.length` |
| `totalOutcomes` | number | `realized.length` |
| `bands` | `CalibrationBand[]` | the 5 reliability bands with per-band stats |
| `brier` | `number \| null` | Brier score on RAW predictions; `null` until ≥1 outcome |
| `ece` | `number \| null` | expected calibration error; `null` until ≥1 outcome |
| `method` | `'identity' \| 'binned' \| 'isotonic'` | which mapping `calibrateProbability` applies |
| `isotonic?` | `{x,y}[]` | PAV curve, in-memory only, **never persisted** |

Note `brier`/`ece` are `null` (not `0`) when there is no data — honest absence
(`employer-tig.ts:158-159,249`).

---

## 2. Reliability bands

Five fixed equal-width bands span `[0,1]` (`CALIBRATION_BANDS`, `employer-tig.ts:136-142`):

| Band | Range |
|---|---|
| `b0` | `[0.0, 0.2)` |
| `b1` | `[0.2, 0.4)` |
| `b2` | `[0.4, 0.6)` |
| `b3` | `[0.6, 0.8)` |
| `b4` | `[0.8, 1.01)` — upper bound `1.01` so a prediction of exactly `1.0` lands in `b4` |

`bandFor(p)` (`employer-tig.ts:167-170`) clamps `p` to `[0,1]` then finds the band where
`clamped >= min && clamped < max`, defaulting to the last band. Each realized pair is accumulated into
its band: `sampleSize++`, `positives += (outcome===1)`, `predictedSum += clamp01(predicted)`
(`employer-tig.ts:215-222`).

Per band (`CalibrationBand`, `employer-tig.ts:147-153`, populated `:231-246`):

- `observedRate` = `positives / sampleSize` (rounded to 3 dp) — the **empirical** positive rate.
- `meanPredicted` = `predictedSum / sampleSize` — mean RAW prediction of cases in this band.
- `calibratedRate` = the **smoothed** rate (see §3).
- `priorSource` = `'global_pooled'` if a `priorByBand` value applied, else `'uninformative'`.
- Empty bands (`sampleSize === 0`) return `observedRate / calibratedRate / meanPredicted = null`
  (honest absence) with `priorSource: 'uninformative'` (`employer-tig.ts:232-235`).

---

## 3. Beta–Binomial (m-estimate) smoothing

For each non-empty band the calibrated rate is an m-estimate / Beta–Binomial posterior mean
(`employer-tig.ts:236-242`):

```
midpoint       = (min + min(1, max)) / 2          // uninformative raw expectation
globalPrior    = priorByBand?.[bandId]            // E5, optional
prior          = globalPrior ?? midpoint
calibratedRate = (positives + CALIB_ALPHA * prior) / (sampleSize + CALIB_ALPHA)
```

with `CALIB_ALPHA = 5` (`employer-tig.ts:144`) — the prior pseudo-observation strength per band. With
few samples the rate is pulled toward `prior`; as `sampleSize` grows the empirical `positives` rate
dominates. This is why a low-`n` model is honest-but-soft: its band rates are mostly prior, never an
overconfident empirical claim.

**E5 global prior (`buildGlobalCalibrationPrior`, `employer-tig.ts:286-309`):** computes a per-band
pooled hire rate across ALL orgs from `employer_candidates JOIN employer_jobs` terminal rows, and
exposes a band's prior ONLY when that band carries `≥ CALIB_MIN_OUTCOMES` outcomes from `≥2` distinct
orgs (k-anonymity / tenant isolation; `:306`). It lends strength to thin orgs but **never changes a
TRUST status**. NOTE: the validation loop calls `buildCalibrationModel(pairs)` **without** a
`priorByBand` argument (`validation-loop.ts:174,177,191,195`; `validation-loop-engine.ts:113`), so in
the loop the prior is always the uninformative band midpoint.

---

## 4. Quality metrics — Brier & ECE

Computed only when `realized.length > 0`, else both stay `null` (`employer-tig.ts:249-259`):

- **Brier score** (`:251`): `mean( (clamp01(predicted) − outcome)² )` over all pairs, on **RAW**
  predictions (the code comment notes an in-sample "calibrated" Brier would be optimistically biased,
  `:248`). Lower is better.
- **ECE — Expected Calibration Error** (`:252-258`): `Σ_b (sampleSize_b / N) · |observedRate_b −
  meanPredicted_b|`, summed over bands with `sampleSize > 0` and non-null `observedRate` /
  `meanPredicted`. It is the sample-weighted gap between empirical rate and mean prediction per band.

Both are rounded to 3 dp via `round3` (`employer-tig.ts:165`).

---

## 5. The TRUST status — cold_start / provisional / calibrated

The status is computed from the OWN outcome count **only** (`employer-tig.ts:226-229`):

```
status = realized.length === 0            ? 'cold_start'
       : realized.length < CALIB_MIN_OUTCOMES ? 'provisional'   // < 30
       : 'calibrated';                                          // >= 30
```

A borrowed E5 prior NEVER lifts the status (`:210` doc, `:224-225` comment). The status drives the
mapping `method` (`:263-271`):

| Status | Condition | `method` | Mapping applied by `calibrateProbability` |
|---|---|---|---|
| `cold_start` | `n === 0` | `identity` | raw === calibrated (no data) |
| `provisional` | `1 … 29` | `binned` | per-band α-smoothed `calibratedRate` |
| `calibrated` | `≥ 30` | `isotonic` | PAV isotonic curve (smoother, trusted) |

When and only when `calibrated`, the model fits an isotonic curve and overwrites each non-empty
band's `calibratedRate` with `isotonicAt(isotonic, meanPredicted)` so the displayed band rate matches
the live isotonic mapping (`employer-tig.ts:265-271`).

`calibrateProbability(rawProb, model)` (`employer-tig.ts:278-284`):
- `cold_start` (or no model) → returns `rawProb` (identity).
- `calibrated` with an isotonic curve → `round3(isotonicAt(model.isotonic, rawProb))`.
- otherwise (provisional) → the band's `calibratedRate`; if the band is empty / `null` → identity
  (honest: no data in this band).

---

## 6. Isotonic / PAV monotonic regression

`fitIsotonic(realized)` (`employer-tig.ts:174-189`) implements the **Pool-Adjacent-Violators
Algorithm**:

1. Empty input → `[]` (`:175`).
2. Map each pair to `{x: clamp01(predicted), y: outcome}` and **sort by x ascending** (`:176`).
3. Walk points left→right, pushing each as a singleton block `{sumX, sumY, w:1}` (`:178-179`).
4. While the previous block's mean `y` (`a.sumY/a.w`) exceeds the current block's mean `y`
   (monotonicity violated), **pool** the two adjacent blocks into one summed block (`:180-185`).
5. Output one breakpoint per pooled block: `{x: mean predicted, y: mean outcome}` (rounded 3 dp,
   `:188`).

The result is a **monotone non-decreasing** step/curve of breakpoints. `isotonicAt(curve, raw)`
(`:192-205`) clamps `raw` to `[0,1]`, returns the end `y` beyond the first/last breakpoint, and
otherwise **linearly interpolates** between the two surrounding breakpoints (`:197-204`). The isotonic
curve is in-memory only and **never persisted** (`employer-tig.ts:161` comment).

---

## 7. How the validation loop COMPOSES the engine

The loop is pure-compose; it never re-implements calibration.

**Step 1 — `toCalibrationPairs(rows)`** (`validation-loop-engine.ts:66-83`): converts recorded
`validation_loop_outcomes` rows into `{predicted, outcome}` pairs. Honest filters:
- non-`binary` `outcome_kind` rows skipped (`:69`);
- missing/empty prediction or outcome skipped (`:72`);
- non-finite values skipped (`:75`);
- `outcome_value` not exactly `0`/`1` skipped (`:76`);
- prediction outside `[0,1]` **dropped, never clamped** (`:77-79`).

The caller pre-filters demo vs realized (`validation-loop.ts:168-169,281-282`,
`r => !r.is_demo`).

**Step 2 — `buildCalibrationModel(pairs)`** — the REUSED engine, called with NO `priorByBand`
(`validation-loop-engine.ts:113`; `validation-loop.ts:174,177,191,195,285,286,297,298`).

**Step 3 — `calibrationSummary(model)`** (`validation-loop-engine.ts:86-105`): display-ready honest
projection exposing `status`, `total_outcomes`, `k_min` (=30), `remaining_to_calibrated =
max(0, k_min − totalOutcomes)` (`:91`), `brier`, `ece` (both `null` until ≥1 outcome, `:92-93`),
`method`, and ONLY the non-empty bands (`b.sampleSize > 0`, `:96`) mapped to
`{band, n, observed_rate, calibrated_rate, mean_predicted}`.

**Step 4 — three calibration axes in the status/calibration endpoints**
(`validation-loop.ts:172-220, 284-307`):

| Axis | Source pairs | Honesty meaning |
|---|---|---|
| `realized` | manual non-demo intake (`toCalibrationPairs(allRows)`, `:173`) | the evidence-backed manual axis |
| `connected` | `terminalCandidatesToPairs` over `employer_candidates` terminal rows (`:182-191`) | the MX-75X-connected hiring feeder (Hired=1/Rejected=0 + `predicted_prob_at_decision`, `@example.com` excluded) |
| `platform_realized` | union of realized + connected (`:194-195`) | the honest TOTAL evidence axis |
| `demo_illustrative` | demo pairs (`:176-177`) | proves the mechanism RUNS; NEVER evidence-backed |

**Step 5 — `evidenceVerdict(platformPairs.length)`** (`validation-loop-engine.ts:159-171`,
`validation-loop.ts:209`): `evidence_backed = realizedPairs >= VALIDATION_K_MIN`. Below `k_min` the
reason is `awaiting_outcomes` (0) or `insufficient_outcomes (n/30)`.

---

## 8. Coverage vs Confidence (separate axes)

| Axis | Status | Evidence |
|---|---|---|
| Engine exists & wired (Coverage) | ✅ yes | `buildCalibrationModel` (`employer-tig.ts:211-274`), imported by the loop (`validation-loop-engine.ts:22`) |
| Compose-path wired (Coverage) | ✅ yes | `toCalibrationPairs` / `calibrationSummary` / `terminalCandidatesToPairs` (`validation-loop-engine.ts:66,86,136`) |
| Realized non-demo outcomes | **0** | platform holds 0 realized non-demo outcomes today |
| Calibration-trust (Confidence) | **`cold_start`** | `realized.length === 0` → `cold_start`, identity map (`employer-tig.ts:226-229,263,279`) |
| Brier / ECE | **`null`** | computed only when `realized.length > 0` (`employer-tig.ts:249-259`) — `null` = missing, not `0` |
| Empirical accuracy | **ABSTAINED** | abstained until ≥30 realized non-demo pairs (`evidenceVerdict`, `validation-loop-engine.ts:159-171`) |

Disconnected substrates that EXIST but are reported only as **coverage counts** (not folded into
calibration) via `safeCount` — `career_outcomes`, `hiring_outcomes`, `interview_outcomes`,
`ti_outcome_predictions`, `tig_calibration`, `employer_candidates` terminal
(`validation-loop.ts:198-206,222-233`). `safeCount` returns `null` when a table is absent/unreadable
(honest coverage gap, `:57-65`).

---

## 9. Language policy & abstention note

`VALIDATION_LANGUAGE_POLICY` (`validation-loop-engine.ts:33-48`) confines this to **developmental
validation**: allowed claims are calibration TRUST status (`cold_start / provisional / calibrated`),
realized outcome counts/coverage, abstained prediction status, and model confidence
(reliability/consistency/evidence). **Disallowed:** empirical accuracy without realized outcomes,
hiring/promotion/suitability predictions, fabricated outcomes, and conflating model confidence with
empirical accuracy.

**Abstention:** as of this audit the platform holds **0 realized non-demo outcomes**, so every
realized-axis calibration is `cold_start`, `brier`/`ece` are `null`, and no accuracy %, outcome count,
or PASS is claimed. The framework is **structurally complete, empirically PENDING** — honest verdict
**PARTIAL (engine wired & composed, evidence PENDING until ≥30 realized non-demo outcomes accrue)**.
