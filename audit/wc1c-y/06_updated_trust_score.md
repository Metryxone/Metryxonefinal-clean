# WC-1C-Y — Updated Trust Score

_Source: `audit/wc1c-y/wc1c_y_grounding.json` (generated 2026-06-04T08:08:35.676Z). Additive YELLOW grounding, provenance `wc1a_yellow`. Persisted._

**Trust Score** = evidence-weighted grounding across the 328 concern bridge tags: each grounded tag contributes its best evidence weight (strong=1.0, good=0.8, **moderate=0.5**; native tags = strong), summed / 328 × 100.

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| Signal coverage (raw, tags) | 63.1% | **100%** | +36.9 |
| **Trust Score** (evidence-weighted) | 54.6 | **73** | +18.4 |

**Honest interpretation:** raw coverage jumps to 100%, but Trust rises only to **73** because the 121 YELLOW tags ground at *moderate* evidence (half-weight). The gap between coverage (100%) and Trust (73) is the quantified "moderate-confidence" cost of activating YELLOW — these tags are grounded enough to participate, but at lower confidence than GREEN/native tags. Strengthening them would require new construct-specific signals (a separate, larger effort), not reuse.
