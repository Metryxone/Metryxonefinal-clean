---
name: GET-never-writes vs lazy ensure-schema
description: Composing engines that promise "POST-only writes / GET never writes" must keep ALL DDL off GET paths — lazy ensureSchema is a hidden write.
---

# "GET never writes" vs lazy ensure-schema

A read-only composing engine (e.g. CEI — Competency Employability Intelligence,
`competency-employability-engine.ts`, flag `competencyEi`/`FF_COMPETENCY_EI`)
that advertises **append-only snapshots via POST only, GETs never write** is
violated the moment a GET-backed handler calls a lazy `ensure*Schema()` that runs
`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX`. The first GET with the flag ON then
performs DDL — a write.

**The rule:** keep the DDL (`ensure*Schema`) on the **explicit POST write path
ONLY**. Every GET-backed read (history / admin-overview / validation) must:
- use a **read-only existence probe** — `SELECT to_regclass('public.<table>')` —
  never CREATE; and
- **degrade gracefully** when the table is absent: empty history `[]`, zeroed
  overview object, validation stage = `gap` (not `fail`) with detail
  "created lazily on first POST capture".

**Why:** the architect review failed the build on exactly this — lazy ensure-schema
reached from three GET routes. It is invisible in normal testing because the table
usually already exists from a prior POST, so the DDL is a silent no-op until a fresh
environment hits a GET first.

**How to apply:** whenever a feature claims read-only GETs + append-only writes,
grep the GET handlers for any `ensure*Schema`/`CREATE`/`ALTER` reachable from them.
A `to_regclass` IS-NULL check is the read-only substitute. Absent table on a
validation/health check is a GAP, never a FAIL.
