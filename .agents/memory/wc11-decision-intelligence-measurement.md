---
name: WC-11 Decision Intelligence measurement honesty
description: How to measure an activation/decision layer honestly — flag-aware session snapshots + provenance (not tautological) "decision-driven" checks.
---

# WC-11 Runtime Decision Intelligence — measurement honesty

When a "decision layer" composes prior layers (stage+outcome+journey → unified decision → activations)
and the genuine new build is only PERSISTENCE, the measurement script is where honesty is won or lost.

## Two ground rules learned the hard way (architect rejected the first cut)

**1. A measurement script that calls the flag-gated runtime composer measures the FLAG STATE of its
own process, not "the activated runtime".**
`buildActivationEnvelope` reads bridge flags (`journeyGrowthPlanBridge`, `decisionMentorBridge`,
`commercialActivation`) INSIDE the call. A bare `npx tsx script.ts` invocation does NOT inherit the
Backend API workflow env, so every activation slot comes back `bridge_disabled` / `out_of_scope_tier_b`
and looks like 0% coverage — a false negative. **Run the script WITH the same `FF_*=1` flags as the
workflow**, AND have the script detect+print its own flag state and embed it in the report with a caveat
("session activations reflect the activated runtime only when bridges ON; OFF = flag state, not a finding").
Bank-level coverage (resolved directly via `projectOutcome`/`projectJourney`) is flag-INDEPENDENT — say so.

**2. "All activations decision-driven" must be a PROVENANCE/structural check, never a tautology.**
A counter like `if (decision.stage) mentorDecisionDriven++` is near-100% by construction (stage is always
present) and proves nothing. Replace with checks that the slot's OWN field traces to the decision:
- product: `product.route_key === decision.route.route_key` (structural identity — it was composed FROM
  the decision route, not chosen independently).
- growth / mentor: report `ready` count + `source` distribution (e.g. mentor `outcome_model` vs
  `concern_keyword` fallback). A ready slot is decision-driven by construction (the bridge only runs over
  the decision's inputs); an unready slot carries an honest reason (`no_outcome_models`, `route_degraded`).
- subscription: distinguish the legacy `out_of_scope_tier_b` literal from a live commercial slot; only
  count it as decision-driven when `confidence_gated === true` (its gating read `decision.confidence`).

## Other honest framings
- **Decision Intelligence = mean(stage, outcome, journey) coverage.** It is CAPPED at the
  construct-reachability ceiling (here (100+85.6+85.6)/3 = 90.4%); state the ceiling, don't pretend the
  bare-pass is headroom. Exceeding it needs the out-of-scope crosswalk (UNMAPPED reduction) phase.
- **"SELECT-only" is usually a lie if you compose shared getters.** The WC-3 getters run idempotent
  `CREATE TABLE IF NOT EXISTS` ensure-schema DDL (no-op on the live DB, but DDL on a pristine one). Say
  "no DATA writes / no migrations / no new ontology; ensure-schema DDL is a live-DB no-op" — not "pure SELECT".
- **Attribution:** if components pre-existed behind default-OFF flags and you only flipped env, say so —
  "activated via Backend API workflow ENV; code defaults remain OFF (reversible)", don't claim you built them.

## Persistence wiring
`persistDecision` (snapshot of the read-only `buildActivationEnvelope` → UPSERT one row in
`wc7b_decision_state`) belongs in its OWN flag-gated try block in `postCompletionHooks`, NOT nested
inside the WC-3 `if (stageOn||...||journeyOn)` block — else `FF_DECISION_PERSISTENCE` is silently NOT
self-sufficient (depends on a WC-3 flag also being on). The orchestrator stays byte-identical (read-only);
persistence is a separate write step (mirrors `resolveSessionOutcomes`).
