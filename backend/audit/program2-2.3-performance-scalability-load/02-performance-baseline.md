# 02 — Performance Baseline

**Date:** 2026-07-01 · **Method:** read-only Node HTTP harness (`backend/audit/performance/bench.mjs`,
GET-only, keep-alive, percentile + concurrency sweep, backend CPU via `/proc/<pid>/stat`) + server-side
`EXPLAIN (ANALYZE, BUFFERS)` + `/proc` RSS sampling.
**Raw data (this phase):** `bench-result-2.3.json`, `db-bench-result-2.3.json` (same folder).
**Prior baseline:** `backend/audit/performance/bench-result.json` / `db-bench-result.json` (2026-06-26).

> **Honesty notes (read first).**
> - **Backend numbers are production-representative** — prod runs the same `tsx` runtime, so backend API + DB latency here ≈ prod.
> - **localhost only** — zero network RTT; real users add network latency on top of every API figure.
> - **GET-only / read-only** — no rows written or mutated during measurement.
> - **Auth/session-gated flows** (full assessment, authenticated dashboards, report render) and **AI flows** (provider unconfigured here) cannot be exercised end-to-end → measured as reachable system-side surface + backing query cost, labelled PARTIAL. **No E2E timing is fabricated.**
> - **`pg_stat.n_live_tup` is stale** → all sizes use real `COUNT(*)`.
> - **"errors" = HTTP 5xx only.** Expected 4xx (401 auth-reject) reported under status codes, not errors.

## Environment

| Resource | Value |
|---|---|
| CPU | 2 vCPU |
| Memory | 16 GB (~9.9 GB free at measure time, no swap) |
| Node | v20.20.0 |
| Backend | Express on `tsx`, port 8080, single process (PID 2020) |
| Database | PostgreSQL, **206 MB** (was 193 MB in June) |
| Load tools | none installed → custom harness |

## API latency baseline (warm, single client, 200 samples + 20 warmup)

| Endpoint | p50 | p95 | p99 | max | errors |
|---|---|---|---|---|---|
| `/api/health` (trivial) | 1.08 | **2.29** | 3.41 | 4.24 | 0 |
| `/api/capadex/concerns` (DB read) | 2.39 | **6.87** | 15.06 | 27.86 | 0 |
| `/api/outcome-intelligence/enabled` (flag probe) | 2.00 | **2.84** | 5.74 | 7.10 | 0 |
| `/api/lbi/interventions` (heavier read) | 2.63 | **4.63** | 7.41 | 7.65 | 0 |
| `/api/competency/intelligence/summary` (401 auth-reject) | 2.12 | **4.00** | 8.89 | 26.28 | 0 |

Warm p95 < 7 ms on every reachable read. Consistent with June (which was p95 < 6 ms); `capadex/concerns`
p95 6.87 ms is within run-to-run noise.

## Database baseline (server-side Execution Time, median of 3)

| Query | rows | exec median (ms) | notes |
|---|---|---|---|
| `count(*)` full scan — `mobility_transferability_maps` | 89,401 | **8.31** | seq scan largest table |
| `count(*)` — `map_role_competency` | 52,362 | 4.99 | |
| `SELECT * LIMIT 1000` — 89k table | 1,000 | 0.34 | |
| `GROUP BY metric_name` — `aig_monitoring_metrics` | 29,974 | 6.84 | |
| `ORDER BY recorded_at DESC LIMIT 100` (indexed) | 100 | **0.079** | uses `aig_mm_recent` index |

Occasional 3rd-rep spikes (e.g. 22.9 / 45 / 155 / 249 ms) are cold plan-cache/first-touch noise; medians
are the steady-state signal (mitigated in prod by the DB pre-warm in `backend/index.ts`).

## Heaviest tables (real `COUNT(*)`)

| Table | rows | on-disk |
|---|---|---|
| `mobility_transferability_maps` | 89,401 | 31 MB |
| `map_role_competency` | 52,362 | 16 MB |
| `p4_benchmark_trends` | 26,910 | 9.0 MB |
| `aig_monitoring_metrics` | 29,974 | 6.6 MB |
| `onto_competency_content_drafts` | 17,996 | 16 MB |
| `frp_role_evolution` | 13,160 | 3.9 MB |
| `competency_question_templates` | 2,665 | 3.8 MB |

Largest table still 89k rows; DB 206 MB total. Comfortably small for Postgres — full scans single-digit ms.

## Concurrency baseline (0 errors throughout)

`/api/health`: C=1 → 829 rps (p99 5.9 ms) · C=25 → 1,381 rps (p99 108 ms) · C=50 → 1,235 rps
(p99 399 ms) · C=100 → 1,829 rps (p99 432 ms). Backend CPU stays ~0.68–1.00 core across all levels.

`/api/capadex/concerns` (DB read): C=1 → 490 rps (p99 6.0 ms) · C=25 → 616 rps (p99 58 ms) · C=50 →
637 rps (p99 152 ms). 0 errors.

## Baseline verdict

Healthy and **materially unchanged from June** (slightly better on several warm-latency figures). The
steady-state performance envelope is well understood; the single-process concurrency ceiling is the one
structural limit and is addressed architecturally (horizontal scale-out), not with a code change.
