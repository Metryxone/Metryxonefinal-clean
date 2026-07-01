# Operational Readiness (CAPADEX 3.0 · Program 2 · Phase 2.5)

**Observability, Monitoring & Operational Readiness** — a read-only, flag-gated composer that answers *"Can CAPADEX be operated, monitored, supported, and maintained as an enterprise production platform, based on repository evidence?"* It **composes the existing observability substrate** into ONE operational-readiness view and certifies **10 SEPARATE operational axes that are NEVER combined**. It is **not** a new monitoring system.

- **Flag**: `operationalReadiness` (env `FF_OPERATIONAL_READINESS`), default **OFF**. OFF is byte-identical incl. schema (zero DDL; the only write is an explicit POST snapshot capture, flag-ON).
- **Enhancement-only / measure-before-enhance / reuse-before-build / additive / no V2.** Engines are read by existence / persisted output — **NEVER invoked**.

## The 10 axes (certified SEPARATELY — never combined)
`observability · monitoring · logging · metrics · alerting · ai_operations · assessment_operations · report_operations · disaster_recovery · operational_readiness`. Each is a structural-coverage score (0–100 or **NULL** when no measurable in-repo substrate — null ≠ 0). The overall verdict is a **SEPARATE** structural axis, not an average.

## Honesty invariants
- **Coverage ⟂ Confidence ⟂ Adoption** are separate and never composited. Structural coverage = evidence EXISTS; it is not a runtime/quality/adoption claim.
- **Built ≠ Operated ≠ Monitored ≠ Recoverable.** Enterprise operability confidence is **WITHHELD** (null) by design.
- `null ≠ 0`. A DB/FS read error → null (honest unavailable). Nothing fabricated. Disaster-recovery has no in-repo substrate → honest **DEAD_END** (infra-owned), never claimed as validated.

## Files
- `backend/config/operational-readiness-model.ts` — canonical pure-data registry (10 axes · 12 domains · decisions · open gaps · resolved/reused mechanisms). NO engine, NO DDL.
- `backend/services/operational-readiness-engine.ts` — read-only composer: `composeCoverage` / `composeCertification` / `composeAdoption` / `composeGaps` / `composeValidation` / `composeSummary` + `captureOperationalSnapshot` / `getOperationalSnapshots`. GET-only, never-throws, null-on-error scalar/rows, `to_regclass` table probe, FS existence checks. Snapshot table `operational_readiness_snapshots` created ONLY on POST capture (flag-ON).
- `backend/routes/operational-readiness.ts` — BASE `/api/operational-readiness`: `/enabled` (ungated probe) + super-admin `/model /coverage /certification /adoption /gaps /validation /summary /snapshots` (GET) + POST `/audit/capture`. Flag-gate 503 **before** auth.
- `backend/scripts/program2-2.5-operational-readiness-scan.ts` — SSoT scan → `backend/audit/program-2-operational-readiness/scan.json`.
- `backend/scripts/program2-2.5-generate-deliverables.ts` — generator (reads ONLY `scan.json`; sha256+mtime header; `null → —`) → 16 deliverables.
- public-config: `routes/capadex.ts` `/api/capadex/public-config` key `operational_readiness`.

## Regenerate
```bash
cd backend
FF_OPERATIONAL_READINESS=1 npx tsx scripts/program2-2.5-operational-readiness-scan.ts   # → audit/program-2-operational-readiness/scan.json
npx tsx scripts/program2-2.5-generate-deliverables.ts                                   # → 16 deliverables (reads ONLY scan.json)
```

## Verdict
`STRUCTURAL_COMPLETE_ADOPTION_PENDING` — 0 Launch-Critical operational gaps; every certified axis composes existing substrate. Classified residual gaps (measure-before-enhance, **not** built here): metrics-export/APM (Medium), durable queue + DLQ (Medium), alert-rule store + notification routing (Medium), AI cost/token accounting (Medium), correlation-ID propagation + tracing (Low), `/version` + `/metrics` endpoints (Low), DR restore drills / RTO / RPO (Future, infra-owned). Enterprise operability **confidence WITHHELD**. STOP for human approval before merge/deploy.
