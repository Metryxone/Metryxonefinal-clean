# 8 · Performance Readiness Report

**Honesty note:** there are some ad-hoc benchmark scripts in the repo (`backend/audit/performance/bench.mjs`,
`backend/audit/mx-302j/perf-harness.mjs`) but **no standardized, repeatable load-validation gate** and **no
production traffic**, so throughput, p95 latency, and concurrency behavior **cannot be measured today** — they
are reported as `null`, not as a passing score. What *can* be measured: build output sizes, structural
hot-spots, and boot behavior.

## Measured (structural)
| Signal | Value | Note |
|---|---|---|
| Frontend prod build | **PASSES**, 46.36s | `build` workflow |
| Largest JS chunks (minified) | `index` 1.62 MB (gz 425 KB), `CareerBuilderPage` 1.23 MB (gz 285 KB), `EmployerPortalPage` 1.16 MB (gz 304 KB), `vendor-pdf` 748 KB, `UnifiedParentDashboard` 462 KB | Vite warns >1.5 MB; no per-route splitting for heavy pages |
| Backend boot | clean; `db-prewarm warmed 4/4 connections in 79ms` | connection pool prewarm present |
| Background jobs | AI-governance scheduler every 5 min (+ workflows every 60s); 34 interval/immediate sites | confirm these scale / are idempotent under multiple instances |
| DB size | 1,441 tables, largest 1,792 rows | trivially small — **no data-volume performance signal exists yet** |

## Hot-spots / risks (structural, not measured under load)
1. **Front-end first-load weight** — three pages >1 MB each pre-gzip. At enterprise scale this hurts TTI on
   slower networks. Mitigation: route-level `dynamic import()` / `manualChunks` (Vite already suggests this).
2. **`routes.ts` single-process surface** — ~4,000 endpoints on one Node process; the backend runs on `tsx`
   (interpreted, not compiled) in both dev and prod per platform convention. Single JS thread ≈ one core
   ceiling (memory). Scale horizontally (Cloud Run instances) — confirm session store (Postgres-backed) and
   the 34 background jobs behave correctly across **multiple instances** (e.g. schedulers must not double-fire).
3. **Lazy `CREATE TABLE` on first write** — 178 files ensure-schema at runtime; first-touch latency + DDL
   under concurrency should be validated (advisory-lock pattern exists for some, per memory).
4. **AI calls are network-bound** — voice/employability/career AI latency is dominated by OpenAI round-trips;
   ensure timeouts + the existing 503/abstain paths are exercised under load.

## What must happen to make this axis measurable
- Promote the existing ad-hoc bench scripts into a standardized, repeatable load harness (Node `http` based)
  and run against a staging instance with seeded representative data.
- Capture p50/p95/p99 latency + error rate for the top journeys (assessment complete, report, employer match,
  login).
- Validate multi-instance background-job safety (single-fire scheduler).

## Performance verdict
- **Build/boot: READY.** App compiles and starts cleanly with pool prewarm.
- **Runtime performance: UNVALIDATED (null).** No load evidence exists; this is the single largest *unknown*
  for an enterprise launch and must be closed in a staging load test before GA.
- **Front-end weight: NEEDS WORK (medium).** Code-split the three >1 MB pages before high-traffic GA.
