# WC-11 — Report 6: Mentor Activation

The Mentor slot derives mentor-type recommendations from the unified decision: PRIMARY path =
activated L2 outcome models → mentor types; fallback = concern-text keyword (only when no outcome
model activated). Backend-only + read-only; never books a mentor; never fabricated.

## Bank-level reachability (outcome-driven path)
| Metric | Value |
|--------|-------|
| Questions whose PRIMARY outcome model maps to a mentor type | 24693 (80.6%) |
| Outcome-covered questions overall | 26233 (85.6%) |

Note: 1540 outcome-covered questions have a PRIMARY model with no mentor
mapping (e.g. `holistic_wellbeing`, `family_wellbeing`); at SESSION runtime these still reach the
concern-keyword fallback, so session mentor coverage ≥ the bank outcome-mapped figure.

## Session-level (read-only, 9 completed)
| Metric | Value |
|--------|-------|
| Mentor slot ready | 9 / 9 |

Mentor source distribution (ready sessions — every source is part of the unified decision context):
| Source | Sessions |
|--------|----------|
| concern_keyword | 9 |

Honest note: `source:outcome_model` is the PRIMARY decision path; `source:concern_keyword` is the
fallback that fires only when no outcome model activated (the concern IS part of the session's decision
context, so it remains decision-driven, just lower-confidence). When neither supports a mentor type, the
bridge returns `ready:false reason:'no_mentor_signal'` — never a fabricated mentor. In the current
9-session cohort all ready mentors come via the concern-keyword fallback (honest — no outcome
models activated for these cold-start sessions).
