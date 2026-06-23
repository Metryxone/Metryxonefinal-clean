# MX-100X Phase 1 — Role DNA Governance & Benchmarks

**Engine version:** `mx100x-p1-1.0.0` · **Flag:** `roleDnaGovernance` (env `FF_ROLE_DNA_GOVERNANCE`, default **OFF**) · **Provenance:** `mx100x_p1_governance`

## What was built (additive, flag-gated, reversible)
A new read-only governance engine + route surface that COMPOSES the existing Role-DNA data
(`ont_roles` inheritance chain + `map_role_competency` requirements) into, per role:
- **Completeness** (Coverage axis): which DNA components actually exist (role/family/department/function resolved + competency links + weight/min/target populated).
- **Confidence** (Confidence axis): link-share-weighted source-provenance trust + competency-link density.
- **Quality**: internal coherence checks (≥3 competencies, has a core competency, `min ≤ target` proficiency ordering, no duplicate competency, positive weights).
- **Explainability trace**: which inheritance level / source supplied each value.
- **Version stamp** on every snapshot.
- **Benchmark availability** across 7 levels (role / competency / department / family / function / readiness / industry).

Coverage and Confidence are reported as **separate axes** — never composited.

## Files
- `backend/services/role-dna-governance-engine.ts` — engine (pure scoring + DB compose + reversible persistence).
- `backend/routes/role-dna-governance.ts` — `/api/v2/role-dna-governance/*` (gating: foundation → flag → auth; writes also require admin).
- `backend/config/feature-flags.ts` — `roleDnaGovernance` flag + `isRoleDnaGovernanceEnabled()`.
- `backend/scripts/role-dna-governance-coverage.ts` — read-only evidence script (per-level coverage %).
- `backend/scripts/smoke-role-dna-governance-write.ts` — write-path reversibility smoke.

## Benchmark coverage (live shared DB, measured)
| Level | Covered / Total | Coverage | Basis |
|---|---|---|---|
| role | 1021 / 1040 | **98.17%** | active roles with ≥1 competency link |
| competency | 158 / 159 | **99.37%** | competencies in ≥2 roles (cross-role distribution) |
| family | 29 / 31 | **93.55%** | role families with ≥2 linked roles |
| function | 25 / 30 | **83.33%** | functions with ≥2 linked roles |
| department | 29 / 43 | **67.44%** | departments with ≥2 linked roles |
| readiness | 1021 / 1040 | **98.17%** | readiness bar derived from each role's target-proficiency profile |
| **industry** | **0 / 206** | **0%** | **NO role↔industry linkage in the `ont_*` chain — abstained, never fabricated** |

## Honesty findings
- **Industry benchmarks cannot be honestly produced.** There is no role↔industry mapping anywhere in the `ont_*` chain (`ont_roles` → `ont_role_families` → `ont_departments` → `ont_functions`; `ont_industries` has 206 rows but no role join). The engine abstains with reason `no_role_industry_linkage` rather than fabricate. (Closing this is downstream O*NET/crosswalk work, out of scope for Phase 1.)
- **Confidence is honestly modest, not inflated.** Most `map_role_competency` links are `onet`/`onet_derived` (trust 0.6–0.7), so typical roles land in the **low** confidence band (~0.67–0.69) even at full completeness; high-density roles (80+ links) reach ~0.82. Completeness (Coverage) is near-universal (1.0) while Confidence is separate and lower — the two axes diverge as intended.
- **19 active roles abstain** (resolved inheritance chain but zero competency links): flagged `abstained: true, abstainReason: 'no_competency_links'`. The requirement-dependent axes — **Confidence and Quality — are null** (cannot assess trust/coherence with no requirements), and all 7 benchmark levels are unavailable. **Completeness** stays a real partial Coverage value (~0.5) honestly reflecting the inheritance chain that genuinely exists, with the absent requirement components enumerated in `missingComponents` — this is the Coverage-vs-Confidence axes diverging, not a fabricated DNA. Fully unresolved roles return null on all three axes (`abstainReason: 'unresolved_role'`).
- Department coverage (67%) is genuinely lower than family/function because several departments contain only single linked roles (cohort < 2) — reported, not smoothed over.

## Reversibility / flag-OFF contract (verified)
- Flag OFF → every route returns 503 before any auth/DB touch (verified: `GET /feature-flag` → 503 `roleDnaGovernance disabled`). Byte-identical legacy behaviour; no schema, no writes.
- GET paths use a `to_regclass` probe + degrade — no DDL on a read.
- Write path: `POST /materialize` lazily ensures `role_dna_governance` then upserts by `(provenance, role_code)`; `POST /rollback` deletes all `provenance='mx100x_p1_governance'` rows. Verified: materialized 5 → rolled back 5 → count 0.

## Reproduce
```
FF_ADAPTIVE_INTELLIGENCE_FOUNDATION=1 FF_ROLE_DNA_GOVERNANCE=1 npx tsx scripts/role-dna-governance-coverage.ts
FF_ADAPTIVE_INTELLIGENCE_FOUNDATION=1 FF_ROLE_DNA_GOVERNANCE=1 npx tsx scripts/smoke-role-dna-governance-write.ts
```
