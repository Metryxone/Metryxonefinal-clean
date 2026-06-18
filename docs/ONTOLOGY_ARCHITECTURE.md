# MetryxOne Competency Ontology — Architecture Reference

> **Single source of truth.** All ontology tables, mappings, and governance rules are documented here.
> Engine internals → `docs/CAPADEX.md`. Phase history → `docs/phase-history.md`.

---

## 1. Overview

The MetryxOne Competency Ontology is a **12-layer hierarchical taxonomy** that defines every measurable human capability from macro (Industry) down to atomic (Assessment Question). It bridges:

| Bridge | Tables |
|--------|--------|
| CAPADEX behavioural concerns | `ont_concerns.concern_bridge_tag` → `concerns_master.relational_bridge_tag` |
| Competency Assessment Factory | `ont_assessment_questions.caf_question_id` → `caf_question_bank.id` |
| Career Builder roles | `ont_roles.id` → `map_role_layer.role_id` |
| LBI / SDI frameworks | `ont_competencies.external_ref` (SFIA/O\*NET/SDI code) |

---

## 2. The 12-Layer Hierarchy

```
Industry (ont_industries)
 └─ Function (ont_functions)
     └─ Department (ont_departments)
         └─ Role Family (ont_role_families)
             └─ Role (ont_roles)
                 └─ Layer (ont_layers)                       ← proficiency / functional / behavioral…
                     └─ Competency Cluster (ont_competency_clusters)
                         └─ Competency (ont_competencies)
                             └─ Micro Competency (ont_micro_competencies)
                                 └─ Concern (ont_concerns)
                                     └─ Indicator (ont_indicators)
                                         └─ Assessment Question (ont_assessment_questions)
```

Each layer has a `status` lifecycle: `draft → in_review → approved → published → deprecated → archived`.

---

## 3. Table Reference

### 3.1 Taxonomy Foundation (existing — `ontology-taxonomy.ts`)

| Table | Prefix | Key Columns |
|-------|--------|-------------|
| `ont_industries` | `IND_` | code, name, sic_code, naics_code |
| `ont_functions` | `FUNC_` | code, name, industry_id |
| `ont_departments` | `DEPT_` | code, name, function_id |
| `ont_role_families` | `RF_` | code, name, department_id |
| `ont_roles` | `ROLE_` | code, name, role_family_id, seniority_level |
| `ont_indicators` | `IND_` | code, name, polarity (+/-), weight |
| `ont_benchmarks` | `BENCH_` | code, name, role_id, proficiency_level |

### 3.2 Core Framework (NEW — `ontology-competency-core.ts`)

| Table | Prefix | Key Columns |
|-------|--------|-------------|
| `ont_layers` | `LAYER_` | code, name, layer_type, scoring_weight |
| `ont_competency_clusters` | `CLUS_` | code, name, layer_id (soft), category, weight_default |
| `ont_competencies` | `COMP_` | code, name, cluster_id, competency_type, is_threshold, is_measurable, development_guide, external_ref |
| `ont_micro_competencies` | `MC_` | code, name, competency_id, proficiency_level, observable_behavior, absence_indicator, irt_b/a/c |

### 3.3 Behavioural Mapping (NEW — `ontology-concerns-mapping.ts`)

| Table | Prefix | Key Columns |
|-------|--------|-------------|
| `ont_concerns` | `CONC_` | code, name, severity, domain, concern_bridge_tag, capadex_concern_id, primary_persona, age_min/max |
| `ont_assessment_questions` | `Q_` | code, stem, assessment_type, response_format, polarity, reverse_score, difficulty_tier, irt_b/a/c, source, caf_question_id, clarity_question_id |
| `ont_question_options` | — | question_id, option_key, option_text, score_value |

### 3.4 Mapping Tables

| Table | Cardinality | Key FKs |
|-------|-------------|---------|
| `map_role_layer` | Role → Layer | role_id, layer_id, weight |
| `map_layer_cluster` | Layer → Cluster | layer_id, cluster_id, weight |
| `map_cluster_competency` | Cluster → Competency | cluster_id, competency_id, weight |
| `map_competency_micro` | Competency → Micro | competency_id, micro_competency_id |
| `map_micro_concern` | Micro → Concern | micro_competency_id, concern_id, emergence_probability |
| `map_concern_indicator` | Concern → Indicator | concern_id, indicator_id, weight, is_primary |
| `map_indicator_question` | Indicator → Question | indicator_id, question_id, weight, is_primary |
| `map_micro_question` | Micro → Question (direct) | micro_competency_id, question_id |
| `map_competency_future_skill` | Competency → Future Skill | competency_id, future_skill_id, alignment_score |
| `map_industry_competency` | Industry → Competency | industry_id, competency_id, importance_weight |
| `map_competency_learning_path` | Competency → Learning Path | competency_id, learning_path_id |

### 3.5 Reference Tables (NEW — seeded at startup)

