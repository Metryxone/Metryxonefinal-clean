# Deliverable 2 — Journey State Audit (`wc3_journey_state`)
_Generated 2026-06-08T16:54:03.604Z_

## 1. Why Journey state is not being persisted
**The same persistence-path gap as Outcome (reason (a)).** `resolveSessionJourney` is wired into
`postCompletionHooks` gated on `isWc3JourneyEnabled()` (`FF_WC3_JOURNEY`, **ON** in the workflow),
but it has produced no rows for the 9 pre-existing completed sessions (newest 7d old)
and there is no backfill script. Unlike Outcome, Journey has **no data ceiling** —
`resolveSessionJourney` **always persists a route** (deterministic Mentoring fallback when nothing
activates). So 0 rows here is purely "no completion has driven the hook (or it ran silently) + no
backfill", which isolates reason (a) cleanly.

## 2. Do persistence hooks already exist?
**Yes.** `resolveSessionJourney` (UPSERT on `session_id`) + `wc3_journey_candidates`, read path
`getSessionJourney`, GET `/api/capadex/session/:id/journey`. Route corpus `wc3_journey_routes` =
**6** (seeded). The invariant "no session is ever routeless" is implemented.

## 3. Is backfill possible using existing intelligence?
**Yes — 9/9 sessions routable — BUT every route would be DEGRADED.**
Journey scores routes from the session's ACTIVE outcome models (`wc3_outcome_state`). Because Outcome
is empty (Deliverable 1), `buildJourney` finds no activated models → falls back to the deterministic
Mentoring route at the honest low-confidence floor (`route_confidence ≈ 0.2`, `degraded: true`) for
EVERY session. So a backfill produces rows, but they carry a default route, not real routing
intelligence. **Journey quality is bounded by Outcome** — fixing Journey meaningfully requires fixing
Outcome first.

## Coverage
- Journey State Coverage = **0/9 = 0.0%**.
- Post-backfill projection: **9/9 routed**, of which **9/9 degraded** (until Outcome populated).

> **Honest note:** A journey backfill is safe and trivially feasible, but reporting it as "coverage
> achieved" would overstate value — degraded fallback routes are not differentiated intelligence.
