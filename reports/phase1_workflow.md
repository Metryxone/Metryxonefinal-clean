# Competency Assessment — Phase 1 → 1.7 Detailed Workflow & Modules

**Track:** Competency Framework Intelligence (Phase 1 series) · **Date:** 21 June 2026
**Source of truth:** `backend/routes/competency-intelligence.ts` (route markers) + `backend/services/competency-*.ts` (module functions). Flag: `FF_COMPETENCY_FRAMEWORK_INTELLIGENCE` → exposed as `competencyFrameworkIntelligence`.

> **Scope note:** the implemented series is **Phase 1 (foundation) + 1.1, 1.2, 1.4, 1.5, 1.6, 1.7**. **There is no 1.3, and no 1.8–1.15** — those numbers do not exist in code/docs/migrations. This document covers every module that actually exists.

---

## 0. The pattern every sub-phase follows

All sub-phases obey the same additive contract:

```
ensure*Schema()      → lazy DDL (CREATE TABLE/INDEX), runs on POST/seed paths only
run*Seed()           → idempotent population, ADDITIVE over the genome (never mutates onto_competencies)
get*() read views    → public, requireAuth-gated  (flag OFF → 503; flag ON, no session → 401)
admin CRUD + summary → requireAuth + requireSuperAdmin
```

**Invariants (apply to all):** never mutate the 299-row genome (`onto_competencies`); never fabricate competencies; every id references an EXISTING row; flag-OFF is byte-identical to legacy; reads never throw (degrade to honest empty/zeroed).

**The spine → axes shape:**

```
                          ┌─────────────────────────────────────────────┐
   Phase 1 FOUNDATION ───▶│ onto_competencies (299 genome)               │
   (canonical spine)      │ + domains(5)/families(29)/levels(5)/layers(4)│
                          │ + indicators(66)                             │
                          └───────┬──────────┬──────────┬───────────────┘
                                  │          │          │
        ┌─────────────────────────┘          │          └───────────────────────┐
        ▼                                     ▼                                   ▼
  1.1 TYPE axis                        1.2 MASTER axis                     1.4 MICRO axis
  (classify each competency)           (status + 6 eligibility flags)      (parent→child hierarchy)
        │                                     │                                   │
        └──────────────┬──────────────────────┴───────────────────────────────────┘
                       ▼
                1.5 ROLE PROFILE  (role → competency: required level · weight · criticality)
                       │
                       ▼  derive
                1.6 ASSESSMENT FOUNDATION  (profile→blueprint, role→assessment, competency→question)
                       │
                       ▼
                1.7 SEARCH & DISCOVERY  (faceted query/bulk over everything above)
```

`1.7` reads across all layers. The live **assessment runtime** (instances/responses/scores/profiles) consumes `1.6`'s blueprints downstream.

---

## Phase 1 — Foundation (Competency Framework Intelligence spine)
**Service:** `competency-framework-intelligence.ts` · **Version const:** `COMPETENCY_INTELLIGENCE_VERSION='1.0.0'`

**Purpose:** expose the raw competency genome as a governed, read-only "canonical spine" that every later axis hangs off.

**Modules (functions):** `CANONICAL_SPINE` (static descriptor) · `getMasterCompetencies` · `getRoleRequirements` · `getCompetencyLevels` · `getIndicators` · `getTaxonomy` · `buildCompetencyCrosswalk` · `getFrameworkReadiness` (admin).

**Endpoints (public, requireAuth):**
- `GET /api/competency-intelligence/spine` — framework descriptor
- `GET /competencies?domain_id&family_id&q&limit` — genome list
- `GET /role-requirements?role=` — role→competency requirements (read)
- `GET /levels` · `GET /indicators` · `GET /taxonomy` · `GET /crosswalk`

**Tables:** `onto_competencies` (299), `onto_domains` (5), `onto_families` (29), `onto_proficiency_levels` (5), `onto_layers` (4), `onto_indicators` (66), `onto_role_weights` (35), `onto_aliases` (19).

