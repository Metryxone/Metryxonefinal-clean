# MetryxOne — Performance Benchmarks (PART 6)

**Generated:** 2026-06-26 · **Scope:** live development environment (backend on `tsx`, shared Postgres) · **Method:** custom read-only Node HTTP harness + server-side `EXPLAIN ANALYZE` + `/proc` CPU/RSS sampling.

> **Honesty notes (read first).** These are real measurements, not estimates, but they carry environment caveats:
> - **Backend numbers are representative of production.** Production runs the same `tsx` runtime as dev, so backend API + DB latency here ≈ prod.
> - **Frontend numbers are NOT from a running prod server.** The dev server (Vite) is not representative; front-end cost is reported from the **actual production build artifacts** (`frontend/dist`) as transfer/parse weight, not field RUM.
> - **localhost only** — zero network RTT. Real users add network latency on top of every API figure.
> - **GET-only / read-only** — no rows were written or mutated.
> - **Auth/session-gated flows** (full assessment completion, authenticated dashboards, report generation) cannot be exercised end-to-end while unauthenticated. For those we measure the **reachable system-side surface + the underlying DB query cost** and label the gap explicitly. We do **not** fabricate end-to-end timings.
> - **`pg_stat.n_live_tup` is stale** in this DB (several large tables report 0 rows); all "large dataset" sizes below use real `COUNT(*)`.
> - **"errors" columns count HTTP 5xx (server) failures only.** Expected 4xx (e.g. the `401` auth-reject endpoint) are *not* errors and are reported under status codes instead.

## Environment

| Resource | Value |
|---|---|
| CPU | 2 vCPU — Intel Xeon Platinum 8581C @ 2.30GHz |
| Memory | 16 GB (cgroup limit 16 GB), ~8.4 GB free, **no swap** |
| Node | v20.20.0 |
| Backend | Express on `tsx`, port 8080 (single process) |
| DB | PostgreSQL, 193 MB |
| Load tools | none installed (ab/wrk/autocannon absent) → custom harness `backend/audit/performance/bench.mjs` |

Raw data: `bench-result.json` (HTTP) and `db-bench-result.json` (DB), same folder.

---

## 5. API Latency  *(primary, fully representative)*

Single client, 20-request warmup + **200 samples** per endpoint, full response drained. Times in **ms**.

| Endpoint | p50 | p90 | p95 | p99 | max | mean | errors |
|---|---|---|---|---|---|---|---|
| `/api/health` (trivial) | 1.49 | 3.88 | 4.95 | 10.68 | 14.88 | 2.12 | 0 |
| `/api/capadex/concerns` (DB read) | 2.90 | 3.72 | 4.42 | 5.93 | 6.51 | 3.09 | 0 |
| `/api/outcome-intelligence/enabled` (flag probe) | 2.68 | 3.41 | 3.80 | 5.99 | 9.05 | 2.88 | 0 |
| `/api/lbi/interventions` (heavier read) | 3.19 | 4.70 | 5.98 | 9.55 | 20.72 | 3.63 | 0 |
| `/api/competency/intelligence/summary` (401 auth reject) | 2.79 | 3.90 | 5.84 | 12.91 | 28.37 | 3.32 | 0 |

**Verdict:** Excellent. Warm single-client p95 is **< 6 ms** for every reachable read; even the auth-reject path is fast (~3 ms p50), so the auth middleware adds negligible overhead. Network RTT (not measured here) will dominate real-world latency.

---

## 4. Database Queries  *(server-side execution time, fully representative)*

Server-side `EXPLAIN (ANALYZE, BUFFERS)` execution time, median of 3 runs. Times in **ms**.

| Query | rows touched | exec (median) | planning | notes |
|---|---|---|---|---|
| `count(*)` full scan — `mobility_transferability_maps` | 89,401 | **8.67** | 3.21 | seq scan of largest table |
| `count(*)` — `map_role_competency` | 52,362 | 5.09 | 0.39 | |
| `count(*)` — `onto_competency_content_drafts` | 17,996 | 2.04 | 0.48 | |
| `GROUP BY metric_name` agg — `aig_monitoring_metrics` | 19,334 | 5.57 | 0.48 | ⚠️ one cold first-touch run hit 696 ms before settling (IO/first-buffer); warm = ~5 ms |
| `SELECT * LIMIT 1000` — 89k table | 1,000 | 0.27 | 0.41 | |
| `ORDER BY recorded_at DESC LIMIT 100` (indexed) | 100 | 0.09 | 0.47 | uses `aig_mm_recent` index |
| `ORDER BY <first selected column> LIMIT 100` | 100 | 0.09 | 0.39 | planner may use a leading-column index; not asserted unindexed |
| `count(*)` — `competency_question_templates` | 2,665 | 0.60 | 0.46 | |
| filtered `WHERE status='draft' LIMIT 200` | 2,665 | 0.26 | 0.68 | |

