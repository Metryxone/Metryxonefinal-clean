# MX-75X · Section 10 — Role-DNA / Role-Readiness Validation Framework

**Task:** MX-75X-VALIDATION-LOOP-AND-OUTCOME-INTELLIGENCE-ACTIVATION
**Scope of this document:** Section 10 only. Read-only, evidence-based. **No code changed.**
**Date:** 2026-06-24
**Method:** Static code/route/schema inspection of the role-fit + hiring-outcome + calibration assets.
**Honesty-first:** Coverage and Confidence/Calibration-trust are reported as **SEPARATE axes**.
Nothing fabricated. `null` = missing, never a fabricated `0`.

---

## 0. Headline finding

**Role-fit / role-readiness predictions are PRODUCED and now CONNECTED to a realized hiring feeder,
but their empirical accuracy is EVIDENCE-PENDING.** The platform holds **0 realized non-demo
outcomes** today, so role-fit empirical accuracy is **ABSTAINED** until **≥ `VALIDATION_K_MIN` (30)**
realized non-demo binary outcomes carrying a decision-time prediction accrue
(`backend/services/validation-loop-engine.ts:28,159-171`). Outcome-accrual milestone, not a code
milestone.

The role-DNA loop is the **most fully connected** of the three frameworks because the MX-75X
connection wires the employer hiring pipeline directly into calibration:

- **Prediction (role fit / readiness)** — `computeReadinessIndex` and `computeSuccessProbability`
  (`backend/routes/employer-tig.ts:51-62,87-96`) produce per-role readiness `[0-100]` and per-role
  success probability `[0-1]`; persisted role-fit scores live in `role_fit_scores`
  (`backend/migrations/20260522_employability_knowledge_graph.sql:168-192`, band ∈
  `Strong/Stretch/Aspiration/Misaligned`). `role_success_probability` is also predicted by the
  talent engine (`backend/routes/talent-outcome-prediction.ts:121-124`).
- **Realized outcome (hiring/performance)** — the employer terminal decision (`Hired=1 / Rejected=0`)
  plus its `predicted_prob_at_decision` snapshot is mapped to `{predicted, outcome}` pairs by
  `terminalCandidatesToPairs` (`backend/services/validation-loop-engine.ts:136-153`), with demo
  `@example.com` rows excluded (`:139-140`). Additional substrates exist:
  `hiring_outcomes` / `interview_outcomes`
  (`20260522_employability_knowledge_graph.sql:225-249`).
- **Calibration (reused)** — `buildCalibrationModel` (`backend/routes/employer-tig.ts:211-274`):
  Isotonic/PAV, Beta-Binomial smoothing, Brier + ECE, status `cold_start → provisional →
  calibrated`; `calibrateProbability` applies it (`:278-284`). No new engine.

---

## 1. Evidence base

| Evidence | Source |
|---|---|
| Role-readiness index engine | `computeReadinessIndex` (`employer-tig.ts:51-62`) |
| Role success-probability engine | `computeSuccessProbability` (`employer-tig.ts:87-96`) |
| Persisted role-fit scores (+ band) | `role_fit_scores` (`20260522_employability_knowledge_graph.sql:168-192`) |
| Role-success prediction (talent engine) | `talent-outcome-prediction.ts:121-124` |
| Hiring feeder → pairs (MX-75X connection) | `terminalCandidatesToPairs` (`validation-loop-engine.ts:136-153`) |
| Realized hiring/interview substrates | `hiring_outcomes` / `interview_outcomes` (`20260522_…:225-249`) |
| Decision-time prob (employer pipeline) | `employer_candidates.predicted_prob_at_decision` (`validation-loop.ts:184-189`) |
| Calibration engine (reused) | `buildCalibrationModel` (`employer-tig.ts:211-274`); `calibrateProbability` (`:278-284`) |
| Status surface: realized / connected / platform | `calibration.{realized,connected,platform_realized}` (`validation-loop.ts:216-221`) |
| Global pooled prior (k-anon ≥2 orgs) | `buildGlobalCalibrationPrior` (`employer-tig.ts:286-309`) |
| Flag (default ON, reversible) | `validationLoop: true` (`feature-flags.ts:139`), reverse `FF_VALIDATION_LOOP=0` |
| Honesty / abstention | `evidenceVerdict` (`validation-loop-engine.ts:159-171`); language policy (`:33-48`) |

---

## 2. How role-fit predictions map to realized outcomes

1. **Snapshot the role-fit prediction at decision time.** The per-role success probability
   (`computeSuccessProbability`, `employer-tig.ts:87-96`) is captured as
   `predicted_prob_at_decision` when an employer makes a hiring decision.
2. **Observe the realized hiring/performance outcome.** A terminal employer-candidate stage
   (`Hired` / `Rejected`) is the realized binary outcome; `terminalCandidatesToPairs` maps
   `Hired→1`, `Rejected→0` and drops out-of-range/missing predictions (never clamps)
   (`validation-loop-engine.ts:142-150`). Demo `@example.com` rows are excluded (`:139-140`).
