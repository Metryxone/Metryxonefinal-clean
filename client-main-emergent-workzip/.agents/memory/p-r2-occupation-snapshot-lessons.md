---
name: P-R2 Occupation Graph & Snapshot Schema lessons
description: Durable rules from expanding occupation_skills/pathways and fixing career_memory_snapshots schema mismatch.
---

## Rule 1 — ensureSchema lazy-triggers are blocked by requireAuth

`ensureBehaviouralMemorySchema` (and similar lazy init functions) only run when the route handler
fires. Routes protected by `requireAuth` reject unauthenticated requests BEFORE reaching the handler,
so a manual `curl` without a token will NOT trigger schema migration.

**Why:** This caused the snapshot schema to appear fixed in code but never apply in the live DB.
The `schemaPromise` stays null until a real authenticated request arrives.

**How to apply:** For schema migrations that must run at startup (e.g., ALTER TABLE to repair an
existing table), either:
- Call the schema function at route-registration time (outside any handler), NOT inside the handler.
- Or apply the migration directly via SQL (executeSql tool) when time-sensitive.

---

## Rule 2 — CREATE TABLE IF NOT EXISTS + index on new column = silent failure

Pattern that caused all snapshot saves to fail:
```sql
CREATE TABLE IF NOT EXISTS t (new_col TIMESTAMPTZ);  -- no-op if t already exists without new_col
CREATE INDEX ON t (new_col);  -- ERROR: column "new_col" does not exist
```

The CREATE TABLE is a no-op (table exists), so `new_col` is never created, then the index
creation throws. The whole multi-statement `pool.query()` rejects, `schemaPromise` caches
the rejection, every subsequent call fails silently.

**Fix:** Split the monolithic `pool.query()` into sequential `await pool.query()` calls so
`ALTER TABLE ADD COLUMN IF NOT EXISTS` runs before the index creation.

---

## Rule 3 — Occupation graph seed: idempotent service file, called at route registration

For large reference-data seeds (occupation → skills, pathways), the pattern that works:
- Separate file `services/occupation-graph-seed.ts`
- Returns `{ skills: number, pathways: number }` count of newly inserted rows
- All INSERTs use `ON CONFLICT DO NOTHING` (idempotent — re-runs are zero-ops)
- Called once at `registerEmployabilityGraphRoutes` startup (not inside a handler)
- Never throws (try/catch per INSERT, silently skips unmatched canonical_title/canonical_name)

---

## Rule 4 — career_memory_snapshots column history

Table was created by `20260519_career_memory.sql` with `captured_at` (9 cols).
Later migration `20260530_behavioural_memory.sql` and `ensureBehaviouralMemorySchema`
both used CREATE TABLE IF NOT EXISTS with `snapshot_at` — both no-ops.

The 12 columns added in P-R2 via ALTER TABLE:
`snapshot_at, current_stage, target_role, transition_probability, core_bottleneck,
market_readiness, interview_readiness, signals, patterns, interventions, outcomes, brain`

Index: `idx_cms_user ON career_memory_snapshots (user_id, snapshot_at DESC)`

**Why:** Future work on snapshot trends / memory deltas must check these columns exist
BEFORE querying. Do NOT assume the migration file = the live schema.
