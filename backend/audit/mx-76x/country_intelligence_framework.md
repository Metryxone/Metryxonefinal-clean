# MX-76X · Section 4 — Country Intelligence Framework

**Foundation already exists:** the `m4_*` subsystem + `services/m4-localization.ts`. This section
activates and exposes it; it does not build a new country model.

## Country-specific dimensions (mapped to live tables)
| Dimension | Table | Rows | Notes |
|---|---|---|---|
| Countries | `m4_countries` | 5 | US, DE, AE, IN, JP — `iso2, region, language, labor_regime` |
| Roles | (via `ont_roles` ∪ overlay) | — | **no country-native role rows** → inherit (G6 ceiling) |
| Benchmarks | `bench_cohorts` | 0 country cohorts | **no `country` cohort_type** → gap G2 |
| Industries | `ont_industries` (206) | global | not country-segmented (O*NET no geo) |
| Functions | `ont_functions` (30) | global | inherited |
| Departments | `ont_departments` (43) | global | inherited |
| Workforce profile | `m4_country_workforce_profiles` | 5 | one per country |
| Cultural norms | `m4_cultural_behavioral_norms` | 10 | 2 per country avg |
| Competency expectations | `m4_regional_competency_expectations` | 7 | country-native (sparse) |
| Language policy | `m4_regional_language_policies` | 5 | one per country |
| Leadership model | `m4_regional_leadership_models` | 5 | one per country |
| Localization weights | `m4_localization_weights` | 5 | one per country |

## Country resolution (read-time)
`GET /api/global-intel/country/:iso2` composes the `m4_*` rows for the country + inherits
industry/function/role from the global tier (labelled `inherited`). Unknown ISO2 → `404`
(never invent a country). Countries beyond the 5 → **honest "not yet localized"**, not silent
inheritance presented as native.

## Country ⟶ region binding
`m4_countries.region` (`Americas/EMEA/APAC`) crosswalks UP to the canonical region set
(Section 3). A country inherits its region overlay where it has no country-native row → labelled
`inherited_from_region`.

## Gaps (honest)
- **G2:** no `country` benchmark cohort tier — country benchmarking is *not measurable* today
  (would need ≥`k_min` real respondents per country; report `not_measurable`, never a fabricated %).
- **5 countries only** — every other country resolves to `not_localized`. Extending = authoring real
  `m4_*` rows per country (content acquisition), explicitly bounded and reversible by provenance.
- **labor_regime is stored but unused** (compliance gap G7) — see `localization_framework.md` +
  `multi_tenant_governance.md` for where it should gate.
