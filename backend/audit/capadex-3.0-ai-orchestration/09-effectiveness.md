# CAPADEX 3.0 · Phase 1.7 — Recommendation / Intervention → Outcome Effectiveness

> Deliverable 09 · Generated 2026-06-30T15:05:09.697Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:88fda7ccb736, written 2026-06-30T15:05:09.695Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

The recommendation/intervention→outcome link. The SUBSTRATE is MEASURED; effectiveness is WIRED via REUSE of the validation-loop calibration mechanism, but the calibrated **effectiveness_rate is ABSTAINED (null)** until ≥ k_min real prediction+outcome pairs accrue — a rate before then would be fabricated (Confidence axis ⟂ Coverage). `—` = unreadable/abstained, a numeric `0` = measured-empty.

| Signal | Value |
|---|---|
| Recommendation substrate rows (non-null subject) | 0 |
| Distinct recommendation subjects | — |
| Intervention substrate rows (non-null subject) | 0 |
| Distinct intervention subjects | 0 |
| Realized outcomes (canonical ledger, non-demo) | 0 |
| Recommendation effectiveness rate | — (abstained) |
| Intervention effectiveness rate | — (abstained) |

_Recommendation→outcome EFFECTIVENESS. Substrate (recommendations, interventions, realized outcomes) is MEASURED (Coverage); loop-level calibrated effectiveness is WIRED via REUSE of the validation-loop calibration mechanism (`calibration` block) and abstains honestly (cold_start, rate null) until ≥ k_min real prediction+outcome pairs accrue — Confidence axis, null≠0, never fabricated. Demo subjects excluded. No engine is invoked; zero DDL._

### Loop-level effectiveness — WIRED via REUSE

The recommendation/intervention → outcome effectiveness link is WIRED end-to-end by REUSING the EXISTING validation-loop calibration mechanism (no new engine/table/DDL). It abstains honestly (status `cold_start`/`provisional` → rate `—`) until ≥ k_min real non-demo prediction+outcome pairs accrue, then flips to `calibrated` and the rate lights up automatically. null ≠ 0; nothing fabricated.

| Signal | Value |
|---|---|
| Calibration status | cold_start |
| Prediction+outcome pairs used | 0 |
| k_min (calibrated threshold) | 30 |
| Remaining to calibrated | 30 |
| Brier / ECE | — / — |
| Loop-level effectiveness rate | — |

_Loop-level effectiveness READ through the EXISTING validation-loop calibration mechanism (recordValidationOutcome captures predicted_prob_at_decision; calibrationFromRows calibrates with a k_min gate). status cold_start/provisional → effectiveness_rate null (Confidence axis, abstained, NEVER fabricated); flips to calibrated only when ≥ k_min non-demo pairs accrue. No engine invoked; zero DDL._
