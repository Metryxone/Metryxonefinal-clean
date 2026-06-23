# System Classification Matrix — Competency Ecosystem

**Task:** MX-COMPETENCY-ONET-ARCHITECTURE-VALIDATION · Section 1
**Date:** 2026-06-23 · **Method:** live shared-DB row counts + route/service trace. Read-only. No code/schema changed.

**Legend**
- **CANONICAL** — the authoritative source the runtime actually scores/reads against.
- **REFERENCE** — real external evidence base, used for *estimation* only, not the source of truth.
- **LEGACY** — superseded duplicate kept for back-compat; reads fall back elsewhere.
- **FUTURE** — wired/scaffolded but intentionally parked until content exists.
- **EMPTY** — 0 rows (sub-state of LEGACY/FUTURE; called out where it changes the verdict).
- **UNUSED** — present in schema but no runtime consumer.

> **The one fact that explains everything below:** there are **three parallel "competency" namespaces** that connect *only by name-matching*: curated `onto_*` (CANONICAL, what candidates are scored against), O*NET `ont_*` (REFERENCE, used to *estimate* role requirements), and legacy `competency_*` (LEGACY/EMPTY). This is by design but invisible on screen — which is why the numbers never reconcile.

---

## Master classification table

| System | Canonical table(s) | Live rows | Class | Evidence / note |
|---|---|---|---|---|
| **Competency Master** | `onto_competencies` | **419** | **CANONICAL** | Scored against by the runtime. `competency_catalog`/`competency_library` (0) are LEGACY shells; admin reads fall back to `onto_*`. `ont_competencies` (160) is the O*NET REFERENCE copy. |
| **Micro Competencies** | `onto_competency_hierarchy` | **277** | **CANONICAL** | Curated micro-framework. `ont_micro_competencies` (20) = REFERENCE, **UNUSED** (no consumer). |
| **Competency Types** | `onto_competency_type_map` | **419** | **CANONICAL** | 5 real types (behavioral/cognitive/functional/technical/future_skills); 1 row per competency. No "Leadership" type by design. |
| **Competency Levels** | `onto_proficiency_levels` (5) / `ref_proficiency_levels` (5) | **5 / 5** | **CANONICAL (duplicated)** | Two identical 5-level rubrics coexist — pick ONE. `ont_competency_level_anchors` (120) = REFERENCE descriptors. |
| **Level Profiles** | per-competency level descriptors | n/a | **CANONICAL** | Legitimately distinct from the rubric, but confusingly named ("levels" vs "level profiles"). |
| **Role Profiles** | `onto_role_competency_profiles` | **14** | **CANONICAL** | Role→required-competency requirements (Phase 1.5). Only **14** rows = pilot. The O*NET equivalent is `map_role_competency` (52,362) — REFERENCE. |
| **Role Families** | `onto_role_families` | **4** | **CANONICAL** | Curated. `ont_role_families` (31) = REFERENCE; `role_families` (10), `gro_role_families` (0) = LEGACY. **4 namespaces for one concept.** |
| **Role Architecture** | `onto_roles` | **5** | **CANONICAL** | Curated roles. `ont_roles` (1,040) = REFERENCE library; `cg_roles` (200) = Career-Graph (distinct purpose, KEEP); `role_definitions` (10), `gro_canonical_roles` (12), `m3_market_roles` (5), `wos_roles` (5), `role_catalog` (0) = **LEGACY sprawl (6+ role namespaces)**. |
| **Assessment Blueprints** | `onto_assessment_blueprints` (6) + `onto_question_blueprints` (7) | **6 / 7** | **CANONICAL** | Real test-plan layer. `assessment_blueprints` (0), `assessment_templates` (15), `assessment_template_questions` (150) = **LEGACY** parallel namespace (still seeded but not the canonical path). |
| **Question Banks** | `competency_question_templates` | **74** | **CANONICAL** | V1 bank consumed by selection. `ont_assessment_questions` (16) = REFERENCE, **UNUSED** by runtime; `assessment_template_questions` (150) = LEGACY; `lbi_question_bank` = separate product. **3 "questions" screens.** |
| **Assessment Runtime** | `onto_assessment_instances` / `_responses` | **45 / 66** | **CANONICAL** | Real but **pilot-scale**. Runtime still uses a hardcoded `COMPETENCY_META` map in places instead of reading competency definitions from the DB genome (route-trace: `competency-assessment-runtime.ts`). |
| **Scoring Engine** | `onto_competency_score_runs` (2) + `onto_competency_profiles` (38) | **2 / 38** | **CANONICAL (dual ledger)** | Two ledgers by design — rich scorer writes `score_runs`, runtime `scoreInstance` writes `profiles`. Any "scored subjects" count MUST union both. |
| **Employability Engine** | `employabilityEngine.ts` (8-dim) | code | **CANONICAL** | Single formula authority; consumes scoring output. No table sprawl. |
| **Career Builder** | `cg_*` + `career_seeker_profiles` | 200 roles | **CANONICAL (read-only consumer)** | Consumes competency intelligence; does **not** write back to the competency framework (one-way today). |
| **Career Passport** | `cp_*` (12 tables) | varies | **CANONICAL** | `syncPassportFromPlatform` bridges capadex/frp/competency; section-visibility gated. |
| **Employer Portal** | `employer_jobs`/`employer_candidates`/`employer_company_profiles` | **0 / 0 / 0** | **Partially ready — structurally present, EMPTY/unexercised** | Full route/service stack exists; **zero data**. Hiring assessment reads `lbi_scores` (0) + `cra_scores` (0) + `tig_*` (0) — **a path disjoint from the competency runtime**. See `employer_customization_readiness.md`. (Same verdict used across all 6 docs; in the FUTURE/parked register this is the "structurally present, unexercised" sub-state.) |
| **O*NET Library** | `ont_roles`/`ont_competencies`/`map_role_competency` | 1,040 / 160 / 52,362 | **REFERENCE** | The real O*NET value is role-requirement *estimation*. Only **5 of 1,040** roles bridged to curated (`map_ont_onto_role`=5). Sub-tables `ont_skills/abilities/knowledge/work_activities` **do not exist** — this is O*NET-lite (competencies+roles+industries+functions only). |
| **Career Graph** | `cg_*` | `cg_roles` 200 | **CANONICAL (own domain)** | Distinct product surface; KEEP. Overlaps role naming only. |

