# Competency Architecture Inventory (MX-COMPETENCY-ARCHITECTURE-AUDIT · Step 1)

> Read-only audit. Date: 2026-06-23. Scope: the `backend/` (Node+Express) + `frontend/src/` (React) competency stack. Row counts are live counts from the shared Postgres (`DATABASE_URL`); values marked *(est)* are `pg_class.reltuples` estimates. No code was changed.

## How to read this
- **Coverage** = does data exist. **Status** = is it wired to a live runtime path or only a display/scaffold.
- A module with rows but no runtime consumer is *display-only*; a module with 0 rows and no consumer is *scaffold* (parked).

---

## A. Canonical / Live modules (the spine candidates are actually scored against)

| Module | Purpose | Owner (routes / services) | Key tables (rows) | API base | Depends on |
|---|---|---|---|---|---|
| **Curated Competency Genome** | The authoritative competency framework candidates are scored against | `competency-ontology.ts`, `ontology-competency-core.ts`, `competency-intelligence.ts` / `competency-ontology.ts`, `competency-framework-intelligence.ts` | `onto_competencies` (419), `onto_domains`, `onto_families` (10), `onto_indicators`, `onto_proficiency_levels`, `onto_competency_master_ext` (419) | `/api/competency-ontology`, `/api/ontology/competency-core`, `/api/competency-intelligence` | core DB |
| **Micro Competency Framework** | Parent→child structure over the genome (30 parents, 277 relationships) | `competency-intelligence.ts` / `micro-competency.ts` | `onto_competency_hierarchy` (277) | `/api/admin/competency-intelligence/micro-framework` | Genome |
| **Competency Types & Type Map** | 5 competency TYPES (behavioral/cognitive/functional/technical/future_skills) + per-competency weights | (genome services) | `onto_competency_types`, `onto_competency_type_map` (419) | via competency-intelligence | Genome |
| **O*NET Reference Library** | Imported US Dept-of-Labor taxonomy used to *estimate* role requirements | `ontology-import-export.ts`, `ontology-taxonomy.ts` / `onet-import.ts`, `ontology-seed.ts` | `ont_roles` (1,040), `ont_competencies` (160), `ont_competency_clusters` (16), `ont_layers` (5), `ont_industries` (206), `ont_functions` (30) | `/api/ontology/*` | DB, `backend/data/onet/` |
| **O*NET ↔ Curated Bridge** | Name-matched weight bridge (the only connection between the two taxonomies) | `onet-onto-weight-bridge.ts` | `map_role_competency` (52,362), `map_ont_onto_role` (5), `map_ont_onto_competency` (15) | (internal + governance panel) | Genome, O*NET |
| **Role Architecture / Role DNA** | Curated roles + their competency requirement weights | `role-dna-runtime.ts`, `ontology-career-tracks.ts` / `role-dna-generator.ts`, `role-competency-profile.ts`, `role-family-engine.ts` | `onto_roles` (5), `onto_role_weights` (44), `onto_role_competency_profiles` (14), `onto_role_families`, `onto_layers` | `/api/role-dna`, `/api/ontology/career-tracks` | Genome |
| **Assessment Factory & Blueprints** | Assemble assessments from role blueprints + question bank | `caf-assessment-builder.ts`, `caf-question-framework.ts`, `assessment-writer.ts` / `assessment-assembly.ts`, `assessment-foundation-mapping.ts`, `question-blueprint.ts` | `onto_assessment_blueprints` (6), `onto_question_blueprints` (7), `onto_blueprint_competency_map`, `onto_question_competency_mapping` (23) | `/api/caf/*`, `/api/assessment-writer` | Genome, Role DNA |
| **Competency Runtime & Scoring** | Execute + score assessment runs (dual ledger) | `competency-runtime.ts`, `competency-assessment-runtime.ts` (+ v2) / `competency-runtime.ts`, `competency-scoring.ts`, `benchmark-engine.ts`, `weighting-engine.ts` | `onto_assessment_instances` (45), `onto_assessment_responses` (54), `onto_competency_score_runs` (2), `onto_competency_profiles` (38) | `/api/competency-runtime` | Assembly, Genome |
| **Question Bank** | Competency item bank (V1 bank) | `competency-questions.ts` / — | `competency_question_templates` (74), `onto_competency_question_map` (25) | `/api/competency/questions/*`, `/api/competency-intelligence/competency-questions` | Genome |
| **Competency Intelligence Analytics (P4)** | Population KPIs, history, trajectories, heatmaps | `competency-intelligence.ts` + P4 routes | `p4_competency_history` (8,970 est), `p4_benchmark_trends` (26,910 est), `p4_organizational_heatmaps` (1,196 est), `competency_forecasts` (120), `competency_ei_mapping` (67) | `/api/admin/competency-intelligence/*` | Genome, scoring |
| **Career Graph (CGI)** | Role graph + readiness (separate product, flag `FF_CAREER_GRAPH`) | CGI routes / 5 pure engines | `cg_roles` (200), `cg_role_edges` (500), `cg_user_role_readiness` (0) | `/api/career-graph/*` | own namespace |
| **LBI — Learning Behavior Index** | Student behavioural product (independent by design) | `lbi-engine.ts` / `aiTestGenerator.ts` | `lbi_*` (`lbi_question_bank`, `lbi_sessions`, `lbi_scores`, …) | `/api/lbi/*`, `/api/lbi-engine` | student/parent models |
| **SDI / CAPADEX** | Behavioural concern assessment (independent by design) | `sdi.ts` / capadex services | `sdi_items` (680), `sdi_domains`, `sdi_subdomains` | `/api/sdi/*` | own namespace |

