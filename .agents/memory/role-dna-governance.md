---
name: Role DNA Governance & Benchmarks (MX-100X P1)
description: Honesty contracts and data-shape gotchas for the role_dna_governance engine over the ont_*/map_role_competency chain.
---

# Role DNA Governance (MX-100X Phase 1)

Flag `roleDnaGovernance` / `FF_ROLE_DNA_GOVERNANCE` (default OFF). Engine composes the
EXISTING Role-DNA: `ont_roles` inheritance chain (role→family→department→function) +
`map_role_competency` requirements. Read-only; writes (`materializeGovernance`) carry
provenance `mx100x_p1_governance` and are reversible by deleting on provenance.

## Abstention vs Coverage — the key honesty rule
A resolved role with **zero competency links** is an **abstention for requirement-dependent
axes only**: Confidence and Quality → null; all 7 benchmark levels → unavailable.
**Completeness stays a real partial value** (~0.5) because the inheritance chain genuinely
exists — discarding it would be LESS honest. Flag it explicitly with
`abstained: true, abstainReason: 'no_competency_links'` + an `abstention` explainability row.
**Why:** "never fabricate where inputs are *absent*" — the chain inputs are present, only the
requirement inputs are absent. Coverage (Completeness) and Confidence are SEPARATE axes and
are *supposed* to diverge here. Fully unresolved roles → null on all three (`unresolved_role`).
**How to apply:** any future per-role governance/scoring must keep Coverage real when its
inputs exist, null the trust/quality axes when their inputs don't, and never composite them.

## No role↔industry linkage (do not fabricate)
There is NO role→industry mapping anywhere in the `ont_*` chain (`ont_industries` has rows but
no role join). Industry benchmarks ALWAYS abstain `reason: 'no_role_industry_linkage'`.
Closing it is downstream O*NET/crosswalk work, not a bug to patch with a guess.

## Data shape
- `ont_*` ids are INTEGER; `onto_*` ids are TEXT — never coerce between them.
- `map_role_competency`: source∈{onet 0.7, onet_derived 0.6, seeded/curated 0.9} drives Confidence
  (mostly onet-derived → typical Confidence lands LOW band ~0.67–0.69 even at completeness 1.0;
  only high-density roles ~80+ links reach ~0.82). importance_tier∈{core,secondary}.
- Proficiency ordinal: novice<developing<proficient<advanced<expert (min ≤ target coherence check).
- Cohort benchmarks (family/department/function) require ≥2 linked roles in the cohort else
  `insufficient_cohort`; department coverage is genuinely lower (~67%) — many single-role depts.
- pg COUNT returns strings → Number()-wrap before compares.
