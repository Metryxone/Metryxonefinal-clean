// ─────────────────────────────────────────────────────────────────────────────
// CAPADEX Phase 9 — Predictive & Outcome Intelligence (prediction engine)
//
// EXPLAINABLE predictions by COMPOSING the existing descriptive layers — never a
// black box. The pure core operates on a normalized PredictionInput and produces
// deterministic, a-priori-weighted readiness + intervention-impact predictions
// whose every contributing term traces the 7-hop spine
//   Concern → Capability → Problem → Behavior → Archetype → Intervention → Recommendation.
//
// Discipline (mirrors prior PIL phases):
//   • Additive · deterministic · never-throws · READ-ONLY of all domain tables.
//   • The ONLY write is an append-only `capadex_prediction_audit` run row.
//   • Flag-gated by the caller (isRuntimeIntelligenceActivationEnabled()).
//   • HONEST: absent/degraded evidence LOWERS confidence and is surfaced; nothing
//     is fabricated. No empirical accuracy is claimed (no realized outcomes exist).
// ─────────────────────────────────────────────────────────────────────────────
import type { Pool } from 'pg';
import {
  buildPipelineForSession,
  type PipelineResult,
  type PipelineHop,
  type HopKey,
} from './pipeline-resolver';
import {
  buildSessionRecommendations,
  type SessionRecommendations,
} from './recommendation-builder';
import { discoverStrengths, type StrengthProfile } from '../strength-discovery-engine';
import {
  getTraversalIndex,
  resolveLineage,
  LINEAGE_SPINE,
  type TraversalIndex,
} from './graph-traversal-engine';

// ── Public dimension vocabulary ──────────────────────────────────────────────
export type Dimension = 'future' | 'career' | 'leadership' | 'learning';
export const DIMENSIONS: Dimension[] = ['future', 'career', 'leadership', 'learning'];

export type ReadinessBand = 'on_track' | 'developing' | 'at_risk';
export type ConfidenceBand = 'high' | 'moderate' | 'low';

// ── Normalized prediction input (built from a session OR an archetype) ────────
export interface PredInputSignal {
  key: string;
  label: string;
  severity: number;   // 0..1 (higher = more distress → lowers readiness)
  strength: number;   // 0..1
  confidence: number; // 0..1
  active: boolean;    // lifecycle ∈ {active, dominant}
}
export interface PredInputStrength {
  label: string;
  evidence: string;
  confidence: number; // 0..1
}
export interface PredInputIntervention {
  key: string;
  title: string;
  construct: string;
  expected_impact: number;   // 0..1 (library expected_impact)
  confidence: number;        // 0..1
  addressable_severity: number; // 0..1 (severity of what it targets)
}
export interface PredInputChainStage {
  category: string;          // one of LINEAGE_SPINE
  label: string | null;
  resolved: boolean;
}
export interface PredInputChain {
  source: 'pipeline' | 'kg_lineage' | 'none';
  anchor: string | null;
  stages: PredInputChainStage[]; // ordered by LINEAGE_SPINE (length 7)
  resolved_hops: number;         // 0..7
  total_hops: number;            // 7
  degraded: boolean;
}
export interface PredictionInput {
  source: 'session' | 'archetype';
  subject_id: string;
  concern_label: string | null;
  archetype_key: string | null;
  archetype_name: string | null;
  signals: PredInputSignal[];
  strengths: PredInputStrength[];
  interventions: PredInputIntervention[];
  active_constructs: string[];
  chain: PredInputChain;
}

