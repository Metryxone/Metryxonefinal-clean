/**
 * CAPADEX 3.0 — Program 2 · Phase 2.5 Operational Readiness.
 *
 * Additive, flag-gated (`operationalReadiness`) in-process METRICS REGISTRY + Prometheus
 * text exposition + an Express middleware. Closes GAP-OPS-1 (metrics-export / throughput /
 * error-rate / cache-hit instrumentation) and the `/metrics` half of GAP-OPS-6.
 *
 * Honesty / byte-identical OFF:
 *  - The middleware SHORT-CIRCUITS (`next()`) when the flag is OFF — it records nothing,
 *    allocates nothing, and adds no observable behaviour. No DDL, no table: counters live
 *    in process memory (a metrics registry, NOT a data store).
 *  - Metrics are REAL observed values. Un-instrumented series are simply absent (never
 *    fabricated as 0).
 */
import type { Request, Response, NextFunction } from 'express';
import { isOperationalReadinessEnabled } from '../../config/feature-flags';

type Labels = Record<string, string>;

const counters = new Map<string, number>();
const gauges = new Map<string, number>();

// Latency histogram bucket upper-bounds (ms). Cumulative Prometheus semantics.
const LAT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const histBuckets = new Map<string, number[]>(); // key -> per-bucket cumulative + [+Inf]
const histSum = new Map<string, number>();
const histCount = new Map<string, number>();

const startedAt = Date.now();

function keyOf(name: string, labels?: Labels): string {
  if (!labels || Object.keys(labels).length === 0) return name;
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}="${String(labels[k]).replace(/[\\"\n]/g, '')}"`);
  return `${name}{${parts.join(',')}}`;
}

export function incCounter(name: string, labels?: Labels, by = 1): void {
  const k = keyOf(name, labels);
  counters.set(k, (counters.get(k) || 0) + by);
}
export function setGauge(name: string, value: number, labels?: Labels): void {
  gauges.set(keyOf(name, labels), value);
}
export function observeHistogram(name: string, valueMs: number, labels?: Labels): void {
  const k = keyOf(name, labels);
  let arr = histBuckets.get(k);
  if (!arr) {
    arr = new Array(LAT_BUCKETS.length + 1).fill(0);
    histBuckets.set(k, arr);
  }
  for (let i = 0; i < LAT_BUCKETS.length; i++) if (valueMs <= LAT_BUCKETS[i]) arr[i]++;
  arr[LAT_BUCKETS.length]++; // +Inf
  histSum.set(k, (histSum.get(k) || 0) + valueMs);
  histCount.set(k, (histCount.get(k) || 0) + 1);
}

/** Cache-hit-ratio instrumentation primitives (call from any cache layer). */
export function recordCacheHit(cache: string): void {
  if (!isOperationalReadinessEnabled()) return;
  incCounter('capadex_cache_hits_total', { cache });
}
export function recordCacheMiss(cache: string): void {
  if (!isOperationalReadinessEnabled()) return;
  incCounter('capadex_cache_misses_total', { cache });
}

/** Express middleware — counts throughput / errors / latency. Byte-identical OFF. */
export function opsMetricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isOperationalReadinessEnabled()) return next(); // OFF → zero overhead, no recording
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      try {
        const durMs = Number(process.hrtime.bigint() - start) / 1e6;
        const status = res.statusCode;
        const statusClass = `${Math.floor(status / 100)}xx`;
        incCounter('capadex_http_requests_total', { method: req.method, status_class: statusClass });
        if (status >= 500) incCounter('capadex_http_request_errors_total', { method: req.method });
        observeHistogram('capadex_http_request_duration_ms', durMs, { method: req.method });
      } catch {
        /* metrics recording must NEVER break a response */
      }
    });
    next();
  };
}

/**
 * GAP-OPS-3 (latency-percentile distribution): estimate a quantile (0<q<1) from the EXISTING
 * cumulative latency histogram buckets using Prometheus `histogram_quantile` linear interpolation.
 * REUSES the histogram substrate already recorded by opsMetricsMiddleware — no new capture pipeline.
 *
 * Honesty: returns null when there are too few samples to estimate the quantile meaningfully
 * (a p99 needs at least ~100 observations to have a single sample in the tail) — never a fake 0.
 */
function minSamplesForQuantile(q: number): number {
  return Math.ceil(1 / (1 - q)); // p50→2, p95→20, p99→100
}

function quantileFromBuckets(cumulative: number[], count: number, q: number): number | null {
  if (count <= 0 || count < minSamplesForQuantile(q)) return null; // insufficient data → null (not 0)
  const rank = q * count;
  // cumulative[LAT_BUCKETS.length] is the +Inf bucket (== count).
  let idx = -1;
  for (let i = 0; i < cumulative.length; i++) {
    if (cumulative[i] >= rank) { idx = i; break; }
  }
  if (idx < 0) return null;
  // The quantile falls in the open-ended +Inf bucket → clamp to the highest finite bound (honest cap).
  if (idx >= LAT_BUCKETS.length) return LAT_BUCKETS[LAT_BUCKETS.length - 1];
  const bucketEnd = LAT_BUCKETS[idx];
  const bucketStart = idx === 0 ? 0 : LAT_BUCKETS[idx - 1];
  const cumBelow = idx === 0 ? 0 : cumulative[idx - 1];
  const inBucket = cumulative[idx] - cumBelow;
  if (inBucket <= 0) return bucketEnd;
  const frac = (rank - cumBelow) / inBucket;
  return Math.round((bucketStart + (bucketEnd - bucketStart) * frac) * 100) / 100;
}