**Workflow:** read genome → resolve taxonomy (domain→family→competency) → join levels/indicators → emit crosswalk. `getFrameworkReadiness` rolls every sub-phase's coverage into the admin readiness report.

**Live state:** ✅ populated, end-to-end functional.

---

## Phase 1.1 — Competency Type Classification
**Service:** `competency-type-classification.ts` · **Version:** `phase-1.1`

**Purpose:** add a **type axis** — classify all 299 competencies into 5 canonical types.

**Modules:** `COMPETENCY_TYPES` (5: behavioral · cognitive · functional · technical · future_skills) · `FUTURE_SKILLS_LEXICON` / `TECHNICAL_LEXICON` / `TECHNICAL_FAMILIES` (classifier inputs) · `classifyCompetency(row)` (deterministic rule engine) · `ensureCompetencyTypeSchema` · `runCompetencyTypeSeed` · `getCompetencyTypes` · `getCompetencyTypeMap` · `getClassificationReport`.

**Endpoints:**
- `GET /types` — the 5-row type master
- `GET /type-map?type&needs_review=1` — every competency's classification
- `GET /admin/.../readiness` · `GET /admin/.../classification-report`

**Tables:** `onto_competency_types` (5) · `onto_competency_type_map` (299).

**Workflow:** `runCompetencyTypeSeed` walks the genome → `classifyCompetency` assigns a type via family/lexicon rules (low-confidence rows flagged `needs_review`) → writes `onto_competency_type_map` (never touches the genome). `getClassificationReport` reports coverage · distribution · confidence · honest content gaps.

**Live state:** ✅ 299/299 classified. **Honest gap:** Future Skills = 0, Technical sparse (a *content* gap the classifier surfaces, not an engine fault).

---

## Phase 1.2 — Competency Master Enhancement
**Service:** `competency-master.ts` · **Version:** `phase-1.2`

**Purpose:** add an **eligibility/status axis** — the enhanced competency entity (status + which downstream products may consume each competency).

**Modules:** `ELIGIBILITY_FLAGS` (6) · `COMPETENCY_STATUSES` (active/inactive/deprecated) · `ensureCompetencyMasterSchema` · `runCompetencyMasterSeed` · `getCompetencyMaster` · `getCompetencyMasterById` · `updateCompetencyMaster` · `getCompetencyMasterSummary`.

**Endpoints:**
- `GET /master?q&type&status&limit`
- `GET /admin/.../master-summary`
- `PATCH /admin/.../master/:id` — edit status + 6 flags (404 if id unknown; never creates)

**6 eligibility flags:** `assessment_eligible · ei_eligible · career_builder_eligible · employer_eligible · learning_eligible · future_ready_eligible`.

**Tables:** `onto_competency_master_ext` (extension row per competency; `source=curated|default`).

**Workflow:** seed creates one extension row per genome competency with default flags → admin curates status/flags via PATCH (stamped `source=curated`) → summary reports per-module eligibility counts + curated-vs-default provenance.

**Live state:** ⚠️ **`onto_competency_master_ext = 0` in the live shared DB** → engine + routes live, but no data (seed not present here). This is the #1 activation gap.

---

## Phase 1.4 — Micro Competency Framework
**Service:** `micro-competency.ts` · **Version:** `phase-1.4`

**Purpose:** add a **hierarchy axis** — parent→child (micro) structure over the genome. A child is EITHER a real linked competency OR a named-only micro (honestly flagged).

**Modules:** `slugify` · `ensureMicroCompetencySchema` · `getMicroFramework` (nested) · `getMicroMapping` (flat) · `createMicroRelationship` / `update` / `delete` · `SEED_FRAMEWORK` · `runMicroCompetencySeed` · `getMicroFrameworkSummary`.

