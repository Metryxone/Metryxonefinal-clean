# Competency Assessment — Scale Readiness

**Audit:** MX-COMPETENCY-WORLDCLASS-LAUNCH-CERTIFICATION-100X · 18 Jun 2026
**Question:** Can Competency Assessment scale operationally from 100 → 1,000,000 users?

**Verdict:** **Ready for 100–1,000. Needs hardening for 10,000. 100,000+ and 1,000,000 are a roadmap, not a current capability.**

---

## 1. Scale tiers

| Tier | Readiness | Binding constraints |
|---|---|---|
| **100 users** | ✅ Ready | Current architecture (Postgres + Express + JSONB) handles this comfortably; 58 sessions/100 users already live. |
| **1,000 users** | ✅ Ready (pilot-grade) | Fine with current single-DB setup; watch synchronous scoring + email throughput. |
| **10,000 users** | ⚠️ Needs hardening | Connection pooling/read replicas, async assessment scoring queue, migration-led schema (retire lazy `ensureSchema`), email provider redundancy. |
| **100,000 users** | 🔴 Roadmap | Horizontal scaling, caching, partitioning of history tables, observability/alerting, rate-limiting, dedicated prod DB (currently dev/prod **shared**). |
| **1,000,000 users** | 🔴 Roadmap | Full multi-tenant isolation, sharding/replicas, CDN, queue-based pipeline, SRE/on-call, capacity planning, SLAs. |

---

## 2. Operational scale dimensions

| Dimension | State | Gap |
|---|---|---|
| **Assessment scale** | Synchronous scoring | No async/queue for large institution batch loads |
| **Support scale** | SuperAdmin monitoring panels exist (`m4-observability`, EI ops) | No ticketing/incident system; crisis has **no human-notify** path (safety gap) |
| **Institution scale** | Batch/faculty structures exist | Bulk import/export not validated at large cohort sizes |
| **Employer scale** | Self-register + audit trails | Talent-pool analytics need population |
| **Data layer** | Single shared dev/prod DB | **Dev/prod isolation required before scale**; no replicas |
| **Schema deploy** | Lazy `ensureSchema` on routes | Move to migration-led deploy discipline |
| **Security posture** | CSP disabled; thin OTP/login rate-limiting; Zoho SPOF for MFA | Harden before public scale |
| **Observability** | Logs + admin panels | No `/health`, formal uptime, alerting, or SLAs |

---

## 3. Highest-risk scale blockers (ordered)

1. **Shared dev/prod database** — operational risk; isolate before any real scale.
2. **Email (Zoho) SPOF** — MFA/OTP lockout if down; add provider redundancy.
3. **Synchronous scoring** — institution batch loads will block; add async queue.
4. **Lazy schema** — non-deterministic deploys; adopt migration runner discipline.
5. **No incident/ticketing/health/alerting** — cannot operate a paying base at scale.
6. **Thin rate-limiting / CSP off** — abuse & security exposure at public scale.

---

## 4. Verdict

> Operationally, the platform is a **well-instrumented pilot system**, not yet a scaled SaaS. It can run **institution and employer pilots (≤1k users) today** with concierge support. Scaling to 10k+ requires a defined hardening program (DB isolation, async pipeline, migration discipline, support tooling, security hardening). **Scale is a solvable engineering roadmap — but it is not a current claim.**
