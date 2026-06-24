# MX-75X — Section 11: Super Admin Validation Surface

> **Status:** ACTIVATED (flag-gated). **Evidence:** PENDING (0 realized non-demo outcomes; k_min = 30).
> **Honesty contract:** every figure is read live from the validation-loop engine. Where data is
> absent, the surface shows "Insufficient Evidence" — it never fabricates an accuracy number.

## Purpose
The Super Admin surface is the **operator's window into the closed validation loop**. It answers one
question honestly: *is the loop running, and how much real-world evidence has accrued so far?* It is
read-only and composes the existing engine — it does not recompute calibration.

## Component
`frontend/src/components/superadmin/OutcomeValidationPanel.tsx`
- Mounted in `SuperAdminDashboard.tsx` (Reports group, nav id `outcome-validation`, icon `Target`).
- Visibility is **probe-gated**: the nav item appears only when `GET /api/validation-loop/status`
  returns `res.ok` (`outcomeValidationEnabled`). Flag-OFF → endpoint 503 → nav item hidden →
  byte-identical to pre-MX-75X console.

## Data sources (read-only)
| Endpoint | Surfaced |
|---|---|
| `GET /api/validation-loop/status` | loop steps, intake table presence + by-type counts, prediction abstention reason, engines wired, evidence verdict (`evidence_backed`, `realized_outcomes`, `k_min`), language policy |
| `GET /api/validation-loop/calibration` | four `CalibrationSummary` partitions: `realized`, `connected`, `platform_realized`, `demo_illustrative` (each: status `cold_start`/`provisional`/`calibrated`, `total_outcomes`, `remaining_to_calibrated`, `brier`/`ece` (null until calibrated), `method`, per-band table) |

## Honesty rules enforced in the UI
1. **Coverage ⟂ Confidence.** Intake counts (Coverage — "do outcomes exist?") are rendered in a
   separate block from calibration status (Confidence — "is the model calibrated?"). They are never
   merged into one score.
2. **Demo is quarantined.** The `demo_illustrative` partition is labelled and visually separated; it
   never contributes to the headline evidence verdict. Cert math excludes it.
3. **Null is null.** `brier`/`ece` render as "—" with an "Insufficient Evidence" badge until a
   partition reaches `calibrated` (≥ k_min realized outcomes). No placeholder zeros.
4. **Abstention is explicit.** When `prediction.abstained` is true, the panel shows the engine's own
   `reason` string verbatim ("evidence_backed false until ≥30 realized non-demo outcomes").

## Current honest state (dev / pre-deploy)
- Loop: **ACTIVATED** (all six steps wired; `validationLoop` default ON, `FF_VALIDATION_LOOP=0`
  reverts).
- Intake table present; **0** realized non-demo outcomes → every calibration partition `cold_start`.
- Evidence verdict: `evidence_backed = false`, `realized_outcomes = 0`, `remaining_to_calibrated = 30`.
- Brier / ECE: **not computed** (honest null).

## What changes when evidence accrues
As realized outcomes are connected (hiring/interview/career feeders + `predicted_prob_at_decision`),
the same panel — with no code change — will surface rising `total_outcomes`, then real Brier/ECE once
any partition crosses k_min. The transition from PARTIAL to evidence-backed is **data-driven**, not a
code edit.
