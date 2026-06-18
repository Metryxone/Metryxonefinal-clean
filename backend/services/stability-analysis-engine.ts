/**
 * Longitudinal Stability Analysis — Phase 3.
 *
 * Consumes the per-signal evolution timeline from `behavioural-memory.ts`
 * and emits stability flags + a composite stability index ∈ [0,1].
 *
 * Flag families:
 *   temporary_spike            — latest point > prior_mean + 2σ AND prior n ≥ 3
 *   inconsistency              — stddev of strength > 0.18 across ≥ 4 points
 *   coaching_contamination     — ≥ 5 signals jump by Δ ≥ 0.20 within the same
 *                                 7-day window (uniform externally-induced uplift)
 *   behavioural_instability    — ≥ 3 direction changes in the last 6 points
 *
 * Composite stability_index (1.0 = perfectly stable):
 *   1.0 − 0.30·spike − 0.30·inconsistency − 0.25·contamination − 0.15·instability
 *
 * Pure function. No DB. Never throws. Returns an empty-flag envelope if the
 * timeline is too sparse to analyse.
 */

import type { MemoryEvolutionSummary } from './behavioural-memory.js';

export const STABILITY_VERSION = '3.0.0';

export type StabilitySeverity = 'low' | 'medium' | 'high';

export interface StabilityFlag {
  rule_id: 'temporary_spike' | 'inconsistency'
         | 'coaching_contamination' | 'behavioural_instability';
  signal_key?: string;
  severity: StabilitySeverity;
  title: string;
  detail: string;
  evidence: Record<string, number | string>;
  developmental_action: string;
}

export interface StabilityResult {
  version: string;
  user_id: string;
  window_days: number;
  signals_analysed: number;
  signals_too_sparse: number;
  flags: StabilityFlag[];
  stability_index: number;     // 0..1
  per_signal: Array<{
    signal_key: string;
    points: number;
    stddev: number;
    direction_changes: number;
    latest_z: number | null;
  }>;
}

const CONTAMINATION_WINDOW_DAYS = 7;
const CONTAMINATION_MIN_SIGNALS = 5;
const CONTAMINATION_MIN_JUMP    = 0.20;
const INSTABILITY_MIN_CHANGES   = 3;
const INSTABILITY_LOOKBACK      = 6;
const INCONSISTENCY_MIN_POINTS  = 4;
const INCONSISTENCY_SD_THRESH   = 0.18;
const SPIKE_MIN_PRIOR_POINTS    = 3;
const SPIKE_Z                   = 2.0;

