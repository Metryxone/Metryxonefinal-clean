---
name: Ontology /api/ontology/* namespace collision
description: Two ontology namespaces (curated onto_* reads vs ont_* taxonomy CRUD) shared the same /api/ontology/{entity} URLs; the first-registered GET wins and silently shadows the other.
---

# Ontology API namespace collision (onto_* curated reads vs ont_* taxonomy CRUD)

The bare `/api/ontology/{industries,functions,subfunctions,role-families,roles}` paths were
registered by TWO different route modules with different tables, envelopes, and auth:

- `routes/competency-ontology.ts` — reads the **curated `onto_*`** genome workforce tables,
  PUBLIC (no auth), envelope `{ ok, ontology_version, data }`. This is the documented
  "read-only viewer" API (OntologyExplorer / Benchmark / assessmentOptionsService consume it).
- `routes/ontology-taxonomy.ts` `buildCrud` — reads the **`ont_*` O*NET taxonomy** tables
  (the 12-row seeded set), super-admin gated, envelope `{ items, total }`. The SuperAdmin
  management panels (IndustriesPanel/FunctionsPanel/RoleFamiliesPanel/RolesPanel) read `.items`.

**The trap:** Express runs same-path+method handlers in registration order; the FIRST one that
calls `res.json()` wins. `competency-ontology` registered first, so every admin panel GET got
the curated `{ data }` payload, `data.items` was `undefined`, and the panels showed "0 entries"
even though `ont_industries` had 12 rows. It looked like an empty/unseeded table but was a
route-shadowing bug.

**Resolution / rule:** the bare `/api/ontology/{entity}` paths belong to the **admin CRUD
(`ont_*`)**. The curated `onto_*` reads live under `/api/ontology/curated/*`. `DepartmentsPanel`
was never affected (competency-ontology has no `departments`, only `subfunctions`).

**Two instances of the SAME collision (both fixed by re-namespacing to curated/*):**
1. Workforce taxonomy (`ontology-taxonomy.ts` buildCrud): `industries/functions/role-families/roles`
   (+ `roles/:id/dna`). Curated consumers: OntologyExplorer roles list, Benchmark, assessmentOptionsService.
2. Competency core (`ontology-competency-core.ts`): `competencies`, `competencies/:id`, `layers`
   (NOT `clusters`/`micro-competencies` — those only the core CRUD registers, so they were never
   shadowed; micro-competencies legitimately reads 0 in dev). Symptom: Competency Framework Core
   panel header card (`/api/ontology/competency-core/stats`) showed 136 competencies but the
   Competencies/Layers TABS were blank. Curated consumers moved to curated/*: OntologyExplorer
   (competencies list + detail + layers), Benchmark (layers), EmployerPortal (competency search).

Both curated families share `competency-ontology.ts` (registered FIRST at routes.ts, so it shadows
every later same-path admin module: taxonomy AND competency-core).

**Why:** the two namespaces are disjoint products (see `onto-vs-ont-namespace.md`); sharing one
URL space made one silently shadow the other. Keep their URL spaces disjoint too.

**How to apply:** when a `/api/ontology/*` panel shows 0 despite rows existing, suspect a
duplicate GET registration before assuming an empty table — grep every `app.get('/api/ontology/<entity>'`
across route modules. Curated (onto_*, public, `{data}`) = `/api/ontology/curated/*`; admin
(ont_*, super-admin, `{items}`) = bare `/api/ontology/*`. Bare workforce paths now 401 when
unauthenticated by design.
