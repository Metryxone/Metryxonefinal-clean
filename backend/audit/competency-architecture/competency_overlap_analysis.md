# Competency Overlap & Duplicate Analysis (Step 2)

> Companion to `competency_architecture_inventory.md`. Identifies duplicate concepts, naming collisions, and confusing surfaces. Recommendations are summarized; full sequencing is in `competency_simplification_plan.md`.

## The root cause: three disjoint "competency" taxonomies + scaffold sprawl
There are **three different systems that each call themselves "competencies,"** plus several abandoned scaffolds. The platform's confusion is almost entirely downstream of this.

| # | System | Namespace | Rows | Role |
|---|---|---|---|---|
| 1 | **Curated genome** | `onto_*` | `onto_competencies` 419 | What candidates are actually scored against — CANONICAL |
| 2 | **O*NET reference** | `ont_*` | `ont_competencies` 160 | External evidence base for *estimating* role requirements |
| 3 | **Legacy shells** | `competency_*` | `competency_catalog`/`library`/`clusters`/`domains` = 0 | Empty duplicates of #1; admin reads fall back to `onto_*` |

They are connected **only by name-matching** (`map_role_competency` → bridge). This is by design (documented in `replit.md` and memory), but it is invisible to an admin reading the screens, which is why the numbers never reconcile.

---

## Duplicate concept register

| Duplicate concept | Source A (keep) | Source B | Source C+ | Recommendation |
|---|---|---|---|---|
| **Competencies** | `onto_competencies` (419, curated) | `ont_competencies` (160, O*NET reference) | `competency_catalog`/`competency_library` (0, legacy) | **KEEP A** as canonical; **KEEP B** as clearly-labelled reference only; **REMOVE C** (empty shells). Rename UI so A=“Competency Master”, B=“O*NET Reference”. |
| **Micro competencies** | `onto_competency_hierarchy` (277, curated micro fw) | `ont_micro_competencies` (20, O*NET, **not referenced**) | — | **KEEP A**; **HIDE/ARCHIVE B** (deprecated by A, no consumer). |
| **Roles** | `onto_roles` (5, curated) + `ont_roles` (1,040, O*NET library) | `cg_roles` (200, Career Graph) | `role_catalog`/`role_definitions` (10), `gro_canonical_roles` (0), `m3_market_roles` (0), `wos_roles`, `role_dna_*` | **6+ role namespaces.** KEEP curated+O*NET+CGI (distinct purposes); **REMOVE/HIDE** GRO, M3, and legacy `role_*` shells. Biggest single source of sprawl. |
| **Role families** | `onto_role_families` | `ont_role_families` (31, O*NET) | `gro_role_families` (0), `role_families` | KEEP curated + O*NET-reference; REMOVE GRO/legacy. **UI duplication**: `ont-role-families` vs `cmp-role-families` confuse one concept across two steps. |
| **Role profiles vs Blueprints** | `onto_role_competency_profiles` (14, role→required competency) | `onto_assessment_blueprints` (6) + `onto_question_blueprints` (7) | `assessment_blueprints`/`_v2`/`assessment_templates` (all 0) | KEEP the `onto_*` pair (role profile = requirements; blueprint = test plan — legitimately different). **REMOVE** the empty parallel `assessment_*` blueprint namespace. |
| **Assessment Questions vs Question Bank** | `competency_question_templates` (74, V1 bank) | `onto_question_blueprints`/`onto_question_competency_mapping` (selection) | `ont_assessment_questions` (16), `assessment_template_questions` (150), `lbi_question_bank` | **MERGE the UI** (see below). Tables serve different stages but **3 admin screens** show "questions" → consolidate. ARCHIVE `ont_assessment_questions` (not referenced). |
| **Competency Levels vs Level Profiles** | `onto_proficiency_levels` / `ref_proficiency_levels` (the level rubric) | per-competency-per-level behaviour text (Level Profiles panel) | `ont_competency_level_anchors` (120) | Legitimately distinct (rubric vs descriptors) but **confusingly named**. KEEP, RELABEL ("Proficiency Scale" vs "Level Descriptors"). Pick ONE proficiency-level table (`onto_*` vs `ref_*`). |
| **Scoring ledgers** | `onto_competency_score_runs` (2, rich scorer) | `onto_competency_profiles` (38, runtime scoreInstance) | — | **KEEP BOTH** (documented dual ledger) but any "scored subjects" count MUST union both, or runtime-scored subjects read as unscored. Document, don't merge. |
| **Norms / Benchmarks** | `p4_benchmark_trends` (26,910 est) | `ti_role_benchmarks` (60) | `ont_benchmarks` (0, **parked/wired**), `competency_percentile_distributions_v2` (0), `bench_role_alignment_scores` (0) | KEEP P4 if data is real (verify — may be seeded). KEEP `ont_benchmarks` **parked** (it is wired to `computeBenchmarkDashboard`, just unpopulated). REMOVE the 2 truly-dead empty benchmark namespaces (`competency_percentile_distributions_v2`, `bench_role_alignment_scores`). |
| **Indicators** | `onto_indicators` (curated) | `ont_indicators` (12, O*NET) | `map_indicator_question`, `map_concern_indicator` | KEEP curated; treat O*NET indicators as reference. |

---

## UI duplication / confusion (admin-visible)

1. **"Question Bank" rendered in 3 places** — `QuestionBankPanel.tsx` (`cmp-questionbank`), `CompetencyQuestionsPanel.tsx` (`cmp-questions`), and `FrameworkPanel.tsx` inline `questions` tab. → Pick ONE primary; demote the others.
2. **"Role Families" in 2 steps** — `ont-role-families` (reference) vs `cmp-role-families` (talent). Same word, different API/meaning, different wizard step. → Relabel ("O*NET Role Families" vs "Talent Role Families") or merge.
3. **"Competency Master" vs "Competency Core"** — Master = curated genome (419); Core = O*NET reference library (136). The names imply a hierarchy (master>core) that doesn't exist; they're parallel taxonomies. → Rename Core to "O*NET Reference Library" (the panel banner already says this — make the nav label match).
4. **Empty screens that look broken** — Future Skills (0), Career Paths (0), Career Tracks (0), Learning Paths (0), and every `competency_graph_*`/GRO/M3 panel render an empty grid with no signal that they're parked. → HIDE behind their flags or add an explicit "not yet activated" state.

---

## Severity ranking (most-confusing first)
1. **Role namespace sprawl** (6+ role taxonomies, 3 empty) — highest cleanup value.
2. **Three "competency" systems with no on-screen explanation** of how they relate.
3. **Question/Question-Bank triplication** in the UI.
4. **Empty scaffold panels** indistinguishable from broken screens.
5. **Confusing names** (Master/Core, Levels/Level-Profiles, two Role-Families).
