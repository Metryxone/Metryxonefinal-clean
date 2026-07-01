# CAPADEX 3.0 · Program 2 · Phase 2.5 — Background Job Monitoring Report

> Deliverable 07 · Generated 2026-07-01T04:31:00.104Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:04e6998b3d95, written 2026-07-01T04:31:00.104Z).
> Honesty: Coverage (evidence exists) ⟂ Confidence ⟂ Adoption (real volume) — NEVER composited. null ≠ 0. Built ≠ Operated ≠ Recoverable. Nothing fabricated.

### Background Jobs & Queue (`background_jobs`)
- **Certification axis**: `monitoring`
- **Coverage status**: **SUPPORTED** · structural coverage **100%**
- **Validated signals**: Execution Status · Retry Count · Failure Reason · Processing Time · Queue Monitoring · Dead Letter Queue
- **Reused substrate (verified vs live FS+DB, never invoked)**: svc 2/2 · routes 1/1 · fe 0/0 · tbl 0/0
- **Absent evidence (honest)**: —
- **Adoption (SEPARATE axis — real volume)**: table `ops_job_queue` absent, rows **—**
- **Honest note**: GAP-OPS-2 CLOSED: a durable job queue (ops_job_queue) with FOR UPDATE SKIP LOCKED claim, per-job attempt/retry/backoff, processing_ms timing, a Dead-Letter-Queue (ops_job_dead_letter) and a background worker are now present (flag-gated). Real job volume is a SEPARATE Adoption axis (honest-low/0 in dev, ops_* tables created lazily on first flag-ON write).

## Async reality (honest)
- Present: an in-process fire-and-forget event bus.
- Absent: a durable queue, a Dead-Letter-Queue, and per-job retry/failure/processing-time persistence (see gap GAP-OPS-2). Failed async work is not durably tracked.
