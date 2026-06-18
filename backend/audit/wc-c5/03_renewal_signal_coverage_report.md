# WC-C5 · Deliverable 3 — Renewal Signal Coverage Report
_Generated 2026-06-10T07:53:25.872Z. Coverage = population fractions; eligible-only denominators; 0/0 → not_measurable._

## Renewal signal coverage over the RENEWABLE population
The renewable population is **0** (active subscriptions with finite expiry). Every renewal signal measured over that population is therefore **not_measurable (0/0)** — there is no eligible denominator. This is the honest core: we cannot have renewal signal about subscriptions that do not exist.

| Renewal signal (over renewable population) | Coverage |
|---|---|
| Renewable population | **not_measurable** (0/0 — not_measurable: empty denominator (0/0)) |
| Renewal candidates (due_soon+in_grace) | **not_measurable** (0/0 — not_measurable: empty denominator (0/0)) |
| Forecastable commercial series | 0% (0/4) |
| Entitlement (entitled/paying) | **not_measurable** (0/0 — not_measurable: 0 paying identities) |

## Behavioural / engagement signal coverage (LABELLED — NOT a commercial metric)
These describe the general session population, not the (empty) paid/renewable population, and are kept out of every commercial percentage. Reported as a dual view (full vs excluding the single ≥10-session identity, which is unverified as a test account).

| Signal | Full | Excl. ≥10-session outlier |
|---|---|---|
| Repeat-identity rate (≥2 sessions) | 40% (2/5) | 25% (1/4) |

### Behaviour-dim coverage (wcl0_user_intelligence, 9 rows)
| Behaviour dim | Non-null coverage |
|---|---|
| motivation | 33.3% (3/9) |
| confidence | 66.7% (6/9) |
| risk | 44.4% (4/9) |
| engagement | 66.7% (6/9) |
| adaptability | 11.1% (1/9) |

> None of the repeat identities are paid or subscribed, so this behavioural continuity does **not** currently translate into renewal signal — it is potential, not realised.
