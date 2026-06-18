/**
 * Career Behavior Adapter (Phase 4 — CAPADEX → Career Builder integration).
 *
 * Career decisions must consume behavioural intelligence. This adapter turns the
 * already-persisted Unified Behavior Graph (the canonical, read-only source of all
 * behavioural intelligence) into a decision-ready `CareerBehaviorProfile` the Career
 * OS can act on across Future Map · Jobs · Interview · IDP · Weekly Actions.
 *
 * Inputs (all from the Behavior Graph — NO recompute, NO AI):
 *   - CSI               (csiFactors)        → baseline capacity / headroom
 *   - Signals           (signals)           → active behavioural drivers
 *   - Patterns          (patterns)          → synthesised behavioural patterns
 *   - Risk Factors      (risks)             → drag on overall career readiness
 *   - Growth Indicators (growthIndicators)  → trajectory boost / drag
 *
 * Outputs (CareerBehaviorProfile):
 *   careerReadiness · interviewReadiness · learningReadiness · executionReadiness ·
 *   leadershipReadiness · executionStyle · careerConstraints  (+ explainable drivers)
 *
 * The mapping is a curated, evidence-weighted lexicon (deterministic) — e.g.:
 *   Overthinking     → lower interview readiness
 *   Avoidance        → lower execution readiness
 *   Decision Fatigue → lower leadership readiness
 * Every adjustment is recorded as a non-generic `driver` (names the actual behavioural
 * concept + its career impact), so the profile is fully explainable, never a black box.
 *
 * Strictly read-only: `getBehaviorGraph` (no build), best-effort everywhere, never throws.
 */
import type { Pool } from 'pg';
import {
  getBehaviorGraph,
  type BehaviorGraph,
  type BehaviorGraphSignal,
  type BehaviorGraphPattern,
  type BehaviorGraphRisk,
  type BehaviorGraphGrowthIndicator,
  type BehaviorGraphCsiFactor,
} from './behavior-graph-service';

// ── Output shape ──────────────────────────────────────────────────────────────
export type ReadinessDim = 'interview' | 'execution' | 'leadership' | 'learning';

export interface CareerBehaviorDriver {
  output: ReadinessDim | 'career';
  delta: number; // signed adjustment applied (rounded)
  reason: string; // non-generic — names the behavioural concept + its career impact
  source: 'signal' | 'pattern' | 'risk' | 'growth' | 'csi';
}

export interface CareerBehaviorProfile {
  careerReadiness: number; // 0..100 — overall behavioural readiness, net of risk
  interviewReadiness: number; // 0..100
  learningReadiness: number; // 0..100
  executionReadiness: number; // 0..100
  leadershipReadiness: number; // 0..100
  executionStyle: string; // descriptive working style (developmental framing)
  careerConstraints: string[]; // behavioural constraints limiting career moves
  drivers: CareerBehaviorDriver[]; // explainability — every adjustment, traced
  confidence: number; // 0..1 — evidence volume + quality
  sources: string[]; // which inputs actually contributed
  generated_at: string;
}

