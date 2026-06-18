# WC-1C-Y — Signal Coverage Delta

_Source: `audit/wc1c-y/wc1c_y_grounding.json` (generated 2026-06-04T08:08:35.676Z). Additive YELLOW grounding, provenance `wc1a_yellow`. Persisted._

Coverage denominator = 328 distinct `relational_bridge_tag` in `capadex_concerns_master`. A tag is grounded if it has native atomic signals OR a grounding-table row. **Before** = native ∪ GREEN; **After** = native ∪ GREEN ∪ YELLOW (this phase).

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| Signal coverage (tags) | 63.1% | **100%** | +36.9 |
| Concern coverage | 90.4% | **100%** | +9.6 |
| Question coverage (live bank) | 80.1% | **100%** | +19.9 |
| Tags grounded | 207 | **328** | +121 |
| Questions on a grounded tag | 24551 | **30638** | +6087 |

Question coverage reaches **100%**: every one of the 30638 live-bank questions sits on a bridge tag that is now grounded (all distinct clarity tags fall within the 328 canonical concern tags activated by GREEN+YELLOW+native).
