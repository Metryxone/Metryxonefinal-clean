# Section 9 — Validation Intelligence (Validation Loop) Certification

**Verdict: DORMANT-BY-DESIGN (front-half PASS; back-half unfed → NO accuracy claimable).**

This is the platform's **honesty anchor**. The Validation Loop (MX-100X Phase 7) exists to convert
realized real-world outcomes into calibration evidence. It currently holds **zero outcomes**, and the
system **correctly refuses to claim any predictive accuracy** anywhere as a result.

## 9.1 Evidence
| Table | Count |
|---|---:|
| validation_loop_outcomes | **0** |
| tig_calibration | 5 (<30 → uncalibrated) |
| m5_organizational_forecast_accuracy / m5_simulation_accuracy_tracking | 0 |
| eios_outcome_tracking | 0 |

## 9.2 Front-half intake — PASS
- The realized-outcome intake (`validation_loop_outcomes`) **composes** the existing
  `buildCalibrationModel` rather than introducing a parallel calibration path.
- Flag `validationLoop` is byte-identical OFF including schema (ensureSchema POST-only; GET uses a
  `to_regclass` probe). `toCalibrationPairs` **drops** out-of-[0,1] values (never clamps), and
  `is_demo` rows are excluded from every metric.

## 9.3 Abstention discipline — PASS (this is the point)
- Abstention is **by accrual, not by code switch**: `evidence_backed` stays false until **≥30
  realized, non-demo outcomes** accrue. There is no way to "turn on" accuracy without real outcomes —
  exactly the desired property. (Terminology: this section's verdict is **DORMANT-BY-DESIGN** because
  outcomes = 0 today; the Validation Loop's *own* evidence-backed flag will move from abstaining toward
  evidence-backed only as real outcomes accrue.)
- Consequence platform-wide: TIG calibration (5) reads uncalibrated; employer fit is WITHHELD; m5/EIOS
  forecast-accuracy tables are empty; **no model anywhere reports an accuracy number.** This is the
  single most important honesty guarantee in the whole certification.

## 9.4 Confidence vs Coverage
- **Coverage:** intake mechanism armed and reachable. **Confidence:** zero — no realized outcomes
  exist, so no calibration, no accuracy, no validated prediction.

## 9.5 Certification table
| Sub-area | Verdict | Evidence |
|---|---|---|
| Outcome intake mechanism | PASS | composes buildCalibrationModel, demo-excluded, drop-not-clamp |
| Flag / schema discipline | PASS | byte-identical OFF, GET probe-only |
| Realized outcomes (Usage) | FAIL (0) | validation_loop_outcomes = 0 |
| Accuracy claims | NONE (correct) | platform-wide abstention enforced by accrual |

**Net: DORMANT-BY-DESIGN.** This is not a defect — it is the mechanism that keeps every other section
honest. It "activates" only when real outcomes flow. Until then, treat every predictive surface as
**directional, not validated.**
