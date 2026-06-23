# Competency Intelligence Spine Assessment

**Task:** MX-98X-ENTERPRISE-COMPETENCY-TRANSFORMATION · Section 2
**Date:** 2026-06-23 · Read-only. Evidence = live counts + route/service trace.

## Question: does a *unified* competency intelligence layer exist?

**Partly.** The spine is **structurally continuous from Industry → Scoring** and again **Scoring → Employability**, but it **forks into parallel/disconnected paths** at three joints (Role↔O*NET, Scoring↔Employer, Career-Builder user activation). There is no single "Competency Intelligence" service that every downstream module reads from; instead each consumer re-reads `onto_*` directly. That is acceptable, but it means the layer is *implicit*, not *materialized* — and the forks are where enterprise maturity leaks.

---

## Spine trace (node by node)

| # | Node | Backing (rows) | Status | Note |
|---|---|---|---|---|
| 1 | Industry | `onto_industries` 2 / `ont_industries` 206 | 🟡 | curated seed-starved; breadth on reference side |
| 2 | Function | `onto_functions` 3 / `ont_functions` 30 | 🟡 | same |
| 3 | Department | `onto_subfunctions` 4 / `ont_departments` 43 | 🟡 | **naming conflict** (subfunction vs department) |
| 4 | Role Family | `onto_role_families` 4 / `ont_role_families` 31 | 🟡 | 4 namespaces |
| 5 | Role | `onto_roles` 5 / `ont_roles` 1,040 | 🟡 | **crosswalk 5/1040 = chokepoint** |
| 6 | Competency Profile | `onto_role_competency_profiles` 14 / `map_role_competency` 52,362 | 🟡 | **two unreconciled role→competency sources** |
| 7 | Assessment Blueprint | `onto_assessment_blueprints` 6 | 🟡 | shadowed by domain-proxy shortcut |
| 8 | Question Blueprint | `onto_question_blueprints` 7 / `onto_question_competency_mapping` 23 | 🟡 | shallow |
| 9 | Assessment Runtime | `onto_assessment_instances` 45 / `_responses` 66 | ✅ | works, pilot-scale |
| 10 | Scoring | `onto_competency_score_runs` 2 + `onto_competency_profiles` 38 | ✅ | **dual ledger (parallel scoring path #1)** |
| 11 | Competency Intelligence | *(implicit — no dedicated table; readers re-query `onto_*`)* | 🟡 | **not materialized as a layer** |
| 12 | Employability Intelligence | `employabilityEngine.ts` (8-dim) | ✅ | clean consumer |
| 13 | Career Builder | `cg_*` content seeded; `cg_user_*` **0** | ⬜ | **disconnected: no user activation** |
| 14 | Career Passport | `cp_*` 12 | 🟡 | consumes, no outcome loop |
| 15 | Employer Intelligence | `employer_*` 0; reads `lbi_scores`/`cra_scores` 0 | ⬜ | **parallel scoring path #2 — disjoint from node 10** |
| 16 | Workforce Intelligence | `m5_*` pilot 5-row; forecasts 0 | ⬜ | **silo: no live tenant data** |

---

## The six requested findings

### Missing connections
1. **Scoring (10) → Employer Intelligence (15).** `onto_competency_profiles` (38) never reaches `employer_candidates` (0). Employer hiring uses a *separate* LBI/CRA/heuristic path. **This is the #1 broken connection.**
2. **Scoring (10) → Career Builder user surfaces (13).** All `cg_user_role_readiness/skill_gaps/recommendations` = 0; assessment results don't generate per-user career intelligence.
3. **Role (5) → O*NET library (5→6).** Crosswalk `map_ont_onto_role` = 5, so 1,035 O*NET roles + 52,362 requirement edges can't feed role profiles.
4. **Outcome capture → Employability/Predictive validation.** No realized-outcome table feeding back into the index or calibration (`tig_*` = 0).
5. **Tenant org data → Workforce Intelligence.** `tenant_capability_profiles` = 0 → `m5_*` forecasts never fire.

### Duplicate logic
- **Two scoring ledgers** by design (`score_runs` rich vs `profiles` runtime) — must be unioned; acceptable but undocumented as a count trap.
- **Two role→competency requirement sources** (curated 14 vs O*NET 52,362) that don't reconcile.
- **Parallel assessment-generation** (competency blueprint vs employer Interview Blueprint engine).
- **Department/subfunction naming** duplicated across namespaces.

### Disconnected modules
- **Career Builder user layer** (`cg_user_*` all 0) — built, unfired.
- **Employer Portal** (`employer_*` 0) — built, unfired, on a disjoint scoring path.
- **EIOS** (`eios_*` all 0) — enterprise pillars built, zero data.
- **Future-Readiness user layer** (`frp_user_readiness`/`frp_user_skill_profile` 0) despite rich content (`frp_role_evolution` 5,250).

### Unused intelligence
- **`map_role_competency` (52,362 edges)** — the richest single asset, barely consumed (only via 5 bridged roles).
- **`p4_competency_history` (8,970) + `p4_benchmark_trends` (26,910)** — substantial longitudinal/benchmark data with thin consumer surfaces.
- **`frp_role_evolution` (5,250)** — future-readiness role-evolution corpus, not surfaced into career paths.
- **`ont_layers.scoring_weight`** — present, not consumed.

### Data silos
- **Three competency namespaces** (`onto_*` / `ont_*` / `competency_*`) joined only by name.
- **Employer (LBI/CRA/TIG) vs platform (onto competency)** — two talent-signal worlds.
- **Market (`m3_*`) and Workforce (`m5_*`)** seeded independently, not cross-feeding role DNA.

### Parallel scoring paths
1. **Competency scoring** → `onto_competency_profiles` / `onto_competency_score_runs` (the canonical one).
2. **Employer/behavioural scoring** → `lbi_scores` / `cra_scores` / TIG calibration (disjoint).
3. **Predictive on-demand** → dropout/burnout/employability/leadership (computed live in `predictive-intelligence.ts`, not persisted, reads behavioural signals not competency scores).
→ **These three never reconcile to a single "competency intelligence" verdict per person.**

---

## Recommendation — materialize the spine (additive, no rebuild)
1. **Introduce a thin "Competency Intelligence" read-layer** (a composing service / view, not a new scoring engine) that every downstream module (Career Builder, Employer, Workforce) reads from — so there is one source of the per-subject competency verdict.
2. **Converge the three scoring paths** by making competency score the canonical currency: feed `onto_competency_profiles` into the employer + career-builder + predictive consumers (predictive can *augment* with behavioural, never replace).
3. **Close the 5 missing connections** in priority order: Scoring→Employer, Scoring→Career-Builder, Role→O*NET crosswalk, Outcome-capture→validation, Tenant→Workforce.
4. **Document the dual ledger + dual requirement source** as known, union-on-read.

All additive. The spine already exists end-to-end in *structure*; this makes it *unified in data*.

---

## Evidence ledger
- **All node row counts** in the trace table → live shared-DB `count(*)`, 2026-06-23 session.
- **Three-namespace silo, dual ledger, dual role→competency source, parallel scoring paths** → route/service trace + prior validation `backend/audit/competency-onet-validation/*.md` (committed `da07dd93`) + memory `.agents/memory/competency-onet-three-system-silo.md`, `competency-runtime-dual-scoring-ledger.md`.
- **Predictive path (on-demand, reads behavioural not competency)** → explorer trace of `predictive-intelligence.ts` (this session).
- Status glyphs (✅/🟡/⬜) are author classifications from the measured counts, not a separate metric.
