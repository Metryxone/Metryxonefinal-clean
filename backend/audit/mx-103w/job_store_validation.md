# MX-103W — Job Store Validation (Phase 1)

Validated by `backend/scripts/mx103w-smoke.ts`, run with both flags ON against the
live DB (seeds a demo posting + acting user, purges everything in `finally`).

```
FF_EMPLOYER_JOB_STORE_SYNC=1 FF_ROLE_AUTO_RESOLUTION=1 npx tsx scripts/mx103w-smoke.ts
```

## Results — all PASS
| Check | Result | Evidence |
|---|---|---|
| OFF → 503 (byte-identical legacy) | PASS | resolve/coverage/overview all 503 when flags OFF |
| Project: ok + action=project | PASS | action=project |
| 1:1 link (employer_jobs.id == posting id) | PASS | employer_job_id == posting id |
| Link present (source_posting_id set, status active) | PASS | rows=1 status=active |
| Idempotent re-run → reproject, exactly 1 row | PASS | action=reproject rows=1 |
| Audit-logged (project + reproject events) | PASS | events=project,reproject |
| Reversible (unproject → inactive, row preserved) | PASS | status=inactive (no delete) |
| Health: projection_active + projected_jobs ≥ 1 | PASS | active=true projected=1 |

## Schema-divergence regression (the bug the smoke caught)
First projection draft INSERTed `work_mode`/`experience`/`salary` →
`column "work_mode" of relation "employer_jobs" does not exist` (500). Fixed by
mapping only to columns present on the live canonical table; `work_mode` is folded
into `description`. Re-run after fix: **ALL PASS**.

## Live read-only snapshot (production substrate, flags ON, no writes)
| Metric | Value | Reading |
|---|---|---|
| job_postings total / published | 0 / 0 | no real postings authored yet |
| employer_jobs total / active | 1 / 0 | pre-existing funnel row |
| projection substrate present / active | true / true | spine can run |
| projected_jobs | 0 | **adoption** 0 — honest (0 published to project) |
| audit_events | 0 | no production projection has fired yet |

**Readiness ≠ Adoption:** the spine is structurally ready (it projects correctly in
the smoke), but adoption is honestly 0 because no real posting has been published
yet. We do not inflate adoption to make readiness look better.
