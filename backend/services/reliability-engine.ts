/**
 * Phase 2 — Psychometric Reliability Engine.
 *
 * Pure functions that compute reliability indicators from a response set.
 * Accepts a generic ResponseRecord — agnostic to source table so this engine
 * can score sessions from any assessment system without coupling.
 *
 * All metrics are bounded 0..1 (higher = better) except contradiction_count
 * (raw count) and anomaly_flags (string list).
 */

export interface ResponseRecord {
  item_id: string;
  /** Optional dimension/competency tag — enables paired-item consistency. */
  dimension?: string | null;
  /** Numeric response value (e.g. 1..5 likert, or 0..100). */
  value: number;
  /** True if item is reverse-keyed (high response = low trait). */
  reverse_keyed?: boolean;
  /** Optional companion item id (the pair). Used for direct-pair consistency. */
  pair_of?: string | null;
  /** Time on item (ms). */
  duration_ms?: number;
  /** Maximum possible value on the scale (default 5). */
  scale_max?: number;
}

export interface ReliabilityResult {
  session_id: string;
  response_consistency:  number;   // 0..1 — within-dimension agreement
  reverse_item_validity: number;   // 0..1 — reverse items behave as expected
  contradiction_count:   number;   // raw count of opposing pairs
  contradictions:        Array<{ a: string; b: string; delta: number }>;
  confidence_score:      number;   // 0..1 — composite confidence
  reliability_index:     number;   // 0..1 — weighted composite (psychometric R)
  completion_quality:    number;   // 0..1 — time-on-task and dropoff quality
  anomaly_flags:         string[]; // e.g. ['straightlining','fast_responses']
  stability_score:       number | null;  // 0..1 vs prior session(s); null if none
  computed_at:           string;
}

export interface QualityMetrics {
  session_id: string;
  total_items: number;
  answered_items: number;
  completion_rate: number;
  avg_response_ms: number | null;
  median_response_ms: number | null;
  fast_response_pct: number;        // share of responses < 800ms
  straightline_pct: number;         // longest constant run / answered
  quality_tier: 'A' | 'B' | 'C' | 'D';
}

const FAST_MS = 800;

export function computeReliability(
  sessionId: string,
  responses: ResponseRecord[],
  options?: { previousSessionResponses?: ResponseRecord[][] },
): ReliabilityResult {
  if (!responses.length) {
    return baseEmpty(sessionId);
  }

  const consistency = withinDimensionConsistency(responses);
  const reverseValid = reverseItemValidity(responses);
  const { count: contradictionCount, items: contradictions } = detectContradictions(responses);
  const completion = completionQuality(responses);
  const anomalies = detectAnomalies(responses);

  // Composite reliability index — weighted: consistency 0.40, reverse 0.20,
  // (1 - contradiction_penalty) 0.20, completion 0.15, (1 - anomaly_penalty) 0.05.
  const contraPenalty = Math.min(1, contradictionCount / Math.max(1, responses.length / 4));
  const anomalyPenalty = Math.min(1, anomalies.length / 4);
  const reliability =
      0.40 * consistency
    + 0.20 * reverseValid
    + 0.20 * (1 - contraPenalty)
    + 0.15 * completion
    + 0.05 * (1 - anomalyPenalty);

  // Confidence score = reliability adjusted by sample size (more items → more conf).
  const sizeMult = Math.min(1, Math.log10(responses.length + 1) / Math.log10(40));
  const confidence = reliability * (0.5 + 0.5 * sizeMult);

  const stability = options?.previousSessionResponses?.length
    ? sessionStability(responses, options.previousSessionResponses)
    : null;

  return {
    session_id: sessionId,
    response_consistency:  round(consistency, 4),
    reverse_item_validity: round(reverseValid, 4),
    contradiction_count:   contradictionCount,
    contradictions,
    confidence_score:      round(confidence, 4),
    reliability_index:     round(reliability, 4),
    completion_quality:    round(completion, 4),
    anomaly_flags:         anomalies,
    stability_score:       stability === null ? null : round(stability, 4),
    computed_at:           new Date().toISOString(),
  };
}

