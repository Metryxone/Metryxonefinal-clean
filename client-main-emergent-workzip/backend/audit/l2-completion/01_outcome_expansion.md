# L2 Completion — Report 1: Outcome Expansion

**Scope (the three approved WC-10 levers, now APPLIED + measured — no new constructs/ontology):**

| # | Lever | Mechanism | State |
|---|-------|-----------|-------|
| 1 | Runtime Crosswalk Wiring | `FF_WC3_OUTCOME_CROSSWALK` activates the L5C bridge-tag→construct crosswalk tier in `outcome-intelligence.ts` for empty-spine sessions (additive, never-throws, byte-identical for spine sessions) | ✅ active |
| 2 | Outcome Model Fold Expansion | residual constructs folded into existing models' `construct_keys` (array-UNION, reversible) | ✅ applied |
| 3 | Holistic Wellbeing Outcome Model | new `holistic_wellbeing` model over EXISTING constructs (PHYSICAL_WELLBEING, MENTAL_HEALTH, STRESS_MANAGEMENT) | ✅ applied |

## Approved folds (Lever 2) — per-fold dependence
Marginal = questions that become outcome-UNcovered if this single fold is reverted from the fully-applied
set (i.e. questions that depend on this fold for their only model-reaching path).
| Fold | Confidence | Dependent q (lost if reverted) |
|------|------------|--------------------------------|
| CAREER_GROWTH → career_clarity | HIGH | 700 q |
| DIGITAL_DISCIPLINE → decision_quality | HIGH | 50 q |
| PROCRASTINATION → decision_quality | HIGH | 0 q |
| DIGITAL_DEPENDENCY → decision_quality | MODERATE | 0 q |
| PEER_RELATIONS → confidence_stability | MODERATE | 365 q |

> MODERATE folds (DIGITAL_DEPENDENCY → decision_quality, PEER_RELATIONS → confidence_stability) were
> human-review items in WC-10 Report 4, **approved via this L2 task** with the WC-10 leaning model.
> The per-fold dependent-q column SUMS to more than the +1645 net lift because a
> REVIEW bridge tag whose candidate set spans several folded constructs depends on >1 fold at once —
> reverting any one of them uncovers it, so it is counted under each. The net effect below is the
> deduplicated truth.

## Holistic Wellbeing (Lever 2) — new model
- `holistic_wellbeing` = ARRAY[PHYSICAL_WELLBEING, MENTAL_HEALTH, STRESS_MANAGEMENT]; recovers the
  PHYSICAL_WELLBEING residual that NO existing model could carry. SAFETY_THREATS stays intentionally
  UNMAPPED (safeguarding / crisis path — not a developmental outcome; not forced).

## Net effect (real before/after over 30638 clarity questions)
| Metric | Before | After | Δ |
|--------|--------|-------|---|
| Outcome-covered q | 24588 (80.3%) | 26233 (85.6%) | +1645 q |
| Ungated outcome q | 22948 (74.9%) | 24593 (80.3%) | +1645 q |
| Journey-covered q | 24588 (80.3%) | 26233 (85.6%) | +1645 q |
| QI (3-layer) | 93.4% | 95.2% | +1.8 pts |

## Measurement scope & attribution (honest)
- The 7 metrics are computed over the **clarity question bank** (30638 questions) by resolving each
  question's bridge tag → construct → outcome via the SAME crosswalk + models the runtime uses
  (`resolveConstructForBridgeTag` / `projectOutcome` / `projectJourney`). This is the established
  WC-10 / L5C methodology — it measures **question-reachability**, i.e. the maximal outcome/journey
  coverage the crosswalk (Lever 1's mechanism) + the expanded models (Levers 2–3) jointly enable.
- The coverage LIFT (80.3%→85.6%) is driven by the model changes (Levers 2–3); **Lever 1 is what makes
  that reachability actually fire at runtime** for sessions whose behavioural spine is empty — it does
  NOT change the bank-reachability number itself.
- **Runtime activation caveat:** `getSessionOutcomes()` prefers persisted `wc3_outcome_state`, and the
  crosswalk tier only fires for EMPTY-SPINE sessions. So new/recomputed sessions reflect Lever 1
  immediately; previously-persisted sessions remain at their pre-flag resolution until re-resolved. No
  backfill is performed here (out of scope: measure + report only, STOP before downstream activation).

Discipline: additive, reversible, flag-gated. Nothing fabricated — residuals that remain are honest.
This measurement assumes no unrelated model/crosswalk edits occurred after the pre-L2 baseline (the
BEFORE figure is reconstructed from the live models by stripping exactly the approved folds + the
holistic_wellbeing model).
