# MX-73X · Section 10 — Employer Intelligence Certification

> Honest certification of the competency-driven employer hiring platform after MX-73X activation.
> Two axes reported separately: **Architecture** (is the wiring competency-driven and sound) and
> **Operational** (is it proven on real data). No employer/candidate/outcome rows were fabricated.

## Verdict: **CONDITIONAL PASS** — architecture PASS, operational PENDING (0 employer data)

The employer flow is competency-driven end-to-end and all five hiring inputs now feed a single
unified hiring score. It cannot be certified *operationally* until employers post jobs and assess
candidates (live substrate is empty). This is an honest ceiling, not a build defect.

## Criteria

| # | Success criterion | Result | Evidence |
|---|---|---|---|
| 1 | Candidate competency assessment directly influences hiring | ✅ PASS (arch) | `competencyMatch` is the required anchor of `hiringScore`; null → withheld |
| 2 | Role DNA directly influences hiring | ✅ PASS (arch) | `generateRoleDNA` → requirements/levels/benchmark feed match + `roleMatch` component |
| 3 | Readiness directly influences hiring | ✅ PASS (arch) | `candidateReadiness.readinessScore` is a weighted `hiringScore` component (was context-only) |
| 4 | Employability Index directly influences hiring | ✅ PASS (arch) | **NEW** — `candidate.ei_score` is a 0.25-weight component of `hiringScore` (was unused) |
| 5 | No parallel hiring logic active | ◑ PASS via gating | Competency engine is the sole active intelligence; legacy heuristic/`hiring_probability` remain as **gated, untouched fallbacks** (not deleted) |
| 6 | No duplicate intelligence engines | ◑ PARTIAL | One competency engine; legacy heuristic kept as fallback by design. Honest: duplication exists but is gated/inert when the competency flag is on |
| 7 | Backward compatible | ✅ PASS | Flag-OFF → every v2 route 503s before any work (verified); legacy routes unchanged; additive `hiringScore` field only; zero DDL on any path |
| 8 | Enterprise ready | ◑ PARTIAL | k-anonymity (k≥30), IDOR org-scope, language policy, calibration gate all enforced; operational readiness pending real data + ≥30 realized outcomes |
| — | Benchmark driven | ✅ PASS (arch) | Role-DNA benchmark surfaced, k-anon suppressed by default |
| — | Assessment driven | ✅ PASS (arch) | Match keyed off the candidate competency profile (assessment output) |

## What MX-73X changed (additive, flag-gated, reversible)
- **NEW** `services/employer-hiring-score.ts` — unified hiring score composing Competency +
  Employability Index + Readiness + Role-Match + Benchmark (null-safe, withheld without anchor).
- Additive `hiringScore` field on `EmployerCompetencyIntelligence` (consumed by the v2 route).
- **NEW** `scripts/smoke-employer-hiring-score.ts` — 16/16 honesty + math checks.
- Documentation deliverables (Sections 1–10) in `backend/audit/mx-73x/`.
- No engine rebuilt, no Role DNA / O*NET / Employability Index replaced, no schema change.

## Honest residuals (do not certify away)
1. **0 employer jobs / candidates / hires / outcomes** — operational certification cannot be earned
   until employers use the system. Calibration stays `uncalibrated` (< 30 realized outcomes).
2. **Legacy hiring engines still present** as gated fallbacks — criterion 5 met by gating, criterion
   6 is honestly PARTIAL (duplication exists but is inert when competency flag is on).
3. **Benchmark component abstains** until role cohorts reach k≥30.
4. **Backend is not typechecked in prod** (runs on tsx); a pre-existing tsc strictness error in
   `scripts/employer-competency-intelligence-evidence.ts` is unrelated to this change.

## Re-test
```
cd backend && npx tsx scripts/smoke-employer-hiring-score.ts     # 20/20
curl -s -o /dev/null -w '%{http_code}' \
  http://localhost:8080/api/v2/employer/competency-match/_meta/versions   # 503 (flag OFF)
```

## Flag enablement is an owner decision
`employerCompetencyHiring` (env `FF_EMPLOYER_COMPETENCY_HIRING`) remains default **OFF**. Enabling it
for the deployed app, and seeding/operating real employer data, are owner config decisions — out of
scope for this additive activation, which stops before deploy per project policy.
