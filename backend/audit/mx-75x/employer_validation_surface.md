# MX-75X — Section 12: Employer Validation Surface

> **Status:** ACTIVATED (employer session-gated). **Evidence:** PENDING (calibration cold-start).
> **Honesty contract:** hiring-prediction confidence is shown as calibration STATE, never as a
> hire/no-hire verdict. Decision-support language only.

## Purpose
Employers need to know **how much to trust the platform's hiring-related predictions** before acting
on them. This surface exposes the calibration state of the Talent Intelligence Graph honestly: when
the model is uncalibrated it says so, and it borrows a global prior only with an explicit
`usingGlobalPrior` flag.

## Component
`frontend/src/components/employer/HiringValidationPanel.tsx`
- Mounted in `EmployerPortalPage.tsx` (Advanced Modules, TabId `hiring-validation`, icon `Target`).
- Consumes `GET /api/employer/tig/readiness` (employer-session auth).
- **Flag-gated for byte-identical OFF:** the nav item and render switch are guarded by a probe of
  `GET /api/validation-loop/enabled` (persona-agnostic flag probe; `flagGate`-only). When
  `validationLoop` is OFF the probe 503s → the tab is hidden → the employer portal is byte-identical
  to its pre-MX-75X state.

## Data surfaced (read-only, from `tig/readiness`)
- `structuralReadiness` / `activationReadiness` / `gap` — Coverage axis (is the graph built and live?).
- `calibration`: `status` (cold_start/provisional/calibrated), `totalOutcomes`, `method`,
  `brier`/`ece`, `usingGlobalPrior`, per-band table (`sampleSize`, `positives`, `observedRate`,
  `calibratedRate`, `meanPredicted`, `priorSource`).
- `data`: tables / nodes / edges / intelligenceSnapshots / clusters (substrate counts).
- `lastBuiltAt`, `checks`.

## Honesty rules enforced
1. **Coverage ⟂ Confidence.** Structural/activation readiness (Coverage) is rendered apart from
   calibration status (Confidence). A fully-built graph with zero realized outcomes is shown as
   *built but uncalibrated* — not as "ready".
2. **Borrowed prior never upgrades trust.** When `usingGlobalPrior` is true, the band table shows
   `priorSource` per band and the calibration status stays `cold_start`/`provisional`; a borrowed
   prior never reads as `calibrated`.
3. **Decision-support, not verdict.** Copy frames outputs as developmental/decision-support signals;
   no STRONG_HIRE/NO_HIRE phrasing is introduced by this surface. (The legacy heuristic path is left
   untouched and is a separate entity.)
4. **k ≥ 30 cohort suppression.** Bands below sample threshold show their `sampleSize` and remain
   `cold_start`; observed/calibrated rates are not promoted to confident figures.

## Current honest state (dev / pre-deploy)
- Calibration: `cold_start`, `totalOutcomes = 0`, `usingGlobalPrior` likely true, `brier`/`ece` null.
- Graph substrate present but dormant (0 employer realized outcomes) → fit **WITHHELD**, match falls
  back to heuristic, calibration **uncalibrated**. This is the honest dormant ceiling.

## What changes when evidence accrues
As employers record real hire/reject decisions with `predicted_prob_at_decision`, `totalOutcomes`
rises; once a band crosses k=30 with real (non-borrowed) outcomes, that band flips to `calibrated`
and surfaces real observed-vs-predicted rates — same panel, no code change.
