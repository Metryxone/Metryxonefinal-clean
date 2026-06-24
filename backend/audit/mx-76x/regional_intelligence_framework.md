# MX-76X · Section 3 — Regional Intelligence Framework

**Target regions:** North America, Europe, Middle East, India, APAC, Africa, Latin America.

## The reconciliation problem (must solve before "7 regions" is honest)
Three region taxonomies exist in the live DB and **do not agree**:
| System | Region codes present | Backing |
|---|---|---|
| Phase 8 overlay | `IN, ME, EU, US, APAC` | `global_region_content` (2,089 rows) |
| `m4_countries.region` | `Americas, EMEA, APAC` | 5 countries |
| `nhda_regions` | India national + states only | 15 rows (India) |

**Resolution = a canonical region set + an additive crosswalk, NOT a rename** (rename would break
flag-OFF byte-identical + existing overlay rows).

### Canonical region set (proposed, additive)
`NA, EU, ME, IN, APAC, AFRICA, LATAM` (7). Crosswalk table `region_crosswalk(canonical_code,
source_system, source_code)` maps each existing code:

| Canonical | Phase 8 | m4.region | Status today |
|---|---|---|---|
| NA | `US` | `Americas` | Seeded (overlay) |
| EU | `EU` | `EMEA`(subset) | Seeded (overlay) |
| ME | `ME` | `EMEA`(subset) | Seeded (overlay) |
| IN | `IN` (default) | `APAC`(subset) | Base tables |
| APAC | `APAC` | `APAC` | Seeded (overlay) |
| AFRICA | — | `EMEA`(subset) | **Empty (honest gap)** |
| LATAM | — | `Americas`(subset) | **Empty (honest gap)** |

> `EMEA`/`Americas` are coarser than the canonical set → the crosswalk is **many-to-one upward**
> (EMEA → {EU, ME, AFRICA}) and is labelled `coarse_parent` so no false precision is implied.

## Per-region intelligence surfaces (all EXISTING, composed)
For each canonical region, intelligence = composition of:
- **Competency overlay** — `global_region_content(surface='competency_models')`.
- **Role overlay** — `global_region_content(surface='role_library')`.
- **Benchmark** — `bench_cohorts(cohort_type='region', geography=<code>)` (latent → activate, G4).
- **Demand** — `wos_market_signals(geography=<code>)` + `global_region_content(demand_intelligence)`.

## Coverage truth table (measured)
| Region | Competency | Role | Benchmark | Demand | Verdict |
|---|---|---|---|---|---|
| IN | base 419 | base 5 | base cohorts | 81 global rows | **Native** |
| NA(US) | 419 (inherited) | 5 | 1 region cohort | 5 signals | Partial-native |
| EU | 419 (inherited) | 5 | 1 | 3 | Partial-native |
| ME | 419 (inherited) | 5 | 1 | 3 | Partial-native |
| APAC | 419 (inherited) | 5 | 1 | 2 | Partial-native |
| AFRICA | — | — | — | — | **Empty (honest)** |
| LATAM | — | — | — | — | **Empty (honest)** |

**Honesty stance:** Africa + LATAM are declared regions with **zero content** — reported as empty,
never inheritance-faked. "Supports 7 regions" = the *mechanism* admits 7; *content* exists for 5.
