---
name: WC-7B Activation Intelligence (Tier A)
description: Decision Orchestrator + bridges that COMPOSE WC-3 L1/L2/L3 into one per-session activation envelope; the longitudinal-automation race fix and the L5B text-risk trap.
---

# WC-7B — Activation Intelligence Tier A

Read-only orchestration layer that stitches the already-derived WC-3 layers (L1 Stage / L2
Outcome / L3 Journey) into ONE per-session **ActivationEnvelope** plus growth-plan / mentor /
subscription activation slots. Five file flags, all default OFF, byte-identical when OFF.

## Compose-only honesty (the whole point)
- The orchestrator NEVER recomputes scores. Growth-plan bridge calls the M5 coach with
  `persist=false`; mentor bridge is a pure function; subscription is always
  `ready:false reason:'out_of_scope_tier_b'`.
- Empty layers degrade HONESTLY — `no_outcome_models` / `no_mentor_signal` / `route_degraded`,
  and `degraded:true` on ANY unresolved hop. A real session with no activated outcome models
  correctly yields `growthPlan.ready:false` — that is the contract, not a bug. Never fabricate a
  roadmap/mentor when the spine is empty.
- **Known boundary:** the WC-3 read getters it composes may run idempotent `ensureWc3*Schema()`
  DDL on a first-ever read, so the activation GET is not *bytewise* zero-write on a cold schema.
  That DDL is owned by the WC-3 layer (already triggered by the live WC-3 pipeline) — do NOT
  re-architect the shared getters to "fix" this; document it.

## Longitudinal automation — the duplicate-builder race
**Rule:** when two fire-and-forget paths both call the same idempotent snapshot builder
(`buildAndPersistMemory` does DELETE-non-stale-events + re-INSERT), they can interleave and
double-insert event rows. A flag being enabled is NOT proof the snapshot was built (the other
path may have errored or still be in-flight).
**Why:** WC-7B's first cut skipped its own build when the legacy `longitudinal_memory` DB flag
was *enabled* — wrong proxy; broke the "guarantee a snapshot" contract and risked a race.
**How to apply:** make ONE path the sole builder. When the WC-7B `longitudinalAutomation` flag is
ON, suppress the legacy item-10 build (`&& !isLongitudinalAutomationEnabled()`) and have WC-7B
always build (guaranteeing the `longitudinal_patterns` row exists before the additive
`next_reassessment_at` write) and mirror item-10's `cognitive_runtime_state` summary so nothing
legacy is lost. OFF → item 10 runs exactly as before (byte-identical).

## L5B relevance_risk is TEXT, not numeric
`wc3_question_context.relevance_risk` is a TEXT band (`NONE/LOW/MEDIUM/HIGH`, default `'NONE'`),
while `context_confidence` / L5A `stage_confidence` are numeric. A naive `Number(relevance_risk)`
→ NaN, which silently kills any sort tiebreak (NaN comparisons). Map the band to a bounded penalty
(NONE 0 / LOW .1 / MEDIUM .2 / HIGH .3) comparable to the 0..1 confidence scale. The runtime
consumption re-rank is display-order ONLY — same rows, same count, never drops/dupes; OFF → no
join, no re-rank.