export function analyseStability(args: {
  user_id: string;
  window_days: number;
  evolution: MemoryEvolutionSummary[];
}): StabilityResult {
  const flags: StabilityFlag[] = [];
  const perSignal: StabilityResult['per_signal'] = [];
  let analysed = 0, sparse = 0;

  // Per-signal analysis
  for (const t of args.evolution) {
    const points = t.points ?? [];
    if (points.length < 2) { sparse++; perSignal.push({
      signal_key: t.signal_key, points: points.length, stddev: 0, direction_changes: 0, latest_z: null });
      continue;
    }
    analysed++;

    const strengths = points.map(p => p.behavioural_strength);
    const sd = stddev(strengths);
    const directionChanges = countDirectionChanges(strengths);
    let latestZ: number | null = null;

    // temporary_spike
    if (points.length >= SPIKE_MIN_PRIOR_POINTS + 1) {
      const prior = strengths.slice(0, -1);
      const priorMean = mean(prior);
      const priorSd = stddev(prior);
      latestZ = priorSd > 0 ? (strengths[strengths.length - 1] - priorMean) / priorSd : null;
      if (latestZ != null && latestZ > SPIKE_Z) {
        flags.push({
          rule_id: 'temporary_spike',
          signal_key: t.signal_key,
          severity: latestZ > 3 ? 'high' : 'medium',
          title: `Sudden spike in "${t.signal_key}"`,
          detail: `Latest data point is ${latestZ.toFixed(1)}σ above the prior mean — verify with a fresh evidence source before treating this as a real shift.`,
          evidence: { latest_z: round3(latestZ), prior_mean: round3(priorMean), prior_sd: round3(priorSd), prior_points: prior.length },
          developmental_action: 'Re-collect this signal from an independent narrative source to confirm the shift is genuine.',
        });
      }
    }

    // inconsistency
    if (points.length >= INCONSISTENCY_MIN_POINTS && sd > INCONSISTENCY_SD_THRESH) {
      flags.push({
        rule_id: 'inconsistency',
        signal_key: t.signal_key,
        severity: sd > 0.30 ? 'high' : 'medium',
        title: `High variability in "${t.signal_key}"`,
        detail: `Strength fluctuates with stddev ${sd.toFixed(2)} across ${points.length} measurements — pattern is not yet stable.`,
        evidence: { stddev: round3(sd), points: points.length },
        developmental_action: 'Accumulate 3–5 more consistent evidence sources before treating this signal as established.',
      });
    }

    // behavioural_instability — direction changes in last N points
    const tail = strengths.slice(-INSTABILITY_LOOKBACK);
    const tailChanges = countDirectionChanges(tail);
    if (tail.length >= INSTABILITY_LOOKBACK && tailChanges >= INSTABILITY_MIN_CHANGES) {
      flags.push({
        rule_id: 'behavioural_instability',
        signal_key: t.signal_key,
        severity: tailChanges >= 5 ? 'high' : 'medium',
        title: `Oscillating "${t.signal_key}" trajectory`,
        detail: `${tailChanges} direction changes in last ${INSTABILITY_LOOKBACK} points — signal is bouncing rather than developing.`,
        evidence: { direction_changes: tailChanges, lookback: INSTABILITY_LOOKBACK },
        developmental_action: 'Stabilise practice cadence before adding new development streams in this competency.',
      });
    }

    perSignal.push({
      signal_key: t.signal_key, points: points.length, stddev: round3(sd),
      direction_changes: directionChanges, latest_z: latestZ != null ? round3(latestZ) : null,
    });
  }

  // Cross-signal: coaching_contamination
  // Look for ≥ CONTAMINATION_MIN_SIGNALS distinct signals where the latest
  // point is ≥ CONTAMINATION_MIN_JUMP above the previous point AND both
  // points fall inside the same 7-day window.
  const window = collectRecentJumps(args.evolution);
  if (window.length >= CONTAMINATION_MIN_SIGNALS) {
    flags.push({
      rule_id: 'coaching_contamination',
      severity: window.length >= 8 ? 'high' : 'medium',
      title: 'Uniform behavioural uplift across multiple signals',
      detail: `${window.length} signals improved by ≥ ${(CONTAMINATION_MIN_JUMP * 100).toFixed(0)}% inside a single ${CONTAMINATION_WINDOW_DAYS}-day window. This pattern is consistent with coaching, scripted answers, or external priming rather than organic development.`,
      evidence: { affected_signals: window.length, window_days: CONTAMINATION_WINDOW_DAYS, min_jump: CONTAMINATION_MIN_JUMP },
      developmental_action: 'Cross-check these signals with a non-scripted source (free-form journal, peer feedback, unstructured interview).',
    });
  }

  // ── composite stability index ──────────────────────────────────────────
  const hasSpike    = flags.some(f => f.rule_id === 'temporary_spike');
  const hasIncon    = flags.some(f => f.rule_id === 'inconsistency');
  const hasContam   = flags.some(f => f.rule_id === 'coaching_contamination');
  const hasUnstable = flags.some(f => f.rule_id === 'behavioural_instability');
  const stability_index = clamp01(1
    - (hasSpike    ? 0.30 : 0)
    - (hasIncon    ? 0.30 : 0)
    - (hasContam   ? 0.25 : 0)
    - (hasUnstable ? 0.15 : 0));

  return {
    version: STABILITY_VERSION,
    user_id: args.user_id,
    window_days: args.window_days,
    signals_analysed: analysed,
    signals_too_sparse: sparse,
    flags,
    stability_index: round3(stability_index),
    per_signal: perSignal,
  };
}

// ── helpers ────────────────────────────────────────────────────────────────

function collectRecentJumps(evolution: MemoryEvolutionSummary[]): string[] {
  const out: string[] = [];
  // Find the most recent timestamp across all signals; jumps within the prior
  // 7-day window count.
  let maxTs = 0;
  for (const t of evolution) for (const p of t.points ?? []) {
    const ts = Date.parse(p.snapshot_ts);
    if (isFinite(ts) && ts > maxTs) maxTs = ts;
  }
  if (!maxTs) return out;
  const cutoff = maxTs - CONTAMINATION_WINDOW_DAYS * 86400_000;

  for (const t of evolution) {
    const points = t.points ?? [];
    if (points.length < 2) continue;
    const recent = points.filter(p => {
      const ts = Date.parse(p.snapshot_ts);
      return isFinite(ts) && ts >= cutoff;
    });
    if (recent.length < 2) continue;
    const first = recent[0].behavioural_strength;
    const last  = recent[recent.length - 1].behavioural_strength;
    if (last - first >= CONTAMINATION_MIN_JUMP) out.push(t.signal_key);
  }
  return out;
}

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}
function countDirectionChanges(xs: number[]): number {
  if (xs.length < 3) return 0;
  let changes = 0;
  let lastDir: 1 | -1 | 0 = 0;
  for (let i = 1; i < xs.length; i++) {
    const dir: 1 | -1 | 0 = xs[i] > xs[i - 1] ? 1 : xs[i] < xs[i - 1] ? -1 : 0;
    if (dir !== 0 && lastDir !== 0 && dir !== lastDir) changes++;
    if (dir !== 0) lastDir = dir;
  }
  return changes;
}
function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }
function round3(n: number): number { return Math.round(n * 1000) / 1000; }
