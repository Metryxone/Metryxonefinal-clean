---
name: L5C Runtime Outcome Projection
description: Deterministic Question→BridgeTag→Construct→OutcomeModel projection over the clarity bank; honesty traps in derived reports.
---

# L5C Runtime Outcome Projection

Engine `backend/services/wc3/outcome-projection.ts` (pure) + build/measure script
`backend/scripts/wc3/build-outcome-projection.ts` (SELECT-only, writes `backend/audit/l5c-runtime/`).
Projects each clarity bridge tag onto the 7 `wc3_outcome_models` via the FROZEN crosswalk
`backend/data/bridge-tag-construct-crosswalk.ts`. Additive, inert — imported only by the script,
never wired into routes/runtime.

## Deterministic scheme (reproducible)
- Score each model by summed contribution confidence (HIGH = one construct; REVIEW = each candidate).
- Rank by a TOTAL order: score desc → ungated before gated → fewer `construct_keys` (more specific)
  → model_key alpha. Primary = rank[0], Secondary = rank[1].
- `outcome_confidence = max(crosswalk_conf) × concentration` where `concentration = primary_score/total`.
- `ambiguity = 1 − concentration`. Single model → ambiguity 0; no model → primary null, conf 0.

## Honesty traps (each cost a real architect FAIL or near-miss)
- **construct-reachable ≠ outcome-reachable.** A construct can be HIGH-mapped yet sit in NO
  `wc3_outcome_models.construct_keys` → primary_outcome = NONE. Don't treat construct coverage as
  outcome coverage.
- **Report narrative must derive its residual set from the projection's OWN output**, never from a
  broader crosswalk-level / ontology list. Listing constructs (PROCRASTINATION/SAFETY_THREATS/…) that
  aren't actually in-sample is fabrication even if they're "real" constructs elsewhere. Compute the
  residual map (null-primary HIGH/REVIEW tags, q-weighted) + the UNMAPPED bucket and render them
  dynamically so edits can't reintroduce over-claims.
- **Zero-reach models are honest findings.** `family_wellbeing` reaches 0 questions (its only key
  FAMILY_DYNAMICS gets no HIGH mapping from any clarity tag). Flag it computed-from-`reachAny`, don't
  force a path. Same for Mastery-stage near-total NONE — derive from the stage×outcome matrix.

## Grounded results (this sample, 30,638 q / 325 tags)
Coverage 80.3% (74.9% ungated, 1,640 gated-only); NONE 19.7% = UNMAPPED ~4,410q + no-model residual
(CAREER_GROWTH 700, PHYSICAL_WELLBEING 530, PEER_RELATIONS 365, DIGITAL_DISCIPLINE 50). Mean conf 0.616;
ambiguity 40.6%. QI completeness (stage+context+outcome)/3: 66.7% → 93.4%. Stage/context are
cross-tabulated, NOT folded into outcome confidence.