// ── Prediction outputs ───────────────────────────────────────────────────────
export interface PredictionContribution {
  kind: 'strength' | 'risk';
  label: string;
  matched_tokens: string[];
  contribution: number; // signed delta applied to the 0.5 base
  evidence: string;
}
export interface InterventionLever {
  key: string;
  title: string;
  construct: string;
  expected_uplift: number; // contribution to expected outcome (0..1)
}
export interface ChainTrace {
  source: 'pipeline' | 'kg_lineage' | 'none';
  anchor: string | null;
  stages: PredInputChainStage[];
  resolved_count: number;
  total: number;
  complete: boolean;
}
export interface ReadinessPrediction {
  dimension: Dimension;
  score: number;        // 0..1
  band: ReadinessBand;
  confidence: number;   // 0..1
  confidence_band: ConfidenceBand;
  expected_outcome: { score: number; uplift: number; band: ReadinessBand };
  contributions: PredictionContribution[];
  intervention_levers: InterventionLever[];
  chain_completeness: number; // 0..1
  degraded: boolean;
  rationale: string;
  trace: ChainTrace;
}
export interface InterventionImpactPrediction {
  key: string;
  title: string;
  construct: string;
  target_dimensions: Dimension[];
  predicted_impact: number;     // 0..1 — expected_impact × confidence
  predicted_reduction: number;  // 0..1 — predicted_impact × addressable_severity
  confidence: number;           // 0..1
  confidence_band: ConfidenceBand;
  rationale: string;
  trace: ChainTrace;
}
export interface FutureRisk {
  label: string;
  severity: number;             // 0..1
  trajectory: 'mitigable' | 'persistent';
  projected_if_unaddressed: number; // 0..1 (>= severity)
  mitigating_intervention: string | null;
  rationale: string;
  trace: ChainTrace;
}
export interface GrowthOpportunity {
  label: string;
  confidence: number;
  leverages: Dimension[];
  evidence: string;
}
export interface RecommendedPriority {
  rank: number;
  key: string;
  title: string;
  construct: string;
  predicted_impact: number;
  rationale: string;
}
export interface ExpectedOutcome {
  dimension: Dimension;
  current: number;
  expected: number;
  uplift: number;
  band_now: ReadinessBand;
  band_expected: ReadinessBand;
}
export interface SubjectPrediction {
  enabled: true;
  source: 'session' | 'archetype';
  subject_id: string;
  generated_at: string;
  degraded: boolean;
  reason: string | null;
  concern_label: string | null;
  archetype: { key: string | null; name: string | null };
  readiness: ReadinessPrediction[];
  intervention_impact: InterventionImpactPrediction[];
  future_risks: FutureRisk[];
  growth_opportunities: GrowthOpportunity[];
  recommended_priorities: RecommendedPriority[];
  expected_outcomes: ExpectedOutcome[];
  explainability: {
    chain_completeness: number;   // 0..1 (resolved hops / 7)
    predictions_total: number;
    predictions_traced: number;   // with ≥1 resolved chain stage
    score: number;                // 0..1 — share of predictions with a real trace
  };
}

// ── Model constants (a-priori, deterministic) ────────────────────────────────
const BASE = 0.5;
const RISK_WEIGHT = 0.22;        // per active relevant risk (× severity)
const STRENGTH_WEIGHT = 0.18;    // per relevant strength (× confidence)
const RISK_CAP = 0.45;           // max total downward pull
const STRENGTH_CAP = 0.45;       // max total upward pull
const IMPACT_WEIGHT = 0.6;       // intervention uplift scale
const UPLIFT_CAP = 0.4;          // max expected-outcome uplift
const EVIDENCE_TARGET = 3;       // evidence count that saturates the volume factor
const TOTAL_HOPS = 7;

// Generic META tokens deliberately excluded from the lexicon — they match almost
// everything and would inflate single-hit relevance (prior-phase lesson).
const DIMENSION_LEXICON: Record<Exclude<Dimension, 'future'>, string[]> = {
  career: [
    'career', 'job', 'profession', 'professional', 'workplace', 'vocation',
    'employ', 'occupation', 'interview', 'networking', 'promotion', 'ambition',
    'résumé', 'resume', 'salary', 'industry',
  ],
  leadership: [
    'leadership', 'lead', 'influence', 'delegation', 'delegate', 'initiative',
    'responsibility', 'authority', 'assertive', 'decision', 'team', 'conflict',
    'mentor', 'accountab', 'ownership',
  ],
  learning: [
    'learn', 'study', 'academic', 'curiosity', 'comprehension', 'reading',
    'exam', 'homework', 'memory', 'attention', 'concentrat', 'discipline',
    'practice', 'mastery', 'skill', 'knowledge',
  ],
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round = (n: number, d = 4) => {
  const p = 10 ** d;
  return Math.round(n * p) / p;
};

/** Severity string → 0..1 (honest neutral fallback for unknown/absent). */
export function severityToNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return clamp01(v > 1 ? v / 100 : v);
  const s = String(v ?? '').toLowerCase().trim();
  switch (s) {
    case 'critical': case 'severe': return 1;
    case 'high': return 0.8;
    case 'elevated': case 'moderate-high': return 0.65;
    case 'moderate': case 'medium': return 0.5;
    case 'mild': case 'low-moderate': return 0.35;
    case 'low': return 0.25;
    case 'minimal': case 'none': return 0.1;
    default: return 0.5;
  }
}

