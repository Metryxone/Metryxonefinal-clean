/**
 * Outcome Attribution Engine — frontend read-layer (Career OS — Phase 6).
 *
 * Connects actions → outcomes: "this intervention moved this metric by +Δ".
 * It reshapes the SAME already-persisted longitudinal history the Progress Ledger
 * (P5) reads — it NEVER recomputes intelligence and NEVER writes.
 *
 * Method (pre/post, baseline-netted): for each completed action observed at time
 * A, find the next reading of a relevant metric AFTER A in the ledger; the change
 * at that reading is the observed delta, and the attributed delta is that net of
 * the metric's baseline drift (its mean per-step change across the whole window).
 * Confidence blends window proximity (sooner ⇒ stronger) with isolation (fewer
 * concurrent actions ⇒ cleaner attribution). Where a stored `outcome_score` /
 * learning-attribution signal exists it is preferred and recorded as the method.
 *
 * NOTE — the action→effectiveness loop is ALREADY closed server-side: the backend
 * Best-Next-Action ranker (`intervention-intelligence.ts`) folds
 * `capadex_interventions.outcome_score` into `historicalEffectiveness`. This engine
 * SURFACES and EXPLAINS that loop for the user; it does not re-rank P4.
 *
 * Pure, deterministic, best-effort: empty/insufficient input → `[]`, never throws.
 * Developmental framing only — never hiring/suitability claims.
 */
import type { EvidenceRef } from './behaviorGraph';
import type { ActionRef } from './constraintEngine';
import type { GrowthAxis, GrowthTimeline, LedgerEntry } from './progressLedger';
import { buildProgressLedger, type MemorySnapshotRaw } from './progressLedger';

// ── Public shapes ─────────────────────────────────────────────────────────────
export type AttributionMethod = 'pre_post' | 'intervention_outcome_score' | 'learning_attribution';

export interface CompletedAction {
  id: string;
  kind: 'intervention' | 'assessment' | 'simulation' | 'course' | 'mentor' | 'other';
  title: string;
  ts: string;            // ISO timestamp the action was completed/observed
  axisHint?: GrowthAxis; // which growth axis it is expected to move
  outcomeScore?: number; // stored effectiveness (0..1 or 0..100), when known
}

export interface LearningAttributionRef {
  actionId?: string;
  metric?: string;
  delta?: number;
  ts?: string;
}

export interface Attribution {
  action: ActionRef;
  outcomeMetric: string;
  observedDelta: number;     // raw change at the post reading
  attributedDelta: number;   // observed net of baseline drift
  confidence: number;        // 0..1
  method: AttributionMethod;
  evidence: EvidenceRef[];
  explanation: string;       // non-generic — names the action, metric and Δ
}

export interface AttributionInput {
  ledger: GrowthTimeline;
  actionLog: CompletedAction[];
  learningAttribution?: LearningAttributionRef[];
}

