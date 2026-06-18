# WC-3 · Output 3 — Runtime Design

> Design only. Defines how the 7 layers integrate into the existing runtime **without changing the
> flag-off path**. All resolvers are compose-only, never-throws, and degrade honestly.

## Integration point

WC-3 layers attach to the existing **signal-activation runtime** (the advisory-locked post-completion
transaction) and the **3-tier clarity picker** — the two existing seams — never as new blocking
request-path work.

```
Request path (synchronous, must stay fast):
  analyze → clarity picker [L4 score] → questions → result

Post-completion (async, advisory-locked txn, never blocks the user):
  Answers→Evidence→Signals→Composites→Patterns        (existing)
    └─► L1 stage-resolver    → wc3_stage_state/progression
        └─► L2 outcome-resolver  → wc3_outcome_state/actions
            └─► L3 journey-resolver → wc3_journey_state/routing_decisions
        └─► L6 longitudinal-resolver → wc3_longitudinal_snapshots/trends
  L5 QIS-V2 scorer: offline/registry (not request path)
  L7 outcome-validation-engine: batch job (not request path)
```

## Per-layer runtime contract

| Layer | Trigger | Throws? | Flag-off behaviour |
|---|---|---|---|
| L1 Stage | post-completion hook | never (try/catch → skip) | no `wc3_stage_state` written; legacy unchanged |
| L2 Outcome | after L1 | never | UNCLASSIFIED when spine empty; nothing emitted |
| L3 Journey | after L2 | never | no routing; existing handoff unchanged |
| L4 Personalization | request-path picker | never (falls back to current 3-tier) | current picker exactly |
| L5 QIS V2 | offline/registry job | n/a | reads legacy QIS column |
| L6 Longitudinal | post-completion | never | no trend written |
| L7 Validation | batch (cron/manual) | allowed to fail honestly | no runs |

## L4 picker score (the one request-path change)

Extends the existing 3-tier picker with a weighted score **only when `FF_WC3_DYN_PERSONALIZATION`**:

```
score(question | user) =
    0.30·age_fit + 0.25·persona_fit + 0.20·context_fit
  + 0.15·archetype_fit + 0.10·severity_fit
```

- Inputs are the **already-shipped** context + archetype + resolved severity (no enrichment).
- Flag-off → identical to today's `pickQuestionsFromMaster → pickQuestionsFromDB → pickQuestions`.
- `clarity_source` provenance pill extended with a `personalized:true` marker for auditability.
- Tie-break is deterministic (stable sort) so output is reproducible.

## Determinism & safety

- All resolvers use `ORDER BY` on load **and** sorted adjacency where capped (per pil-graph lesson) →
  reproducible output.
- k-anonymity ≥ 30 enforced before any cohort-relative stage/trend/journey signal is surfaced.
- Language policy enforced at the envelope: developmental signals only; never hiring/promotion/
  suitability predictions.
- OMEGA-X safety breaker + report safety gate (<60 fails) unchanged and still apply downstream.

## Feature-flag matrix

| Flag | Gates | Default |
|---|---|---|
| `FF_WC3_STAGE` | L1 resolver + routes | OFF |
| `FF_WC3_OUTCOME` | L2 resolver + routes | OFF |
| `FF_WC3_JOURNEY` | L3 resolver + routes | OFF |
| `FF_WC3_DYN_PERSONALIZATION` | L4 picker score | OFF |
| `FF_WC3_QIS_V2` | L5 scorer + matrix view | OFF |
| `FF_WC3_LONGITUDINAL` | L6 resolver | OFF |
| `FF_WC3_OUTCOME_VALIDATION` | L7 batch + routes | OFF |

Each flag-off path is byte-identical to legacy; layers can be enabled independently and in dependency
order (L5/L4 → L1 → L2 → L3 ; L6 ; L7 last).

## New routes (all GET / read-only except internal batch)

- `GET /api/capadex/session/:id/stage` · `/outcome` · `/journey`
- `GET /api/career/longitudinal/:userId`
- `GET /api/capadex/outcome-validation/report` (admin)
- Internal (not on public router): outcome-validation batch fn, QIS-V2 materialize fn — kept as
  scripts/jobs, never as a public DELETE+INSERT route (knowledge-graph-readonly discipline).
