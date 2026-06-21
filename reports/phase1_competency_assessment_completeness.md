# Phase 1 — Competency Assessment (Competency Framework Intelligence) — Completeness Analysis

**Date:** 21 June 2026 · **Mode:** Main agent (BUILD) · **Method:** evidence-based — live DB row counts, live route probes, live feature-flag state, and code phase markers. Every figure below is cited to a query/probe run on the shared dev database today. Where a number could not be derived from evidence, a **qualitative band** (High/Medium/Low/None) is used instead of a fabricated percentage.

---

## 0. Scope resolution (read this first)

You asked for *"completeness % analysis of competency assessment phase 1 to phase 1.15 … check whether all required modules are dynamic, activated, functional, data flow end-to-end."*

The canonical phase index for the **competency assessment** track lives **in code** (route section markers in `backend/routes/competency-intelligence.ts` + `*_VERSION='phase-1.x'` service constants), and is the **Competency Framework Intelligence — Phase 1** series:

| Sub-phase | Name | Service |
|---|---|---|
| **1 (foundation)** | Competency Framework Intelligence spine | `competency-framework-intelligence.ts` |
| **1.1** | Competency Type Classification | `competency-type-classification.ts` |
| **1.2** | Competency Master Enhancement | `competency-master.ts` |
| **1.4** | Micro Competency Framework | `micro-competency.ts` |
| **1.5** | Role Competency Profile Engine | `role-competency-profile.ts` |
| **1.6** | Assessment Foundation Mapping | `assessment-foundation-mapping.ts` |
| **1.7** | Search & Discovery | `competency-search.ts` |

> **Honesty note on "1.15":** there is **no Phase 1.3 and no 1.8–1.15** anywhere in the code, docs, or migrations (verified by repo-wide search). The series tops out at **1.7**, with **1.3 never assigned**. I analyse the real implemented set and will not invent 1.8–1.15 to match the number.
>
> **Possible alternate scope:** a stale session plan referenced "Phase 1 (Ontology + Assessment, per docs/implementation-roadmap.md §1)" built on `capadex_*` (commercial/CAPADEX) tables. That is a **different** track from "competency assessment." If you actually meant that one, say so and I'll re-run against it.

A prior audit for this exact scope exists at `backend/audit/phase-1/` (7 reports, 19 Jun). **The live shared DB has since drifted from it** (see §3) — this report measures the DB as it is today.

---

## 1. Two-axis verdict (Coverage vs Confidence kept SEPARATE)

These are reported as **counts**, not invented percentages.

**Structural Coverage — 7 of 7 sub-phases structurally complete.** Every sub-phase has a service, a flag-gated route, and schema present. (Only `competency-search` lacks a cosmetic `*_VERSION` stamp.)

**Data / Activation Confidence — 5 of 7 data-active; 2 of 7 data-empty.**
- **Data-active:** foundation, 1.1, 1.5, 1.6, 1.7.
- **Data-empty (no rows in the live DB):** **1.2** (`onto_competency_master_ext=0`) and **1.4** (`onto_competency_hierarchy=0`).
- **Of the 5 active, 2 carry honest content gaps:** 1.1 (Future Skills = 0, Technical sparse) and 1.6 (only **7 of 299** competencies have any question mapping).

**World-class 100% is NOT reached.** The engineering is essentially complete; the distance to 100% is **content + seed activation in the live DB**, not code.

---

## 2. Activation: live confirmation

- **Feature flag** `FF_COMPETENCY_FRAMEWORK_INTELLIGENCE=1` is **ON** in the running `Backend API` workflow (with `FF_COMPETENCY_RUNTIME/INTELLIGENCE/EI`).
- **Route probes (`:8080`, unauthenticated)** all return **`401`** (auth gate) — **not `503`** — proving routes are registered, gated, and the flag is active (flag-off would 503): `/api/competency-intelligence/{spine,competencies,levels,indicators,taxonomy,crosswalk}` and `/api/admin/competency-intelligence/readiness`.
- **UI consumer (admin):** SuperAdmin panels (`RoleCompetencyProfilePanel.tsx`, CFI tab in `SuperAdminDashboard.tsx`) fetch the competency-framework admin endpoints (`spine`, `master`, `role-profiles`, `role-matrix`, `role-readiness`) — confirming an **admin UI consumer exists**. *Caveat:* the exact mount prefix was obscured in tooling output and the **end-user-facing** path was not separately verified in this pass, so I do not claim a full end-user E2E UI flow.

---

## 3. Live data evidence (shared dev DB, today)

**Namespace split:** `onto_*` = curated/seeded library (populated); `ont_*` = O*NET-derived (**all 24 `ont_*` tables = 0**, empty in dev by design — correct, not a Phase-1 defect).