function readinessBand(score: number): ReadinessBand {
  if (score >= 0.7) return 'on_track';
  if (score >= 0.45) return 'developing';
  return 'at_risk';
}
function confidenceBand(c: number): ConfidenceBand {
  if (c >= 0.67) return 'high';
  if (c >= 0.34) return 'moderate';
  return 'low';
}

/** Curated lexicon match → matched tokens (surfaced for honesty). 'future' = all. */
export function matchDimension(text: string, dim: Dimension): string[] {
  if (dim === 'future') return [];
  const t = String(text || '').toLowerCase();
  const hits: string[] = [];
  for (const token of DIMENSION_LEXICON[dim]) if (t.includes(token)) hits.push(token);
  return hits;
}

/** Which non-future dimensions a text touches; [] when it matches none. */
export function dimensionsFor(text: string): Dimension[] {
  const out: Dimension[] = [];
  (['career', 'leadership', 'learning'] as const).forEach((d) => {
    if (matchDimension(text, d).length > 0) out.push(d);
  });
  return out;
}

function evidenceVolumeFactor(relevantCount: number): number {
  return clamp01(relevantCount / EVIDENCE_TARGET);
}

function toTrace(chain: PredInputChain): ChainTrace {
  const resolved = chain.stages.filter((s) => s.resolved).length;
  return {
    source: chain.source,
    anchor: chain.anchor,
    stages: chain.stages,
    resolved_count: resolved,
    total: TOTAL_HOPS,
    complete: resolved >= TOTAL_HOPS,
  };
}

// ── Pure prediction core ─────────────────────────────────────────────────────

/** Readiness prediction for one dimension (deterministic, fully traced). */
export function predictReadiness(dim: Dimension, input: PredictionInput): ReadinessPrediction {
  const trace = toTrace(input.chain);
  const chainCompleteness = trace.resolved_count / TOTAL_HOPS;
  const contributions: PredictionContribution[] = [];

  // Risks (active signals only) pull readiness DOWN.
  let riskTotal = 0;
  for (const s of input.signals) {
    if (!s.active) continue;
    const matched = matchDimension(`${s.label} ${s.key}`, dim);
    const relevant = dim === 'future' || matched.length > 0;
    if (!relevant) continue;
    const delta = -(s.severity * RISK_WEIGHT);
    riskTotal += delta;
    contributions.push({
      kind: 'risk',
      label: s.label || s.key,
      matched_tokens: matched,
      contribution: round(delta),
      evidence: `Active signal · severity ${round(s.severity, 2)} · confidence ${round(s.confidence, 2)}`,
    });
  }
  riskTotal = Math.max(riskTotal, -RISK_CAP);

  // Strengths pull readiness UP.
  let strengthTotal = 0;
  for (const st of input.strengths) {
    const matched = matchDimension(`${st.label} ${st.evidence}`, dim);
    const relevant = dim === 'future' || matched.length > 0;
    if (!relevant) continue;
    const delta = st.confidence * STRENGTH_WEIGHT;
    strengthTotal += delta;
    contributions.push({
      kind: 'strength',
      label: st.label,
      matched_tokens: matched,
      contribution: round(delta),
      evidence: st.evidence,
    });
  }
  strengthTotal = Math.min(strengthTotal, STRENGTH_CAP);

  const score = clamp01(BASE + strengthTotal + riskTotal);

  // Intervention levers relevant to this dimension drive the expected outcome.
  const levers: InterventionLever[] = [];
  let uplift = 0;
  for (const iv of input.interventions) {
    const matched = matchDimension(`${iv.title} ${iv.construct}`, dim);
    const relevant = dim === 'future' || matched.length > 0;
    if (!relevant) continue;
    const lever = iv.expected_impact * iv.confidence * IMPACT_WEIGHT;
    if (lever <= 0) continue;
    uplift += lever;
    levers.push({
      key: iv.key,
      title: iv.title,
      construct: iv.construct,
      expected_uplift: round(lever),
    });
  }
  uplift = Math.min(uplift, UPLIFT_CAP);
  const expectedScore = clamp01(score + uplift);

  const relevantEvidence = contributions.length;
  const confidence = round(chainCompleteness * evidenceVolumeFactor(relevantEvidence));

  const rationale = buildReadinessRationale(dim, score, contributions, levers, trace, degradedReasonOf(input));

  return {
    dimension: dim,
    score: round(score),
    band: readinessBand(score),
    confidence,
    confidence_band: confidenceBand(confidence),
    expected_outcome: {
      score: round(expectedScore),
      uplift: round(uplift),
      band: readinessBand(expectedScore),
    },
    contributions,
    intervention_levers: levers,
    chain_completeness: round(chainCompleteness),
    degraded: input.chain.degraded || trace.resolved_count < TOTAL_HOPS,
    rationale,
    trace,
  };
}

