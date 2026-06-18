# WC-L0E Deliverable 2 — Coverage Delta (before → after)
_Generated 2026-06-09T15:19:15.380Z_


## Headline (over 9 completed sessions)
| Axis | Before | After | Δ | Target | Met? |
|---|---|---|---|---|---|
| Behaviour Graph Coverage (≥1 signal) | 2/9 (22.2%) | 7/9 (77.8%) | +5 | ≥80% | ❌ |
| — Rich graph (≥1 strength-bearing activation signal) | 2/9 (22.2%) | 7/9 (77.8%) | +5 | — | — |
| Behaviour Intelligence (≥1 construct dim) | 2/9 (22.2%) | 7/9 (77.8%) | +5 | ≥80% | ❌ |
| Personalization reach (≥1 behaviour dim) | 2/9 (22.2%) | 7/9 (77.8%) | +5 | ≥88% | ❌ |
| Construct-dim cells filled (of 36) | 5/36 (13.9%) | 16/36 (44.4%) | +11 | — | — |

## Per session (after)
| Session · user | resp | signals | activated | backfill | construct dims | dims present |
|---|---|---|---|---|---|---|
| `11111111` · user_ec082847d9 | 0 | 2 | 2 | 0 | motivation=18, adaptability=40 | 3 |
| `b883418d` · user_65454b2b8b | 10 | 3 | 3 | 3 | confidence=50, engagement=50 | 3 |
| `7828d7a3` · user_65454b2b8b | 10 | 3 | 3 | 3 | confidence=50, engagement=50 | 3 |
| `0731f92c` · user_4b262cc8a5 | 10 | 5 | 5 | 5 | motivation=50, confidence=50, engagement=49 | 4 |
| `1cd9ca07` · user_4b262cc8a5 | 10 | 14 | 5 | 0 | motivation=44, confidence=44, engagement=32 | 5 |
| `4349237c` · (anon) | 3 | 4 | 4 | 4 | confidence=39, engagement=37 | 4 |
| `4c9b6c0b` · (anon) | 3 | 4 | 4 | 4 | confidence=39, engagement=37 | 4 |
| `d0f54fc4` · (anon) | 0 | 0 | 0 | 0 | — | 0 |
| `a0924499` · (anon) | 0 | 0 | 0 | 0 | — | 0 |

## Honest reading
- **Graph & intelligence coverage rise only where real behavioural evidence exists.** The backfill
  re-runs the live engine over persisted answers; it cannot conjure a graph for the
  2 zero-response sessions.
- **Construct dims are deficits** (low = impaired), inverse-coded from mapped concern signals via the
  WC-L0D map — never presented as strengths.
- The **80% / 88% headline targets are bounded by the response-capture ceiling**
  (77.8%) — reported truthfully, not gamed.
