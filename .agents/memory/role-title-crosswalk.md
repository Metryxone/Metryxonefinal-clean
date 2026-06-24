---
name: Role title → curated Role-DNA crosswalk (talent matching)
description: How free-text job titles bridge to onto_role_competency_profiles for candidate matching; the onto_* vs ont_* namespace trap and the honesty/seniority rules.
---

# Role title crosswalk for talent matching

The talent-matching engine ranks candidates against a curated role that exists in
`onto_role_competency_profiles` (curated TEXT ids like `role_be_eng`). Real
employers post jobs with a FREE-TEXT title, so a posted job cannot be matched
without first bridging title → curated role.

## The namespace trap (do not reuse the wrong crosswalk)
- `services/role-crosswalk.ts` resolves to `ont_roles` (O*NET, INT ids) — a
  DISJOINT namespace. The matching engine reads `onto_*`, so a title crosswalk
  for matching MUST resolve to `onto_roles.id`, NEVER `ont_roles`.
- The title→curated bridge lives in `services/role-title-crosswalk.ts`
  (`resolveCuratedRoleByTitle`, `getMatchableCuratedRoles`).

## Rules baked in (keep them)
- **Matchable roles only**: a role is a crosswalk target only if it carries an
  ACTIVE, weight-bearing competency profile (`HAVING COUNT(active)>0`). Resolving
  to an empty shell would produce a useless "match".
- **Abstain, never fabricate**: no defensible match → `resolved:null`. The engine
  then returns `resolved:false` with 0 candidates, not a guessed role.
- **Coverage ⟂ Confidence**: the crosswalk's `confidence_pct` is TITLE-resolution
  trust; `competency_count`/`weight_total` is the role's profile coverage. Carried
  as separate fields, never composited into one number.
- **Estimated flag**: anything but an exact title hit is `estimated:true`.
- **Seniority**: preserved for EXACT matching via a canonical (abbreviation-
  expanded) form — "Sr. Backend Engineer" canonicalises to "senior backend
  engineer" and hits the curated "Senior Backend Engineer" exactly. BUT "senior"
  is treated as a GENERIC (non-distinctive) token for the looser PARTIAL overlap,
  so a senior title with no exact senior role still partial-matches the base role.
- **Generic-token guard**: a partial match needs a shared DISTINCTIVE token
  (engineer/manager/etc. are generic). This is why "Product Manager" vs "Project
  Manager" correctly ABSTAINS instead of cross-matching on a shared "manager".

## Job substrate is SPLIT — read job_postings FIRST (the blocker code review caught)
- The CANONICAL job-posting flow is `POST /api/job-posting-engine/jobs`
  (`services/job-posting-engine.ts`) → writes **`job_postings`** (varchar id, text
  title). The older employer-portal `employer_jobs` is a SEPARATE store. A
  job-matcher that reads only `employer_jobs` 404s every normally-posted job.
- `readJobTitle` therefore probes `job_postings` FIRST, then falls back to
  `employer_jobs` (deterministic precedence: job_postings wins). It reports
  `job_source` so the caller knows which substrate matched. This mirrors the
  same SPLIT documented in `employer-ecosystem-activation.md`.
- Integration test: `tests/talent-matching-job-crosswalk.test.ts` creates a job
  via `createJob` then drives `rankCandidatesForJob` (resolve + abstain + not_found).
  It is real-DB and self-skips when no users / curated profiles exist.

## Wiring
- Engine fns: `rankCandidatesForRoleTitle(pool,title)` and
  `rankCandidatesForJob(pool,jobId)` (reads title from `job_postings`, then
  `employer_jobs`; both TEXT/varchar ids).
- Routes (flag `talentMatching`/`FF_TALENT_MATCHING`, super-admin gated, base
  `/api/talent-matching-engine`): `GET /resolve-role?title=`,
  `GET /by-title/candidates?title=`, `GET /job/:jobId/candidates`. Literal paths
  registered before param routes. Crosswalk happens LAZILY at match time —
  read-only, no writes, no schema change, additive.
- Note: these routes return 401 (not 503) when unauthenticated flag-off, same as
  the pre-existing talent-matching routes — a broader auth layer intercepts before
  the flag gate. 401-not-404 is the proof the routes registered.
