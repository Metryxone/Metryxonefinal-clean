# CAPADEX 3.0 · Program 2 · Phase 2.5 — Operational Gap Register

> Deliverable 14 · Generated 2026-07-01T03:36:10.857Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:98db190526bf, written 2026-07-01T03:36:10.856Z).
> Honesty: Coverage (evidence exists) ⟂ Confidence ⟂ Adoption (real volume) — NEVER composited. null ≠ 0. Built ≠ Operated ≠ Recoverable. Nothing fabricated.

## Open gaps — **0 Launch-Critical · 0 High · 4 Medium · 2 Low · 1 Future**

| ID | Severity | Axis | Title | Detail |
|---|---|---|---|---|
| GAP-OPS-1 | Medium | `metrics` | No metrics-export endpoint / APM pipeline | API throughput/error-rate counters, cache-hit ratio and a Prometheus/statsd export are absent. Latency/resource/AI/KPI signals ARE measured; the missing piece is external export/aggregation. Deferred (infra-owned). |
| GAP-OPS-2 | Medium | `monitoring` | No durable queue / Dead-Letter-Queue for background jobs | The event bus is in-process fire-and-forget with no persisted retry/DLQ. Failed async work is not durably tracked. A durable queue + DLQ is a Medium operational enhancement for a future task. |
| GAP-OPS-3 | Medium | `alerting` | No alert-rule store / notification routing | Failure conditions are detectable but alerts are client-derived from status, not pushed via a durable rule store + notification channel. Medium operational gap. |
| GAP-OPS-4 | Medium | `ai_operations` | No AI cost / token accounting | AI latency/retry/health/provider/model are observable but per-request cost and token usage are not tracked. Medium gap; never fabricated as 0. |
| GAP-OPS-5 | Low | `logging` | No cross-service correlation-ID propagation (Node→FastAPI) / distributed tracing | A per-request requestId exists on the Node service but is not propagated to the FastAPI upload service, and there is no distributed-tracing backend. Low/Medium gap. |
| GAP-OPS-6 | Low | `observability` | No /version and no /metrics endpoint | Health + readiness exist; a build/version-info endpoint and a machine-readable metrics endpoint are absent. Low gap. |
| GAP-OPS-7 | Future | `disaster_recovery` | Disaster-recovery validation is infra-owned, not validated in-repo | Managed-DB backups exist at the infra layer but restore drills, documented recovery procedures and measured RTO/RPO are not present in the repository. Future/infra gap — reported honestly, never claimed as validated. |

## Resolved / reused mechanisms (6) — traceability that observability substrate EXISTS

| ID | Axis | Mechanism | Detail |
|---|---|---|---|
| RES-OPS-1 | `observability` | `health-aggregator.computeAllHealthDomains` | A 6-domain live health monitor + /api/health + /api/health/ready + snapshot history already exist and are composed here (no new health engine). |
| RES-OPS-2 | `monitoring` | `runtime-intelligence + global-monitoring-engine` | Live runtime/resource/service monitoring + command-center global-monitoring already exist and are composed here. |
| RES-OPS-3 | `logging` | `requestId + lib/redact + admin_audit_logs` | Per-request identity, redaction-at-write, and a redacted audit trail already exist and are composed here. |
| RES-OPS-4 | `metrics` | `intelligence-observability-engine + anl_kpi_daily` | AI-runtime + orchestration-performance persistence + a KPI daily rollup already exist and are measured here. |
| RES-OPS-5 | `ai_operations` | `aiClient.checkAIHealth + ai_runtime_monitoring` | External-AI health probe + AI-runtime persistence already exist and are composed here. |
| RES-OPS-6 | `operational_readiness` | `capadex-safety-breaker + SuperAdminDashboard` | A circuit-breaker for external calls + a super-admin operational console already exist and are composed here. |

_A reused mechanism means the observability substrate exists and is composed — NOT a claim of full adoption. Coverage ⟂ Adoption never composited._
