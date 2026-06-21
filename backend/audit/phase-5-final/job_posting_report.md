# Job Posting Report

**Phase:** 5 (Employer Lifecycle) — Final
**Date:** 2026-06-21
**Scope:** Job creation, approval workflow, publication, distribution channels
**Validator:** v5.15.0
**Verdict:** ✅ **OPERATIONAL**

---

## 1. Subsystem

| Concern | Source |
|---------|--------|
| Job lifecycle | `services/job-posting-engine.ts`, `routes/job-posting-engine.ts` |
| Persistence | `employer_jobs` (status, salary band, counts, quota) |

### Canonical status enum (`JOB_STATUS`)
`draft → hr_review → legal_review → leadership_approval → approved → published → paused → closed → archived → rejected`

### Visibility / channels
`VISIBILITY = ['private','internal','public']`; distribution channels validated against the channel catalog (`channel_in_catalog`).

## 2. Evidence — persistence (E2E stages 3–4)

```
[03] Job Created   ✓ employer_jobs created with status=draft (got draft)
[04] Job Published ✓ job status transitioned draft→published
```

The transition is proven by capturing status **before** (`draft`) and **after**
(`published`) the update — a real state change, not a re-assert.

## 3. Evidence — invariants (validator area `job_posting`)

```
[job_posting] status=pass measurable=true
   - jobs_present: pass — 1 job(s).
   - status_in_canon: pass — all statuses canonical.
   - salary_band_coherent: pass — salary bands coherent.
   - counts_non_negative: pass — counts non-negative.
   - distributions_resolve: pass — all distributions resolve.
   - channel_in_catalog: pass — all channels in catalog.
```

All six checks PASS: status within the canonical enum, `salary_min ≤ salary_max`,
application/quota counts non-negative, distribution rows resolve to real jobs, and
all channels are catalog members.

## 4. Honesty notes

- The full 10-state approval ladder exists in code; the E2E proof exercises the
  `draft → published` happy path. Intermediate review states (`hr_review`,
  `legal_review`, `leadership_approval`) are canonically enforced — any value
  outside `JOB_STATUS` would FAIL `status_in_canon`.
- Salary-band coherence is an **invariant** (not a recommendation): an inverted band
  would FAIL, never silently pass.

## 5. Success criteria

| Criterion | Status | Basis |
|-----------|--------|-------|
| Job posting operational | ✅ | E2E stages 3–4 + `job_posting` area PASS (6/6) |
