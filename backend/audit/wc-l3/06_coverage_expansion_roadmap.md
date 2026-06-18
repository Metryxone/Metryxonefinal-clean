# WC-L3 Deliverable 6 — Coverage Expansion Roadmap
_Generated 2026-06-09T16:54:53.564Z_

Flags at run: `FF_WC3_OUTCOME`=ON, `FF_WC3_OUTCOME_CROSSWALK`=ON. Audit is READ-ONLY (no writes).

Outcome and forecast coverage are MEASURED under each scenario by mirroring the engine's construct
resolver against each outcome model's construct vocabulary. The **Journey coverage** column is a DERIVED
proxy (confident, non-fallback = outcome-backed), not independently executed — the journey engine's
Mentoring fallback would additionally route every remaining session as degraded (so "routed" is 9/9).
"Deterministic" = achievable from data on disk with existing code; "projected" = needs a new mapping
entry or spine generation (labelled, never claimed as measured).

| Scenario | Concern linked | Construct linked | Outcome coverage | Journey confident (derived) | Forecast coverage (eligible owners) | Cost |
|---|---|---|---|---|---|---|
| Baseline (stored) | 1/9 | 2/9 | 3/9 | 3/9 | 0/2 | — |
| **A — re-resolve concern (existing data+resolver)** | **9/9** | 2/9 | **9/9** | 9/9 | **2/2** | **lowest — offline re-resolve backfill** |
| B — 100% construct linkage | 1/9 | 9/9* | 9/9† | 9/9† | 2/2† | low — re-resolve + 4 new `CONCERN_TO_CONSTRUCT` entries (*projected) |
| C — 100% behavioural spine | 1/9 | 2/9 | ≤6/9‡ | ≤6/9‡ | depth-bound | **highest — wire hypotheses into `/respond`; 3 sessions un-backfillable** |
| D — combined (A+B+C) | 9/9 | 9/9* | 9/9 | 9/9 | 2/2 | sum of above |

Concern linkage in D is the deterministic re-resolve (9/9), NOT projected. * construct linkage to 100% requires 4 curated `CONCERN_TO_CONSTRUCT` additions (projected, not measured) — outcome/forecast in D do NOT exceed Scenario A because the master→bridge→crosswalk path already reaches the models.
† construct path is REDUNDANT with the concern path for outcome here — adding it does not raise outcome/forecast
beyond Scenario A, because the master→bridge→crosswalk hop already reaches these models.
‡ spine ceiling is 6/9 (3 zero-response sessions cannot generate evidence); and its outcome
contribution is redundant given A — the spine is one of THREE OR-paths to a construct.

## Which fix gives the largest lift
**Scenario A (concern re-resolve).** It moves concern linkage 1→9, outcome 3→9,
and forecast 0→2/2 — using ONLY data already on disk and the EXISTING resolver
(the WC-L2B backfill is already idempotent and would execute exactly this once linkage is restored). Construct
mapping (B) and spine wiring (C) are largely REDUNDANT for outcome/forecast given A.

## Shortest path to >90%
- **>90% concern linkage:** Scenario A alone → 100.0% (deterministic, existing data).
- **>90% forecast readiness (eligible owners):** Scenario A alone → 100.0%.
- The ONLY non-A residuals are 4 construct mapping gaps + 3 zero-response sessions; neither blocks the
  >90% targets above. The persistent ceiling is **longitudinal depth** (forecast needs ≥2 owned outcome-bearing
  sessions per user) — a data-accumulation limit, not a linkage defect.
