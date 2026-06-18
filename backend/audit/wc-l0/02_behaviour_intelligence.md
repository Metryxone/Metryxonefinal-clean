# Deliverable 2 — Lever 2: Behaviour Intelligence
_Generated 2026-06-08T16:14:33.115Z_

Persists the 6 behaviour dimensions (motivation · confidence · risk · engagement · learning_style ·
adaptability) **projected from the already-built Unified Behavior Graph**. A dimension is filled ONLY
when the graph speaks to it; otherwise NULL. Behaviour is **never fabricated from score**.

## Metrics (completed sessions, N=9)
| Metric | Value | Definition |
|---|---|---|
| Behaviour Coverage | **2/9 (22.2%)** | session has ≥1 real behaviour dimension |
| Behaviour Continuity | **0 users** | users with ≥2 sessions each carrying ≥1 dimension (of 3 emailed users) |

## Sessions with behaviour persisted
- `11111111-1111-1111-1111-111111111111` — 1 dims (behavior_graph)
- `1cd9ca07-4659-42c4-83fd-229e5e8f21f2` — 2 dims (behavior_graph)

> **Honest ceiling.** Behaviour Coverage is bounded by how many completed sessions captured
> behavioural signals (only those have a Unified Behavior Graph to project from). The 6-dimension
> projection reads existing graph fields only — no new engine, no score-derived behaviour. Coverage
> rises for new sessions completed with signal capture + the flag on; legacy sessions without signals
> stay honestly empty rather than being filled with invented behaviour.
