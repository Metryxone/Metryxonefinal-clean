---
name: Validation Loop (MX-100X Phase 7)
description: Front-half realized-outcome intake that composes the EXISTING calibration engine and abstains until k_min — the structural close of Assessment→…→Calibration→Prediction.
---

# Validation Loop — Phase 7 (structural, outcome-pending)

The evidence loop is `Assessment → Hiring → Performance → Promotion → Retention → Outcome →
Calibration → Prediction`. The back-half already existed (`buildCalibrationModel`/`calibrateProbability`
in `routes/employer-tig.ts`, `competency-confidence-engine.ts`, `talent-outcome-prediction.ts`,
`pil/prediction-validation.ts`). The ONLY genuinely missing piece was a unified front-half realized-
OUTCOME intake. Phase 7 adds exactly that and COMPOSES the back-half — it does NOT add a new
calibration/prediction/confidence engine.

## Rules (never regress)
- **Compose, never rebuild.** The pure engine (`services/validation-loop-engine.ts`) only turns recorded
  rows into `{predicted, outcome}` pairs and calls the EXISTING `buildCalibrationModel`. `VALIDATION_K_MIN
  =30` mirrors the NON-exported `CALIB_MIN_OUTCOMES` (platform k_min). No circular import: engine →
  employer-tig only (employer-portal imports FROM employer-tig, never the reverse).
- **Abstain by accrual, not by code.** Predictions stay `abstained` / `evidence_backed=false` until ≥30
  realized NON-demo binary outcomes that carry a decision-time prediction accrue. This is an
  outcome-accrual milestone; no additive code can reach PASS. The cert verdict STAYS PARTIAL.
- **Honesty axes separate.** Coverage (outcomes recorded) and Confidence (calibration trust) are reported
  separately. `is_demo` rows are EXCLUDED from realized/evidence-backed claims (mirrors `career_outcomes`).
  `null = missing`, never a fabricated 0. NEVER seed/synthesize realized outcomes — demo rows (cleaned up)
  only prove the mechanism RUNS.

## Byte-identical-OFF (incl. schema)
Flag `validationLoop` / `FF_VALIDATION_LOOP`, default OFF. `flagGate` is the FIRST middleware on all three
routes → 503 when OFF. `ensureSchema` (the only DDL) lives ONLY on the POST path, so OFF never creates the
table. GET handlers use a `to_regclass` probe + read-only selects (DDL on a GET would violate the
read-never-writes rule). Auth: intake + admin GETs are `requireSuperAdmin` (subject is operator-supplied →
requireAuth-only would be IDOR).

## Traps
- `toCalibrationPairs` DROPS (never clamps) rows that aren't binary 0/1, lack a finite prediction, or whose
  prediction is outside [0,1] — clamping would silently coerce a malformed backfill row into valid evidence.
- `ON CONFLICT (outcome_type, ref_id) WHERE ref_id IS NOT NULL DO UPDATE` — the conflict target MUST repeat
  the partial-index predicate or PG can't match the index. Rows with NULL `ref_id` don't dedup (by design).
- No frontend panel: the data is all-zero by definition, so the admin `GET /api/validation-loop/status`
  endpoint IS the honest surface (deliberate scope decision).