function buildReadinessRationale(
  dim: Dimension,
  score: number,
  contributions: PredictionContribution[],
  levers: InterventionLever[],
  trace: ChainTrace,
  degradedReason: string | null,
): string {
  const band = readinessBand(score);
  const risks = contributions.filter((c) => c.kind === 'risk').length;
  const strengths = contributions.filter((c) => c.kind === 'strength').length;
  const parts: string[] = [];
  parts.push(
    `${dim} readiness predicted ${band.replace('_', ' ')} (${round(score, 2)}) from ` +
      `${strengths} strength${strengths === 1 ? '' : 's'} and ${risks} active risk${risks === 1 ? '' : 's'}`,
  );
  if (levers.length) parts.push(`${levers.length} intervention lever${levers.length === 1 ? '' : 's'} available`);
  parts.push(`chain ${trace.resolved_count}/${TOTAL_HOPS} resolved`);
  if (contributions.length === 0) {
    parts.push('no dimension-relevant evidence → neutral baseline (low confidence)');
  }
  if (degradedReason) parts.push(`degraded: ${degradedReason}`);
  return parts.join('; ') + '.';
}

/** Per-intervention impact prediction (deterministic, traced). */
export function predictInterventionImpact(input: PredictionInput): InterventionImpactPrediction[] {
  const trace = toTrace(input.chain);
  return input.interventions
    .map((iv) => {
      const predictedImpact = clamp01(iv.expected_impact * iv.confidence);
      const predictedReduction = clamp01(predictedImpact * iv.addressable_severity);
      const conf = round(iv.confidence * (trace.resolved_count / TOTAL_HOPS));
      const targets = dimensionsFor(`${iv.title} ${iv.construct}`);
      return {
        key: iv.key,
        title: iv.title,
        construct: iv.construct,
        target_dimensions: targets.length ? targets : (['future'] as Dimension[]),
        predicted_impact: round(predictedImpact),
        predicted_reduction: round(predictedReduction),
        confidence: conf,
        confidence_band: confidenceBand(conf),
        rationale:
          `Expected impact ${round(iv.expected_impact, 2)} × confidence ${round(iv.confidence, 2)} ` +
          `→ predicted impact ${round(predictedImpact, 2)}; addressable severity ${round(iv.addressable_severity, 2)} ` +
          `→ predicted reduction ${round(predictedReduction, 2)}.`,
        trace,
      };
    })
    .sort((a, b) => b.predicted_reduction - a.predicted_reduction || a.key.localeCompare(b.key));
}