**Endpoints:**
- `GET /micro-framework?parent_id&q&active` · `GET /micro-mapping`
- `GET /admin/.../micro-framework/summary`
- `POST` (create — validates parent & linked child EXIST) · `PATCH /:id` (toggle/reorder/relabel) · `DELETE /:id`

**Tables:** `onto_competency_hierarchy` (parent_competency_id → child_competency_id | micro_label).

**Workflow:** parent must be an existing competency; child is validated-if-linked, else stored as a label-only micro. Summary reports coverage + linked-vs-named provenance.

**Live state:** ⚠️ **`onto_competency_hierarchy = 0` in the live DB** (was 12 in the 19-Jun audit env). Engine functional; relationships need authoring/seeding.

---

## Phase 1.5 — Role Competency Profile Engine
**Service:** `role-competency-profile.ts` · **Version:** `phase-1.5`

**Purpose:** add the **role→competency requirement layer** (required level · weight · criticality). Powers 3 deliverables: Role Profile, Role Matrix, Role Readiness.

**Modules:** `CRITICALITY_TIERS` (critical/important/desirable/optional) · `READINESS_BANDS` · `readinessBand(score)` · `roleFit(score, blockingGaps)` · `getRoleProfiles` · `getRoleProfile` · `getRoleCompetencyMatrix` · `getRoleReadiness` · CRUD · `runRoleCompetencyProfileSeed` · `getRoleCompetencyProfileSummary`.

**Endpoints:**
- `GET /role-profiles?role_id&q&active` — nested role→competency requirements
- `GET /role-matrix` — roles × competencies grid
- `GET /role-readiness/:roleId?actuals=comp:level,...` — weighted gap of actual vs required (no actuals → required structure only, readiness honestly unmeasured)
- `GET /admin/.../role-profiles/summary` · `/role-profiles/role/:roleId` · `POST` / `PATCH /:id` / `DELETE /:id`

**Tables:** `onto_role_competency_profiles` (14), `onto_role_weights` (35); links to `onto_roles` (5).

**Workflow:** each requirement validates role AND competency exist → readiness = Σ(weight × min(actual/required)) banded via `readinessBand`; `roleFit` downgrades when blocking (critical) gaps exist. Genome and roles untouched.

**Live state:** ✅ 14 profiles / 35 weights / 3 role→assessment maps. **Gap:** breadth (only 5 roles).

---

## Phase 1.6 — Assessment Foundation Mapping
**Service:** `assessment-foundation-mapping.ts` · **Version:** `phase-1.6`

**Purpose:** connect the genome to the assessment surface **without redesigning any assessment workflow**. Three deliverables:
1. **Competency → Question** (`onto_competency_question_map`)
2. **Role → Assessment** (`onto_role_assessment_map` → `onto_assessment_blueprints`)
3. **Competency Profile → Blueprint** (`onto_assessment_blueprints` + `onto_blueprint_competency_map`)

**Modules:** `getBlueprints` / `getBlueprint` / blueprint CRUD · `addBlueprintCompetency` / `deleteBlueprintCompetency` · `getRoleAssessmentMap` / `createRoleAssessment` / `deleteRoleAssessment` · `getCompetencyQuestionMap` / `createCompetencyQuestion` / `getMappingGrid` / `bulkMapCompetencyQuestions` / `deleteCompetencyQuestion` · **`deriveBlueprintsFromProfiles`** · **`deriveCompetencyQuestionMap`** (auto-derivation) · `runAssessmentFoundationSeed` · `getAssessmentFoundationSummary`.

**Endpoints:** `GET /blueprints`, `/blueprints/:id`, `/role-assessments`, `/competency-questions`; admin `assessment-foundation/summary` + full CRUD for blueprints, blueprint-competencies, role-assessments, competency-questions.

**Tables:** `onto_assessment_blueprints` (6), `onto_blueprint_competency_map` (28), `onto_role_assessment_map` (3), `onto_competency_question_map` (25 rows).