---

## Taxonomy hierarchy — both namespaces exist, curated side barely seeded

| Tier | Curated (`onto_*`) | rows | O*NET (`ont_*`) | rows | Class |
|---|---|---|---|---|---|
| Industry | `onto_industries` | **2** | `ont_industries` | **206** | curated CANONICAL (seed gap) · O*NET REFERENCE |
| Function | `onto_functions` | **3** | `ont_functions` | **30** | same |
| Department | `onto_subfunctions` | **4** | `ont_departments` | **43** | **naming conflict** — "subfunction" vs "department" for the SAME tier |
| Role Family | `onto_role_families` | **4** | `ont_role_families` | **31** | curated CANONICAL · O*NET REFERENCE |
| Role | `onto_roles` | **5** | `ont_roles` | **1,040** | curated CANONICAL · O*NET REFERENCE |

**Finding:** the hierarchy is *modelled correctly* end-to-end, but the **canonical curated side is at pilot seed depth (2/3/4/4/5)** while the rich content lives in the O*NET REFERENCE side. This is the single biggest content gap.

---

## EMPTY / FUTURE / UNUSED register (parked surfaces)

| Table(s) | rows | Class | Verdict |
|---|---|---|---|
| `competency_catalog`/`library`/`clusters`/`domains` | 0 | LEGACY EMPTY | REMOVE (after backup) — reads already fall back to `onto_*` |
| `ont_benchmarks`/`ont_benchmark_items` | 0 | FUTURE | KEEP parked (wired to `computeBenchmarkDashboard`) |
| `ont_career_paths`/`ont_career_tracks`/`ont_learning_paths`/`ont_future_skills` | 0 | FUTURE/EMPTY | HIDE now → ARCHIVE (superseded by `cg_*`) |
| `assessment_blueprints` | 0 | LEGACY EMPTY | REMOVE |
| `role_catalog` | 0 | LEGACY EMPTY | REMOVE |
| `gro_canonical_roles` (12), `m3_market_roles` (5), `wos_roles` (5), `role_definitions` (10) | low | LEGACY | HIDE/consolidate into curated+O*NET+CGI |
| `ont_micro_competencies` (20), `ont_assessment_questions` (16) | low | REFERENCE UNUSED | ARCHIVE (no runtime consumer) |
| `lbi_scores` (0), `cra_scores` (0), `tig_*` (0) | 0 | FUTURE | KEEP parked (employer/enterprise path, unexercised) |

---

## Summary count

- **CANONICAL systems:** 12 (genome, hierarchy, types, levels, role profiles, blueprints, question bank, runtime, scoring, employability, career builder, passport).
- **REFERENCE:** 1 large O*NET library (+ its reference sub-tables).
- **LEGACY (mostly EMPTY):** ~6 role namespaces + ~4 competency shells + parallel assessment namespace.
- **FUTURE (parked, EMPTY):** employer/TIG path, benchmarks, career-path/learning-path/future-skills.

**The architecture is sound; the problem is surface-area + seed-depth, not design.** Detail per section in the companion reports.
