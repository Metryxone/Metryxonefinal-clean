# Employer Intelligence Transformation

**Task:** MX-98X-ENTERPRISE-COMPETENCY-TRANSFORMATION · Section 4
**Date:** 2026-06-23 · Read-only. Evidence = live counts + route/service trace.

## Question: can employers operate *entirely* on competency intelligence?

**Not yet — but the substrate is ~75% built and needs wiring, not construction.** The blocking reality: every employer table is empty (`employer_jobs`/`employer_candidates`/`employer_company_profiles` = **0**) and the hiring assessment path consumes `lbi_scores` (0) + `cra_scores` (0) + TIG (`tig_*` 0) + a hardcoded `DEPT_BEHAVIORAL_PROFILES` heuristic — **a path disjoint from the competency scoring ledger** (`onto_competency_profiles` 38). So an employer cannot today see a candidate's *competency* result, even though the platform computes one.

---

## Target flow vs current capability

| Stage | Current capability | Missing capability | Required wiring |
|---|---|---|---|
| 1. Employer | `POST /api/employer/register`; `tenants` (4, types incl. enterprise/government/university) | real employer onboarding at scale | tenant↔employer link |
| 2. Industry | selector backed by `ont_industries` 206 | curated depth (2) | seed curated from reference |
| 3. Function | selector backed by `ont_functions` 30 | curated depth (3) | seed curated from reference |
| 4. Department | selector backed by `ont_departments` 43 | curated depth (4); naming unification | seed + unify subfunction/department label |
| 5. Role Family | `ont_role_families` 31 | curated depth (4) | seed from reference |
| 6. Role | `ont_roles` 1,040 available | hard Role→`onto_roles` link on job (role is free-text today) | enforce role binding via `role-crosswalk.ts` |
| 7. Suggested Competencies | `analyzeRole` suggests via **hardcoded** `DEPT_BEHAVIORAL_PROFILES` + employer-entered skills; reads `onto_role_competency_profiles` only when standard role linked | data-backed suggestion from `map_role_competency` (52,362) / `onto_role_weights` (44) | replace heuristic default with crosswalk-resolved requirements |
| 8. Competency Weighting | free-text `skills`/`requirements` JSONB edit | governed picker with weight + target level | weight model on `employer_jobs` |
| 9. Assessment Generation | generates **Interview Blueprint** (`generateInterviewBlueprint`) — NOT a competency assessment | route through `onto_assessment_blueprints` (6) so candidate takes the *scored* assessment | unify generation path |
| 10. Candidate Assessment | candidate competency read from `lbi_scores`/`cra_scores` (0) | consume `onto_competency_profiles`/`onto_competency_score_runs` | **the keystone bridge** |
| 11. Competency Match | 6-dim behavioural heuristic | competency-vector match vs role DNA | reuse Role-Readiness-V2 |
| 12. Role Match | role intelligence present (`m3_role_market_scores` 5) | per-candidate role match from competency | compose readiness engine |
| 13. Readiness Score | Role-Readiness-V2 engine exists | fire per candidate | wire to `cg_user_role_readiness` (0) |
| 14. Hiring Recommendation | TIG hiring-intelligence + calibration (Brier/ECE/isotonic) **built**, 0 outcomes | recommendation grounded in competency + calibrated probability | feed outcomes to calibrate |

---

## Assessment by requested dimension

### Current capability ✅
- Employer registration + job CRUD; tenant model with enterprise/government/university types.
- Role/industry **breadth** via O*NET reference (1,040 roles, 206 industries).
- **Hiring intelligence stack**: TIG graph, calibration engine (Brier score, ECE, isotonic/PAV, beta-binomial smoothing — explorer-confirmed in `employer-tig-calibration.test.ts`), M5 workforce.
- Role-Readiness-V2 + role-competency-profile engines.

### Missing capability ⬜
- **Competency score → hiring view bridge** (the one that makes hiring "competency-based").
- **Data-backed competency suggestion** from the 52,362-edge requirement library.
- **Unified assessment generation** (employer uses interview blueprints, not the scored competency assessment).
- **Governed competency weighting** UI/data model.
- **Any live employer data** (0 jobs / 0 candidates).

### Required intelligence
- Per-candidate competency vector (have the engine, lack the wire).
- Role DNA per posted role (have composition, lack crosswalk fill).
- Calibrated hiring-success probability (have math, lack outcomes).

### Required data models (mostly EXIST — need population/extension)
- `employer_jobs` (+ competency-weight column) · `employer_candidates.competency_profile` (populate from `onto_*`) · `map_ont_onto_role` (fill) · `tig_*` outcomes for calibration.

### Required APIs (exist, need re-pointing)
- `analyzeRole` → seed from `map_role_competency`. · Assessment-generate → `onto_assessment_blueprints`. · Candidate-link → copy `onto_competency_profiles`.

### Required services (exist)
- `employer-hiring-intelligence.ts`, `role-crosswalk.ts`, `onet-onto-weight-bridge.ts`, Role-Readiness-V2, `peer-benchmark.ts` (k_min=30), TIG calibration.

---

## The 4 bridges to "fully competency-driven employer" (priority)
1. **Scoring→Hiring bridge** — populate `employer_candidates.competency_profile` from `onto_competency_profiles`/`score_runs`. *(unlocks competency-based hiring)*
2. **Data-backed suggestion** — `analyzeRole` seeds competencies from `map_role_competency`/`onto_role_weights`; keep heuristic only as fallback.
3. **Unified assessment** — generate via `onto_assessment_blueprints` so the candidate's assessment is the one the platform scores.
4. **Calibration activation** — capture hire/reject outcomes into TIG so the (already-built) Brier/ECE/isotonic loop produces calibrated probabilities (≥30 outcomes → `calibrated`).

**All four are additive wiring on an existing, sound stack — no rebuild, no O*NET/competency-framework replacement.** Detail/IDOR notes carry over from `.agents/memory/employer-portal.md` + `employer-tig-architecture.md`.

---

## Evidence ledger
- **Zero-state counts** (`employer_jobs`/`employer_candidates`/`employer_company_profiles` 0, `lbi_scores`/`cra_scores`/`tig_*` 0, `onto_competency_profiles` 38, `cg_user_role_readiness` 0, `m3_role_market_scores` 5, `onto_assessment_blueprints` 6, `map_role_competency` 52,362, `onto_role_weights` 44, `ont_*` reference breadth) → live shared-DB `count(*)`, 2026-06-23 session.
- **Hiring path internals** (`DEPT_BEHAVIORAL_PROFILES` heuristic, `generateInterviewBlueprint`, 6-dim match, TIG calibration Brier/ECE/isotonic/beta-binomial, status ladder) → explorer trace of `employer-hiring-intelligence.ts` / `employer-tig.ts` (+ `employer-tig-calibration.test.ts`), this session + memory `.agents/memory/employer-portal.md`, `employer-tig-architecture.md`.
- **Disjoint-scoring finding** also corroborated by prior validation `backend/audit/competency-onet-validation/employer_customization_readiness.md` (committed `da07dd93`).
