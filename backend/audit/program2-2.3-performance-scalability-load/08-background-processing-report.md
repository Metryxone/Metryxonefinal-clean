# 08 — Background Processing Report

**Scope (spec):** queue performance, scheduling, retry strategy, failure recovery, resource usage.

## Architecture (repository evidence)

The platform uses **in-process background execution**, not an external queue/worker system (no Redis/
BullMQ/pg-boss). Two mechanisms:

**1. Fire-and-forget deferred work — `setImmediate`** (runs after the current request returns, same
process). Verified call sites include:

- `backend/routes/career-seeker.ts` — `calculateAndPersistLBI` (LBI chain) after profile save.
- `backend/routes/lbi-engine.ts`, `backend/routes/behavioural-signals.ts` — pattern detection +
  signal-history snapshot.
- `backend/routes/report-factory.ts`, `backend/routes/capadex-enterprise.ts` — report persistence.
- `backend/routes/employer-tig.ts`, `backend/routes/employer-security.ts` — TIG/security async work.
- Several `setImmediate(() => ensureSchema(pool)...)` lazy schema bootstraps.

**2. Periodic schedulers — `setInterval`** (in-process, `.unref()` where appropriate):

- `backend/services/feature-flags.ts` — flag cache refresh every **60 s**.
- `backend/services/ai-governance-scheduler.ts` — monitoring loop every **5 min**, scheduled-workflow
  check every **60 s** (both `.unref()`).
- `backend/services/ei-resolver.ts`, `backend/routes/peer-benchmark.ts` — cache maintenance intervals.
- `backend/services/ws-broadcast.ts` — WebSocket ping keep-alive.

## Queue performance & scheduling

At current scale this is adequate: deferred tasks execute promptly on the same event loop, and the
schedulers are lightweight (cache refresh / monitoring). Because they share the single JS thread, heavy
background bursts compete with request handling for the ~1-core budget (report 10) — but measured
request load showed no degradation from background work in the window.

## Retry strategy & failure recovery (honest limitation)

- Fire-and-forget tasks **swallow-and-log errors** (`.catch(() => {})` / `.catch(e => …)`) — a failure
  does **not** crash the request, but there is **no durable retry and no dead-letter**. If a deferred
  task fails (or the process restarts mid-task), that unit of work is **lost** — it is not re-enqueued.
- This is acceptable for the current idempotent, self-healing tasks (most recompute on the next trigger)
  but is a **real gap for strict enterprise delivery guarantees** (exactly-once, guaranteed retry).

## Resource usage

In-process; no separate worker RSS. Background work is included in the backend's stable 434–471 MB
footprint (report 02). No leak observed.

## Certification

⚠️ **Background Processing — CONDITIONAL.** **CERTIFIED for current scale:** deferral keeps heavy work
off the request path, schedulers are lightweight, failures are contained (no crash). **NOT certified for
enterprise durability:** no external queue, no durable retry, no dead-letter — deferred work is lost on
failure/restart. **This is a design characteristic, not a regression;** changing it would be new
architecture (explicitly out of scope for 2.3). Recommended (Future, report 13): introduce a durable
queue (e.g. `pg-boss` on the existing Postgres) if guaranteed async delivery becomes a requirement.
(Certified independently.)
