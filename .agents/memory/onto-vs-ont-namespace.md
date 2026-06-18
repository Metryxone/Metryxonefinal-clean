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
(routine `services/role-dna-seed.ts` → `runRoleDnaSeed`). Both SQL files are idempotent
(CREATE IF NOT EXISTS + ON CONFLICT DO NOTHING). Curated DNA exists for 5 demo roles only
(role_be_eng, role_sr_be_eng, role_eng_manager, role_pm, role_credit_analyst), 7 weights each,
weight_sum=1.0. getRoleDNA returns weights with literal source='curated' (no O*NET-derived rows here).
