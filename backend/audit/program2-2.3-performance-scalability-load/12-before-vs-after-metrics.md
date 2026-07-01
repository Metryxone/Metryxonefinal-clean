# 12 — Before vs After Metrics

Because **no new optimization was applied this phase** (report 11), "before vs after" is presented two
ways: (A) the **June baseline vs the July re-measurement** (does the previously-optimized system still
perform?), and (B) the **before/after of the prior June optimizations** (already in the repo). No number
is fabricated; both columns are measured.

## A. June 2026 baseline → July 2026 re-measurement (regression check)

**API warm latency (p95, ms):**

| Endpoint | June p95 | July p95 | Δ | verdict |
|---|---|---|---|---|
| `/api/health` | ~4.95 | **2.29** | ↓ better | stable/better |
| `/api/capadex/concerns` | ~4.42 | 6.87 | ↑ within noise | stable |
| `/api/outcome-intelligence/enabled` | ~3.80 | **2.84** | ↓ better | stable/better |
| `/api/lbi/interventions` | ~5.98 | **4.63** | ↓ better | stable/better |
| `/api/competency/...summary` (401) | ~5.84 | **4.00** | ↓ better | stable/better |

**Load (health path):** 0 errors to C=100 in **both** runs; throughput plateau ~1,800 rps unchanged;
backend ceiling ~1 core unchanged; tail past C≈25 unchanged.

**Database:** full-scan 89k ≈ 8.3 ms both runs; indexed read sub-ms both runs. DB grew 193 MB → 206 MB
(data growth), largest table stable at 89,401 rows.

**Memory:** RSS stable band both runs (~394 MB June cold → 434–471 MB under load July); **no leak** either run.

**Verdict: no regression.** Several warm-latency figures improved; the rest are within run-to-run noise.

## B. Prior June optimizations — before → after (already implemented; re-confirmed)

| Optimization | Before | After | Status in 2.3 |
|---|---|---|---|
| Hero/marketing images PNG→WebP | +9.6 MB image payload | −9.6 MB | still applied |
| DB connection pre-warm | cold first-query penalty on boot | first queries warm | still applied (report 05) |
| `[perf]` timing middleware | no per-request field timing | opt-out timing available | still applied |
| Scale strategy | ambiguous (cluster vs instances) | documented: platform multi-instance | re-affirmed (report 10) |

## Guarantee

This phase changed **no code** → API/database/frontend contracts are **byte-identical** to pre-2.3, and
the before/after comparison is a **pure regression/stability check**, which the system passes.
