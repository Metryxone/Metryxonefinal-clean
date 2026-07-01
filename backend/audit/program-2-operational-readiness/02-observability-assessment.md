# CAPADEX 3.0 · Program 2 · Phase 2.5 — Observability Assessment Report

> Deliverable 02 · Generated 2026-07-01T03:36:10.857Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:98db190526bf, written 2026-07-01T03:36:10.856Z).
> Honesty: Coverage (evidence exists) ⟂ Confidence ⟂ Adoption (real volume) — NEVER composited. null ≠ 0. Built ≠ Operated ≠ Recoverable. Nothing fabricated.

Certifies the **observability** axis: structural coverage **100**.

### Service & API Observability (`service_observability`)
- **Certification axis**: `observability`
- **Coverage status**: **SUPPORTED** · structural coverage **100%**
- **Validated signals**: Health Endpoint · Readiness Probe · Liveness Probe · Status Endpoint · Metrics Endpoint · Version Information
- **Reused substrate (verified vs live FS+DB, never invoked)**: svc 1/1 · routes 2/2 · fe 0/0 · tbl 1/1
- **Absent evidence (honest)**: —
- **Honest note**: Health (/api/health), readiness (/api/health/ready) + a 6-domain aggregator exist. A dedicated /metrics export endpoint and a /version endpoint are NOT present — honest gaps, not fabricated.

## Endpoint reality (honest)
- Present: `/api/health`, `/api/health/ready`, a 6-domain health aggregator, external-AI health probe.
- Absent: a `/version` build-info endpoint and a machine-readable `/metrics` endpoint (see gap GAP-OPS-6). No liveness (`/live`) probe distinct from readiness.
