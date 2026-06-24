# MX-73X · Section 8 — Super-Admin Employer Governance

> Governance views for super-admins over the employer intelligence subsystem. Read-only,
> requireAuth + requireSuperAdmin, honest empty states (0 employer data today).

## Employer Intelligence Dashboard
- Org/employer inventory (`employer_master`, `employer_organizations`, `employer_jobs`,
  `employer_candidates`), feature-flag state (`employerCompetencyHiring`), engine version stamps.
- Honesty: surfaces live counts; with 0 rows it reports "dormant — no employer activity", not a fake metric.

## Hiring Intelligence Dashboard
- Aggregate hiring recommendations / actions distribution across candidates (when present).
- Calibration state platform-wide: realized outcomes vs the ≥30 floor; "uncalibrated" until met.

## Competency Hiring Dashboard
- Coverage distribution (`requirementCoveragePct`), withheld-band rate (coverage-thin), unassessed
  requirement hotspots — diagnostics for where competency assessment is missing.

## Benchmark Dashboard
- Role benchmark availability and k-anonymity suppression rate across roles; which cohorts are
  releasable (n≥30) vs suppressed. Never exposes sub-k cohort percentiles.

## Governance invariants
- All reads gated: global `app.use('/api/admin', requireAuth → requireSuperAdmin)` plus
  inline guards on any `/api/<framework>/admin/*` path (per `.agents/memory/superadmin-admin-gate-and-rie-drift.md`).
- Read-only: governance GETs never run DDL (to_regclass probe + degrade).
- Coverage ⟂ Confidence preserved; null never coerced to 0.
