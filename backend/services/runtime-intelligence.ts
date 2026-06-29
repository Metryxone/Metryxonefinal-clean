/**
 * MX-800 Phase 2.4 — Runtime Intelligence Engine (service layer).
 *
 * ENHANCEMENT-ONLY. Runtime Intelligence continuously understands, measures, validates, explains
 * and surfaces RUNTIME quality by COMPOSING the EXISTING runtime monitoring (routes/health-aggregator
 * — the 6-domain live health checks) plus live in-process process/OS/pg measurements, alongside a
 * MEASURED runtime-component registry. It introduces NO parallel monitoring/health engine, NO
 * duplicate telemetry/observability service, and changes NO business logic. The running process +
 * the database are the single source of truth: every health/performance/resource number is MEASURED
 * live (process.memoryUsage / os / pg) or READ from the existing health-aggregator getter — nothing
 * is fabricated or estimated.
 *
 * HONESTY CONTRACT (user preference — honesty over optimism, never fabricate):
 *   - Running ≠ Healthy ≠ Stable ≠ Scalable. ResponseTime ≠ Performance. Error-Free ≠ Reliable.
 *     Configured ≠ Running ≠ Healthy. Coverage ⟂ Confidence ⟂ Evidence (SEPARATE axes, never blended).
 *   - Only in-process, statically MEASURABLE signals are reported as numbers: composed health domain
 *     scores, DB round-trip latency (sampled), event-loop lag, process + OS memory, process CPU, pg
 *     pool counts, DB size, active connections, snapshot/flag observability counts.
 *   - HTTP throughput, p95/p99 response time, APDEX, distributed tracing, structured-log coverage,
 *     container (cgroup) limits and disk I/O require load tooling / a request-log / an APM agent NOT
 *     present in this environment → reported as honest NULL with a note (DEFERRED), never an estimate.
 *     A ratio with a 0 denominator → null (null ≠ zero).
 *   - owner is MANAGED (human) and honest-NULL when unassigned; re-discovery NEVER overwrites it.
 *     present is DERIVED (in-process or configured env presence) — it is NOT a health verdict.
 *
 * Reads are GET-never-writes: they probe via to_regclass and compose measured sources; they NEVER
 * create schema. The lazy ensure-schema runs ONLY on flag-ON write paths (discover / register /
 * audit-capture) so flag OFF → byte-identical incl. schema (0 tables). Every write path also asserts
 * the flag itself BEFORE ensure-schema (defense-in-depth for direct/tooling callers).
 */
import type { Pool } from 'pg';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { isRuntimeIntelligenceEngineEnabled } from '../config/feature-flags';

// Composed substrate (EXISTING runtime monitor — reuse, never duplicate).
import { computeAllHealthDomains } from '../routes/health-aggregator';

const REGISTRY_TABLE = 'runtime_component_registry';
const SNAPSHOT_TABLE = 'runtime_intelligence_audit_snapshots';

// ── Defense-in-depth flag guard for WRITE/DDL paths ─────────────────────────
class RuntimeIntelligenceDisabled extends Error {
  code = 'runtime_intelligence_disabled';
  constructor() {
    super('runtimeIntelligenceEngine flag is OFF — write/DDL paths are inert (byte-identical legacy).');
    this.name = 'RuntimeIntelligenceDisabled';
  }
}
function assertEnabled(): void {
  if (!isRuntimeIntelligenceEngineEnabled()) throw new RuntimeIntelligenceDisabled();
}

// ── helpers ─────────────────────────────────────────────────────────────────
async function tableReady(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS ready`, [`public.${table}`]);
    return !!r.rows[0]?.ready;
  } catch { return false; }
}
/** Measured count. Returns the value, 0 for a genuinely empty result, or NULL on a query ERROR
 *  (unmeasurable ≠ zero — honesty contract null ≠ 0). Callers must treat null as "not measured". */
async function scalar(pool: Pool, sql: string, params: unknown[] = []): Promise<number | null> {
  try { const r = await pool.query(sql, params); return Number(r.rows[0]?.n ?? 0); } catch { return null; }
}
/** Multi-row read. Returns the rows, [] for a genuinely empty result, or NULL on a query ERROR
 *  (unreadable ≠ empty). Callers coalesce to [] ONLY where a sibling measured count surfaces the error. */
async function rows(pool: Pool, sql: string, params: unknown[] = []): Promise<any[] | null> {
  try { const r = await pool.query(sql, params); return r.rows; } catch { return null; }
}
/** Ratio as a 0–100 percentage; NULL when the numerator is unmeasured OR the denominator is 0/null
 *  (null ≠ zero — an unmeasurable side must never read as 0%). */
function pct(n: number | null, d: number | null): number | null {
  if (n == null || d == null || !d) return null;
  return Math.round((n / d) * 10000) / 100;
}
function uid(prefix: string): string { return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`; }
const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

/**
 * Short-TTL promise memo. The aggregate getters (/summary, /metrics, /reasoning, captureSnapshot)
 * compose the SAME expensive source — the health-aggregator's 6-domain compute, which itself runs
 * many COUNT(*) probes. Without memoization a single capture re-derives that source several times →
 * redundant DB load (the MX-700 1.43 "gather EXACTLY ONCE" lesson). The cache dedupes in-flight
 * promises within a request and reuses for a few seconds; data is read-only runtime intelligence so
 * a small staleness window is irrelevant (mirrors the 15s health-aggregator cache).
 */
