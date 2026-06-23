# O*NET Crosswalk Expansion (capability 1 of 5)

**Engine:** `getCrosswalkExpansion` in `services/onet-activation.ts` (composes `computeCrosswalkCoverage` + `getBridgeHealth`).
**Route:** `GET /api/v2/onet-activation/coverage` (flag-gated, read-only).

## What it reports
- **Coverage** (from the existing engine, unchanged): `totalOntRoles` 1,040 · `withCompetencyLinks` 1,021 · `coveragePct` 98.17 · `materializedSnapshots` (live count).
- **Bridge health** — the curated ↔ O*NET role bridge (`map_ont_onto_role`): total, resolved, unresolved, `resolvedByActivation` (rows stamped `onet_activation_resolved`), and `curatedRoles` (cap context).
- **Reference dimensions** — `industriesReference` and `functionsReference` counts.

## Two distinct "coverage" axes (do not conflate)
| Axis | Meaning | Value | Can it reach 500+? |
|---|---|---|---|
| **Role DNA coverage** | O*NET roles reachable as DNA-bearing profiles | 1,021 reachable / 600 materialized | **Yes** — scales with the O*NET library |
| **Curated bridge** | curated `onto_roles` mapped to an O*NET role | 3/5 resolved | **No** — capped at curated role count (5) |

This separation is the core honesty point: the bridge is a **quality** surface (resolve unresolved rows), never a count that grows to library size.

## Industry honesty
O*NET roles carry **no industry dimension** (the hierarchy is role → family → department → function). Industries are surfaced as a separate reference count and are **never force-attached** to a role.

## Rollback / impact
Read-only; no write path. Flag-OFF → 503. No schema impact (reads existing tables + the additive `role_dna_expansion_snapshots`).
