# MX-76X · Section 9 — Global Employer Intelligence

**Constraint:** compose the existing employer intelligence (`employerCompetencyHiring`, Phase 5.12
workforce intelligence, M5 engines) — do not rebuild. Add geography awareness on top.

## Capabilities to enable
| Capability | Built on | State |
|---|---|---|
| Country Hiring Models | `m4_country_workforce_profiles` (5) + `m4_regional_leadership_models` (5) + employer match | **composable, shallow** |
| Regional Hiring Models | `global_region_content` + `bench_cohorts(region)` (after G4) | latent → activatable |
| Global Readiness Models | `career_readiness_history` + benchmark tiers | global today |

## Country hiring model (read-time composition)
For a country, employer intelligence = existing competency-driven match **+** country context:
- `m4_country_workforce_profiles` → supply/skill context.
- `m4_regional_leadership_models` → leadership expectation framing.
- `m4_cultural_behavioral_norms` → interview/assessment interpretation caveats.
- `m4_regional_competency_expectations` → country competency bar (inherit if absent).

**Honesty:** the hiring recommendation stays **decision-SUPPORT** (focus/probe/advance), never a
hire/no-hire verdict (existing constraint preserved). Country context **annotates** the match; it does
not change the calibrated probability unless a country-native calibration cohort exists (it does not →
labelled `country_context_advisory`).

## Regional readiness (after G4)
Region benchmark cohorts become resolvable → an employer can compare a candidate against a
**regional** cohort, k-anonymity gated (suppressed below `k_min`). Country comparison =
`not_measurable` (no country cohort).

## Gaps (honest)
- No country-native hiring calibration → predictions remain global/region-calibrated, country layer is
  advisory only.
- Only 5 countries have `m4_*` context; others → employer sees `country_not_localized`.
- Compliance (`labor_regime`) not enforced in hiring flow (G7) → flagged as roadmap.

## Verdict
Global employer intelligence = **composable now** for 5 countries / 4 regions as advisory context over
the existing calibrated match. Country-native calibration is **not yet measurable**.
