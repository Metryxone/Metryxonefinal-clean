# L2 Completion — Report 4: Journey Impact

Journey coverage tracks outcome coverage: `journey_route fit = Σ(route.model_affinity × model.confidence)`,
so a question reaches a non-degraded journey exactly when it reaches an outcome model.

## Journey coverage (BEFORE → AFTER)
| Metric | Before | After | Δ |
|--------|--------|-------|---|
| Journey-covered q | 24588 (80.3%) | **26233 (85.6%)** | +1645 q |

- ✅ Journey coverage equals outcome coverage — every newly outcome-covered question also gains a real (non-degraded) journey route.
- Questions with no outcome still resolve to the deterministic degraded `mentoring` fallback (route_confidence 0.2, `degraded:true`) — they are NOT counted as journey-covered and are never fabricated into a confident route.

## Success criterion
- "Journey Coverage improves accordingly." Achieved: **80.3% → 85.6%** (+1645 q), in lockstep with the outcome-coverage lift.
