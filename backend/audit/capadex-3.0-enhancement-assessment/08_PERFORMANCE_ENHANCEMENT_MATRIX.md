# 8 · Performance Enhancement Matrix

**Honesty:** No production traffic exists → throughput / p95 / concurrency are **null (unmeasurable), not 0**.
What IS measurable: build output, bundle sizes, code structure, and the presence (but not standardization) of
a perf harness. Enhancements add the *ability to measure* and remove *known structural* perf risks.

## Measured today
- Frontend prod build PASSES (~46s). Largest chunks: index **1.62 MB**, CareerBuilder **1.23 MB**,
  EmployerPortal **1.16 MB** (pre-gzip) — heavy initial payloads.
- Backend runs on **tsx** in prod (no compiled/typechecked build) — startup parse cost, no type gate.
- A perf harness exists (`backend/audit/performance/bench.mjs`) but there is **no standardized load gate**
  in CI and **no load tooling** (k6/artillery absent).
- Single Node JS thread ≈ ~1 core ceiling (scale horizontally) — recorded in memory.

## Enhancement opportunities
| ID | Enhancement | Evidence | Customer/Enterprise impact | Risk | Effort | Priority |
|---|---|---|---|---|---|---|
| PE-1 | **Code-split / lazy-load the >1 MB route bundles** (CareerBuilder, EmployerPortal, index) | build output | TTI / first-load at scale, esp. mobile | medium | M | **High** |
| PE-2 | **Standardize a load-test gate** (write a Node http harness — no k6/artillery present) measuring p95/throughput on key endpoints; run pre-launch | memory: performance-benchmarking | converts perf from null→measured before customers hit it | medium | M | **High** |
| PE-3 | **DB index & N+1 review** on the hottest read paths (career hub, employer cockpit, reports) | 1,441 tables, heavy joins | latency under real load | medium | M | Medium |
| PE-4 | **Response caching** on read-heavy admin/analytics (60s cache pattern already exists — extend consistently) | admin cache convention | server load reduction | low | M | Medium |
| PE-5 | **Horizontal-scale readiness check** — confirm statelessness/session-store fit for multi-instance (Cloud Run) | deploy topology | scale-out without sticky sessions | medium | M | Medium |
| PE-6 *(= AIE-6; counted once in 01 under AI)* | **AI call timeouts + budget caps** — network-bound LLM latency is the dominant tail | AI integration sites | tail latency + cost | medium | M | Medium |
| PE-7 | **Build-time budget** alert on chunk size regressions | build pipeline | prevent future bloat | low | S | Low |

## Honest non-claims
- Do **not** report any throughput/latency SLO as met — there is **no traffic and no load test yet** (PE-2
  is the prerequisite to making any such claim).
- Backend has no tsc gate by design (prod runs tsx); do **not** add a backend typecheck gate as a "perf"
  item — the real launch gate is the frontend vite build (which passes).

## Performance enhancement summary
Performance is **structurally reasonable but unproven**. The two launch-relevant moves are **PE-1**
(split the heavy bundles — the one measurable, fixable perf issue today) and **PE-2** (stand up a load gate
so perf stops being `null` before real customers arrive). Everything else is post-pilot tuning.