/** Future risks: active signals projected forward; mitigable iff an intervention targets them. */
export function deriveFutureRisks(input: PredictionInput): FutureRisk[] {
  const trace = toTrace(input.chain);
  return input.signals
    .filter((s) => s.active)
    .map((s) => {
      const dims = dimensionsFor(`${s.label} ${s.key}`);
      // A risk is only "mitigable" when an intervention shares a real lexicon dimension with
      // it. Unmatched signals/interventions stay persistent — never auto-attach a lever.
      const mitig = input.interventions.find((iv) => {
        const ivDims = dimensionsFor(`${iv.title} ${iv.construct}`);
        return ivDims.some((d) => dims.includes(d));
      });
      // Unaddressed distress drifts upward; cap the projection deterministically.
      const projected = clamp01(s.severity + (1 - s.severity) * 0.25);
      return {
        label: s.label || s.key,
        severity: round(s.severity),
        trajectory: (mitig ? 'mitigable' : 'persistent') as 'mitigable' | 'persistent',
        projected_if_unaddressed: round(projected),
        mitigating_intervention: mitig ? mitig.title : null,
        rationale: mitig
          ? `Mitigable — "${mitig.title}" targets this; projected ${round(projected, 2)} if unaddressed.`
          : `No mapped intervention targets this — projected ${round(projected, 2)} if unaddressed.`,
        trace,
      };
    })
    .sort((a, b) => b.projected_if_unaddressed - a.projected_if_unaddressed || a.label.localeCompare(b.label));
}

/** Growth opportunities derive ONLY from discovered strengths (never raw signal magnitude). */
export function deriveGrowthOpportunities(input: PredictionInput): GrowthOpportunity[] {
  return input.strengths
    .map((st) => ({
      label: st.label,
      confidence: round(st.confidence),
      leverages: dimensionsFor(`${st.label} ${st.evidence}`),
      evidence: st.evidence,
    }))
    .sort((a, b) => b.confidence - a.confidence || a.label.localeCompare(b.label));
}

/** Recommended priorities: interventions ranked by predicted reduction. */
export function deriveRecommendedPriorities(input: PredictionInput): RecommendedPriority[] {
  const impacts = predictInterventionImpact(input);
  return impacts.slice(0, 8).map((im, i) => ({
    rank: i + 1,
    key: im.key,
    title: im.title,
    construct: im.construct,
    predicted_impact: im.predicted_reduction,
    rationale: im.rationale,
  }));
}

/** Per-dimension expected development outcomes (current → expected after levers). */
export function deriveExpectedOutcomes(readiness: ReadinessPrediction[]): ExpectedOutcome[] {
  return readiness.map((r) => ({
    dimension: r.dimension,
    current: r.score,
    expected: r.expected_outcome.score,
    uplift: r.expected_outcome.uplift,
    band_now: r.band,
    band_expected: r.expected_outcome.band,
  }));
}

// Honest, pure degraded-reason helper (no I/O).
function degradedReasonOf(input: PredictionInput): string | null {
  return input.chain.degraded ? 'partial chain resolution' : null;
}

/** Full pure prediction set for a normalized input. Never throws. */
export function predict(input: PredictionInput): SubjectPrediction {
  const readiness = DIMENSIONS.map((d) => predictReadiness(d, input));
  const interventionImpact = predictInterventionImpact(input);
  const futureRisks = deriveFutureRisks(input);
  const growth = deriveGrowthOpportunities(input);
  const priorities = deriveRecommendedPriorities(input);
  const outcomes = deriveExpectedOutcomes(readiness);

  const allTraces: ChainTrace[] = [
    ...readiness.map((r) => r.trace),
    ...interventionImpact.map((i) => i.trace),
    ...futureRisks.map((f) => f.trace),
  ];
  const traced = allTraces.filter((t) => t.resolved_count > 0).length;
  const chainCompleteness = toTrace(input.chain).resolved_count / TOTAL_HOPS;

  return {
    enabled: true,
    source: input.source,
    subject_id: input.subject_id,
    generated_at: new Date().toISOString(),
    degraded: input.chain.degraded,
    reason: degradedReasonOf(input),
    concern_label: input.concern_label,
    archetype: { key: input.archetype_key, name: input.archetype_name },
    readiness,
    intervention_impact: interventionImpact,
    future_risks: futureRisks,
    growth_opportunities: growth,
    recommended_priorities: priorities,
    expected_outcomes: outcomes,
    explainability: {
      chain_completeness: round(chainCompleteness),
      predictions_total: allTraces.length,
      predictions_traced: traced,
      score: allTraces.length ? round(traced / allTraces.length) : 0,
    },
  };
}

