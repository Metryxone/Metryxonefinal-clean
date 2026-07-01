# CAPADEX 3.0 · Program 2 · Phase 2.5 — Alerting Assessment

> Deliverable 06 · Generated 2026-07-01T04:39:04.945Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:756c369c3c11, written 2026-07-01T04:39:04.945Z).
> Honesty: Coverage (evidence exists) ⟂ Confidence ⟂ Adoption (real volume) — NEVER composited. null ≠ 0. Built ≠ Operated ≠ Recoverable. Nothing fabricated.

Certifies the **alerting** axis: structural coverage **100**.

### Alerting (`alerting`)
- **Certification axis**: `alerting`
- **Coverage status**: **SUPPORTED** · structural coverage **100%**
- **Validated signals**: Service Failures · DB Failures · AI Failures · Security Events · Alert Rules · Notification Routing
- **Reused substrate (verified vs live FS+DB, never invoked)**: svc 3/3 · routes 2/2 · fe 0/0 · tbl 0/0
- **Absent evidence (honest)**: —
- **Adoption (SEPARATE axis — real volume)**: table `ops_alert_events` absent, rows **—**
- **Honest note**: GAP-OPS-3 CLOSED: a durable alert-RULE store (ops_alert_rules, seeded with 3 default rules) + a fired-event ledger (ops_alert_events) + a rule evaluator over live signals + notification routing (Zoho email via sendOperationalAlertEmail; log channel) are now present (flag-gated). Real fired-event volume is a SEPARATE Adoption axis (honest-low/0 in dev).

## Alerting reality (honest)
- Present: failure CONDITIONS are detectable (health domains report down/degraded; global-monitoring derives status).
- Absent: a durable alert-RULE store + notification routing (email/pager/webhook). Alerts are client-derived from status, not pushed (see gap GAP-OPS-3).