**Verdict:** Healthy. Indexed/limited reads are sub-millisecond; even a full scan of the 89k-row largest table is **< 9 ms**. The single 696 ms cold outlier on first aggregation is first-touch IO (cold cache / possible autovacuum), not a steady-state cost — worth noting for the very first request after idle, mitigatable by connection/cache pre-warming.

---

## 8. Large Dataset Performance

Real `COUNT(*)` of the heaviest live tables (stat estimates were stale → these are exact):

| Table | rows | on-disk |
|---|---|---|
| `mobility_transferability_maps` | 89,401 | 31 MB |
| `map_role_competency` | 52,362 | 16 MB |
| `p4_benchmark_trends` | 26,910 | 9 MB |
| `aig_monitoring_metrics` | 19,334 | 4.5 MB |
| `onto_competency_content_drafts` | 17,996 | 16 MB |
| `frp_role_evolution` | 9,030 | 2.7 MB |
| `competency_question_templates` | 2,665 | 3.9 MB |

**Verdict:** At current scale (largest table ~89k rows, DB 193 MB) the data layer is comfortably small for Postgres; full scans complete in single-digit ms (see §4). No large-dataset bottleneck today. Re-benchmark when any table crosses ~1M rows.

---

## 9. Concurrent Users

Harness fires a fixed request count with N workers in flight; backend CPU/RSS sampled from `/proc/44051` across each level.

### `/api/health` (CPU-light) — 800 requests/level

| Concurrency | throughput (req/s) | p50 | p95 | p99 | max | errors | backend cores |
|---|---|---|---|---|---|---|---|
| 1 | 687 | 1.22 | 2.37 | 4.69 | 9.47 | 0 | 0.76 |
| 10 | 999 | 9.30 | 17.94 | 25.27 | 34.56 | 0 | 0.81 |
| 25 | 933 | 21.79 | 50.18 | 135.14 | 275.58 | 0 | 0.95 |
| 50 | 1164 | 32.01 | 45.68 | **519.39** | 686.10 | 0 | 0.82 |
| 100 | 1118 | 50.38 | **543.73** | 706.52 | 712.95 | 0 | 0.78 |

### `/api/capadex/concerns` (DB read) — 400 requests/level

| Concurrency | throughput (req/s) | p50 | p95 | p99 | max | errors | backend cores |
|---|---|---|---|---|---|---|---|
| 1 | 331 | 2.57 | 4.16 | 10.51 | 55.60 | 0 | 0.57 |
| 10 | 472 | 18.63 | 34.74 | 87.02 | 121.44 | 0 | 0.78 |
| 25 | 635 | 37.36 | 53.59 | 63.37 | 71.08 | 0 | 0.84 |
| 50 | 633 | 76.12 | 91.76 | 93.86 | 101.19 | 0 | 0.89 |

**Verdict:** **Stable — zero errors all the way to 100 concurrent.** Throughput plateaus around **~1,100 req/s** (health) / **~630 req/s** (DB read). The honest limit is **tail latency, not failure**: beyond ~25 concurrent, p99 degrades sharply (health p99 jumps to ~520 ms at C=50). Root cause is the **2-vCPU box + single JS thread** (see §7): one backend process cannot use more than ~1 core for JS, so requests queue on the event loop. **To scale past this, run multiple backend instances (cluster/horizontal), not a bigger single process.**

---

## 7. CPU Usage

Measured as backend-process CPU-seconds / wall-seconds (from `/proc`) during the concurrency runs.

- Backend stays at **~0.76–0.95 cores** regardless of concurrency level — it does **not** climb toward 2 cores. This confirms the single Node/JS thread is the ceiling; the 2nd vCPU is left for Postgres + OS.
- Even at C=100, backend used only ~0.78 cores while p99 latency exceeded 700 ms → the bottleneck is **event-loop queuing**, not raw CPU exhaustion of the JS thread.
- **Implication:** vertical CPU scaling yields little for this workload; horizontal (more processes/instances) is the right lever.

## 6. Memory Usage

| Process | RSS |
|---|---|
| Backend (tsx, prod-representative) | ~251 MB idle → **up to ~394 MB under load** |
| Frontend Vite dev server (dev-only, not prod) | ~148 MB |
| Python upload service (uvicorn) | ~128 MB |

- Backend RSS rose to ~394 MB under sustained load then **stabilized** (308–394 MB band across repeated runs) — **no leak observed** within the test window.
- All three services together are a small fraction of the 16 GB box (~8.4 GB free, no swap pressure). Memory is not a constraint at current scale.

