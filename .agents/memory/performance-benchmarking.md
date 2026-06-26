---
name: Performance benchmarking on this repl
description: How to benchmark this stack honestly, plus the established perf baselines and the single-process ceiling.
---

# Performance benchmarking

**Why:** the project owner's rule is honesty over optimism; a perf report must label what is
representative vs not, and never fabricate gated-flow timings.

## How to measure (tooling reality)
- **No load-test tools installed** (no ab/wrk/autocannon/hey). Write a Node `http` harness instead —
  see `backend/audit/performance/bench.mjs` (read-only, GET-only, keep-alive agent, percentile +
  concurrency sweep, backend CPU via `/proc/<pid>/stat` utime+stime, CLK_TCK=100).
- **Backend `tsx` is prod-representative** (prod runs tsx too) → backend API + DB latency here ≈ prod.
- **Frontend dev (Vite) is NOT representative** → measure front-end weight from the real prod build
  `frontend/dist` (gzip the JS chunks; tally images) not from the dev server.
- **DB timings**: use `EXPLAIN (ANALYZE, BUFFERS)` server-side Execution Time, not round-trip — and
  parse the plain-text `Execution Time:` line; `executeSql` truncates/reformats `FORMAT JSON`.
- **Row counts**: `pg_stat.n_live_tup` is STALE (big tables show 0); always real `COUNT(*)`.

## Established baselines (measured 2026-06, 2 vCPU / 16GB)
- API warm single-client p95 **< 6 ms** for reachable reads; auth-reject (401) ~3 ms p50.
- DB: full `count(*)` of the 89k-row largest table (`mobility_transferability_maps`) **~8.7 ms**;
  indexed/limited reads sub-ms. One-off cold first-touch can spike (~700 ms once) → pre-warm.
- Concurrency: **0 errors to C=100**, throughput plateaus ~1100 rps (health)/~630 rps (DB read);
  tail latency degrades sharply past ~C=25.
- Backend RSS ~251 MB idle → ~394 MB under load, no leak.

## The ceiling (durable)
- Backend is a **single Node process** → caps at **~1 core** for JS work; the 2nd vCPU only helps PG/OS.
  CPU stays ~0.8 cores even at C=100 while p99 blows past 700 ms — bottleneck is event-loop queuing,
  not CPU exhaustion. **Scale horizontally (cluster/instances), not vertically.**
- Biggest front-end cost is **~10 MB of unoptimized mentor PNGs** (8× ~1.3 MB); convert to WebP/AVIF.
- Auth/session-gated flows (assessment completion, report generation, dashboards) can't be exercised
  E2E unauthenticated — report system-side cost + DB query cost, mark PARTIAL, never invent an E2E number.
