/**
 * Phase 3.4 — EI Profile Engine.
 *
 * Candidate Employability Profile. A PURE, read-only derivation layer that
 * COMPOSES the Phase 3.3 employability scoring artifact
 * (`computeEmployabilityScore`) into a candidate-facing profile with six
 * components:
 *
 *   - Overall EI          — the composed Employability Index (Tier-3 ei).
 *   - Dimension Scores     — per-dimension readiness (Tier-2), pass-through.
 *   - Strength Areas       — measurable dimensions at Strong / Excellent band.
 *   - Development Areas    — measurable dimensions below Strong (with headroom).
 *   - Critical Risks       — very-low (Early-band) dimensions, blind spots
 *                            (non-measurable dimensions), and low overall
 *                            confidence — each surfaced honestly, never as a 0.
 *   - Growth Potential     — developmental upside (weighted headroom across the
 *                            improvable dimensions). High potential = room to
 *                            grow, NOT a deficiency.
 *
 * Honesty contract (mirrors Phase 3.3):
 *   - COMPOSES, never recomputes: every number traces back to the 3.3 artifact;
 *     this engine only re-shapes and classifies it.
 *   - Coverage (how much was measured) and Confidence (how trustworthy) stay on
 *     SEPARATE axes; nothing is imputed.
 *   - Never throws: any failure degrades to an honest unmeasured profile with a
 *     reason — never a fabricated zero.
 *   - Language policy: developmental signals only (inherited from 3.3), NEVER a
 *     hiring / promotion / suitability prediction.
 */

import type { Pool } from 'pg';
import {
  computeEmployabilityScore,
  type EmployabilityScore,
} from './employability-scoring-engine.js';
import type { ScoredDimension } from './dimension-scoring-engine.js';
import { LANGUAGE_POLICY, round1, type DimensionConfidence } from './competency-ei-scoring-shared.js';

export const EI_PROFILE_ENGINE_VERSION = 'phase-3.4';

// ----------------------------------------------------------------------------
// Output shapes
// ----------------------------------------------------------------------------

export interface EiProfileDimension {
  ei_dimension_id: string;
  dimension_name: string;
  measurable: boolean;
  score: number | null;
  band: string | null;
  rollup_weight: number;
  coverage_pct: number;
  confidence: DimensionConfidence;
  reason: string | null;
}

export interface StrengthArea {
  ei_dimension_id: string;
  dimension_name: string;
  score: number;
  band: string;
  rollup_weight: number;
  confidence_band: DimensionConfidence['band'];
  rationale: string;
}

export interface DevelopmentArea {
  ei_dimension_id: string;
  dimension_name: string;
  score: number;
  band: string;
  rollup_weight: number;
  headroom: number; // 100 - score (room to the ceiling)
  rationale: string;
}

export interface CriticalRisk {
  type: 'low_readiness' | 'blind_spot' | 'low_confidence';
  ei_dimension_id: string | null;
  dimension_name: string | null;
  severity: 'high' | 'moderate';
  detail: string;
}

export interface GrowthPotential {
  level: 'High' | 'Moderate' | 'Low' | 'Unmeasured';
  score: number | null; // weighted-mean headroom across improvable dimensions, 0..100
  improvable_dimensions: { ei_dimension_id: string; dimension_name: string; headroom: number }[];
  drivers: string[];
  reason: string | null;
}

export interface EiProfile {
  ok: boolean;
  subject_id: string;
  role_id: string | null;
  version: string;
  scoring_version: string;
  provisioned: boolean;
  measurable: boolean;
  measurement: string;
  overall_ei: {
    measurable: boolean;
    ei_score: number | null;
    band: string | null;
    coverage_pct: number;
    confidence: DimensionConfidence;
  };
  dimension_scores: EiProfileDimension[];
  strength_areas: StrengthArea[];
  development_areas: DevelopmentArea[];
  critical_risks: CriticalRisk[];
  growth_potential: GrowthPotential;
  coverage: {
    dimensions_total: number;
    dimensions_measurable: number;
    coverage_pct: number;
  };
  confidence: DimensionConfidence;
  language_policy: typeof LANGUAGE_POLICY;
  notes: string[];
  generated_at: string;
}

// ----------------------------------------------------------------------------
// Derivation helpers (pure)
// ----------------------------------------------------------------------------

const STRENGTH_BANDS = new Set(['Strong', 'Excellent']);

function projectDimension(d: ScoredDimension): EiProfileDimension {
  return {
    ei_dimension_id: d.ei_dimension_id,
    dimension_name: d.dimension_name,
    measurable: d.measurable,
    score: d.score,
    band: d.band,
    rollup_weight: d.rollup_weight,
    coverage_pct: d.coverage_pct,
    confidence: d.confidence,
    reason: d.reason ?? null,
  };
}