Curated `onto_*`:
```
onto_competencies            = 299     onto_assessment_blueprints      = 6
onto_competency_types        = 5       onto_blueprint_competency_map   = 28
onto_competency_type_map     = 299     onto_role_assessment_map        = 3
onto_domains                 = 5       onto_competency_question_map    = 25 rows
onto_families                = 29        └─ but COUNT(DISTINCT competency_id) = 7  ◀ only 7/299 competencies mapped
onto_proficiency_levels      = 5       onto_role_competency_profiles   = 14
onto_layers                  = 4       onto_role_weights               = 35
onto_indicators              = 66      onto_competency_master_ext      = 0  ◀ GAP (1.2)
                                       onto_competency_hierarchy       = 0  ◀ GAP (1.4)
```

Runtime spine has actually executed end-to-end (data flowed, not just schema present):
```
onto_assessment_instances=15 · onto_assessment_responses=66 · onto_competency_scores=12
onto_competency_score_runs=2 · onto_competency_profiles=8 · onto_assembled_assessments=3
onto_question_blueprints=7 · onto_question_competency_mapping=23 · onto_question_difficulty_framework=5
```

---

## 4. Per-sub-phase scorecard

**Dyn** = reads live DB (not hardcoded) · **Act** = flag-on + route serving (401-proven) · **Fn** = returns real data · **E2E** = data flows upstream→here→downstream · **Coverage** = structural (code+route+schema) · **Confidence** = live data activation band.

| Sub-phase | Dyn | Act | Fn | E2E | Coverage | Confidence | Evidence / honest note |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| **1 Foundation** | ✅ | ✅ | ✅ | ✅ | Complete | **High** | 299 genome + 5 domains / 29 families / 5 levels / 4 layers / 66 indicators; feeds all downstream |
| **1.1 Type Classification** | ✅ | ✅ | ✅ | ✅ | Complete | **High** | 5 types; `type_map=299` → 299/299 classified. Content gap surfaced honestly: Future Skills=0, Technical sparse |
| **1.2 Master Enhancement** | ✅ | ✅ | ⚠️ | ❌ | Complete | **None** | engine+route live but `onto_competency_master_ext=0` → no rows in this DB |
| **1.4 Micro Competency** | ✅ | ✅ | ⚠️ | ❌ | Complete | **None** | `onto_competency_hierarchy=0` (was 12 in 19-Jun audit → not present in this DB) |
| **1.5 Role Competency Profile** | ✅ | ✅ | ✅ | ✅ | Complete | **Medium** | 14 profiles + 35 weights + 3 role→assessment maps; breadth limited (5 roles) |
| **1.6 Assessment Foundation** | ✅ | ✅ | ✅ | ◑ | Complete | **Low** | 6 blueprints + 28 blueprint→competency maps, but question_map covers only **7/299** competencies |
| **1.7 Search & Discovery** | ✅ | ✅ | ✅ | ✅ | Complete | **High** | faceted search over the live 299 genome; no own table by design |

---

## 5. Honest gaps to reach world-class 100%

**A. Data-empty engines (highest impact — seed/activation, no code change):**
1. **1.2 Master Enhancement** — populate `onto_competency_master_ext` (run the master-enhancement seed against this DB). Currently 0.
2. **1.4 Micro Competency** — populate `onto_competency_hierarchy` + author parent-child relationships. Currently 0.

> **Likely cause (hypothesis, not log-proven here):** the 19-Jun audit ran in an environment where these seeds had been applied; the shared dev DB does not carry those rows. This is *consistent with* the known "merged-task data backfills don't reach the shared/live DB" pattern, but I did not pull a migration/run log to prove this specific incident. Re-running the seeds here (and in prod at publish) closes 1.2 and 1.4.

**B. Content-breadth gaps (authoring on working engines):**
3. **Future Skills = 0, Technical = sparse** in the genome (1.1 correctly reports this rather than fabricating AI/digital competencies).
4. **Competency→Question coverage (1.6): only 7 of 299** competencies have an authored question mapping (25 mapping rows, 7 distinct competencies) → the large majority of competencies are not yet directly measurable. This is the single highest-leverage assessment gap.
5. **Role breadth (1.5):** 5 roles / 14 profiles; world-class needs the broader role catalogue (the empty `ont_*` O*NET side feeds this).

**C. Engineering polish (minor):**
6. Version history is partial (who/when logged; before-values not) — per prior audit.
7. `competency-search` carries no `*_VERSION` stamp (cosmetic).

---

## 6. Bottom line

- **Dynamic / Activated / Functional?** Yes, end-to-end, for **foundation, 1.1, 1.5, 1.6, 1.7**. **1.2 and 1.4 are activated and functional as code but data-empty** (0 rows) → their data flow is broken at the data layer only.
- **Structural Coverage:** 7/7 sub-phases complete. **Data Activation:** 5/7 active, 2/7 empty, and 2 of the active 5 carry content gaps (1.1, 1.6).
- **Distance to world-class 100% is content + seed activation, not engineering:** seed 1.2 & 1.4; author Future-Skills/Technical competencies; raise competency→question coverage well beyond 7/299; expand role breadth / run the O*NET import to light up the `ont_*` side.

*No fabricated percentages — quantities are counts or qualitative bands tied to cited evidence. Empty tables are reported as empty; the absent 1.3 / 1.8–1.15 sub-phases are reported as absent.*