**Workflow (key — this is where 1.5 feeds assessment):**
```
1.5 role profiles ──deriveBlueprintsFromProfiles──▶ onto_assessment_blueprints
                                                   + onto_blueprint_competency_map
role ──createRoleAssessment──▶ onto_role_assessment_map ──▶ blueprint (is_primary)
competency ──deriveCompetencyQuestionMap / bulkMap──▶ onto_competency_question_map ──▶ existing question bank
```

**Live state:** ✅ blueprints + maps populated. **Honest gap:** `onto_competency_question_map` has 25 rows but covers only **7 distinct competencies of 299** — the bulk of competencies are not yet directly measurable.

---

## Phase 1.7 — Search & Discovery
**Service:** `competency-search.ts` · (no version const — cosmetic only)

**Purpose:** faceted query + bulk operations across the entire framework (genome + type + master + micro + role).

**Modules:** `searchCompetencies(opts)` (faceted, filter groups) · `getCompetenciesByIds` · `getSearchFacets` · `searchMicroCompetencies` · `getSearchSummary` · `bulkOperation`.

**Tables:** none of its own — reads across the layers above.

**Workflow:** build facet groups from live data → filter/paginate → return results + facet counts; `bulkOperation` applies an admin action across a result set.

**Live state:** ✅ functional over the live 299 genome.

---

## Reporting Layer (admin analytics — every sub-phase has one)

Reporting is **not a separate phase** — each sub-phase ships its own read-only report function, and Phase 1's `getFrameworkReadiness` is the **master roll-up** across all of them. Every report follows the same honesty contract: **Coverage (does data exist) and Confidence (is it trustworthy/sufficient) are reported as SEPARATE axes**, every report returns plain-language `findings[]`, empty tables produce an explicit "run the seed …" instruction (never a fabricated number or placeholder).

### Master report — Framework Readiness (roll-up)
**Module:** `getFrameworkReadiness` (Phase 1 foundation) · **Endpoint:** `GET /api/admin/competency-intelligence/readiness`
**Output:** `{ generated_at, spine, assets[], totals }` where each **asset** = `{ spec, coverage_rows, status }` and `status ∈ consumable | empty_pending_import | unknown` (derived from live row count). `totals = { total_assets, consumable, empty_pending_import, unknown }`.
**Workflow:** `safeCount` each declared framework table → derive a per-asset status → aggregate. This is the one call that tells an admin *which sub-phases are data-active vs empty* (e.g. it flags 1.2 / 1.4 as `empty_pending_import` today).

### Per-sub-phase reports

| Phase | Module | Endpoint | Reports |
|---|---|---|---|
| **1.1** | `getClassificationReport` | `/admin/.../classification-report` | coverage · type distribution · classifier confidence · `needs_review` count · honest findings |
| **1.2** | `getCompetencyMasterSummary` | `/admin/.../master-summary` | coverage · status breakdown · per-module eligibility counts (6 flags) · curated-vs-default provenance · findings |
| **1.4** | `getMicroFrameworkSummary` | `/admin/.../micro-framework/summary` | coverage · linked-vs-named-only provenance · findings |
| **1.5** | `getRoleCompetencyProfileSummary` | `/admin/.../role-profiles/summary` | coverage · weight integrity · criticality mix · findings |
| **1.6** | `getAssessmentFoundationSummary` | `/admin/.../assessment-foundation/summary` | `blueprints_total`, `blueprint_competencies_total`, `unbalanced_blueprints` + `blueprint_integrity[]` (weights sum to 100 ±0.5, **reported as-is, never auto-normalised**), `roles_total/roles_mapped/role_coverage_pct`, competency-question links across N distinct competencies vs `questions_available`, source provenance, findings |
| **1.7** | `getSearchSummary` | search summary | `competencies_total/active/deprecated`, `typed` vs `untyped`, domains/families, `micro_competencies`, taxonomy (industries/functions/departments/roles), `type_breakdown[]`, findings |

