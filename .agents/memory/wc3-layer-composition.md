---
name: WC-3 layered intelligence composition
description: How WC-3 layers (L1 Stage, L2 Outcome, …) compose; library-backed actions; data quirks for building further WC-3 layers (L3/L6/L7).
---

# WC-3 layered intelligence composition

WC-3 is a multi-phase, strictly-additive, flag-gated stack under `backend/services/wc3/`
(catalog `backend/audit/wc-3/`). Each layer is **compose-only** (re-shapes
already-computed data; never recomputes scores) and ships behind its own
`FF_WC3_*` flag (default OFF), with a lazy `ensureWc3*Schema()` mirroring a
canonical migration, and a session-scoped read route.

## Layers compose DOWNWARD — never re-derive an upstream primitive
- **L2 Outcome takes `current`/`desired`/`gap` from L1 Stage.** It must NOT derive a
  stage itself. `desired = min(current_order+1, last)`, `gap` = ladder distance,
  `gap_normalized = gap/(ladderLen-1)`. When L1 yields no stage → **UNCLASSIFIED**
  (`reason='no_stage'`), writes nothing.
- **Why:** keeps each layer a pure function of the layer below; prevents two layers
  disagreeing on the same primitive and prevents fabricated outcomes.
- **How to apply:** future layers (L3 Journey, L7 Outcome Validation) should consume
  L1/L2 outputs the same way — thread the upstream state through the completion hook
  (hook #14 in `capadex-enterprise.ts`) and degrade honestly when it's absent.

## Actions are library-backed ONLY
- Outcome (and intervention) actions come exclusively from `intervention_library` via a
  hard FK (`intervention_id → intervention_library(id)`); never generic/fabricated.
- **Construct mappings in any catalog (e.g. `wc3_outcome_models.construct_keys`) must be
  grounded in REAL `intervention_library.construct_key` values** (there are ~38 distinct
  active ones). A model whose construct keys don't exist in the library can't resolve any
  action — silently empty, not an error. Query the live distinct keys before seeding.

## Data-shape traps for synthetic tests / resolvers
- `behavioural_hypotheses.session_id` is **TEXT, not uuid**, and has **NO FK** to
  `capadex_sessions`. Active constructs = `lifecycle_state='active'` rows. Safe to
  insert/clean synthetic sessions for full-path smokes (seed a `wc3_stage_state` row so
  `getSessionStage` returns a stage without needing a `capadex_sessions` row).
- The behavioural spine is empty in dev DB → resolvers degrade to UNCLASSIFIED honestly;
  to exercise the full resolve→persist→read path you must seed both a stage and ≥1 active
  construct, then clean up all `wc3_*` + `behavioural_hypotheses` rows for the test id.

## Route convention
- Session-scoped WC-3 read routes **flag-gate BEFORE uuid validation** (so OFF + a bad
  uuid both return `{ok:true,enabled:false}` at 200), mirroring `/stage`. Degraded/unknown
  session → `{degraded:true,reason}` at 200; never 503/500 on these read surfaces.
