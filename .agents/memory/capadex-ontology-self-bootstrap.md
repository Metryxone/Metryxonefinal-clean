---
name: CAPADEX 4-tier ontology self-bootstrap
description: Which CAPADEX tables auto-create vs which need a shared ensure; existence ≠ population.
---

# CAPADEX 4-tier signal ontology — self-bootstrap

The 4-tier signal ontology reference tables (`capadex_domains`, `capadex_families`,
`capadex_signals`, `capadex_atomic_signals`) canonical shape lives in
`migrations/20260528_signal_ontology_tables.sql`. There is no migration runner.

**Rule:** the single canonical TS mirror is `services/signal-ontology-schema.ts`
→ `ensureSignalOntologySchema(pool)` (cached, idempotent, FK NOT VALID guarded by
`duplicate_object`). The signals seeder, the concern→signal mapping engine, and the
ontology-hub admin panel all import it — never re-author the DDL inline, never read
the .sql file at runtime.

**Why:** before this, only the ontology-hub panel (lazy .sql file read) or the
manual seed script created the Tier 1/2/4 tables. The mapping engine's
`loadMappingOntology` reads `capadex_signals` + `capadex_atomic_signals` and on a
fresh DB threw "relation does not exist". The old seeder ensure created Tier-3 only.

**How to apply:** any new code path that reads/writes a tier table must call
`ensureSignalOntologySchema(pool)` first. The runtime spine tables
(`capadex_session_signals/composites/patterns`, `capadex_evidence`,
`capadex_concern_signal_map`) already self-bootstrap via their own ensure*Schema /
route-registration DDL — don't duplicate them here.

**Existence ≠ population trap:** ensuring the tables makes them EXIST (empty), which
is enough for `to_regclass(...)` non-null and for never-throw reads, but the
20/400/20/15,972 reference rows still come only from the manual seed script. Empty
ontology ⇒ composite/pattern runtime + mapping engine yield empty results (honest,
not a bug). Auto-population is a separate concern.
