# 10 · Standardization Blueprint (Layer 7)

**Mode:** Read-only / planning-only. No changes. **Layer status: PARTIAL.**

## Canonical Definition
Standardization transforms raw/scaled scores into comparable, interpretable statistics: percentiles, standard scores, z-scores, T-scores, stanines, cut scores, and the reliability/validity/confidence/interpretation apparatus. Primary implementation: `services/lbi-norms-engine.ts` (percentile/z/std), `caf/scoring-engine.ts` (standard-score transform), `dimension-scoring-engine.ts` (band cut-scores), `reliability-engine.ts` (psychometrics).

## Capability Evidence (precise)
| Capability | Status | Repository Evidence / Note |
| :-- | :-- | :-- |
| Percentiles | SUPPORTED | `lbi-norms-engine.ts` `normalPercentile` (erf approximation); `benchmark-engine.ts` `percentileRank`. |
| Standard Scores | SUPPORTED | `lbi-norms-engine.ts` (mean/sd → 0..100 scaling). |
| Z-Scores | SUPPORTED | `lbi-norms-engine.ts` `z = (x-mean)/sd`; `bios-frontier.ts` `z_score_recalibration`. |
| T-Scores | **PARTIAL** | `caf/scoring-engine.ts` maps N(0,1)→**mean 50, SD 15** ("like a T-score"). Canonical T-score is SD **10**; current transform is a deviation-scale, not a strict T. → GAP-AP-7 (Low). |
| Stanines | **MISSING** | No stanine (1–9) transform. → GAP-AP-7 (Low). |
| Cut Scores | SUPPORTED | `dimension-scoring-engine.ts` `band_thresholds` (excellent/strong/developing/emerging); CAF band thresholds. |
| Reliability | SUPPORTED | `reliability-engine.ts` (internal consistency, reverse-item validity, contradiction detection). |
| Validity | SUPPORTED | `reliability-engine.ts` reverse-item validity; `simulation/validation-framework.ts`. |
| Confidence | SUPPORTED | `reliability-engine.ts` `reliability_index` (sample-size weighted). |
| Interpretation Rules | SUPPORTED | `evaluation-engine.ts` (`EVALUATION_DISCLAIMER` — operator-recorded vs algorithmic); `dimension-scoring-engine.ts` bands. |

## Honesty Notes
- The platform has a **complete percentile/z/standard-score/cut-score/reliability apparatus**. The only true gaps are the **canonical T-score (SD=10)** and **stanine** transforms — both are trivial additive transforms over the existing z-score, not new science.
- The existing SD=15 "T-like" scale should be labelled as a **deviation score**, not a T-score, to avoid a psychometric mislabel (honesty).

## Gaps
- **GAP-AP-7 (Low):** Canonical T-scores (SD=10) and stanines absent; existing SD=15 deviation scale should be relabelled. Additive over z-score.

## Freeze Position
**FREEZE.** The standardization apparatus (percentile/z/standard/cut-score + reliability/validity/confidence/interpretation) is canonical. Adding T(SD=10)/stanine transforms and correcting the deviation-score label are additive enhancements. Layer is PARTIAL only because of the T/stanine breadth and the labelling correction.
