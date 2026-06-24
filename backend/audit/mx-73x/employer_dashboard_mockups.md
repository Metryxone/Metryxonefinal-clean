# MX-73X · Section 7 — Employer Dashboard (UI surfaces)

> Surface map for the employer-facing dashboards that consume the competency-driven intelligence.
> The data contracts already exist; this documents what each view renders and from which field.
> (Mockup-level spec — no live employer data exists yet, so views render honest empty/abstain states.)

## Job Dashboard
- Source: `employer_jobs` (`routes/recruiter-postings.ts`, `routes/employer-portal.ts`).
- Renders: open roles, resolved Role DNA (`roleDna.resolved`, `band`, `requirementSource`),
  required competencies + target levels. Empty state: "No jobs posted yet."

## Candidate Dashboard
- Source: `employer_candidates` + per-candidate match
  (`GET /api/v2/employer/competency-match/:candidateId/:jobId`).
- Renders: pipeline stage, **Match %**, **Coverage %**, **Readiness %**, Employability Index,
  fit band (or "WITHHELD — coverage thin"). Abstains shown explicitly, never zero-filled.

## Competency Dashboard
- Source: `match.requirements` / `gaps` / `unassessedRequirements`.
- Renders: requirement-by-requirement target vs measured, gap bands, unassessed (coverage gaps).

## Hiring Dashboard
- Source: `intelligence.hiringScore` (**NEW**) + `hiringRecommendation`.
- Renders: **Unified Hiring Score 0–100** with per-component contribution breakdown
  (Competency / Employability / Readiness / Role-Match / Benchmark), band, provisional &
  calibration badges, and the non-verdict disclaimer. Withheld state shows the reason.

## Benchmark Dashboard
- Source: `intelligence.benchmark` (k-anonymity enforced).
- Renders: released percentiles when cohort n≥30; otherwise an explicit suppression notice
  ("cohort too small / unknown — suppressed for k-anonymity"). Never shows a fabricated percentile.

## Cross-cutting UI honesty
- Coverage and Confidence shown as **separate** chips.
- `null`/abstain rendered as "not measurable", never "0".
- Every hiring surface carries the developmental, non-verdict disclaimer.
