# MX-75X — Section 15: Validation Certification

> ## VERDICT: **PARTIAL — LOOP ACTIVATED, EVIDENCE PENDING**
> The closed-loop intelligence architecture is **activated, connected, and honest**. Empirical
> validation (calibrated accuracy) is **deliberately withheld** until ≥ **30** realized non-demo
> outcomes accrue. This PARTIAL verdict is the *correct and honest* certification at this stage — a
> GO/evidence-backed certification now would be fabrication.

## Certification axes (scored independently — never composited into one number)

### Axis A — Loop activation (structural): **PASS**
- `validationLoop` flag default ON; `FF_VALIDATION_LOOP=0` reverts to byte-identical legacy.
- Six loop stages wired: Assessment → Prediction → Outcome → Validation → Calibration → Improved
  prediction.
- Intake (`validation_loop_outcomes`) present; `buildCalibrationModel` (Isotonic / Brier / ECE) live;
  `status` + `calibration` GETs serve all four partitions.
- Flag-OFF discipline: ensure-schema is POST-only; GETs use `to_regclass` probe; OFF path does **no**
  DDL and is byte-identical.

### Axis B — Connection (feeders): **PASS (wired) / PENDING (populated)**
- Feeders connected into loop status: `hiring_outcomes`, `interview_outcomes`, `career_outcomes`,
  `employer_candidates.predicted_prob_at_decision`; `terminalCandidatesToPairs` added.
- Populated with realized non-demo outcomes: **0** → connection is correct but dormant.

### Axis C — Persona surfaces (honest UI): **PASS**
- Super Admin (`OutcomeValidationPanel`), Employer (`HiringValidationPanel`), Candidate
  (`PredictionTrustTab`) all live, probe/flag-gated, frontend build-clean.
- Each enforces Coverage ⟂ Confidence, demo isolation, null-not-zero, and developmental-language
  policy. No persona surface presents a fabricated accuracy figure.

### Axis D — Evidence (empirical accuracy): **PENDING — by design**
- Realized non-demo outcomes: **0** (k_min = 30; `remaining_to_calibrated = 30`).
- Brier / ECE: **null** (not computed — honest).
- `evidence_backed = false`. **No accuracy is claimed.**

## Why PARTIAL is the honest ceiling
The architecture cannot earn an evidence-backed certification by code alone. Calibration requires
real-world realized outcomes that do not yet exist in non-demo form. Per the hard honesty constraint,
the cert **stays PARTIAL** until accrual reaches k_min — and it will then transition **without code
change**, driven purely by data.

## Path to full certification (data, not code)
1. Connect/record real hire, interview, promotion, retention, and career outcomes with the
   prediction made at decision time.
2. Accrue ≥ 30 realized non-demo outcomes (per partition for partition-level calibration).
3. `buildCalibrationModel` then emits real Brier/ECE; `evidence_backed` flips true; persona surfaces
   surface calibrated rates automatically.

## Honesty attestation
- No outcomes fabricated. No accuracy inflated. Demo data excluded from every cert axis.
- Null reported as null; absence reported as absence.
- Flag-OFF verified byte-identical (no DDL on OFF path).
