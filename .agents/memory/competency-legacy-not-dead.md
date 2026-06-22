---
name: Competency legacy namespace is unseeded, not dead
description: Why the empty competency_* tables + legacy /api/competency/* routes must NOT be 410'd or dropped
---

# competency_* "empty" tables are LIVE-WIRED, not dead

The `competency_*` tables (`competency_domains`, `competencies`, `competency_clusters`,
`competency_assessment_items`, etc.) read 0 rows in the shared DB, but they are **empty because
the DB was never seeded** (seed SQL files exist), **not** because the feature was abandoned.

The legacy routes `/api/competency/{domains,competencies,clusters,items}` (+ import/template/ai-draft)
are **live-wired** to `CompetencyAdminPage.tsx` and the `FrameworkPanel` (`framework-configs.ts`,
`useAdminDashboardState.tsx`, `AdminDialogs.tsx`) for full CRUD. The GET handlers `SELECT` straight
from those tables and return `[]` today.

**Rule: do NOT 410 these routes or DROP these tables.**
**Why:** dropping flips the GET handlers from a graceful `[]` to a `42P01` throw → breaks the
Competency admin panel + FrameworkPanel. 410-ing the routes breaks the same screens directly.
"Empty" was mis-read as "dead" in an early cleanup framing; it is not.

**How to apply:** the only safe way to retire the legacy namespace is to FIRST re-point
`CompetencyAdminPage` + `FrameworkPanel` competency config to the canonical `onto_*` routes, migrate
any salvageable seed content into `onto_*` / `competency_question_templates`, and only THEN remove the
legacy routes/tables. That is a deliberate architectural effort, never a blind quarantine/drop.

Canonical surfaces (the keep set): `onto_*` genome + `competency_question_templates` (V1 bank) +
`competency-runtime` scoring. CAF (`/api/caf/*`) and all `ont_*`/O*NET are separate — out of scope.
