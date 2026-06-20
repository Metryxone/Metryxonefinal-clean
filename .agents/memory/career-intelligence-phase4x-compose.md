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

## Phase 4.11 — Career Progression Tracking (the GET-composes-no-engine variant)
4.11 is the first 4.x phase whose **read path composes NO engine at all**. Growth is
inherently longitudinal, so the GET derives all five dimensions purely from history rows —
4.3's `career_readiness_history` ∪ this phase's append-only `growth_tracking` /
`career_history` — read via `to_regclass` + SELECT only. The live engines
(`buildCareerReadiness` + competency `getProfile`) are composed **only on the POST snapshot
write path**, behind `competencyRuntimeReady()`, which appends one `growth_tracking` row and
diffs the previous snapshot to append `career_history` band/role transition events.

**Rule:** because growth needs a series, a dimension with **<2 datapoints is
`measurable:false`** — never extrapolate a delta/direction from a single point.
**Coverage = datapoint count** (how much history exists); **Confidence = longitudinal
strength** (capped `single_datapoint` until repeat snapshots accrue) — two distinct axes,
never merged. Numeric dims (Career/Readiness/Competency Growth) keep delta/direction/
first_score `null` when absent; event dims (Career Movement band-transitions, Role Evolution
anchor-role-transitions) report zero transitions, never a fabricated move. Readiness-history
role is read from the snapshot JSONB, not recomputed.

**Why:** the only honest source of "growth" is two or more real datapoints; the engines
must not run on a GET (would write schema + recompute), so progression can only ever reflect
what prior POST snapshots actually recorded — 0 snapshots → 0% measurable is the truthful
finding, not a gap to paper over.
