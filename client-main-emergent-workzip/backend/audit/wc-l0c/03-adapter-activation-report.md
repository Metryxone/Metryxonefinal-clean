# Deliverable 3 — Adapter Activation Report

**Question:** are behaviour adapters invoked? are outputs generated? are outputs consumed?
**Sources:** `services/signal-activation-runtime.ts` (`runActivation`, lifecycle classifier),
`routes/signal-capture.ts` (ingest), `routes/capadex.ts:2061` (`buildBehaviorGraph` trigger),
`routes/capadex-enterprise.ts:512-518` (`persistUserIntelligence` post-completion hook).

## The activation chain (as built)
```
telemetry / linguistic evidence
   → runActivation(slice, evidence, seeds)        signal-activation-runtime.ts
       classify by strength:  candidate ≥ 0.20 · active ≥ 0.50 · dominant ≥ 0.78 & conf ≥ 0.70
       persist rows WHERE lifecycle_state IS NOT NULL → capadex_session_signals
   → buildBehaviorGraph(pool, sessionId)           capadex.ts:2061 (loadSignals/Patterns/Risks…)
   → persistUserIntelligence(pool, sessionId)      capadex-enterprise.ts:518 (postCompletionHooks)
       gated by isUserIntelligenceFoundationEnabled()  (FF_USER_INTELLIGENCE_FOUNDATION)
       → getBehaviorGraph → projectBehaviour → wcl0_user_intelligence
```
Thresholds (lines 76-79): `CANDIDATE_MIN 0.2`, `ACTIVE_MIN 0.5`, `DOMINANT_MIN 0.78`,
`DOMINANT_CONF 0.7`.

## 1. Invoked?
- **Activation (`runActivation`): partially.** It produced *active* rows for exactly **2** sessions.
  For the 2 sessions that have telemetry but no signals (`d0f54fc4`, `a0924499`, both score 0),
  activation produced **nothing persisted** — telemetry never crossed into `capadex_session_signals`.
- **Graph build (`buildBehaviorGraph`): partially.** Only 2/9 completed sessions have a graph row;
  7/9 were never built (or built against a different id-space — note 34 orphan graphs).
- **Persistence hook (`persistUserIntelligence`): yes, 100%** — every completed session has a
  `wcl0_user_intelligence` row (WC-L0B confirmed). The persistence adapter is healthy.

## 2. Outputs generated?
- Where the adapter ran fully (2 sessions), outputs **are** generated: active signals with strength
  + confidence, lifecycle states, a behaviour graph JSON, a persisted intelligence row.
- BUT the generated signal outputs are **all concern-diagnostic keys**. The activation runtime has
  no path that emits a positive-construct or `self_*` key — its output namespace is disjoint from
  what the projection consumes (see report 04).
- Telemetry-derived candidates (`rapid_answer`, `prolonged_hesitation`) are generated with
  `strength = NULL` → they activate to nothing and contribute 0 even if matched.

## 3. Outputs consumed?
- The persistence adapter **does** consume the graph: `projectBehaviour(graph)` runs on both graphed
  sessions. It is invoked correctly and writes its result.
- The consumption is **structurally lossy for 4 of 6 dimensions**: `strengthByKey` filters
  `graph.signals` by regex and finds **zero** matches for motivation/confidence/engagement/
  adaptability, so those outputs are dropped to `null`. Only `risk` (from `graph.risks` severity)
  and `learning_style` (from a pattern label) survive consumption.

## Verdict
The adapters are **wired and invoked**, and the persistence adapter is fully healthy, but the chain
fails on two counts: (a) it only runs end-to-end for 2/9 sessions (activation + graph gaps), and
(b) where it does run, the projection adapter **cannot consume** the generated signal vocabulary for
the four construct dimensions. The break is a **producer/consumer namespace contract mismatch**, not
a wiring or threshold-tuning failure.
