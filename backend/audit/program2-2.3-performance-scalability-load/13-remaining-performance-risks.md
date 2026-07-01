# 13 — Remaining Performance Risks

Every remaining performance gap, ranked by severity: **Launch-Critical / High / Medium / Low / Future.**
Each is measured or repository-grounded. None is fabricated.

## Launch-Critical — **NONE**

No measured performance defect blocks launch: zero 5xx errors to C=100, warm p95 < 7 ms, DB reads
sub-ms/8 ms. The measured core is sound.

## High

- **H1 — Single-process concurrency ceiling / tail latency.** Backend is one JS thread (~1-core ceiling,
  report 10). Measured p99 rises 108 ms @ C=25 → ~400–432 ms @ C≥50 (report 09). *No failure* (0 errors),
  but enterprise high-concurrency needs **horizontal multi-instance provisioned + load-validated**.
  *Mitigation ready:* shared PG sessions + stateless handlers. *Action:* provision instances behind the
  proxy; re-run the load harness against the multi-instance target. **Config/operational, not code.**

## Medium

- **M1 — AI performance unverified at scale.** Provider unconfigured here → prompt-execution latency,
  token usage, concurrent-AI behaviour unmeasured (report 06). *Action:* configure provider / co-deploy
  FastAPI proxy, then load-test AI flows. Resilience code (fail-fast 503, 3 s timeout, tested
  degradation) is already sound.
- **M2 — Background jobs lack durable retry/queue.** In-process `setImmediate`/`setInterval`; failed or
  restart-interrupted deferred work is lost (report 08). Acceptable now (idempotent, self-healing tasks);
  a risk if strict async delivery guarantees are required. *Action (Future/M2):* adopt `pg-boss` on
  existing Postgres if needed.
- **M3 — Report render E2E + concurrent-PDF memory unmeasured.** Auth-gated (report 07). Backing
  aggregation is fast and render is non-blocking, but concurrent large-PDF heap behaviour is unproven.
  *Action:* authenticated render load with `[perf]` timing + a concurrent-PDF memory test.
- **M4 — Route-wide N+1 not exhaustively swept.** No N+1 observed in the measured surface, but a full
  static sweep across all authenticated routes was not in scope of an unauthenticated read benchmark
  (report 03/B5). *Action:* enable `[perf]` timing in staging and inspect any endpoint > ~50 ms.

## Low

- **L1 — Per-instance rate-limiter & caches under multi-instance.** In-memory limiter/caches become
  per-instance at scale-out (report 10). Fine for short-TTL self-healing caches; weakens strict global
  rate limiting.
- **L2 — Cold plan-cache / first-touch spikes.** Occasional first-request spikes (report 02/05);
  mitigated by DB pre-warm. One-off, not steady-state.
- **L3 — Large-response surface.** Bounded (8 MB body limit, pagination) but heavier authenticated
  responses weren't E2E size-profiled.

## Future

- **F1 — Re-benchmark at ~1M+ rows** in any table (largest is 89k today) — seq-scan cost grows with size.
- **F2 — Shared-store rate limiter** (Postgres/Redis) for strict global limits across instances.
- **F3 — Durable queue** (`pg-boss`) if guaranteed async delivery/retry becomes a requirement.
- **F4 — Leader-election** for singleton schedulers under multi-instance (report 10).
- **F5 — Capture real production field timings** from `[perf]` logs to complement synthetic benchmarks.

## Summary

| Severity | Count |
|---|---|
| Launch-Critical | 0 |
| High | 1 (H1 — horizontal scale provisioning) |
| Medium | 4 (M1–M4) |
| Low | 3 (L1–L3) |
| Future | 5 (F1–F5) |

The single High item is **operational provisioning**, not a code defect. All Medium items are
**verify/config**, resolvable without changing business logic or architecture.
