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
      services: ['services/aiClient.ts'],
      routes: ['routes/health-aggregator.ts', 'index.ts'],
      frontend: [],
      tables: ['health_snapshots'],
    },
    note: 'Health (/api/health), readiness (/api/health/ready) + a 6-domain aggregator exist. A dedicated /metrics export endpoint and a /version endpoint are NOT present — honest gaps, not fabricated.',
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
      services: ['services/adaptive-event-bus.ts'],
      routes: [],
      frontend: [],
      tables: [],
    },
    note: 'An in-process fire-and-forget event bus exists. A durable queue, a Dead-Letter-Queue, and per-job retry/failure persistence are NOT present — honest gaps (a durable-queue/DLQ is a Medium operational gap, never fabricated).',
  },
  {
    key: 'logging_traceability',
    label: 'Logging & Traceability',
    axis: 'logging',
    category: 'Logs',
    signals: ['Structured Logs', 'Request IDs', 'Correlation IDs', 'Log Levels', 'Sensitive Data Masking', 'Audit Trail'],
    reuses: {
      services: ['services/security-middleware.ts'],
      routes: ['index.ts', 'lib/redact.ts'],
      frontend: [],
      tables: ['admin_audit_logs'],
    },
    note: 'A levelled logger (debug/warn/error), a per-request requestId, redaction-at-write, and a redacted admin audit trail exist. Distributed trace-IDs propagated Node→FastAPI and a structured-log pipeline (APM) are NOT present — honest gaps.',
  },
  {
    key: 'metrics_coverage',
    label: 'Metrics Coverage',
    axis: 'metrics',
    category: 'Metrics',
    signals: ['API/DB Latency', 'Event-loop Lag', 'Memory/CPU', 'AI Runtime', 'KPI Rollup'],
    reuses: {
      services: ['services/runtime-intelligence.ts', 'services/intelligence-observability-engine.ts'],
      routes: [],
      frontend: [],
      tables: ['ai_runtime_monitoring', 'orchestration_performance_logs', 'anl_kpi_daily'],
    },
    adoptionTable: 'anl_kpi_daily',
    note: 'DB latency, event-loop lag, process/OS memory + CPU, AI-runtime rows and a KPI daily rollup are MEASURED. A metrics-export endpoint (Prometheus/statsd) + API-throughput/error-rate counters + cache-hit ratio are NOT present — honest NULL (DEFERRED), never estimated.',
  },
  {
    key: 'alerting',
    label: 'Alerting',
    axis: 'alerting',
    category: 'Alerts',
    signals: ['Service Failures', 'DB Failures', 'AI Failures', 'Security Events', 'Alert Rules', 'Notification Routing'],
    reuses: {
      services: ['services/command-center/global-monitoring-engine.ts'],
      routes: ['routes/health-aggregator.ts'],
      frontend: [],
      tables: [],
    },
    note: 'Failure CONDITIONS are detectable (health domains report down/degraded; global-monitoring derives status). A durable alert-RULE store + notification routing (email/pager/webhook) are NOT present — alerts are client-derived from status, not pushed. Honest Medium gap.',
  },
  {
    key: 'ai_operations',
    label: 'AI Operations',
    axis: 'ai_operations',
    category: 'AI',
    signals: ['Provider', 'Model', 'Latency', 'Retry Behaviour', 'Failure Analysis', 'Confidence', 'Cost', 'Token Usage'],
    reuses: {
      services: ['services/aiClient.ts', 'services/intelligence-observability-engine.ts'],
      routes: [],
      frontend: [],
      tables: ['ai_runtime_monitoring'],
    },
    adoptionTable: 'ai_runtime_monitoring',
    note: 'AI health (checkAIHealth), provider/model, latency and retry behaviour are observable + persisted to ai_runtime_monitoring. Per-request COST and TOKEN accounting are NOT tracked — honest gap (never fabricated as 0).',
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
      services: [],
      routes: [],
      frontend: [],
      tables: [],
    },
    note: 'Managed-database backups are infra-owned (Cloud SQL / provider), NOT validated in-repo. Restore drills, documented recovery procedures, and measured RTO/RPO are NOT present in the repository — reported as an honest DEAD_END/gap (infra-owned), never fabricated as validated.',
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
  { key: 'no_new_monitoring_system', decision: 'COMPOSE the existing observability substrate into ONE read-only operational-readiness view. NO parallel/duplicate monitoring engine, telemetry pipeline, or metadata store was created.' },
  { key: 'measure_before_enhance', decision: 'This phase MEASURES operational coverage and CLASSIFIES gaps. Deeper enhancements (DLQ, token/cost accounting, metrics export, alert-rule store, DR drills) are recorded as classified gaps for a future task — NOT built here, to preserve byte-identical-OFF and avoid business/infra change.' },
  { key: 'axes_never_composited', decision: 'The 10 operational axes are certified SEPARATELY and are NEVER combined into a single number. The overall verdict is a SEPARATE structural axis, not an average.' },
  { key: 'coverage_vs_adoption', decision: 'Coverage (evidence exists) is reported separately from Adoption (real non-demo volume). Real operational volume is honest-low/0 in a dev environment — a usage axis, never a gap.' },
];

