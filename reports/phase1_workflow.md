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
