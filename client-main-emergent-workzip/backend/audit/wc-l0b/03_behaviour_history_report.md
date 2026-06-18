# Deliverable 3 — Longitudinal Behaviour History
_Generated 2026-06-09T14:01:18.614Z_

The behaviour history is the EXISTING per-session behaviour rows read as an ordered series per user
(User → Session → Behaviour State → Historical Series), oldest→newest by the session's own
`created_at`. **History only — NO forecasts.** No new table: `wcl0_user_intelligence` already IS
the per-session behaviour store; this deliverable reads it longitudinally.

## History depth (trend-eligible users, N=2)
| User | Sessions | Behaviour-bearing | Dimensions with ≥2 readable points |
|---|---|---|---|
| `user_65454b2b8b` | 2 | 0 | **none** |
| `user_4b262cc8a5` | 2 | 1 | **none** |

## Per-user ordered series
### `user_65454b2b8b` — 2 sessions (0 behaviour-bearing)
  1. b883418d · 2026-05-18 · absent → (no dimensions)
  2. 7828d7a3 · 2026-05-18 · absent → (no dimensions)

### `user_4b262cc8a5` — 2 sessions (1 behaviour-bearing)
  1. 0731f92c · 2026-05-17 · absent → (no dimensions)
  2. 1cd9ca07 · 2026-06-01 · behavior_graph → risk=50, learning_style=High emotional load

## Honest reading
Every returning user has ≥2 completed sessions, but the behaviour rows are almost entirely
`absent` — so **no dimension reaches 2 readable points for any user**. History *exists* (the series
is real and ordered); it simply has **no continuity of a behaviour value** to trend yet. That absence
is a finding, not a zero.
