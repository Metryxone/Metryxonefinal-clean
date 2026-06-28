---
name: n_live_tup is NOT a population count
description: pg_stat_user_tables.n_live_tup reads 0 for bulk-seeded tables until autovacuum analyzes them — never use it to judge "empty vs populated" in an honesty audit.
---

# n_live_tup is a stale estimate, not a row count

**Rule:** For any audit that classifies a table as EMPTY / DORMANT / LIVE, use exact `SELECT COUNT(*) FROM t`. NEVER use `pg_stat_user_tables.n_live_tup`.

**Why:** `n_live_tup` is a planner estimate maintained by ANALYZE / autovacuum. A table populated by a bulk seed/insert script (the normal way the `onto_*` genome, `map_role_competency`, `frp_*` etc. are loaded) shows `n_live_tup = 0` until autovacuum next analyzes it — which may be never in a dev/shared DB. So `n_live_tup = 0` is **ambiguous**: it cannot distinguish "freshly bulk-seeded, full" from "genuinely empty." Reporting such a table as EMPTY when it actually holds tens of thousands of rows is precisely the fabrication the MX-700 honesty contract forbids (reporting empty when full is as bad as null≠0).

**How to apply:** In the MX-700 constitution audits (and any population/coverage audit), the canonical query is exact-count per table, e.g.
`for t in ...; do psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM $t;"; done`
`n_live_tup` is fine ONLY for a fast "which tables exist" sweep — never for the population verdict.

**Concrete burn (2026-06-28, MX-700):** Phases 1.18–1.22 were measured with `n_live_tup` and under-reported severely. Exact recount showed `map_role_competency`=52,362 (reported 0), `frp_role_evolution`=10,185 (reported 770), `skills`=131 (reported 0), `lip_catalog_courses`=15 (reported 0), `learn_outcomes`=54 (reported 0), `onto_role_competency_profiles`=76 (reported empty→abstains), `onto_competencies`=422 (n_live_tup showed 0). Phase 1.17 was correct because it used exact COUNT(*). Lesson: the genome + career-matching + learning layers are LIVE, not dormant.

**Resolution (which phases were actually wrong):** after exact recount — **1.20 (Intervention), 1.21 (Learning), 1.22 (Career) were MATERIALLY WRONG and were regenerated** (each got a "⚠️ MEASUREMENT-INTEGRITY CORRECTION" head block); **1.18 (Pragati/Conversation) STOOD** (its runtime spine is genuinely 0 by exact count — the method was unreliable but the directional verdict held); **1.19 (Decision) had minor corrections** (demo rows present, not all-0); 1.23 caught the bug and was reconciled to say "regenerated" not "should be regenerated". **Phases 1.24–1.36 were authored AFTER the fix — they all use exact COUNT(*) (cite n_live_tup only as the cautionary lesson) and spot-checking every cited count confirmed them accurate, so they needed NO correction.** Caveat for re-verifiers: `aig_monitoring_metrics` is a continuously-growing runtime telemetry counter (24,388 at authoring → 24,878 later) — such live counters legitimately drift; a point-in-time exact count is still honest, do NOT treat the drift as a measurement error.