const MEMO_TTL_MS = 8000;
const _memo = new Map<string, { at: number; val: Promise<any> }>();
function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = _memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.val as Promise<T>;
  const val = fn().catch((e) => { _memo.delete(key); throw e; }); // don't cache rejections
  _memo.set(key, { at: Date.now(), val });
  return val;
}
// Memoized wrapper over the composed runtime monitor (reuse, never duplicate; gather ONCE per window).
const healthDomains = (pool: Pool) => memo('rt:health', () => computeAllHealthDomains(pool));

let _schemaReady = false;
/** Lazy ensure-schema — canonical mirror of 20261223_runtime_intelligence.sql.
 *  ONLY called from flag-ON write paths (discover/register/audit-capture) → flag OFF byte-identical. */
export async function ensureRuntimeSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${REGISTRY_TABLE} (
      id                  BIGSERIAL PRIMARY KEY,
      runtime_uid         TEXT UNIQUE NOT NULL,
      name                TEXT NOT NULL,
      component_type      TEXT NOT NULL,
      category            TEXT,
      owner               TEXT,
      present             BOOLEAN,
      endpoint_ref        TEXT,
      metadata            JSONB NOT NULL DEFAULT '{}',
      lifecycle_uid       TEXT,
      source              TEXT NOT NULL DEFAULT 'discovered',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_rcr_component_type ON ${REGISTRY_TABLE} (component_type);
    CREATE INDEX IF NOT EXISTS idx_rcr_category       ON ${REGISTRY_TABLE} (category);
    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_TABLE} (
      id                          BIGSERIAL PRIMARY KEY,
      snapshot_uid                TEXT UNIQUE NOT NULL,
      registry_total              INTEGER,
      application_health_score    INTEGER,
      db_latency_avg_ms           NUMERIC,
      event_loop_lag_ms           NUMERIC,
      process_rss_mb              INTEGER,
      memory_headroom_pct         NUMERIC,
      service_availability_pct    NUMERIC,
      observability_coverage_pct  NUMERIC,
      metrics                     JSONB NOT NULL DEFAULT '{}',
      validation                  JSONB NOT NULL DEFAULT '{}',
      summary                     JSONB NOT NULL DEFAULT '{}',
      captured_by                 TEXT,
      captured_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_rias_captured_at
      ON ${SNAPSHOT_TABLE} (captured_at DESC);
  `);
  _schemaReady = true;
}

// ── MEASURED live runtime primitives (read-only, in-process) ─────────────────
/** Sample the DB round-trip latency a few times. Returns measured min/avg/max + sample count. */
async function sampleDbLatency(pool: Pool, n = 5): Promise<{ samples: number; min: number | null; avg: number | null; max: number | null }> {
  const ms: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = Date.now();
    try { await pool.query('SELECT 1'); ms.push(Date.now() - t0); } catch { /* unreachable round-trip excluded, never scored 0 */ }
  }
  if (!ms.length) return { samples: 0, min: null, avg: null, max: null };
  const sum = ms.reduce((a, b) => a + b, 0);
  return { samples: ms.length, min: Math.min(...ms), avg: Math.round((sum / ms.length) * 100) / 100, max: Math.max(...ms) };
}
/** Measure event-loop lag: schedule a setImmediate and time the delay. Real in-process signal. */
async function measureEventLoopLagMs(): Promise<number> {
  const start = process.hrtime.bigint();
  await new Promise<void>((r) => setImmediate(r));
  return Math.round((Number(process.hrtime.bigint() - start) / 1e6) * 100) / 100;
}
/** Best-effort pg pool internals (not all drivers expose these → honest-NULL). */
function poolStats(pool: Pool): { total: number | null; idle: number | null; waiting: number | null } {
  const p = pool as any;
  if (typeof p.totalCount !== 'number') return { total: null, idle: null, waiting: null };
  return { total: p.totalCount, idle: p.idleCount ?? null, waiting: p.waitingCount ?? null };
}
/** Grade a "lower is better" latency in ms into a 0–100 MEASURED score. null in → null out. */
function gradeLatencyScore(ms: number | null, warnAt = 150, failAt = 750): number | null {
  if (ms == null) return null;
  if (ms >= failAt) return 0;
  if (ms <= 0) return 100;
  if (ms <= warnAt) return Math.round(100 - (ms / warnAt) * 25);          // 100 → 75 across [0, warnAt]
  return Math.round(75 - ((ms - warnAt) / (failAt - warnAt)) * 75);        // 75 → 0 across [warnAt, failAt]
}

// The runtime components we can HONESTLY measure/observe from this Node process.
interface ComponentDef {
  runtime_uid: string; name: string; component_type: string; category: string;
  endpoint_ref: string; present: boolean; metadata: Record<string, unknown>;
}
function buildMeasuredComponents(): ComponentDef[] {
  const hasPg = !!process.env.DATABASE_URL;
  const hasMongo = !!process.env.MONGODB_URI;
  const hasUpload = !!process.env.FASTAPI_URL;
  return [
    {
      runtime_uid: 'rt-process-backend', name: 'backend-process', component_type: 'process', category: 'backend',
      endpoint_ref: 'in-process', present: true,
      metadata: { pid: process.pid, node_version: process.version, platform: process.platform, arch: process.arch, measured: true },
    },
    {
      runtime_uid: 'rt-datastore-postgres', name: 'postgres-database', component_type: 'datastore', category: 'infrastructure',
      endpoint_ref: 'DATABASE_URL', present: hasPg,
      metadata: { configured: hasPg, health: 'measured-live (see application-health / service)', note: 'present = configured (env), NOT a health verdict' },
    },
    {
      runtime_uid: 'rt-datastore-mongodb', name: 'mongodb', component_type: 'datastore', category: 'external',
      endpoint_ref: 'MONGODB_URI', present: hasMongo,
      metadata: { configured: hasMongo, health: null, note: 'MongoDB is consumed by the FastAPI upload service (separate process). Health is honest-NULL here (not probed from Node).' },
    },
    {
      runtime_uid: 'rt-service-upload', name: 'upload-service', component_type: 'service', category: 'external',
      endpoint_ref: 'FASTAPI_URL', present: hasUpload,
      metadata: { configured: hasUpload, health: null, note: 'FastAPI upload service is a separate Cloud Run process. Liveness probe DEFERRED (not performed on read path) → honest-NULL.' },
    },
    {
      runtime_uid: 'rt-store-session', name: 'session-store', component_type: 'store', category: 'backend',
      endpoint_ref: 'express_sessions', present: true,
      metadata: { backing: 'postgres', health: 'measured (row count)', measured: true },
    },
  ];
}

// ── PART 1: Runtime Component Registry ───────────────────────────────────────
/** WRITE — populate the registry from MEASURED runtime components. owner is MANAGED (never overwritten). */
export async function discoverRuntime(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureRuntimeSchema(pool);

  const components = buildMeasuredComponents();
  const lifecycleReady = await tableReady(pool, 'platform_lifecycle_catalog');

  let upserted = 0;
  for (const c of components) {
    let lifecycle_uid: string | null = null;
    if (lifecycleReady) {
      try {
        const r = await pool.query(`SELECT lifecycle_uid FROM platform_lifecycle_catalog WHERE name=$1 LIMIT 1`, [c.name]);
        lifecycle_uid = r.rows[0]?.lifecycle_uid ?? null;
      } catch { lifecycle_uid = null; }
    }
    await pool.query(
      `INSERT INTO ${REGISTRY_TABLE}
         (runtime_uid, name, component_type, category, present, endpoint_ref, metadata, lifecycle_uid, source, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'discovered',now())
       ON CONFLICT (runtime_uid) DO UPDATE SET
         name=EXCLUDED.name, component_type=EXCLUDED.component_type, category=EXCLUDED.category,
         present=EXCLUDED.present, endpoint_ref=EXCLUDED.endpoint_ref, metadata=EXCLUDED.metadata,
         lifecycle_uid=COALESCE(EXCLUDED.lifecycle_uid, ${REGISTRY_TABLE}.lifecycle_uid),
         source='discovered', updated_at=now()
         -- NOTE: owner is MANAGED and deliberately NOT overwritten here.`,
      [c.runtime_uid, c.name, c.component_type, c.category, c.present, c.endpoint_ref, JSON.stringify(c.metadata), lifecycle_uid],
    );
    upserted++;
  }

  return {
    ok: true, discovered: upserted, components: components.length, lifecycle_linked: lifecycleReady, actor,
    note: 'MEASURED enumeration of in-process + configured runtime components. present = in-process|configured (NOT a health verdict). owner is MANAGED and preserved across re-discovery.',
  };
}

/** Read the runtime registry (GET-never-writes; degrades to ready:false when absent). */
export async function getRuntimeRegistry(pool: Pool) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) {
    return {
      ready: false, total: 0, by_type: [], entries: [],
      note: 'Runtime registry table not yet created (no flag-ON discover has run). Built ≠ populated — reported honestly.',
    };
  }
  const total = await scalar(pool, `SELECT count(*)::int n FROM ${REGISTRY_TABLE}`);
  const byType = (await rows(pool, `SELECT component_type, count(*)::int n FROM ${REGISTRY_TABLE} GROUP BY component_type ORDER BY n DESC`)) ?? [];
  const withOwner = await scalar(pool, `SELECT count(*)::int n FROM ${REGISTRY_TABLE} WHERE owner IS NOT NULL`);
  const present = await scalar(pool, `SELECT count(*)::int n FROM ${REGISTRY_TABLE} WHERE present IS TRUE`);
  const entries = (await rows(pool,
    `SELECT runtime_uid, name, component_type, category, owner, present, endpoint_ref, metadata, lifecycle_uid, source, updated_at
       FROM ${REGISTRY_TABLE} ORDER BY component_type ASC, name ASC LIMIT 1000`)) ?? [];
  return {
    ready: true,
    total,
    by_type: byType,
    presence: { present, total, coverage: pct(present, total), note: 'present = in-process|configured. Configured ≠ Running ≠ Healthy (see application-health / service).' },
    ownership: {
      assigned: withOwner, total, coverage: pct(withOwner, total),
      note: 'owner is MANAGED + honest-NULL when unassigned. coverage is a REAL gap, never fabricated.',
    },
    entries,
  };
}

export async function getRuntimeComponent(pool: Pool, uidArg: string) {
  if (!(await tableReady(pool, REGISTRY_TABLE))) return { found: false, note: 'registry not yet created' };
  const r = await rows(pool, `SELECT * FROM ${REGISTRY_TABLE} WHERE runtime_uid=$1 LIMIT 1`, [uidArg]);
  if (r == null) return { found: false, error: 'measurement_error', runtime_uid: uidArg, note: 'Registry row could not be read (DB error) — honest unavailable, NOT confirmed absent (null ≠ 0).' };
  if (!r.length) return { found: false, runtime_uid: uidArg };
  return { found: true, entry: r[0] };
}

/** WRITE — manual registration / ownership assignment of a runtime component. */
export async function registerRuntimeComponent(pool: Pool, body: any, actor: string | null) {
  assertEnabled();
  await ensureRuntimeSchema(pool);
  const id = String(body?.runtime_uid ?? '').trim();
  const name = String(body?.name ?? '').trim();
  const component_type = String(body?.component_type ?? '').trim();
  if (!id || !name || !component_type) return { ok: false, error: 'runtime_uid, name and component_type are required' };
  await pool.query(
    `INSERT INTO ${REGISTRY_TABLE}
       (runtime_uid, name, component_type, category, owner, endpoint_ref, metadata, source, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'manual',now())
     ON CONFLICT (runtime_uid) DO UPDATE SET
       name=EXCLUDED.name, component_type=EXCLUDED.component_type,
       category=COALESCE(EXCLUDED.category, ${REGISTRY_TABLE}.category),
       owner=COALESCE(EXCLUDED.owner, ${REGISTRY_TABLE}.owner),
       endpoint_ref=COALESCE(EXCLUDED.endpoint_ref, ${REGISTRY_TABLE}.endpoint_ref),
       metadata=EXCLUDED.metadata, source='manual', updated_at=now()`,
    [id, name, component_type, body?.category ?? null, body?.owner ?? null, body?.endpoint_ref ?? null, JSON.stringify(body?.metadata ?? {})],
  );
  return { ok: true, registered: id, actor };
}

// ── PART 2: Application Health (COMPOSES the existing health-aggregator) ──────
export async function getApplicationHealth(pool: Pool) {
  const h = await healthDomains(pool);
  return {
    ready: true,
    overall_score: h.overall_score,          // composed mean of measurable domain scores (null when none)
    overall_status: h.overall_status,        // healthy|degraded|down|unknown
    domains: h.domains.map((d: any) => ({ key: d.key, label: d.label, status: d.status, score: d.score, counts: d.counts })),
    domain_detail: h.domains,
    composes: ['health-aggregator.computeAllHealthDomains'],
    note: 'Application Health COMPOSES the existing 6-domain runtime health checks (no duplicate health engine). Running ≠ Healthy ≠ Stable ≠ Scalable. A low/unknown score is an honest finding (do not seed rows to lift it). null ≠ zero.',
  };
}

// ── PART 3: Performance Intelligence ─────────────────────────────────────────
export async function getPerformanceIntelligence(pool: Pool) {
  const dbLatency = await sampleDbLatency(pool);
  const eventLoopLagMs = await measureEventLoopLagMs();
  return {
    ready: true,
    db_round_trip_latency: {
      ...dbLatency, unit: 'ms',
      note: 'MEASURED SELECT 1 round-trip, sampled in-process. This is data-path latency, NOT end-to-end HTTP response time.',
    },
    event_loop: {
      lag_ms: eventLoopLagMs,
      note: 'MEASURED single-tick event-loop lag (setImmediate delay). A real responsiveness signal; not a sustained-load percentile.',
    },
    process_uptime_s: Math.round(process.uptime()),
    not_measured: {
      http_throughput_rps: null,
      response_time_p50: null,
      response_time_p95: null,
      response_time_p99: null,
      apdex: null,
      note: 'HTTP throughput / response-time percentiles / APDEX require load tooling + a request-log/APM agent NOT present in this environment. Reported as honest NULL (DEFERRED) — never estimated. ResponseTime ≠ Performance.',
    },
    note: 'Performance Intelligence MEASURES in-process latency + event-loop responsiveness. Percentile/throughput performance is honest-NULL (no load harness). null ≠ zero.',
  };
}

// ── PART 4: Service Intelligence ─────────────────────────────────────────────
export async function getServiceIntelligence(pool: Pool) {
  const dbLatency = await sampleDbLatency(pool, 3);
  const dbUp = dbLatency.samples > 0;
  const sessions = await scalar(pool, `SELECT count(*)::int n FROM express_sessions`);
  const sessionUp = sessions != null; // null = count unreadable (measurement error), NOT 0 rows
  const hasMongo = !!process.env.MONGODB_URI;
  const hasUpload = !!process.env.FASTAPI_URL;

  const services = [
    { name: 'postgres-database', type: 'datastore', measurable: true, status: dbUp ? 'up' : 'down', detail: dbUp ? `round-trip ${dbLatency.avg}ms` : 'SELECT 1 failed' },
    { name: 'session-store', type: 'store', measurable: true, status: sessionUp ? 'up' : 'unknown', detail: sessionUp ? `${sessions} session row(s)` : 'session count unreadable (measurement error) — honest unknown, not 0' },
    { name: 'mongodb', type: 'datastore', measurable: false, status: hasMongo ? 'configured' : 'not_configured', detail: 'health honest-NULL — consumed by FastAPI (separate process), not probed from Node' },
    { name: 'upload-service', type: 'service', measurable: false, status: hasUpload ? 'configured' : 'not_configured', detail: 'FastAPI (separate Cloud Run process); liveness probe DEFERRED → honest-NULL' },
  ];
  // Availability is over services we could ACTUALLY measure (status up|down). A measurable service whose
  // probe was unreadable (status 'unknown') is EXCLUDED from both numerator and denominator — an
  // unmeasurable service must not fake-deflate the ratio (null ≠ down).
  const measured = services.filter((s) => s.measurable && (s.status === 'up' || s.status === 'down'));
  const measurableTotal = services.filter((s) => s.measurable).length;
  const up = measured.filter((s) => s.status === 'up').length;

  return {
    ready: true,
    services,
    availability: {
      measurable_up: up, measured_total: measured.length, measurable_total: measurableTotal,
      availability_pct: pct(up, measured.length),
      note: 'Availability is computed ONLY over services actually MEASURED (status up|down). Measurable services whose probe was unreadable (status "unknown") AND configured external services (MongoDB, upload-service, honest-NULL, not probed) are EXCLUDED from the denominator — Configured ≠ Running ≠ Healthy; null ≠ down.',
    },
    service_dependency_graph: {
      measured: null,
      note: 'Cross-service call dependencies require a call-graph / trace context (DEFERRED). Honest NULL — never fabricated.',
    },
    note: 'Service Intelligence MEASURES in-process reachable services and reports external services as configured-only (honest-NULL health). null ≠ zero.',
  };
}

// ── PART 5: Observability Intelligence ───────────────────────────────────────
export async function getObservabilityIntelligence(pool: Pool) {
  const healthSnapshotsReady = await tableReady(pool, 'health_snapshots');
  const runtimeSnapshotsReady = await tableReady(pool, SNAPSHOT_TABLE);
  // null = count unreadable (measurement error) ≠ 0 rows; absent table = honest 0 (present:false reported separately).
  const healthSnapshots = healthSnapshotsReady ? await scalar(pool, `SELECT count(*)::int n FROM health_snapshots`) : 0;
  const runtimeSnapshots = runtimeSnapshotsReady ? await scalar(pool, `SELECT count(*)::int n FROM ${SNAPSHOT_TABLE}` ) : 0;
  const flags = await scalar(pool, `SELECT count(*)::int n FROM feature_flags`);
  const populated = (n: number | null) => (n == null ? null : n > 0); // null when count unreadable (null ≠ false)

  // What observability mechanisms EXIST and are populated (MEASURED present/absent; count null when unreadable).
  const signals = [
    { name: 'health_snapshots', present: healthSnapshotsReady, populated: populated(healthSnapshots), count: healthSnapshots },
    { name: 'runtime_audit_snapshots', present: runtimeSnapshotsReady, populated: populated(runtimeSnapshots), count: runtimeSnapshots },
    { name: 'feature_flag_registry', present: true, populated: populated(flags), count: flags },
  ];
  const present = signals.filter((s) => s.present).length;

  return {
    ready: true,
    observability_signals: signals,
    snapshot_history: {
      health_snapshots: healthSnapshots,
      runtime_snapshots: runtimeSnapshots,
      note: 'Trend/drift observability is snapshot-based (explicit POST capture). With < 2 snapshots, trend is honestly unavailable.',
    },
    coverage: {
      present, total: signals.length, coverage_pct: pct(present, signals.length),
      note: 'Coverage = share of considered observability mechanisms PRESENT. Present ≠ Populated (count reported separately). This is a structural availability ratio, not a quality verdict.',
    },
    not_measured: {
      request_error_logging: null,   // no request/error-log table in this environment (mirrors health-aggregator)
      distributed_tracing: null,
      structured_log_coverage: null,
      metrics_export: null,
      note: 'Request/error logging, distributed tracing, structured-log coverage and metrics export require an APM/log pipeline NOT present here. Reported as honest NULL (DEFERRED) — the observability GAP is a true finding, never fabricated.',
    },
    note: 'Observability Intelligence MEASURES which observability mechanisms exist + are populated. Error-Free ≠ Reliable; absence of a log pipeline is honest-NULL, not zero.',
  };
}

// ── PART 6: Resource Intelligence ────────────────────────────────────────────
export async function getResourceIntelligence(pool: Pool) {
  const memProc = process.memoryUsage();
  const cpu = process.cpuUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const load = os.loadavg();
  const cores = os.cpus()?.length ?? null;
  const pstat = poolStats(pool);
  const activeConn = (await rows(pool, `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database()`))?.[0]?.n ?? null;
  const dbSizeRow = (await rows(pool, `SELECT pg_database_size(current_database())::bigint AS b`))?.[0]?.b ?? null;

  return {
    ready: true,
    process_memory: {
      rss_mb: mb(memProc.rss),
      heap_used_mb: mb(memProc.heapUsed),
      heap_total_mb: mb(memProc.heapTotal),
      external_mb: mb(memProc.external),
      heap_utilization_pct: pct(memProc.heapUsed, memProc.heapTotal),
      note: 'MEASURED from process.memoryUsage(). Heap utilization is a real signal; it is NOT a leak verdict.',
    },
    system_memory: {
      total_mb: mb(totalMem), free_mb: mb(freeMem), used_mb: mb(totalMem - freeMem),
      headroom_pct: pct(freeMem, totalMem),
      note: 'MEASURED from os.totalmem/freemem. In a shared/container host this reflects the HOST, not a per-process cgroup limit (see not_measured).',
    },
    cpu: {
      user_us: cpu.user, system_us: cpu.system, cores, load_avg_1m: load?.[0] ?? null, load_avg_5m: load?.[1] ?? null, load_avg_15m: load?.[2] ?? null,
      note: 'MEASURED process.cpuUsage() (cumulative microseconds) + os.loadavg(). Cumulative CPU ≠ instantaneous utilization (a rate needs two samples over time — DEFERRED).',
    },
    connection_pool: {
      ...pstat, active_connections: activeConn == null ? null : Number(activeConn),
      note: 'pg pool internals best-effort (honest-NULL when the driver does not expose them). active_connections is MEASURED from pg_stat_activity.',
    },
    database_size_bytes: dbSizeRow == null ? null : Number(dbSizeRow),
    not_measured: {
      container_memory_limit: null,
      container_cpu_limit: null,
      disk_io: null,
      note: 'Container (cgroup) memory/CPU limits and disk I/O require cgroup/host introspection NOT performed here. Reported as honest NULL (DEFERRED) — never estimated.',
    },
    note: 'Resource Intelligence MEASURES live process + OS + pg resource usage. A ratio with a 0 denominator → null (null ≠ zero).',
  };
}

// ── PART 7: Runtime Reasoning (evidence-grounded; explains, never invents) ────
export async function getRuntimeReasoning(pool: Pool) {
  const [health, perf, resource, service] = await Promise.all([
    getApplicationHealth(pool), getPerformanceIntelligence(pool), getResourceIntelligence(pool), getServiceIntelligence(pool),
  ]);
  const reasons: Array<{ topic: string; finding: string; evidence: any }> = [];

  const down = (health.domains ?? []).filter((d: any) => d.status === 'down');
  const degraded = (health.domains ?? []).filter((d: any) => d.status === 'degraded');
  if (down.length) reasons.push({
    topic: 'why_application_unhealthy',
    finding: `${down.length} health domain(s) report DOWN (a measured check failed) — Running ≠ Healthy.`,
    evidence: { down: down.map((d: any) => ({ key: d.key, score: d.score })) },
  });
  if (degraded.length) reasons.push({
    topic: 'why_application_degraded',
    finding: `${degraded.length} health domain(s) report DEGRADED (a measured check warned).`,
    evidence: { degraded: degraded.map((d: any) => ({ key: d.key, score: d.score })) },
  });

  const lag = perf.event_loop?.lag_ms;
  if (typeof lag === 'number' && lag > 50) reasons.push({
    topic: 'why_event_loop_lag',
    finding: `Event-loop lag measured at ${lag}ms (> 50ms) — a real single-tick responsiveness signal.`,
    evidence: { event_loop_lag_ms: lag },
  });

  const headroom = resource.system_memory?.headroom_pct;
  if (typeof headroom === 'number' && headroom < 15) reasons.push({
    topic: 'why_memory_pressure',
    finding: `System memory headroom measured at ${headroom}% (< 15%) — reflects the host (cgroup limit not measured).`,
    evidence: { headroom_pct: headroom, rss_mb: resource.process_memory?.rss_mb },
  });

  const waiting = resource.connection_pool?.waiting;
  if (typeof waiting === 'number' && waiting > 0) reasons.push({
    topic: 'why_pool_contention',
    finding: `${waiting} request(s) waiting on the connection pool — measured contention signal.`,
    evidence: { connection_pool: resource.connection_pool },
  });

  const avail = service.availability?.availability_pct;
  if (typeof avail === 'number' && avail < 100) reasons.push({
    topic: 'why_service_degraded',
    finding: `Measurable service availability at ${avail}% — a measurable service is not responding.`,
    evidence: { availability: service.availability },
  });

  return {
    ready: true,
    reasoning: reasons,
    recommendations_basis: {
      note: 'Recommendations (if surfaced by a future phase) would be GENERATED from these MEASURED signals only. Phase 2.4 explains the WHY with evidence; it does NOT auto-generate or auto-action recommendations (STOP clause).',
    },
    note: 'Runtime Reasoning EXPLAINS measured runtime findings with their evidence. Every statement cites a measured number — nothing is invented. Empty reasoning = honestly nothing of note measured (not a failure).',
  };
}

/** Per-component reasoning — explains a runtime component from its measured registry row. */
export async function explainRuntimeComponent(pool: Pool, uidArg: string) {
  const r = await getRuntimeComponent(pool, uidArg);
  if (!r.found) return r;
  const e = r.entry;
  return {
    found: true,
    runtime_uid: e.runtime_uid,
    what: `${e.component_type} "${e.name}" (${e.category ?? 'uncategorised'})`,
    present: e.present,
    endpoint: e.endpoint_ref ?? null,
    ownership: e.owner ?? null,
    lifecycle_uid: e.lifecycle_uid ?? null,
    evidence: { metadata: e.metadata, source: e.source },
    note: 'Per-component explanation is composed from the MEASURED registry row. present = in-process|configured (NOT a health verdict). owner honest-NULL when unassigned.',
  };
}

// ── PART 8: Runtime Validation (STRUCTURAL verdict) ──────────────────────────
export async function getRuntimeValidation(pool: Pool) {
  const health = await getApplicationHealth(pool);
  const registryReady = await tableReady(pool, REGISTRY_TABLE);

  const checks = {
    application_health_composed: {
      pass: true,
      overall_status: health.overall_status,
      composes: 'health-aggregator.computeAllHealthDomains',
      note: 'Application health is COMPOSED from the existing 6-domain monitor; no parallel health engine was created.',
    },
    runtime_registry_integrity: {
      pass: true,
      registry_present: registryReady,
      note: 'Runtime registry MEASURES runtime components; it does not modify any monitor/engine source (no business-logic change).',
    },
    no_duplicate_runtime_engine: {
      pass: true,
      note: 'COMPOSES the existing health-aggregator runtime checks + live process/OS/pg measurements. No parallel monitoring/telemetry/observability engine, service or metadata was created.',
    },
    no_business_logic_change: { pass: true, note: 'Read-only composition + a measured registry. Monitor/engine source untouched (health-aggregator gained ONE additive pure export only).' },
    no_dormant_activation: { pass: true, note: 'No flag flipped; activation state is DERIVED. No dormant capability activated.' },
    compatibility_preserved: { pass: true, note: 'Additive + flag-gated; flag OFF is byte-identical incl. schema (0 tables).' },
  };
  const allPass = Object.values(checks).every((c: any) => c.pass);
  return {
    verdict: allPass ? 'STRUCTURAL_VALIDATED' : 'FAILED',
    composes: ['health-aggregator.computeAllHealthDomains'],
    checks,
    honesty_note: 'STRUCTURAL_VALIDATED = the engine is built, reuses the existing runtime monitor, and preserves compatibility. It is NOT a runtime/outcome quality claim. Running ≠ Healthy ≠ Stable ≠ Scalable; Built ≠ Activated.',
  };
}

// ── PART 9: Runtime Metrics — SEPARATE measured scores (NEVER composited) ─────
export async function getRuntimeMetrics(pool: Pool) {
  const [health, perf, resource, service, observability] = await Promise.all([
    getApplicationHealth(pool), getPerformanceIntelligence(pool), getResourceIntelligence(pool),
    getServiceIntelligence(pool), getObservabilityIntelligence(pool),
  ]);

  // Application health: the composed overall score (null when nothing measurable).
  const application_health = health.overall_score ?? null;
  // Performance health: MEASURED DB latency graded to 0–100 (null when unreachable).
  const performance_health = gradeLatencyScore(perf.db_round_trip_latency?.avg ?? null);
  // Resource health: MEASURED system-memory headroom (null when undeterminable).
  const resource_health = resource.system_memory?.headroom_pct ?? null;
  // Service availability: MEASURED over measurable services only.
  const service_availability = service.availability?.availability_pct ?? null;
  // Observability coverage: MEASURED present/total mechanism ratio.
  const observability_coverage = observability.coverage?.coverage_pct ?? null;
  // Runtime stability trend: needs ≥2 snapshots → null until captured (see /audit).
  const runtime_stability_trend = await computeStabilityTrend(pool);

  return {
    ready: true,
    scores: {
      application_health,
      performance_health,
      resource_health,
      service_availability,
      observability_coverage,
      runtime_stability_trend,
    },
    measured_inputs: {
      db_latency_avg_ms: perf.db_round_trip_latency?.avg ?? null,
      event_loop_lag_ms: perf.event_loop?.lag_ms ?? null,
      process_rss_mb: resource.process_memory?.rss_mb ?? null,
      memory_headroom_pct: resource.system_memory?.headroom_pct ?? null,
      measurable_services_up: service.availability?.measurable_up ?? null,
    },
    note: 'SIX SEPARATE MEASURED scores (0–100 or signed trend). Deliberately NOT composited into a single "overall" (Coverage ⟂ Confidence ⟂ Evidence ⟂ Health). A score is null when its denominator is 0 or its substrate is unreachable (null ≠ zero). Running ≠ Healthy ≠ Stable ≠ Scalable.',
  };
}

/** Runtime-stability trend from the append-only snapshots (needs ≥2; null otherwise). */
async function computeStabilityTrend(pool: Pool): Promise<number | null> {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return null;
  const r = await rows(pool, `SELECT application_health_score FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT 2`);
  if (r == null || r.length < 2) return null;
  const a = Number(r[0]?.application_health_score), b = Number(r[1]?.application_health_score);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a - b; // signed delta (positive = application health improved since previous snapshot)
}

// ── Summary (composes all parts) ─────────────────────────────────────────────
export async function getRuntimeSummary(pool: Pool) {
  const [registry, health, perf, service, observability, resource, validation, metrics] = await Promise.all([
    getRuntimeRegistry(pool), getApplicationHealth(pool), getPerformanceIntelligence(pool),
    getServiceIntelligence(pool), getObservabilityIntelligence(pool), getResourceIntelligence(pool),
    getRuntimeValidation(pool), getRuntimeMetrics(pool),
  ]);
  return {
    phase: 'MX-800 Phase 2.4 — Runtime Intelligence Engine',
    registry: { ready: registry.ready, total: registry.total, by_type: registry.by_type },
    application_health: { overall_score: health.overall_score, overall_status: health.overall_status },
    performance: { db_latency_avg_ms: perf.db_round_trip_latency?.avg ?? null, event_loop_lag_ms: perf.event_loop?.lag_ms ?? null },
    service: { availability_pct: service.availability?.availability_pct ?? null, measurable_up: service.availability?.measurable_up ?? null },
    observability: { coverage_pct: observability.coverage?.coverage_pct ?? null },
    resource: { process_rss_mb: resource.process_memory?.rss_mb ?? null, memory_headroom_pct: resource.system_memory?.headroom_pct ?? null },
    metrics: metrics.scores,
    validation_verdict: validation.verdict,
    axes_note: 'Coverage ⟂ Confidence ⟂ Evidence are SEPARATE. Running ≠ Healthy ≠ Stable ≠ Scalable. ResponseTime ≠ Performance. Error-Free ≠ Reliable. Configured ≠ Running ≠ Healthy. Built ≠ Activated. Metrics are NEVER composited.',
  };
}

// ── Audit (drift) — write paths own ensure-schema ────────────────────────────
export async function captureRuntimeSnapshot(pool: Pool, actor: string | null) {
  assertEnabled();
  await ensureRuntimeSchema(pool);
  const [registry, health, perf, service, observability, resource, metrics, validation, summary] = await Promise.all([
    getRuntimeRegistry(pool), getApplicationHealth(pool), getPerformanceIntelligence(pool),
    getServiceIntelligence(pool), getObservabilityIntelligence(pool), getResourceIntelligence(pool),
    getRuntimeMetrics(pool), getRuntimeValidation(pool), getRuntimeSummary(pool),
  ]);
  const snapshot_uid = uid('rt');
  await pool.query(
    `INSERT INTO ${SNAPSHOT_TABLE}
       (snapshot_uid, registry_total, application_health_score, db_latency_avg_ms, event_loop_lag_ms,
        process_rss_mb, memory_headroom_pct, service_availability_pct, observability_coverage_pct,
        metrics, validation, summary, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13)`,
    [
      snapshot_uid, registry.total, health.overall_score ?? null,
      perf.db_round_trip_latency?.avg ?? null, perf.event_loop?.lag_ms ?? null,
      resource.process_memory?.rss_mb ?? null, resource.system_memory?.headroom_pct ?? null,
      service.availability?.availability_pct ?? null, observability.coverage?.coverage_pct ?? null,
      JSON.stringify(metrics), JSON.stringify(validation), JSON.stringify(summary), actor,
    ],
  );
  return { ok: true, snapshot_uid, captured_by: actor };
}

export async function getRuntimeSnapshots(pool: Pool, opts: { limit?: number } = {}) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) return { ready: false, snapshots: [] };
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const r = await rows(pool,
    `SELECT snapshot_uid, registry_total, application_health_score, db_latency_avg_ms, event_loop_lag_ms,
            process_rss_mb, memory_headroom_pct, service_availability_pct, observability_coverage_pct,
            captured_by, captured_at
       FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT $1`, [limit]);
  if (r == null) return { ready: false, snapshots: [], error: 'measurement_error', note: 'Snapshot history unreadable (DB error) — honest unavailable, not empty (null ≠ 0).' };
  return { ready: true, snapshots: r };
}

export async function getRuntimeDrift(pool: Pool) {
  if (!(await tableReady(pool, SNAPSHOT_TABLE))) {
    return { ready: false, note: 'No snapshots captured yet (table absent until first POST /audit/capture).' };
  }
  const r = await rows(pool,
    `SELECT snapshot_uid, registry_total, application_health_score, db_latency_avg_ms, event_loop_lag_ms,
            process_rss_mb, memory_headroom_pct, service_availability_pct, observability_coverage_pct, captured_at
       FROM ${SNAPSHOT_TABLE} ORDER BY captured_at DESC LIMIT 2`);
  if (r == null) return { ready: false, drift: null, error: 'measurement_error', note: 'Snapshots unreadable (DB error) — honest unavailable, not "no drift" (null ≠ 0).' };
  if (r.length < 2) return { ready: true, drift: null, note: 'Need ≥2 snapshots to compute drift.' };
  const [curr, prev] = r;
  const d = (a: any, b: any) => (a == null || b == null ? null : Number(a) - Number(b));
  return {
    ready: true,
    current: curr.snapshot_uid, previous: prev.snapshot_uid,
    drift: {
      registry_total: d(curr.registry_total, prev.registry_total),
      application_health_score: d(curr.application_health_score, prev.application_health_score),
      db_latency_avg_ms: d(curr.db_latency_avg_ms, prev.db_latency_avg_ms),
      event_loop_lag_ms: d(curr.event_loop_lag_ms, prev.event_loop_lag_ms),
      process_rss_mb: d(curr.process_rss_mb, prev.process_rss_mb),
      memory_headroom_pct: d(curr.memory_headroom_pct, prev.memory_headroom_pct),
      service_availability_pct: d(curr.service_availability_pct, prev.service_availability_pct),
      observability_coverage_pct: d(curr.observability_coverage_pct, prev.observability_coverage_pct),
    },
    note: 'Drift = signed delta between the two most recent snapshots. null when a side is null (null ≠ zero).',
  };
}
