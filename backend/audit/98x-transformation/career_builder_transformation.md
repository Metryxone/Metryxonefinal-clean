# Career Builder Transformation

**Task:** MX-98X-ENTERPRISE-COMPETENCY-TRANSFORMATION · Section 5
**Date:** 2026-06-23 · Read-only. Evidence = live counts + service trace.

## Question: can Career Builder become competency-driven?

**Yes — the content graph is built and seeded; the missing half is per-user activation from competency scores.** Every *content* table is populated, every *user* table is empty:

**Content (built + seeded):** `cg_roles` **200**, `cg_role_edges` **500**, `cg_skill_requirements` **711**, `cg_tracks` **15**, `cg_track_waypoints` **76**, `cg_learning_resources` **76**, `cg_skill_resource_map` **256**, `cg_promotion_rules` **40**, `cg_lateral_rules` **25**, `cg_readiness_weights` **1**.

**User surfaces (all 0):** `cg_user_role_readiness`, `cg_user_skill_gaps`, `cg_user_recommendations`, `cg_user_career_path`, `cg_user_learning_recs`.

→ The graph can answer "what does a path/role/skill look like?" but not yet "what is *this* assessed user's path/gap/plan?" — because assessment results don't fire into the user layer.

---

## Target flow vs reality

| Stage | Backing (rows) | Status | Gap |
|---|---|---|---|
| Assessment | `onto_assessment_instances` 45 / `_responses` 66 | ✅ | pilot volume |
| Competency Intelligence | `onto_competency_profiles` 38 | ✅ | not surfaced into Career Builder per-user |
| Role Fit | Role-Readiness-V2 + `cg_roles` 200 | 🟡 | engine present, `cg_user_role_readiness` **0** |
| Career Paths | `cg_tracks` 15 / `cg_track_waypoints` 76 / `cg_role_edges` 500 | ✅ content / ⬜ user | `cg_user_career_path` **0** |
| Skill Gaps | `cg_skill_requirements` 711 | ✅ content / ⬜ user | `cg_user_skill_gaps` **0** |
| Competency Gaps | `onto_role_competency_profiles` 14 / `onto_role_weights` 44 | 🟡 | competency-gap engine not wired to user |
| Learning Paths | `cg_learning_resources` 76 / `cg_skill_resource_map` 256 | ✅ content / ⬜ user | `cg_user_learning_recs` **0** |
| Development Plans | M5 `m5_career_growth_plans`, `m5_development_journeys` (enterprise) | 🟡 | exists on enterprise side, not candidate-wired |
| Career Progression | `p4_competency_history` 8,970 / `p4_growth_trajectories` 0 | 🟡 | rich history corpus, trajectory user rows 0 |

---

## Assessment by requested dimension

### Current capability ✅
- Full **career graph** (roles, edges, tracks, waypoints) + **learning resources** mapped to skills.
- Promotion/lateral **mobility rules** (40/25).
- **Competency scoring** output available (`onto_competency_profiles` 38).
- **Longitudinal corpus** (`p4_competency_history` 8,970, `p4_benchmark_trends` 26,910) for progression.

### Missing capability ⬜
- **Per-user generation**: nothing writes `cg_user_*` from an assessment.
- **Competency→skill bridge**: `onto_competencies` (419) ↔ `cg_skill_requirements` (711) are different vocabularies — no mapping table observed → competency gaps can't auto-translate to skill/learning recs.
- **Development-plan wiring** for candidates (M5 plans are enterprise-scoped).
- **Trajectory activation** (`p4_growth_trajectories` 0 despite 8,970 history rows).

### Required data
- A **competency↔skill crosswalk** (`onto_competencies` → `cg_skill_requirements`) — the missing translation layer.
- Per-user rows in `cg_user_*` (generated, not seeded).

### Required intelligence
- Role-fit + gap engines fired per assessed user (engines exist: Role-Readiness-V2, gap analysis).
- Learning-rec selection from `cg_skill_resource_map` keyed on the user's gaps.

### Required automation
- An **assessment-completion hook** that: scores → computes role fit → derives competency+skill gaps → selects learning resources → writes `cg_user_*` + a development plan. (The platform already uses `postCompletionHooks` patterns elsewhere — reuse, don't rebuild.)

---

## The transformation (additive, no rebuild)
1. **Build the competency↔skill crosswalk** (the single missing data bridge between scoring and the career graph).
2. **Add an assessment-completion automation** that materializes `cg_user_role_readiness/skill_gaps/recommendations/career_path/learning_recs`.
3. **Activate trajectories** from the existing `p4_competency_history` corpus (engine exists; rows just need to be written for users).
4. **Wire candidate development plans** by reusing the M5 plan engine at candidate scope.

Career Builder reaches "competency-driven" purely by **connecting existing scoring → existing graph via one crosswalk + one automation**. No content rebuild, no replacement.

---

## Evidence ledger
- **Content vs user counts** (`cg_roles` 200, `cg_role_edges` 500, `cg_skill_requirements` 711, `cg_tracks` 15, `cg_track_waypoints` 76, `cg_learning_resources` 76, `cg_skill_resource_map` 256, `cg_promotion_rules` 40, `cg_lateral_rules` 25, `cg_readiness_weights` 1; all `cg_user_*` 0; `onto_competency_profiles` 38, `onto_assessment_instances` 45 / `_responses` 66, `p4_competency_history` 8,970, `p4_growth_trajectories` 0) → live shared-DB `count(*)`, 2026-06-23 session.
- **Engine availability** (Role-Readiness-V2, gap analysis, `postCompletionHooks` pattern, M5 plan engines) → service trace + memory `.agents/memory/cgi-architecture.md`, `career-intelligence-phase4x-compose.md`.
- **Competency↔skill vocabulary gap** (no observed mapping table between `onto_competencies` and `cg_skill_requirements`) → asserted as *absence*; if such a table exists it was not found this session — treat as "build or surface", verify before implementation.
