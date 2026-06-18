# CAPADEX AQ-2 — Signal Coverage Delta

> Generated 2026-06-04T07:44:42.778Z · bank `capadex_clarity_questions` · 30638 questions · additive layer `capadex_question_metadata` (provenance `aq2_reconstruction`). NOT wired into runtime.

Signal layer grounded on **WC-1B** (`capadex_bridge_tag_family_grounding`): best signal family per tag → `signal_family`, `signal_strength` (strong/moderate), `signal_confidence` (similarity-scaled). AQ-1 could resolve a single signal for only 0.3% (the rest were *Ambiguous* with >1 signal-map row).

| Metric | Before (AQ-1) | After (AQ-2) | Δ |
|---|---:|---:|---:|
| Signal family assigned | 0.3% | **55.8%** | +55.5 |

**Mean signal confidence**: 0.56.

### Strength distribution
| Strength | Questions |
|---|---:|
| moderate | 13280 |
| strong | 3820 |

> Coverage ceiling = WC-1B family-grounded tags (181/325 = 55.7% of the bank's distinct bridge tags). Ungrounded tags remain honestly unassigned (no fabrication).
