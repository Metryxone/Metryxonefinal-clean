# CAPADEX 3.0 · Program 2 · Phase 2.5 — Report Operations Report

> Deliverable 10 · Generated 2026-07-01T04:31:00.104Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:04e6998b3d95, written 2026-07-01T04:31:00.104Z).
> Honesty: Coverage (evidence exists) ⟂ Confidence ⟂ Adoption (real volume) — NEVER composited. null ≠ 0. Built ≠ Operated ≠ Recoverable. Nothing fabricated.

Certifies the **report_operations** axis: structural coverage **100**.

### Report Operations (`report_operations`)
- **Certification axis**: `report_operations`
- **Coverage status**: **SUPPORTED** · structural coverage **100%**
- **Validated signals**: Report Requested · Report Generated · Generation Time · PDF Export · Email Delivery · Sharing
- **Reused substrate (verified vs live FS+DB, never invoked)**: svc 1/1 · routes 1/1 · fe 0/0 · tbl 1/1
- **Absent evidence (honest)**: —
- **Adoption (SEPARATE axis — real volume)**: table `capadex_reports` present, rows **0**
- **Honest note**: Report generation + a report-pack builder + Zoho email delivery exist; report state is persisted in capadex_reports. Explicit generation-TIME + download-status telemetry is partial — honest Coverage, real volume as a SEPARATE Adoption axis.

_Generation + report-pack + Zoho email delivery exist; report state persists in `capadex_reports`. Explicit generation-time/download-status telemetry is partial (honest)._
