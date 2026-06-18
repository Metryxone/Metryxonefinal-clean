/**
 * Behavior Graph — frontend client (Career OS — Phase 2).
 *
 * A typed, read-only CLIENT over the canonical backend Unified Behavior Graph
 * (`backend/services/behavior-graph-service.ts`, persisted in
 * `capadex_behavior_graph`). It does NOT recompute behavioural intelligence — it
 * fetches the already-persisted graph via `GET /api/career/behavior-graph/:userId`
 * and reshapes it into the single consumer-facing surface every downstream Career-OS
 * module (Constraint Engine, Next Best Action, Progress Ledger, Passport, Copilot)
 * reads from.
 *
 * Strictly additive & best-effort: any failure / missing session yields `null`, and
 * callers fall back to their existing behaviour (no behaviour change when absent).
 * Developmental framing only — never hiring/suitability predictions (language policy).
 */

// ── Consumer-facing shapes ────────────────────────────────────────────────────
export type SourceTag =
  | 'capadex' | 'pragati' | 'assessment' | 'survey' | 'mentor'
  | 'simulation' | 'resume' | 'employer' | 'csi' | 'omega';

export interface EvidenceRef {
  source: SourceTag | string;
  ref: string;     // the underlying key (signal_key / pattern_key / risk_key …)
  detail: string;  // human-readable, non-generic
}

export interface GraphNode {
  id: string;
  label: string;
  severity?: number;   // 0..1 where applicable (risks)
  confidence: number;  // 0..1
  evidence: EvidenceRef[];
}

export interface CompetencySignal {
  domain: string;
  level: number;              // raw value as stored on the graph
  trend: 'up' | 'flat' | 'down';
  evidence: EvidenceRef[];
}

/** The unified Behavior Graph the Career OS consumes. */
export interface BehaviorGraph {
  strengths: GraphNode[];
  risks: GraphNode[];
  patterns: GraphNode[];
  contradictions: GraphNode[];
  growthDrivers: GraphNode[];
  growthBlockers: GraphNode[];
  competencySignals: CompetencySignal[];
  meta: {
    confidence: number;        // 0..1 — blended graph confidence
    sources: string[];         // subsystems that actually contributed
    sessionId: string | null;
    concern: string | null;
    generatedAt: string | null;
  };
}

