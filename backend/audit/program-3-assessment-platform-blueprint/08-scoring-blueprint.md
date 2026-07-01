# 08 · Scoring Blueprint (Layer 5)

**Mode:** Read-only / planning-only. No changes. **Layer status: SUPPORTED.**

## Canonical Definition
The Scoring Engine converts raw responses into interpretable scores at every level: raw, weighted, reverse, composite, domain, sub-domain, competency, behaviour, risk, and confidence. Two complementary scoring stacks serve the two assessment families:
- **CAPADEX signal stack** — `dimension-scoring-engine.ts` + `weighting-engine.ts` (behavioural signals).
- **CAF psychometric stack** — `caf/scoring-engine.ts` (IRT / CTT / SJT / BARS).
- **Psychometric integrity** — `reliability-engine.ts` (reliability, validity, contradiction/consistency), `m3-confidence-v2.ts`.

## Capability Evidence
| Capability | Status | Repository Evidence |
| :-- | :-- | :-- |
| Raw Scores | SUPPORTED | `lbi_session_responses.raw_score`; `lbi-norms-engine.ts` (1..5 Likert). |
| Weighted Scores | SUPPORTED | `weighting-engine.ts` (`computeWeights` context/seniority multipliers; `alignmentScore` = Σ score×weight). |
| Reverse Scores | SUPPORTED | `caf-runtime.ts` (`maxPossible - score`); `caf_question_bank.reverse_score`; `reliability-engine.ts` reverse-item validity. |
| Composite Scores | SUPPORTED | `dimension-scoring-engine.ts` (weighted mean of measured components); `capadex_signal_profiles.composite_intensity`. |
| Domain Scores | SUPPORTED | `dimension-scoring-engine.ts` (competency → `ei_dimension_id`). |
| Sub-domain Scores | SUPPORTED | `lbi-norms-engine.ts` (item → sub-domain aggregation). |
| Competency Scores | SUPPORTED | `competency-ei-scoring-shared.ts`; `onto_role_weights`. |
| Behaviour Scores | SUPPORTED | `pil/behavior-intelligence-engine.ts`; `spe_behavioural_scores`. |
| Risk Scores | SUPPORTED | `role-risk-engine.ts`; `capadex_signal_profiles.risk_score`. |
| Confidence Scores | SUPPORTED | `reliability-engine.ts` (`confidence_score` from reliability + sample size); `m3-confidence-v2.ts`. |

## Scoring-Science Notes (honesty)
- **Strengths canon:** strengths derive ONLY from positive factors / positive longitudinal growth — never from raw concern-signal magnitude (signals are concern-diagnostic). This invariant is preserved across the scoring stack.
- **Confidence ⟂ Score:** confidence (reliability × sample size) is reported as a separate axis from the score itself; small samples flip `is_provisional`, never fabricate.
- **Measured-only composites:** composite/domain scores are weighted means of **measured** components; absent components are null (not zero-filled).

## Overlap Note
The two scoring stacks overlap in intent but are science-distinct (behavioural signal aggregation vs psychometric IRT/CTT/SJT/BARS). The freeze keeps both; a **recommend-only** consolidation candidate is a unified score-provenance view (non-critical).

## Gaps
None at Layer 5.

## Freeze Position
**FREEZE.** The 10 score types and the reliability/validity/confidence integrity layer are canonical. New score types extend the existing engines under the one registry.
