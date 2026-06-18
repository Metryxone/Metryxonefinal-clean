/**
 * Readiness Intelligence Engine (Phase 3 V2).
 *
 * Aggregates per-competency contextual scores into role-, leadership-,
 * transition-, execution-, strategic-, and overall capability readiness
 * envelopes. Pure functions; no side effects.
 */
import { computeReadiness, type ReadinessBand } from './contextual-scoring-engine';

export const READINESS_INTELLIGENCE_VERSION = '3.0.0';

export type CompetencyScore = {
  competency_code: string;
  contextual_score: number;
  confidence: number;
};

export type ReadinessThresholds = Record<string, { emerging: number; developing: number; proficient: number; expert: number }>;

export type ReadinessEnvelope = {
  domain: string;
  composite_score: number;
  band: ReadinessBand;
  probability: number;
  contributors: Array<{ competency_code: string; weight: number; contribution: number }>;
  rationale: string;
};

const DEFAULT_THRESHOLDS = { emerging: 40, developing: 60, proficient: 75, expert: 88 };

// Domain → weighting of canonical 7-domain competencies
const DOMAIN_WEIGHTS: Record<string, Record<string, number>> = {
  role:        { COG: 0.18, COM: 0.14, LEA: 0.14, EXE: 0.17, ADP: 0.13, TEC: 0.16, EIQ: 0.08 },
  leadership:  { LEA: 0.45, COM: 0.18, EIQ: 0.20, EXE: 0.10, ADP: 0.07 },
  transition:  { ADP: 0.35, COG: 0.25, COM: 0.18, EIQ: 0.12, LEA: 0.10 },
  execution:   { EXE: 0.45, COG: 0.20, ADP: 0.15, TEC: 0.15, COM: 0.05 },
  strategic:   { COG: 0.35, LEA: 0.25, EXE: 0.20, EIQ: 0.10, ADP: 0.10 },
  capability:  { COG: 0.14, COM: 0.14, LEA: 0.14, EXE: 0.14, ADP: 0.14, TEC: 0.16, EIQ: 0.14 },
};

export function computeDomainReadiness(
  domain: keyof typeof DOMAIN_WEIGHTS,
  scores: CompetencyScore[],
  thresholds: ReadinessThresholds = {},
): ReadinessEnvelope {
  const weights = DOMAIN_WEIGHTS[domain] ?? DOMAIN_WEIGHTS.role;
  const byCode = new Map(scores.map((s) => [s.competency_code, s]));
  const contributors: ReadinessEnvelope['contributors'] = [];
  let composite = 0;
  let totalWeight = 0;
  let confidenceSum = 0;
  for (const [code, w] of Object.entries(weights)) {
    const s = byCode.get(code);
    if (!s) continue;
    const contribution = s.contextual_score * w;
    composite += contribution;
    totalWeight += w;
    confidenceSum += s.confidence * w;
    contributors.push({ competency_code: code, weight: +w.toFixed(3), contribution: +contribution.toFixed(2) });
  }
  if (totalWeight === 0) {
    return {
      domain, composite_score: 0, band: 'emerging', probability: 0.05, contributors,
      rationale: `No scoring evidence available for domain=${domain}.`,
    };
  }
  composite = +(composite / totalWeight).toFixed(2);
  const meanConfidence = +(confidenceSum / totalWeight).toFixed(3);
  const t = thresholds[domain] ?? DEFAULT_THRESHOLDS;
  const r = computeReadiness(composite, t, meanConfidence);
  return {
    domain,
    composite_score: composite,
    band: r.band,
    probability: r.probability,
    contributors,
    rationale: `${domain}: weighted composite ${composite} from ${contributors.length} competencies; mean confidence ${(meanConfidence * 100).toFixed(0)}% → band=${r.band}, p=${r.probability}.`,
  };
}

export function computeAllReadiness(scores: CompetencyScore[], thresholds: ReadinessThresholds = {}): ReadinessEnvelope[] {
  return (Object.keys(DOMAIN_WEIGHTS) as Array<keyof typeof DOMAIN_WEIGHTS>)
    .map((d) => computeDomainReadiness(d, scores, thresholds));
}