---

## 2. Dashboard Load Time  *(front-end weight, from the real prod build)*

The Vite dev server is not representative, so this is measured from `frontend/dist` (the artifacts a deployed app actually ships).

| Asset | raw | gzip |
|---|---|---|
| **Total JS (all chunks)** | 13.06 MB | **3.39 MB** |
| Initial entry `index-*.js` | 1,569 KB | **412 KB** |
| `EmployerPortalPage` (lazy) | 1,071 KB | 283 KB |
| `CareerBuilderPage` (lazy) | 1,058 KB | 247 KB |
| `vendor-pdf` (lazy) | 730 KB | 219 KB |
| `UnifiedParentDashboard` (lazy) | 448 KB | 98 KB |
| `vendor-charts` (lazy) | 436 KB | 123 KB |
| `SuperAdminDashboard` (lazy) | 414 KB | 96 KB |
| `index.html` | 3.5 KB | — |
| **Images** | **10.55 MB across 13 files** | (PNG, already compressed) |
| Total `dist/` | 27 MB | — |

**Verdict & findings:**
- **Code-splitting is working** — heavy routes (Employer, Career Builder, PDF, charts, dashboards) are lazy chunks, so the initial download is ~**412 KB gzip JS**, which is reasonable.
- **Biggest front-end issue: unoptimized images.** ~10 MB is 8 mentor PNGs (~1.3 MB each). Converting to WebP/AVIF + right-sizing would cut roughly **8–9 MB** off page weight — the single highest-impact front-end optimization. (Consistent with the prior bundle-weight finding.)
- The authenticated dashboard's **data** layer is not the constraint — its API/DB reads are sub-10 ms (§4); perceived load time is dominated by asset transfer + user pacing.

---

## 1. Assessment Time  &  3. Report Generation  *(partial — auth/session-gated)*

These are **user-paced, session-gated flows** and cannot be exercised end-to-end while unauthenticated, so a single "assessment completion time" or "report generation time" number would be fabricated. What is honestly measurable:

- **System-side cost is small.** The reads behind these flows (concern lists, question bank, intelligence summaries) return in **< 6 ms p95** (§5) and their backing queries in **< 9 ms** (§4). The question bank (`competency_question_templates`, 2,665 rows) filters in **0.26 ms**.
- **Assessment completion time** is dominated by **user response pacing** (a human answering N questions), not system latency. The system contributes only the per-step API call (~3 ms server-side + network).
- **Report generation** runs server-side over data whose component queries are sub-10 ms; the PDF render path (`vendor-pdf`, `rf_generated_reports`) is the heavier step but is auth-gated and fire-and-forget in code, so it does not block the request thread. A true E2E render timing requires an authenticated session + seeded completed data and is out of scope for an unauthenticated, read-only benchmark.
- **Recommendation:** to capture real assessment/report timings, add lightweight server-side timing logs (start/end timestamps) on the assessment-submit and report-generate handlers, then read them from production telemetry — that yields honest field numbers without synthetic auth.

---

## Summary scorecard

| Dimension | Result | Status |
|---|---|---|
| API Latency | p95 < 6 ms (warm, single client) | ✅ Excellent |
| Database Queries | sub-ms indexed; 8.7 ms full-scan of 89k | ✅ Healthy |
| Large Dataset | largest table 89k rows / DB 193 MB | ✅ Comfortable |
| Concurrent Users | 0 errors to C=100; ~1,100 rps plateau; tail grows past C≈25 | ⚠️ Stable but single-process-bound |
| CPU | ~1 core ceiling (single JS thread) | ⚠️ Scale horizontally |
| Memory | ~394 MB backend peak, no leak; 8.4 GB free | ✅ Healthy |
| Dashboard Load | 412 KB gzip initial JS (good); **10 MB images (fix)** | ⚠️ Optimize images |
| Assessment Time | system-side < 6 ms/step; rest is user pacing | ✅ (partial, gated) |
| Report Generation | backing queries < 10 ms; render gated/async | ✅ (partial, gated) |

### Top recommendations (priority order)
1. **Compress/convert mentor images** (PNG → WebP/AVIF + resize) — saves ~8–9 MB page weight. Highest-impact, lowest-risk.
2. **Scale backend horizontally** (cluster mode / multiple instances behind the proxy) before expecting > ~25 concurrent users with tight tail latency — a single `tsx` process caps at ~1 core.
3. **Pre-warm DB connections/cache** to avoid the rare first-touch cold-query spike (~700 ms once).
4. **Add server-side timing logs** on assessment-submit and report-generate handlers to capture honest field timings for the two currently-gated dimensions.
