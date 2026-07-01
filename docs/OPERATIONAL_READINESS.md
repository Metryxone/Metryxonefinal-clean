# Operational Readiness (CAPADEX 3.0 · Program 2 · Phase 2.5)

**Observability, Monitoring & Operational Readiness** — a read-only, flag-gated composer that answers *"Can CAPADEX be operated, monitored, supported, and maintained as an enterprise production platform, based on repository evidence?"* It **composes the existing observability substrate** into ONE operational-readiness view and certifies **10 SEPARATE operational axes that are NEVER combined**. It is **not** a new monitoring system.

- **Flag**: `operationalReadiness` (env `FF_OPERATIONAL_READINESS`), default **OFF**. OFF is byte-identical **incl. schema**: every write path (snapshot capture, durable queue, alert store, AI token accounting) guards on the flag and lazily creates its `ops_*` / `operational_readiness_snapshots` table only on the first flag-**ON** write → OFF creates **0 tables**.
- **Additive / flag-gated / reuse-before-build.** The certified engines are read by existence / persisted output — **NEVER invoked**. The 7 previously-classified operational gaps (GAP-OPS-1..7) are now **CLOSED with real, working mechanisms** built additively behind this flag (see below); nothing is fabricated.

## The 10 axes (certified SEPARATELY — never combined)
`observability · monitoring · logging · metrics · alerting · ai_operations · assessment_operations · report_operations · disaster_recovery · operational_readiness`. Each is a structural-coverage score (0–100 or **NULL** when no measurable in-repo substrate — null ≠ 0). The overall verdict is a **SEPARATE** structural axis, not an average.

## Honesty invariants
- **Coverage ⟂ Confidence ⟂ Adoption** are separate and never composited. Structural coverage = evidence EXISTS; it is not a runtime/quality/adoption claim.
- **Built ≠ Operated ≠ Monitored ≠ Recoverable.** Enterprise operability confidence is **WITHHELD** (null) by design.
- `null ≠ 0`. A DB/FS read error → null (honest unavailable). Nothing fabricated. Disaster-recovery now has **in-repo substrate** (`config/disaster-recovery-manifest.ts` + `scripts/ops-dr-verify.ts` machine-checkable readiness + `docs/DISASTER_RECOVERY.md` runbook) → **SUPPORTED**; but live restore-drill **EXECUTION** and managed-DB backups remain **infra-owned** — the manifest declares targets/procedures + verifies connectivity/config presence, it never claims a restore was drilled.

## Files
- `backend/config/operational-readiness-model.ts` — canonical pure-data registry (10 axes · 12 domains · decisions · open gaps · resolved/reused mechanisms). NO engine, NO DDL.
- `backend/services/operational-readiness-engine.ts` — read-only composer: `composeCoverage` / `composeCertification` / `composeAdoption` / `composeGaps` / `composeValidation` / `composeSummary` + `captureOperationalSnapshot` / `getOperationalSnapshots`. GET-only, never-throws, null-on-error scalar/rows, `to_regclass` table probe, FS existence checks. Snapshot table `operational_readiness_snapshots` created ONLY on POST capture (flag-ON).
- **Gap-closure mechanisms (real, additive, flag-gated — all in `backend/services/ops/`):**
  - `metrics-registry.ts` — in-memory counters/gauges/histograms + `opsMetricsMiddleware` (mounted in `index.ts`) + Prometheus text render (GAP-OPS-1 metrics export; GAP-OPS-6 `/version` + `/metrics`).
  - `durable-queue.ts` — persistent job queue (`ops_job_queue`) + dead-letter (`ops_job_dead_letter`) + `startQueueWorker` polling + retry/backoff (GAP-OPS-2).
  - `alerting.ts` — alert-rule store (`ops_alert_rules`) + rule evaluation against live metric signals + event log (`ops_alert_events`) + email notification routing via `email.ts` (GAP-OPS-3).
  - `ai-token-accounting.ts` — per-call token + cost accounting (`ops_ai_token_usage`), hooked from `aiClient.ts` (GAP-OPS-4).
  - correlation-ID propagation (GAP-OPS-5): `routes.ts` upload proxy `on:{proxyReq}` injects `x-correlation-id`; `backend-main/app/main.py` `correlation_id_mw` reads/echoes it.
  - `config/disaster-recovery-manifest.ts` + `scripts/ops-dr-verify.ts` + `docs/DISASTER_RECOVERY.md` (GAP-OPS-7 DR substrate + machine-checkable readiness).
- `backend/routes/operational-readiness.ts` — BASE `/api/operational-readiness`: `/enabled` (ungated probe) + super-admin `/model /coverage /certification /adoption /gaps /validation /summary /snapshots` (GET) + POST `/audit/capture`; **gap-closure endpoints** `/version /metrics /metrics.json /queue/{stats,dead-letter,enqueue,run} /alerts/{rules,rules/:id/toggle,events,evaluate} /ai/token-usage /dr/{manifest,readiness}`. Flag-gate 503 **before** auth. `startQueueWorker(pool)` starts at registration (no-op when flag OFF).
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
`STRUCTURAL_COMPLETE_ADOPTION_PENDING` — **12 domains SUPPORTED · 0 DEAD_END · 0 open gaps of any severity** (all 10 axes structural-coverage 100). All 7 previously-classified operational gaps are **CLOSED with real working mechanisms** built additively behind `operationalReadiness`: GAP-OPS-1 metrics export, GAP-OPS-2 durable queue + DLQ, GAP-OPS-3 alert-rule store + notification routing, GAP-OPS-4 AI cost/token accounting, GAP-OPS-5 Node→FastAPI correlation-ID, GAP-OPS-6 `/version` + `/metrics`, GAP-OPS-7 DR manifest + readiness verifier. `OPERATIONAL_GAPS=[]`; 13 `RESOLVED_OPERATIONAL_GAPS`. **Engineering closure ⟂ Adoption ⟂ Confidence:** the mechanisms are code-complete, but real operational volume (jobs run, alerts fired, tokens spent) is honest-low/0 in dev, and an actual DR restore-drill + managed-DB backups remain infra-owned — Adoption and enterprise operability **confidence stay WITHHELD (null)**, reported SEPARATELY, never composited, never fabricated. STOP for human approval before merge/deploy (flag stays **OFF**).
