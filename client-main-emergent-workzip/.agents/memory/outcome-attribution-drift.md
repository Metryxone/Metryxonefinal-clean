---
name: Outcome attribution baseline drift
description: How to net out baseline drift when attributing actions to metric movement without fabricating causation
---

When building an action→outcome attribution layer over a longitudinal metric series:

- **Compute baseline drift PER METRIC SERIES, never pooled per axis.** Two metrics can share one axis (e.g. `market_readiness` and `transition_probability` both on the "career" axis). Pooling their deltas to compute a single drift contaminates the netting and can flip the attributed sign of a specific metric. Key the drift map by `axis::metric`.
- **Do not force an axis hint on derived actions.** If every action is hard-pinned to one axis (e.g. all interventions → "employability"), attribution silently ignores movement on every other metric and over/under-attributes. Let attribution consider all moved series; expose the hint as an OPTIONAL per-action narrowing only.
- **Confidence must reflect both timing and isolation.** `proximity` (sooner post-action movement = stronger) × `isolation` (fewer concurrent actions in the window = cleaner). A nearest-within-45-days match alone is not defensible.
- **Prefer a stored outcome signal when one exists, and actually realize that preference end-to-end.** Claiming "prefers outcome_score" in a doc-comment while the fetch path never hydrates it is an overclaim a reviewer will catch. Attach the real signal (e.g. snapshot mean outcome strength) in the action-log builder.
- **Give every axis a real series or let it degrade to empty.** A hardcoded `delta: 0` axis under-represents growth and looks fabricated. Derive a genuine series (e.g. learning ← mean realized outcome strength) or skip the axis entirely when no source data exists — never emit flat zeros.

**Why:** architect review failed the first P6 cut on axis-pooled drift, forced axis bias, an unrealized outcome-score claim, and a flat learning axis — all four read as "fabricated causation" risks.

**How to apply:** any future longitudinal attribution/ledger work (P5/P6 family and beyond) over `capadex_behavioural_memory` snapshots.
