# CAPADEX 3.0 · Program 2 · Phase 2.5 — Operational Gap Register

> Deliverable 14 · Generated 2026-07-01T04:39:04.945Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:756c369c3c11, written 2026-07-01T04:39:04.945Z).
> Honesty: Coverage (evidence exists) ⟂ Confidence ⟂ Adoption (real volume) — NEVER composited. null ≠ 0. Built ≠ Operated ≠ Recoverable. Nothing fabricated.

## Open gaps — **0 Launch-Critical · 0 High · 0 Medium · 0 Low · 0 Future**

| ID | Severity | Axis | Title | Detail |
|---|---|---|---|---|


## Resolved / reused mechanisms (14) — traceability that observability substrate EXISTS

| ID | Axis | Mechanism | Detail |
|---|---|---|---|
| RES-OPS-1 | `observability` | `health-aggregator.computeAllHealthDomains` | A 6-domain live health monitor + /api/health + /api/health/ready + snapshot history already exist and are composed here (no new health engine). |
| RES-OPS-2 | `monitoring` | `runtime-intelligence + global-monitoring-engine` | Live runtime/resource/service monitoring + command-center global-monitoring already exist and are composed here. |
| RES-OPS-3 | `logging` | `requestId + lib/redact + admin_audit_logs` | Per-request identity, redaction-at-write, and a redacted audit trail already exist and are composed here. |
| RES-OPS-4 | `metrics` | `intelligence-observability-engine + anl_kpi_daily` | AI-runtime + orchestration-performance persistence + a KPI daily rollup already exist and are measured here. |
| RES-OPS-5 | `ai_operations` | `aiClient.checkAIHealth + ai_runtime_monitoring` | External-AI health probe + AI-runtime persistence already exist and are composed here. |
| RES-OPS-6 | `operational_readiness` | `capadex-safety-breaker + SuperAdminDashboard` | A circuit-breaker for external calls + a super-admin operational console already exist and are composed here. |
| RES-OPS-7 | `metrics` | `ops/metrics-registry.ts + opsMetricsMiddleware + /metrics` | GAP-OPS-1 CLOSED: an in-process metrics registry (request counters + latency histograms + cache hit/miss) is recorded by opsMetricsMiddleware and exported as Prometheus text at /api/operational-readiness/metrics (+ JSON at /metrics.json). External APM aggregation stays an honest infra boundary. |
| RES-OPS-8 | `monitoring` | `ops/durable-queue.ts (ops_job_queue + ops_job_dead_letter)` | GAP-OPS-2 CLOSED: a durable job queue with FOR UPDATE SKIP LOCKED claim, per-job attempt/retry/backoff, processing_ms timing, a Dead-Letter-Queue and a background worker. Stats + DLQ + enqueue + run endpoints under /queue/*. |
| RES-OPS-9 | `alerting` | `ops/alerting.ts (ops_alert_rules + ops_alert_events) + email routing` | GAP-OPS-3 CLOSED: a durable alert-rule store (3 seeded defaults), a fired-event ledger, a signal evaluator, and notification routing (Zoho email + log). CRUD + evaluate endpoints under /alerts/*. |
| RES-OPS-10 | `ai_operations` | `ops/ai-token-accounting.ts (ops_ai_token_usage) + aiClient hook` | GAP-OPS-4 CLOSED: per-request prompt/completion token + cost (per-1k pricing) recorded fire-and-forget from aiClient and summarised at /ai/token-usage. |
| RES-OPS-11 | `logging` | `upload-proxy proxyReq correlation header + FastAPI correlation_id_mw` | GAP-OPS-5 CLOSED: the correlation id (req.id) is propagated Node→FastAPI (x-request-id/x-correlation-id, flag-gated) and echoed by the FastAPI service. An external distributed-tracing backend stays an honest infra boundary. |
| RES-OPS-12 | `observability` | `/version + /metrics endpoints` | GAP-OPS-6 CLOSED: a build/version-info endpoint (/version) and a machine-readable metrics endpoint (/metrics) are now present (flag-gated). |
| RES-OPS-13 | `disaster_recovery` | `config/disaster-recovery-manifest.ts + scripts/ops-dr-verify.ts + /dr/readiness` | GAP-OPS-7 CLOSED (readiness): an in-repo DR manifest (per-store RTO/RPO, backup mechanism, runbook refs), a readiness-verifier script and a /dr/readiness endpoint (config presence + live PostgreSQL connectivity). HONEST BOUNDARY: an actual restore DRILL + managed-DB backups remain infra-owned (restore_drill_executed:false) — recovery-READINESS, never a claimed executed restore. |
| RES-OPS-14 | `metrics` | `ops/metrics-registry.ts snapshotLatencyPercentiles + /metrics/latency` | Latency-percentile distribution CLOSED: p50/p95/p99 (aggregate + per-method) are estimated from the EXISTING capadex_http_request_duration_ms histogram via Prometheus histogram_quantile linear interpolation and surfaced at /api/operational-readiness/metrics/latency (flag-gated). Reuse-before-build: no new capture pipeline — it reads the histogram opsMetricsMiddleware already records. Percentiles are null until enough samples exist (p50≥2, p95≥20, p99≥100) so request-latency regressions are visible before users complain. null ≠ 0; histogram-bucket estimates, not exact quantiles (honest). |

_A reused mechanism means the observability substrate exists and is composed — NOT a claim of full adoption. Coverage ⟂ Adoption never composited._
