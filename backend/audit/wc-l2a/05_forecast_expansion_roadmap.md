# WC-L2A Deliverable 5 — Forecast Expansion Roadmap
_Generated 2026-06-09T16:18:56.166Z_

`FF_FORECAST_INTELLIGENCE` is **ON** — the WC-L2 cross-check ran against `computeUserForecasts`.

All scenarios are **MODELS**, not measurements. The **session-depth gate is deterministic** (we know exactly
who crosses ≥2 sessions). Any **state-capture** assumption is stated explicitly and tied to the **observed**
per-session capture rate (Stage/Journey/Decision are captured on 5/5 of owned sessions today;
Outcome 1/5; Behaviour-risk 2/5). Coverage metric = identified owners with ≥1 forecastable layer
(denominator = 3). Current baseline = **2/3** (66.7%).

## Scenario A — every user completes **one** additional assessment
- Deterministic: session-eligible owners 2 → **3**.
- Under observed capture (Stage/Journey/Decision dense today), owners with ≥1 forecast → **3/3** (100.0%).
- Confidence: existing 2-session owners move 0.33 → **0.67 (moderate)**; the new 2-session owner sits at the 0.33 floor.
- Does **not** create Outcome/Behaviour-risk coverage (those remain capture-blocked — see C/D).

## Scenario B — every user completes **two** additional assessments
- Deterministic: session-eligible owners → **3**.
- Coverage (≥1 forecast) → **3/3** (100.0%).
- **Key gain is confidence:** the existing 2-session owners reach depth 4 → confidence **1.0 (high)** — the only
  scenario that lifts any forecast off the low-confidence floor.

## Scenario C — Outcome history fully populated (every session carries outcome state)
- Depth unchanged → owner coverage unchanged. **Outcome layer** coverage over eligible owners: 0% → **100.0%** (2/2).
- Confidence still at the 0.33 floor (depth not increased).

## Scenario D — Behaviour history fully populated (risk dim non-null every session)
- **Behaviour layer** coverage over eligible owners: 0% → **100.0%** (2/2).
- ⚡ **Near-zero-cost variant:** `confidence` and `engagement` are **already** trend-eligible for both eligible owners
  (non-null on 4/5 and 4/5 sessions). WC-L2 simply forecasts the *sparsest* dim (risk, 2/5).
  Pointing the existing `projectForecast` at a denser dim would yield Behaviour forecasts **today**, with no new data.

## Scenario E — combined (+2 sessions AND Outcome + Behaviour fully populated)
- All 3 owners eligible; all **5 layers** forecastable for every eligible owner; the +2-depth owners reach
  confidence **1.0 (high)**. This is the full-coverage / high-confidence ceiling — reachable **only** with both
  more depth **and** the capture fixes.

## Sessions-to-target (owner coverage)
| Target | Owners needed | Have now | Shortfall |
|---|---|---|---|
| 50% | 2 | 2 | 0 |
| 75% | 3 | 2 | 1 |
| 90% | 3 | 2 | 1 |

**Honest caveat (small-n):** with only 3 identified owners, coverage moves in ~33.3% steps, so the
50/75/90% thresholds are coarse. Concretely: **50% is already met**; **75% and 90% both require all 3 owners at
≥2 sessions** — i.e. the single 1-session owner completing **one** more assessment. If the 4 anonymous
sessions represent real users, reaching those targets *also* requires attributing them to a stable identity.
