# WC-11 — Report 4: Product Activation

The Product slot is the L3 route → product mapping carried by the unified decision. It is "ready"
only when a real (non-degraded) route with a product path resolved.

## Bank-level reachability
| Metric | Value |
|--------|-------|
| Questions reaching a real product route | 26233 (85.6%) |
| Decision-driven (route comes from the unified decision) | 100% of decisions |

## Product route distribution (bank — non-degraded route → product)
| Product route | Questions | % bank |
|---------------|-----------|--------|
| LBI | 12768 | 41.7% |
| Career Builder | 8242 | 26.9% |
| Mentoring | 2718 | 8.9% |
| Competitive Exam Intelligence | 1640 | 5.4% |
| Employability Index | 865 | 2.8% |

## Session-level (read-only, 9 completed)
| Metric | Value |
|--------|-------|
| Product slot ready | 0 / 9 |
| Decision-driven (product.route_key === decision.route.route_key) | 9 / 9 sessions with a decision route |

Product reason distribution (session):
| Reason | Sessions |
|--------|----------|
| route_degraded | 9 |

Honest note: "decision-driven" here is a STRUCTURAL provenance check — the product slot's route_key is
identical to the unified decision's route_key, proving the slot is COMPOSED from the decision (not chosen
independently). A degraded session (no construct → mentoring fallback) yields `product.ready:false` with
reason `route_degraded`; it still traces to the decision route but is never fabricated into a confident
product recommendation. In the current 9-session cohort all are degraded (honest cold-start state).
