# WC-L1 — Trend Intelligence (MEASURED)
_Generated 2026-06-08T16:35:30.858Z_

Measures the **direction of progression** (Improving / Stable / Declining) for four EXISTING levers
— **Stage · Outcome · Journey · Decision** — across each user's session history. **No new
intelligence engine** — it REUSES the existing longitudinal trend math (`leastSquaresSlope` /
`directionOf` / `STABLE_DEADBAND`) over values existing intelligence already persisted, and writes
to the long-existing `wc3_longitudinal_trends` table. Additive + flag-gated
(`FF_TREND_INTELLIGENCE`), byte-identical when OFF.

## Population
- **Trend-eligible users** (≥2 completed sessions, the only population a trend can exist for): **2**
- Emailed users (≥1 completed session): **3**
- Completed sessions: **9** (of which anonymous / no-email: **4**)

## Headline (trend-eligible users, N=2) — two independent axes
| Lever | Coverage | Confidence (mean) | Directions |
|---|---|---|---|
| Stage | **2/2 (100.0%)** | 0.33 | improving 0 · stable 2 · declining 0 |
| Outcome | **0/2 (0.0%)** | 0.00 | improving 0 · stable 0 · declining 0 |
| Journey | **0/2 (0.0%)** | 0.00 | improving 0 · stable 0 · declining 0 |
| Decision | **2/2 (100.0%)** | 0.33 | improving 0 · stable 2 · declining 0 |
| **Any lever** | **2/2 (100.0%)** | 0.33 | — |

## Success criteria — honest status
| Target | Result | Met? |
|---|---|---|
| Trend Coverage > 90% (any lever, eligible) | 100.0% | ✅ |
| Trend Confidence > 90% (mean) | 33.0% | ❌ |

> **Honesty note (mirrors WC-L0).** The >90% targets are **not** met, and the layer is deliberately
> built so the numbers can only rise from REAL data, never from fabrication:
> 1. **Only 2 users have returned for a 2nd session**, so the eligible population itself is tiny.
> 2. **Outcome and Journey state were never persisted historically** (`wc3_outcome_state`=0 rows,
>    `wc3_journey_state`=0 rows) — those levers have no source series, so their coverage is honestly 0%.
> 3. **Trend confidence is structurally capped** because every eligible user has exactly 2 comparable
>    sessions — a 2-point line cannot distinguish a real trend from noise, so confidence is ~0.33 by
>    design (it climbs toward 1.0 only as a user reaches 4 comparable sessions). Not inflated.
> Stage and Decision trends ARE produced for every eligible user from real persisted state.

## Reports
1. `01_stage_trend.md` — Lever 1 (Stage)
2. `02_outcome_trend.md` — Lever 2 (Outcome)
3. `03_journey_trend.md` — Lever 3 (Journey)
4. `04_decision_trend.md` — Lever 4 (Decision)
5. `05_trend_intelligence.md` — consolidated direction view
6. `06_trend_readiness.md` — readiness + honest ceilings
