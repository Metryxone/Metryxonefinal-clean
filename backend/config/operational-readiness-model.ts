/**
 * CAPADEX 3.0 — Program 2 · Phase 2.5 Observability, Monitoring & Operational Readiness.
 *
 * The ONE canonical Operational Readiness Model. Pure data — NO engine, NO DDL, NO runtime.
 * The read-only composer `services/operational-readiness-engine.ts` verifies this registry's
 * `reuses` evidence against the LIVE filesystem + DB (by existence / persisted-output — engines
 * are NEVER invoked) and derives per-domain Coverage, a per-axis Certification score, gaps, and
 * a SEPARATE Adoption axis.
 *
 * Enhancement-only / measure-before-enhance / reuse-before-build. The phase adds NO new monitoring
 * system: it COMPOSES the existing observability substrate into ONE operational-readiness view and
 * certifies 10 SEPARATE operational axes that are NEVER combined:
 *   observability · monitoring · logging · metrics · alerting · ai_operations ·
 *   assessment_operations · report_operations · disaster_recovery · operational_readiness.
 *
 * Honesty: Coverage (evidence exists) ⟂ Confidence ⟂ Adoption (real non-demo volume) are SEPARATE
 * and never composited. null ≠ 0. A domain with no in-repo substrate is an honest DEAD_END/gap,
 * never fabricated.
 */

/** The 10 SEPARATE certification axes (spec FINAL CERTIFICATION — "Never combine these scores"). */
export const OPERATIONAL_AXES = [
  { key: 'observability', label: 'Observability', definition: 'Every critical service exposes a health/readiness/liveness/status signal that is measurable.' },
  { key: 'monitoring', label: 'Monitoring', definition: 'Live monitors compose service/runtime/background-job health into a continuous operational picture.' },
  { key: 'logging', label: 'Logging', definition: 'Structured logs carry request/correlation identity and mask sensitive data.' },
  { key: 'metrics', label: 'Metrics', definition: 'Latency/resource/AI/KPI signals are MEASURED (APM/export gaps reported as honest NULL).' },
  { key: 'alerting', label: 'Alerting', definition: 'Failure conditions are detectable; alert-rule/notification wiring is measured (not assumed).' },
  { key: 'ai_operations', label: 'AI Operations', definition: 'AI prompt/provider/model/latency/retry are observable (cost/token tracking reported honestly).' },
  { key: 'assessment_operations', label: 'Assessment Operations', definition: 'Assessment start/complete/abandon lifecycle is traceable from persisted session state.' },
  { key: 'report_operations', label: 'Report Operations', definition: 'Report request/generate/export/delivery is traceable from persisted report state.' },
  { key: 'disaster_recovery', label: 'Disaster Recovery', definition: 'Backup/restore/RTO/RPO validation (largely infra-owned — measured honestly, not assumed).' },
  { key: 'operational_readiness', label: 'Operational Readiness', definition: 'Operational dashboards + integration monitoring exist so the platform can be operated/supported.' },
] as const;

export type OperationalAxisKey = typeof OPERATIONAL_AXES[number]['key'];

/** A single operational domain: what the spec asks us to VALIDATE + the EXISTING evidence it reuses. */
export interface OperationalDomain {
  key: string;
  label: string;
  axis: OperationalAxisKey;
  category: string;
  /** What the spec's "VALIDATE …" section asks to observe for this domain. */
  signals: string[];
  /** EXISTING substrate this domain composes (verified vs live FS+DB; NEVER invoked). */
  reuses: { services: string[]; routes: string[]; frontend: string[]; tables: string[] };
  /** Adoption probe (real non-demo volume) — a SEPARATE axis, reported never composited. Null = not volume-measured. */
  adoptionTable?: string;
  /** Honest note about what is DEFERRED / not measurable in-repo (never fabricated). */
  note?: string;
}

