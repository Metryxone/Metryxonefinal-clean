# WC-C5 · Deliverable 4 — Renewal Scoring Feasibility Report
_Generated 2026-06-10T07:53:25.872Z. Can a renewal/propensity score be computed today? Read-only._

## Inputs a renewal score would consume — availability
| Input | Engine (exists?) | Live data? |
|---|---|---|
| Behaviour trend (motivation/engagement/…) | behaviour-trend-intelligence.ts ✓ | thin — 2/5 identities ≥2 sessions, **0 paid** |
| Longitudinal value (recurring constructs) | longitudinal-memory.ts ✓ | thin — needs ≥2 sessions/identity |
| Engagement / retention recency | recomputable from sessions ✓ | 5 identities, 2 returning |
| Forecast contribution (expiries/revenue) | commercial-forecast-inputs.ts ✓ | 0/4 series forecastable |
| Renewable population (expiry windows) | renewal-engine.ts ✓ | **0** renewable active |

## Feasibility verdict
- **Structural feasibility: PARTIAL.** The input engines exist, but **no composition engine** fuses them into a per-identity renewal propensity (`renewal_scoring_composition` = absent, 1/5). Scope item 9's machinery is missing.
- **Data feasibility: NO.** Even if the composition existed, it would have **0 renewable identities** to score and **0 historical renewal events** to calibrate against. A score produced now would be fabricated, not measured.
- **Honest conclusion:** renewal scoring is buildable from existing inputs **once a renewable population and renewal-event history exist** — not before. Building the scorer first would produce a confident-looking but groundless number.
