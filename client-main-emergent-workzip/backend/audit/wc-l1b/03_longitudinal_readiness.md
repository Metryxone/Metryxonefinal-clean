# Deliverable 3 — Longitudinal Readiness (Outcome & Journey)
_Generated 2026-06-09T13:38:24.983Z_

Readiness of the Outcome and Journey levers as **longitudinal** signals — i.e. can the existing
trend layer (WC-L1) actually form a per-user trend from the newly-captured state? Each lever reports
its two INDEPENDENT axes (Coverage of captured state, and trend Feasibility/Confidence) — never
merged.

## Per-eligible-user feasibility (N=2)
- `user_65454b2b8b` — completed 2 · outcome-bearing 0 · journey 2 (routed 0) → outcome-trend not yet (needs ≥2) · journey-trend **possible**
- `user_4b262cc8a5` — completed 2 · outcome-bearing 1 · journey 2 (routed 1) → outcome-trend not yet (needs ≥2) · journey-trend **possible**

## Readiness vs the >85% target (honest)
| Lever | Capture coverage (sessions) | Trend-feasible users (≥2 pts) | >85%? |
|---|---|---|---|
| Outcome | 33.3% | 0/2 (0.0%) | ❌ |
| Journey | 33.3% routed | 0/2 non-degraded ≥2 (0.0%) | ❌ |

## Why the target is not met (real ceilings, surfaced not gamed)
1. **The returning-user population is tiny.** Only **2** users have ≥2 completed sessions, so every
   per-user longitudinal denominator is small regardless of engine quality.
2. **Outcome history is source-bounded.** With the behavioural spine empty for all sessions, an
   outcome only forms where a construct/concern crosswalk fires. No returning user has **two** such
   sessions, so outcome-trend coverage is honestly **0.0%** — the activation
   raised per-session capture (33.3% of completed sessions) but cannot
   manufacture a second comparable point that the data does not contain.
3. **Journey confidence is structurally low.** Journey now has ≥2 points for returning users, but most
   are degraded fallbacks (route_confidence 0.2), so a journey trend would read **stable / low
   confidence** — the honest reading, not a tuned one.

## Forward guarantee (no backfilled fabrication)
- The post-completion hook already resolves stage → outcome → journey for every new completed session
  behind `FF_WC3_OUTCOME` / `FF_WC3_JOURNEY` (both ON). Enabling `FF_WC3_OUTCOME_CROSSWALK` at
  runtime (currently OFF) would extend outcome capture to empty-spine sessions going forward — the
  same path this backfill used. **Recommended at approval; left OFF here (config change → stop for
  approval, no deploy).**
- As real returning users accrue ≥2 outcome-bearing sessions, outcome-trend coverage and confidence
  rise on their own. Nothing here is inflated to hit the target.