export const OPERATIONAL_DOMAINS: OperationalDomain[] = [
  {
    key: 'service_observability',
    label: 'Service & API Observability',
    axis: 'observability',
    category: 'Endpoints',
    signals: ['Health Endpoint', 'Readiness Probe', 'Liveness Probe', 'Status Endpoint', 'Metrics Endpoint', 'Version Information'],
    reuses: {
      services: ['services/aiClient.ts', 'services/ops/metrics-registry.ts'],
      routes: ['routes/health-aggregator.ts', 'index.ts', 'routes/operational-readiness.ts'],
      frontend: [],
      tables: ['health_snapshots'],
    },
    note: 'Health (/api/health), readiness (/api/health/ready) + a 6-domain aggregator exist. GAP-OPS-6 CLOSED: /api/operational-readiness/version (build/node/env/commit/uptime) and /api/operational-readiness/metrics (Prometheus text exposition from the ops metrics registry) are now present (flag-gated).',
  },
  {
    key: 'monitoring_coverage',
    label: 'Monitoring Coverage',
    axis: 'monitoring',
    category: 'Monitors',
    signals: ['Service Failures', 'Runtime Health', 'Continuous Monitoring', 'Snapshot Trend'],
    reuses: {
      services: ['services/runtime-intelligence.ts', 'services/command-center/global-monitoring-engine.ts'],
      routes: ['routes/health-aggregator.ts'],
      frontend: [],
      tables: ['health_snapshots'],
    },
    adoptionTable: 'health_snapshots',
    note: 'Runtime Intelligence + the 6-domain health aggregator + global-monitoring compose a live picture. Trend/drift is snapshot-based (explicit capture) — with <2 snapshots, trend is honestly unavailable.',
  },
  {
    key: 'background_jobs',
    label: 'Background Jobs & Queue',
    axis: 'monitoring',
    category: 'Async',
    signals: ['Execution Status', 'Retry Count', 'Failure Reason', 'Processing Time', 'Queue Monitoring', 'Dead Letter Queue'],
    reuses: {
      services: ['services/adaptive-event-bus.ts', 'services/ops/durable-queue.ts'],
      routes: ['routes/operational-readiness.ts'],
      frontend: [],
      tables: [],
    },
    adoptionTable: 'ops_job_queue',
    note: 'GAP-OPS-2 CLOSED: a durable job queue (ops_job_queue) with FOR UPDATE SKIP LOCKED claim, per-job attempt/retry/backoff, processing_ms timing, a Dead-Letter-Queue (ops_job_dead_letter) and a background worker are now present (flag-gated). Real job volume is a SEPARATE Adoption axis (honest-low/0 in dev, ops_* tables created lazily on first flag-ON write).',
  },
  {
    key: 'logging_traceability',
    label: 'Logging & Traceability',
    axis: 'logging',
    category: 'Logs',
    signals: ['Structured Logs', 'Request IDs', 'Correlation IDs', 'Log Levels', 'Sensitive Data Masking', 'Audit Trail'],
    reuses: {
      services: ['services/security-middleware.ts'],
      routes: ['index.ts', 'lib/redact.ts', 'routes.ts'],
      frontend: [],
      tables: ['admin_audit_logs'],
    },
    note: 'A levelled logger (debug/warn/error), a per-request requestId, redaction-at-write, and a redacted admin audit trail exist. GAP-OPS-5 CLOSED: the correlation id is now propagated Node→FastAPI (upload proxy injects x-request-id/x-correlation-id, gated; FastAPI echoes it). A full external distributed-tracing backend (APM vendor) remains infra-owned — reported honestly, not fabricated.',
  },
  {
    key: 'metrics_coverage',
    label: 'Metrics Coverage',
    axis: 'metrics',
    category: 'Metrics',
    signals: ['API/DB Latency', 'Event-loop Lag', 'Memory/CPU', 'AI Runtime', 'KPI Rollup'],
    reuses: {
      services: ['services/runtime-intelligence.ts', 'services/intelligence-observability-engine.ts', 'services/ops/metrics-registry.ts'],
      routes: ['routes/operational-readiness.ts'],
      frontend: [],
      tables: ['ai_runtime_monitoring', 'orchestration_performance_logs', 'anl_kpi_daily'],
    },
    adoptionTable: 'anl_kpi_daily',
    note: 'DB latency, event-loop lag, process/OS memory + CPU, AI-runtime rows and a KPI daily rollup are MEASURED. GAP-OPS-1 CLOSED: an in-process metrics registry (counters + latency histograms) fed by opsMetricsMiddleware now records API-throughput/error-rate + cache hit/miss and exports them as Prometheus text at /api/operational-readiness/metrics. An external APM/aggregation backend remains infra-owned (honest boundary, not fabricated).',
  },
  {
    key: 'alerting',
    label: 'Alerting',
    axis: 'alerting',
    category: 'Alerts',
    signals: ['Service Failures', 'DB Failures', 'AI Failures', 'Security Events', 'Alert Rules', 'Notification Routing'],
    reuses: {
      services: ['services/command-center/global-monitoring-engine.ts', 'services/ops/alerting.ts', 'email.ts'],
      routes: ['routes/health-aggregator.ts', 'routes/operational-readiness.ts'],
      frontend: [],
      tables: [],
    },
    adoptionTable: 'ops_alert_events',
    note: 'GAP-OPS-3 CLOSED: a durable alert-RULE store (ops_alert_rules, seeded with 3 default rules) + a fired-event ledger (ops_alert_events) + a rule evaluator over live signals + notification routing (Zoho email via sendOperationalAlertEmail; log channel) are now present (flag-gated). Real fired-event volume is a SEPARATE Adoption axis (honest-low/0 in dev).',
  },
  {
    key: 'ai_operations',
    label: 'AI Operations',
    axis: 'ai_operations',
    category: 'AI',
    signals: ['Provider', 'Model', 'Latency', 'Retry Behaviour', 'Failure Analysis', 'Confidence', 'Cost', 'Token Usage'],
    reuses: {
      services: ['services/aiClient.ts', 'services/intelligence-observability-engine.ts', 'services/ops/ai-token-accounting.ts'],
      routes: ['routes/operational-readiness.ts'],
      frontend: [],
      tables: ['ai_runtime_monitoring'],
    },
    adoptionTable: 'ai_runtime_monitoring',
    note: 'AI health (checkAIHealth), provider/model, latency and retry behaviour are observable + persisted to ai_runtime_monitoring. GAP-OPS-4 CLOSED: per-request TOKEN + COST accounting (prompt/completion tokens × per-1k pricing) is now recorded fire-and-forget from aiClient into ops_ai_token_usage and summarised at /api/operational-readiness/ai/token-usage. Real token volume is a SEPARATE Adoption axis (honest-low/0 in dev).',
  },
  {
    key: 'assessment_operations',
    label: 'Assessment Operations',
    axis: 'assessment_operations',
    category: 'Assessment',
    signals: ['Assessment Started', 'Assessment Completed', 'Assessment Abandoned', 'Progress Tracking', 'Completion Rate'],
    reuses: {
      services: [],
      routes: ['routes/capadex.ts'],
      frontend: [],
      tables: ['capadex_sessions'],
    },
    adoptionTable: 'capadex_sessions',
    note: 'Assessment lifecycle (in_progress/completed) is persisted in capadex_sessions and is fully traceable. Explicit per-question/section TIMING telemetry is partial. Completion rate is derivable at read-time; reported as Coverage, with real volume as a SEPARATE Adoption axis.',
  },
  {
    key: 'report_operations',
    label: 'Report Operations',
    axis: 'report_operations',
    category: 'Reports',
    signals: ['Report Requested', 'Report Generated', 'Generation Time', 'PDF Export', 'Email Delivery', 'Sharing'],
    reuses: {
      services: ['services/report-pack.ts'],
      routes: ['routes/capadex.ts'],
      frontend: [],
      tables: ['capadex_reports'],
    },
    adoptionTable: 'capadex_reports',
    note: 'Report generation + a report-pack builder + Zoho email delivery exist; report state is persisted in capadex_reports. Explicit generation-TIME + download-status telemetry is partial — honest Coverage, real volume as a SEPARATE Adoption axis.',
  },
  {
    key: 'integrations',
    label: 'Integration Monitoring',
    axis: 'operational_readiness',
    category: 'External',
    signals: ['External API Health', 'Timeout Monitoring', 'Retry Logic', 'Circuit Breakers', 'Rate Limits'],
    reuses: {
      services: ['services/aiClient.ts', 'services/capadex-safety-breaker.ts', 'email.ts'],
      routes: ['index.ts'],
      frontend: [],
      tables: [],
    },
    note: 'External-AI health (checkAIHealth), a safety circuit-breaker, Zoho email and Razorpay payment integration exist. A unified integration-health dashboard with per-integration auth-status + timeout + rate-limit telemetry is partial — honest gap.',
  },
  {
    key: 'disaster_recovery',
    label: 'Disaster Recovery',
    axis: 'disaster_recovery',
    category: 'DR',
    signals: ['Backup Status', 'Restore Validation', 'Recovery Procedures', 'Data Integrity', 'RTO', 'RPO'],
    reuses: {
      services: ['config/disaster-recovery-manifest.ts', 'scripts/ops-dr-verify.ts'],
      routes: ['routes/operational-readiness.ts'],
      frontend: [],
      tables: [],
    },
    note: 'GAP-OPS-7 CLOSED (readiness, not a live drill): an in-repo DR manifest (per-store RTO/RPO targets, backup mechanism, recovery-procedure runbook references — docs/DISASTER_RECOVERY.md), a repeatable readiness-verifier script (scripts/ops-dr-verify.ts) and a /api/operational-readiness/dr/readiness endpoint (config presence + live PostgreSQL connectivity checks) are now present. HONEST BOUNDARY: managed-DB backups + an actual restore DRILL against infrastructure remain infra-owned and are reported as recovery-READINESS, never claimed as an executed/validated restore (restore_drill_executed:false). Coverage ⟂ Confidence ⟂ Adoption never composited.',
  },
  {
    key: 'operational_dashboards',
    label: 'Operational Dashboards',
    axis: 'operational_readiness',
    category: 'Dashboards',
    signals: ['Executive Dashboard', 'Operations Dashboard', 'Support Dashboard', 'AI Dashboard', 'Assessment Dashboard', 'Security Dashboard', 'Infrastructure Dashboard'],
    reuses: {
      services: [],
      routes: ['routes/health-aggregator.ts'],
      frontend: ['src/components/SuperAdminDashboard.tsx'],
      tables: [],
    },
    note: 'A super-admin console + a live 6-domain health view + mission-control aggregators provide operations/AI/assessment/security surfaces. Dedicated executive + infrastructure operational dashboards are partial — honest Coverage.',
  },
];