/** Merge every histogram series sharing a metric base (across label variants) into one cumulative array. */
function mergeHistogram(base: string): { cumulative: number[]; count: number; sum: number } {
  const cumulative = new Array(LAT_BUCKETS.length + 1).fill(0);
  let count = 0;
  let sum = 0;
  for (const [k, arr] of histBuckets) {
    if (k.split('{')[0] !== base) continue;
    for (let i = 0; i < arr.length; i++) cumulative[i] += arr[i];
    count += histCount.get(k) || 0;
    sum += histSum.get(k) || 0;
  }
  return { cumulative, count, sum };
}

/**
 * Latency-percentile distribution (p50/p95/p99) for request-duration histograms.
 * Aggregate across all methods + a per-method breakdown. All percentiles are honest histogram-bucket
 * ESTIMATES (Prometheus semantics) and are null until enough samples exist. null ≠ 0.
 */
export function snapshotLatencyPercentiles(base = 'capadex_http_request_duration_ms') {
  const build = (merged: { cumulative: number[]; count: number; sum: number }) => ({
    count: merged.count,
    avg_ms: merged.count > 0 ? Math.round((merged.sum / merged.count) * 100) / 100 : null,
    p50_ms: quantileFromBuckets(merged.cumulative, merged.count, 0.5),
    p95_ms: quantileFromBuckets(merged.cumulative, merged.count, 0.95),
    p99_ms: quantileFromBuckets(merged.cumulative, merged.count, 0.99),
  });

  const overall = build(mergeHistogram(base));

  // Per-method breakdown (label method="..."), so a single slow verb is visible.
  const byMethod: Record<string, ReturnType<typeof build>> = {};
  const methods = new Set<string>();
  for (const [k] of histBuckets) {
    if (k.split('{')[0] !== base) continue;
    const m = /method="([^"]*)"/.exec(k);
    if (m) methods.add(m[1]);
  }
  for (const method of methods) {
    const cumulative = new Array(LAT_BUCKETS.length + 1).fill(0);
    let count = 0;
    let sum = 0;
    for (const [k, arr] of histBuckets) {
      if (k.split('{')[0] !== base) continue;
      const mm = /method="([^"]*)"/.exec(k);
      if (!mm || mm[1] !== method) continue;
      for (let i = 0; i < arr.length; i++) cumulative[i] += arr[i];
      count += histCount.get(k) || 0;
      sum += histSum.get(k) || 0;
    }
    byMethod[method] = build({ cumulative, count, sum });
  }

  return {
    metric: base,
    buckets_ms: LAT_BUCKETS,
    overall,
    by_method: byMethod,
    note: 'Histogram-bucket estimates (Prometheus histogram_quantile). Percentiles are null until enough samples exist (p50≥2, p95≥20, p99≥100) — null ≠ 0.',
  };
}

/** Machine-readable JSON snapshot (for the /metrics JSON alt + alert-rule signals). */
export function snapshotMetrics() {
  const uptimeSeconds = Math.round((Date.now() - startedAt) / 1000);
  const mem = process.memoryUsage();
  let requests = 0;
  let errors = 0;
  for (const [k, v] of counters) {
    if (k.startsWith('capadex_http_requests_total')) requests += v;
    if (k.startsWith('capadex_http_request_errors_total')) errors += v;
  }
  const errorRatio = requests > 0 ? Math.round((errors / requests) * 10000) / 10000 : null; // null ≠ 0
  return {
    uptime_seconds: uptimeSeconds,
    process_rss_bytes: mem.rss,
    process_heap_used_bytes: mem.heapUsed,
    http_requests_total: requests,
    http_request_errors_total: errors,
    http_error_ratio: errorRatio, // null when no traffic observed yet (honest, not 0)
    counters: Object.fromEntries(counters),
    gauges: Object.fromEntries(gauges),
  };
}

/** Prometheus text exposition (v0.0.4). */
export function renderPrometheus(): string {
  setGauge('capadex_process_uptime_seconds', Math.round((Date.now() - startedAt) / 1000));
  const mem = process.memoryUsage();
  setGauge('capadex_process_resident_memory_bytes', mem.rss);
  setGauge('capadex_process_heap_used_bytes', mem.heapUsed);

  const out: string[] = [];
  const emitFamily = (type: string, m: Map<string, number>) => {
    const seen = new Set<string>();
    for (const [k] of m) {
      const base = k.split('{')[0];
      if (!seen.has(base)) {
        seen.add(base);
        out.push(`# TYPE ${base} ${type}`);
      }
    }
    for (const [k, v] of m) out.push(`${k} ${v}`);
  };
  emitFamily('counter', counters);
  emitFamily('gauge', gauges);

  const hseen = new Set<string>();
  for (const [k, arr] of histBuckets) {
    const base = k.split('{')[0];
    if (!hseen.has(base)) {
      hseen.add(base);
      out.push(`# TYPE ${base} histogram`);
    }
    const inner = k.includes('{') ? k.slice(k.indexOf('{') + 1, -1) : '';
    for (let i = 0; i < LAT_BUCKETS.length; i++) {
      const lbl = inner ? `${inner},le="${LAT_BUCKETS[i]}"` : `le="${LAT_BUCKETS[i]}"`;
      out.push(`${base}_bucket{${lbl}} ${arr[i]}`);
    }
    const infLbl = inner ? `${inner},le="+Inf"` : `le="+Inf"`;
    out.push(`${base}_bucket{${infLbl}} ${arr[LAT_BUCKETS.length]}`);
    out.push(`${base}_sum${inner ? `{${inner}}` : ''} ${histSum.get(k) || 0}`);
    out.push(`${base}_count${inner ? `{${inner}}` : ''} ${histCount.get(k) || 0}`);
  }
  return out.join('\n') + '\n';
}