---

## B. Display-only modules (rows or routes exist, but only an admin screen reads them — no runtime/scoring consumer)

| Module | Tables (rows) | Consumed by | Note |
|---|---|---|---|
| O*NET Layers / Clusters | `ont_layers` (5), `ont_competency_clusters` (16) | `OntologyOverviewPanel.tsx` | `scoring_weight` ladder is stored but **not consumed in any scoring math** |
| O*NET Indicators | `ont_indicators` (12) | `CompetencyIntelligenceAdminPanel.tsx` | display |
| Future Skills | `ont_future_skills` (0), `map_competency_future_skill` | `FutureSkillsPanel.tsx` / `ontology-future-skills.ts` | **empty** |
| Career Paths / Tracks / Learning Paths | `ont_career_paths` (0), `ont_career_tracks`, `ont_learning_paths` | `CareerPathsPanel.tsx`, `LearningPathsOntologyPanel.tsx` | empty; superseded by `cg_*` |
| Crosswalk governance | `map_ont_onto_competency` (15) | `OntologyGovernancePanel.tsx` | manual mapping tool |
| Benchmarks (O*NET) | `ont_benchmarks` (0) | `computeBenchmarkDashboard` reads it → degrades empty | reads, but no data |

---

## C. Scaffold / parked modules (0 rows, no runtime consumer found — built ahead of activation)

| Cluster | Tables (all 0 rows) | Assessment |
|---|---|---|
| **Competency "advanced intelligence" scaffold** | `competency_graph_nodes/edges/execution_logs`, `competency_fusion_logs`, `competency_propagation_logs`, `competency_entropy_models`, `competency_validity_models`, `competency_readiness_models`, `competency_confidence_profiles/decay`, `competency_dna_master`, `competency_dependency_edges`, `competency_signal_capture`, `competency_runtime_contexts/weights`, `competency_norm_contexts`, `competency_percentile_distributions_v2`, `competency_reliability_history`, `competency_resolution_history`, `competency_memory_history`, `competency_growth_velocity`, `competency_inference_sources`, `competency_intelligence_profiles`, `competency_profile_versions` | Phases scaffolded but never activated (matches `replit.md` note). Flag-off, empty, parkable. |
| **Legacy competency shells** | `competency_catalog` (0), `competency_library` (0), `competency_clusters` (0), `competency_domains` (0) | Empty shells; admin reads fall back to `onto_*`. Pure duplication of the genome. |
| **GRO role taxonomy** | `gro_canonical_roles`, `gro_role_families`, `gro_role_hierarchy`, `gro_role_competency_*`, `gro_function_*`, `gro_industry_*`, … (all 0) | A *second complete* role/industry taxonomy, entirely unpopulated and unused. |
| **M3 market-role intelligence** | `m3_market_roles`, `m3_canonical_role_mappings`, `m3_role_adjacency`, `m3_semantic_role_clusters`, `m3_emerging_*`, … (all 0) | Market-signal role layer, scaffolded, no data, no consumer. |
| **Assessment_* runtime v2 / integrity** | `assessment_blueprints` (0), `assessment_blueprints_v2` (0), `assessment_templates` (0), `assessment_branching_rules` (0), `assessment_runtime_sessions_v2` (0), `assessment_proctoring_log` (0), `assessment_integrity_scores` (0), `assessment_invites` (0), `assessment_device_tracking` (0), `assessment_explainability_logs` (0) | A parallel `assessment_*` namespace that the live `onto_assessment_*` path does not use (only `assessment_template_questions` has 150 rows). |
| **Misc role scaffolds** | `cra_profiles/scores` (0), `eios_competency_roles` (0), `employer_competency_roles` (0), `ep98_role_intelligence` (0), `bench_role_alignment_scores` (0) | empty |

