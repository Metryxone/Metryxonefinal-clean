# WC-L4 · Deliverable 5 — Forecast Mapping Report
_Generated 2026-06-10T04:02:53.569Z. Read-only._

WC-L2 forecasts (an extrapolation of an EXISTING trend at its OWN confidence) raise priority only when the
projected direction is a CONCERN, judged polarity-aware (`risk` kind: rising = concern; growth / outcome /
journey: declining = concern).

| Forecast kind · projected direction (concern) | interventions annotated |
|---|---|
| _(none)_ | 0 |

- Interventions with ≥1 concern forecast: **0** / 6
- Sessions with ≥1 concern forecast: **0** / 4

## Honest ceiling + flag dependency
A forecast exists only where its underlying trend exists (≥2 sessions). Forecast annotations also require
`FF_FORECAST_INTELLIGENCE` to be ON when the engine runs; the default Backend API workflow does **not**
enable it, so in current production these annotations would be **absent** until that flag is enabled. This
backfill enabled it to realise forecasts wherever the data supports them — never to invent them.
