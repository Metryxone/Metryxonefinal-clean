---
name: Global Intelligence composer (MX-76X) — never-throws across reused readers
description: A read-only "never-throws + to_regclass-probed" GET composer does NOT inherit those guarantees from the engines it reuses; wrap reused unprobed readers.
---

# Global Intelligence read-only composer (MX-76X)

`backend/services/global-intelligence.ts` (+ `routes/global-intelligence.ts`, flag
`globalIntelligence` / `FF_GLOBAL_INTELLIGENCE`, default OFF) is a PURE read-only composer over the
ALREADY-EXISTING global assets — it adds **zero tables, zero DDL, GET-only**. Region picture comes
from `global_region_content` overlay + `wos_market_signals` + `bench_cohorts`; country tier REUSES
`createLocalization` (m4_*); role DNA reads `onto_role_weights`.

## The durable trap: a composer's never-throws contract stops at code YOU wrote
The composer's own SELECTs are `to_regclass`-probed and never-throw. But `gi.country()` delegates to
the reused `createLocalization.profile()`, which SELECTs several `m4_*` tables **without** probing. A
missing/drifted dependent table there throws → the GET 500s → contract violated. The reused engine
does NOT inherit your honesty contract.

**Fix / rule:** when a "never-throws / probed-reads" GET composes a reused reader, wrap that reused
call in try/catch and DEGRADE (return base facets + a `*_degraded:true` flag), never let it 500. Don't
assume the upstream engine probes — verify or wrap.

## Other honesty anchors baked in (don't regress)
- **3 live region taxonomies** reconciled by an additive crosswalk (no renames): Phase-8 overlay
  (ME/EU/US/APAC + IN default) ↔ `m4_countries.region` (EMEA/APAC/Americas, COARSE parent) ↔
  `nhda_regions` (India national/state). AFRICA & LATAM are declared canonical but have ZERO content →
  status `empty` (honest, never a fabricated 0).
- **IN is default** → reads BASE tables (status `native`, coverage shows `'base'`); other regions are
  overlay-only (`partial_native` because competency/roles are INHERITED, not region-authored).
- **Region benchmark cohorts EXIST** (`bench_cohorts.cohort_type='region'`) but are surfaced read-only
  only — NOT yet wired into `resolveCohort` (deliberate, to avoid destabilising benchmark consumers).
  Country benchmarking is `not_measurable` (no country cohort + no ≥k_min population).
- **Role-DNA region/country variant is `null` by design**: no role table carries a geography dimension
  and O*NET (the breadth source) has no geography → universal inherit is the honest resting state.
  Never fabricate a variant.
- **Currency** = display formatting only (`resolveCurrency` → ISO4217 + locale, default INR so India
  stays byte-identical). `fx_conversion:false` — no honest FX source. `DEFAULT_CURRENCY` is an OBJECT
  `{currency,locale}` not a string (frontend must render `.currency`, not the object).
- SuperAdmin surface: `superadmin/GlobalIntelligencePanel.tsx`, gated by a `/api/global-intel/enabled`
  probe (flag OFF → 503 → tab omitted → byte-identical dashboard), mirroring the global-competency tab.

## Honest status
PARTIAL — mechanism broadly PRESENT, content SHALLOW (5/7 regions, 5 localized countries, 0 tenants,
no region-native role DNA). Deliverables + scorecard in `backend/audit/mx-76x/`.
