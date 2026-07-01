# Disaster Recovery (DR) Runbook — MetryxOne / CAPADEX 3.0

> Part of **Program 2 · Phase 2.5 Operational Readiness** (flag `operationalReadiness` /
> `FF_OPERATIONAL_READINESS`). This runbook + the in-repo manifest
> (`backend/config/disaster-recovery-manifest.ts`) + the readiness harness
> (`backend/scripts/ops-dr-verify.ts`) together form the DR substrate that closes
> `GAP-OPS-7` (previously a `disaster_recovery` DEAD_END).

## Honesty contract
This runbook **declares** targets and procedures and provides a **machine-checkable
readiness** verification. It does **not** claim that a live restore drill has been executed
against infrastructure. Restore-drill EXECUTION is a separate operational/adoption activity,
tracked and reported on its own axis. **Coverage ⟂ Confidence ⟂ Adoption are never
composited; `null ≠ 0`.**

## Data stores in scope
| Store | Engine | Conn env | Backups (owner) | RTO target | RPO target |
|-------|--------|----------|-----------------|------------|------------|
| Primary application data | PostgreSQL | `DATABASE_URL` | Provider automated (e.g. Cloud SQL automated + PITR) | ≤ 1 hour | ≤ 5 min (PITR) / ≤ 24 h (daily snapshot) |
| Bulk-upload / documents | MongoDB | `MONGODB_URI` | Provider automated (e.g. Atlas continuous) | ≤ 2 hours | ≤ 1 hour |

Managed-database backups are **infra-owned** (the cloud provider). This repo does not run
its own backup cron; the DR posture is: provider automated backups + documented restore
procedure + repeatable readiness verification.

## PostgreSQL restore procedure
1. Identify the target recovery point (timestamp or snapshot id).
2. Provision a restore instance from the provider snapshot / PITR.
3. Repoint `DATABASE_URL` (Secret Manager) to the restored instance.
4. Boot the Node API — the boot-time env preflight + lazy `ensure-schema` run; verify
   `/api/health/ready`.
5. Run `cd backend && npx tsx scripts/ops-dr-verify.ts` to confirm connectivity + core
   tables present.

## MongoDB restore procedure
1. Select the backup snapshot / point-in-time in the provider console.
2. Restore to a new cluster (or in-place) per the provider runbook.
3. Repoint `MONGODB_URI` (Secret Manager) for the FastAPI upload service.
4. Verify FastAPI `/health` and a sample read.

## Readiness verification
```bash
cd backend && npx tsx scripts/ops-dr-verify.ts
```
Writes `backend/audit/program-2-operational-readiness/dr-readiness.json` with:
- per-check status (config presence, DB connectivity, core-table presence, manifest present),
- `readiness_pct`,
- `restore_drill_executed: false` (honest — readiness verified, live drill is separate).

Also exposed at runtime (super-admin, flag-ON) via
`GET /api/operational-readiness/dr/manifest` and `GET /api/operational-readiness/dr/readiness`.

## Recommended cadence (adoption — not code)
- Quarterly restore drill in a non-prod project; record the actual measured RTO/RPO.
- Update the manifest `rto_target` / `rpo_target` only from **measured** drill results.