### How the reports behave honestly (examples pulled from the code)
- **1.6 empty blueprints →** finding: *"No assessment blueprints yet — run the seed to derive blueprints from the Phase 1.5 role competency profiles."*
- **1.6 empty question bank →** finding: *"Competency question mapping is EMPTY because no questions exist in `competency_question_templates` yet — the mapping is infrastructure only; it is never seeded with placeholder questions."*
- **1.6 unbalanced weights →** counted and listed, *"reported as-is, never auto-normalised."*
- **1.7 untyped competencies →** surfaced under an "untyped" filter rather than force-classified.
- **1.4 no micros →** *"No micro-competencies defined yet — micro search returns empty (honest, never seeded with placeholders)."*

### Reporting data flow
```
each sub-phase tables ──get*Summary()──▶ per-phase admin report (coverage/confidence/findings)
                                              │
   onto_* table row counts ──safeCount──▶ getFrameworkReadiness ──▶ master readiness roll-up
                                              │
                                              ▼
                  SuperAdmin UI (CFI tab / RoleCompetencyProfilePanel) renders the reports
```

**Live reporting state:** all report endpoints are live (401-gated). The readiness roll-up currently reports **1.2 (`onto_competency_master_ext`) and 1.4 (`onto_competency_hierarchy`) as empty/pending**, and 1.6 as active-but-thin (7 distinct competencies mapped) — i.e. the reporting layer itself already tells the honest activation story.

---

## Module Reference — Functionality · How to manage · How to access

**Access prerequisites (apply to every module):**
- **Flag:** `FF_COMPETENCY_FRAMEWORK_INTELLIGENCE=1` must be set (it already is, in the `Backend API` workflow). Flag OFF → all endpoints 503 and the UI panels hide.
- **Public reads (`/api/competency-intelligence/*`):** require a logged-in session (`requireAuth`). No session → 401.
- **Admin endpoints (`/api/admin/competency-intelligence/*`):** require a **super-admin** session (`requireAuth` + `requireSuperAdmin`). Log in as `support@metryxone.com` (2FA-gated; in dev read the code from the `mfa_codes` table).
- **UI home:** SuperAdmin Dashboard → the Competency Framework Intelligence area. Each module has its own panel under `frontend/src/components/superadmin/`.
- **Manage via seed:** run from the repo as `cd backend && npx tsx scripts/<seed>.ts`. Seeds are **idempotent and additive** (safe to re-run; never mutate or duplicate the genome). Restart `Backend API` after a new route is added (not needed after a seed).

### Phase 1 — Foundation (spine)
- **Functionality:** governs and exposes the 299-competency genome + taxonomy (domain→family→competency), proficiency levels, indicators, aliases and the crosswalk as a single read-only "canonical spine" every other module hangs off.
- **How to manage:** the genome is curated via SQL migration (the `onto_*` library; there is no runtime genome seed and no genome edit endpoint — it is read-only by design). Content changes go through a migration. The admin **readiness report** is how you monitor it.
- **How to access:** `GET /api/competency-intelligence/{spine,competencies,role-requirements,levels,indicators,taxonomy,crosswalk}` · admin `GET /api/admin/competency-intelligence/readiness`. **UI:** `CompetencyFrameworkIntelligencePanel.tsx`.

### Phase 1.1 — Competency Type Classification
- **Functionality:** assigns each of the 299 competencies one of 5 types (behavioral · cognitive · functional · technical · future_skills) using deterministic family/lexicon rules, flagging low-confidence rows for review.
- **How to manage:** `npx tsx scripts/seed-competency-types.ts` (re-run to re-classify after rule/genome changes). There is no per-row edit endpoint — classification is seed-driven; review quality through the classification report (`needs_review`).
- **How to access:** `GET /types`, `GET /type-map?type=&needs_review=1` · admin `GET /api/admin/competency-intelligence/classification-report`. **UI:** surfaced inside the CFI panel.

