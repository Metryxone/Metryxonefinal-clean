/**
 * Runtime Optimisation Engine — in-process LRU cache + scheduling hints
 * for orchestration, benchmark recalc, simulation compute, refresh cycles.
 * Pure local memory; no Redis. Safe to instantiate per-process.
 */
export const RUNTIME_OPT_VERSION = '8.0.0';

type CacheEntry<V> = { value: V; expiresAt: number };

export class LRUCache<K, V> {
  private map = new Map<K, CacheEntry<V>>();
  private capacity: number;
  private hits = 0; private misses = 0;
  constructor(capacity = 256) { this.capacity = Math.max(1, capacity); }
  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) { this.misses++; return undefined; }
    if (entry.expiresAt > 0 && entry.expiresAt < Date.now()) { this.map.delete(key); this.misses++; return undefined; }
    // refresh recency
    this.map.delete(key); this.map.set(key, entry);
    this.hits++;
    return entry.value;
  }
  set(key: K, value: V, ttlMs = 0) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.capacity) {
      const first = this.map.keys().next().value;
      if (first !== undefined) this.map.delete(first);
    }
    this.map.set(key, { value, expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0 });
  }
  delete(key: K) { this.map.delete(key); }
  clear() { this.map.clear(); this.hits = 0; this.misses = 0; }
  stats() {
    const total = this.hits + this.misses;
    return { size: this.map.size, capacity: this.capacity, hits: this.hits, misses: this.misses, hit_rate: total ? Math.round((this.hits / total) * 1000) / 1000 : 0 };
  }
}

// Module-level shared caches per workload type
const caches = new Map<string, LRUCache<string, unknown>>();
export function getCache<V = unknown>(name: string, capacity = 256): LRUCache<string, V> {
  if (!caches.has(name)) caches.set(name, new LRUCache<string, V>(capacity) as LRUCache<string, unknown>);
  return caches.get(name) as LRUCache<string, V>;
}

export function allCacheStats() {
  const out: Record<string, ReturnType<LRUCache<string, unknown>['stats']>> = {};
  for (const [name, cache] of caches) out[name] = cache.stats();
  return out;
}

/** Schedule recommendation: should a recompute run, given recency + min interval. */
export function shouldRecompute(lastRunAt: Date | null, minIntervalMinutes: number): boolean {
  if (!lastRunAt) return true;
  return (Date.now() - lastRunAt.getTime()) >= minIntervalMinutes * 60 * 1000;
}

/** Suggest batch size based on observed avg item latency + target window. */
export function suggestBatchSize(avgItemLatencyMs: number, targetWindowMs = 5000, min = 1, max = 200): number {
  if (avgItemLatencyMs <= 0) return max;
  return Math.max(min, Math.min(max, Math.floor(targetWindowMs / avgItemLatencyMs)));
}
