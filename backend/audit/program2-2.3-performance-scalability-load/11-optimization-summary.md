# 11 — Optimization Summary

**Contract:** *Measure before optimize. Optimize only where measurable benefit exists. Never optimize on
assumptions. Repository evidence required for every change.*

## Honest outcome of Phase 2.3

**No new code optimization was justified by 2.3 measurements.** The fresh measurement (reports 02/04/05/
09) found **no slow API, no slow query, no missing index, and no measured N+1 hotspot** in the reachable
surface — every endpoint returns warm p95 < 7 ms and every measured query is sub-10 ms. Per the
measure-before-optimize contract, inventing changes with no measured bottleneck would violate the rules.
We therefore **did not modify code** in this phase.

This is the correct result: 2.3 is a *validation & certification* phase over a backend whose high-value
optimizations were already implemented and are re-validated below.

## Prior optimizations re-validated (already in the repository — Reuse-Before-Build)

These were implemented in the June 2026 audit (`backend/audit/performance/`) and were **confirmed still
effective** this phase:

| # | Optimization | Where | 2.3 re-validation |
|---|---|---|---|
| 1 | **Image payload reduction** — PNG→WebP hero/marketing assets (−9.6 MB) | frontend assets | Still applied; frontend cold-load payload reduced |
| 2 | **DB connection pre-warm** — 4 connections at boot | `backend/index.ts` (`DB_PREWARM_DISABLED=1`) | Eliminates cold first-touch; steady-state DB reads sub-ms/8 ms (report 05) |
| 3 | **`[perf]` request-timing middleware** for field diagnosis | `backend/index.ts` (`PERF_TIMING_DISABLED=1`) | Present; the instrument to capture prod E2E timings (reports 07/09) |
| 4 | **Horizontal-scaling decision** (platform multi-instance, not Node `cluster`) | June audit + report 10 | Re-affirmed as the correct scale lever; rationale unchanged |

## Optimizations considered and **rejected** (with reason)

| Candidate | Rejected because |
|---|---|
| Query/index tuning | No slow query measured; indexed reads already sub-ms (report 05) |
| Response caching on reads | Reads already < 7 ms p95; cache would add invalidation complexity for no measured gain |
| Node `cluster` mode | Would fragment per-process rate-limiter + caches → weaker limiting/inconsistent reads (report 10) |
| Durable job queue (pg-boss/BullMQ) | New architecture — **out of scope** for 2.3; logged as Future (reports 08/13) |
| AI response caching | No provider configured to measure benefit; context-specific outputs (report 06) |
| Global rate-limiter store | Behaviour change + architecture — out of scope; logged as Future (report 13) |

## Net

Zero code changes → **zero regression risk** by construction. Value delivered = measured proof of
performance + independent certification + a severity-ranked residual-risk register. Optimizations that
*would* matter next are all **scale/config/operational** (horizontal provisioning, AI provider + load,
durable queue), documented in reports 10 & 13 — deliberately not implemented here because they exceed the
2.3 scope or lack a current measured trigger.
