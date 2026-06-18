# Deliverable 1 — Behaviour Coverage
_Generated 2026-06-09T14:01:18.614Z_

Coverage of the EXISTING behaviour dimensions across the completed-session base. **Persistence
coverage** (a row exists) and **behaviour-dimension coverage** (a dimension is actually present, not
NULL) are reported separately — a row with every dimension NULL is honest "behaviour never captured",
not coverage.

## Per session (over 9 completed)
| Metric | Value | Definition |
|---|---|---|
| Persisted rows | **9/9 (100.0%)** | session has a `wcl0_user_intelligence` row |
| ≥1 dimension present | **2/9 (22.2%)** | `behaviour_source <> 'absent'` |
| 0 dimensions (absent) | **7/9** | Behavior Graph spoke to no dimension — honest empty state |

## Per dimension (sessions where the value is present)
| Dimension | Sessions with value | Coverage |
|---|---|---|
| motivation | 0/9 | 0.0% |
| confidence | 0/9 | 0.0% |
| risk | 2/9 | 22.2% |
| engagement | 0/9 | 0.0% |
| adaptability | 0/9 | 0.0% |
| learning_style (categorical) | 1/9 | 11.1% |

## Per user
| Metric | Value |
|---|---|
| Emailed users | 3 |
| Users with ≥1 behaviour-bearing session | **2/3 (66.7%)** |
| Users with ≥2 completed sessions (continuity) | **2/3 (66.7%)** |

## Per concern
| Concern | Completed | With behaviour |
|---|---|---|
| Anxiety & Overthinking | 4 | 0 (0.0%) |
| Career Anxiety | 2 | 1 (50.0%) |
| Work Stress | 2 | 0 (0.0%) |
| Exam stress | 1 | 1 (100.0%) |

## Per age band
| Age band | Completed | With behaviour |
|---|---|---|
| 19+ | 6 | 1 (16.7%) |
| 15-18 | 2 | 0 (0.0%) |
| 14-17 | 1 | 1 (100.0%) |

## Per product
`capadex_sessions` has **no product / assessment-type column** — the completed base is a single
product (CAPADEX assessment). A per-product breakdown is therefore **not available from the source**
and is reported as such rather than fabricated. (If a product dimension is added upstream later, this
breakdown becomes computable with no engine change.)

> Coverage here is exactly what the already-computed data supports — never padded to a target.