/** Deliberate operational decisions (recorded so the certification is auditable, not implied). */
export const OPERATIONAL_DECISIONS = [
  { key: 'no_new_monitoring_system', decision: 'COMPOSE the existing observability substrate into ONE read-only operational-readiness view. The gap-closure mechanisms (metrics registry, durable queue, alert store, token accounting, correlation-ID, DR manifest) are additive and flag-gated — NO parallel/duplicate monitoring engine or telemetry pipeline replaces the existing substrate.' },
  { key: 'gaps_closed_additively', decision: 'All 7 previously-classified operational gaps (GAP-OPS-1..7) are now CLOSED with REAL working mechanisms (metrics export, durable queue + DLQ, alert-rule store + notification routing, AI token/cost accounting, Node→FastAPI correlation-ID, /version + /metrics, DR manifest + readiness verifier). Every mechanism is additive and flag-gated behind operationalReadiness → flag OFF is byte-identical incl. schema (ops_* tables created lazily on first flag-ON write). Nothing fabricated: DR is recovery-READINESS not an executed restore drill; an external APM/tracing backend and managed-DB backups remain honest infra-owned boundaries.' },
  { key: 'axes_never_composited', decision: 'The 10 operational axes are certified SEPARATELY and are NEVER combined into a single number. The overall verdict is a SEPARATE structural axis, not an average.' },
  { key: 'coverage_vs_adoption', decision: 'Coverage (evidence exists) is reported separately from Adoption (real non-demo volume) and Confidence. Engineering closure of the 7 gaps is STRUCTURAL — real operational volume (jobs run, alerts fired, tokens spent, restore drills) is honest-low/0 in a dev environment — a usage/confidence axis, NEVER a gap and NEVER composited into coverage.' },
];

