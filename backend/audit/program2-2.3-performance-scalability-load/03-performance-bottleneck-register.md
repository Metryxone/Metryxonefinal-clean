# 03 — Performance Bottleneck Register

Every entry cites measured runtime evidence or a repository path. Nothing is assumed. Severity:
**Launch-Critical / High / Medium / Low / Future.** Checked against the spec's bottleneck checklist
(slow APIs, large responses, slow queries, missing indexes, N+1, blocking ops, sequential processing,
memory/CPU hotspots, background-job delays, AI latency, report-gen delays).

| # | Bottleneck | Present? | Evidence | Severity |
|---|---|---|---|---|
| B1 | Slow APIs | **No** | measured warm p95 < 7 ms on all reachable reads (report 02/04) | — |
| B2 | Large responses | **No (bounded)** | 8 MB JSON body limit `backend/index.ts`; reads paginated via drizzle `limit()/offset()` (`storage.ts`) | Low |
| B3 | Slow queries | **No** | `EXPLAIN ANALYZE` sub-ms indexed / 8.3 ms full-scan (report 05) | — |
| B4 | Missing indexes | **No evidence** | measured hot reads use indexes (`aig_mm_recent`, sub-ms); 40 index/unique declarations in `shared/schema.ts` | Low |
| B5 | N+1 queries | **Not observed in measured surface** | measured endpoints are single-digit ms; full route-wide static N+1 sweep not in scope of an unauthenticated read benchmark | Medium (verify) |
| B6 | Blocking operations | **Mitigated** | heavy work is deferred via `setImmediate` (report/LBI/signal builders) so it doesn't block the request thread | Low |
| B7 | Sequential processing | **Minor** | some builders run sequentially but off the request path (fire-and-forget) | Low |
| B8 | Memory hotspots | **No** | RSS stable 434–471 MB under load, no leak (report 02) | — |
| B9 | CPU hotspots | **Structural ceiling** | single JS thread caps ~1 core even at C=100 (report 02/10) | **High** |
| B10 | Background-job delays | **Possible under load** | in-process `setImmediate`/`setInterval`, no durable queue/retry (report 08) | Medium |
| B11 | AI latency | **Not measurable here** | provider unconfigured (`OPENAI_API_KEY`/`EMERGENT_LLM_KEY` unset); code fails fast 503 via `AIServiceUnavailableError` (report 06) | Medium |
| B12 | Report-generation delays | **Not measurable E2E** | backing queries fast; PDF render auth-gated + non-blocking (report 07) | Medium |
| B13 | High-concurrency tail latency | **Yes** | measured p99 108 ms @ C=25 → 432 ms @ C=100 on `/api/health` (report 09) | **High** |
| B14 | Rare first-touch cold spike | **Yes (one-off)** | one 696 ms cold aggregation in June; 3rd-rep plan-cache spikes here; mitigated by DB pre-warm | Low |

## Root-cause summary

- **The single real structural bottleneck is B9 + B13: the single Node/JS thread (~1-core ceiling).**
  It is a *tail-latency-under-concurrency* limit, **not a failure mode** (0 errors to C=100). The
  correct lever is **horizontal scale-out** (multiple instances behind the proxy; sessions already
  Postgres-backed) — an approved architectural decision, not a code fix.
- **B5, B10, B11, B12 are "verify / config / operational" items**, not measured defects — they are
  auth-gated, provider-gated, or scale-dependent and are honestly reported as CONDITIONAL, never as
  fabricated numbers.
- **No Launch-Critical performance bottleneck exists** in the measured surface at current scale.
