# O*NET Positioning Report

**Task:** MX-COMPETENCY-ONET-ARCHITECTURE-VALIDATION · Section 2
**Date:** 2026-06-23 · Read-only. Evidence = live row counts + route/service trace.

## Executive answer

> **O*NET is correctly positioned as a REFERENCE layer and must stay one. It should NOT become the scoring layer.** Candidates are scored against the **curated `onto_*` genome (419 competencies)**; O*NET (`ont_*`, 160 competencies / 1,040 roles) supplies *estimated* role-requirement evidence via name-matching. Promoting O*NET to canonical scoring would (a) replace a deliberately curated genome with a coarser external taxonomy, and (b) inherit the name-bridge weakness as scoring error.

**Important scope correction:** this is **O*NET-lite**, not full O*NET. The classic O*NET element tables **do not exist** in this DB:
- `ont_skills` — ❌ does not exist
- `ont_abilities` — ❌ does not exist
- `ont_knowledge` — ❌ does not exist
- `ont_work_activities` — ❌ does not exist

What actually exists is a **role↔competency requirement library**: `ont_roles` (1,040) × `ont_competencies` (160) bridged by `map_role_competency` (**52,362** rows), plus taxonomy (`ont_industries` 206, `ont_functions` 30, `ont_departments` 43, `ont_role_families` 31) and reference descriptors (`ont_competency_level_anchors` 120, `ont_indicators` 12, `ont_competency_clusters` 16, `ont_layers` 5).

---

## Per-module positioning

| O*NET module | Live rows | Currently used for | Recommended position | Rationale |
|---|---|---|---|---|
| **Occupations / Roles** (`ont_roles`) | **1,040** | Role library browse; estimation source | **REFERENCE (keep)** | The crown jewel — 1,040 roles vs 5 curated. Estimation only. |
| **Competencies** (`ont_competencies`) | **160** | Estimation copy of the genome | **REFERENCE (keep, relabel)** | Must be visibly labelled "O*NET Reference" so it is not confused with the 419 canonical genome. |
| **Skills** | ❌ missing | — | **N/A** | Not imported. If full O*NET ever needed, this is the import target. |
| **Abilities** | ❌ missing | — | **N/A** | Same. |
| **Knowledge** | ❌ missing | — | **N/A** | Same. |
| **Work Activities** | ❌ missing | — | **N/A** | Same. |
| **Role Families** (`ont_role_families`) | **31** | Browse / grouping | **REFERENCE (keep)** | Curated has only 4; O*NET gives breadth. |
| **Industries** (`ont_industries`) | **206** | Market intelligence, superadmin discovery | **REFERENCE (keep)** | Curated has 2 → O*NET is the only realistic industry breadth today. |
| **Functions** (`ont_functions`) | **30** | Discovery | **REFERENCE (keep)** | Curated has 3. |
| **Departments** (`ont_departments`) | **43** | Hierarchy traversal | **REFERENCE (keep) + RENAME** | Naming conflict: curated calls this tier `onto_subfunctions` (4). Unify the label. |
| **Benchmarks** (`ont_benchmarks`/`_items`) | **0 / 0** | Wired to `computeBenchmarkDashboard` (route-trace), no data | **FUTURE (keep parked)** | Activate when real norms exist. Do not delete. |
| **Career Paths** (`ont_career_paths`/`_tracks`) | **0 / 0** | — | **ARCHIVE** | Empty; superseded by Career Graph `cg_*`. |
| **Learning Paths** (`ont_learning_paths`) | **0** | — | **ARCHIVE** | Empty; superseded by `cg_*`. |
| **Future Skills** (`ont_future_skills`) | **0** | — | **HIDE** | Empty until populated. |
| **Micro Competencies** (`ont_micro_competencies`) | **20** | — | **ARCHIVE** | No runtime consumer; curated `onto_competency_hierarchy` (277) supersedes. |
| **Assessment Questions** (`ont_assessment_questions`) | **16** | — | **MERGE/ARCHIVE** | Not referenced by runtime; fold concept into the single question bank. |
| **Level Anchors / Indicators / Clusters / Layers** | 120 / 12 / 16 / 5 | Reference descriptors | **REFERENCE (keep)** | Note (route-trace, `ontology-taxonomy.ts`): `ont_layers.scoring_weight` appears **not consumed** by the runtime — surface that or drop the column. |
| **Crosswalk** (`map_ont_onto_role`) | **5** | Bridge O*NET role → curated role | **CANONICAL bridge — UNDERFILLED** | Only **5 of 1,040** O*NET roles are bridged to curated roles. This is the chokepoint (see below). |

---

## The four questions, answered

**1. What exact value does O*NET provide?**
Breadth the curated genome does not have: **1,040 roles, 206 industries, 43 departments, 52,362 role→competency requirement edges.** It lets the platform *estimate* "what does role X require?" for almost any title without hand-authoring it.

**2. Where is it currently used?**
- Role/industry **browse & discovery** (superadmin + search).
- **Role-requirement estimation** for roles not in the curated set (via `map_role_competency`).
- **Market intelligence** surfaces (`ont_industries`/`ont_functions`).

**3. Where SHOULD it be used (but isn't yet)?**
- **The crosswalk.** `map_ont_onto_role` has only 5 rows → 1,035 O*NET roles can't flow into the curated scoring path. Expanding this bridge (title + competency-name matching, already implemented in `role-crosswalk.ts`) is the highest-leverage O*NET activation.
- **Employer role selection.** When an employer picks a role, O*NET's 52,362 edges should seed the suggested-competency list (today the employer engine uses a hardcoded `DEPT_BEHAVIORAL_PROFILES` heuristic instead — see Section 4).
- **Seeding curated hierarchy.** Curated industries/functions (2/3) could be bootstrapped from O*NET reference rather than hand-typed.

**4. Where should it NOT be used?**
- **As the scoring source.** Never score a candidate directly against `ont_competencies`/`map_role_competency`. The 160-competency O*NET taxonomy is coarser than the 419 curated genome and the role match is name-based (estimation-grade, not assessment-grade).
- **As the canonical role record** for curated/assessed roles — those stay in `onto_roles`.
- **Career/learning paths** — those belong to `cg_*`, not the empty `ont_career_*` tables.

---

## Recommendation summary

1. **Keep O*NET as REFERENCE.** Relabel every O*NET screen "O*NET Reference" so it is never confused with the curated genome.
2. **Expand the crosswalk** (`map_ont_onto_role` 5 → many) — the single change that unlocks O*NET's value for scoring/estimation.
3. **Rename the Department tier** consistently (`onto_subfunctions` ↔ `ont_departments`).
4. **Archive** the empty O*NET career/learning-path/future-skills/micro/question sub-tables; **keep benchmarks parked**.
5. **Do not** promote O*NET to a scoring layer.