export function computeQuality(sessionId: string, responses: ResponseRecord[], totalItems?: number): QualityMetrics {
  const answered = responses.length;
  const total = totalItems ?? answered;
  const completion = total > 0 ? answered / total : 0;
  const durations = responses.map(r => r.duration_ms).filter((d): d is number => typeof d === 'number');
  const avg = durations.length ? durations.reduce((s, d) => s + d, 0) / durations.length : null;
  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const fastPct = durations.length ? durations.filter(d => d < FAST_MS).length / durations.length : 0;

  const straight = longestConstantRun(responses) / Math.max(1, answered);

  // Tier mapping
  const composite = 0.55 * completion + 0.20 * (1 - fastPct) + 0.25 * (1 - straight);
  const tier: 'A'|'B'|'C'|'D' =
      composite >= 0.85 ? 'A'
    : composite >= 0.70 ? 'B'
    : composite >= 0.50 ? 'C' : 'D';

  return {
    session_id: sessionId,
    total_items: total,
    answered_items: answered,
    completion_rate: round(completion, 4),
    avg_response_ms: avg === null ? null : Math.round(avg),
    median_response_ms: median ?? null,
    fast_response_pct: round(fastPct, 4),
    straightline_pct:  round(straight, 4),
    quality_tier: tier,
  };
}

