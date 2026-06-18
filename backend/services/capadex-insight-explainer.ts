/**
 * CAPADEX Insight Explainer (Phase 3 — Explainability).
 *
 * Goal: allow EVERY report insight to be explained — from STORED intelligence only.
 * There is NO AI here and NO recompute of scores/signals: this layer purely reads
 * already-persisted intelligence and reshapes it along the canonical lineage:
 *
 *     Concern → Signals → Patterns → Interventions → Recommendation
 *
 * Sources (all persisted / read-only):
 *   - Unified Behavior Graph (`behavior-graph-service.ts`) — concern, signals,
 *     patterns, risks, interventions, growth (OMEGA-X), CSI factors, Pragati
 *     contributor, blended confidence.
 *   - Phase-2 Best Next Actions (`intervention-intelligence.ts`) — recommendations.
 *   - Behavioural spine (`capadex-explainability-engine.ts`) — per-pattern evidence
 *     and lineage (kept for backward compatibility).
 *
 * OMEGA-X / Pragati / CSI are integrated via the behavior graph's already-stitched
 * outputs (growth indicators, contributor list, CSI factors) — no new computation.
 *
 * NB: distinct from `explainability-engine.ts` (Phase-5 score-envelope `wrap()`) and
 * from `capadex-explainability-engine.ts` (the spine lineage reader) — this is the
 * report-insight aggregator that sits on top of both.
 */
import type { Pool } from 'pg';
import { getBehaviorGraph, type BehaviorGraph } from './behavior-graph-service';
import { getInterventionRecommendations } from './intervention-intelligence';
import { getSessionExplanation, type PatternLineage, type EvidenceRow } from './capadex-explainability-engine';
import {
  buildOrphanFallbackInsight,
  shouldEmitOrphanFallback,
  type OrphanFallbackInsight,
} from './concern-fallback-insight';

