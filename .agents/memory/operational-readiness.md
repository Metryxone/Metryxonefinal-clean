---
name: Operational Readiness (CAPADEX 3.0 Program 2 · Phase 2.5)
description: Read-only flag-gated composer certifying observability/monitoring/operational readiness over the EXISTING substrate; 10 SEPARATE axes, measure-before-enhance, byte-identical OFF.
---

# Operational Readiness (Phase 2.5)

Flag `operationalReadiness` / `FF_OPERATIONAL_READINESS`, default OFF. Read-only composer + pure-data registry that MEASURES operational coverage over the EXISTING observability substrate and certifies **10 SEPARATE operational axes that are NEVER combined** (observability·monitoring·logging·metrics·alerting·ai_operations·assessment_operations·report_operations·disaster_recovery·operational_readiness). Mirrors the CAPADEX 3.0 scan-lock scaffold (config → engine → routes → scan → generator).

**UPDATE — gaps are now BUILT (approved follow-up).** The original phase CLASSIFIED 7 operational gaps as measure-before-enhance / NOT built. A later APPROVED request closed **all 7 (GAP-OPS-1..7) with real working mechanisms**, additively, behind the SAME flag, keeping byte-identical-OFF **incl. schema**: `services/ops/metrics-registry.ts` (+`opsMetricsMiddleware` in index.ts + Prometheus → GAP-OPS-1/6), `services/ops/durable-queue.ts` (`ops_job_queue`+`ops_job_dead_letter`+worker → GAP-OPS-2), `services/ops/alerting.ts` (`ops_alert_rules`+`ops_alert_events`+email routing → GAP-OPS-3), `services/ops/ai-token-accounting.ts` (`ops_ai_token_usage`, hooked from aiClient.ts → GAP-OPS-4), correlation-ID (routes.ts upload-proxy `on:{proxyReq}` + main.py `correlation_id_mw` → GAP-OPS-5), DR (`config/disaster-recovery-manifest.ts`+`scripts/ops-dr-verify.ts`+`docs/DISASTER_RECOVERY.md` → GAP-OPS-7). Registry: `OPERATIONAL_GAPS=[]`, `RESOLVED_OPERATIONAL_GAPS` ×13, DR domain now SUPPORTED. Scan = 12 SUPPORTED·0 DEAD_END·0 gaps, all 10 axes coverage 100.

**Byte-identical-OFF with real write mechanisms:** EVERY new write fn (`enqueueJob`/`runQueueOnce`/`startQueueWorker`, alert create/toggle/eval, `recordAiTokenUsage`) MUST guard `isOperationalReadinessEnabled()` FIRST and only then call its own lazy `ensureSchema` → OFF creates 0 tables. Verified by DROP-ing the 5 `ops_*` tables after an in-process flag-ON runtime test so the live dev DB stays 0-table while the merged flag is OFF (tables re-create lazily on first flag-ON write in prod).

**adoptionTable vs reuses.tables trap:** the engine `verifyDomain` marks a domain PARTIAL if any `reuses.tables` entry is ABSENT and DEAD_END if a domain declares 0 refs. New `ops_*` tables don't exist while OFF → list them ONLY as the domain's `adoptionTable` (a SEPARATE adoption-axis field), NEVER in `reuses.tables`, or the coverage score drops to PARTIAL for a domain that is actually complete. DR reaching SUPPORTED needed 3 present refs (manifest + verify script + runbook), all FS-present.

**Runtime SQL is NOT exercised by the scan** — `composeCoverage` only checks file/table EXISTENCE, so a SQL bug in durable-queue/alerting/token-accounting passes the scan silently. Runtime-test the write paths in-process with `FF_OPERATIONAL_READINESS=1` (put the throwaway script INSIDE `backend/` — `/tmp` can't resolve `pg`), then drop the tables.

**Why:** the follow-up spec was an explicit BUILD (close the gaps with real mechanisms, never fabricate), superseding the original certification-only stance. Honest reporting still holds: Engineering closure ⟂ Adoption ⟂ Confidence, never composited; null ≠ 0; Built ≠ Operated ≠ Recoverable; operability_confidence + Adoption stay WITHHELD (real volume honest-0 in dev; DR restore-drill + managed backups infra-owned).

**How to apply / traps:**
- **Structural coverage = evidence file/table EXISTS** (verified vs live FS+DB by existence, engines NEVER invoked). It is NOT a quality/adoption claim. A domain scoring 100 can still have an OPEN gap (e.g. AI ops = files present, but no cost/token tracking → GAP). Report the gap on the gap axis, never depress the coverage score to fake it.
- **POST smoke returns 403 not 503 under OFF**: CSRF middleware (mounted first, mutating-methods only) fires before the flag gate. Accepted OFF response ∈ {401,403,503}; verify nothing executed (snapshot table stays `to_regclass` NULL). GET data routes DO return 503-before-auth.
- **public-config getter is a SEPARATE import site**: `routes/capadex.ts` must IMPORT `isOperationalReadinessEnabled` AND add key `operational_readiness`, or `/public-config` 500s (no tsc here).
- **Snapshot table `operational_readiness_snapshots` created ONLY on POST /audit/capture** (flag-ON, owns its lazy ensure-schema). Read paths never DDL. The gap-closure `ops_*` write tables follow the SAME rule → OFF = 0 tables.
- **DR is now SUPPORTED** (was DEAD_END): in-repo `config/disaster-recovery-manifest.ts` + `scripts/ops-dr-verify.ts` + `docs/DISASTER_RECOVERY.md` give machine-checkable readiness (connectivity + config-presence checks; env values NEVER logged). Live restore-drill EXECUTION + managed-DB backups remain infra-owned → declared/verified, never claimed drilled.
- Generator reads ONLY `scan.json` (sha256+mtime header, `dash()` null→—) so the 16 deliverables can't drift. Re-run the scan AFTER any registry/engine change or the evidence contradicts the docs.
- Verdict `STRUCTURAL_COMPLETE_ADOPTION_PENDING`; operability_confidence null/WITHHELD; **0 open gaps of any severity (`OPERATIONAL_GAPS=[]`), 12 SUPPORTED·0 DEAD_END, all 10 axes coverage 100** — 7 gaps CLOSED with real mechanisms, 13 RESOLVED. Adoption + confidence stay a SEPARATE null axis.

→ `docs/OPERATIONAL_READINESS.md` · deliverables `backend/audit/program-2-operational-readiness/`.
