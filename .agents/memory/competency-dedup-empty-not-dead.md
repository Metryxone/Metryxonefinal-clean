---
name: Competency dedup — "empty in dev" is NOT "dead"
description: Why the legacy competency_* build can't be deleted, and the engine-summary single-query darkening bug.
---

# Competency duplication: empty-in-dev ≠ dead

The professional Competency Assessment exists in parallel namespaces. Only one is populated in dev:
- **Current/populated**: `onto_*` (genome) + `competency_question_templates` (V1 question bank) + V2 runtime routes.
- **Legacy/empty-in-dev**: `competency_*` (`competency_domains`/`competencies`/`competency_clusters`/`competency_assessment_items`/`competency_library`) — **all 0 rows in dev**.

## The trap
The legacy `competency_*` tables look "dead" (0 rows) but are **wired to live UI**:
- Routes `/api/competency/{items,domains,competencies,clusters}` are actively called by the **routed** `CompetencyAdminPage` (screen `admin-competency`) AND the FrameworkPanel competency config (`framework-configs.ts`).
- The legacy static bank `ASSESSMENT_QUESTIONS` (`data/catalogs/assessment-questions.ts`) is imported by live engine code (`lib/engines/scoringEngine.ts`, `competencyStore.ts`, `careerEvents.ts`).
- The `AdaptiveAssessmentRuntime` `?debug=1` block in `CareerBuilderPage` is an **intentional engineer preview** (its own comment says so), not abandoned code.

**Why:** they are empty only because the dev DB was never seeded (seed files exist: `scripts/seed-competency-framework.sql`, `seed-competency-library.sql`). Empty rows ≠ abandonment.

**How to apply:** do NOT 410 these routes or drop these tables as "dead build" cleanup — it breaks the admin panel and scoring engine. Converging the duplication is an ARCHITECTURAL decision (retire `competency_*` and re-point the admin UI to `onto_*` FIRST), not a delete-the-empties job. `ont_*`/`map_role_competency` are O*NET, seeded in prod only — also not dead.

## engine-summary single-query darkening
`GET /api/competency/engine-summary` (`routes/competency-cohorts.ts`) used to run ONE combined SQL over 8 counts that included `competency_stage_norms` + `competency_role_weights`, both **MISSING** in dev → the whole query threw → `next(err)` → the admin "Live Database Counts" card showed "Live counts unavailable" (the visible symptom that made every tab look broken).
**Fix:** per-table `to_regclass`-guarded counts — missing table → `null` (frontend filters/hides null), present-but-empty → `0`, never throws. Log a real count failure (table exists but query fails) so genuine faults stay observable instead of masquerading as absence.
