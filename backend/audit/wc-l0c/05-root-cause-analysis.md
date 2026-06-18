# Deliverable 5 — Root Cause Analysis (runtime trace + exact failure point)

## Runtime trace: session → signals → graph → projection → persistence
```
1. SESSION         capadex_sessions (status='completed')                9 rows
        │
2. CAPTURE         telemetry → runActivation → capadex_session_signals
        │          ✗ 5/9 sessions: no telemetry, no signals          (FP1 capture gap)
        │          ✗ 2/9 sessions: telemetry present, 0 signals      (FP2 activation gap)
        │          ✓ 2/9 sessions: active signals — but ALL concern-diagnostic keys
        ▼
3. GRAPH           buildBehaviorGraph → capadex_behavior_graph
        │          ✗ 7/9 completed sessions have NO graph → getBehaviorGraph=null (FP2)
        │          ✓ 2/9 graphed, but partial (concern signals + low-score risk + ≤1 pattern)
        ▼
4. PROJECTION      projectBehaviour(graph) → strengthByKey regex over signal_key
        │          ✗ 0 of 10 runtime keys match ANY construct regex  (FP3 — ROOT CAUSE)
        │          risk survives only via low-score gate; learning_style via pattern label
        ▼
5. PERSISTENCE     wcl0_user_intelligence  ✓ 100% (healthy — writes whatever projection returns)
```

## The EXACT failure point
**Step 4, the `strengthByKey` filter** — the producer (signal-activation-runtime) and the consumer
(`projectBehaviour`) speak **different signal vocabularies**:

- **Producer namespace** (everything the runtime emits): `rapid_answer`, `rapid_answer_pattern`,
  `prolonged_hesitation`, `social_withdrawal`, `avoidance_pattern`, `cognitive_blocking`,
  `emotional_overload`, `placement_anxiety`, `career_confusion`, `GENERAL_CONCERN` — all
  **concern-diagnostic distress markers**.
- **Consumer namespace** (what the regexes look for): positive constructs + `self_*` tokens
  (`motiv|drive|goal`, `confidence|self_doubt|self_efficacy`, `engag|effort|focus`,
  `adapt|reframing|resilien`).
- **Intersection = ∅** for all four construct dimensions. This is a **namespace contract break**,
  not a bug in any single function — each function is internally correct.

## Why risk is the only construct-like value that appears
Risk has a **second, non-signal source**: the `loadRisks` low-score gate (`score < 40 → medium`).
That is the entire reason risk shows for 2/9 sessions (both scored < 40). It is not evidence that the
signal→risk path works — that path also fails (`emotional_overload` ≠ `overwhelm`).

## Why the ontology proves this is fixable (but only as deficits)
The atomic ontology (`capadex_atomic_signals`, 15,972 rows) **does** contain construct vocabulary:
adaptability 2,585 · motivation 873 · confidence 674 · engagement 573 · risk 308. The constructs are
expressible. The gap is that the **activation runtime never reaches that ontology** — it emits a
fixed ~10-key distress set. So the constructs are reachable **only by mapping the distress keys to
construct DEFICITS** (e.g. `avoidance_pattern` → low adaptability/engagement; `placement_anxiety` →
low confidence; `career_confusion` → low motivation). Per the strengths canon, concern signals can
**never** be read as positive strengths — positive construct values require positive-construct
signals (not emitted) or CSI `positive_factors`.

## Honest root-cause statement
> Behaviour construct dimensions are empty because the projection engine matches dimensions by regex
> over a signal vocabulary the runtime never produces. Even a perfectly captured, fully-graphed
> session yields zero construct dimensions today. The capture gap (FP1) and activation/graph gap
> (FP2) reduce coverage further, but FP3 sets the ceiling at **0% under current code for the
> currently observed emitted signal namespace** — non-zero only if upstream begins emitting
> regex-matchable construct keys (e.g. future Pragati/seed keys) or the projection mapping changes.