// ── Composition helpers (READ-ONLY) ──────────────────────────────────────────

function chainFromPipeline(p: PipelineResult, recs: SessionRecommendations | null): PredInputChain {
  const hopByKey = new Map<HopKey, PipelineHop>();
  for (const h of p.hops) hopByKey.set(h.key, h);
  const recResolved = !!recs && recs.categories.some((c) => c.items && c.items.length > 0);
  const stages: PredInputChainStage[] = [
    { category: 'concern', label: stageLabel(p.resolution.concern_id, p), resolved: !!hopByKey.get('signal_to_concern')?.resolved },
    { category: 'capability', label: hopText(hopByKey.get('concern_to_capability')), resolved: !!hopByKey.get('concern_to_capability')?.resolved },
    { category: 'problem', label: hopText(hopByKey.get('capability_to_problem')), resolved: !!hopByKey.get('capability_to_problem')?.resolved },
    { category: 'behavior', label: hopText(hopByKey.get('problem_to_behavior')), resolved: !!hopByKey.get('problem_to_behavior')?.resolved },
    { category: 'archetype', label: p.resolution.archetype_name ?? p.resolution.archetype_key, resolved: !!hopByKey.get('behavior_to_archetype')?.resolved },
    { category: 'intervention', label: hopText(hopByKey.get('archetype_to_intervention')), resolved: !!hopByKey.get('archetype_to_intervention')?.resolved },
    { category: 'recommendation', label: recResolved ? `${recs!.active_constructs.length} active construct(s)` : null, resolved: recResolved },
  ];
  return {
    source: 'pipeline',
    anchor: p.resolution.concern_id,
    stages,
    resolved_hops: stages.filter((s) => s.resolved).length,
    total_hops: TOTAL_HOPS,
    degraded: p.degraded,
  };
}

function stageLabel(concernId: string | null, p: PipelineResult): string | null {
  return concernId ? `concern ${concernId}` : null;
}
function hopText(h: PipelineHop | undefined): string | null {
  if (!h || !h.resolved) return null;
  return h.summary || null;
}

function normalizeInput(input: PredictionInput): PredictionInput {
  return input;
}

/**
 * Build a normalized PredictionInput from a live session by composing the runtime
 * pipeline, session interventions (Phase-4 persisted, read-only), recommendations
 * and strengths. Never throws — degrades to an honest low-evidence input.
 */
