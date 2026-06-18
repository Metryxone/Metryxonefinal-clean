# WC-11 — Report 5: Growth Plan Activation

The Growth Plan slot maps the decision's activated L2 outcome models (current/desired canonical
stage → score) into the existing M5 coach and runs `growthPlan(input, persist=false)` — READ-ONLY,
never persisted. It activates exactly when ≥1 outcome model is present.

## Bank-level reachability
| Metric | Value |
|--------|-------|
| Questions reaching ≥1 outcome model (growth-plannable) | 26233 (85.6%) |
| Decision-driven (outcome models come from the unified decision) | 100% of decisions with an outcome |

## Session-level (read-only, 9 completed)
| Metric | Value |
|--------|-------|
| Growth Plan slot ready | 0 / 9 |

Growth Plan source distribution (ready sessions — proves the plan derives from the decision's inputs):
| Source | Sessions |
|--------|----------|
| (none ready) | 0 |

Honest note: a ready Growth Plan is decision-driven by construction — the bridge runs only over the
decision's activated outcome models. When no outcome model activated, the bridge returns
`ready:false reason:'no_outcome_models'` — genuinely nothing to plan, so nothing is fabricated. In the
current 9-session cohort none reach an outcome model, so 0 are ready (honest cold-start). Real
`user_competency_scores` are merged when the person resolves to stored scores (union, never overwriting).
