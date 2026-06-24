# Section 10 — Global Intelligence Certification

**Verdict: PARTIAL (regional content PASS; country/localization depth shallow; no usage).**

The global/regional layer has a genuinely large content asset (`global_region_content` = 2,089) and a
structured regional reference model, but country-level workforce intelligence and localization weights
are seeded at a **demonstration depth** (single digits per dimension), and nothing is exercised by
real regional users.

## 10.1 Evidence
| Table | Count | Note |
|---|---:|---|
| global_region_content | 2,089 | large content corpus |
| nhda_regions | 15 | region reference |
| m4_country_workforce_profiles | 5 | **5 countries only** |
| m4_localization_weights | 5 | |
| m4_regional_competency_expectations | 7 | |
| m4_regional_leadership_models | 5 | |
| m4_regional_language_policies | 5 | |

## 10.2 Content corpus — PASS
- 2,089 region-content rows is a substantial, queryable localization corpus and the strongest part of
  the global layer.

## 10.3 Country / localization depth — PARTIAL
- Country workforce profiles, localization weights, regional leadership models, and language policies
  are each populated for only ~5 entities. This is enough to *demonstrate* region-aware behavior, not
  to *certify* global coverage. There is no claim of comprehensive country coverage — honest.

## 10.4 Reachability ceiling
- Regional competency expectations (7) are far thinner than the 419-competency genome, so region-
  conditioned competency expectations resolve for only a small slice; the rest fall back to the global
  default. This is a content gap, correctly surfaced rather than fabricated.

## 10.5 Confidence vs Coverage
- **Coverage:** large content corpus + structured regional model. **Confidence:** shallow per-country
  depth (≈5 each), 0 real regional usage.

## 10.6 Certification table
| Sub-area | Verdict | Evidence |
|---|---|---|
| Region content corpus | PASS | global_region_content 2,089 |
| Country workforce depth | PARTIAL | 5 country profiles |
| Localization weights / policies | PARTIAL | ~5 each |
| Regional competency expectations | PARTIAL | 7 rows vs 419 genome |

**Net: PARTIAL.** A strong content corpus on a sound regional model, seeded at demo depth. Enterprise
certification requires country-coverage expansion and region-conditioned competency expectations at
genome scale.
