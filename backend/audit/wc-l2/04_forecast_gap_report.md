# WC-L2 Deliverable 4 — Forecast Gap Report
_Generated 2026-06-09T15:43:51.350Z_

`FF_FORECAST_INTELLIGENCE` is **ON** for this run — forecasts reflect the real capability.

## Gap summary by kind (denominator = 2 trend-eligible owner(s))
Among trend-eligible owners, a missing forecast is always **has sessions but no readable trend**
(insufficient-session owners are not eligible and are counted separately below).

| Forecast | forecastable | missing — has sessions but no trend |
|---|---|---|
| risk | 0 | 2 |
| growth | 2 | 0 |
| outcome | 0 | 2 |
| journey | 2 | 0 |

**Ineligible owners (<2 completed sessions): 1** — no forecast of any kind is
possible for them (a single session cannot form a trend). This is the dominant, data-depth gap.

## Root causes (honest)
1. **Insufficient sessions** — most owners (and all anonymous sessions) have <2 completed sessions, so no
   trend can form. This is the dominant gap and is purely a **data-depth** problem, not a code defect.
2. **Has sessions but no readable trend** — an owner with ≥2 sessions where a specific lever/dimension
   lacked two readable points (e.g. the behaviour `risk` dimension is NULL for one of the two sessions,
   so it cannot be trended). The forecast is honestly withheld rather than fabricated from a single point.

## Per-(owner × kind) gaps (PII-masked)
| Owner | forecast | reason | detail |
|---|---|---|---|
| `user_65454b2b8b` | risk | no_trend | User has ≥2 sessions but this lever/dimension had <2 readable points — no trend to extrapolate. |
| `user_65454b2b8b` | outcome | no_trend | User has ≥2 sessions but this lever/dimension had <2 readable points — no trend to extrapolate. |
| `user_4b262cc8a5` | risk | no_trend | User has ≥2 sessions but this lever/dimension had <2 readable points — no trend to extrapolate. |
| `user_4b262cc8a5` | outcome | no_trend | User has ≥2 sessions but this lever/dimension had <2 readable points — no trend to extrapolate. |
| `user_ec082847d9` | risk | insufficient_sessions | Needs ≥2 completed sessions to form a trend; user has 1. |
| `user_ec082847d9` | growth | insufficient_sessions | Needs ≥2 completed sessions to form a trend; user has 1. |
| `user_ec082847d9` | outcome | insufficient_sessions | Needs ≥2 completed sessions to form a trend; user has 1. |
| `user_ec082847d9` | journey | insufficient_sessions | Needs ≥2 completed sessions to form a trend; user has 1. |
