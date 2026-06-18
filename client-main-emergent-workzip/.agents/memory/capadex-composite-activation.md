---
name: CAPADEX composite intelligence activation
description: How composites/patterns are generated, stored, surfaced, and what type traps exist across the three session tables.
---

## The session_id type alignment

Three related tables had mismatched `session_id` types — a guaranteed JOIN failure:

| Table | Before | After |
|---|---|---|
| `capadex_session_signals` | `character varying` | `uuid` |
| `capadex_session_composites` | `uuid` | `uuid` |
| `capadex_session_patterns` | `uuid` | `uuid` |

Migration run: `ALTER TABLE capadex_session_signals ALTER COLUMN session_id TYPE uuid USING session_id::uuid`
DDL in `signal-capture.ts` updated from `VARCHAR(255)` → `UUID`.

**Why:** Any JOIN between signals and composites/patterns silently broke or threw `operator does not exist: uuid = character varying`. The `USING session_id::uuid` cast is safe as long as all stored values are valid UUIDs (verified before migrating).

**How to apply:** Never use `VARCHAR` for a session_id column that JOINs against a `uuid`-typed table. Always check column types before writing JOIN queries across capadex tables.

## Composite/pattern pipeline flow

1. Signal capture: `POST /api/capadex/session/:id/signal` → writes to `capadex_session_signals`
2. Pipeline fires: `postCompletionHooks` (capadex-enterprise.ts ~line 610) calls `runIntelligencePipeline(pool, sessionId)` fire-and-forget after every session completion
3. Composite engine: reads `capadex_signals` ontology (41 rows, 22 clusters), detects co-activation → writes `capadex_session_composites`
4. Pattern engine: reads composites → writes `capadex_session_patterns`
5. Surface: `GET /api/capadex/session/:id/patterns` returns BOTH `patterns[]` + `composites[]` in one response

## Ontology seeding (capadex_signals)

21 rows seeded in `capadex-signals-seeder.ts` covering:
- `burnout_cluster`, `stress_regulation_cluster`, `career_stress_cluster`, `cognitive_avoidance_cluster`, `hesitation_cluster` (plus 11 supporting rows for related_signals)
- Total: 41 rows, 22 clusters

`seededOnce` flag prevents re-seeding on repeated pipeline calls. Cache bust via `loadCompositeRuntime(pool, true)` after insert.

## Backfill

`backend/scripts/run-backfill.ts` — one-shot idempotent script. Run via:
```
cd backend && npx tsx scripts/run-backfill.ts
```
Processes sessions with signals but missing composites AND sessions with composites but missing patterns (two UNION branches).

## IntelligenceLayers Patterns tab

`IntelligenceLayers.tsx` Patterns tab now shows three sections (in order):
1. **Composite Signal Clusters** — amber-themed cards from `session.patterns?.composites`
2. **Identified Strengths** — green cards from `session.patterns?.positive_factors`
3. **Behavioural Patterns** — neutral cards from `session.patterns?.patterns`

The `/patterns` endpoint returns all three arrays in one call. No separate `/composites` fetch needed.
