/**
 * Progress Ledger — frontend read-layer (Career OS — Phase 5).
 *
 * ONE unified growth timeline across five axes — learning · behavior · career ·
 * competency · employability — assembled from the longitudinal snapshots the
 * platform ALREADY persists (`career_memory_snapshots`, surfaced by
 * `GET /api/career/behavioural-memory/:userId`).
 *
 * This is ORCHESTRATION, not a new compute engine. It NEVER recomputes
 * intelligence and NEVER writes — it reads the append-only snapshot history
 * (an honored platform constraint) and reshapes it into an explainable timeline
 * of value/delta entries, each carrying the evidence it was derived from. Pure,
 * deterministic, best-effort: missing/empty inputs degrade to an empty timeline
 * and consumers fall back to their existing behaviour (no behaviour change when
 * absent). Developmental framing only — never hiring/suitability claims.
 */
import type { EvidenceRef } from './behaviorGraph';
import type { ActionRef } from './constraintEngine';

// ── Public shapes ─────────────────────────────────────────────────────────────
export type GrowthAxis = 'learning' | 'behavior' | 'career' | 'competency' | 'employability';

export interface LedgerEntry {
  ts: string;            // ISO timestamp of the snapshot the value was observed at
  axis: GrowthAxis;
  metric: string;        // non-generic metric name (e.g. "Emotional intelligence")
  value: number;         // the metric value at `ts` (native scale, see notes)
  delta: number;         // change vs the previous observation on the same metric
  cause?: ActionRef;     // set when attributable (P6 supplies it); else observational
  evidence: EvidenceRef[];
}

export interface GrowthSummary {
  totalEntries: number;
  byAxisDelta: Record<GrowthAxis, number>;   // net delta accumulated per axis
  netImprovement: number;                    // sum of all axis net deltas
  topMover: { axis: GrowthAxis; metric: string; delta: number } | null;
  window: { from: string; to: string } | null;
}

export interface GrowthTimeline {
  entries: LedgerEntry[];                        // chronological (oldest → newest)
  byAxis: Record<GrowthAxis, LedgerEntry[]>;
  summary: GrowthSummary;
}

// ── Raw source (subset of the behavioural-memory response we consume) ──────────
export interface MemorySnapshotRaw {
  id?: string;
  snapshot_at: string;
  ei_score?: number | string | null;
  market_readiness?: number | string | null;
  interview_readiness?: number | string | null;
  transition_probability?: number | string | null;  // stored 0..1
  current_stage?: string | null;
  signals?: Array<{ key?: string; label?: string; strength?: number }>;
  patterns?: Array<{ key?: string; label?: string; confidence?: number }>;
  interventions?: Array<{ key?: string; label?: string; status?: string }>;
  outcomes?: Array<{ key?: string; label?: string; strength?: number }>;
}

export interface ProgressLedgerSources {
  /** Behavioural-memory snapshots (any order — sorted internally). */
  snapshots: MemorySnapshotRaw[];
}

const AXES: GrowthAxis[] = ['learning', 'behavior', 'career', 'competency', 'employability'];

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function emptyByAxis<T>(make: () => T): Record<GrowthAxis, T> {
  return AXES.reduce((acc, a) => { acc[a] = make(); return acc; }, {} as Record<GrowthAxis, T>);
}

/** One tracked metric → which axis it belongs to, its label, and a scale factor
 *  so deltas across metrics are comparable (everything normalised to a 0..100 view). */
const METRICS: Array<{
  axis: GrowthAxis;
  metric: string;
  field: keyof MemorySnapshotRaw;
  scale: number;            // multiply raw value by this for the comparable view
}> = [
  { axis: 'employability', metric: 'Emotional intelligence', field: 'ei_score', scale: 1 },
  { axis: 'career', metric: 'Market readiness', field: 'market_readiness', scale: 1 },
  { axis: 'career', metric: 'Transition probability', field: 'transition_probability', scale: 100 },
  { axis: 'behavior', metric: 'Interview readiness', field: 'interview_readiness', scale: 1 },
];

/**
 * Assemble the unified Progress Ledger from already-fetched snapshots.
 * Pure & deterministic. Each scalar metric yields one entry per snapshot in which
 * it is present (value = the reading, delta = change since the previous reading of
 * that same metric). Per-snapshot interventions/outcomes yield observational
 * `learning` entries. Empty/insufficient input → an empty (but well-formed) timeline.
 */
