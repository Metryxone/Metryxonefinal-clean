---
name: Operational Readiness (CAPADEX 3.0 Program 2 · Phase 2.5)
description: Read-only flag-gated composer certifying observability/monitoring/operational readiness over the EXISTING substrate; 10 SEPARATE axes, measure-before-enhance, byte-identical OFF.
---

# Operational Readiness (Phase 2.5)

Flag `operationalReadiness` / `FF_OPERATIONAL_READINESS`, default OFF. Read-only composer + pure-data registry that MEASURES operational coverage over the EXISTING observability substrate and certifies **10 SEPARATE operational axes that are NEVER combined** (observability·monitoring·logging·metrics·alerting·ai_operations·assessment_operations·report_operations·disaster_recovery·operational_readiness). Mirrors the CAPADEX 3.0 scan-lock scaffold (config → engine → routes → scan → generator).

**Rule: measure-before-enhance / reuse-before-build.** Deeper operational enhancements (metrics-export/APM, durable queue + DLQ, alert-rule store + notification routing, AI cost/token accounting, correlation-ID Node→FastAPI + tracing, `/version` + `/metrics`, DR restore drills) are recorded as CLASSIFIED gaps, **NOT built** — building them would break byte-identical-OFF and touch business/infra. The phase COMPOSES; it does not add a new/duplicate monitoring system.

**Why:** the spec is a certification of operational readiness, not a build task. Honest dual-axis reporting (Coverage ⟂ Confidence ⟂ Adoption, never composited; null ≠ 0; Built ≠ Operated ≠ Recoverable) is the deliverable.

**How to apply / traps:**
- **Structural coverage = evidence file/table EXISTS** (verified vs live FS+DB by existence, engines NEVER invoked). It is NOT a quality/adoption claim. A domain scoring 100 can still have an OPEN gap (e.g. AI ops = files present, but no cost/token tracking → GAP). Report the gap on the gap axis, never depress the coverage score to fake it.
- **Disaster recovery has NO in-repo substrate** → honest DEAD_END + NULL score (infra-owned managed-DB backups). Never fabricate as "validated". `null ≠ 0`.
- **POST smoke returns 403 not 503 under OFF**: CSRF middleware (mounted first, mutating-methods only) fires before the flag gate. Accepted OFF response ∈ {401,403,503}; verify nothing executed (snapshot table stays `to_regclass` NULL). GET data routes DO return 503-before-auth.
- **public-config getter is a SEPARATE import site**: `routes/capadex.ts` must IMPORT `isOperationalReadinessEnabled` AND add key `operational_readiness`, or `/public-config` 500s (no tsc here).
- **Snapshot table `operational_readiness_snapshots` is created ONLY on POST /audit/capture** (flag-ON, owns its lazy ensure-schema). Read paths never DDL → OFF = 0 tables.
- Generator reads ONLY `scan.json` (sha256+mtime header, `dash()` null→—) so the 16 deliverables can't drift from the measurement. Re-run the scan AFTER any registry/engine change or the evidence contradicts the docs.
- Verdict `STRUCTURAL_COMPLETE_ADOPTION_PENDING`; operability_confidence null/WITHHELD; 0 Launch-Critical; 4 Medium/2 Low/1 Future classified gaps.

→ `docs/OPERATIONAL_READINESS.md` · deliverables `backend/audit/program-2-operational-readiness/`.
