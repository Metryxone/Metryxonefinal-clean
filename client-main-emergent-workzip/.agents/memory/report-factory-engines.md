---
name: Report Factory execution engines
description: PDF renderer, benchmark live-query engine, and visualization data resolver — the 3 execution gaps filled in the Report Factory.
---

## What exists

Three service files added to `backend/services/`:

### pdf-renderer.ts
- `renderReportToPDF(report, whitelabelConfig?)` — uses **pdfkit** (already installed), writes to `/tmp/rf_exports/rf_<uuid>.pdf`; renders narrative text, insight bullets (severity colours), benchmark rows, inline bar-chart data tables, branded header/footer
- `renderReportToCSV()` / `renderReportToJSON()` — write to same `/tmp/rf_exports/` dir
- Export route fires rendering via `setImmediate()` (fire-and-forget), sets `rf_export_jobs.status='done'` and `output_url=<filePath>` on completion
- Download: `GET /api/rf/exports/:jobUuid/download` streams the file; returns 202 while processing, 500 if failed

### benchmark-engine.ts
- `computeBenchmark(pool, configKey, userContext)` → `BenchmarkResult[]`
- **13 metric resolvers**: `capadex_score`, `readiness_score`, `motivation`, `confidence`, `risk`, `engagement`, `adaptability`, `competency_score`, `gap_score`, `strength_score`, `completeness_score`, `verified_count`, `intervention_readiness`, `concern_count`, `behaviour_score`
- **k-anonymity**: suppressed when `cohort_size < min_cohort_size` (default 30) — zero data = honest suppression, never fabricated
- Cohort filtering: `same_age_band` / `same_stage_code` via `cohort_definition` JSONB
- New endpoint: `POST /api/rf/benchmarks/:id/compute` (accepts user context in body)

### viz-data-resolver.ts
- `resolveVizData(pool, { configKey, userId?, sessionId?, reportDataSnapshot? })` → `ResolvedChartData`
- Dispatches on `data_source`: `capadex` (sessions aggregate/per-session), `career`/`employability` (cp_readiness_scores), `competency` (cp_competencies), `passport` (all cp_* table counts), `any` (capadex + readiness merged), `custom` (from snapshot)
- New endpoint: `GET /api/rf/visualizations/:id/data?user_id=&session_id=`

## generateReport() wiring
Chart sections call `resolveVizData()` → `resolved_data` in generated content.
Benchmark sections call `computeBenchmarkForReport()` → `benchmark_results` in generated content.
Both wrapped in `.catch(() => null/[])` — never throws.

## Frontend
`ReportFactoryPanel.tsx` VisualizationsTab: added Eye/Hide toggle per card, `RFChartPreview` component handles bar/line/radar/donut/gauge/scatter/heatmap via Recharts (already installed).

## Key honesty rules
- Zero rows in dev instance is CORRECT (no completed sessions, no passport data)
- k-anonymity suppression is the right behaviour at k<30
- Benchmark `behaviour_score` queries `wcl0_user_intelligence.behaviour_dims_present > 0` (7 rows in dev)
- PDF files stored in `/tmp/rf_exports/` — ephemeral per-restart, not persisted across deploys