### Phase 1.2 — Competency Master Enhancement
- **Functionality:** adds a status (active/inactive/deprecated) and 6 product-eligibility flags (assessment / EI / career-builder / employer / learning / future-ready) to each competency, controlling which downstream products may consume it.
- **How to manage:** seed defaults with `npx tsx scripts/seed-competency-master.ts`, then curate each competency via `PATCH /api/admin/competency-intelligence/master/:id` (stamps `source=curated`; 404 if the id is unknown — never creates a competency). Easiest in the panel.
- **How to access:** `GET /master?q&type&status&limit` · admin `GET .../master-summary`, `PATCH .../master/:id`. **UI:** `CompetencyMasterPanel.tsx`.

### Phase 1.4 — Micro Competency Framework
- **Functionality:** builds a parent→child (micro) hierarchy over the genome; a child is either a linked existing competency or a named-only micro (honestly flagged).
- **How to manage:** seed with `npx tsx scripts/seed-micro-competency.ts`; then add/edit relationships via admin `POST` (create — validates parent & linked child exist), `PATCH /:id` (toggle active / reorder / relabel), `DELETE /:id`. All reversible; genome untouched.
- **How to access:** `GET /micro-framework?parent_id&q&active`, `GET /micro-mapping` · admin `GET .../micro-framework/summary` + POST/PATCH/DELETE. **UI:** `CompetencyMicroFrameworkPanel.tsx`.

### Phase 1.5 — Role Competency Profile Engine
- **Functionality:** defines per-role competency requirements (required level · weight · criticality) and computes Role Profile, Role Competency Matrix, and weighted Role Readiness (actual vs required).
- **How to manage:** seed with `npx tsx scripts/seed-role-competency-profile.ts`; then manage requirements via admin `POST` (validates role AND competency exist), `PATCH /:id` (level/weight/criticality/rationale/active), `DELETE /:id`.
- **How to access:** `GET /role-profiles?role_id&q&active`, `GET /role-matrix`, `GET /role-readiness/:roleId?actuals=comp:level,...` · admin `GET .../role-profiles/summary`, `.../role-profiles/role/:roleId` + CRUD. **UI:** `RoleCompetencyProfilePanel.tsx`.

### Phase 1.6 — Assessment Foundation Mapping
- **Functionality:** connects the genome to the assessment surface via 3 mappings — Profile→Blueprint, Role→Assessment, Competency→Question — without redesigning any assessment flow.
- **How to manage:** seed with `npx tsx scripts/seed-assessment-foundation-mapping.ts` (auto-derives blueprints from Phase 1.5 profiles, and competency→question links once real questions exist in `competency_question_templates`). Then admin-manage blueprints, blueprint-competencies, role-assessments and competency-questions via their CRUD endpoints (and bulk-map). Blueprint weights are validated to sum to 100 but **never auto-normalised**.
- **How to access:** `GET /blueprints`, `/blueprints/:id`, `/role-assessments`, `/competency-questions` · admin `GET .../assessment-foundation/summary` + full CRUD (blueprints, blueprint-competencies, role-assessments, competency-questions). **UI:** `AssessmentFoundationMappingPanel.tsx`.

### Phase 1.7 — Search & Discovery
- **Functionality:** faceted search and bulk operations across all the layers above (genome + type + master + micro + role taxonomy), with facet counts and an "untyped" filter.
- **How to manage:** no seed of its own (it reads the other modules); admins run cross-cutting actions via `bulkOperation` over a result set.
- **How to access:** the search/facets functions (`searchCompetencies`, `getSearchFacets`, `searchMicroCompetencies`, `getSearchSummary`) power the search boxes embedded in the CFI panels. **UI:** search inputs within the CFI / panel surfaces.

### Access at a glance

