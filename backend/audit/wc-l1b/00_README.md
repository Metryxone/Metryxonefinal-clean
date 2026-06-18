# WC-L1B — Outcome & Journey State Activation (MEASURED)
_Generated 2026-06-09T13:38:24.983Z_

Activates the two longitudinal levers that had no usable history — **Outcome** (`wc3_outcome_state`
was **0 rows**) and **Journey** (`wc3_journey_state` existed but every row was a **degraded**
fallback) — by replaying the **outcome → journey** halves of the EXISTING post-completion resolver
chain over completed sessions (stage is **consumed** from its already-persisted state, never
re-resolved). It REUSES the existing engines: **no new ontology, construct, or outcome model**. Empty-spine sessions reach an outcome only through the existing WC-10 Lever-1 clarity-bank
crosswalk (`FF_WC3_OUTCOME_CROSSWALK`); sessions with no construct AND no mapped concern stay
honestly **unclassified** (nothing written).

Two INDEPENDENT axes, reported separately and never merged:
- **Coverage** — does the state now exist (per session / per eligible user)?
- **Confidence** — is that state sufficient + trustworthy enough to support a *trend* (≥2 comparable
  points per user; degraded / low-confidence points surfaced, not smoothed)?

## Population
- Completed sessions: **9** (of which anonymous / no-email: **4**)
- Emailed users (≥1 completed session): **3**
- **Trend-eligible users** (≥2 completed sessions — the only population a per-user trend can exist for): **2**

## Headline — capture vs trend-feasibility (two axes)
| Lever | Capture coverage (sessions) | Mean confidence | Trend-feasible users (≥2 points) |
|---|---|---|---|
| Outcome | **3/9 (33.3%)** · 7 model rows | 0.66 | **0/2 (0.0%)** |
| Journey | **3/9 routed (33.3%)**, 6 degraded | 0.41 | **2/2 (100.0%)** |

## Honest ceiling (why capture ≠ trends)
Capturing per-session state is necessary but **not sufficient** for a per-user trend. A trend needs
≥2 sessions *that carry the state* for the SAME returning user:
- **Outcome trends — 0/2 eligible users.** Of the 2 returning users, none has
  two completed sessions that both reach an outcome: the behavioural spine
  (composites / patterns / hypotheses) is empty for **every** completed session, so an outcome is only
  reachable via the clarity-bank crosswalk, which requires a `primary_construct_key` or a mapped
  concern bridge tag. Of the **6/9** unclassified sessions, **6** carry
  no anchor at all and **0** carry an anchor that did not yield a crosswalk construct
  overlapping any outcome model. This is a genuine **source-data ceiling upstream**, reported as-is — not inflated.
- **Journey trends — 2/2 eligible users.** Journey always persists a route, so both
  returning users now have ≥2 journey points; but only **0/2** have ≥2
  *non-degraded* points, so journey-trend **confidence stays low by design**.

> The **>85% longitudinal-readiness target is NOT met**, and the activation is built so the number can
> only rise from REAL captured state — never from fabrication. See `03_longitudinal_readiness.md`.

## Reports
1. `01_outcome_capture.md` — Outcome state capture (coverage + why sessions are unclassified)
2. `02_journey_capture.md` — Journey state re-resolution (routed vs degraded)
3. `03_longitudinal_readiness.md` — readiness + honest ceilings + forward guarantee
