# O*NET Activation — Strategy (Phase 1, revised)

**Task:** MX-98X-GAP-CLOSURE · Phase 1 "O*NET Activation" (user-approved Option 1)
**Date:** 2026-06-23 · Additive / reversible / flag-gated (`onetActivation`, env `FF_ONET_ACTIVATION`, default OFF).
**Version stamp:** `98x-phase1-onet-activation-1.0.0`

## Honesty finding that reshaped the phase
Live DB evidence (2026-06-23) showed O*NET is **already imported**, not pending:

| Surface | Table | Rows |
|---|---|---|
| O*NET roles | `ont_roles` | 1,040 |
| O*NET role→competency links | `map_role_competency` | 52,362 |
| Role-family benchmarks | `ti_role_benchmarks` | 60 |
| Curated roles (canonical genome) | `onto_roles` | 5 |
| Curated ↔ O*NET role bridge | `map_ont_onto_role` | 5 (3 resolved / 2 unresolved) |
| Materialized Role DNA snapshots | `role_dna_expansion_snapshots` | 0 → **600** (after activation) |

DNA-reachable O*NET roles: **1,021 / 1,040 (98.2%)** — reachable from *existing* data, no new ingestion.

## What "500+ crosswalks" honestly means here
The literal `map_ont_onto_role` bridge is **keyed by the curated role** (`onto_role_id` UNIQUE), so it is hard-capped at the number of curated `onto_roles` (5). It **cannot** grow to 500+ without inventing curated roles — which we refuse to do.

The honest, non-fabricated reading: materialize **500+ Role DNA _profiles_** (ont_role → inherited competency requirements + benchmark positioning + curated precedence where a bridge exists). This scales with the O*NET library (1,021 reachable), so 500+ is real and evidence-backed.

## Approach (no rebuilds, no parallel namespaces)
- A thin orchestrator `services/onet-activation.ts` **composes** the already-live `role-dna-expansion-engine` + `role-crosswalk` into 5 named capabilities. Zero new engines.
- The materialization cap in `materializeRoleDNA` was raised (500/200 → 1100, = full active library) so a single deliberate activation run can persist 500+. The per-request HTTP path never reaches that function (writes are offline-only).
- All runtime routes are **read-only** under `/api/v2/onet-activation/*`; writes happen only in `scripts/activate-onet-role-dna.ts`.

## 5 named capabilities
1. **OnetCrosswalkExpansionEngine** — coverage across all `ont_roles` + bridge health + reference dims (industries/functions reported separately, never role-attached).
2. **OnetRoleIntelligenceEngine** — role resolution + confidence + **O*NET hierarchy context** (family → department → function). Net-new value.
3. **OnetCompetencyInheritanceEngine** — inherited requirements grouped by tier/source (curated precedence applies downstream in DNA).
4. **OnetRoleDnaGenerator** — full Role DNA (curated-over-inherited) + hierarchy context.
5. **OnetBenchmarkFoundation** — benchmark positioning + library-level benchmark coverage (abstains when no matching family row).

## Reversibility
- `scripts/activate-onet-role-dna.ts --rollback` deletes all `provenance='98x_phase1_expansion'` snapshots **and** reverts any activation-resolved bridges (`match_method='onet_activation_resolved'` → `unresolved`).
- Snapshots are **derived reference data** (no user PII), provenance-stamped, purgeable.

## Flag-OFF guarantee
With `onetActivation` OFF, every `/api/v2/onet-activation/*` route returns 503 **before** auth/DB — byte-identical to legacy (existing role-dna-expansion / O*NET routes untouched). Verified: 9/9 routes 503.

## Success metrics (evidence-backed)
- Materialized Role DNA profiles: **600** (target ≥500 ✔).
- Coverage: 98.17% of O*NET roles DNA-reachable.
- Bridge resolution: 3/5 curated bridges resolved; **2 remain honestly unresolved** (`role_be_eng`, `role_sr_be_eng` — no confident O*NET equivalent; abstain rather than force a weak match).
- Smoke: 28/28 PASS (19 service-level + 9 HTTP flag-OFF 503).
