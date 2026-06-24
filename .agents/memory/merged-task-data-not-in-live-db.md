---
name: Merged task backfills don't populate the live DB
description: Why a merged "activation" task can leave the shared/production DB empty even after the merge + post-merge setup succeed.
---

# Merged task data backfills do NOT reach the shared/live DB

When an isolated task agent runs a **data backfill / seed script** as part of its work, that data is written to the task agent's **isolated environment DB**, not the main/shared `DATABASE_URL`. On merge, only **code** (and migration DDL via post-merge setup) carries over — **the rows the backfill produced do not**.

**Observed (18 Jun 2026):** tasks #17/#18/#19 reported activation (`mei_scores` 0→101, `cg_user_recommendations` 8→2028, ontology 686 rows) but the shared live DB still showed `mei_scores`=0, `ont_competencies`=0, `cg_user_recommendations`=8, `career_outcomes`=0. The activation **code** merged; the activation **data** did not.

**Why:** task agents run in isolated parallel environments; the platform merges code + runs the post-merge script (migrations/deps), not arbitrary data backfills.

**How to apply:**
- Never infer live-DB activation from a task's reported counts — those are from its isolated env. Query the shared DB directly.
- To actually activate in prod, the backfill/seed scripts (now in the repo) must be **re-run against the live database** and the counts verified.
- In any readiness/audit claim, treat "activation code merged" and "activation data present in live DB" as two separate, separately-verified facts. Seeded ≠ computed ≠ in-the-live-DB.

**Remedy pattern — self-running startup seeder (Task 81, 24 Jun 2026):** when the deliverable is "this data must exist in prod" and there is no deployment yet (or you can't reach prod), don't ship a CLI script nobody will run. Promote the seed into a **startup hook** that fires fire-and-forget at route-registration: a single source-of-truth service exporting (a) `ensure*Schema` mirroring the migration with `IF NOT EXISTS` DDL (the isolated env often lacks the migration since there's no migration runner — the ensure-schema IS the apply mechanism), (b) the seed itself **delete-then-insert by provenance** so it's idempotent, and (c) a guard that probes for the provenance rows and **no-ops once present** (verify: a 2nd restart logs nothing). Refactor any existing CLI scripts into thin wrappers calling the same service so there's no drift. Seed the **data unconditionally** (so publish alone activates it) only when it's observably inert flag-OFF (e.g. excluded by a default-region/baseFilter and behind a 503'd read route); the feature flag then gates only the read surface.
