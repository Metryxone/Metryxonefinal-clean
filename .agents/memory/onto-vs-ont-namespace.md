---
name: onto_* vs ont_* competency-ontology namespace split
description: Two disjoint competency-ontology table families; the Role DNA endpoint reads onto_*, the runtime seeder fills ont_*.
---

There are TWO separate competency-ontology table families that are easy to confuse:

- `onto_*` (with trailing "o"): onto_domains/families/competencies/roles/dna_profiles/role_weights/layers/...
  Read by `services/competency-ontology.ts` and the Role DNA endpoint
  `GET /api/ontology/roles/:id/dna`. Seeded ONLY by the SQL migration pair
  `20260523_competency_ontology_phase1.sql` (schema) + `20260523_competency_ontology_seed.sql` (data).
- `ont_*` (no trailing "o"): ont_roles/ont_role_families/ont_layers/...
  Seeded by `services/ontology-seed.ts` (`runOntologySeed`, runner `scripts/ontology-seed-run.ts`).
  This seeder NEVER touches DNA and is irrelevant to the Role DNA endpoint.

**Why this matters:** the project has NO migration runner, so on a fresh dev DB the `onto_*`
tables are created empty and the Role DNA pane renders nothing. Running `runOntologySeed`
does NOT fix it (wrong namespace). The fix is to apply the two `onto_*` SQL files.

**How to apply:** `cd backend && npx tsx scripts/seed-role-dna.ts`
(routine `services/role-dna-seed.ts` → `runRoleDnaSeed`; this ALSO seeds the curated `onto_*`
taxonomy — industries/functions/subfunctions/role_families/roles/competencies — not just DNA
weights, despite its summary only printing roles/dna/weights/competencies). Both SQL files are
idempotent (CREATE IF NOT EXISTS + ON CONFLICT DO NOTHING). Curated DNA exists for 5 demo roles
only (role_be_eng, role_sr_be_eng, role_eng_manager, role_pm, role_credit_analyst), 7 weights
each, weight_sum=1.0. getRoleDNA returns weights with literal source='curated'.

**SuperAdmin Competency-Ontology panel serving (route shadowing):** the panels
(`components/superadmin/*Panel.tsx`) ALL hit `/api/ontology/*`, but the tabs are served by TWO
different route files and split across BOTH namespaces:
- `routes/competency-ontology.ts` registers FIRST (public, no auth) and therefore SHADOWS the
  `ont_*` taxonomy read routes for the OVERLAPPING entities: industries, functions, role-families,
  roles, layers, competencies → these render the `onto_*` curated set (small: 2/3/4/5/4/299).
  The richer `ont_*` rows (12 industries / 15 functions / 24 roles) exist but are UNREACHABLE.
- Non-overlapping tabs are served by the auth-gated `ont_*` handlers and render `ont_*` rows:
  departments(20), competency-clusters(12), micro-competencies(20), concerns(8), indicators(12),
  competency-level-anchors(120).
**So fully populating the panel set needs BOTH seeds** (`ontology-seed-run.ts` for `ont_*` +
`seed-role-dna.ts` for `onto_*`). `n_live_tup`/`pg_stat_user_tables` is a stale estimate right
after a seed (showed onto_* = 0 while the live endpoint already returned rows) — always verify
populated state with `SELECT COUNT(*)`, never the planner estimate.
Six tabs have NO authored seed (career-tracks, career-paths, learning-paths, future-skills,
benchmarks, ai-rules) — their only INSERTs are admin CRUD/import routes; they need a real import
(e.g. O*NET) and must stay empty rather than be fabricated.
