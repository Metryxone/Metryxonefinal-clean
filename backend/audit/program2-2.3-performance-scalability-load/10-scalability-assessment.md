# 10 — Scalability Assessment

**Method:** measured CPU/throughput/memory scaling (report 09) + repository/architecture evidence.

## Vertical scaling (measured)

The backend is a **single Node process → a single JS thread**. Measured CPU stays at **~0.68–1.00 core
regardless of concurrency** (C=1 through C=100) while p99 latency climbs past 400 ms — proving the
bottleneck is **event-loop queuing on one thread, not raw CPU exhaustion**. The 2nd vCPU is left for
Postgres + OS.

**Implication:** adding CPU/RAM to one instance yields little for this workload. Vertical scaling is
**not** the lever.

## Horizontal scaling (architectural readiness — repository evidence)

Horizontal scale-out is the correct lever and the platform is **structurally ready** for it:

- **Shared session state:** sessions use `connect-pg-simple` persisting to the `express_sessions`
  Postgres table — **any instance can serve any user's session**, the key prerequisite for multi-instance.
- **Stateless request handling:** request handlers read/write the shared Postgres; no request-scoped
  in-memory state is required for correctness.
- **Decision on record (June audit, still valid):** do **not** use in-process Node `cluster` mode,
  because per-process in-memory state (the auth **rate-limiter** and short-TTL **admin caches**) would
  fragment across workers → weaker rate limiting + inconsistent cached reads. Scale instead via
  **platform multi-instance** (Replit Autoscale / instances behind the proxy).

## Residual multi-instance caveats (honest)

1. **Per-instance rate-limiter & caches.** Under multi-instance the in-memory rate-limiter and 60 s admin
   caches become *per-instance* rather than global. Acceptable for the short-TTL, self-healing caches;
   for **strict global rate limiting**, move the limiter to a shared store (Postgres/Redis) — **Future**
   (report 13). Not changed here (would alter behaviour / add architecture — out of scope).
2. **DB connection budget.** `PG_POOL_MAX` (default 10) × instance-count must stay within the database's
   `max_connections`, shared with the session store + FastAPI. A **provisioning constraint** to size at
   scale-out time (tune `PG_POOL_MAX` down or use a pooler like PgBouncer).
3. **In-process background jobs** (report 08) run on each instance; schedulers (`feature-flags` 60 s,
   `ai-governance` 5 min) would run **per-instance** — for singleton scheduled work, add a leader-election
   / advisory-lock guard before multi-instance (**Future**).

## Data scalability

Largest table 89k rows, DB 206 MB — comfortably small; full scans single-digit ms (report 05). No data
scalability concern at current scale. **Re-benchmark when any table crosses ~1M rows** (Future).

## Certification

⚠️ **Scalability — CONDITIONAL.** **CERTIFIED:** the app is horizontally scalable by design (shared PG
sessions, stateless handlers) and stable under load with zero errors. **CONDITIONAL because** high
concurrency with tight tail latency **requires provisioning + validating multi-instance** (and handling
the three residual caveats above) — an **operational/config** step, not a code defect. A single instance
comfortably serves moderate concurrency (~C≤25 with good tail). (Certified independently.)