export interface CareerBehaviorInput {
  signals: BehaviorGraphSignal[];
  patterns: BehaviorGraphPattern[];
  risks: BehaviorGraphRisk[];
  growthIndicators: BehaviorGraphGrowthIndicator[];
  csiFactors: BehaviorGraphCsiFactor[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function norm01(v: unknown): number {
  let n = num(v);
  if (n > 1 && n <= 100) n = n / 100;
  if (n < 0) n = 0;
  if (n > 1) n = 1;
  return n;
}
function pct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
function clampRange(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
/** Normalised matchable text for a signal/pattern (key + label, lower, spaced). */
function tokenText(key: string, label?: string | null): string {
  return `${key || ''} ${label || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// ── Behavioural lexicon (curated, non-generic, evidence-weighted) ──────────────
// A behavioural concept lowers (penalty) specific readiness dimensions. Weights are
// "points per unit evidence" (evidence ∈ 0..1), so a strong, confident signal bites
// harder than a weak one. Each entry yields a concrete, named career constraint.
interface PenaltyEntry {
  id: string;
  match: RegExp;
  concept: string;
  weights: Partial<Record<ReadinessDim, number>>;
  constraint: string;
  style?: string;
}
const PENALTY_LEXICON: PenaltyEntry[] = [
  {
    id: 'overthinking',
    match: /overthink|rumination|analysis paralysis|cognitive block|perfection|second guess/,
    concept: 'Overthinking',
    weights: { interview: 18, learning: 6 },
    constraint: 'Overthinking is dampening interview readiness — time-box preparation and answers',
    style: 'Reflective analyst — thorough, benefits from time-boxing',
  },
  {
    id: 'avoidance',
    match: /avoid|procrastinat|withdraw|disengage|escape|stall|deflect/,
    concept: 'Avoidance',
    weights: { execution: 18, interview: 6 },
    constraint: 'Avoidance is slowing execution — commit to one small, completed step each day',
    style: 'Cautious mover — benefits from small committed steps',
  },
  {
    id: 'decision_fatigue',
    match: /decision fatigue|indecis|choice overload|decision avoid|deliberat|vacillat|waver/,
    concept: 'Decision fatigue',
    weights: { leadership: 18, execution: 8 },
    constraint: 'Decision fatigue is limiting leadership readiness — adopt decision defaults and reduce low-stakes choices',
    style: 'Deliberation-heavy — benefits from decision frameworks and defaults',
  },
  {
    id: 'anxiety',
    match: /anxiet|nervous|emotional dysreg|overwhelm|tension|panic/,
    concept: 'Performance anxiety',
    weights: { interview: 12, leadership: 6 },
    constraint: 'Performance anxiety is affecting interview readiness — rehearse under realistic conditions',
  },
  {
    id: 'low_confidence',
    match: /low confidence|self doubt|imposter|insecur|self critical/,
    concept: 'Low self-confidence',
    weights: { interview: 12, leadership: 10 },
    constraint: 'Low self-confidence is suppressing interview and leadership readiness — keep an evidence log of wins',
  },
  {
    id: 'impulsivity',
    match: /impulsiv|impatien|rushed|hast|reactiv/,
    concept: 'Impulsivity',
    weights: { interview: 8, execution: 8 },
    constraint: 'Impulsivity may undercut interview composure — slow down and structure responses',
  },
  {
    id: 'fixed_mindset',
    match: /fixed mindset|rigid|low curiosity|closed to|defensive learning/,
    concept: 'Fixed mindset',
    weights: { learning: 16 },
    constraint: 'A fixed-mindset signal is limiting learning readiness — frame setbacks as iterations',
  },
  {
    id: 'depletion',
    match: /burnout|exhaust|depletion|drained|energy depleted/,
    concept: 'Depletion',
    weights: { execution: 10, leadership: 6, learning: 8 },
    constraint: 'Signs of depletion are reducing execution capacity — protect recovery time',
  },
];

// Strengths boost readiness (same evidence-weighting).
interface BoostEntry {
  id: string;
  match: RegExp;
  weights: Partial<Record<ReadinessDim, number>>;
  style?: string;
}
const BOOST_LEXICON: BoostEntry[] = [
  { id: 'momentum', match: /momentum|decisive|action orient|initiative|proactiv|follow through/, weights: { execution: 10, leadership: 6 }, style: 'Fast mover — benefits from validation checkpoints' },
  { id: 'curiosity', match: /curiosity|growth mindset|learning orient|adaptab|open to/, weights: { learning: 12 } },
  { id: 'resilience', match: /resilien|recover|grit|persever|composure/, weights: { execution: 8, leadership: 6, interview: 6 } },
  { id: 'collaboration', match: /collaborat|empath|communicat|influence|rapport/, weights: { leadership: 8, interview: 6 } },
];

const SEV_PENALTY: Record<string, number> = { critical: 18, high: 12, medium: 6, low: 2 };

/** Evidence weight for a signal: strength × confidence (fall back to whichever exists). */
function signalEvidence(s: BehaviorGraphSignal): number {
  const st = norm01(s.strength);
  const cf = norm01(s.confidence);
  if (st && cf) return st * cf;
  return st || cf || 0.4;
}

/**
 * PURE: derive the career behaviour profile from the five behavioural inputs.
 * Deterministic and explainable — same inputs → same profile, every adjustment traced.
 */
export function deriveCareerBehaviorProfile(input: CareerBehaviorInput): CareerBehaviorProfile {
  const signals = input.signals || [];
  const patterns = input.patterns || [];
  const risks = input.risks || [];
  const growth = input.growthIndicators || [];
  const csi = input.csiFactors || [];

  const drivers: CareerBehaviorDriver[] = [];

  // ── 1. Baseline from CSI capacity + growth trajectory ──
  const csiContribution = csi.find((f) => f.kind === 'contribution')?.value;
  const csiPositives = csi.filter((f) => f.kind === 'positive').length;
  const csiNegatives = csi.filter((f) => f.kind === 'negative').length;
  let base = csiContribution != null ? pct(norm01(csiContribution) * 100) : 55;
  if (csiContribution != null) {
    drivers.push({ output: 'career', delta: 0, reason: `CSI capacity sets a baseline readiness of ${base}%`, source: 'csi' });
  }
  const csiSwing = (csiPositives - csiNegatives) * 3;
  base += csiSwing;

  const growthNet = growth.reduce((a, g) => {
    const d = String(g.direction).toLowerCase();
    if (/improv|recover/.test(d)) return a + 1;
    if (/declin|worsen/.test(d)) return a - 1;
    if (/emerg/.test(d)) return a + 0.5;
    return a;
  }, 0);
  const growthAdj = clampRange(growthNet * 3, -12, 12);
  base = pct(base + growthAdj);
  if (growth.length && growthAdj !== 0) {
    drivers.push({ output: 'career', delta: Math.round(growthAdj), reason: `Behavioural trajectory is ${growthAdj > 0 ? 'improving' : 'declining'} across ${growth.length} indicator(s)`, source: 'growth' });
  }

  // ── 2. Initialise readiness dimensions at the baseline ──
  const dim: Record<ReadinessDim, number> = { interview: base, execution: base, leadership: base, learning: base };
  const conceptPenaltyTotal: Record<string, number> = {};
  const constraints = new Set<string>();
  let dominantStyle: string | null = null;
  let dominantStyleWeight = 0;

  const applyWeights = (
    weights: Partial<Record<ReadinessDim, number>>,
    evidence: number,
    sign: 1 | -1,
    source: CareerBehaviorDriver['source'],
    reason: string,
    concept?: string,
  ) => {
    (Object.keys(weights) as ReadinessDim[]).forEach((d) => {
      const w = weights[d] || 0;
      const delta = sign * Math.round(w * evidence);
      if (delta === 0) return;
      dim[d] = dim[d] + delta;
      drivers.push({ output: d, delta, reason, source });
      if (sign < 0 && concept) conceptPenaltyTotal[concept] = (conceptPenaltyTotal[concept] || 0) + Math.abs(delta);
    });
  };

  // ── 3. Apply behavioural concepts from signals + patterns ──
  const apply = (text: string, evidence: number, source: 'signal' | 'pattern') => {
    for (const e of PENALTY_LEXICON) {
      if (!e.match.test(text)) continue;
      applyWeights(e.weights, evidence, -1, source, `${e.concept} (from ${source}) lowers readiness`, e.concept);
      constraints.add(e.constraint);
      const styleW = Math.max(...Object.values(e.weights as Record<string, number>)) * evidence;
      if (e.style && styleW > dominantStyleWeight) { dominantStyle = e.style; dominantStyleWeight = styleW; }
    }
    for (const e of BOOST_LEXICON) {
      if (!e.match.test(text)) continue;
      applyWeights(e.weights, evidence, 1, source, `Strength signal "${e.id}" (from ${source}) lifts readiness`, undefined);
      const styleW = Math.max(...Object.values(e.weights as Record<string, number>)) * evidence;
      if (e.style && styleW > dominantStyleWeight) { dominantStyle = e.style; dominantStyleWeight = styleW; }
    }
  };
  for (const s of signals) apply(tokenText(s.signal_key, null), signalEvidence(s), 'signal');
  for (const p of patterns) apply(tokenText(p.pattern_key, p.label), norm01(p.confidence) || 0.5, 'pattern');

  // ── 4. Risk factors drag overall career readiness (and leadership for control risks) ──
  let riskPenalty = 0;
  for (const r of risks) {
    const sev = String(r.severity).toLowerCase();
    const p = SEV_PENALTY[sev] ?? 0;
    if (!p) continue;
    riskPenalty += p;
    if (/decision|impuls|control|conflict/.test(`${r.type} ${r.risk_key}`.toLowerCase())) {
      const lead = Math.round(p * 0.5);
      dim.leadership -= lead;
      drivers.push({ output: 'leadership', delta: -lead, reason: `${sev} risk "${r.type}" weighs on leadership readiness`, source: 'risk' });
    }
    if (sev === 'critical' || sev === 'high') constraints.add(`High-severity behavioural risk: ${r.description || r.type}`);
  }
  riskPenalty = Math.min(riskPenalty, 30);

  // ── 5. Clamp dimensions; roll up overall career readiness ──
  (Object.keys(dim) as ReadinessDim[]).forEach((d) => { dim[d] = pct(dim[d]); });
  const dimMean = (dim.interview + dim.execution + dim.leadership + dim.learning) / 4;
  const careerReadiness = pct(dimMean - riskPenalty);
  if (riskPenalty > 0) drivers.push({ output: 'career', delta: -riskPenalty, reason: `${risks.length} risk factor(s) reduce overall career readiness`, source: 'risk' });

  // ── 6. Execution style — dominant negative concept wins, else trajectory ──
  let executionStyle: string;
  if (dominantStyle) {
    executionStyle = dominantStyle;
  } else if (base >= 65) {
    executionStyle = 'Steady builder — consistent, evidence-led';
  } else if (growthNet > 0) {
    executionStyle = 'Rising mover — momentum building, keep the cadence';
  } else {
    executionStyle = 'Emerging explorer — building behavioural signal';
  }

  // ── 7. Constraints (capped, never empty) ──
  const careerConstraints = Array.from(constraints).slice(0, 5);
  if (careerConstraints.length === 0) {
    careerConstraints.push('No behavioural constraints are limiting your career moves right now');
  }

  // ── 8. Confidence — evidence volume + quality, plus CSI/growth coverage ──
  const sigConf = signals.length ? signals.reduce((a, s) => a + norm01(s.confidence), 0) / signals.length : 0;
  const patConf = patterns.length ? patterns.reduce((a, p) => a + norm01(p.confidence), 0) / patterns.length : 0;
  const meanConf = (sigConf + patConf) / (Number(signals.length > 0) + Number(patterns.length > 0) || 1);
  let confidence =
    0.15 +
    Math.min(signals.length, 5) * 0.07 +
    Math.min(patterns.length, 5) * 0.06 +
    (csiContribution != null ? 0.12 : 0) +
    (growth.length ? 0.08 : 0);
  confidence = Math.min(0.95, (confidence + meanConf) / 2 + confidence / 2);
  confidence = Number(Math.max(0, Math.min(0.95, confidence)).toFixed(3));

  // ── 9. Sources actually used ──
  const sources: string[] = [];
  if (signals.length) sources.push('signals');
  if (patterns.length) sources.push('patterns');
  if (risks.length) sources.push('risks');
  if (growth.length) sources.push('growth_indicators');
  if (csi.length) sources.push('csi');

  return {
    careerReadiness,
    interviewReadiness: dim.interview,
    learningReadiness: dim.learning,
    executionReadiness: dim.execution,
    leadershipReadiness: dim.leadership,
    executionStyle,
    careerConstraints,
    drivers,
    confidence,
    sources,
    generated_at: new Date().toISOString(),
  };
}

/** Neutral profile when no behavioural intelligence is stored — grounded, never invented. */
function neutralProfile(): CareerBehaviorProfile {
  return {
    careerReadiness: 55,
    interviewReadiness: 55,
    learningReadiness: 55,
    executionReadiness: 55,
    leadershipReadiness: 55,
    executionStyle: 'Emerging explorer — building behavioural signal',
    careerConstraints: ['No behavioural intelligence captured yet — complete an assessment to personalise this'],
    drivers: [],
    confidence: 0.1,
    sources: [],
    generated_at: new Date().toISOString(),
  };
}

/** Read-only: build the profile for a single CAPADEX session from its stored graph. */
export async function buildCareerBehaviorProfile(pool: Pool, sessionId: string): Promise<CareerBehaviorProfile> {
  const graph: BehaviorGraph | null = await getBehaviorGraph(pool, sessionId).catch(() => null);
  if (!graph) return neutralProfile();
  return deriveCareerBehaviorProfile({
    signals: graph.signals,
    patterns: graph.patterns,
    risks: graph.risks,
    growthIndicators: graph.growthIndicators,
    csiFactors: graph.csiFactors,
  });
}

/**
 * Read-only: build the profile for a career user. Bridges the Career-OS user to their
 * latest CAPADEX session via capadex_behavioural_memory (the Career-OS's own behavioural
 * memory time-series, which records session_id). Neutral profile when no session is found.
 */
export async function buildCareerBehaviorProfileForUser(
  pool: Pool,
  userId: string,
): Promise<{ profile: CareerBehaviorProfile; session_id: string | null }> {
  let sessionId: string | null = null;
  try {
    const { rows } = await pool.query(
      `SELECT session_id
         FROM capadex_behavioural_memory
        WHERE user_id = $1 AND session_id IS NOT NULL
        ORDER BY recorded_at DESC
        LIMIT 1`,
      [userId],
    );
    sessionId = rows[0]?.session_id ?? null;
  } catch { /* table may not exist yet — degrade to neutral */ }

  if (!sessionId) return { profile: neutralProfile(), session_id: null };
  const profile = await buildCareerBehaviorProfile(pool, sessionId);
  return { profile, session_id: sessionId };
}
