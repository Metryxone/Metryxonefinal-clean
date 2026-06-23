# Phase 7 — Validation Loop Evidence

_Generated 2026-06-23T19:56:29.869Z · k_min = 30_

Loop: Assessment → Hiring → Performance → Promotion → Retention → Outcome → Calibration → Prediction

## 1. Realized (non-demo) calibration — BEFORE
```json
{
  "summary": {
    "status": "cold_start",
    "total_outcomes": 0,
    "k_min": 30,
    "remaining_to_calibrated": 30,
    "brier": null,
    "ece": null,
    "method": "identity",
    "bands": []
  },
  "evidence": {
    "evidence_backed": false,
    "realized_outcomes": 0,
    "k_min": 30,
    "reason": "awaiting_outcomes — no realized outcomes recorded yet"
  }
}
```
→ Realized status: **cold_start**, evidence_backed: **false** (abstained — honest).

## 2. Recorded ONE demo outcome (is_demo=true, @example.com)
`hiring` · predicted_prob_at_decision=0.7 · realized outcome=1

## 3. Demo (illustrative) calibration — RUNS end-to-end
```json
{
  "status": "provisional",
  "total_outcomes": 1,
  "k_min": 30,
  "remaining_to_calibrated": 29,
  "brier": 0.09,
  "ece": 0.3,
  "method": "binned",
  "bands": [
    {
      "band": "b3",
      "n": 1,
      "observed_rate": 1,
      "calibrated_rate": 0.75,
      "mean_predicted": 0.7
    }
  ]
}
```
→ Demo status: **provisional** (provisional — mechanism works; NEVER evidence-backed).

## 4. Realized (non-demo) calibration — AFTER the demo
→ Realized outcomes: **0** (unchanged — demo is excluded from evidence). evidence_backed: **false**.

## 5. Honest ceiling
- The loop is STRUCTURALLY complete: intake → calibration engine → abstained prediction.
- Predictions remain ABSTAINED (no empirical accuracy claim) until ≥30 realized non-demo
  outcomes that carry a decision-time prediction accrue. This is an OUTCOME-ACCRUAL milestone,
  not a code milestone — no realized outcome is ever fabricated.
- Coverage (outcomes recorded) and Confidence (calibration trust) are reported SEPARATELY.

### Language policy
```json
{
  "purpose": "developmental_validation",
  "allowed": [
    "calibration trust status (cold_start / provisional / calibrated)",
    "realized outcome counts and coverage",
    "abstained prediction status",
    "model confidence (reliability / consistency / evidence)"
  ],
  "disallowed": [
    "empirical accuracy claims without realized outcomes",
    "hiring / promotion / suitability predictions",
    "fabricated or synthesized realized outcomes",
    "treating model confidence as empirical accuracy"
  ],
  "note": "Calibration is a TRUST axis; Coverage and Confidence are reported separately. No accuracy is claimed until realized outcomes accrue (≥ k_min)."
}
```

_Cleaned up 1 demo row(s). The validation_loop_outcomes table is left at its realized (0) baseline._
