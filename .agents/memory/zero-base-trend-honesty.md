---
name: Zero-base trend / momentum honesty
description: A %-change "momentum" signal must require a strictly positive PRIOR base, not merely non-null endpoints, or it fabricates an interpretable 0%.
---

A derived momentum/percent-change indicator is only honest when the prior-window base is **strictly positive**. Marking it `measurable` on `current != null && previous != null` alone is wrong: when `previous === 0` the percentage has no denominator, `delta_pct` is null, and rendering `delta_pct ?? 0` prints a fabricated "0%".

**Rule:** classify a trend-derived signal measurable only when `current != null && previous != null && previous > 0 && delta_pct != null`. When not measurable, keep severity at `info`, set the carried `value` to `null`, and use explicit copy ("insufficient prior baseline") — never `?? 0`.

**Why:** distinct from the null→0 coercion trap. Here the prior is a real measured 0 (empty revenue window), so the null-guard passes but the ratio is still undefined. A "0% vs prior" reads as "flat performance" when the truth is "no baseline to compare against" — that is fabricated causation.

**How to apply:** any compose-only engine that turns a `buildTrend`-style {current, previous, delta_pct, direction} into a risk/insight. Also encode it as a harness invariant: FAIL if any unmeasurable trend-derived risk carries a non-null `value` or a severity above `info`.
