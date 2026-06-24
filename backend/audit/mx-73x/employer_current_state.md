# MX-73X · Section 1 — Employer Intelligence Current-State Audit

> Read-only audit of the existing employer intelligence stack, conducted before any change.
> Honesty-first: Coverage (does data exist) and Confidence (is it trustworthy) reported as
> separate axes. `null`/absent is reported as absent — never inflated to 0 or fabricated.

## Method
- Static read of the employer services/routes (no rebuild).
- Live row counts against the shared PostgreSQL (= production DB).

## Working components (already implemented — do NOT rebuild)

| Target-flow stage | Status | Where |
|---|---|---|
| Job | ✅ | `employer_jobs` table; `routes/recruiter-postings.ts`, `routes/employer-portal.ts` |
| Role DNA | ✅ | `generateRoleDNA` in `services/role-dna-expansion-engine.ts` (curated `onto_*` over O*NET) |
| Required competencies | ✅ | `RoleDNARequirement[]` (curated requirements + O*NET inheritance) |
| Required levels | ✅ | `expectedLevel` (1–5) / `targetProficiency` → `targetScoreOf()` |
| Role benchmarks | ✅ | `generateRoleBenchmark` over `ti_role_benchmarks` (abstains when absent) |
| Assessment | ✅ | `routes/hiring-assessment-engine.ts` (invite → completion → score) |
| Readiness | ✅ | `computeRoleReadinessV2` in `services/role-readiness-v2.ts` |
| Competency match | ✅ | `computeCompetencyDrivenMatch` → `competencyMatch` (0–100), coverage, gaps, fit band |
| Interview intelligence | ✅ | `deriveInterviewRecommendation` (focus = measured gaps, probe = unassessed) |
| Hiring recommendation | ✅ | `deriveHiringRecommendation` (decision-SUPPORT action, never a hire/no-hire verdict) |
| Employer benchmark | ✅ | `deriveEmployerBenchmark` (k-anonymity enforced, k≥30) |

The competency-driven flow is the ONE primary engine: `computeEmployerCompetencyIntelligence`
(Phase 5) COMPOSES `computeCompetencyDrivenMatch` (Phase 3) which composes Phase-1 Role DNA +
Phase-2 unified competency profile + Role-Readiness-V2. All read-only, flag-gated
(`employerCompetencyHiring`, env `FF_EMPLOYER_COMPETENCY_HIRING`, default **OFF**).

## Disconnected / unused intelligence (honest gaps)

1. **No unified Hiring Score composing all five inputs.** The engine produced a competency-only
   match (`competencyMatch`). The **Employability Index** (`employer_candidates.ei_score`) was
   stored on the candidate but **never folded into a hiring score**, and there was no single
   0–100 number combining Competency + Readiness + Employability + Role-Match + Benchmark.
   → **This is the one real engineering gap MX-73X closes** (see Section 5 / `hiring_score_model.md`).
2. **Readiness is surfaced as context, not a score driver.** `candidateReadiness` rides alongside
   the match but did not weight any composite — now an input to the unified score.
3. **Parallel hiring engines exist as gated fallbacks.** Legacy heuristic
   `routes/employer-hiring-intelligence.ts` (STRONG_HIRE/NO_HIRE keyword overlap) and
   `routes/hiring-intelligence.ts` (`hiring_probability`) remain. They are intentionally untouched
   fallbacks behind their own flags; the competency engine does not call them. The success
   criterion "no parallel hiring logic" is satisfied by **gating** (competency-primary path is the
   sole active intelligence when its flag is on), not by deletion.

## Missing links (closed by MX-73X)
- Employability Index → hiring score: **closed** (Section 5 unified score).
- Readiness → hiring score: **closed** (now a weighted, null-safe component).
- Role-DNA confidence + benchmark → hiring score: **closed** (components, benchmark abstains under k-anon).

## Operational ceiling (honest, not a defect)
Live row counts (shared/prod DB), all employer substrate **empty**:

| Table | Rows |
|---|---|
| employer_jobs | 0 |
| employer_candidates | 0 |
| employer_competency_roles | 0 |
| employer_interviews | 0 |
| employer_offers | 0 |
| ep98_hiring_assessments | 0 |
| hiring_outcomes | 0 |
| candidate_pipeline / candidate_ranking | 0 / 0 |
| tig_calibration | 0 |

**Consequence:** the architecture is competency-driven and certifiable on **wiring**, but it cannot
be proven **operational on real data** until employers actually post jobs and assess candidates.
Calibration stays `uncalibrated` until ≥30 realized outcomes. No employer/candidate/outcome rows
were fabricated to force a green result.
