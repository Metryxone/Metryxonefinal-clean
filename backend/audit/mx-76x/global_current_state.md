# MX-76X · Section 1 — Global Current-State Audit

**Date:** 2026-06-24 · **Scope:** read-only · **Evidence:** live shared PostgreSQL (== PROD) row
counts queried directly. **Rule:** activate + extend, never rebuild. Empty = honest gap, never
fabricated. Coverage ⟂ Confidence reported separately.

> All counts below are **measured** from the live DB on the audit date, not inferred from code.

---

## 1.1 Headline finding

MetryxOne is **not** a single-region platform with bolt-on globalisation pending — it already
contains **three independent global/region/country subsystems** plus a country-localization engine.
The work is therefore **reconciliation + activation**, not construction. The two material blockers to
a global PASS are (a) the three region taxonomies are **unreconciled** (different region codes), and
(b) real per-region/per-country *content depth* is thin (5 countries, 4 macro-regions, 0 tenants).

| Axis | Mechanism present? | Real data depth | Verdict |
|---|---|---|---|
| Multi-region (macro) | ✅ Phase 8 overlay | 4 non-default regions seeded | **Activated, shallow** |
| Country tier | ✅ `m4_*` engine | 5 countries | **Activated, shallow** |
| Multi-tenant | ✅ tables + guard | **0 tenants** | **Ready, unexercised** |
| Localization | ✅ 9 report languages | currency hard-coded INR | **Partial** |
| Region-native Role DNA | ❌ no role region dim | — | **Gap (data ceiling)** |
| Global benchmarking | ✅ region cohorts exist | not wired into resolver | **Latent** |

---

## 1.2 Subsystem audit (evidence-backed)

### Tenants — mechanism present, ZERO provisioned
- `white_label_partners`=**0**, `tenant_relationships`=0, `tenant_capability_profiles`=0,
  `tenant_partner_agreements`=0, `tenant_category_assignments`=0, `tenant_channel_referrals`=0,
  `rf_white_label_configs`=0.
- Flags: `tenantManagementConsole`, `tenantIsolationEnforcement`. Middleware
  `createTenantScopeGuard` (`services/tenant/tenant-isolation-enforcement.ts`) is **opt-in**, not
  globally wired (preserves byte-identical legacy paths).
- **Gap:** isolation is structurally ready but unexercised — 0 tenants means tenant-scoping, RLS, and
  per-tenant region/country config are all untested against real data.

### Regions — THREE region systems coexist (the core reconciliation problem)
1. **`global_region_content` overlay (Phase 8, flag `globalCompetency`)** — **2,089 rows**, seeded.
   Macro-regions: `IN` (default → reads base tables) + `ME`/`EU`/`US`/`APAC` (overlay only). Each
   non-default region carries `role_library`=5, `competency_models`=419, `benchmarks`=14,
   `demand_intelligence`=83–86. Universal-inheritance curation + some region-native market rows.
2. **`nhda_regions`** — **15 rows but India-only**: `region_type` ∈ {`national`,`state`}, hierarchy via
   `parent_id`, `country` col (all `IN`), `tenant_id` col (all null). Rows are India national +
   Karnataka/Tamil Nadu/Maharashtra/Delhi, **each seeded 3×** (dedup gap). `nhda_population_signals`=0.
3. **`m4_countries` country tier** — region taxonomy `EMEA`/`APAC`/`Americas` (see below).
- **Region-code collision:** Phase 8 uses `ME/EU/US/APAC`; `m4` uses `EMEA/APAC/Americas`;
  `nhda` uses India sub-national. **No single canonical region taxonomy.** This is the #1 thing to
  reconcile (a crosswalk, not a rebuild).

### Country intelligence (`m4_*`) — REAL foundation, 5 countries
- `m4_countries`=**5** (US `at-will`, DE `codetermination`, AE `statutory`, IN `statutory`, JP
  `statutory`); cols `iso2, name, region, language, labor_regime`.
- `m4_country_workforce_profiles`=5, `m4_cultural_behavioral_norms`=10, `m4_localization_weights`=5,
  `m4_regional_competency_expectations`=7, `m4_regional_language_policies`=5,
  `m4_regional_leadership_models`=5. Service `services/m4-localization.ts`.
- **Gap:** only 5 countries; `m4.region` taxonomy differs from Phase 8 → must crosswalk.

### Role DNA — global-agnostic, no region/country variant
- Curated (`onto_*`, TEXT ids): `onto_roles`=5, `onto_dna_profiles`=5, `onto_role_weights`=44,
  `onto_role_competency_profiles`=14. O*NET (`ont_*`, INT ids): `ont_roles`=**1,040** (1,016 `ONET_*`
  + 24 curated).
- **No region/country column on any role table.** "Software Engineer USA vs India vs Germany"
  variants are **not representable today** (honest gap). O*NET is U.S. DoL data with **no geography
  dimension** → region-native role requirements have a real data ceiling, not a code gap.