| Module | UI panel (`components/superadmin/`) | Public read base `/api/competency-intelligence` | Admin base `/api/admin/competency-intelligence` | Seed script (`backend/scripts/`) |
|---|---|---|---|---|
| Foundation | `CompetencyFrameworkIntelligencePanel` | `/spine`, `/competencies`, `/taxonomy`, `/levels`, `/indicators`, `/crosswalk` | `/readiness` | (SQL migration — no runtime seed) |
| 1.1 Type | (in CFI panel) | `/types`, `/type-map` | `/classification-report` | `seed-competency-types.ts` |
| 1.2 Master | `CompetencyMasterPanel` | `/master` | `/master-summary`, `PATCH /master/:id` | `seed-competency-master.ts` |
| 1.4 Micro | `CompetencyMicroFrameworkPanel` | `/micro-framework`, `/micro-mapping` | `/micro-framework/summary` + CRUD | `seed-micro-competency.ts` |
| 1.5 Role Profile | `RoleCompetencyProfilePanel` | `/role-profiles`, `/role-matrix`, `/role-readiness/:roleId` | `/role-profiles/summary` + CRUD | `seed-role-competency-profile.ts` |
| 1.6 Assessment Foundation | `AssessmentFoundationMappingPanel` | `/blueprints`, `/role-assessments`, `/competency-questions` | `/assessment-foundation/summary` + CRUD | `seed-assessment-foundation-mapping.ts` |
| 1.7 Search | (search in CFI panels) | search/facets functions | `bulkOperation` | (none — reads other modules) |

---

## End-to-end runtime sequence (how an assessment actually flows)

The Phase 1 foundations are consumed downstream by the live assessment runtime:

```
[1.1] type ─┐
[1.2] master(eligible)─┼─▶ [1.5] role profile ─derive─▶ [1.6] blueprint + blueprint_competency_map
[1.4] micro ─┘                                              │
                                                            ▼
                                   onto_assembled_assessments (3)  ← assembled from blueprint
                                                            ▼
                                   onto_assessment_instances (15)  ← a taken assessment
                                                            ▼
                                   onto_assessment_responses (66)  ← answers
                                                            ▼
                                   onto_competency_score_runs (2) / onto_competency_scores (12)
                                                            ▼
                                   onto_competency_profiles (8)    ← scored competency profile
```

This proves data has flowed through the foundations end-to-end (not just structurally present) — the runtime tables are populated.

---

## Summary table

| Phase | Module | Public reads | Admin CRUD | Tables (live rows) | State |
|---|---|---|---|---|---|
| **1** | Foundation spine | spine/competencies/levels/indicators/taxonomy/crosswalk | readiness | onto_competencies 299 + taxonomy | ✅ active |
| **1.1** | Type Classification | types, type-map | classification-report | onto_competency_types 5 / type_map 299 | ✅ active (content gap: future/technical) |
| **1.2** | Master Enhancement | master | master-summary, PATCH master/:id | onto_competency_master_ext **0** | ⚠️ empty in live DB |
| **1.4** | Micro Competency | micro-framework, micro-mapping | summary + POST/PATCH/DELETE | onto_competency_hierarchy **0** | ⚠️ empty in live DB |
| **1.5** | Role Competency Profile | role-profiles, role-matrix, role-readiness | summary + CRUD | role_competency_profiles 14 / role_weights 35 | ✅ active (breadth gap) |
| **1.6** | Assessment Foundation | blueprints, role-assessments, competency-questions | summary + full CRUD + derive | blueprints 6 / blueprint_comp 28 / role_assess 3 / question_map 25 (7 distinct comps) | ✅ active (7/299 measured) |
| **1.7** | Search & Discovery | search, facets, micro-search | bulk operation | (reads all above) | ✅ active |

*1.3 and 1.8–1.15 do not exist. Empty tables (1.2, 1.4) are reported as empty, not inflated.*
