# MX-76X · Section 14 — Global Deployability Certification

**Verdict: PARTIAL (Mechanism PRESENT · Content SHALLOW).**
Honesty-first: this certifies REAL, live-verified activation — not aspiration. Coverage and
Confidence are reported as separate axes; `null`/absent is an honest gap, never a fabricated `0`.

> **Scope of certification.** This certifies the **read-only Global Intelligence activation layer**
> (flag `globalIntelligence`) shipped in this task, composed over the pre-existing global assets. It
> does NOT certify content depth that does not exist (region-native role data, country benchmarking,
> tenant provisioning).

## Dimension scorecard

| # | Dimension | Mechanism | Content / Activation | Status |
|---|---|---|---|---|
| 1 | Region architecture (7 canonical) | Crosswalk reconciles 3 live taxonomies (Phase-8 / m4 / nhda) | 5/7 have content; AFRICA + LATAM **empty** (honest) | **PARTIAL** |
| 2 | Region content overlay | `global_region_content` overlay live | ME/EU/US/APAC overlays + IN base; competency/roles inherited not region-authored | **PARTIAL** |
| 3 | Country localization (m4) | `m4_*` engine reused, currency resolver | **5** countries (US/DE/AE/IN/JP); all others `not_localized` | **PARTIAL** |
| 4 | Role DNA (region/country) | Inheritance contract + `variant:null` | **No region-native source** (O*NET has no geography) → universal inherit only | **NOT ACTIVATED (honest)** |
| 5 | Benchmarks (region tier) | `bench_cohorts(region)` surfaced read-only | Region cohorts **latent** (not yet in resolver); country tier `not_measurable` | **PARTIAL** |
| 6 | Localization (language/currency) | 9 report packs, currency resolver | UI bundles India-centric; `report_only` langs lag; **no FX** | **PARTIAL** |
| 7 | Multi-tenant governance | Tenant tables + RLS pattern exist | **0 tenants** — mechanism documented, not exercised | **NOT ACTIVATED (honest)** |
| 8 | Employer global intelligence | Country context = advisory layer | Calibration stays global/region; no country-native calibration | **PARTIAL (advisory)** |
| 9 | Candidate global intelligence | Region/country localized career view (spec) | Endpoints live; candidate panel wiring staged | **DESIGN-COMPLETE** |
| 10 | SuperAdmin global console | `GlobalIntelligencePanel` live + flag-gated | Wired, builds clean, honest empty states | **PASS** |
| 11 | Reversibility / byte-identical OFF | Flag-OFF → 503 before DB touch; zero DDL | Verified via curl + live logs | **PASS** |

## What is genuinely deployable today
- India (default region): **byte-identical** to today — zero regression risk.
- US / DE / AE / JP: localized **country context** (workforce/leadership/culture/currency) as an
  advisory frame over global competency + region demand overlays.
- ME / EU / US / APAC: region demand + overlay content surfaced read-only with honest provenance.
- A SuperAdmin can monitor real global coverage with honest "Insufficient Evidence" / "Not Measurable"
  states — no fabricated metrics.

## What is NOT deployable / honest gaps
- AFRICA, LATAM: **no content** (declared, empty).
- Region-native **Role DNA**: not representable (no geography dimension in any role source).
- **Country benchmarking**: not measurable (no country cohort, no ≥k_min country population).
- **Multi-tenant** isolation: 0 tenants provisioned.
- **FX conversion**: none (currency is display formatting only).

## Reversibility proof
- `globalIntelligence` default **OFF** → every `/api/global-intel/*` route returns **503 before any DB
  read** (verified: curl + live backend logs). No new tables, no `ensure-schema`, no migration → schema
  byte-identical. SuperAdmin tab omitted entirely when OFF. **Fully reversible.**

## Path to full activation (no rebuild required)
1. Author region-native competency/role overlays for ME/EU/US/APAC (replace inherited with native).
2. Add AFRICA/LATAM overlays + at least one localized country each.
3. Wire `bench_cohorts(region)` into `resolveCohort` (region tier already populated).
4. Acquire licensed per-country labour-market sources → populate a `role_dna_variant` overlay.
5. Provision real tenants + exercise RLS.
6. Expand UI language bundles to match report-pack breadth; add an FX source if monetised globally.
