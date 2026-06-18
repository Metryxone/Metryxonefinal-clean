# AQ-1 · Output 5 — Behavior Coverage

**Investigation only.** Behavior is derived via the bridge tag from `capadex_concern_signal_map` (the concern→signal mapping). For each question:
- **behavior_measured** = the signal names mapped to the question's bridge tag (the observable behaviours those signals describe).
- **behavior_confidence** = the best `confidence_band` on the tag's signal mappings → strong 0.80 · moderate 0.50 · weak 0.25 · none 0.
- **behavior_alignment** = whether the tag has a strong/non-orphan signal mapping.

## Behavior confidence band (per question, best band on tag)
| Band | Questions | % | Confidence |
|---|---:|---:|---:|
| strong | 30,288 | 98.9% | 0.80 |
| moderate | 270 | 0.9% | 0.50 |
| weak | 80 | 0.3% | 0.25 |
| none / orphan | 0 | 0% | 0 |

## Completeness classification (behavior field)
| Class | Count | % |
|---|---:|---:|
| Present (strong/moderate band) | 30,558 | 99.7% |
| Ambiguous (weak band only) | 80 | 0.3% |
| Missing | 0 | 0% |

## Findings
1. **Behavior is the best-covered derived field (99.7% present, 98.9% strong).** Every bridge tag has at least one non-orphan signal mapping, and `concern_signal_map` rates the vast majority as `strong` (5,582 tier-3 + 5,574 composite strong mappings underpin this).
2. **Caveat — band is tag-level, not question-level.** The strong band reflects how confidently the *bridge tag* maps to signals, **not** how well an individual question's wording measures that behaviour. Because many questions share a tag, this metric cannot discriminate a sharply-worded item from a vague one on the same tag. Per-question behaviour validity would require item-level signal annotation, which the bank does not store.
3. **behavior_measured is a set, not a single behaviour.** A question inherits all signals on its tag (the audit caps the captured label set at 8 per tag), so the "behaviour measured" is a cluster rather than one targeted construct — consistent with the Signal-field ambiguity in Output 1 (only 0.3% resolve to a single signal; 99.7% inherit a multi-signal cluster).

## Verdict — GREEN at tag level / YELLOW at question level
Tag-level behaviour mapping is strong and complete. The honest limitation is that it is **inherited, not measured per item** — so it validates that the *topic* maps to behaviours, not that each *question* cleanly elicits one.
