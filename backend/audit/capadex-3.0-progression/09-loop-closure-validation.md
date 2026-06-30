# CAPADEX 3.0 · Phase 1.5 — Loop-closure Validation

> Deliverable 09 · Generated 2026-06-30T13:37:32.258Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:8c4776b58a27, written 2026-06-30T13:37:32.255Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

The 4 close-the-loop invariants make growth CONTINUOUS (recommend→action→reassess→improvement→promotion). Each is a COVERAGE statement: the EXISTING mechanism linking two spine steps is present (services + ≥1 backing table verified). Coverage of the loop links is SEPARATE from ADOPTION (deliverable 08) and CONFIDENCE (calibrated effectiveness, abstained by design).

**Loop-closure coverage: 4/4 invariants PRESENT.**

| Invariant | Link | Mechanism | Coverage | Services | Tables |
|---|---|---|---|---|---|
| INV1-RECOMMEND-TO-ACTION — Recommendation → Learning / Practice / Intervention (the growth action is generated) | `recommendation` → `personalized_intervention` | Recommendation engines feed the learning-path + intervention catalogs, so every diagnosis yields a concrete next action. COMPOSED by reference, never invoked. | PRESENT | 3/3 | 3/3 |
| INV2-INTERVENTION-TO-REASSESS — Intervention → Reassessment (the action is followed by a re-measurement) | `personalized_intervention` → `reassessment` | After an intervention, the reassessment signal (getReassessmentSignal) surfaces interval/exit re-administration eligibility from the accrued longitudinal record. MECHANISM present (Phase 1.3 reuse); gated by longitudinalOutcomeCapture. | PRESENT | 2/2 | 2/2 |
| INV3-REASSESS-TO-IMPROVEMENT — Reassessment → Improvement validation (the re-measurement is compared to the baseline) | `reassessment` → `improvement_validation` | A second datapoint lets the longitudinal trend validate improvement vs the prior baseline. MECHANISM present; effectiveness/accuracy stays abstained (no decision-time prediction recorded) until real volume accrues — honest-null, never fabricated. | PRESENT | 2/2 | 2/2 |
| INV4-IMPROVEMENT-TO-PROMOTION — Improvement → Promotion / Outcome (validated growth advances the lifecycle stage) | `improvement_validation` → `promotion` | Validated readiness drives stage promotion (evidence-gate readiness band) and a realized-outcome capture into the canonical ledger. MECHANISM present (evidence-gate + progression-outcome-capture); promotion is readiness-DERIVED, not a uniformly enforced per-persona gate (see GAP-P1). | PRESENT | 3/3 | 3/3 |

- **INV1-RECOMMEND-TO-ACTION residual**: ADOPTION: real recommendation→action engagement volume is usage-driven (Coverage⟂Adoption, null≠0).
- **INV2-INTERVENTION-TO-REASSESS residual**: ADOPTION: real re-administration volume is usage-driven (honest-low/0; reported separately — Adoption⟂Coverage, null≠0).
- **INV3-REASSESS-TO-IMPROVEMENT residual**: ADOPTION + CONFIDENCE: improvement is measurable once >1 non-demo datapoint exists; calibrated accuracy is abstained by design (Coverage⟂Confidence⟂Adoption, null≠0).
- **INV4-IMPROVEMENT-TO-PROMOTION residual**: ENGINEERING (GAP-P1, Medium): promotion criteria are readiness-derived, not a single enforced gate across all personas. ADOPTION: realized-outcome volume is usage-driven (null≠0).