export async function buildPredictionInputFromPipeline(
  pool: Pool,
  sessionId: string,
): Promise<PredictionInput> {
  let pipeline: PipelineResult | null = null;
  let recs: SessionRecommendations | null = null;
  let strengthProfile: StrengthProfile | null = null;
  let interventions: PredInputIntervention[] = [];

  try {
    pipeline = await buildPipelineForSession(pool, sessionId);
  } catch { pipeline = null; }
  try {
    const r = await buildSessionRecommendations(pool, sessionId, 'student');
    recs = (r as SessionRecommendations).enabled ? (r as SessionRecommendations) : null;
  } catch { recs = null; }
  try {
    strengthProfile = await discoverStrengths(pool, sessionId);
  } catch { strengthProfile = null; }
  try {
    interventions = await loadSessionInterventions(pool, sessionId);
  } catch { interventions = []; }

  const signals: PredInputSignal[] = [];
  if (pipeline) {
    const sigHop = pipeline.hops.find((h) => h.key === 'response_to_signal');
    const data = (sigHop?.data ?? {}) as { signals?: Array<Record<string, unknown>> };
    for (const s of data.signals ?? []) {
      const lifecycle = String(s.lifecycle_state ?? '').toLowerCase();
      signals.push({
        key: String(s.signal_key ?? ''),
        label: String(s.description ?? s.signal_key ?? ''),
        severity: severityToNumber(s.severity),
        strength: clamp01(Number(s.strength ?? 0)),
        confidence: clamp01(Number(s.confidence ?? 0)),
        active: lifecycle === 'active' || lifecycle === 'dominant',
      });
    }
  }

  const strengths: PredInputStrength[] = strengthProfile
    ? [...strengthProfile.strengths, ...strengthProfile.success_patterns, ...strengthProfile.resilience].map((s) => ({
        label: s.label,
        evidence: s.evidence,
        confidence: clamp01(s.confidence),
      }))
    : [];

  const activeConstructs = recs ? recs.active_constructs.map((c) => c.key) : [];

  const concernLabel = pipeline
    ? (pipeline.hops.find((h) => h.key === 'signal_to_concern')?.summary ?? null)
    : null;

  return normalizeInput({
    source: 'session',
    subject_id: sessionId,
    concern_label: recs?.concern_label ?? concernLabel,
    archetype_key: pipeline?.resolution.archetype_key ?? recs?.archetype?.key ?? null,
    archetype_name: pipeline?.resolution.archetype_name ?? recs?.archetype?.name ?? null,
    signals,
    strengths,
    interventions,
    active_constructs: activeConstructs,
    chain: pipeline
      ? chainFromPipeline(pipeline, recs)
      : { source: 'none', anchor: null, stages: emptyStages(), resolved_hops: 0, total_hops: TOTAL_HOPS, degraded: true },
  });
}

function emptyStages(): PredInputChainStage[] {
  return (LINEAGE_SPINE as readonly string[]).map((c) => ({ category: c, label: null, resolved: false }));
}

/** Read-only load of Phase-4 session interventions (richest expected_impact source). */
async function loadSessionInterventions(pool: Pool, sessionId: string): Promise<PredInputIntervention[]> {
  const { rows } = await pool.query(
    `SELECT intervention_key, construct_key, title, expected_impact, confidence, severity
       FROM capadex_session_interventions
      WHERE session_id = $1
      ORDER BY rank ASC NULLS LAST, expected_impact DESC NULLS LAST`,
    [sessionId],
  );
  return rows.map((r) => ({
    key: String(r.intervention_key ?? ''),
    title: String(r.title ?? r.intervention_key ?? ''),
    construct: String(r.construct_key ?? ''),
    expected_impact: clamp01(Number(r.expected_impact ?? 0)),
    confidence: clamp01(Number(r.confidence ?? 0)),
    addressable_severity: severityToNumber(r.severity),
  }));
}

/**
 * Build a PredictionInput anchored on a KG archetype (for breadth/examples). Carries
 * REAL intervention_library expected_impact + a REAL KG lineage trace. No individual
 * signals/strengths exist → readiness baselines are neutral (honestly low confidence),
 * while intervention impact + explainability are fully populated. Never throws.
 */