/** Classified OPEN operational gaps (severity: Launch-Critical | High | Medium | Low | Future). Honest findings, never fabricated. ALL 7 CLOSED — see RESOLVED_OPERATIONAL_GAPS. */
export const OPERATIONAL_GAPS: Array<{ key: string; severity: string; axis: OperationalAxisKey; title: string; detail: string }> = [];

/** Operational mechanisms REUSED (pre-existing substrate) + the 7 gaps CLOSED by REAL working mechanisms in this phase. Traceability that observability EXISTS — a SEPARATE axis from real Adoption volume. */
export const RESOLVED_OPERATIONAL_GAPS = [
  // Pre-existing substrate composed here (no new engine).
  { key: 'RES-OPS-1', axis: 'observability', mechanism: 'health-aggregator.computeAllHealthDomains', detail: 'A 6-domain live health monitor + /api/health + /api/health/ready + snapshot history already exist and are composed here (no new health engine).' },
  { key: 'RES-OPS-2', axis: 'monitoring', mechanism: 'runtime-intelligence + global-monitoring-engine', detail: 'Live runtime/resource/service monitoring + command-center global-monitoring already exist and are composed here.' },
  { key: 'RES-OPS-3', axis: 'logging', mechanism: 'requestId + lib/redact + admin_audit_logs', detail: 'Per-request identity, redaction-at-write, and a redacted audit trail already exist and are composed here.' },
  { key: 'RES-OPS-4', axis: 'metrics', mechanism: 'intelligence-observability-engine + anl_kpi_daily', detail: 'AI-runtime + orchestration-performance persistence + a KPI daily rollup already exist and are measured here.' },
  { key: 'RES-OPS-5', axis: 'ai_operations', mechanism: 'aiClient.checkAIHealth + ai_runtime_monitoring', detail: 'External-AI health probe + AI-runtime persistence already exist and are composed here.' },
  { key: 'RES-OPS-6', axis: 'operational_readiness', mechanism: 'capadex-safety-breaker + SuperAdminDashboard', detail: 'A circuit-breaker for external calls + a super-admin operational console already exist and are composed here.' },
  // The 7 previously-OPEN gaps, now CLOSED with real working mechanisms (additive + flag-gated).
  { key: 'RES-OPS-7', axis: 'metrics', former_gap: 'GAP-OPS-1', mechanism: 'ops/metrics-registry.ts + opsMetricsMiddleware + /metrics', detail: 'GAP-OPS-1 CLOSED: an in-process metrics registry (request counters + latency histograms + cache hit/miss) is recorded by opsMetricsMiddleware and exported as Prometheus text at /api/operational-readiness/metrics (+ JSON at /metrics.json). External APM aggregation stays an honest infra boundary.' },
  { key: 'RES-OPS-8', axis: 'monitoring', former_gap: 'GAP-OPS-2', mechanism: 'ops/durable-queue.ts (ops_job_queue + ops_job_dead_letter)', detail: 'GAP-OPS-2 CLOSED: a durable job queue with FOR UPDATE SKIP LOCKED claim, per-job attempt/retry/backoff, processing_ms timing, a Dead-Letter-Queue and a background worker. Stats + DLQ + enqueue + run endpoints under /queue/*.' },
  { key: 'RES-OPS-9', axis: 'alerting', former_gap: 'GAP-OPS-3', mechanism: 'ops/alerting.ts (ops_alert_rules + ops_alert_events) + email routing', detail: 'GAP-OPS-3 CLOSED: a durable alert-rule store (3 seeded defaults), a fired-event ledger, a signal evaluator, and notification routing (Zoho email + log). CRUD + evaluate endpoints under /alerts/*.' },
  { key: 'RES-OPS-10', axis: 'ai_operations', former_gap: 'GAP-OPS-4', mechanism: 'ops/ai-token-accounting.ts (ops_ai_token_usage) + aiClient hook', detail: 'GAP-OPS-4 CLOSED: per-request prompt/completion token + cost (per-1k pricing) recorded fire-and-forget from aiClient and summarised at /ai/token-usage.' },
  { key: 'RES-OPS-11', axis: 'logging', former_gap: 'GAP-OPS-5', mechanism: 'upload-proxy proxyReq correlation header + FastAPI correlation_id_mw', detail: 'GAP-OPS-5 CLOSED: the correlation id (req.id) is propagated Node→FastAPI (x-request-id/x-correlation-id, flag-gated) and echoed by the FastAPI service. An external distributed-tracing backend stays an honest infra boundary.' },
  { key: 'RES-OPS-12', axis: 'observability', former_gap: 'GAP-OPS-6', mechanism: '/version + /metrics endpoints', detail: 'GAP-OPS-6 CLOSED: a build/version-info endpoint (/version) and a machine-readable metrics endpoint (/metrics) are now present (flag-gated).' },
  { key: 'RES-OPS-13', axis: 'disaster_recovery', former_gap: 'GAP-OPS-7', mechanism: 'config/disaster-recovery-manifest.ts + scripts/ops-dr-verify.ts + /dr/readiness', detail: 'GAP-OPS-7 CLOSED (readiness): an in-repo DR manifest (per-store RTO/RPO, backup mechanism, runbook refs), a readiness-verifier script and a /dr/readiness endpoint (config presence + live PostgreSQL connectivity). HONEST BOUNDARY: an actual restore DRILL + managed-DB backups remain infra-owned (restore_drill_executed:false) — recovery-READINESS, never a claimed executed restore.' },
];

export const OPERATIONAL_MODEL_META = {
  phase: 'CAPADEX 3.0 · Program 2 · Phase 2.5 — Observability, Monitoring & Operational Readiness',
  flag: 'operationalReadiness',
  env: 'FF_OPERATIONAL_READINESS',
  axis_count: OPERATIONAL_AXES.length,
  domain_count: OPERATIONAL_DOMAINS.length,
  honesty: 'Coverage ⟂ Confidence ⟂ Adoption are SEPARATE and NEVER composited. The 10 operational axes are certified independently and never combined. null ≠ 0. Structural coverage is not a runtime/quality/adoption claim. Built ≠ Operated ≠ Recoverable.',
};
