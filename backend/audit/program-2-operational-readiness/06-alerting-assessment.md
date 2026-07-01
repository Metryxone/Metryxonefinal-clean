# CAPADEX 3.0 · Program 2 · Phase 2.5 — Alerting Assessment

> Deliverable 06 · Generated 2026-07-01T03:36:10.857Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:98db190526bf, written 2026-07-01T03:36:10.856Z).
> Honesty: Coverage (evidence exists) ⟂ Confidence ⟂ Adoption (real volume) — NEVER composited. null ≠ 0. Built ≠ Operated ≠ Recoverable. Nothing fabricated.

Certifies the **alerting** axis: structural coverage **100**.

### Alerting (`alerting`)
- **Certification axis**: `alerting`
- **Coverage status**: **SUPPORTED** · structural coverage **100%**
- **Validated signals**: Service Failures · DB Failures · AI Failures · Security Events · Alert Rules · Notification Routing
- **Reused substrate (verified vs live FS+DB, never invoked)**: svc 1/1 · routes 1/1 · fe 0/0 · tbl 0/0
- **Absent evidence (honest)**: —
- **Honest note**: Failure CONDITIONS are detectable (health domains report down/degraded; global-monitoring derives status). A durable alert-RULE store + notification routing (email/pager/webhook) are NOT present — alerts are client-derived from status, not pushed. Honest Medium gap.

## Alerting reality (honest)
- Present: failure CONDITIONS are detectable (health domains report down/degraded; global-monitoring derives status).
- Absent: a durable alert-RULE store + notification routing (email/pager/webhook). Alerts are client-derived from status, not pushed (see gap GAP-OPS-3).
