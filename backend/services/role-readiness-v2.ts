/**
 * Phase 3.5 — Role Readiness Engine V2.
 *
 * Extends the Phase 2 Role Readiness Framework into a five-component role view
 * for one subject:
 *
 *   - Role Readiness  — weighted attainment vs the role profile (Phase 2).
 *   - Role Match      — fit classification (capped by critical gaps, Phase 2).
 *   - Role Gap        — the gap areas + the single most material (top) gap.
 *   - Role Risk       — readiness risk (role-risk-engine, Phase 3.5).
 *   - Role Potential  — developmental upside (role-potential-engine, Phase 3.5).
 *
 * PURE COMPOSITION: every number traces back to computeRoleReadinessForSubject
 * (Phase 2) and buildEiProfile (Phase 3.4); this orchestrator only re-shapes
 * and classifies. Never throws — degrades to honest 'unmeasured' components with
 * reasons. Developmental signal only.
 */

import type { Pool } from 'pg';
import { computeRoleReadinessForSubject } from './competency-runtime.js';
import type { ReadinessResult, ReadinessGap } from './role-competency-profile.js';
import { buildEiProfile, type EiProfile } from './ei-profile-engine.js';
import { assessRoleRisk, type RoleRiskResult } from './role-risk-engine.js';
import { assessRolePotential, type RolePotentialResult } from './role-potential-engine.js';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';

export const ROLE_READINESS_V2_VERSION = 'phase-3.5';

export interface RoleMatch {
  fit_band: 'strong' | 'good' | 'partial' | 'low' | 'unmeasured';
  label: string;
  score: number | null;
  capped_by_critical: boolean;
}

export interface RoleGap {
  top_gap: {
    competency_id: string;
    competency_name: string | null;
    required_level: number;
    actual_level: number | null;
    gap: number;
    criticality: string;
    blocking: boolean;
  } | null;
  gap_areas: ReadinessGap[];
  critical_gaps: ReadinessGap[];
  blocking_gaps: number;
}

export interface RoleReadinessV2 {
  ok: boolean;
  subject_id: string;
  role_id: string | null;
  role_title: string | null;
  version: string;
  measurable: boolean;
  readiness: {
    measured: boolean;
    score: number | null;
    band: string | null;
    label: string | null;
    coverage_pct: number | null;
  };
  role_match: RoleMatch;
  role_gap: RoleGap;
  role_risk: RoleRiskResult;
  role_potential: RolePotentialResult;
  ei_profile_summary: {
    measurable: boolean;
    ei_score: number | null;
    band: string | null;
    coverage_pct: number;
    confidence: EiProfile['confidence'];
  };
  language_policy: typeof LANGUAGE_POLICY;
  notes: string[];
  generated_at: string;
}

function pickTopGap(readiness: ReadinessResult): RoleGap['top_gap'] {
  // Prefer the largest blocking (critical) gap; otherwise the largest gap area.
  const pool = readiness.critical_gaps.length > 0 ? readiness.critical_gaps : readiness.gap_areas;
  if (pool.length === 0) return null;
  const top = [...pool].sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0];
  if (top.gap == null) return null;
  return {
    competency_id: top.competency_id,
    competency_name: top.competency_name,
    required_level: top.required_level,
    actual_level: top.actual_level,
    gap: top.gap,
    criticality: top.criticality,
    blocking: top.blocking,
  };
}

function emptyV2(
  subjectId: string,
  roleId: string | null,
  roleTitle: string | null,
  eiProfile: EiProfile,
  notes: string[],
): RoleReadinessV2 {
  return {
    ok: true,
    subject_id: subjectId,
    role_id: roleId,
    role_title: roleTitle,
    version: ROLE_READINESS_V2_VERSION,
    measurable: false,
    readiness: { measured: false, score: null, band: null, label: null, coverage_pct: null },
    role_match: { fit_band: 'unmeasured', label: 'Unmeasured', score: null, capped_by_critical: false },
    role_gap: { top_gap: null, gap_areas: [], critical_gaps: [], blocking_gaps: 0 },
    role_risk: assessRoleRisk(null, eiProfile),
    role_potential: assessRolePotential(null, eiProfile),
    ei_profile_summary: {
      measurable: eiProfile.overall_ei.measurable,
      ei_score: eiProfile.overall_ei.ei_score,
      band: eiProfile.overall_ei.band,
      coverage_pct: eiProfile.overall_ei.coverage_pct,
      confidence: eiProfile.confidence,
    },
    language_policy: LANGUAGE_POLICY,
    notes,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Compute the V2 role readiness view for one subject. Read-only composition;
 * never throws.
 */
export async function computeRoleReadinessV2(pool: Pool, subjectId: string): Promise<RoleReadinessV2> {
  const sid = String(subjectId ?? '').trim();

  // EI profile is best-effort context (confidence + growth potential). Its own
  // buildEiProfile never throws.
  const eiProfile = await buildEiProfile(pool, sid);

  let base: Awaited<ReturnType<typeof computeRoleReadinessForSubject>>;
  try {
    base = await computeRoleReadinessForSubject(pool, sid);
  } catch (err: any) {
    return emptyV2(sid, eiProfile.role_id, null, eiProfile, [
      `Role readiness could not be computed: ${err?.message ?? 'unknown error'}.`,
    ]);
  }

  const readiness = base.readiness;
  if (!readiness || !readiness.measured || readiness.readiness_score == null) {
    const notes = [...(base.notes ?? [])];
    if (notes.length === 0) notes.push('Role readiness is unmeasured — no scored profile or no linked role.');
    return emptyV2(sid, base.role_id, readiness?.role_title ?? null, eiProfile, notes);
  }

  const role_match: RoleMatch = {
    fit_band: readiness.role_fit.band,
    label: readiness.role_fit.label,
    score: readiness.role_fit.score,
    capped_by_critical: readiness.role_fit.capped_by_critical,
  };

  const role_gap: RoleGap = {
    top_gap: pickTopGap(readiness),
    gap_areas: readiness.gap_areas,
    critical_gaps: readiness.critical_gaps,
    blocking_gaps: readiness.blocking_gaps,
  };

  const role_risk = assessRoleRisk(readiness, eiProfile);
  const role_potential = assessRolePotential(readiness, eiProfile);

  const notes: string[] = [
    `Composed from Phase 2 role readiness + Phase 3.4 EI profile; numbers are re-shaped, never recomputed.`,
    ...(readiness.notes ?? []),
  ];
  if (role_gap.top_gap) {
    notes.push(`Most material gap: ${role_gap.top_gap.competency_name ?? role_gap.top_gap.competency_id} (gap ${role_gap.top_gap.gap}${role_gap.top_gap.blocking ? ', critical/blocking' : ''}).`);
  }

  return {
    ok: true,
    subject_id: sid,
    role_id: base.role_id,
    role_title: readiness.role_title,
    version: ROLE_READINESS_V2_VERSION,
    measurable: true,
    readiness: {
      measured: readiness.measured,
      score: readiness.readiness_score,
      band: readiness.readiness_band,
      label: readiness.readiness_label,
      coverage_pct: readiness.coverage_pct,
    },
    role_match,
    role_gap,
    role_risk,
    role_potential,
    ei_profile_summary: {
      measurable: eiProfile.overall_ei.measurable,
      ei_score: eiProfile.overall_ei.ei_score,
      band: eiProfile.overall_ei.band,
      coverage_pct: eiProfile.overall_ei.coverage_pct,
      confidence: eiProfile.confidence,
    },
    language_policy: LANGUAGE_POLICY,
    notes,
    generated_at: new Date().toISOString(),
  };
}
