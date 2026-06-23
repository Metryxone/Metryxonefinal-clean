# Competency Simplification Recommendations

**Task:** MX-COMPETENCY-ONET-ARCHITECTURE-VALIDATION · Section 5
**Date:** 2026-06-23 · Read-only. Bias order: **Rename → Hide → Simplify → Merge** before Delete/Rebuild.

Per-screen verdict with evidence. KEEP · SIMPLIFY · MERGE · HIDE · REMOVE.

---

## Competency screens

| Screen | Backing | Verdict | Why |
|---|---|---|---|
| Competency Master | `onto_competencies` (419) | **KEEP + RELABEL** | Canonical. Label it the single "Competency Master". |
| Competency Catalog / Library (legacy) | `competency_catalog`/`library` (0) | **REMOVE** | Empty duplicates; reads already fall back to `onto_*`. |
| Micro Competencies (curated) | `onto_competency_hierarchy` (277) | **KEEP** | Canonical micro-framework. |
| O*NET Micro Competencies | `ont_micro_competencies` (20) | **HIDE/ARCHIVE** | No consumer; superseded. |
| Competency Types | `onto_competency_type_map` (419) | **KEEP** | 5 real types; clean. |
| Competency Levels | `onto_proficiency_levels` (5) **and** `ref_proficiency_levels` (5) | **MERGE** | Two identical rubrics — pick one, relabel "Proficiency Scale". |
| Level Profiles / Anchors | `ont_competency_level_anchors` (120) | **KEEP + RELABEL** | Distinct from rubric; rename "Level Descriptors" to end the levels/level-profiles confusion. |
| Indicators (curated vs O*NET) | `onto_indicators` (66) / `ont_indicators` (12) | **SIMPLIFY** | Keep curated; mark O*NET ones "Reference". |

## Role screens

| Screen | Backing | Verdict | Why |
|---|---|---|---|
| Roles (curated) | `onto_roles` (5) | **KEEP** | Canonical (seed-thin). |
| O*NET Role Library | `ont_roles` (1,040) | **KEEP + RELABEL** | "O*NET Reference Library". |
| Career Graph Roles | `cg_roles` (200) | **KEEP** | Distinct product domain. |
| Legacy role tables | `role_definitions` (10), `gro_canonical_roles` (12), `m3_market_roles` (5), `wos_roles` (5), `role_catalog` (0) | **HIDE → REMOVE** | **6+ role namespaces** = the #1 source of sprawl. Consolidate to curated + O*NET + CGI. |
| Role Families (curated vs O*NET vs legacy) | `onto_role_families` (4) / `ont_role_families` (31) / `role_families` (10) | **MERGE/SIMPLIFY** | 4 namespaces; `ont-role-families` vs `cmp-role-families` split one concept across two nav steps. |
| Role Profiles | `onto_role_competency_profiles` (14) | **KEEP** | Canonical requirements (role→competency). |
| Role DNA | role-dna runtime | **KEEP** | Distinct curated surface. |

## Question screens

| Screen | Backing | Verdict | Why |
|---|---|---|---|
| Question Bank (V1) | `competency_question_templates` (74) | **KEEP** | Canonical bank. |
| Question Blueprints / Mapping | `onto_question_blueprints` (7), `onto_question_competency_mapping` (23) | **KEEP** | Selection layer. |
| O*NET Assessment Questions | `ont_assessment_questions` (16) | **MERGE/ARCHIVE** | Not referenced by runtime. |
| Legacy template questions | `assessment_template_questions` (150) | **MERGE** | Fold into the one bank; **3 "questions" screens → 1**. |

## O*NET screens

