# CAPADEX 3.0 · Program 2 · Phase 2.5 — Metrics Coverage Matrix

> Deliverable 05 · Generated 2026-07-01T03:36:10.857Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:98db190526bf, written 2026-07-01T03:36:10.856Z).
> Honesty: Coverage (evidence exists) ⟂ Confidence ⟂ Adoption (real volume) — NEVER composited. null ≠ 0. Built ≠ Operated ≠ Recoverable. Nothing fabricated.

Certifies the **metrics** axis: structural coverage **100**.

### Metrics Coverage (`metrics_coverage`)
- **Certification axis**: `metrics`
- **Coverage status**: **SUPPORTED** · structural coverage **100%**
- **Validated signals**: API/DB Latency · Event-loop Lag · Memory/CPU · AI Runtime · KPI Rollup
- **Reused substrate (verified vs live FS+DB, never invoked)**: svc 2/2 · routes 0/0 · fe 0/0 · tbl 3/3
- **Absent evidence (honest)**: —
- **Adoption (SEPARATE axis — real volume)**: table `anl_kpi_daily` present, rows **10**
- **Honest note**: DB latency, event-loop lag, process/OS memory + CPU, AI-runtime rows and a KPI daily rollup are MEASURED. A metrics-export endpoint (Prometheus/statsd) + API-throughput/error-rate counters + cache-hit ratio are NOT present — honest NULL (DEFERRED), never estimated.

## Metric reality (Coverage ⟂ NULL for un-instrumented)
| Metric | Status |
|---|---|
| DB latency | MEASURED |
| Event-loop lag | MEASURED |
| Process/OS memory + CPU | MEASURED |
| AI runtime | MEASURED (ai_runtime_monitoring) |
| KPI daily rollup | MEASURED (anl_kpi_daily) |
| API throughput / error-rate | **NULL** (not instrumented — GAP-OPS-1) |
| Cache hit ratio | **NULL** (no cache metrics) |
| Metrics export (Prometheus/statsd) | **NULL** (absent — GAP-OPS-1) |

_NULL is honest "not measured", never estimated as 0._