---

## D. Frontend screen inventory (Super Admin → Competency Framework wizard)

Host: `SuperAdminDashboard.tsx` → `CompetencyFrameworkShell.tsx` (Wizard ↔ Classic) → `FrameworkPanel.tsx` (LBI / Professional Competency / SDI). 6 wizard steps:

| Step | Screens (component · nav id) |
|---|---|
| **1 — Import & Reference Data** | Ontology Overview (`OntologyOverviewPanel` · `ont-overview`), Sectors/Industries/Segments, Functions/Departments, Role Families (`ont-role-families`), Roles & Crosswalk (`ont-roles`, `ont-role-crosswalk`), Import/Export (`ont-import-export`) |
| **2 — Build the Framework** | Competency Master (`cmp-master`), **Micro Framework** (`cmp-micro-framework`), Competency Core / O*NET (`ont-competency-core`), Competency Levels (`ont-competency-levels`), Level Profiles (`cmp-level-profiles`), Indicators (`ont-indicators`), Future Skills (`ont-future-skills`) |
| **3 — Map Roles & Pathways** | Role Profiles (`cmp-role-profile`), Blueprints (`cmp-blueprint-mappings`), Career Paths/Tracks, Learning Paths |
| **4 — Author Questions** | Question Bank (`cmp-questionbank`), Assessment Questions (`cmp-questions`), Question Map (`cmp-question-map`), Concern Mapping, AI Rules |
| **5 — Scoring & Benchmarks** | (scoring/benchmark panels) |
| **6 — Validate & Report** | Search/Discovery (`cmp-search-discovery`), Competency Intelligence (`cmp-intelligence`), Command Center (`cmp-command-center`) |

Framework-specific (Classic view, CAPADEX/SDI): Signal Ontology Hub, Concerns Master, Clarity Questions, Short Assessments.

Full duplicate/orphan analysis → `competency_overlap_analysis.md`.

---

## E. Appendix — backend route registration confirmation (`backend/routes.ts`)
All canonical competency modules in section A are **confirmed registered** in `registerRoutes` (line numbers as of 2026-06-23):

| Registrar | routes.ts line | Module |
|---|---|---|
| `registerCompetencyOntologyRoutes` | 13567 | Curated genome |
| `registerOntologyCompetencyCoreRoutes` | 13675 | Genome core / O*NET core CRUD |
| `registerCompetencyQuestionRoutes` | 13513 | Question bank |
| `registerCompetencyRuntimeRoutes` | 13581 | Runtime |
| `registerCompetencyAssessmentRuntime` | 13614 | Assessment execution |
| `registerCompetencyRuntimeV2` | 13627 | Runtime v2 |
| `registerRoleDNARuntimeRoutes` | 13633 | Role DNA |
| `registerCAFAssessmentBuilderRoutes` | 13658 | Assessment factory |
| `registerOntologyTaxonomyRoutes` | 13662 | O*NET taxonomy |
| `registerOntologyImportExportRoutes` | 13669 | O*NET import/export |
| `registerSdiRoutes` | 13501 | SDI / CAPADEX |
| `registerLBIEngineRoutes` | 13641 | LBI |

The scaffold/parked clusters in section C have **no registered route consumer** beyond CRUD admin reads (which is why they render empty) — consistent with their "parked" classification.
