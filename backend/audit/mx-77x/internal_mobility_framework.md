# MX-77X · Section 6 — Internal Mobility Intelligence

**Status:** WORKING (DERIVED) on demo_org seed.
**View:** `/api/enterprise-workforce/mobility` (`mobilityView`).
**Engine:** `m5-succession.candidates` (mobility readiness DERIVED from candidates' `mobility_alignment`).
**Tables (live):** `m5_succession_candidates` 5 (derivation source) · `mobility_role_transitions` 8 ·
`mobility_career_paths` 3 (dedicated mobility schema, present but not the console's source).

## Flow
```
Employee → Current Role → Target Role → Readiness → Transition Path
```
- The console has **no dedicated internal-mobility population**, so it DERIVES a mobility-readiness row
  from each succession candidate: `{candidate_id, person_ref, target_role_id, mobility_alignment, readiness}`.
  Provenance is explicitly stamped `succession_candidates` — honest, not hidden.

## Outputs
- **Mobility Score** — `mobility_alignment` per candidate (5).
- **Transition Risk** — inverse of readiness band.
- **Learning Requirements / Career Opportunities** — target_role_id + readiness gap (the dedicated
  `mobility_*` tables carry 8 transitions / 3 paths that could enrich this — currently un-wired into the console).
- **Cohort avg mobility alignment** — k-anon gated; SUPPRESSED here because distinct people < k_min=30.

## Coverage ⟂ Confidence
- **Coverage:** 5 derived candidates; dedicated mobility tables (8/3) exist but unconsumed by the console.
- **Confidence:** derived (not a first-class mobility model) + n<30 cohort suppression → directional only.

## Honest gaps
- Wiring `mobility_role_transitions`/`mobility_career_paths` into the console would upgrade mobility from
  DERIVED to first-class — a clean, additive follow-up (not done here to avoid scope creep / rebuild).