| Screen | Backing | Verdict | Why |
|---|---|---|---|
| O*NET Roles / Industries / Functions / Departments | `ont_roles`/`ont_industries` (206)/`ont_functions` (30)/`ont_departments` (43) | **KEEP, group under one "O*NET Reference" section** | Real breadth; must read as reference, not canonical. |
| O*NET Benchmarks | `ont_benchmarks` (0) | **KEEP (parked)** | Wired, no data. |
| O*NET Career/Learning Paths, Future Skills | `ont_career_paths`/`tracks`/`learning_paths`/`future_skills` (all 0) | **HIDE → ARCHIVE** | Empty; superseded by `cg_*`. |
| O*NET Crosswalk | `map_ont_onto_role` (5) | **KEEP + SURFACE** | Underfilled bridge; expose its 5/1,040 coverage so the gap is visible. |

## Assessment screens

| Screen | Backing | Verdict | Why |
|---|---|---|---|
| Assessment Blueprints (canonical) | `onto_assessment_blueprints` (6), `onto_question_blueprints` (7) | **KEEP** | Canonical test-plan. |
| Legacy Assessment Templates | `assessment_templates` (15), `assessment_blueprints` (0) | **REMOVE/MERGE** | Parallel namespace; consolidate into canonical blueprints. |
| Assessment Runtime / Instances | `onto_assessment_instances` (45) | **KEEP** | Canonical runtime. |
| Dual scoring views | `onto_competency_score_runs` (2) + `onto_competency_profiles` (38) | **KEEP, document** | Two ledgers by design — annotate so counts union both. |

## Employer screens

| Screen | Backing | Verdict | Why |
|---|---|---|---|
| Job creation + competency adjust | `employer_jobs` (0) | **KEEP + SIMPLIFY** | Replace free-text skills/requirements with a governed competency picker. |
| Hiring Intelligence / candidate match | `employer-hiring-intelligence.ts`, `employer_candidates` (0) | **KEEP** | Structurally sound; needs the scoring bridge (Section 4). |
| TIG / M5 Workforce OS | `tig_*` (0), M5 routes | **HIDE until volume** | Over-engineered for 0 jobs; keep parked, don't expand. |

## Career screens

| Screen | Backing | Verdict | Why |
|---|---|---|---|
| Career Builder | `cg_*` | **KEEP** | Canonical consumer. |
| Career Passport | `cp_*` (12) | **KEEP** | Working bridge. |

---

## Cross-cutting complexity findings

**Admin complexity (the real pain):**
- **6+ role namespaces**, **4 role-family namespaces**, **3 competency-master surfaces**, **3 "questions" screens**, **2 proficiency-level tables**, **2 parallel assessment-blueprint namespaces**. An admin cannot tell which screen is authoritative.

**User complexity:** comparatively low — candidates see the assessment flow, not the admin sprawl. The confusion is almost entirely **operator-facing**.

**Duplicate navigation:** `ont-role-families` vs `cmp-role-families`; O*NET reference scattered across many top-level nav entries instead of one "O*NET Reference" group.

**Duplicate concepts:** competency (3×), role (6×), role family (4×), questions (3×), proficiency levels (2×), assessment blueprint (2×).

**Naming conflicts:** Department = `onto_subfunctions` vs `ont_departments`; "Levels" vs "Level Profiles"; curated genome vs O*NET reference share generic labels with no source badge.

---

## The 6 highest-impact simplifications (all Rename/Hide/Merge — reversible)
1. **Group all O*NET screens under one "O*NET Reference" section** with a source badge. (Rename)
2. **Hide the empty legacy clusters** (competency shells, empty role tables, empty O*NET path tables, empty assessment_blueprints). (Hide)
3. **Merge the 3 "questions" screens into one bank.** (Merge)
4. **Collapse role families to one canonical + one reference.** (Merge)
5. **Rename the Department tier consistently** and relabel "Level Profiles" → "Level Descriptors". (Rename)
6. **Badge curated vs reference everywhere** so "419 vs 160 vs 0" stops being a mystery. (Rename)

Removal of empty tables is a *later, separately approved* step with backups — not required to get most of the clarity benefit.