const REVIEW_WINDOW_MS = 1000 * 60 * 60 * 24 * 45; // 45 days post-action

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function slug(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'action';
}
function ms(ts: string): number {
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/** Mean per-step delta of a metric across the whole window — the baseline drift we net out. */
function baselineDrift(entries: LedgerEntry[]): number {
  const moving = entries.filter((e) => e.delta !== 0);
  if (moving.length === 0) return 0;
  return moving.reduce((acc, e) => acc + e.delta, 0) / moving.length;
}

/**
 * Attribute observed metric movements to the completed actions that plausibly
 * caused them. Pure & deterministic; safe on empty inputs.
 */
export function attributeOutcomes(input: AttributionInput): Attribution[] {
  const entries = Array.isArray(input?.ledger?.entries) ? input.ledger.entries : [];
  const actions = Array.isArray(input?.actionLog) ? input.actionLog : [];
  const learning = Array.isArray(input?.learningAttribution) ? input.learningAttribution : [];
  if (entries.length === 0 || actions.length === 0) return [];

  // Group movement entries by METRIC SERIES (axis::metric), skipping the first
  // reading of each (delta 0). Baseline drift is computed per metric — never pooled
  // across an axis — so netting market_readiness movement never contaminates
  // transition_probability (both live on the `career` axis) and vice-versa.
  const metricKey = (e: { axis: GrowthAxis; metric: string }) => `${e.axis}::${e.metric}`;
  const moversByMetric = new Map<string, { axis: GrowthAxis; metric: string; entries: LedgerEntry[] }>();
  for (const e of entries) {
    if (e.delta === 0) continue;
    const key = metricKey(e);
    const bucket = moversByMetric.get(key) || { axis: e.axis, metric: e.metric, entries: [] };
    bucket.entries.push(e);
    moversByMetric.set(key, bucket);
  }
  const driftByMetric = new Map<string, number>();
  for (const [key, bucket] of moversByMetric) driftByMetric.set(key, baselineDrift(bucket.entries));

  const out: Attribution[] = [];

  for (const action of actions) {
    const aTs = ms(action.ts);
    if (!Number.isFinite(aTs)) continue;

    // Candidate metric series: every series with movement, optionally narrowed to
    // the action's hinted axis (when a caller supplies one).
    const candidates = Array.from(moversByMetric.values())
      .filter((m) => !action.axisHint || m.axis === action.axisHint);

    // Find the nearest post-action movement across candidate series within the window.
    let best: { entry: LedgerEntry; key: string; gap: number } | null = null;
    for (const m of candidates) {
      for (const e of m.entries) {
        const gap = ms(e.ts) - aTs;
        if (gap <= 0 || gap > REVIEW_WINDOW_MS) continue;
        if (!best || gap < best.gap) best = { entry: e, key: metricKey(m), gap };
      }
    }
    if (!best) continue;

    // Isolation: how many other actions fall between the action and the post reading.
    const concurrent = actions.filter((o) => {
      if (o === action) return false;
      const oTs = ms(o.ts);
      return Number.isFinite(oTs) && oTs >= aTs && oTs <= ms(best!.entry.ts);
    }).length;

    const observedDelta = round2(best.entry.delta);
    const drift = driftByMetric.get(best.key) ?? 0;
    const attributedDelta = round2(observedDelta - drift);

    // Prefer a stored effectiveness signal where present, else a learning-attribution match.
    const learnMatch = learning.find((l) => l.actionId && l.actionId === action.id);
    const method: AttributionMethod = Number.isFinite(action.outcomeScore as number)
      ? 'intervention_outcome_score'
      : learnMatch
        ? 'learning_attribution'
        : 'pre_post';

    // Confidence = proximity × isolation, lifted when a stored outcome score backs it.
    const proximity = clamp01(1 - best.gap / REVIEW_WINDOW_MS);
    const isolation = clamp01(1 / (1 + concurrent));
    let confidence = clamp01(proximity * 0.6 + isolation * 0.4);
    if (method === 'intervention_outcome_score') confidence = clamp01(confidence * 0.7 + 0.3);

    const ref: ActionRef = {
      id: `attr_${slug(action.title)}_${slug(best.entry.metric)}`,
      label: action.title,
      hint: `${action.title} → ${best.entry.metric}`,
    };
    const sign = attributedDelta >= 0 ? '+' : '';
    const evidence: EvidenceRef[] = [
      { source: 'capadex', ref: `action_${slug(action.title)}`, detail: `${action.title} (${action.kind}) on ${new Date(action.ts).toLocaleDateString('en-IN')}` },
      ...(best.entry.evidence || []),
    ];

    out.push({
      action: ref,
      outcomeMetric: best.entry.metric,
      observedDelta,
      attributedDelta,
      confidence: round2(confidence),
      method,
      evidence: evidence.slice(0, 4),
      explanation: `"${action.title}" preceded a ${sign}${attributedDelta} change in ${best.entry.metric} `
        + `(${observedDelta} observed, net of ${round2(drift)} baseline drift)`
        + `${concurrent > 0 ? `, alongside ${concurrent} other action${concurrent === 1 ? '' : 's'}` : ''}.`,
    });
  }

  // Strongest, most trustworthy attributions first.
  out.sort((a, b) =>
    (Math.abs(b.attributedDelta) * b.confidence) - (Math.abs(a.attributedDelta) * a.confidence),
  );
  return out;
}

/** Derive a completed-action log from behavioural-memory snapshots: each snapshot's
 *  interventions are treated as actions observed at that snapshot's time. When the
 *  same snapshot recorded realized outcomes, their mean strength (0..1) is attached
 *  as `outcomeScore` — a real measured-outcome context that lets the attribution
 *  prefer the `intervention_outcome_score` method over a bare pre/post inference.
 *  No axis is forced: attribution considers every metric series that actually moved. */
export function deriveActionLog(snapshots: MemorySnapshotRaw[]): CompletedAction[] {
  const snaps = Array.isArray(snapshots) ? snapshots : [];
  const log: CompletedAction[] = [];
  for (const s of snaps) {
    if (!s?.snapshot_at) continue;
    const interventions = Array.isArray(s.interventions) ? s.interventions : [];
    const outcomes = Array.isArray(s.outcomes) ? s.outcomes : [];
    const outcomeScore = outcomes.length
      ? outcomes.reduce((acc, o) => acc + (Number(o.strength) || 0), 0) / outcomes.length
      : undefined;
    for (const iv of interventions) {
      const title = iv.label || iv.key;
      if (!title) continue;
      log.push({
        id: `${iv.key || slug(title)}@${s.snapshot_at}`,
        kind: 'intervention',
        title,
        ts: s.snapshot_at,
        ...(outcomeScore !== undefined ? { outcomeScore } : {}),
      });
    }
  }
  return log;
}

// ── Growth Story ──────────────────────────────────────────────────────────────
export interface GrowthStory {
  headline: string;        // non-generic one-line summary, grounded in real numbers
  chapters: string[];      // ordered narrative paragraphs, each tied to data
  drivers: string[];       // what CREATED improvement (from attributions)
  blockers: string[];      // what HELD BACK progress (declines / setbacks)
  confidence: number;      // 0..1 — mean confidence of the attributions it leans on
}

/**
 * Compose a grounded growth narrative from the SAME already-computed P5 ledger and
 * P6 attributions — no new data, no AI, never throws. Every sentence is anchored to
 * a real figure (net movement, the top mover, attributed deltas), so the story is
 * explainable rather than generic. Empty inputs → a truthful "not enough history"
 * story (never fabricated progress).
 */
export function buildGrowthStory(
  ledger: GrowthTimeline | null,
  attributions: Attribution[],
): GrowthStory {
  const entries = Array.isArray(ledger?.entries) ? ledger!.entries : [];
  const attrs = Array.isArray(attributions) ? attributions : [];
  if (entries.length === 0) {
    return {
      headline: 'Your growth story is still being written.',
      chapters: ['Complete another assessment to start tracking how your metrics move over time.'],
      drivers: [],
      blockers: [],
      confidence: 0,
    };
  }

  const s = ledger!.summary;
  const net = s.netImprovement;
  const since = s.window ? new Date(s.window.from).toLocaleDateString('en-IN') : null;
  const direction = net > 0 ? 'forward' : net < 0 ? 'backward' : 'sideways';

  const headline = net !== 0
    ? `Net ${net > 0 ? '+' : ''}${net} across your metrics${since ? ` since ${since}` : ''}.`
    : `Your metrics have held steady${since ? ` since ${since}` : ''}.`;

  const chapters: string[] = [];
  chapters.push(
    `Across ${s.totalEntries} recorded reading${s.totalEntries === 1 ? '' : 's'}, your overall trajectory is moving ${direction}`
    + `${s.topMover ? `, led by ${s.topMover.metric} (${s.topMover.delta > 0 ? '+' : ''}${s.topMover.delta})` : ''}.`,
  );

  // What created improvement — the strongest positive attributions, named.
  const positive = attrs.filter((a) => a.attributedDelta > 0).slice(0, 3);
  const drivers = positive.map(
    (a) => `${a.action.label} → ${a.outcomeMetric} +${a.attributedDelta} (${Math.round(a.confidence * 100)}% confidence)`,
  );
  if (positive.length) {
    chapters.push(
      `The clearest driver was "${positive[0].action.label}", which preceded a +${positive[0].attributedDelta} move in ${positive[0].outcomeMetric}.`,
    );
  }

  // What held back — axes that lost ground.
  const losing = (Object.keys(s.byAxisDelta) as GrowthAxis[])
    .filter((a) => s.byAxisDelta[a] < 0)
    .sort((a, b) => s.byAxisDelta[a] - s.byAxisDelta[b]);
  const blockers = losing.map((a) => `${a} slipped ${s.byAxisDelta[a]}`);
  if (losing.length) {
    chapters.push(`Where you lost ground: ${blockers.join(', ')} — these are the areas to protect next.`);
  } else if (net > 0) {
    chapters.push('No axis lost ground over this window — momentum is broad-based.');
  }

  const confidence = attrs.length
    ? round2(attrs.reduce((acc, a) => acc + a.confidence, 0) / attrs.length)
    : round2(clamp01(Math.min(1, s.totalEntries / 6)));

  return { headline, chapters, drivers, blockers, confidence };
}

function authHeader(): Record<string, string> {
  try {
    const t = localStorage.getItem('metryx_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

/**
 * Fetch the user's behavioural-memory history (IDOR-guarded endpoint), build the
 * P5 ledger, derive the action log, and attribute outcomes. Best-effort: returns
 * `[]` on any failure / when there is too little history to attribute anything.
 */
export async function fetchAttributions(userId: string): Promise<Attribution[]> {
  if (!userId) return [];
  try {
    const r = await fetch(`/api/career/behavioural-memory/${userId}`, {
      headers: authHeader() as HeadersInit,
      credentials: 'include',
    });
    if (!r.ok) return [];
    const d = await r.json();
    const snapshots = Array.isArray(d?.snapshots) ? (d.snapshots as MemorySnapshotRaw[]) : [];
    if (snapshots.length < 2) return [];
    const ledger = buildProgressLedger({ snapshots });
    const actionLog = deriveActionLog(snapshots);
    if (actionLog.length === 0) return [];
    return attributeOutcomes({ ledger, actionLog });
  } catch {
    return [];
  }
}
