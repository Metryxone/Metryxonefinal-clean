---
name: Employer Competency Intelligence (MX-100X Phase 5)
description: How the employer hiring flow was made competency-driven by composing existing engines behind the employerCompetencyHiring flag — honesty contract, no-verdict rule, and the dormant-data ceiling.
---

# Employer Competency Intelligence (MX-100X Phase 5)

Made employer hiring **competency-driven** by composing the EXISTING engines into ONE read-only
flow — no rebuild. Chain: Role → Role DNA → Requirements → Competency Profile → Match → Gap →
Readiness → **Interview Recommendation → Hiring Recommendation + Role DNA Benchmark**.

## What already existed (don't rebuild)
- `services/employer-competency-hiring.ts` `computeCompetencyDrivenMatch` already composes Phase-1
  `generateRoleDNA` + Phase-2 `resolveUnifiedCompetencyProfile` + `computeRoleReadinessV2` and returns
  match / coverage / gaps / unassessed / readiness / calibration / fitSignal (band WITHHELD when
  coverage < 50%; `validated:false` until ≥30 outcomes). Mounted at
  `/api/v2/employer/competency-match/:candidateId/:jobId` under flag `employerCompetencyHiring`.
- The Role DNA benchmark already comes back inside `generateRoleDNA().benchmark` (`RoleBenchmark` from
  `ti_role_benchmarks`, abstain-by-default) but the match's `roleDna` block DROPPED it.

## What Phase 5 added (additive only)
- Surfaced `roleDna.benchmark` (`RoleBenchmark`) on the match output via the SAME single DNA call —
  so both `/match` and the new flow read ONE DNA computation (no second call).
- New pure engine `services/employer-competency-intelligence.ts` (`v98x-phase5-…`) composing the match
  (never recomputes it) and deriving, in DEVELOPMENTAL language:
  - `deriveInterviewRecommendation` — focus areas from MEASURED gaps + probe list from UNASSESSED
    requirements; structure keyed to coverage/fit.
  - `deriveHiringRecommendation` — a decision-SUPPORT ACTION
    (`advance_to_interview` / `targeted_interview` / `gather_more_evidence` / `development_focus` /
    `insufficient_coverage`) from `fitSignal.band` + coverage sufficiency + calibration. **NEVER** a
    hire/no-hire suitability verdict; always carries a non-verdict disclaimer.
  - `deriveEmployerBenchmark` — surfaces the Role DNA benchmark with `BENCHMARK_K_MIN=30`; **fails
    closed** (abstains) on an unknown cohort or n<30.
- New read-only route `GET /api/v2/employer/competency-match/:candidateId/:jobId/intelligence`
  (3-segment literal, registered BEFORE the 2-segment `:candidateId/:jobId` param route → no
  collision), same gating chain: foundation → flag → auth → org-IDOR-404.

## Honesty contract (non-negotiable here)
- Outputs are DEVELOPMENTAL competency signals ONLY — never a hiring / suitability / pass-fail verdict.
  `LANGUAGE_POLICY` ships allowed/disallowed term lists; the language scanner must EXCLUDE the
  `disclaimer` field (it legitimately names the disallowed terms to disclaim them — scanning it is a
  false positive).
- Coverage and Confidence are SEPARATE axes; unmeasured → `null`/abstain, never coerced to 0.
- Sanitize raw DB error text out of API-visible notes (generic `match_failed` / `intelligence_failed`).
- Flag OFF = byte-identical, incl. SCHEMA: zero DDL, to_regclass-probe only, GET never writes.

## Dormant-data ceiling (honest, do not pad)
Live employer data = 0 rows (`employer_candidates` / `employer_jobs`). So in dev/prod today: match runs
the heuristic fallback, fit band is WITHHELD, calibration is uncalibrated, benchmark abstains. This is a
DATA-MATURITY ceiling — report it; never fabricate rows to make the flow "light up".

## Verification surfaces
- Evidence: `backend/scripts/employer-competency-intelligence-evidence.ts` → audit md (runs the engine
  directly, regardless of the workflow flag state).
- Smoke: `backend/scripts/smoke-employer-competency-intelligence.ts` — keep the workflow flag OFF so the
  flag-OFF HTTP 503 contract holds; service-level no-verdict / k-anonymity / abstain guards run directly.
- Cert: `backend/audit/99x-certification/employer_intelligence_certification_report.md` (Phase-5 section).
- Legacy heuristic path `routes/employer-hiring-intelligence.ts` (STRONG_HIRE/NO_HIRE) is UNTOUCHED by design.

## MX-73X — Unified Hiring Score (the real gap closed)
- The Phase-5 engine produced a competency-ONLY match; the Employability Index
  (`employer_candidates.ei_score`) was STORED but never folded into hiring. The one real gap was
  a single 0–100 score composing all five inputs. Closed by `services/employer-hiring-score.ts`
  `deriveUnifiedHiringScore(match,{eiScore})` + an additive `hiringScore` field on
  `EmployerCompetencyIntelligence`.
- **Why:** "competency-driven hiring" requires competency to be the REQUIRED anchor — when
  `competencyMatch` is null the score is WITHHELD (null), never fabricated from EI/readiness alone.
- **How to apply:** weights (comp .35 / EI .25 / readiness .20 / roleMatch .10 / benchmark .10) are
  RE-NORMALIZED over PRESENT components only — an absent input is dropped, never counted as 0
  (the smoke proves `EI absent ≠ EI 0`). Benchmark abstains under k-anonymity. provisional/
  validated/calibration are INHERITED from the match (developmental signal, not a verdict).
- **Honesty ceiling:** all employer tables are 0 rows → architecture certifiable, OPERATION not
  proven on real data; calibration stays uncalibrated until ≥30 realized outcomes. Legacy heuristic
  hiring engines remain as GATED, untouched fallbacks (criterion "no parallel logic" met by gating,
  not deletion → cert criterion 6 honestly PARTIAL).
