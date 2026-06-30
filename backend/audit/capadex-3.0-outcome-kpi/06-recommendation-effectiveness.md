# CAPADEX 3.0 · Phase 1.6 — Recommendation → Outcome Effectiveness

> Deliverable 06 · Generated 2026-06-30T14:35:35.480Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:8d7228dfcd7b, written 2026-06-30T14:35:35.479Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

The recommendation→outcome link. The SUBSTRATE is MEASURED; effectiveness is WIRED via REUSE of the validation-loop calibration mechanism, but the calibrated **effectiveness_rate is ABSTAINED (null)** until ≥ k_min real prediction+outcome pairs accrue — a rate before then would be fabricated (Confidence axis ⟂ Coverage). `—` = unreadable/abstained, a numeric `0` = measured-empty.

| Signal | Value |
|---|---|
| Recommendation substrate rows (non-null subject) | 0 |
| Distinct recommendation subjects | — |
| Realized outcomes (canonical ledger, non-demo) | 0 |
| Calibrated effectiveness rate (per-channel) | — (abstained) |
| Calibrated? | false |

_Substrate counts are MEASURED (Coverage); per-channel effectiveness_rate stays null because the decision-time prediction is recorded loop-level (validation_loop_outcomes), not per recommendation/intervention row — see the loop-level `calibration` block. Confidence⟂Coverage, null≠0._

### Loop-level effectiveness — WIRED via REUSE (formerly GAP-O1)

The recommendation/intervention → outcome effectiveness link is now WIRED end-to-end by REUSING the EXISTING validation-loop calibration mechanism (no new engine/table/DDL). It abstains honestly (status `cold_start`/`provisional` → rate `—`) until ≥ k_min real non-demo prediction+outcome pairs accrue, then flips to `calibrated` and the rate lights up automatically. null ≠ 0; nothing fabricated.

| Signal | Value |
|---|---|
| Calibration status | cold_start |
| Prediction+outcome pairs used | 0 |
| k_min (calibrated threshold) | 30 |
| Remaining to calibrated | 30 |
| Brier / ECE | — / — |
| Loop-level effectiveness rate | — |

_Loop-level effectiveness READ through the EXISTING validation-loop calibration mechanism (recordValidationOutcome captures predicted_prob_at_decision; calibrationFromRows calibrates with a k_min gate). status cold_start/provisional → effectiveness_rate null (Confidence axis, abstained, NEVER fabricated); flips to calibrated + a real rate only when ≥ k_min non-demo prediction+outcome pairs accrue. No engine invoked; zero DDL._
