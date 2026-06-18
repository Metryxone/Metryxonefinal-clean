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

## Why a backfill can still yield 0 composites/patterns (honest data-density ceiling)

Running the pipeline backfill produces **0 composites and 0 patterns when every session captured only 1 signal**. On the live user base, `MAX(signals per session) = 1` across ALL sessions (each completed session resolves to a single dominant concern signal, `signal_type='activated'`, `severity='high'`). Both gates require ≥2 co-active signals: composites need `ABSOLUTE_MIN_COUNT=2` (`composite-signal-engine.ts`), and domain-concentration patterns need ≥2 signals sharing a domain. So 0 rows is the CORRECT, honest output — NOT a bug, and NOT fixable by activation without fabricating signals.

**Why:** The limiter is upstream signal-capture density (1 signal/session), an item-bank/runtime depth issue, not a wiring gap. The pattern/composite layer is fully wired and fires.

**Second trap:** `seedCapadexSignals` (`capadex-signals-seeder.ts`) is **INSERT-only — it never runs CREATE TABLE**. On a DB where `capadex_signals` was never created by a prior migration, every INSERT throws, the error is caught + logged (non-fatal), `seededOnce` stays false, and the ontology silently never exists → `loadCompositeRuntime` returns 0 definitions. The "41 rows / 22 clusters" figures above assume the table pre-exists. Verify `to_regclass('capadex_signals')` before trusting any composite-readiness claim.

**How to apply:** When asked to "activate" the CAPADEX pattern layer, first check `MAX(n) FROM (SELECT count(*) n FROM capadex_session_signals GROUP BY session_id)`. If it's 1, report the data-density ceiling honestly; don't seed/fabricate to force rows.

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
