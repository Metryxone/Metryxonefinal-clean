# L5C Runtime — Report 2: Outcome Coverage

Chain: Question → Bridge Tag → Construct → Outcome Model. Frequency-weighted (n=30638; 325 distinct bridge tags). Read-only projection; no runtime wiring.

| Metric | Value |
|--------|-------|
| Questions with a Primary Outcome | **26233 (85.6%)** |
| ...routing to an **ungated** outcome model | 24593 (80.3%) |
| ...reachable **only via a gated** model (exam_readiness) | 1640 (5.4%) |
| Questions with NO outcome (UNMAPPED / construct→no-model) | 4405 (14.4%) |

The uncovered residual is honest and split into two grounded buckets (derived from this projection, not asserted):
- **UNMAPPED / absent bridge tags** (institutional/holistic — no behavioural construct at all): 4405 q (14.4%).
- **Construct-reachable but in no outcome model's `construct_keys`** (HIGH/REVIEW construct exists, but no `wc3_outcome_models` row contains it): none.

Neither bucket is forced — construct-reachable ≠ outcome-reachable.
