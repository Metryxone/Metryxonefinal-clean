/**
 * AI Reasoning Engine — pure-function explainability synthesis.
 * Produces "why this competency / why this confidence" envelopes that
 * are persisted to ai_reasoning_chains.
 */
export const AI_REASONING_VERSION = '5.0.0';

export type Evidence = { source: string; signal: string; weight: number };

export type ReasoningChain = {
  why_inferred: string;
  confidence_reasoning: string;
  behavioral_evidence: Evidence[];
  readiness_rationale: string;
  alternatives: string[];
  caveats: string[];
};

const COMPETENCY_LABELS: Record<string, string> = {
  COG: 'cognitive reasoning', COM: 'communication', LEA: 'leadership',
  EXE: 'execution', ADP: 'adaptability', TEC: 'technical mastery', EIQ: 'emotional intelligence',
};

export function buildReasoning(args: {
  competencyKey: string;
  inferredLevel: number;
  confidence: number;
  evidence: Evidence[];
  sourceMix: Array<{ source: string; weight: number }>;
}): ReasoningChain {
  const label = COMPETENCY_LABELS[args.competencyKey] ?? args.competencyKey;
  const topEv = args.evidence.slice(0, 4);

  const why_inferred = topEv.length
    ? `Inferred ${label} at level ${Math.round(args.inferredLevel)}/100 from ${topEv.map((e) => `${e.source} (${e.signal})`).join(', ')}.`
    : `Inferred ${label} at level ${Math.round(args.inferredLevel)}/100; signals were sparse — treat as provisional.`;

  const confPct = Math.round(args.confidence * 100);
  const richness = args.sourceMix.length;
  const confidence_reasoning = richness >= 3
    ? `Confidence ${confPct}% — corroborated across ${richness} sources (${args.sourceMix.map((s) => s.source).join(', ')}).`
    : richness === 2
      ? `Confidence ${confPct}% — partial corroboration across ${args.sourceMix.map((s) => s.source).join(' + ')}; broaden inputs to improve calibration.`
      : `Confidence ${confPct}% — single-source signal (${args.sourceMix[0]?.source ?? 'unknown'}); recommend cross-validation.`;

  const readiness_rationale = args.inferredLevel >= 75
    ? `Signals are consistent with established ${label} capability.`
    : args.inferredLevel >= 50
      ? `Signals indicate developing ${label}; targeted practice would consolidate it.`
      : `Signals are early-stage; ${label} is a development area, not a documented strength.`;

  const alternatives = [
    `Level may be under-stated if ${label} evidence sits in unanalysed sources (e.g., portfolio not provided).`,
    `Level may be over-stated if self-reported sources over-represent narrative.`,
  ];
  const caveats = [
    'Inference is heuristic and developmental in nature — not a hiring, promotion, or suitability prediction.',
    args.confidence < 0.5 ? 'Confidence is below 50% — treat as directional, not diagnostic.' : 'Cross-validate with assessment runtime evidence.',
  ];

  return { why_inferred, confidence_reasoning, behavioral_evidence: topEv, readiness_rationale, alternatives, caveats };
}
