---
name: Longitudinal consumption null-coercion trap
description: Why building a numeric trend series with Number(x) over nullable score columns fabricates datapoints, and the honest extraction pattern.
---

# Longitudinal trend series must treat null as MISSING, not 0

When computing a per-metric trend/forecast over snapshot rows, do NOT build the
series with `snaps.map(s => Number(s[key])).filter(Number.isFinite)`.

**Why:** the source score/CSI columns are nullable. `Number(null) === 0` (and
`Number('') === 0`), both of which are `Number.isFinite`, so a missing value
silently becomes a real `0` datapoint. With sparse history this fabricates
deltas/directions/forecasts and flips `consumed:false → true` — a direct
violation of the "never fabricate; degrade honestly" rule.

**How to apply:** explicitly map `null | undefined | '' → NaN` (and non-finite
`Number(raw) → NaN`) BEFORE the `Number.isFinite` filter. A metric with <2
readable points is skipped; zero readable metrics → `consumed:false` with an
honest "no trend fabricated" note. Real data here had 0 snapshots → 0% trend
coverage, which is the correct honest finding, not a bug to tune away.
