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

## Enterprise report-pack composer

A single composer shapes many reports into ONE layout consumed by BOTH the exporters (pdf/html/json/csv) and the in-app HTML preview. Durable lessons:

- **NO-placeholder is a hard contract**, not just prose: the obvious `num(x) ?? '?'` idiom silently emits `~?w` / `?%` stubs into committed deliverables. Use honest formatters (omit the clause when the value is absent) AND enforce a `PLACEHOLDER_RE` guard inside the validator so any future `~?`/`?w`/`TBD`/`lorem`/` ?%` FAILS the no-empty guard before export.
- **Folded count fields**: candidate evaluation returns its score count as a folded `total_scores`, NOT `scores.length` — reading the raw array length makes a report say "0 panel scores" despite a successful enrichment. Read the folded total.
- Honest-empty is legit & expected: radar/heatmap need type-classified / per-competency PRECISE scores (domain-proxy candidates have none → honest), role/promotion readiness + skill_gap need role requirements / a 2nd EI snapshot. Never fabricate a 2nd snapshot to flip Promotion Readiness "ready". A best-effort EI enricher in the orchestrator must therefore cap at ONE genuine measured snapshot (only when `buildEiProfile().measurable` is true and none exists) and NEVER loop `while(<2) persistEiProfile()` — manufacturing a coincident duplicate to satisfy the ≥2 count fabricates a flat "trend"; tag captures `captured_by=TENANT_ID` + purge in rollback.
- **Structural-coverage ≠ measurement-coverage contradiction trap**: radar/heatmap set `coverage.pct = classification_coverage_pct` (a STRUCTURAL "how many comps are type-classified" number) AND fed it into `confidenceFromMeasurement(null, coveragePct)`, whose coveragePct branch emitted "Derived from X% measurement coverage". Result: a `measurable:false` report showed `coverage.pct:100` + "100% measurement coverage" + a contradictory honest_state ("no comps classified" vs "6/6 classified"). Fix: when `!measurable`, null BOTH `coverage.pct` AND `confidence` (band:null + "not applicable" note) and keep the structural count only in prose worded as structural ("classified by type (structural only); no measured means yet"); and reword the helper's coverage note to "type-classification coverage (structural; not measured scores)". Only radar+heatmap passed a non-null coveragePct — every other builder passed null, so the contradiction was localized.
- Coverage⟂Confidence⟂Activation kept as separate fields per report; subject email masked to `user_<sha>` in every committed artifact.

## Read-only validators of the assessment journey

- A validator must be **strictly read-only**: never auto-provision the demonstration candidate from inside a validation run (no `execSync` of a seed script). If the candidate is absent, fail fast with an explicit "run the provisioning script first" instruction and exit non-zero.
- **Don't fake a DB-lens check.** A stage with no dedicated table must NOT report `db.ok:true` from a constant or a scorer-derived value. Either back it on a real query of the underlying substrate (e.g. the competency ledgers) and say so in the detail, or mark it `n/a` (e.g. a `persist:false` scorer that writes nothing by design). A green ✓ with no query behind it is fabricated evidence.
- An authed-404 AFTER a route is confirmed gated unauth (401/403) is `served_empty` (wired, no data), NOT a broken API.
