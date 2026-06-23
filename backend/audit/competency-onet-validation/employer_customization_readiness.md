# Employer Customization Readiness

**Task:** MX-COMPETENCY-ONET-ARCHITECTURE-VALIDATION · Section 4
**Date:** 2026-06-23 · Read-only. Evidence = route/service trace + live row counts.

## Target workflow vs reality

```
Employer → Create Job → Select Industry → Function → Department → Role Family → Role
→ System Suggests Competencies → Employer Adjusts → System Generates Assessment
→ Candidate Assessment → Scoring → Hiring Intelligence
```

**Headline:** the workflow is **partially ready — the scaffolding exists for every step, but the spine is broken at two joints and there is zero live data** (`employer_jobs` 0, `employer_candidates` 0, `lbi_scores`/`cra_scores`/`tig_*` all 0). Most importantly, the **employer hiring assessment does not use the competency assessment engine** — it runs a separate behavioural/psychometric path. So today an employer cannot see a candidate's *competency* score.

---

## Stage readiness

| Stage | Status | Evidence |
|---|---|---|
| **Employer account / create job** | ✅ **Ready** | `POST /api/employer/register`, `POST /api/employer/jobs` (CRUD). Table `employer_jobs` (skills/requirements/responsibilities JSONB). 0 rows = unexercised. |
| **Select Industry → Function → Department** | 🟡 **Partially ready** | UI (`EmployerPortalPage.tsx`) exposes the selectors; backing taxonomy exists (`ont_industries` 206 / `ont_functions` 30 / `ont_departments` 43). Curated side is seed-starved (2/3/4). |
| **Select Role Family → Role** | 🟡 **Partially ready** | `ont_roles` (1,040) available; but job creation does **not enforce** a hard Role→`onto_roles` link — role is free-text in the basic CRUD, consumed heuristically by the analysis engine. |
| **System suggests competencies** | 🟡 **Partially ready / wrong source** | `analyzeRole` in `employer-hiring-intelligence.ts` suggests via a **hardcoded `DEPT_BEHAVIORAL_PROFILES` heuristic** (e.g. Engineering→Analytical 85) + union of employer-entered skills/requirements. It reads `onto_role_competency_profiles` via `getRoleProfile` *only when a standard role id is linked* (rare). The **52,362-row O*NET `map_role_competency` requirement library is NOT used** to seed suggestions. |
| **Employer adjusts competencies** | ✅ **Ready (crude)** | Adjustment = editing `skills`/`requirements` JSONB on `employer_jobs`, which re-triggers role intelligence. Works, but it's free-text editing, not "add/remove from a governed competency picker with weights/levels." |
| **System generates assessment** | 🟡 **Partially ready / different artifact** | The system generates an **Interview Blueprint** (`generateInterviewBlueprint`, selects from a `BLUEPRINT_QUESTIONS` bank by weakest dimension) — **not** a competency assessment from `onto_assessment_blueprints`. The two assessment engines are disjoint. |
| **Candidate assessment** | ⬜ **Broken link** | Candidate competency comes from `lbi_scores` (0) + `cra_scores` (0) pre-existing sessions, written into `employer_candidates.competency_profile` JSONB. It does **not** consume `onto_competency_profiles` / `onto_competency_score_runs` (the real competency scores). |
| **Scoring** | ⬜ **Disjoint** | Hiring match is a 6-dimension heuristic over behavioural/psychometric inputs, not the competency scoring ledger. |
| **Hiring intelligence** | 🟡 **Ready (structurally), empty** | `/api/employer/hiring-intelligence/analyze`, TIG (`tig_nodes`/`edges`/`intelligence` = 0), calibration (`/api/employer/tig/calibration`), M5 workforce (`/api/m5/wfi/skill-gaps`, `/api/m5/succ/summary`). Full stack present, **zero data**; candidate drawer separates Coverage vs Confidence (route-trace: employer candidate drawer / memory `employer-portal.md`). |

---

## Classification

### ✅ Ready
- Employer registration + job CRUD.
- Competency *adjustment* mechanism (JSONB edit).
- Hiring-intelligence + TIG + M5 route/service stack (structurally complete).

### 🟡 Partially ready
- Industry/Function/Department/RoleFamily/Role selectors (backed by O*NET breadth, curated seed thin, role link not enforced).
- Competency *suggestion* (works but from a hardcoded heuristic, not the O*NET requirement library or curated profiles).
- Assessment *generation* (produces interview blueprints, not competency assessments).

### ⬜ Missing (the spine breaks)
- **No bridge from competency scoring → employer hiring view.** `onto_competency_profiles` (38) never reaches `employer_candidates`. This is the gap that makes "competency-based hiring" not actually competency-based today.
- **No governed competency picker** (add/remove/weight against the genome) — adjustment is free-text JSONB.
- **No role→requirement auto-suggest from O*NET** (`map_role_competency` 52,362 unused on the employer side).

### ⚠️ Over-engineered (built ahead of need)
- **TIG** (Talent Intelligence Graph: `tig_nodes`/`edges`/`intelligence`) + **M5 Enterprise Workforce OS** (skill-gaps, succession) are a full enterprise analytics layer with **0 rows** and no live employer. Powerful, but far ahead of a workflow that has zero jobs posted.
- **Interview Blueprint engine** duplicates assessment-generation responsibility that the competency blueprint layer (`onto_assessment_blueprints`) already owns.

### Under-engineered
- The **one joint that matters** — assessed competency → hiring decision — is the least built.

---

## Does the existing architecture support the target workflow?

**Yes, with two targeted bridges — no rebuild needed.** The route/table scaffolding is all present. To make it real:

1. **Bridge scoring → hiring (highest priority):** on candidate link, copy/derive `employer_candidates.competency_profile` from `onto_competency_profiles` / `onto_competency_score_runs` instead of (or in addition to) `lbi_scores`/`cra_scores`.
2. **Suggest from the real library:** in `analyzeRole`, when a role resolves through `role-crosswalk.ts`, seed suggested competencies from `map_role_competency` (O*NET, 52,362) and/or `onto_role_competency_profiles` — replace the hardcoded `DEPT_BEHAVIORAL_PROFILES` default with a data-backed one (keep heuristic only as fallback).
3. **Unify assessment generation:** route employer assessment generation through `onto_assessment_blueprints` so the candidate takes the *same* competency assessment the platform already scores — instead of a parallel interview-blueprint artifact.
4. **Governed competency picker:** replace free-text `skills`/`requirements` editing with add/remove against the genome (`onto_competencies`) carrying weight + target level.
5. **Defer TIG/M5 depth** until there is real employer volume — keep parked, don't expand.

**None of these require new tables or a rebuild — they are wiring changes on an existing, sound substrate.** All would need approval before implementation.
