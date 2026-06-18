# WC-L0D Deliverable 2 — Behaviour Coverage Delta
_Generated 2026-06-09T14:43:30.470Z_

Coverage of the behaviour dimensions **before** (legacy regex path) vs **after** (regex + namespace
alignment), computed over the SAME live Unified Behavior Graphs. Persistence (a row exists) and
dimension presence (a value is actually non-NULL) are kept separate.

## Headline (over 9 completed sessions)
| Metric | Before | After | Δ |
|---|---|---|---|
| Persistence coverage (rows) | 9/9 (100.0%) | 9/9 (100.0%) | 0 (unchanged) |
| Sessions with ≥1 behaviour dimension | 2/9 (22.2%) | 2/9 (22.2%) | +0 |
| **Construct-dim cells filled** (of 36 = 4×9) | 0/36 (0.0%) | 5/36 (13.9%) | **+5** |
| **Construct-dim cells filled — WITHIN graphed sessions** (of 8 = 4×2) | 0/8 (0.0%) | 5/8 (62.5%) | **+5** |
| Sessions gaining ≥1 construct dimension | — | 2 | — |

## Per construct/numeric dimension (sessions with a value)
| Dimension | Before | After | Δ sessions |
|---|---|---|---|
| motivation | 0/9 (0.0%) | 2/9 (22.2%) | +2 |
| confidence | 0/9 (0.0%) | 1/9 (11.1%) | +1 |
| risk | 2/9 (22.2%) | 2/9 (22.2%) | +0 |
| engagement | 0/9 (0.0%) | 1/9 (11.1%) | +1 |
| adaptability | 0/9 (0.0%) | 1/9 (11.1%) | +1 |

## Per session (before → after)
| Session · user | Graph | Before | After |
|---|---|---|---|
| `11111111` · user_ec082847d9 | ✓ | risk=50 | motivation=18, risk=50, adaptability=40 _(+motivation/adaptability)_ |
| `b883418d` · user_65454b2b8b | — | (none) | (none) |
| `7828d7a3` · user_65454b2b8b | — | (none) | (none) |
| `0731f92c` · user_4b262cc8a5 | — | (none) | (none) |
| `1cd9ca07` · user_4b262cc8a5 | ✓ | risk=50, learning_style=High emotional load | motivation=44, confidence=44, risk=50, engagement=32, learning_style=High emotional load _(+motivation/confidence/engagement)_ |
| `4349237c` · (anon) | — | (none) | (none) |
| `4c9b6c0b` · (anon) | — | (none) | (none) |
| `d0f54fc4` · (anon) | — | (none) | (none) |
| `a0924499` · (anon) | — | (none) | (none) |

## Honest reading
- **The structural FP3 ceiling is eliminated.** Construct dims were **0/36** before (the
  regex path matched no real signal); after alignment, every graphed session that carries a mapped
  concern signal now resolves the corresponding construct as a **deficit**. Within graphed sessions,
  construct-cell coverage rises from **0.0% → 62.5%**.
- **Session-level coverage is still bounded by graph coverage.** Only **2/9**
  completed sessions have a behaviour graph at all (WC-L0C findings FP1 capture gap + FP2 activation/
  graph gap — OUT OF WC-L0D SCOPE). So "sessions with ≥1 dimension" stays 2/9;
  the alignment makes the graphed sessions **richer**, it cannot conjure graphs for the
  7 sessions that captured no behavioural evidence.
- Values are **deficits** (low = impaired), provenance-stamped `deficit_dims`; they are never
  presented as strengths.