3. **Three honest evidence tiers** are reported separately (`validation-loop.ts:216-221`):
   - `realized` — manual intake (non-demo).
   - `connected` — the employer hiring feeder pairs.
   - `platform_realized` — their **union** (the honest total evidence axis).
4. **Calibrate.** `buildCalibrationModel` produces per-band observed vs predicted hire rates,
   Brier + ECE, and an isotonic mapping only at `calibrated` (`employer-tig.ts:226-273`). Thin orgs
   may borrow a k-anonymous global prior (`buildGlobalCalibrationPrior`, `:286-309`) — which lends
   strength but **never** lifts the TRUST status (`:288`).
5. **Apply + report.** `calibrateProbability` maps raw → calibrated (identity at `cold_start`)
   (`:278-284`); accuracy is reported only at `calibrated`.

---

## 3. Coverage vs Confidence (reported SEPARATELY)

| Axis | What it measures | Current honest value | Source |
|---|---|---|---|
| **Coverage** | Role-fit predictions persisted | `role_fit_scores` rows exist (per user/occupation) | `20260522_…:168-192` |
| **Coverage** | Realized hiring outcomes wired | `employer_candidates_terminal`, `hiring_outcomes`, `interview_outcomes`; `null` if absent | `validation-loop.ts:198-206,232` |
| **Coverage** | Connected feeder pairs | `coverage.connected_realized` / `platform_realized` | `validation-loop.ts:223-233` |
| **Confidence (calibration-trust)** | Role-fit empirical trustworthiness | `cold_start` at 0 realized pairs (identity) | `employer-tig.ts:226-229,278-279` |
| **Empirical accuracy** | Realized role-fit hit-rate | **ABSTAINED** (0 realized non-demo outcomes) | `validation-loop-engine.ts:159-171` |

**Independent axes.** A connected hiring feeder proves the on-ramp works (Coverage); it does NOT by
itself confer accuracy (Confidence/Accuracy) — that requires ≥ 30 realized non-demo pairs. Brier/ECE
are `null` until ≥1 realized outcome (`employer-tig.ts:249-259`).

---

## 4. The calibration path (fixed vocabulary)

| Status | Trigger | Mapping | Role-DNA meaning |
|---|---|---|---|
| `cold_start` | 0 realized pairs | identity (`calibrateProbability` `:279`) | directional role-fit only; abstained |
| `provisional` | 1 … 29 realized pairs | α-smoothed band rate (`:281-283`) | mostly prior; NOT trusted as validated |
| `calibrated` | ≥ 30 realized pairs | isotonic / PAV (`:280`) | empirically calibrated; role-fit accuracy reportable |

Vocabulary is ONLY `cold_start / provisional / calibrated` (`employer-tig.ts:154-162`). **Never**
claim `calibrated` below k_min=30 (`employer-tig.ts:145,226-229,265`).

---

## 5. What exists vs what is pending

- **Working:** role-readiness + role-success engines, persisted `role_fit_scores`, the MX-75X
  hiring feeder connection (`terminalCandidatesToPairs`), the reused calibration engine, the
  k-anonymous global prior, and the three-tier (`realized`/`connected`/`platform_realized`) honest
  status surface.
- **Disconnected substrates that EXIST:** `hiring_outcomes`, `interview_outcomes`
  (`20260522_…:225-249`) appear in coverage but are **not** yet mapped into calibration pairs — the
  pairs come from manual intake + the employer terminal feeder (`validation-loop.ts:173-195`). Their
  pair-mapping is **UNVERIFIED**; reported as coverage only, never accuracy.
- **Pending (outcome-accrual, not code):** ≥ 30 realized non-demo `Hired/Rejected` (or
  performance) outcomes carrying a decision-time role-fit prediction.

---

## 6. Honesty / abstention note (binding)

- **No fabricated accuracy %, hire counts, or results.** The platform has **0 realized non-demo
  outcomes**; role-fit empirical accuracy is **ABSTAINED** until ≥ 30 accrue
  (`validation-loop-engine.ts:28,159-171`).
- **Coverage ≠ Confidence ≠ Accuracy** — separate axes, reported separately. `null` = missing, never
  a fabricated `0`.
- **Language policy** (`validation-loop-engine.ts:33-48`): developmental validation ONLY. This
  framework describes **calibration trust and realized-outcome coverage** for role fit — it makes
  **no** hiring / promotion / suitability prediction claim, and model confidence is never treated as
  empirical accuracy.
- **Demo exclusion:** `is_demo = true` / `@example.com` rows are EXCLUDED from every evidence-backed
  claim (`validation-loop-engine.ts:139-140`; `20260623_validation_loop_outcomes.sql:6-12`).
- **Verdict:** honestly **PARTIAL (role-fit feeder connected, evidence PENDING)** — no PASS and no
  role-fit accuracy figure before the outcome-accrual milestone is met.
