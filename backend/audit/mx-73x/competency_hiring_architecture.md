# MX-73X · Section 2 — Competency Hiring Architecture

> The competency-driven hiring pipeline already implemented, plus the MX-73X unified hiring
> score added on top. Additive, flag-gated (`employerCompetencyHiring`), read-only, never throws.

## Pipeline (compose, never recompute)

```
Job (employer_jobs)
  │  job.title
  ▼
Role DNA  ── generateRoleDNA(pool, title)            services/role-dna-expansion-engine.ts
  │  curated onto_* requirements over O*NET inheritance
  ▼
Required Competencies + Required Levels
  │  RoleDNARequirement[] { code, name, expectedLevel|targetProficiency, weight, importanceTier }
  │  targetScoreOf(req)  →  target 0..100
  ▼
Role Benchmarks  ── generateRoleBenchmark             ti_role_benchmarks (abstains if absent)
  │
  ▼
Assessment → Candidate competency profile
  │  resolveUnifiedCompetencyProfile(pool, candidate.email)   (UNION of both onto_* ledgers)
  ▼
Match  ── computeCompetencyDrivenMatch                services/employer-competency-hiring.ts
  │  competencyMatch (weighted attainment over ASSESSED reqs, 0..100)
  │  requirementCoveragePct  (Coverage axis, separate from match)
  │  gaps[] / unassessedRequirements[]  (real, never fabricated)
  │  candidateReadiness  (role-readiness-v2, context)
  │  fitSignal.band  (WITHHELD below MIN_COVERAGE_FOR_FIT=50%)
  │  calibration  (uncalibrated until ≥30 realized outcomes)
  ▼
Readiness  ── computeRoleReadinessV2                   services/role-readiness-v2.ts
  │
  ▼
Unified Hiring Score  ── deriveUnifiedHiringScore      services/employer-hiring-score.ts   ◀ NEW (MX-73X)
     composes: Competency + Employability Index + Readiness + Role-Match + Benchmark
     → hiringScore 0..100 (WITHHELD/null without a competency anchor)
  ▼
Decision support
     deriveInterviewRecommendation  (focus = measured gaps, probe = unassessed)
     deriveHiringRecommendation     (action only — NEVER a hire/no-hire verdict)
```

## Honesty invariants enforced in code
- **Competency is the required anchor.** No competency overlap → match `null` →
  `source='heuristic_fallback'`, hiring score **withheld** (never built from EI/readiness alone).
- **Coverage ⟂ Confidence.** `requirementCoveragePct` (assessed weight / total weight) is reported
  independently of `competencyMatch`; the headline fit band withholds when coverage < 50%.
- **k-anonymity.** Benchmark cohorts with size unknown or < 30 are suppressed (fail closed).
- **null never coerced to 0.** Absent components are re-normalized out of the unified score.
- **Language policy.** Outputs are developmental signals; an explicit non-verdict disclaimer ships
  on every hiring recommendation and on the unified hiring score.

## Flag-OFF contract
With `employerCompetencyHiring` OFF, every `/api/v2/employer/competency-match/*` route returns
`503` BEFORE any auth/DB/engine touch (verified). The legacy heuristic routes are unchanged →
flag-OFF is byte-identical legacy behaviour, including schema (no DDL on any path).
