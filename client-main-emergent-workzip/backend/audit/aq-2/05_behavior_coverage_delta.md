# CAPADEX AQ-2 — Behavior Coverage Delta

> Generated 2026-06-04T07:44:42.778Z · bank `capadex_clarity_questions` · 30638 questions · additive layer `capadex_question_metadata` (provenance `aq2_reconstruction`). NOT wired into runtime.

AQ-2 assigns a **primary + secondary behavioral scope** from WC-1B atomic grounding (bridge tag → atomic signal → behavioral scope), falling back to the best tier-3 signal-map name when a tag is ungrounded.

| Metric | Before (AQ-1) | After (AQ-2) | Δ |
|---|---:|---:|---:|
| Primary behavior assigned | 99.7% | **99.9%** | +0.2 |

**Mean behavior confidence**: 0.294.

### Source mix
| Source | Questions |
|---|---:|
| WC-1B grounded scope | 17100 |
| signal-map fallback | 13498 |
| none | 40 |

> ⚠️ The AQ-1 baseline (99.7%) counted *signal-map presence*, not an explicit behavioral label. AQ-2's number is the share with a real primary scope — a fidelity gain even where the raw % moves.