// ── Output shape (the user-facing explainability contract) ────────────────────
export interface InsightEvidence {
  evidence_key: string;
  source_type: string;
  answer_value: string | null;
  strength: number;
  confidence: number;
}
export interface InsightSignal {
  signal_key: string;
  strength: number;
  confidence: number;
  lifecycle_state: string | null;
  source: string;
}
export interface InsightPattern {
  pattern_key: string;
  label: string | null;
  confidence: number;
  signal_refs: string[];
  explanation: string | null;
  source: string;
}
export interface InsightRecommendation {
  intervention: string;
  reason: string;
  expectedImpact: number;
  confidence: number;
  reviewWindow: string;
  construct_key: string;
  rank: number;
}
export interface SessionInsightExplanation {
  session_id: string;
  generated_at: string;
  finding: {
    concern: string | null;
    statement: string;
    risk_level: string | null;
    confidence: number;
    top_patterns: string[];
  };
  evidence: InsightEvidence[];
  signals: InsightSignal[];
  patterns: InsightPattern[];
  recommendations: InsightRecommendation[];
  // ── integrated subsystem context (stored intelligence) ──
  omega: { confidence: number; growth: Array<{ key: string; direction: string; detail: string }> } | null;
  pragati: { present: boolean; indicators: Array<{ key: string; kind: 'signal' | 'pattern'; detail: string }> } | null;
  csi: { contribution: number | null; factors: Array<{ factor: string; kind: string; value: number | null; detail: string }> } | null;
  /** Backward-compatible per-pattern lineage (the original /explain payload). */
  lineage: PatternLineage[];
  /** Provenance — which stored subsystems actually contributed (never fabricated). */
  sources: string[];
  /**
   * Honestly-orphaned fallback (Task #20). Non-null ONLY when the measured spine
   * produced nothing (no signals, patterns or recommendations). Read-only and
   * explicitly distinguished (`is_fallback: true`, low confidence) so consumers
   * never confuse it with measured intelligence; it does not — and cannot —
   * inflate composites/patterns.
   */
  fallback: OrphanFallbackInsight | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const RISK_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
function topRiskLevel(graph: BehaviorGraph): string | null {
  if (!graph.risks.length) return null;
  return graph.risks
    .map((r) => String(r.severity).toLowerCase())
    .sort((a, b) => (RISK_ORDER[b] ?? 0) - (RISK_ORDER[a] ?? 0))[0] ?? null;
}

/** Build the explanation for one session from stored intelligence only. */
export async function explainSession(pool: Pool, sessionId: string): Promise<SessionInsightExplanation> {
  const generated_at = new Date().toISOString();

  // 1. Unified Behavior Graph — STRICTLY READ-ONLY (stored row only, never rebuilt).
  // The graph is backfilled non-blocking at session-completion time; explain must not
  // recompute or write. A missing row yields the grounded empty-state below.
  const graph: BehaviorGraph | null = await getBehaviorGraph(pool, sessionId).catch(() => null);

  // 2. Spine lineage + evidence (best-effort).
  const spine = await getSessionExplanation(pool, sessionId).catch(() => ({
    session_id: sessionId,
    generated_at,
    lineage: [] as PatternLineage[],
  }));

  // 3. Phase-2 Best Next Actions (best-effort).
  const recs = await getInterventionRecommendations(pool, sessionId).catch(() => []);

  // Empty state — grounded, never fabricated.
  if (!graph) {
    return {
      session_id: sessionId,
      generated_at,
      finding: {
        concern: null,
        statement: 'No stored intelligence is available for this session yet, so no insight can be explained.',
        risk_level: null,
        confidence: 0,
        top_patterns: [],
      },
      evidence: [],
      signals: [],
      patterns: [],
      recommendations: [],
      omega: null,
      pragati: null,
      csi: null,
      lineage: spine.lineage,
      sources: [],
      // No stored intelligence at all → the spine is empty. Surface the honest,
      // explicitly low-confidence general-support fallback so the user still
      // receives something, clearly marked as not-measured.
      fallback: buildOrphanFallbackInsight(null),
    };
  }

  // ── Reshape stored graph along the lineage ──
  const signals: InsightSignal[] = graph.signals.map((s) => ({
    signal_key: s.signal_key,
    strength: s.strength,
    confidence: s.confidence,
    lifecycle_state: s.lifecycle_state,
    source: s.source,
  }));

  const patterns: InsightPattern[] = [...graph.patterns]
    .sort((a, b) => b.confidence - a.confidence)
    .map((p) => ({
      pattern_key: p.pattern_key,
      label: p.label,
      confidence: p.confidence,
      signal_refs: p.signal_refs,
      explanation: p.explanation,
      source: p.source,
    }));

  // Evidence — unique rows pulled from the persisted spine lineage.
  const evidenceById = new Map<string, EvidenceRow>();
  for (const node of spine.lineage) {
    for (const e of node.evidence) if (!evidenceById.has(e.id)) evidenceById.set(e.id, e);
  }
  const evidence: InsightEvidence[] = Array.from(evidenceById.values()).map((e) => ({
    evidence_key: e.evidence_key,
    source_type: e.source_type,
    answer_value: e.answer_value,
    strength: e.strength,
    confidence: e.confidence,
  }));

  const recommendations: InsightRecommendation[] = recs.map((r) => ({
    intervention: r.intervention,
    reason: r.reason,
    expectedImpact: r.expectedImpact,
    confidence: r.confidence,
    reviewWindow: r.reviewWindow,
    construct_key: r.construct_key,
    rank: r.rank,
  }));

  // ── OMEGA-X (longitudinal growth + blended confidence) ──
  const omega = graph.growthIndicators.length || graph.confidence
    ? {
        confidence: graph.confidence,
        growth: graph.growthIndicators.map((g) => ({ key: g.key, direction: g.direction, detail: g.detail })),
      }
    : null;

  // ── Pragati (contributor signals/patterns surfaced from the graph) ──
  const pragatiIndicators = [
    ...graph.signals.filter((s) => s.source === 'pragati').map((s) => ({ key: s.signal_key, kind: 'signal' as const, detail: `strength ${s.strength}` })),
    ...graph.patterns.filter((p) => p.source === 'pragati').map((p) => ({ key: p.pattern_key, kind: 'pattern' as const, detail: p.explanation || p.label || '' })),
  ];
  const pragatiPresent = graph.contributors.includes('pragati') || pragatiIndicators.length > 0;
  const pragati = pragatiPresent ? { present: true, indicators: pragatiIndicators } : null;

  // ── CSI (contribution + factors) ──
  const csiContribution = graph.csiFactors.find((f) => f.kind === 'contribution')?.value ?? null;
  const csi = graph.csiFactors.length
    ? {
        contribution: csiContribution,
        factors: graph.csiFactors.map((f) => ({ factor: f.factor, kind: f.kind, value: f.value, detail: f.detail })),
      }
    : null;

  // ── Finding — deterministic, grounded summary (every number/label is stored) ──
  const risk_level = topRiskLevel(graph);
  const top_patterns = patterns.slice(0, 3).map((p) => p.label || p.pattern_key);
  const concern = graph.concern;
  const statementParts: string[] = [];
  statementParts.push(
    `${concern ? `On "${concern}", this` : 'This'} session has ${signals.length} active signal(s) and ${patterns.length} behavioural pattern(s)`,
  );
  if (risk_level) statementParts.push(`with ${risk_level} risk present`);
  if (top_patterns.length) statementParts.push(`; the leading pattern is "${top_patterns[0]}"`);
  statementParts.push(
    `. ${recommendations.length} recommended next action(s) trace from this evidence (overall confidence ${Math.round(graph.confidence * 100)}%).`,
  );
  const statement = statementParts.join(' ').replace(' ;', ';').replace(' .', '.');

  // ── Provenance (only subsystems that actually contributed) ──
  const sources = new Set<string>(graph.contributors);
  if (recommendations.length) sources.add('intervention_recommendations');
  if (evidence.length) sources.add('spine_evidence');

  // Honestly-orphaned fallback: a graph row exists but the measured spine is
  // empty (no signals, patterns or recommendations). Emit the explicitly
  // low-confidence general-support insight; it is read-only and never touches the
  // (empty) composite/pattern tiers, so it cannot inflate them.
  const fallback = shouldEmitOrphanFallback({
    signalCount: signals.length,
    patternCount: patterns.length,
    recommendationCount: recommendations.length,
  })
    ? buildOrphanFallbackInsight(concern)
    : null;

  return {
    session_id: sessionId,
    generated_at,
    finding: { concern, statement, risk_level, confidence: graph.confidence, top_patterns },
    evidence,
    signals,
    patterns,
    recommendations,
    omega,
    pragati,
    csi,
    lineage: spine.lineage,
    sources: Array.from(sources),
    fallback,
  };
}