/** Generate a demo response set so the engine has data to work with. */
export function demoResponses(sessionId: string): ResponseRecord[] {
  // 24 items across 4 dimensions, with one reverse-keyed item per dimension
  // and two paired contradiction items.
  const dims = ['exec', 'comm', 'analytic', 'agility'];
  const out: ResponseRecord[] = [];
  const rng = mulberry32(hashString(sessionId));
  for (const dim of dims) {
    const trait = 2 + rng() * 3; // 2..5
    for (let i = 0; i < 5; i++) {
      out.push({ item_id: `${dim}_q${i}`, dimension: dim,
                 value: clamp(Math.round(trait + (rng() - 0.5)), 1, 5),
                 scale_max: 5, duration_ms: 1500 + Math.round(rng() * 4000) });
    }
    out.push({ item_id: `${dim}_qR`, dimension: dim,
               value: clamp(Math.round(6 - trait + (rng() - 0.5)), 1, 5),
               reverse_keyed: true, scale_max: 5,
               duration_ms: 1500 + Math.round(rng() * 4000) });
  }
  // One contradiction pair
  out.push({ item_id: 'cp_a', dimension: 'comm', value: 5, scale_max: 5, duration_ms: 2000 });
  out.push({ item_id: 'cp_b', dimension: 'comm', value: 1, scale_max: 5, duration_ms: 1900, pair_of: 'cp_a' });
  return out;
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------
function withinDimensionConsistency(responses: ResponseRecord[]): number {
  const byDim = groupBy(responses.filter(r => r.dimension && !r.reverse_keyed), r => r.dimension!);
  if (!Object.keys(byDim).length) return 1;
  let total = 0; let count = 0;
  for (const items of Object.values(byDim)) {
    if (items.length < 2) continue;
    const scaleMax = items[0].scale_max ?? 5;
    const xs = items.map(i => i.value / scaleMax);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
    // Map variance (max possible = 0.25 on unit scale) → 0..1 agreement
    total += 1 - Math.min(1, variance * 4);
    count += 1;
  }
  return count ? total / count : 1;
}

function reverseItemValidity(responses: ResponseRecord[]): number {
  const reverse = responses.filter(r => r.reverse_keyed && r.dimension);
  if (!reverse.length) return 1;
  let ok = 0; let total = 0;
  for (const rev of reverse) {
    const peers = responses.filter(r => r.dimension === rev.dimension && !r.reverse_keyed);
    if (!peers.length) continue;
    const scaleMax = rev.scale_max ?? 5;
    const peerMean = peers.reduce((s, p) => s + p.value, 0) / peers.length / scaleMax;
    const revFlipped = (scaleMax - rev.value) / scaleMax;
    const agreement = 1 - Math.abs(peerMean - revFlipped);
    ok += Math.max(0, agreement);
    total += 1;
  }
  return total ? ok / total : 1;
}

function detectContradictions(responses: ResponseRecord[]) {
  const byId = new Map(responses.map(r => [r.item_id, r]));
  const items: Array<{ a: string; b: string; delta: number }> = [];
  for (const r of responses) {
    if (!r.pair_of) continue;
    const other = byId.get(r.pair_of);
    if (!other) continue;
    const scaleMax = r.scale_max ?? 5;
    const delta = Math.abs(r.value - other.value) / scaleMax;
    if (delta > 0.6) items.push({ a: other.item_id, b: r.item_id, delta: round(delta, 3) });
  }
  return { count: items.length, items };
}

function completionQuality(responses: ResponseRecord[]): number {
  const durations = responses.map(r => r.duration_ms).filter((d): d is number => typeof d === 'number');
  if (!durations.length) return 0.7; // unknown — neutral-positive
  const fastPct = durations.filter(d => d < FAST_MS).length / durations.length;
  return Math.max(0, 1 - fastPct);
}

function detectAnomalies(responses: ResponseRecord[]): string[] {
  const flags: string[] = [];
  if (longestConstantRun(responses) / responses.length > 0.5) flags.push('straightlining');
  const durations = responses.map(r => r.duration_ms).filter((d): d is number => typeof d === 'number');
  if (durations.length && durations.filter(d => d < FAST_MS).length / durations.length > 0.4)
    flags.push('fast_responses');
  // Variance collapse — every item identical
  const uniq = new Set(responses.map(r => r.value));
  if (uniq.size === 1 && responses.length > 5) flags.push('zero_variance');
  return flags;
}

function longestConstantRun(responses: ResponseRecord[]): number {
  let best = 0, cur = 1;
  for (let i = 1; i < responses.length; i++) {
    if (responses[i].value === responses[i-1].value) { cur++; best = Math.max(best, cur); }
    else cur = 1;
  }
  return Math.max(best, cur);
}

function sessionStability(current: ResponseRecord[], prior: ResponseRecord[][]): number {
  const curByDim = dimMeans(current);
  let total = 0; let count = 0;
  for (const p of prior) {
    const prevByDim = dimMeans(p);
    for (const [dim, m] of Object.entries(curByDim)) {
      if (typeof prevByDim[dim] === 'number') {
        total += 1 - Math.min(1, Math.abs(m - prevByDim[dim]));
        count += 1;
      }
    }
  }
  return count ? total / count : 0.5;
}

function dimMeans(rs: ResponseRecord[]) {
  const by = groupBy(rs.filter(r => r.dimension), r => r.dimension!);
  const out: Record<string, number> = {};
  for (const [dim, items] of Object.entries(by)) {
    const sm = items[0].scale_max ?? 5;
    out[dim] = items.reduce((s, i) => s + i.value, 0) / items.length / sm;
  }
  return out;
}

function groupBy<T, K extends string>(arr: T[], k: (t: T) => K): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const a of arr) (out[k(a)] ??= []).push(a);
  return out;
}

function baseEmpty(sessionId: string): ReliabilityResult {
  return {
    session_id: sessionId,
    response_consistency: 0, reverse_item_validity: 0, contradiction_count: 0,
    contradictions: [], confidence_score: 0, reliability_index: 0,
    completion_quality: 0, anomaly_flags: ['no_responses'],
    stability_score: null, computed_at: new Date().toISOString(),
  };
}

const round = (v: number, dp = 2) => Math.round(v * 10 ** dp) / 10 ** dp;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
