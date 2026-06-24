# MX-75X · Section 1 — Validation & Outcome Intelligence Current-State Audit

**Task:** MX-75X-VALIDATION-LOOP-AND-OUTCOME-INTELLIGENCE-ACTIVATION
**Scope of this document:** Section 1 only. Read-only, evidence-based. No code changed.
**Date:** 2026-06-24
**Method:** Static code/route/schema inspection + memory of the Phase-7 validation-loop build.
**Honesty-first:** Coverage (asset exists / wired) and Confidence/Activation (live + evidence-backed)
are reported as SEPARATE axes. Nothing fabricated.

---

## 0. Headline finding

**The closed-loop architecture already EXISTS end-to-end in code — it is DORMANT and UNSURFACED,
and it cannot be "made accurate" by code.**

The full chain `Assessment → Prediction → Outcome → Validation → Calibration → Improved Prediction`
is structurally present:

- **Prediction** (front): deterministic engines already produce predictions
  (`talent-outcome-prediction.ts` sigmoid models; `employer-tig.ts` success-probability; readiness/EI).
- **Outcome intake** (the once-missing link): `validation_loop_outcomes` table + `POST
  /api/validation-loop/outcomes` already exist (Phase 7), accepting hiring/performance/promotion/
  retention realized outcomes each carrying a decision-time `predicted_prob_at_decision`.
- **Calibration** (back): `buildCalibrationModel` (Isotonic/PAV regression, Beta-Binomial smoothing,
  Brier + ECE) already exists in `employer-tig.ts`; the validation loop COMPOSES it via
  `services/validation-loop-engine.ts` (`toCalibrationPairs`).

**Three real gaps (all "activate/connect", none "rebuild"):**

1. **Activation is OFF and not durable.** `validationLoop` defaults `false`
   (`feature-flags.ts:135`); the three routes 503 when OFF. Like the career suite, it is only ever
   enabled by a runtime `FF_*` env that is lost on a plain restart.
2. **Outcome feeders are not connected.** Realized outcomes already live in other tables
   (`hiring_outcomes`, `interview_outcomes`, `career_outcomes`, and
   `employer_candidates.predicted_prob_at_decision`) but nothing routes them INTO the validation
   loop's coverage/calibration view. The intake exists; the on-ramps from existing data do not.
3. **No surface.** Phase 7 deliberately shipped no frontend ("the status endpoint IS the honest
   surface") because all data is zero by definition. MX-75X's UI sections (11–13) are net-new
   honest read surfaces.

**The hard honesty constraint (cannot be engineered away):** predictions stay `abstained` /
`evidence_backed=false` until **≥30 realized NON-demo binary outcomes that carry a decision-time
prediction** accrue (platform `k_min`/`VALIDATION_K_MIN=30`). No additive code reaches PASS — this
is an **outcome-accrual milestone**. The certification verdict therefore stays honestly **PARTIAL
(loop ACTIVATED, evidence PENDING)**. Fabricating a PASS or any accuracy % is prohibited.

---

## 1. Evidence base

| Evidence | Source |
|---|---|
| Validation loop intake + status + calibration routes | `backend/routes/validation-loop.ts` (POST `/outcomes`, GET `/status`, GET `/calibration`) |
| Pure compose helpers | `backend/services/validation-loop-engine.ts` (`toCalibrationPairs`, `VALIDATION_K_MIN=30`) |
| Calibration engine | `backend/routes/employer-tig.ts` (`buildCalibrationModel`, `calibrateProbability`, Brier/ECE, PAV) |
| Prediction engines | `backend/routes/talent-outcome-prediction.ts` (6 prediction types), `employer-tig.ts` (success_prob) |
| Outcome tables | `validation_loop_outcomes` (20260623), `career_outcomes` (20260618), `hiring_outcomes`/`interview_outcomes` (20260522 employability_graph) |
| Flag default + helper | `feature-flags.ts:135` (`validationLoop:false`), `:1913` (`isValidationLoopEnabled`) |
| Registration | `backend/routes.ts:208` (import), `:13806` (register, `concernsPool`) |
| Frontend | no validation panel exists (`rg` for validation-loop/validation-dashboard → none) |

---

## 2. Component-by-component audit

Legend — **Status**: ✅ Working · 🟡 Connected-but-dormant · 🔌 Disconnected · 💤 Unsurfaced.
**Coverage** = asset exists & wired. **Activation** = live + evidence-backed.

| Component | Asset | Status | Coverage | Activation | Note |
|---|---|---|---|---|---|
| Prediction (talent) | `talent-outcome-prediction.ts` | ✅ | yes | deterministic | predicts 6 types; no realized validation yet |
| Prediction (employer) | `employer-tig.ts` success_prob | ✅ | yes | deterministic | runs `calibrateProbability` (curve empty → identity) |
| Outcome intake | `validation_loop_outcomes` + POST | 🟡 | yes | **OFF** | flag default false → 503; ensure-schema POST-only |
| Calibration engine | `buildCalibrationModel` | ✅ | yes | provisional | Isotonic/Brier/ECE; cold_start until k≥30 |
| Hiring outcomes | `hiring_outcomes`, `interview_outcomes` | 🔌 | yes | not fed in | exist in employability graph; not routed to the loop |
| Career outcomes | `career_outcomes` | 🔌 | yes | not fed in | candidate-side milestones; not routed to the loop |
| Decision-time prob | `employer_candidates.predicted_prob_at_decision` | 🔌 | yes | not fed in | the exact `{predicted, outcome}` pair source |
| Validation status | GET `/status`, `/calibration` | 🟡 | yes | OFF | honest all-zero surface; the only existing UI |
| Frontend surfaces | — | 💤 | none | none | no admin/employer/candidate validation UI |

---

## 3. Classification (as the task requests)

- **Working:** prediction engines (talent + employer), calibration engine (Brier/ECE/Isotonic),
  validation-loop intake + status/calibration endpoints, the compose helpers.
- **Disconnected:** `hiring_outcomes`, `interview_outcomes`, `career_outcomes`,
  `employer_candidates.predicted_prob_at_decision` — realized data that should feed the loop but
  currently does not.
- **Unused / unsurfaced:** the entire validation-loop subsystem (flag OFF) and any frontend.
- **Missing links:** (a) durable activation; (b) on-ramps from existing outcome tables into the
  loop's coverage/calibration; (c) honest persona UIs.

---

## 4. What MX-75X will do (and will NOT do)

**Will (activate + connect + document + surface, all additive/reversible/flag-gated):**
- Make `validationLoop` activation durable (same pattern as the career suite flag).
- Connect existing outcome feeders into the loop's READ (coverage/calibration) — read-only,
  `is_demo`-excluded, no fabricated rows.
- Add honest persona read surfaces that show "Insufficient Evidence" until k_min met.
- Produce Sections 2–15 docs + founder report + honest certification.

**Will NOT:**
- Add a new calibration/prediction/confidence engine (compose the existing one).
- Seed or synthesize realized outcomes (demo rows only ever prove the mechanism RUNS).
- Claim any accuracy %, or a PASS, before ≥30 realized non-demo outcomes accrue.
- Change flag-OFF behaviour (byte-identical, incl. schema).