| Table | Contents |
|-------|----------|
| `ref_seniority_levels` | 11 levels (Intern → C-Suite) |
| `ref_proficiency_levels` | 5 levels (Novice → Expert) with score bands |
| `ref_competency_categories` | 7 categories (Technical, Behavioural, Leadership…) with colors |
| `ref_assessment_types` | 10 types (Behavioural, Technical, SJT, 360…) |
| `ref_lifecycle_transitions` | Allowed status transitions per entity type |

### 3.6 Version Control Tables (NEW — append-only)

| Table | Purpose |
|-------|---------|
| `ver_entity_snapshots` | Full JSONB snapshot per entity per version |
| `ver_change_history` | Field-level before/after change log |

### 3.7 Lifecycle Tables (NEW — append-only)

| Table | Purpose |
|-------|---------|
| `lfc_status_events` | Every status transition with actor, timestamp, note |

### 3.8 Governance Tables (NEW)

| Table | Purpose |
|-------|---------|
| `gov_review_schedules` | Per-entity-type periodic review cadence |
| `gov_review_instances` | Individual review outcomes |
| `gov_quality_gate_rules` | Configurable quality checks (field_required, cardinality, etc.) |

---

## 4. API Surface

### Core Framework — `/api/ontology/`

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/layers` | List / create layers |
| GET/PATCH/DELETE | `/layers/:id` | Get / update / archive |
| GET/POST | `/layers/:id/clusters` | Layer → Cluster mappings |
| GET/POST | `/clusters` | List / create clusters |
| GET/PATCH/DELETE | `/clusters/:id` | Get / update / archive |
| GET/POST | `/clusters/:id/competencies` | Cluster → Competency mappings |
| GET/POST | `/competencies` | List / create competencies |
| GET/PATCH/DELETE | `/competencies/:id` | Get / update / archive |
| GET/POST | `/micro-competencies` | List / create micro competencies |
| GET/PATCH/DELETE | `/micro-competencies/:id` | Get / update / archive |
| GET | `/competency-core/stats` | Aggregated counts |

### Behavioural Mapping — `/api/ontology/`

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/ont-concerns` | List / create concerns |
| GET/PATCH/DELETE | `/ont-concerns/:id` | Get / update / archive |
| GET/POST | `/micro-competencies/:id/concerns` | Map micro → concern |
| DELETE | `/micro-competencies/:micro_id/concerns/:concern_id` | Unmap |
| GET/POST | `/concerns/:id/indicators` | Map concern → indicator |
| DELETE | `/concerns/:concern_id/indicators/:indicator_id` | Unmap |
| GET/POST | `/indicators/:id/questions` | Map indicator → question |
| DELETE | `/indicators/:indicator_id/questions/:question_id` | Unmap |
| GET/POST | `/assessment-questions` | List / create questions |
| GET/PATCH/DELETE | `/assessment-questions/:id` | Get / update / archive |
| GET/POST/DELETE | `/assessment-questions/:id/options` | Answer options |
| GET | `/concerns-mapping/stats` | Mapping chain counts |

### Governance — `/api/ontology/`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/ref/seniority-levels` | Seniority reference |
| GET | `/ref/proficiency-levels` | Proficiency reference |
| GET | `/ref/competency-categories` | Category reference |
| GET | `/ref/assessment-types` | Assessment type reference |
| GET | `/ref/lifecycle-transitions` | Allowed transitions |
| GET | `/versions` | Change history (paginated) |
| GET | `/versions/:entityType/:id` | Entity version list |
| GET | `/versions/:entityType/:id/:v` | Single snapshot |
| POST | `/versions/snapshot` | Manual snapshot capture |
| GET | `/changes` | Field-level change log |
| POST | `/changes` | Record a change |
| GET | `/lifecycle` | Lifecycle event stream |
| POST | `/lifecycle/transition` | Record a status transition |
| GET/PATCH | `/governance/schedules` | Review schedule CRUD |
| GET/POST/PATCH | `/governance/reviews` | Review instance CRUD |
| GET/POST/PATCH/DELETE | `/governance/quality-rules` | Quality gate CRUD |
| GET | `/governance/stats` | Governance dashboard stats |

### Role Crosswalk — `/api/competency/`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/role-library/:userId` | Resolve the caller's target/current role (or `?role=` override) to the ontology role library and return its required competencies, sourced from O*NET / curated starter rows. |

---

## 4.5 Role Crosswalk (app role → `ont_roles.code`)

User-facing flows key off their **own** role identifiers — free-text labels on
the profile (`cra_profiles.target_role_label` / `current_role_label`), legacy
career-intelligence catalog ids (`'swe'`, `'ml-eng'`, `'pm'`, …), or ontology
codes already (`ROLE_*`, `ONET_*`). The crosswalk in
`backend/services/role-crosswalk.ts` bridges any of those to a canonical
`ont_roles.code` so the large imported library (1016 O*NET occupations + ~24
curated starter roles) is actually consumed instead of sitting idle.

**Resolver** — `resolveOntRole(pool, input)` returns ranked `RoleMatch[]`;
`resolveBestOntRole(pool, input)` returns the single best (biased toward a role
that actually carries competencies). Resolution order:

