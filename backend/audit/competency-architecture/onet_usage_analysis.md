# O*NET Usage Analysis (Step 4)

> For **every** O*NET (`ont_*`) table: is it Used (runtime/scoring), Partial (admin display only), Future (empty, intended), or Unused (no consumer)? Recommendation: Keep / Hide / Archive / Merge. Source: code trace + **exact** live counts (`SELECT COUNT(*)`, 2026-06-23). Classification here is the authoritative O*NET verdict and is mirrored in `competency_simplification_plan.md`.

## What O*NET *is* here
O*NET is an **imported external reference library** (US Dept of Labor). It is NOT the thing candidates are scored against — the curated `onto_*` genome is. O*NET's job is to *estimate role requirements* via a name-matched bridge (`map_role_competency`, 52,362 rows → `onet-onto-weight-bridge.ts`). Understanding this is the key to the recommendations: most `ont_*` tables should stay as **reference**, not be promoted to runtime.

## Per-table verdict — all 26 `ont_*` tables (exact counts)

| Table | Rows | Usage | Consumer | Recommendation |
|---|---:|---|---|---|
| `ont_roles` | 1,040 | **Used (runtime)** | `role-crosswalk.ts` title resolution | **KEEP** |
| `ont_competencies` | 160 | **Used (runtime)** | `onet-onto-weight-bridge.ts` name match | **KEEP** |
| `ont_industries` | 206 | **Used (runtime)** | `industry-readiness-engine.ts` | **KEEP** |
| `ont_functions` | 30 | **Used (runtime)** | `function-readiness-engine.ts` | **KEEP** |
| `ont_industry_segments` | 126 | **Partial (display)** | industries screens | **KEEP** (reference) |
| `ont_competency_level_anchors` | 120 | **Partial (display)** | level/anchor screens | **KEEP** (reference) |
| `ont_departments` | 43 | **Partial (display)** | `DepartmentsPanel.tsx` | **KEEP** (reference) |
| `ont_role_families` | 31 | **Partial (display)** | role-family screens | **KEEP** (reference) |
| `ont_sectors` | 18 | **Partial (display)** | `SectorsPanel.tsx` | **KEEP** (reference) |
| `ont_competency_clusters` | 16 | **Partial (display)** | `OntologyOverviewPanel.tsx` | **KEEP** (reference grouping) |
| `ont_indicators` | 12 | **Partial (display)** | `CompetencyIntelligenceAdminPanel.tsx` | **KEEP** (reference) |
| `ont_layers` | 5 | **Partial (display)** | `OntologyOverviewPanel.tsx` | **KEEP**; note `scoring_weight` ladder is stored but **unused in scoring** |
| `ont_benchmarks` | 0 | **Future (wired)** | `computeBenchmarkDashboard` reads → degrades empty | **KEEP (parked)** — activate when norms exist |
| `ont_benchmark_items` | 0 | **Future (wired)** | with `ont_benchmarks` | **KEEP (parked)** |
| `ont_concerns` | 0 | **CAPADEX sync target** | mirror-synced from CAPADEX (empty in this DB) | **KEEP** (separate product) |
| `ont_assessment_questions` | 16 | **Unused** | none — runtime uses `competency_question_templates` | **MERGE / ARCHIVE** into the one question bank |
| `ont_question_options` | 4 | **Unused** | tied to `ont_assessment_questions` | **MERGE / ARCHIVE** with above |
| `ont_micro_competencies` | 20 | **Unused** | none found (deprecated by `onto_competency_hierarchy`) | **MERGE / ARCHIVE** into curated micro fw |
| `ont_future_skills` | 0 | **Unused** | route-only (`ontology-future-skills.ts`), no data | **HIDE** until populated |
| `ont_ai_rules` | 0 | **Unused** | `AIRulesPanel.tsx` (empty) | **HIDE** until used |
| `ont_ai_rule_audit_log` | 0 | **Unused** | with `ont_ai_rules` | **HIDE** until used |
| `ont_career_paths` | 0 | **Unused** | none (superseded by `cg_*`) | **HIDE → ARCHIVE** |
| `ont_career_path_milestones` | 0 | **Unused** | with `ont_career_paths` | **HIDE → ARCHIVE** |
| `ont_career_tracks` | 0 | **Unused** | display-only, empty | **HIDE → ARCHIVE** |
| `ont_learning_paths` | 0 | **Unused** | display-only, empty | **HIDE → ARCHIVE** |
| `ont_learning_path_steps` | 0 | **Unused** | with `ont_learning_paths` | **HIDE → ARCHIVE** |

### Related bridge/map tables (not `ont_*`-prefixed but part of the O*NET layer)
| Table | Rows | Usage | Recommendation |
|---|---:|---|---|
| `map_role_competency` | 52,362 | **Used (runtime)** — source of `onet_derived` weights | **KEEP** (core value) |
| `map_ont_onto_role` | 5 | **Used (runtime)** — human-confirmed role crosswalk | **KEEP** |
| `map_ont_onto_competency` | 15 | **Partial (display)** — `OntologyGovernancePanel.tsx` | **KEEP** (governance tool) |

## Summary
- **Keep as runtime (the parts that earn their place):** `ont_roles`, `ont_competencies`, `ont_industries`, `ont_functions`, plus the bridge `map_role_competency` / `map_ont_onto_role`. This is the real O*NET value — role-requirement estimation.
- **Keep as labelled reference (display):** segments, level anchors, departments, role families, sectors, clusters, indicators, layers, governance crosswalk. Harmless, useful context — but should be **visually separated from the curated genome** so admins don't confuse the two.
- **Keep (parked):** `ont_benchmarks` / `ont_benchmark_items` (wired, awaiting norm data); `ont_concerns` (CAPADEX sync target).
- **Hide (empty, intended-future):** `ont_future_skills`, `ont_ai_rules` (+ audit log).
- **Hide → Archive (dead, superseded):** the entire career-path / career-track / learning-path family (5 empty tables, superseded by `cg_*`).
- **Merge / Archive (dead, superseded by curated surfaces):** `ont_micro_competencies` (→ curated micro fw), `ont_assessment_questions` + `ont_question_options` (→ single question bank).

## Important caveat
O*NET has **no native industry/role-difficulty dimension** that maps cleanly to the curated genome. The name-bridge is the only join and it's lossy (catalogs overlap ~13%, per memory `competency-onet-three-system-silo.md`). Do **not** try to make O*NET the scoring source of truth — keep it as the estimation/reference layer it already is.
