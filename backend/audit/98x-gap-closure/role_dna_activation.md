# Phase 1 — Role DNA Activation

**Task:** MX-98X-GAP-CLOSURE-IMPLEMENTATION · Phase 1
**Date:** 2026-06-23 · Additive / reversible / flag-gated. Evidence = live `count(*)` + explorer trace of Role DNA services.
**Rule compliance:** no rebuild; O*NET stays reference; `onto_*` genome stays canonical; curated weights remain gold-standard; all new work behind a flag, flag-OFF byte-identical.

## Target chain
```
Industry → Function → Department → Role Family → Role → O*NET Role
   → Role DNA → Competency Requirements → Proficiency Requirements → Assessment Blueprint
```

## Current state (evidence, 2026-06-23)
| Layer | Backing | Rows |
|---|---|---|
| Curated roles | `onto_roles` | 5 |
| O*NET roles | `ont_roles` | 1,040 |
| Curated→O*NET crosswalk | `map_ont_onto_role` (keyed by `onto_role_id` UNIQUE) | 5 |
| O*NET role→competency links | `map_role_competency` | 52,362 |
| Curated role weights | `onto_role_weights` (`source` curated/onet_derived) | 44 |
| Curated role competency profiles (criticality) | `onto_role_competency_profiles` | 14 |
| Materialized DNA snapshots | `role_dna_master_profiles` / `role_dna_profiles_v2` | 0 / 0 |
| Role readiness | `onto_role_readiness` | 1 |

**Honest reading of "crosswalk 5/1040":** `map_ont_onto_role` is keyed by the *curated* role (`onto_role_id` UNIQUE), so 5/5 curated roles are bridged. The real gap is that **only 5 of 1,040 O*NET roles are surfaced as first-class DNA-bearing roles in the `onto_*` space** — even though all 1,040 already carry O*NET competency links in `map_role_competency`. So Role DNA breadth is reachable from *existing data* without new ingestion.

## What already exists (do NOT rebuild)
- `services/role-crosswalk.ts` — `resolveOntRole` / `resolveBestOntRole` / `getRoleCompetencies` (read-only, ranked match: code>exact_title>alias>partial_title, tie-break competencyCount then title length).
- `services/onet-onto-weight-bridge.ts` — `bridgeOnetDerivedWeights` (idempotent: deletes `source='onet_derived'` then rebuilds; curated weights always win; normalizes 0..1).
- `services/role-dna-runtime-engine.ts` — `resolveRoleDNARuntime` (on-demand DNA; writes `role_dna_master_profiles`).
- `services/role-dna-cache-engine.ts` — in-memory LRU keyed by role+context hash.
- `services/functional-competency-seeding-engine.ts` — `seedRoleCompetencies`.

## Gap closure implementation (additive, flag `FF_ROLE_DNA_EXPANSION`, default OFF)
New, isolated, reversible — does **not** edit the engines above:
1. **Crosswalk coverage** — `computeCrosswalkCoverage(pool)`: for every `ont_roles` row, classify bridged (in `map_ont_onto_role`) vs resolvable (via `resolveOntRole`) vs has-O*NET-competency-links (`map_role_competency`). Read-only.
2. **Confidence scoring for role matching** — `scoreRoleMatch()`: deterministic 0..1 from `matchType` (code 1.0 / exact_title 0.85 / alias 0.7 / partial_title 0.5) × competency-link presence. Never fabricated; "no link" → confidence capped + flagged `provisional`.
3. **Automated competency inheritance** — `inheritCompetencies(pool, ontRoleCode)`: derive competency requirements from `map_role_competency` (+ `ont_competencies` names/tiers). Curated `onto_role_weights` ALWAYS override where present (gold-standard precedence preserved).
4. **Role requirement generation** — compose inherited competencies + proficiency targets (from link `proficiency_targets`/importance tier) into a requirements object.
5. **Role benchmark generation** — `generateRoleBenchmark()`: position requirements against `ti_role_benchmarks` (60) / `bench_competency_benchmarks` (195); abstain (null) where no benchmark row — never invent a percentile.
6. **Role DNA generation + materialization** — `generateRoleDNA()` composes (1–5) into a DNA JSONB; `materializeRoleDNA()` (POST-only) writes to a **new dedicated table** `role_dna_expansion_snapshots` stamped `provenance='98x_phase1_expansion'` for clean rollback.

## Architecture impact
- New service `services/role-dna-expansion-engine.ts` + route module `routes/role-dna-expansion.ts` at base `/api/v2/role-dna-expansion`, registered behind the flag. Reuses existing crosswalk/bridge services (composition, not duplication). No change to existing engines, routes, or scoring math.

## Data impact
- **New table only:** `role_dna_expansion_snapshots` (lazy `ensure-schema` on the POST/write path only — GETs use `to_regclass` probe + degrade, never DDL). No existing table altered. No existing row mutated. Curated `onto_*` untouched.
- Writes are confined to the new table and stamped with `provenance` for reversibility.

## API impact
- Additive routes (flag-OFF → 503, byte-identical): `GET /coverage`, `GET /preview/:roleCode`, `GET /materialized`, `POST /materialize`, `POST /rollback`. No existing route signature changes.

## Rollback strategy
- Flag OFF → all new routes 503; zero behavioural change. Full data rollback: `POST /rollback` or `DELETE FROM role_dna_expansion_snapshots WHERE provenance='98x_phase1_expansion'`; `DROP TABLE role_dna_expansion_snapshots`. Nothing else to undo (no migrations to existing tables).

## Success metrics
- Crosswalk/DNA coverage: O*NET roles with a confidence-scored, competency-backed DNA ÷ 1,040 (target ≥95%; honest ceiling = roles with ≥1 `map_role_competency` link).
- Curated precedence preserved: 100% of curated `onto_role_weights` pairs win over derived.
- flag-OFF parity: identical responses with flag on/off for all pre-existing routes (query-spy proof).

## Expected maturity gain
- Role DNA activation: ~10% → ~70% (data exists; this surfaces + materializes it). Structural unchanged (already high). Full 98% awaits curated review of high-volume roles (human-in-the-loop, later phase).

## Evidence ledger
- Counts → live shared-DB `count(*)`, 2026-06-23. Engine functions/signatures → explorer trace this session (`role-crosswalk.ts`, `onet-onto-weight-bridge.ts`, `role-dna-runtime-engine.ts`, `functional-competency-seeding-engine.ts`). Crosswalk keying (`onto_role_id` UNIQUE) → migration `20260622_ontology_hierarchy_completion.sql`.
- Coverage/maturity targets are reasoned estimates from the above, not load-tested metrics.