function deriveStrengths(dims: ScoredDimension[]): StrengthArea[] {
  return dims
    .filter((d) => d.measurable && d.score != null && d.band != null && STRENGTH_BANDS.has(d.band))
    .map((d) => ({
      ei_dimension_id: d.ei_dimension_id,
      dimension_name: d.dimension_name,
      score: d.score as number,
      band: d.band as string,
      rollup_weight: d.rollup_weight,
      confidence_band: d.confidence.band,
      rationale: `Measured at ${d.score} (${d.band}) — at or above the Strong threshold.`,
    }))
    .sort((a, b) => b.score - a.score);
}

function deriveDevelopmentAreas(dims: ScoredDimension[]): DevelopmentArea[] {
  return dims
    .filter((d) => d.measurable && d.score != null && d.band != null && !STRENGTH_BANDS.has(d.band))
    .map((d) => ({
      ei_dimension_id: d.ei_dimension_id,
      dimension_name: d.dimension_name,
      score: d.score as number,
      band: d.band as string,
      rollup_weight: d.rollup_weight,
      headroom: round1(100 - (d.score as number)),
      rationale: `Measured at ${d.score} (${d.band}) — below the Strong threshold; ${round1(100 - (d.score as number))} points of headroom.`,
    }))
    .sort((a, b) => a.score - b.score);
}

function deriveCriticalRisks(artifact: EmployabilityScore): CriticalRisk[] {
  const risks: CriticalRisk[] = [];
  for (const d of artifact.dimension_scores) {
    if (d.measurable && d.band === 'Early' && d.score != null) {
      risks.push({
        type: 'low_readiness',
        ei_dimension_id: d.ei_dimension_id,
        dimension_name: d.dimension_name,
        severity: 'high',
        detail: `${d.dimension_name} is at ${d.score} (Early band) — a critical readiness risk.`,
      });
    } else if (!d.measurable) {
      risks.push({
        type: 'blind_spot',
        ei_dimension_id: d.ei_dimension_id,
        dimension_name: d.dimension_name,
        severity: 'moderate',
        detail: `${d.dimension_name} cannot be measured (${d.reason ?? 'insufficient coverage'}) — readiness is unconfirmed (blind spot), not assumed.`,
      });
    }
  }
  if (artifact.measurable && (artifact.ei.confidence.band === 'Low' || artifact.ei.confidence.band === 'None')) {
    risks.push({
      type: 'low_confidence',
      ei_dimension_id: null,
      dimension_name: null,
      severity: 'moderate',
      detail: `Overall confidence is ${artifact.ei.confidence.band} (${artifact.ei.confidence.score}) — the profile is provisional until measurement coverage improves.`,
    });
  }
  return risks;
}

function deriveGrowthPotential(dims: ScoredDimension[]): GrowthPotential {
  const improvable = dims.filter((d) => d.measurable && d.score != null && d.band !== 'Excellent');
  if (improvable.length === 0) {
    const anyMeasurable = dims.some((d) => d.measurable && d.score != null);
    if (!anyMeasurable) {
      return {
        level: 'Unmeasured',
        score: null,
        improvable_dimensions: [],
        drivers: [],
        reason: 'No measurable dimensions — developmental upside cannot be derived (not assumed).',
      };
    }
    return {
      level: 'Low',
      score: 0,
      improvable_dimensions: [],
      drivers: [],
      reason: 'All measurable dimensions are already at the Excellent band — little remaining headroom (a positive signal, not a deficiency).',
    };
  }

  let wSum = 0;
  let whSum = 0;
  for (const d of improvable) {
    const w = d.rollup_weight > 0 ? d.rollup_weight : 1;
    const headroom = 100 - (d.score as number);
    wSum += w;
    whSum += w * headroom;
  }
  const score = wSum > 0 ? round1(whSum / wSum) : 0;
  const level: GrowthPotential['level'] = score >= 40 ? 'High' : score >= 20 ? 'Moderate' : 'Low';

  const improvable_dimensions = improvable
    .map((d) => ({
      ei_dimension_id: d.ei_dimension_id,
      dimension_name: d.dimension_name,
      headroom: round1(100 - (d.score as number)),
    }))
    .sort((a, b) => b.headroom - a.headroom);

  const top = improvable_dimensions.slice(0, 3).map((x) => `${x.dimension_name} (+${x.headroom})`);
  const drivers = [`Weighted headroom across ${improvable.length} improvable dimension${improvable.length === 1 ? '' : 's'}: ${score}.`];
  if (top.length) drivers.push(`Largest upside: ${top.join(', ')}.`);

  return {
    level,
    score,
    improvable_dimensions,
    drivers,
    reason: 'Growth Potential reflects developmental upside (weighted headroom across improvable readiness dimensions) — higher means more room to grow, not a deficiency.',
  };
}