export async function buildPredictionInputFromArchetype(
  pool: Pool,
  archetypeKey: string,
): Promise<PredictionInput | null> {
  let index: TraversalIndex | null = null;
  try { index = await getTraversalIndex(pool); } catch { index = null; }
  if (!index) return null;

  // Find the archetype node (by key or label).
  const archetypeIds = index.byCategory.get('archetype') ?? [];
  const anchorId = archetypeIds.find((id) => {
    const n = index!.byId.get(id);
    return n && (n.label === archetypeKey || n.id === archetypeKey || n.label?.toLowerCase() === archetypeKey.toLowerCase());
  });
  if (!anchorId) return null;
  const anchor = index.byId.get(anchorId)!;

  const lineage = resolveLineage(index, anchorId, { maxPerStage: 6 });
  const stages: PredInputChainStage[] = (LINEAGE_SPINE as readonly string[]).map((cat) => {
    const st = lineage?.stages.find((s) => s.category === cat);
    return {
      category: cat,
      label: st && st.nodes.length ? st.nodes.map((n) => n.label).slice(0, 3).join(', ') : null,
      resolved: !!(st && st.reached && st.nodes.length > 0),
    };
  });

  // Real intervention_library expected_impact for THIS archetype's lineage interventions
  // only — never global rows. The intervention stage of the resolved KG lineage is the
  // single source of truth; if nothing resolves we honestly attach no levers.
  const interventionStage = lineage?.stages.find((s) => s.category === 'intervention');
  const lineageInterventionLabels = (interventionStage?.nodes ?? []).map((n) => n.label);
  let interventions: PredInputIntervention[] = [];
  try { interventions = await loadArchetypeInterventions(pool, lineageInterventionLabels); } catch { interventions = []; }

  return normalizeInput({
    source: 'archetype',
    subject_id: archetypeKey,
    concern_label: stages.find((s) => s.category === 'concern')?.label ?? null,
    archetype_key: archetypeKey,
    archetype_name: anchor.label,
    signals: [],
    strengths: [],
    interventions,
    active_constructs: [],
    chain: {
      source: 'kg_lineage',
      anchor: anchorId,
      stages,
      resolved_hops: stages.filter((s) => s.resolved).length,
      total_hops: TOTAL_HOPS,
      degraded: stages.some((s) => !s.resolved),
    },
  });
}

async function loadArchetypeInterventions(pool: Pool, lineageLabels: string[]): Promise<PredInputIntervention[]> {
  // Only intervention_library rows whose title/key appears in the archetype's resolved KG
  // lineage. No lineage interventions ⇒ no levers (honest), never a global fallback.
  const labels = Array.from(new Set(lineageLabels.map((l) => l.trim().toLowerCase()).filter(Boolean)));
  if (labels.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT il.intervention_key, il.construct_key, il.title, il.expected_impact, il.confidence
       FROM intervention_library il
      WHERE LOWER(il.title) = ANY($1) OR LOWER(il.intervention_key) = ANY($1)
      ORDER BY il.expected_impact DESC NULLS LAST
      LIMIT 12`,
    [labels],
  ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
  return rows.map((r) => ({
    key: String(r.intervention_key ?? ''),
    title: String(r.title ?? r.intervention_key ?? ''),
    construct: String(r.construct_key ?? ''),
    expected_impact: clamp01(Number(r.expected_impact ?? 0)),
    confidence: clamp01(Number(r.confidence ?? 0)),
    addressable_severity: 0.6,
  }));
}

// ── Append-only audit (the ONLY write) ───────────────────────────────────────
let auditSchemaReady = false;
async function ensurePredictionAuditSchema(pool: Pool): Promise<void> {
  if (auditSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS capadex_prediction_audit (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      scope TEXT NOT NULL,
      subject_id TEXT,
      summary JSONB NOT NULL
    )
  `);
  auditSchemaReady = true;
}

export async function recordPredictionAudit(
  pool: Pool,
  scope: string,
  subjectId: string | null,
  summary: Record<string, unknown>,
): Promise<void> {
  try {
    await ensurePredictionAuditSchema(pool);
    await pool.query(
      `INSERT INTO capadex_prediction_audit (scope, subject_id, summary) VALUES ($1, $2, $3)`,
      [scope, subjectId, JSON.stringify(summary)],
    );
  } catch {
    // Best-effort, append-only — never breaks a read path.
  }
}

/**
 * Session-scoped prediction orchestrator. Composes the descriptive layers, runs the
 * pure model, records an append-only audit row, and returns the explainable set.
 * Never throws.
 */
export async function buildPredictionsForSession(
  pool: Pool,
  sessionId: string,
): Promise<SubjectPrediction> {
  const input = await buildPredictionInputFromPipeline(pool, sessionId);
  const result = predict(input);
  await recordPredictionAudit(pool, 'session', sessionId, {
    degraded: result.degraded,
    chain_completeness: result.explainability.chain_completeness,
    explainability_score: result.explainability.score,
    readiness: result.readiness.map((r) => ({ dimension: r.dimension, band: r.band, score: r.score })),
  });
  return result;
}
