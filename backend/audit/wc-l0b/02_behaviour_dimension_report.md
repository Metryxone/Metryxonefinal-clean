# Deliverable 2 — Behaviour Dimension Report
_Generated 2026-06-09T14:01:18.614Z_

## Requested taxonomy vs. what the engine ACTUALLY computes (honest reconciliation)
The phase spec lists six dimension names. WC-L0B persists/trends **only dimensions that already
exist** in the engine — it does **not** invent the missing ones (that would be a new construct,
forbidden, and fabrication). The mapping below is reported transparently:

| Requested dimension | Existing engine output | Status | Note |
|---|---|---|---|
| Confidence | `confidence` | ✅ exists | Direct match — projected from confidence/self-efficacy graph signals. |
| Motivation | `motivation` | ✅ exists | Direct match — the motivation regex also absorbs *persist*/drive/goal/ambition tokens. |
| Persistence | `motivation` (partial) | ⚠️ folded-in | No standalone `persistence` dimension; persistence tokens are part of the motivation projection. Not split out (would be a new dimension). |
| Curiosity | — none — | ❌ not computed | The engine has no curiosity dimension. Reported as not-available, never fabricated. |
| Consistency | — none — | ❌ not computed | No consistency dimension exists in the projection. Not-available. |
| Self-Regulation | — none — | ❌ not computed | Self-regulation tokens exist in the PIL behaviour-intelligence frames, but are NOT a persisted per-session dimension. Not-available here. |

The engine ALSO computes two dimensions the spec did not name, which WC-L0B includes because they are
real existing outputs: **`risk`** (numeric) and **`engagement`**, plus **`adaptability`** and
the categorical **`learning_style`**.

## Per-dimension presence + value distribution (completed base, 9 sessions)
| Dimension | Type | Present | Mean (where present) | Min | Max | Trendable |
|---|---|---|---|---|---|---|
| motivation | numeric | 0/9 | n/a | — | — | yes (≥2 pts/user) |
| confidence | numeric | 0/9 | n/a | — | — | yes (≥2 pts/user) |
| risk | numeric | 2/9 | 50.0 | 50 | 50 | yes (≥2 pts/user) |
| engagement | numeric | 0/9 | n/a | — | — | yes (≥2 pts/user) |
| adaptability | numeric | 0/9 | n/a | — | — | yes (≥2 pts/user) |
| learning_style | categorical | 1/9 | n/a (label) | — | — | **no — categorical** |

\* Mean shown only where ≥1 value exists; dimensions with 0 present values have no distribution.

## learning_style labels observed (categorical — surfaced, never trended)
- `High emotional load` × 1

> Only `risk` (2 sessions) and `learning_style` (1 sessions) carry any value at all on
> the current base; the Behavior Graph projected nothing for the other dimensions on these sessions.
> This is the honest behaviour-signal ceiling, not a measurement gap.
