# MX-76X · Activation Summary (T003)

What was **built** (strictly additive, flag-gated `globalIntelligence`, default OFF):

## New code (zero DDL, GET-only, compose-never-recompute)
- `backend/services/global-intelligence.ts` — PURE read-only composer. Reuses the existing
  `createLocalization` (m4 country engine); SELECTs (to_regclass-probed) from `global_region_content`,
  `bench_cohorts`, `wos_market_signals`, `onto_role_weights`, `rf_language_packs`. Pure config:
  `REGION_CROSSWALK` (canonical 7 ↔ Phase-8 ↔ m4) + `resolveCurrency` (country→ISO4217, default INR).
- `backend/routes/global-intelligence.ts` — 8 read-only routes under `/api/global-intel/*`.
- `backend/config/feature-flags.ts` — new flag `globalIntelligence` (default `false`).
- `backend/routes.ts` — registration next to `registerGlobalCompetencyRoutes`.

## Endpoints
| Route | Auth | Returns |
|---|---|---|
| `GET /enabled` | flag only | `{enabled:true}` probe (UI tab gating) |
| `GET /regions` | auth | canonical 7 regions + crosswalk + coverage |
| `GET /countries` | auth | m4 localized countries + currency + region binding |
| `GET /country/:iso2` | auth | composed country profile (404 → `not_localized`) |
| `GET /benchmarks` | auth | benchmark tier coverage (region tier latent) |
| `GET /role-dna/:roleId` | auth | base DNA + `variant:null` inheritance |
| `GET /localization` | auth | report vs UI langs + currency resolver |
| `GET /overview` | super-admin | full composed view |

## Reversibility / byte-identical OFF (verified)
- Flag OFF → all routes 503 **before any DB touch** (verified via curl: 503 on every route).
- No new tables, no `ensure-schema`, no migration → schema byte-identical OFF.
- All reads `to_regclass`-probed + never-throws → a missing table degrades to empty, never errors.

## What was deliberately NOT done (honesty)
- **No `resolveCohort` mutation.** The latent `bench_cohorts(cohort_type='region')` tier is surfaced
  read-only by the composer; wiring it into the shared benchmark resolver is left as a follow-up to
  avoid destabilising existing benchmark consumers. (Documented in `global_benchmark_framework.md`.)
- **No `role_dna_variant` table created** — there is no region/country role source, so the table would
  be empty; `variant:null` (inherited) is the honest state. The additive surface is specified in
  `global_role_dna_framework.md` for when licensed sources exist.
- **No FX conversion** — currency is display formatting only (no honest FX source).
- **No tenant provisioning / RLS wiring** — 0 tenants; mechanism documented, not exercised.

## Live smoke (direct service call, live DB)
`overview()` → 7 canonical regions (5 with content; AFRICA/LATAM empty), 5 localized countries,
benchmark tiers `{region:4, layer:4, industry:2, role:5, function:3, global:1}`, 9 report languages.
`country('US')` → USD/en-US; `country('BR')` → `null` (not_localized). `roleDna(...)` → `variant:null`,
`source:'inherited_universal'`.