// ── Raw backend graph (subset we consume) ─────────────────────────────────────
interface RawSignal { signal_key: string; strength: number; confidence: number; lifecycle_state: string | null; source: string }
interface RawPattern { pattern_key: string; label: string | null; confidence: number; signal_refs: string[]; explanation: string | null; source: string }
interface RawRisk { risk_key: string; type: string; severity: string; description: string; source: string }
interface RawGrowth { key: string; direction: string; detail: string; source: string }
interface RawCsi { factor: string; kind: string; value: number | null; detail: string }
interface RawGraph {
  session_id: string;
  concern: string | null;
  signals?: RawSignal[];
  patterns?: RawPattern[];
  risks?: RawRisk[];
  growthIndicators?: RawGrowth[];
  csiFactors?: RawCsi[];
  confidence?: number;
  contributors?: string[];
  generated_at?: string;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
/** Coerce confidence-like values into 0..1 (some sources store 0..100). */
function norm01(v: unknown): number {
  let n = num(v);
  if (n > 1 && n <= 100) n = n / 100;
  if (n < 0) n = 0;
  if (n > 1) n = 1;
  return n;
}
const SEVERITY_RANK: Record<string, number> = { critical: 1, high: 0.8, medium: 0.5, low: 0.25 };
function authHeader(): Record<string, string> {
  try {
    const t = localStorage.getItem('metryx_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

/**
 * Reshape the canonical backend graph into the unified consumer surface.
 * Deterministic and explainable — every node carries the evidence it came from.
 */
export function assembleBehaviorGraph(raw: RawGraph): BehaviorGraph {
  const patterns = Array.isArray(raw.patterns) ? raw.patterns : [];
  const risks = Array.isArray(raw.risks) ? raw.risks : [];
  const growth = Array.isArray(raw.growthIndicators) ? raw.growthIndicators : [];
  const csi = Array.isArray(raw.csiFactors) ? raw.csiFactors : [];

  // Strengths: genuinely positive-valence constructs ONLY. CAPADEX session signals
  // are concern-DIAGNOSTIC (overthinking, avoidance, …) and carry no positive valence,
  // so a high-strength signal is NOT a strength — surfacing it here would mislabel
  // adverse behaviour. The graph's only positive-valence source is CSI `positive_factors`
  // (kind 'positive'). Active concern signals remain represented downstream via patterns.
  const strengths: GraphNode[] = csi
    .filter((c) => c.kind === 'positive')
    .map((c) => ({
      id: c.factor,
      label: c.factor.replace(/_/g, ' '),
      confidence: c.value == null ? 0.6 : norm01(c.value),
      evidence: [{ source: 'csi', ref: c.factor, detail: c.detail || 'Positive contributor' }],
    }));

  const contradictions: GraphNode[] = risks
    .filter((r) => r.source === 'contradiction')
    .map((r) => ({
      id: r.risk_key,
      label: r.description || r.type,
      severity: SEVERITY_RANK[String(r.severity).toLowerCase()] ?? 0.5,
      confidence: 0.7,
      evidence: [{ source: 'capadex', ref: r.risk_key, detail: `Contradiction: ${r.description || r.type}` }],
    }));

  const riskNodes: GraphNode[] = risks
    .filter((r) => r.source !== 'contradiction')
    .map((r) => ({
      id: r.risk_key,
      label: r.description || r.type,
      severity: SEVERITY_RANK[String(r.severity).toLowerCase()] ?? 0.5,
      confidence: 0.7,
      evidence: [{ source: r.source === 'risk_flag' ? 'capadex' : 'omega', ref: r.risk_key, detail: `${r.type} risk (${r.severity})` }],
    }));

  const patternNodes: GraphNode[] = patterns.map((p) => ({
    id: p.pattern_key,
    label: p.label || p.pattern_key.replace(/_/g, ' '),
    confidence: norm01(p.confidence),
    evidence: [{ source: (p.source as SourceTag) || 'capadex', ref: p.pattern_key, detail: p.explanation || 'Synthesised behavioural pattern' }],
  }));

  const DRIVER_DIRS = new Set(['improving', 'recovering', 'emerging']);
  const BLOCKER_DIRS = new Set(['declining']);
  const growthDrivers: GraphNode[] = growth
    .filter((g) => DRIVER_DIRS.has(String(g.direction).toLowerCase()))
    .map((g) => ({ id: g.key, label: g.key.replace(/_/g, ' '), confidence: 0.6, evidence: [{ source: 'omega', ref: g.key, detail: g.detail || `Trajectory ${g.direction}` }] }));
  const growthBlockers: GraphNode[] = growth
    .filter((g) => BLOCKER_DIRS.has(String(g.direction).toLowerCase()))
    .map((g) => ({ id: g.key, label: g.key.replace(/_/g, ' '), confidence: 0.6, evidence: [{ source: 'omega', ref: g.key, detail: g.detail || `Trajectory ${g.direction}` }] }));

  // Competency signals — graph-native, from CSI domain factors. (Competency-engine
  // dimension enrichment is folded in by consumers in later phases.)
  const competencySignals: CompetencySignal[] = csi
    .filter((c) => c.kind === 'domain')
    .map((c) => ({
      domain: c.factor,
      level: num(c.value),
      trend: 'flat',
      evidence: [{ source: 'csi', ref: c.factor, detail: c.detail || 'CSI domain contribution' }],
    }));

  return {
    strengths,
    risks: riskNodes,
    patterns: patternNodes,
    contradictions,
    growthDrivers,
    growthBlockers,
    competencySignals,
    meta: {
      confidence: norm01(raw.confidence),
      sources: Array.isArray(raw.contributors) ? raw.contributors : [],
      sessionId: raw.session_id ?? null,
      concern: raw.concern ?? null,
      generatedAt: raw.generated_at ?? null,
    },
  };
}

/**
 * Fetch + assemble the user's Behavior Graph. Best-effort: returns `null` when no
 * graph is linked, the request fails, or auth is missing — callers degrade safely.
 */
export async function fetchBehaviorGraph(userId: string): Promise<BehaviorGraph | null> {
  if (!userId) return null;
  try {
    const r = await fetch(`/api/career/behavior-graph/${userId}`, {
      headers: authHeader() as HeadersInit,
      credentials: 'include',
    });
    if (!r.ok) return null;
    const d = await r.json();
    // Only adopt when a real linked session backs the graph (mirrors behavior-profile gating).
    if (!d?.graph || !d?.session_id) return null;
    return assembleBehaviorGraph(d.graph as RawGraph);
  } catch {
    return null;
  }
}