export function buildProgressLedger(sources: ProgressLedgerSources): GrowthTimeline {
  const snaps = (Array.isArray(sources?.snapshots) ? sources.snapshots : [])
    .filter((s) => s && s.snapshot_at)
    .slice()
    .sort((a, b) => new Date(a.snapshot_at).getTime() - new Date(b.snapshot_at).getTime());

  const entries: LedgerEntry[] = [];

  // ── Scalar metric series → one entry per reading, delta vs previous reading ──
  for (const m of METRICS) {
    let prev: number | null = null;
    for (const s of snaps) {
      const raw = num(s[m.field]);
      if (!Number.isFinite(raw)) continue;
      const value = round2(raw * m.scale);
      const delta = prev === null ? 0 : round2(value - prev);
      entries.push({
        ts: s.snapshot_at,
        axis: m.axis,
        metric: m.metric,
        value,
        delta,
        evidence: [{
          source: 'csi',
          ref: `${String(m.field)}@${s.snapshot_at}`,
          detail: prev === null
            ? `${m.metric} first recorded at ${value}`
            : `${m.metric} ${delta >= 0 ? '+' : ''}${delta} (now ${value})`,
        }],
      });
      prev = value;
    }
  }

  // ── Learning axis ← realized outcome strength per snapshot (a real series, not a
  //    flat observational marker). Value = mean recorded outcome strength scaled to
  //    the comparable 0..100 view; delta = change vs the previous outcome reading.
  //    Snapshots with no recorded outcomes are skipped (the axis degrades to empty
  //    rather than fabricating movement). ──
  let prevLearn: number | null = null;
  for (const s of snaps) {
    const outcomes = Array.isArray(s.outcomes) ? s.outcomes : [];
    if (outcomes.length === 0) continue;
    const value = round2((outcomes.reduce((acc, o) => acc + (num(o.strength) || 0), 0) / outcomes.length) * 100);
    const delta = prevLearn === null ? 0 : round2(value - prevLearn);
    const interventions = Array.isArray(s.interventions) ? s.interventions : [];
    const lead = interventions[0]?.label || interventions[0]?.key || outcomes[0]?.label || outcomes[0]?.key || 'learning activity';
    entries.push({
      ts: s.snapshot_at,
      axis: 'learning',
      metric: 'Learning outcomes',
      value,
      delta,
      evidence: [{
        source: 'capadex',
        ref: `learning@${s.snapshot_at}`,
        detail: prevLearn === null
          ? `Learning outcomes first recorded at ${value} (${lead})`
          : `Learning outcomes ${delta >= 0 ? '+' : ''}${delta} (now ${value}, ${lead})`,
      }],
    });
    prevLearn = value;
  }

  // Chronological order across all axes.
  entries.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  // ── Group + summarise ───────────────────────────────────────────────────────
  const byAxis = emptyByAxis<LedgerEntry[]>(() => []);
  for (const e of entries) byAxis[e.axis].push(e);

  const byAxisDelta = emptyByAxis<number>(() => 0);
  let topMover: GrowthSummary['topMover'] = null;
  for (const e of entries) {
    byAxisDelta[e.axis] = round2(byAxisDelta[e.axis] + e.delta);
    if (e.delta !== 0 && (!topMover || Math.abs(e.delta) > Math.abs(topMover.delta))) {
      topMover = { axis: e.axis, metric: e.metric, delta: e.delta };
    }
  }
  const netImprovement = round2(AXES.reduce((acc, a) => acc + byAxisDelta[a], 0));
  const window = entries.length
    ? { from: entries[0].ts, to: entries[entries.length - 1].ts }
    : null;

  return {
    entries,
    byAxis,
    summary: { totalEntries: entries.length, byAxisDelta, netImprovement, topMover, window },
  };
}

// ── Milestones ────────────────────────────────────────────────────────────────
export type MilestoneKind = 'baseline' | 'breakthrough' | 'recovery' | 'setback';

export interface Milestone {
  ts: string;
  axis: GrowthAxis;
  metric: string;
  kind: MilestoneKind;
  value: number;
  delta: number;
  label: string;          // non-generic — names the metric and the movement
  evidence: EvidenceRef[];
}

const MILESTONE_RANK: Record<MilestoneKind, number> = { breakthrough: 3, recovery: 2, setback: 1, baseline: 0 };

