# WC-1C-Y — Assessment Intelligence Delta

_Source: `audit/wc1c-y/wc1c_y_grounding.json` (generated 2026-06-04T08:08:35.676Z). Additive YELLOW grounding, provenance `wc1a_yellow`. Persisted._

**Assessment Intelligence Score** = evidence-weighted question coverage over the live bank (30638 questions): each question's tag contributes its best evidence weight (strong=1.0, good=0.8, **moderate=0.5**), summed / total × 100. Distinct from the AQ-2 question-metadata AIS.

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| Question coverage (unweighted) | 80.1% | **100%** | +19.9 |
| **Assessment Intelligence Score** | 71.5 | **81.4** | +9.9 |

Because YELLOW tags ground at **moderate** evidence (0.5), the AIS gain is intentionally **smaller than the raw question-coverage gain** — the score reflects that newly-covered questions carry lower-confidence grounding.

## Directional resolver-confidence impact (NOT measured)
- Concerns under YELLOW tags: **239** · Questions under YELLOW tags: **6087** · Concerns newly grounded: **239**.
- directional: concerns/questions on newly-grounded YELLOW tags gain reusable Tier-3 atomic-signal evidence the resolver/confidence engine COULD consume; NOT a measured resolver-accuracy delta — requires runtime wiring (deferred follow-up).
