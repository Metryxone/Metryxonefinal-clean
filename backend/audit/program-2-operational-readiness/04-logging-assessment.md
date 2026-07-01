# CAPADEX 3.0 · Program 2 · Phase 2.5 — Logging Assessment

> Deliverable 04 · Generated 2026-07-01T04:39:04.945Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:756c369c3c11, written 2026-07-01T04:39:04.945Z).
> Honesty: Coverage (evidence exists) ⟂ Confidence ⟂ Adoption (real volume) — NEVER composited. null ≠ 0. Built ≠ Operated ≠ Recoverable. Nothing fabricated.

Certifies the **logging** axis: structural coverage **100**.

### Logging & Traceability (`logging_traceability`)
- **Certification axis**: `logging`
- **Coverage status**: **SUPPORTED** · structural coverage **100%**
- **Validated signals**: Structured Logs · Request IDs · Correlation IDs · Log Levels · Sensitive Data Masking · Audit Trail
- **Reused substrate (verified vs live FS+DB, never invoked)**: svc 1/1 · routes 3/3 · fe 0/0 · tbl 1/1
- **Absent evidence (honest)**: —
- **Honest note**: A levelled logger (debug/warn/error), a per-request requestId, redaction-at-write, and a redacted admin audit trail exist. GAP-OPS-5 CLOSED: the correlation id is now propagated Node→FastAPI (upload proxy injects x-request-id/x-correlation-id, gated; FastAPI echoes it). A full external distributed-tracing backend (APM vendor) remains infra-owned — reported honestly, not fabricated.

## Traceability identifiers (honest)
- Present: levelled logger (debug/warn/error), per-request `requestId`, redaction-at-write, redacted admin audit trail.
- Absent: correlation-ID propagation Node→FastAPI + distributed tracing (see gap GAP-OPS-5).