### Competency framework — two disjoint ontologies (unchanged by this task)
- Curated `onto_*`: `onto_competencies`=419, `onto_industries`=2, `onto_functions`=3.
- O*NET `ont_*`: `ont_competencies`=160, `ont_industries`=206, `ont_functions`=30,
  `ont_departments`=43, `ont_role_families`=31, `ont_layers`=5, `ont_competency_clusters`=16,
  `map_role_competency`=**52,362**, `map_industry_function`=2,684.
- Crosswalk thin: `map_ont_onto_role`=5, `map_ont_onto_competency`=15. **No region/locale column** in
  competency tables. (Do NOT replace the framework — constraint.)

### Benchmarks — segmentable, region cohorts EXIST but latent, NO country tier
- `bench_cohorts`=19 — `cohort_type`: function=3, global=1, industry=2, layer=4, role=5,
  **region=4** (`APAC`/`EU`/`ME`/`US`); `geography` col present. `bench_competency_benchmarks`=195,
  `bench_cohort_statistics`=15.
- k-anonymity: per-cohort `k_min`, **hard suppression** when `n < k_min`.
- **Gap:** `resolveCohort` (`services/adaptive-benchmark.ts`) supports role/function/industry/layer/
  global but **does NOT yet resolve the `region` cohorts** that already exist in the table → region
  benchmarking is *latent*. No `country` cohort_type at all.

### Localization — strong start, mixed maturity
- `rf_language_packs`=**9**: `ar, bn, de, en, fr, hi, mr, ta, te` (Arabic/German/French + Indian).
- Frontend i18n (`frontend/src/lib/i18n.ts`): `en` + Indian languages (hi/ta/te/kn/ml/mr/bn/gu/pa) —
  **no de/fr/ar/ja in the UI** despite report packs existing → UI localization lags report packs.
- `m4_regional_language_policies`=5. `psychometric_question_bank`=0 (multi-lingual question cols exist
  but bank empty here).
- **Currency:** hard-coded `INR`/`en-IN` in several surfaces (e.g. `ROIERiskPanel`, employer-portal
  defaults). **Not parameterised by country** → a real localization gap.

### Market / demand
- `wos_market_signals`=94: `global`=81, `US`=5, `ME`=3, `EU`=3, `APAC`=2 (region-native, **no
  country granularity**).

### Career Builder / Employer Intelligence / Validation Loop
- `career_readiness_history`=4 (subject-specific snapshots, **not** regionalizable per Phase 8).
- Validation Loop (Phase 7, flag `validationLoop` ON since MX-75X) — **global, no region/country
  dimension**; calibration cohorts not segmented by geography.
- Employer Intelligence (`employerCompetencyHiring`) — **no country/regional hiring-model dimension**.

---

## 1.3 Gap register (classified)

| # | Class | Gap | Evidence | Honest? |
|---|---|---|---|---|
| G1 | **Region** | 3 unreconciled region taxonomies (ME/EU/US/APAC vs EMEA/APAC/Americas vs IN states) | 3 systems, distinct codes | data+design |
| G2 | **Country** | only 5 countries; no country benchmark/cohort tier | `m4_countries`=5; no `country` cohort_type | data ceiling |
| G3 | **Region** | `nhda_regions` India-only + 3× duplicate seeds | 15 rows, all `IN` | data hygiene |
| G4 | **Global** | region benchmark cohorts exist but `resolveCohort` ignores them | `cohort_type='region'`=4, not in resolver | **code (activatable)** |
| G5 | **Localization** | currency hard-coded INR; UI i18n India-only | grep INR; i18n has no de/fr/ar/ja | code+content |
| G6 | **Country** | Role DNA has no region/country variant dimension | no region col on roles; O*NET no geo | data ceiling |
| G7 | **Compliance** | `labor_regime`/language policies stored but **not enforced** anywhere | `m4_countries.labor_regime` unused | design |
| G8 | **Tenant** | 0 tenants; RLS guard opt-in, not wired | all tenant tables=0 | unexercised |
| G9 | **Compliance** | no data-residency / GDPR region handling | no residency cols/routes | design |

**Working components (do NOT rebuild):** Phase 8 region overlay + existence-guarded write path +
audit; `m4-localization` country engine; benchmark k-anonymity suppression; O*NET `ont_*` hierarchy
(`ontologyHierarchyV2`); report language packs (9 langs); tenant isolation guard + RLS scaffolding;
Validation Loop calibration.

---

## 1.4 Activation thesis (feeds Sections 2–14)

1. **Reconcile region taxonomy** with an additive crosswalk (Phase 8 ↔ `m4.region` ↔ `nhda`), never a
   rename — one canonical region set surfaced read-only.
2. **Activate latent capabilities:** wire existing `region` benchmark cohorts into `resolveCohort`
   behind a flag (byte-identical OFF); expose the `m4_*` country layer through a read API.
3. **Extend, don't replace:** country tier stays `m4_*`; role region-variance documented as a data
   ceiling (O*NET has no geography), not faked.
4. **Honest certification:** global *mechanism* is largely PRESENT; global *coverage* is shallow
   (5 countries, 4 regions, 0 tenants) → expect **PARTIAL / CONDITIONAL**, not full PASS.
