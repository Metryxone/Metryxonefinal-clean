# WC-L0D Deliverable 3 — Trend Coverage Delta
_Generated 2026-06-09T14:43:30.470Z_

Behaviour-trend coverage **before** vs **after** alignment, reusing the existing trend math
(`leastSquaresSlope` / `directionOf`) over the per-session behaviour series. A dimension needs
**≥2 readable points for the SAME user** or it gets no trend (never fabricated). `learning_style`
is categorical and is never trended.

## Trend-eligible users (≥2 completed sessions): **2**

| Metric | Before | After | Δ |
|---|---|---|---|
| Behaviour-trend coverage | 0/2 (0.0%) | 0/2 (0.0%) | +0 |
| Trend rows produced | 0 | 0 | +0 |
| Mean trend confidence | 0.00 | 0.00 | — |

### Trends — before
- (none)

### Trends — after
- (none)

## Per-user behaviour-bearing continuity (after alignment)
| User | Completed sessions | Behaviour-bearing | Dims with ≥2 readable points |
|---|---|---|---|
| `user_65454b2b8b` | 2 | 0 | **none** |
| `user_4b262cc8a5` | 2 | 1 | **none** |

## Honest reading
Trend coverage is **0.0% even after alignment**, and this is the truthful
ceiling — **not** a defect of WC-L0D. A behaviour trend needs the SAME user to have **≥2 sessions
that each carry a graph** for the same dimension. On the live base the graphed sessions belong to
**different users**, and the one returning user with a graphed session has only a single
behaviour-bearing session, so no dimension reaches two readable points for any user. Namespace
alignment fixed the *vocabulary* failure; trend coverage is gated by the upstream **graph capture
gap** (WC-L0C FP1/FP2) — out of WC-L0D scope. Nothing is fabricated to lift it.
