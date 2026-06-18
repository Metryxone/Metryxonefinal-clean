# WC-L2 Deliverable 5 — Forecast Activation Roadmap
_Generated 2026-06-09T15:43:51.350Z_

The engine is built, read-only, and flag-gated. Activation is sequenced so each step is additive and
reversible, and so the (data-bound) ceiling lifts before any forecast is surfaced to users.

## Stage 0 — Foundation (this deliverable) ✅
- Forecast engine + flag in place; composes existing trends only; no writes, no new model.
- Audit proves the engine is correct and quantifies the honest data ceiling.

## Stage 1 — Lift the data ceiling (prerequisite, data not code)
- The single biggest lever is **repeat sessions per identified owner** — a forecast needs ≥2, and
  confidence only leaves the floor at 4. Encourage re-assessment cadence; attribute sessions to a stable
  owner identity so anonymous completions become forecastable.
- Ensure the behaviour `risk`/`engagement`/etc. dimensions are captured on every session (WC-L0/L0E)
  so behaviour-backed forecasts (Risk) have two readable points.

## Stage 2 — Read surface (additive, flag-gated)
- Expose a read-only `GET /api/capadex/session/:id/forecast` (or user-scoped) that returns
  `computeUserForecasts`. Flag OFF → `{enabled:false}`. No new write path.

## Stage 3 — Surface in existing reports (additive)
- Attach the forecast block to the existing stakeholder/longitudinal report sections, always labelled
  with its confidence band; suppress low-confidence forecasts behind an explicit "provisional" treatment.

## Stage 4 — Optional persistence (only if a consumer needs it)
- If a non-derivable read is needed, persist forecasts via a backfill mirroring WC-L1 — but only after
  Stage 1, since persisting floor-confidence forecasts adds no value over deriving them on read.