1. **`code`** — input is a literal `ONET_*` / `ROLE_*` code.
2. **`exact_title`** — normalized title equals the input (or its legacy-id title).
3. **`alias`** — bridged via legacy-id→title or a title synonym (e.g.
   "Software Engineer" → O*NET "Software Developers").
4. **`partial_title`** — substring/token overlap.

Within a rank tier, the role with the most `map_role_competency` links wins, so a
resolved role is useful rather than an empty shell.

**Competencies** — `getRoleCompetencies(pool, roleCode)` joins
`map_role_competency ⋈ ont_competencies` (core tier + higher weight first) and
returns the per-competency tier / weight / proficiency targets with provenance
(`source` = `onet` or `seeded`).

**Honest by construction:** an unresolved role returns `resolved: null`; a role
that resolves but carries no ratings (the O*NET coverage gap — 137 aggregate
occupations have no element ratings) returns an empty competency list with a
`note`, never fabricated requirements. Before the crosswalk only the 10
hard-coded labels in `competency-assessment-runtime.ts` `ROLE_PRIORITIES` had any
role-specific competencies; every other role now draws from the shared library.

---

## 5. CAPADEX Bridging Rules

> **Critical constraint:** `ont_concerns` is a **separate ontology-scoped entity**.
> It does NOT replace `capadex_concerns_master`. The bridge is:
>
> ```
> ont_concerns.concern_bridge_tag  ←→  concerns_master.relational_bridge_tag  (bucket-level)
> ont_concerns.capadex_concern_id  ←→  concerns_master.concern_id             (exact ID, if known)
> ```
>
> A concern with no bridge tag is valid — it may be a net-new ontology concern not yet mapped to CAPADEX.

**Never:**
- Use `concern_id` from `ont_concerns` as a key into `capadex_concerns_master` — they are disjoint integer spaces.
- Derive "strengths" from concern signals. Strengths come from CSI `positive_factors` / positive longitudinal growth only.

---

## 6. Lifecycle & Governance Flow

```
DRAFT  ──→  IN_REVIEW  ──→  APPROVED  ──→  PUBLISHED
              │                │
              ↓                ↓
            DRAFT           DRAFT (if rework needed)
              
PUBLISHED  ──→  DEPRECATED  ──→  ARCHIVED
ARCHIVED   ──→  DRAFT (requires approval — breaking glass)
```

Every transition is validated against `ref_lifecycle_transitions` and recorded in `lfc_status_events`.

---

## 7. Version & Change Tracking

- Every PATCH via the API should call `POST /api/ontology/changes` with field-level before/after diff.
- Every publish (APPROVED → PUBLISHED) should call `POST /api/ontology/versions/snapshot`.
- Snapshots are append-only (`ver_entity_snapshots`) — never mutated.
- Change log is append-only (`ver_change_history`) — never mutated.

---

## 8. Quality Gates

Seeded rules enforce:

| Rule | Entity | Severity |
|------|--------|----------|
| `COMP_001` | Competency must have ≥1 Micro Competency | warning |
| `COMP_002` | Competency must be in a Cluster | error |
| `MICRO_001` | Micro must declare proficiency_level | error |
| `MICRO_002` | Micro must have observable_behavior | error |
| `CONC_001` | Concern must map to ≥1 Indicator | warning |
| `CONC_002` | Concern should have CAPADEX bridge_tag | warning |
| `CLUS_001` | Cluster must have ≥1 Competency | warning |
| `LAYER_001` | Layer must link to ≥1 Cluster | warning |
| `IND_001` | Indicator must link to ≥1 Question | warning |

---

## 9. Frontend Navigation

| Nav ID | Panel | Section |
|--------|-------|---------|
| `ont-layers` | CompetencyCorePanel (Layers tab) | Competency Framework |
| `ont-clusters` | CompetencyCorePanel (Clusters tab) | Competency Framework |
| `ont-competencies` | CompetencyCorePanel (Competencies tab) | Competency Framework |
| `ont-micro-competencies` | CompetencyCorePanel (Micro tab) | Competency Framework |
| `ont-concerns` | ConcernsMappingPanel (Concerns tab) | Behavioural Mapping |
| `ont-assessment-questions` | ConcernsMappingPanel (Questions tab) | Behavioural Mapping |
| `ont-governance` | OntologyGovernancePanel | Platform Operations |
| `ont-industries` → `ont-ai-rules` | Existing ontology panels | Competency Ontology |

---

## 10. Table Name Constraints

| Prefix | Namespace | Owner |
|--------|-----------|-------|
| `ont_` | Ontology master entities | This system |
| `map_` | Mapping / join tables | This system |
| `ref_` | Reference / lookup tables | This system |
| `ver_` | Version snapshots & change log | This system |
| `lfc_` | Lifecycle events | This system |
| `gov_` | Governance rules & schedules | This system |
| `kg_` | Live Employability Graph | **DO NOT TOUCH** (kg_edges / kg_nodes) |
| `pil_kg_` | PIL Knowledge Graph | PIL phases only |

> ⚠️ `kg_*` tables are owned by the live Employability Graph (20260522). Materialize against `pil_kg_*` **only** — see `.agents/memory/kg-table-name-collision.md`.
