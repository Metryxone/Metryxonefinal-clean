# Phase 7 — Global Scale Layer Activation

**Task:** MX-98X-GAP-CLOSURE-IMPLEMENTATION · Phase 7
**Date:** 2026-06-23 · Additive / reversible / flag-gated. Evidence = `count(*)` + memory `eios-architecture.md`, `employer-tig-architecture.md`.

## Target chain
```
Country → Industry → Occupation Framework → Competency Framework → Assessment → Career Intelligence
```

## Current state (evidence)
- Multi-tenant by design: `tenants` 4 (types school/university/enterprise/government/ngo); `tenant_capability_profiles` 0; `tenant_relationships` 0; `eios_*` 0; `m5_*` pilot 0–5.
- Tenant isolation + Governance V2 RBAC + EIOS pillars exist (structurally multi-everything).
- **International layer absent**: no country/region master, no currency conversion (hardcoded cost in `eios-core.ts`), no data-residency policy; engines are locale-agnostic (frontend `locales/` exists but unused by engines).
- Occupation breadth from O*NET (1,040 roles) is US-centric — no multi-country occupation standard mapping.

## Gap closure (additive, flag `FF_GLOBAL_SCALE_LAYER`, default OFF)
1. **Country / Region master** — new additive reference tables `geo_countries`, `geo_regions`.
2. **Occupation standards mapping** — additive crosswalk `country_occupation_map` (country ↔ occupation framework ↔ `ont_roles`); honest partial coverage (only exact crosswalks reachable — O*NET has no native multi-country dimension).
3. **Framework mapping + localization strategy** — locale field on intelligence envelopes; currency conversion service (additive) replacing hardcoded cost.
4. **Multi-country role + benchmark strategy** — country-scoped benchmark views over existing `ti_*`/`bench_*` (k-anonymity preserved).

## Architecture / Data / API impact
- **Architecture:** new `services/global-scale-layer.ts` + reference tables; no edits to tenant/governance/EIOS engines.
- **Data:** new additive reference + crosswalk tables only; lazy ensure-schema on write path. No existing table altered.
- **API:** additive `GET /api/v2/global/countries`, `GET /api/v2/global/occupation-map/:countryCode` (flag-OFF 503).

## Rollback strategy
- Flag OFF → routes 503; platform stays single-locale exactly as today. Drop new tables to remove.

## Success metrics
- # countries with an occupation→`ont_roles` crosswalk; currency conversion applied where locale set (vs hardcoded).
- k-anonymity preserved on all country-scoped benchmarks (k_min=30) and EIOS heatmaps.

## Expected maturity gain
- Global scale: ~30% → ~55% (international scaffolding + reference data); full depth needs real multi-country tenant data + curated occupation standards.

## Evidence ledger
- Counts → live `count(*)`, 2026-06-23. Tenant/governance/EIOS + i18n state → memory `eios-architecture.md`; international absences asserted from trace (verify before build). Maturity = estimate.
