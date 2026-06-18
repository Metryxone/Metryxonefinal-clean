# WC-1B-R — Updated Ontology Health

Read-only rollups over the WC-1B grounding tables and `capadex_concerns_master`. Source: `audit/wc1b-r/grounding_stats.json`.

## Grounding coverage
| Metric | Value |
|---|---|
| Grounded bridge tags | **182** |
| Total grounding rows | **14,402** |
| Provenance `wc1a_green` | **14,402 (100%)** |
| Family grounding rows | **351** |
| Distinct master bridge tags | 328 |
| **Grounded-tag coverage** | **55.5%** (182 / 328 distinct master tags) |
| Master concerns sitting on a grounded tag | **1,184** |

## Atomic signals per grounded tag (over-activation profile)
| Stat | Value |
|---|---|
| min | 20 |
| median | 80 |
| **avg** | **79.1** |
| max | **200** |

This confirms the design-canon risk: an uncapped grounded contribution could inject up to **200** atomic signals from a single tag. The runtime caps grounded seeds at **`GROUNDED_SEED_CAP = 8`**, ranks by similarity DESC, and penalises confidence (×0.6) — so grounded supply scales the *availability* surface without flooding activation.

## Health observations
- **Provenance integrity:** 100% of grounding rows are `wc1a_green` — the runtime consumes only WC-1A-validated grounding, no fabricated or lower-grade rows.
- **Coverage gap (honest):** 44.5% of master bridge tags (146/328) are **not** grounded. Concerns on those tags fall through to the legacy curated/keyword path with no grounding envelope/lineage (flag-ON returns `grounded:false`, 0 seeds — verified via the ungrounded-tag contract). This is a data-coverage gap in WC-1B, not a runtime defect; extending grounding coverage is a WC-1B data follow-up, not a wiring change.
- **Resolver entrypoint consistency:** all 5 probe concerns resolved `concern_id → bridge tag` consistently in-process (`resolver_consistent = true`). The one divergence observed in the live pipeline (CONCERN_EMP_17, Explainability Delta) stems from the **free-text → pk** session resolver, a distinct entrypoint — flagged for follow-up.

## Verdict
Ontology grounding is healthy and fully WC-1A-green; runtime consumption respects the per-tag over-activation profile via cap + rank + penalty. The honest ceiling on runtime grounding effect is the **55.5% grounded-tag coverage** — concerns off grounded tags are unaffected by the feature (correct, byte-identical legacy behaviour).
