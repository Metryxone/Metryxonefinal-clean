---
name: Flag-gated additive phase — three review traps
description: Three traps an architect caught in a flag-gated additive EIOS phase — DDL gating, read-only GET, honest capture counts. Generalizes to any additive flag-gated phase.
---

# Flag-gated additive phase: three traps to avoid

Caught in code review on an additive, flag-gated EIOS enhancement (flag default OFF; contract = "flag-OFF must be byte-identical legacy"). All three generalize to any additive flag-gated phase in this repo.

## 1. "Byte-identical when OFF" includes DB SCHEMA, not just responses
A lazy `ensure*Schema()` that runs at route registration will `CREATE` the new table even when the flag is OFF — so flag-OFF is response-identical but NOT schema-identical.
**Why:** the additive contract is "flag-off → byte-identical prior behaviour"; a new empty table is a visible side effect.
**How to apply:** wrap the additive `CREATE TABLE`/`CREATE INDEX` in `if (isFeatureEnabled())` inside the ensure-schema fn (split the multi-statement query so base tables still always run). Flag ON at boot creates it once; flag OFF never touches schema.

## 2. A read endpoint (GET) must NEVER write
A fire-and-forget `setImmediate(() => capture(...))` on a GET handler makes every dashboard refresh write rows — violates read-only even though it is flag-gated and idempotent (`ON CONFLICT DO NOTHING`).
**Why:** read-only is a stated platform discipline; surprising writes on GET break it and make refreshes mutate data.
**How to apply:** keep ALL writes in an explicit POST (e.g. `/snapshots/capture`); the GET only READS persisted history. For passive accrual use a scheduled job or an explicit UI "Capture" button — never the read path.

## 3. Honest counts come from the DB, not from input cardinality
`res.json({ captured: Object.keys(metrics).length })` after `INSERT ... ON CONFLICT DO NOTHING` lies: it reports "all captured" even when 0 rows inserted (already captured today) or the write errored.
**Why:** "honesty over optimism" — a success count must reflect what actually happened.
**How to apply:** derive per-row outcomes from `result.rowCount` (inserted vs skipped vs error), set `success: errors === 0`, and surface inserted/skipped/errors to the UI verbatim.
