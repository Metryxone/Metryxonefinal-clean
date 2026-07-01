# 07 — Report Generation Performance Report

**Scope (spec):** report rendering time, PDF generation, chart generation, data aggregation, memory
consumption, export performance.

> **Honesty boundary.** End-to-end report render is **auth/session-gated and requires seeded completed
> data**, so a single "report generation time" cannot be exercised unauthenticated. We measure the
> **backing data-aggregation query cost** (fully representative) and verify the **render architecture**
> in code. No E2E render number is fabricated.

## Data aggregation (measured — representative)

The queries behind report composition are the same fast reads measured in reports 02/05: concern lists,
question bank (`competency_question_templates`, 2,665 rows filters in ~0.26 ms), intelligence summaries,
group-by aggregations (`aig_monitoring_metrics` group-by ~6.8 ms). **All backing aggregation is
sub-10 ms.** Data aggregation is **not** the report bottleneck.

## Rendering architecture (repository evidence)

- **Composer:** `backend/services/report-pack.ts` (`buildPackSnapshot`) aggregates data from the
  competency/EI/progression engines into a snapshot before rendering.
- **PDF engine:** `backend/services/pdf-renderer.ts` (`renderReportToPDF`, `renderInvoiceToPDF`) using
  `pdfkit`; output written to `/tmp/rf_exports`.
- **Non-blocking render:** report generation/persistence is deferred with **`setImmediate`**
  (`backend/routes/report-factory.ts`, `backend/routes/capadex-enterprise.ts`) and persisted to
  `rf_generated_reports` — so the PDF render does **not** block the request thread. The user request
  returns promptly; the render completes asynchronously.
- **Chart generation:** charts are client-side (lazy `vendor-charts` chunk, 123 KB gzip, report 11) —
  no server-side headless-browser chart render, so no server chart-render latency.

## Memory consumption

PDF render buffers a document in the single Node process. At current report sizes RSS stayed within the
stable 434–471 MB band under general load (report 02); no report-render memory spike was observable in
the measured surface. **Under many concurrent large PDF renders** this is a shared-heap consideration
(report 13, Medium) — but the `setImmediate` deferral spreads the work off the request path.

## Export performance

Exports write to `/tmp/rf_exports` (fast local tmpfs/disk). Fire-and-forget via `setImmediate` keeps
export off the request latency path. No streaming/back-pressure issue observed at current scale.

## Certification

⚠️ **Report Performance — CONDITIONAL.** **CERTIFIED aspects:** backing aggregation < 10 ms (measured);
render is non-blocking (`setImmediate`), persisted, and client-side charting avoids server render cost —
architecturally sound. **NOT certified from this environment:** true E2E render/PDF wall-time and
concurrent-render memory behaviour (auth-gated). To certify: run authenticated report-render load with
the existing `[perf]` timing middleware (`PERF_TIMING_DISABLED=1` kill-switch) capturing real field
timings, and a concurrent-PDF memory test. (Certified independently.)
