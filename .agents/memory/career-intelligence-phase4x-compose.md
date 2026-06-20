---
name: Career Intelligence Phase 4.x compose family (readiness/gap/roadmap)
description: How the additive Phase 4.x career engines compose without writing schema on GET; the unguarded competency-runtime DDL trap they all share.
---

# Career Intelligence Phase 4.x compose family

The Phase 4.x engines (`career-readiness-aggregator.ts` 4.3, `career-gap-engine.ts` 4.4,
`career-roadmap-engine.ts` 4.5) are **additive, flag-gated, compose-only**: each re-shapes
already-computed scores from lower engines and NEVER recomputes them. Each ships its own
flag (`careerReadiness`/`careerGap`/`careerRoadmap`, default OFF), its own append-only
`*_history` table (migration + lazy ensure-schema, DDL only on the POST snapshot path),
and a route file ordered `gate(503) -> requireAuth -> requireSuperAdmin` with literal
sub-paths registered before `GET /:subject`.

## The shared trap: an unguarded transitive DDL on the read path
`buildCareerReadiness` (4.3) calls `computeRoleReadinessV2` **UNGUARDED**, which
transitively runs `ensureCompetencyRuntimeSchema` (CREATE TABLE/INDEX). So ANY engine
that composes role-readiness on a GET path will silently write schema unless it gates
that call.

**Rule:** a read-path composer of role-readiness must gate the call behind a local
`competencyRuntimeReady()` probe that reuses the exported `COMPETENCY_RUNTIME_RELATIONS`
list (the 4 tables + 8 indexes the ensure would create) via `to_regclass`. If not all
present → skip the composed call and degrade to unmeasured. `buildCareerGap` already
self-guards; `buildCareerReadiness` does NOT.

**Why:** the honesty + GET-never-writes contract requires flag-OFF (and every GET) to be
byte-identical including schema. Reusing the exported relation list (not a hand-copied
one) means the probe can never drift from what the ensure actually creates.

**How to apply:** smoke must snapshot `to_regclass` for `<phase>_history` + every
`COMPETENCY_RUNTIME_RELATIONS` entry before/after exercising all GET paths and assert no
change; FRP/EI engines have no CREATE TABLE (safe to compose unguarded). Honesty: unmeasured
subjects → null scores/weeks, empty milestone competencies, timeline is a disclosed
estimate carrying a "NOT a prediction" disclaimer, never fabricated.
