/**
 * Intelligence Observability Engine — record runtime metrics, expose
 * query helpers for latency / propagation / health / AI runtime stats.
 */
import type { Pool } from 'pg';
export const OBSERVABILITY_ENGINE_VERSION = '8.0.0';

export async function recordMetric(pool: Pool, args: { component: string; metric: string; value: number; context?: Record<string, unknown> }) {
  try {
    await pool.query(
      `INSERT INTO workforce_observability_logs (component, metric, value, context) VALUES ($1,$2,$3,$4::jsonb)`,
      [args.component, args.metric, args.value, JSON.stringify(args.context ?? {})],
    );
  } catch (e) { console.warn('[obs] record failed:', (e as Error).message); }
}

export async function recordPerformance(pool: Pool, args: { component: string; latencyMs?: number; throughputPerMin?: number; errorRate?: number }) {
  try {
    await pool.query(
      `INSERT INTO intelligence_performance_metrics (component, latency_ms, throughput_per_min, error_rate) VALUES ($1,$2,$3,$4)`,
      [args.component, args.latencyMs ?? null, args.throughputPerMin ?? null, args.errorRate ?? null],
    );
  } catch (e) { console.warn('[obs] perf failed:', (e as Error).message); }
}

export async function recordOrchestrationStep(pool: Pool, args: { runId: string; step: string; durationMs: number; status: string }) {
  try {
    await pool.query(
      `INSERT INTO orchestration_performance_logs (run_id, step, duration_ms, status) VALUES ($1,$2,$3,$4)`,
      [args.runId, args.step, args.durationMs, args.status],
    );
  } catch (e) { console.warn('[obs] orch failed:', (e as Error).message); }
}

export async function recordAiRuntime(pool: Pool, args: { modelKey: string; callCount: number; avgLatencyMs?: number; errorCount?: number; windowStart: Date; windowEnd: Date }) {
  try {
    await pool.query(
      `INSERT INTO ai_runtime_monitoring (model_key, call_count, avg_latency_ms, error_count, window_start, window_end) VALUES ($1,$2,$3,$4,$5,$6)`,
      [args.modelKey, args.callCount, args.avgLatencyMs ?? null, args.errorCount ?? 0, args.windowStart, args.windowEnd],
    );
  } catch (e) { console.warn('[obs] ai runtime failed:', (e as Error).message); }
}

export async function queryHealth(pool: Pool, lookbackHours = 24) {
  try {
    const perf = await pool.query(
      `SELECT component, AVG(latency_ms) AS avg_latency, AVG(error_rate) AS avg_error_rate, COUNT(*) AS samples
       FROM intelligence_performance_metrics
       WHERE measured_at >= NOW() - ($1 || ' hours')::interval
       GROUP BY component ORDER BY avg_latency DESC NULLS LAST`,
      [lookbackHours.toString()],
    );
    const orch = await pool.query(
      `SELECT step, AVG(duration_ms) AS avg_ms, COUNT(*) AS samples
       FROM orchestration_performance_logs
       WHERE recorded_at >= NOW() - ($1 || ' hours')::interval
       GROUP BY step ORDER BY avg_ms DESC NULLS LAST`,
      [lookbackHours.toString()],
    );
    const ai = await pool.query(
      `SELECT model_key, SUM(call_count) AS calls, AVG(avg_latency_ms) AS avg_latency, SUM(error_count) AS errors
       FROM ai_runtime_monitoring
       WHERE window_end >= NOW() - ($1 || ' hours')::interval
       GROUP BY model_key`,
      [lookbackHours.toString()],
    );
    return { performance: perf.rows, orchestration: orch.rows, ai_runtime: ai.rows, lookback_hours: lookbackHours };
  } catch (e) {
    return { performance: [], orchestration: [], ai_runtime: [], lookback_hours: lookbackHours, error: (e as Error).message };
  }
}

/** High-level system health summary derived from queryHealth output. */
export function summariseHealth(health: Awaited<ReturnType<typeof queryHealth>>) {
  const slowComponents = health.performance.filter((r) => Number(r.avg_latency) > 500).map((r) => r.component);
  const flakyComponents = health.performance.filter((r) => Number(r.avg_error_rate) > 0.05).map((r) => r.component);
  const status = slowComponents.length === 0 && flakyComponents.length === 0 ? 'green' : flakyComponents.length > 0 ? 'red' : 'amber';
  return { status, slow_components: slowComponents, flaky_components: flakyComponents };
}