/** Classified OPEN operational gaps (severity: Launch-Critical | High | Medium | Low | Future). Honest findings, never fabricated. */
export const OPERATIONAL_GAPS = [
  { key: 'GAP-OPS-1', severity: 'Medium', axis: 'metrics', title: 'No metrics-export endpoint / APM pipeline', detail: 'API throughput/error-rate counters, cache-hit ratio and a Prometheus/statsd export are absent. Latency/resource/AI/KPI signals ARE measured; the missing piece is external export/aggregation. Deferred (infra-owned).' },
  { key: 'GAP-OPS-2', severity: 'Medium', axis: 'monitoring', title: 'No durable queue / Dead-Letter-Queue for background jobs', detail: 'The event bus is in-process fire-and-forget with no persisted retry/DLQ. Failed async work is not durably tracked. A durable queue + DLQ is a Medium operational enhancement for a future task.' },
  { key: 'GAP-OPS-3', severity: 'Medium', axis: 'alerting', title: 'No alert-rule store / notification routing', detail: 'Failure conditions are detectable but alerts are client-derived from status, not pushed via a durable rule store + notification channel. Medium operational gap.' },
  { key: 'GAP-OPS-4', severity: 'Medium', axis: 'ai_operations', title: 'No AI cost / token accounting', detail: 'AI latency/retry/health/provider/model are observable but per-request cost and token usage are not tracked. Medium gap; never fabricated as 0.' },
  { key: 'GAP-OPS-5', severity: 'Low', axis: 'logging', title: 'No cross-service correlation-ID propagation (Node→FastAPI) / distributed tracing', detail: 'A per-request requestId exists on the Node service but is not propagated to the FastAPI upload service, and there is no distributed-tracing backend. Low/Medium gap.' },
  { key: 'GAP-OPS-6', severity: 'Low', axis: 'observability', title: 'No /version and no /metrics endpoint', detail: 'Health + readiness exist; a build/version-info endpoint and a machine-readable metrics endpoint are absent. Low gap.' },
  { key: 'GAP-OPS-7', severity: 'Future', axis: 'disaster_recovery', title: 'Disaster-recovery validation is infra-owned, not validated in-repo', detail: 'Managed-DB backups exist at the infra layer but restore drills, documented recovery procedures and measured RTO/RPO are not present in the repository. Future/infra gap — reported honestly, never claimed as validated.' },
];

/** Operational mechanisms already REUSED (traceability that observability substrate EXISTS — not a claim of full adoption). */
export const RESOLVED_OPERATIONAL_GAPS = [
  { key: 'RES-OPS-1', axis: 'observability', mechanism: 'health-aggregator.computeAllHealthDomains', detail: 'A 6-domain live health monitor + /api/health + /api/health/ready + snapshot history already exist and are composed here (no new health engine).' },
  { key: 'RES-OPS-2', axis: 'monitoring', mechanism: 'runtime-intelligence + global-monitoring-engine', detail: 'Live runtime/resource/service monitoring + command-center global-monitoring already exist and are composed here.' },
  { key: 'RES-OPS-3', axis: 'logging', mechanism: 'requestId + lib/redact + admin_audit_logs', detail: 'Per-request identity, redaction-at-write, and a redacted audit trail already exist and are composed here.' },
  { key: 'RES-OPS-4', axis: 'metrics', mechanism: 'intelligence-observability-engine + anl_kpi_daily', detail: 'AI-runtime + orchestration-performance persistence + a KPI daily rollup already exist and are measured here.' },
  { key: 'RES-OPS-5', axis: 'ai_operations', mechanism: 'aiClient.checkAIHealth + ai_runtime_monitoring', detail: 'External-AI health probe + AI-runtime persistence already exist and are composed here.' },
  { key: 'RES-OPS-6', axis: 'operational_readiness', mechanism: 'capadex-safety-breaker + SuperAdminDashboard', detail: 'A circuit-breaker for external calls + a super-admin operational console already exist and are composed here.' },
];

export const OPERATIONAL_MODEL_META = {
  phase: 'CAPADEX 3.0 · Program 2 · Phase 2.5 — Observability, Monitoring & Operational Readiness',
  flag: 'operationalReadiness',
  env: 'FF_OPERATIONAL_READINESS',
  axis_count: OPERATIONAL_AXES.length,
  domain_count: OPERATIONAL_DOMAINS.length,
  honesty: 'Coverage ⟂ Confidence ⟂ Adoption are SEPARATE and NEVER composited. The 10 operational axes are certified independently and never combined. null ≠ 0. Structural coverage is not a runtime/quality/adoption claim. Built ≠ Operated ≠ Recoverable.',
};