function emptyProfile(subjectId: string, roleId: string | null, artifact: EmployabilityScore | null, reason: string): EiProfile {
  const conf: DimensionConfidence = artifact?.ei.confidence ?? {
    score: 0,
    band: 'None',
    measurement: 'unmeasured',
    caps: [],
    factors: [reason],
  };
  return {
    ok: true,
    subject_id: subjectId,
    role_id: roleId,
    version: EI_PROFILE_ENGINE_VERSION,
    scoring_version: artifact?.scoring_version ?? 'unknown',
    provisioned: artifact?.provisioned ?? false,
    measurable: false,
    measurement: artifact?.measurement ?? 'unmeasured',
    overall_ei: {
      measurable: false,
      ei_score: null,
      band: null,
      coverage_pct: artifact?.summary.coverage_pct ?? 0,
      confidence: conf,
    },
    dimension_scores: artifact ? artifact.dimension_scores.map(projectDimension) : [],
    strength_areas: [],
    development_areas: [],
    critical_risks: artifact ? deriveCriticalRisks(artifact) : [],
    growth_potential: {
      level: 'Unmeasured',
      score: null,
      improvable_dimensions: [],
      drivers: [],
      reason,
    },
    coverage: {
      dimensions_total: artifact?.summary.dimensions_total ?? 0,
      dimensions_measurable: artifact?.summary.dimensions_measurable ?? 0,
      coverage_pct: artifact?.summary.coverage_pct ?? 0,
    },
    confidence: conf,
    language_policy: LANGUAGE_POLICY,
    notes: [reason],
    generated_at: new Date().toISOString(),
  };
}

// ----------------------------------------------------------------------------
// Public entry — buildEiProfile
// ----------------------------------------------------------------------------

/**
 * Build the candidate Employability Profile for one subject. Read-only, pure
 * derivation over the Phase 3.3 scoring artifact. NEVER throws — any failure
 * degrades to an honest unmeasured profile with a reason.
 */
export async function buildEiProfile(pool: Pool, subjectId: string): Promise<EiProfile> {
  const sid = String(subjectId ?? '').trim();
  let artifact: EmployabilityScore | null = null;
  try {
    artifact = await computeEmployabilityScore(pool, sid);
  } catch (err: any) {
    return emptyProfile(sid, null, null, `Employability score could not be computed: ${err?.message ?? 'unknown error'}.`);
  }

  if (!artifact.measurable) {
    const reason = artifact.notes?.[0] ?? 'No measured competency profile — employability is unmeasured (not assumed).';
    return emptyProfile(sid, artifact.role_id, artifact, reason);
  }

  const dims = artifact.dimension_scores;
  const strength_areas = deriveStrengths(dims);
  const development_areas = deriveDevelopmentAreas(dims);
  const critical_risks = deriveCriticalRisks(artifact);
  const growth_potential = deriveGrowthPotential(dims);

  const notes: string[] = [
    `Profile composed from the Phase 3.3 employability scoring artifact (${artifact.scoring_version}); numbers are re-shaped, never recomputed.`,
  ];
  if (strength_areas.length === 0) notes.push('No dimension reached the Strong band yet — no strength areas surfaced (not fabricated).');
  if (critical_risks.length > 0) notes.push(`${critical_risks.length} risk flag${critical_risks.length === 1 ? '' : 's'} surfaced (low readiness, blind spots, or low confidence).`);

  return {
    ok: true,
    subject_id: sid,
    role_id: artifact.role_id,
    version: EI_PROFILE_ENGINE_VERSION,
    scoring_version: artifact.scoring_version,
    provisioned: artifact.provisioned,
    measurable: true,
    measurement: artifact.measurement,
    overall_ei: {
      measurable: artifact.ei.measurable,
      ei_score: artifact.ei.ei_score,
      band: artifact.ei.band,
      coverage_pct: artifact.ei.coverage_pct,
      confidence: artifact.ei.confidence,
    },
    dimension_scores: dims.map(projectDimension),
    strength_areas,
    development_areas,
    critical_risks,
    growth_potential,
    coverage: {
      dimensions_total: artifact.summary.dimensions_total,
      dimensions_measurable: artifact.summary.dimensions_measurable,
      coverage_pct: artifact.summary.coverage_pct,
    },
    confidence: artifact.ei.confidence,
    language_policy: LANGUAGE_POLICY,
    notes,
    generated_at: new Date().toISOString(),
  };
}