/**
 * Derive notable points on the timeline — the moments worth narrating. Pure &
 * deterministic; every milestone names a real metric movement (never generic):
 *  - `baseline`     first reading of a metric series (the point we measure from);
 *  - `breakthrough` the single largest positive jump on each metric series;
 *  - `recovery`     a positive reading that follows a negative one (turning point);
 *  - `setback`      a notable decline (|Δ| ≥ 5 on the comparable 0..100 view).
 * Returns `[]` for an empty timeline. Newest-first, strongest-kind first.
 */
export function deriveMilestones(ledger: GrowthTimeline | null): Milestone[] {
  const entries = Array.isArray(ledger?.entries) ? ledger!.entries : [];
  if (entries.length === 0) return [];
  const milestones: Milestone[] = [];

  // Group into per-metric series (`axis::metric`) so movements are never conflated
  // across distinct metrics that share an axis (e.g. career's market readiness vs.
  // transition probability) — milestone selection stays per-metric and precise.
  const seriesMap = new Map<string, { axis: GrowthAxis; entries: LedgerEntry[] }>();
  for (const e of entries) {
    const key = `${e.axis}::${e.metric}`;
    if (!seriesMap.has(key)) seriesMap.set(key, { axis: e.axis, entries: [] });
    seriesMap.get(key)!.entries.push(e);
  }

  for (const { axis, entries: series } of seriesMap.values()) {
    if (series.length === 0) continue;

    // Baseline — the first reading establishes the measurement floor.
    const base = series[0];
    milestones.push({
      ts: base.ts, axis, metric: base.metric, kind: 'baseline', value: base.value, delta: 0,
      label: `${base.metric} baseline set at ${base.value}`,
      evidence: base.evidence || [],
    });

    // Breakthrough — the biggest single positive jump on this axis.
    let breakthrough: LedgerEntry | null = null;
    for (const e of series) {
      if (e.delta > 0 && (!breakthrough || e.delta > breakthrough.delta)) breakthrough = e;
    }
    if (breakthrough && breakthrough.delta >= 3) {
      milestones.push({
        ts: breakthrough.ts, axis, metric: breakthrough.metric, kind: 'breakthrough',
        value: breakthrough.value, delta: breakthrough.delta,
        label: `${breakthrough.metric} jumped +${breakthrough.delta} to ${breakthrough.value}`,
        evidence: breakthrough.evidence || [],
      });
    }

    // Recovery — first positive move that follows a decline on the same metric.
    let prevDown = false;
    for (const e of series) {
      if (prevDown && e.delta > 0) {
        milestones.push({
          ts: e.ts, axis, metric: e.metric, kind: 'recovery', value: e.value, delta: e.delta,
          label: `${e.metric} recovered +${e.delta} after a dip`,
          evidence: e.evidence || [],
        });
        break;
      }
      if (e.delta < 0) prevDown = true;
    }

    // Setback — the most significant decline (worth naming for honesty).
    let setback: LedgerEntry | null = null;
    for (const e of series) {
      if (e.delta <= -5 && (!setback || e.delta < setback.delta)) setback = e;
    }
    if (setback) {
      milestones.push({
        ts: setback.ts, axis, metric: setback.metric, kind: 'setback', value: setback.value, delta: setback.delta,
        label: `${setback.metric} dropped ${setback.delta} to ${setback.value}`,
        evidence: setback.evidence || [],
      });
    }
  }

  return milestones.sort((a, b) => {
    const t = new Date(b.ts).getTime() - new Date(a.ts).getTime();
    return t !== 0 ? t : MILESTONE_RANK[b.kind] - MILESTONE_RANK[a.kind];
  });
}

function authHeader(): Record<string, string> {
  try {
    const t = localStorage.getItem('metryx_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

/**
 * Fetch + assemble the user's Progress Ledger from the existing behavioural-memory
 * endpoint (`requireAuth` + IDOR-guarded). Best-effort: returns `null` on any
 * failure / when there are too few snapshots to form a trend — callers degrade to
 * their existing view (no behaviour change when absent).
 */
export async function fetchProgressLedger(userId: string): Promise<GrowthTimeline | null> {
  if (!userId) return null;
  try {
    const r = await fetch(`/api/career/behavioural-memory/${userId}`, {
      headers: authHeader() as HeadersInit,
      credentials: 'include',
    });
    if (!r.ok) return null;
    const d = await r.json();
    const snapshots = Array.isArray(d?.snapshots) ? (d.snapshots as MemorySnapshotRaw[]) : [];
    if (snapshots.length < 2) return null; // a single point is not a trend
    const ledger = buildProgressLedger({ snapshots });
    return ledger.entries.length ? ledger : null;
  } catch {
    return null;
  }
}
