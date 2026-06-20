/**
 * PHASE 4 — Career Intelligence Bridge.
 *
 * A pure, read-only, never-throws layer that COMPOSES the already-built Phase 3
 * Competency-Employability-Intelligence (CEI) engines into ONE career-intelligence
 * envelope, projected across the six Phase-4 career deliverables:
 *
 *   - Career Readiness     — role / industry / function readiness (CEI 3.5–3.7).
 *   - Career Pathways      — EI readiness + gap context overlaid on the existing
 *                            cg_* career graph (the graph itself is NOT rebuilt;
 *                            the bridge only supplies the EI-grounded overlay).
 *   - Career Planning      — measured gaps + recommendations shaped into inputs
 *                            the existing M5 growth-plan bridge / goals consume.
 *   - Career Growth        — growth potential (headroom) + EI history / progression.
 *   - Career Development   — EI recommendations (emitted / not_applicable / withheld
 *                            accounting preserved verbatim).
 *   - Career Builder       — a compact cross-surface summary tying the five together.
 *
 * Honesty contract (carried from Phase 3, non-negotiable):
 *   - COMPOSES already-computed competency/EI data — never recomputes a score,
 *     never fabricates, never zero-fills an absent measure.
 *   - Coverage (data exists) and Confidence (trustworthy) are reported as TWO
 *     SEPARATE axes, never composited. The domain-proxy confidence cap is disclosed.
 *   - Read-only & never-throws: every engine call is guarded; a failing source
 *     degrades its surface to an honest empty (with a note), never the whole
 *     envelope. ZERO DDL — the bridge only reads what the CEI write paths created.
 *   - Outputs are DEVELOPMENTAL SIGNALS ONLY — never hiring/promotion/suitability
 *     predictions (the underlying engines' language_policy is surfaced unchanged).
 *
 * Byte-identical flag-OFF is enforced by the route gate (503 before any call here).
 */

import type { Pool } from 'pg';
import { LANGUAGE_POLICY, emptyConfidence, type DimensionConfidence } from './competency-ei-scoring-shared.js';
import { buildEiProfile, type EiProfile } from './ei-profile-engine.js';
import {
  computeEmployabilityDimensions,
  type EmployabilityDimensionsResult,
} from './competency-ei-dimensions.js';
import { computeRoleReadinessV2, type RoleReadinessV2 } from './role-readiness-v2.js';
import { listIndustryReadiness } from './industry-readiness-engine.js';
import { listFunctionReadiness } from './function-readiness-engine.js';
import {
  computeEmployabilitySignals,
  type EmployabilitySignals,
} from './employability-signal-engine.js';
import {
  computeEmployabilityRecommendations,
  type EmployabilityRecommendations,
  type EvaluatedRecommendation,
} from './ei-recommendation-engine.js';
import { buildEiHistory, type EiHistory } from './ei-history-engine.js';

export const CAREER_INTELLIGENCE_VERSION = '4.0.0';

// ---------------------------------------------------------------------------
// Envelope shape
// ---------------------------------------------------------------------------

/** The two honesty axes, surfaced together but NEVER composited into one number. */
export interface CoverageConfidence {
  /** Coverage axis — does the underlying data exist / is it measured? */
  coverage: {
    measurable: boolean;
    coverage_pct: number | null;
    detail: string;
  };
  /** Confidence axis — is the measure trustworthy? (domain-proxy cap disclosed) */
  confidence: {
    band: DimensionConfidence['band'];
    basis: string;
    caps: string[];
    domain_proxy_capped: boolean;
  };
}

export interface CareerReadinessSurface {
  role: {
    role_id: string | null;
    role_title: string | null;
    measurable: boolean;
    score: number | null;
    band: string | null;
    fit_band: RoleReadinessV2['role_match']['fit_band'];
    capped_by_critical: boolean;
    blocking_gaps: number;
    axes: CoverageConfidence;
  };
  industries: {
    available_count: number;
    measurable_count: number;
    items: Array<{
      industry_id: string;
      industry_name: string | null;
      available: boolean;
      measurable: boolean;
      score: number | null;
      band: string | null;
    }>;
  };
  functions: {
    available_count: number;
    measurable_count: number;
    items: Array<{
      function_id: string;
      function_name: string | null;
      available: boolean;
      measurable: boolean;
      score: number | null;
      band: string | null;
    }>;
  };
  notes: string[];
}

export interface CareerPathwaysSurface {
  /** EI-grounded readiness context the existing cg_* pathway view overlays. */
  anchor_role: {
    role_id: string | null;
    role_title: string | null;
    readiness_score: number | null;
    readiness_band: string | null;
    fit_band: RoleReadinessV2['role_match']['fit_band'];
  };
  /** Top measured competency gaps that gate progression along any pathway. */
  gating_gaps: Array<{
    competency_id: string;
    competency_name: string | null;
    required_level: number;
    actual_level: number | null;
    gap: number;
    criticality: string;
    blocking: boolean;
  }>;
  /** Dimension headroom — where growth most expands future pathway options. */
  growth_headroom: Array<{ ei_dimension_id: string; dimension_name: string; headroom: number }>;
  axes: CoverageConfidence;
  note: string;
}

export interface CareerPlanningSurface {
  /** Gaps shaped as plan focus areas (measured only; never fabricated). */
  focus_areas: Array<{
    competency_id: string;
    competency_name: string | null;
    required_level: number;
    actual_level: number | null;
    gap: number;
    criticality: string;
    blocking: boolean;
    source: 'role_gap';
  }>;
  /** Emitted recommendations the plan can adopt as actions (library-backed). */
  plan_actions: Array<{
    recommendation_id: string;
    category: EvaluatedRecommendation['category'];
    title: string;
    priority: EvaluatedRecommendation['priority'];
    rationale: string;
  }>;
  /** Inputs the existing M5 growth-plan bridge consumes (no new plan store). */
  growth_plan_inputs: {
    role_id: string | null;
    role_title: string | null;
    measurable: boolean;
    overall_ei: number | null;
    focus_competencies: string[];
  };
  axes: CoverageConfidence;
  notes: string[];
}

export interface CareerGrowthSurface {
  growth_potential: EiProfile['growth_potential'];
  history: {
    assessment_runs: number;
    ei_snapshots: number;
    measured_snapshots: number;
    dimension_series: number;
  };
  axes: CoverageConfidence;
  notes: string[];
}

export interface CareerDevelopmentSurface {
  /** Full emitted/not_applicable/withheld accounting preserved verbatim. */
  accounting: EmployabilityRecommendations['summary'];
  emitted: EvaluatedRecommendation[];
  not_applicable_count: number;
  withheld_count: number;
  by_category: EmployabilityRecommendations['by_category'];
  axes: CoverageConfidence;
  notes: string[];
}

export interface CareerBuilderSummary {
  measurable: boolean;
  overall_ei: number | null;
  overall_band: string | null;
  role_title: string | null;
  role_fit_band: RoleReadinessV2['role_match']['fit_band'];
  emitted_recommendations: number;
  growth_potential_level: EiProfile['growth_potential']['level'];
  surfaces: Array<{ id: string; label: string; measurable: boolean; note: string }>;
}

export interface CareerIntelligenceEnvelope {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  measurable: boolean;
  /** Top-level honesty axes for the whole envelope (EI profile derived). */
  axes: CoverageConfidence;
  career_readiness: CareerReadinessSurface;
  career_pathways: CareerPathwaysSurface;
  career_planning: CareerPlanningSurface;
  career_growth: CareerGrowthSurface;
  career_development: CareerDevelopmentSurface;
  career_builder: CareerBuilderSummary;
  source_versions: Record<string, string>;
  language_policy: EiProfile['language_policy'];
  notes: string[];
}

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

function axesFromEi(
  measurable: boolean,
  coveragePct: number | null,
  confidence: DimensionConfidence,
  coverageDetail: string,
): CoverageConfidence {
  const caps = Array.isArray(confidence?.caps) ? confidence.caps : [];
  const measurement = confidence?.measurement ?? '';
  // The domain-proxy cap is disclosed (never composited into coverage). It is
  // surfaced as a cap string and/or in the measurement basis by the CEI scorer.
  const domainProxy =
    caps.some((c) => /proxy/i.test(c)) || /proxy/i.test(measurement);
  return {
    coverage: {
      measurable,
      coverage_pct: coveragePct,
      detail: coverageDetail,
    },
    confidence: {
      band: measurable ? (confidence?.band ?? 'None') : 'None',
      basis: measurement || 'no measured competency profile',
      caps,
      domain_proxy_capped: domainProxy,
    },
  };
}

// ---------------------------------------------------------------------------
// Bridge — compose every CEI engine ONCE for one subject (read-only).
// ---------------------------------------------------------------------------

export async function buildCareerIntelligence(
  pool: Pool,
  subjectId: string,
): Promise<CareerIntelligenceEnvelope> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];

  // Compose every source ONCE; each guarded so one failure never sinks the envelope.
  const profile = await buildEiProfile(pool, sid).catch((e) => {
    notes.push(`EI profile unavailable: ${e?.message ?? 'error'} (honest empty).`);
    return null;
  });
  const dimensions = await computeEmployabilityDimensions(pool, sid).catch(() => null);
  const role = await computeRoleReadinessV2(pool, sid).catch(() => null);
  const industries = await listIndustryReadiness(pool, sid).catch(() => null);
  const functions = await listFunctionReadiness(pool, sid).catch(() => null);
  const signals = await computeEmployabilitySignals(pool, sid).catch(() => null);
  const recs = await computeEmployabilityRecommendations(pool, sid).catch(() => null);
  const history = await buildEiHistory(pool, sid).catch(() => null);

  const measurable = profile?.measurable ?? false;
  const topAxes = axesFromEi(
    measurable,
    profile?.overall_ei.coverage_pct ?? null,
    (profile?.confidence ?? defaultConfidence()),
    profile
      ? `${profile.coverage.dimensions_measurable}/${profile.coverage.dimensions_total} dimensions measured`
      : 'EI profile not provisioned',
  );

  return {
    ok: true,
    subject_id: sid,
    version: CAREER_INTELLIGENCE_VERSION,
    generated_at: new Date().toISOString(),
    measurable,
    axes: topAxes,
    career_readiness: buildReadinessSurface(role, industries, functions),
    career_pathways: buildPathwaysSurface(role, profile),
    career_planning: buildPlanningSurface(role, recs, profile),
    career_growth: buildGrowthSurface(profile, history),
    career_development: buildDevelopmentSurface(recs),
    career_builder: buildBuilderSummary(profile, role, recs),
    source_versions: collectVersions(profile, dimensions, role, signals, recs),
    language_policy: profile?.language_policy ?? LANGUAGE_POLICY,
    notes,
  };
}

function defaultConfidence(): DimensionConfidence {
  return emptyConfidence('domain_proxy', 'no measured competency profile');
}

function collectVersions(
  profile: EiProfile | null,
  dimensions: EmployabilityDimensionsResult | null,
  role: RoleReadinessV2 | null,
  signals: EmployabilitySignals | null,
  recs: EmployabilityRecommendations | null,
): Record<string, string> {
  const out: Record<string, string> = { career_intelligence: CAREER_INTELLIGENCE_VERSION };
  if (profile) out.ei_profile = profile.version;
  if (dimensions) out.dimensions = dimensions.ei_version;
  if (role) out.role_readiness = role.version;
  if (signals) out.signals = signals.version;
  if (recs) out.recommendations = recs.version;
  return out;
}

// --- Career Readiness -------------------------------------------------------

function buildReadinessSurface(
  role: RoleReadinessV2 | null,
  industries: Awaited<ReturnType<typeof listIndustryReadiness>> | null,
  functions: Awaited<ReturnType<typeof listFunctionReadiness>> | null,
): CareerReadinessSurface {
  const notes: string[] = [];
  if (!role) notes.push('Role readiness unavailable — no measured competency profile (honest absence).');

  const roleAxes = axesFromEi(
    role?.measurable ?? false,
    role?.readiness.coverage_pct ?? null,
    (role?.ei_profile_summary.confidence ?? defaultConfidence()),
    role?.measurable ? 'role readiness measured against role requirements' : 'role readiness not measurable',
  );

  const industryItems = (industries?.industries ?? []).map((i) => ({
    industry_id: i.industry_id,
    industry_name: i.industry_name,
    available: i.available,
    measurable: i.measurable,
    score: i.readiness?.score ?? null,
    band: i.readiness?.band ?? null,
  }));
  const functionItems = (functions?.functions ?? []).map((f) => ({
    function_id: f.function_id,
    function_name: f.function_name,
    available: f.available,
    measurable: f.measurable,
    score: f.readiness?.score ?? null,
    band: f.readiness?.band ?? null,
  }));

  if (industryItems.length === 0) notes.push('No seeded industries to assess (honest empty, not zero readiness).');
  if (functionItems.length === 0) notes.push('No seeded functions to assess (honest empty, not zero readiness).');

  return {
    role: {
      role_id: role?.role_id ?? null,
      role_title: role?.role_title ?? null,
      measurable: role?.measurable ?? false,
      score: role?.readiness.score ?? null,
      band: role?.readiness.band ?? null,
      fit_band: role?.role_match.fit_band ?? 'unmeasured',
      capped_by_critical: role?.role_match.capped_by_critical ?? false,
      blocking_gaps: role?.role_gap.blocking_gaps ?? 0,
      axes: roleAxes,
    },
    industries: {
      available_count: industryItems.filter((i) => i.available).length,
      measurable_count: industryItems.filter((i) => i.measurable).length,
      items: industryItems,
    },
    functions: {
      available_count: functionItems.filter((f) => f.available).length,
      measurable_count: functionItems.filter((f) => f.measurable).length,
      items: functionItems,
    },
    notes,
  };
}

// --- Career Pathways --------------------------------------------------------

function buildPathwaysSurface(
  role: RoleReadinessV2 | null,
  profile: EiProfile | null,
): CareerPathwaysSurface {
  const gatingGaps = (role?.role_gap.gap_areas ?? [])
    .filter((g) => g.gap != null && g.gap > 0)
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))
    .slice(0, 8)
    .map((g) => ({
      competency_id: g.competency_id,
      competency_name: g.competency_name,
      required_level: g.required_level,
      actual_level: g.actual_level,
      gap: g.gap as number,
      criticality: g.criticality,
      blocking: g.blocking,
    }));

  const headroom = (profile?.growth_potential.improvable_dimensions ?? []).slice(0, 6);

  const axes = axesFromEi(
    role?.measurable ?? false,
    role?.readiness.coverage_pct ?? null,
    (role?.ei_profile_summary.confidence ?? defaultConfidence()),
    role?.measurable
      ? 'EI readiness overlay measured for the anchor role'
      : 'no measured anchor-role readiness to overlay on pathways',
  );

  return {
    anchor_role: {
      role_id: role?.role_id ?? null,
      role_title: role?.role_title ?? null,
      readiness_score: role?.readiness.score ?? null,
      readiness_band: role?.readiness.band ?? null,
      fit_band: role?.role_match.fit_band ?? 'unmeasured',
    },
    gating_gaps: gatingGaps,
    growth_headroom: headroom,
    axes,
    note: 'EI-grounded readiness/gap overlay only — the career-graph pathfinding (cg_*) is unchanged and supplies the structural pathway.',
  };
}

// --- Career Planning --------------------------------------------------------

function buildPlanningSurface(
  role: RoleReadinessV2 | null,
  recs: EmployabilityRecommendations | null,
  profile: EiProfile | null,
): CareerPlanningSurface {
  const notes: string[] = [];

  const focusAreas = (role?.role_gap.gap_areas ?? [])
    .filter((g) => g.gap != null && g.gap > 0)
    .sort((a, b) => {
      // blocking/critical first, then largest gap
      if (a.blocking !== b.blocking) return a.blocking ? -1 : 1;
      return (b.gap ?? 0) - (a.gap ?? 0);
    })
    .slice(0, 10)
    .map((g) => ({
      competency_id: g.competency_id,
      competency_name: g.competency_name,
      required_level: g.required_level,
      actual_level: g.actual_level,
      gap: g.gap as number,
      criticality: g.criticality,
      blocking: g.blocking,
      source: 'role_gap' as const,
    }));

  const planActions = (recs?.recommendations ?? []).slice(0, 12).map((r) => ({
    recommendation_id: r.recommendation_id,
    category: r.category,
    title: r.title,
    priority: r.priority,
    rationale: r.rationale,
  }));

  if (focusAreas.length === 0) notes.push('No measured competency gaps to plan against (honest empty).');
  if (planActions.length === 0) notes.push('No emitted recommendations to adopt as plan actions (honest empty).');

  const axes = axesFromEi(
    profile?.measurable ?? false,
    profile?.overall_ei.coverage_pct ?? null,
    (profile?.confidence ?? defaultConfidence()),
    'planning inputs derived from measured gaps + emitted recommendations',
  );

  return {
    focus_areas: focusAreas,
    plan_actions: planActions,
    growth_plan_inputs: {
      role_id: role?.role_id ?? null,
      role_title: role?.role_title ?? null,
      measurable: profile?.measurable ?? false,
      overall_ei: profile?.overall_ei.ei_score ?? null,
      focus_competencies: focusAreas.map((f) => f.competency_id),
    },
    axes,
    notes,
  };
}

// --- Career Growth ----------------------------------------------------------

function buildGrowthSurface(
  profile: EiProfile | null,
  history: EiHistory | null,
): CareerGrowthSurface {
  const notes: string[] = [];
  if (!profile) notes.push('Growth intelligence unavailable — no EI profile (honest absence).');
  if (history && history.ei_history.count === 0) {
    notes.push('No EI history captured yet — capture snapshots over time to build a growth trajectory.');
  }

  const axes = axesFromEi(
    profile?.measurable ?? false,
    profile?.overall_ei.coverage_pct ?? null,
    (profile?.confidence ?? defaultConfidence()),
    'growth potential = weighted headroom across improvable dimensions',
  );

  return {
    growth_potential:
      profile?.growth_potential ?? {
        level: 'Unmeasured',
        score: null,
        improvable_dimensions: [],
        drivers: [],
        reason: 'no measured competency profile',
      },
    history: {
      assessment_runs: history?.assessment_history.count ?? 0,
      ei_snapshots: history?.ei_history.count ?? 0,
      measured_snapshots: history?.ei_history.measured_count ?? 0,
      dimension_series: history?.dimension_history.length ?? 0,
    },
    axes,
    notes,
  };
}

// --- Career Development -----------------------------------------------------

function buildDevelopmentSurface(
  recs: EmployabilityRecommendations | null,
): CareerDevelopmentSurface {
  const notes: string[] = [];
  if (!recs) notes.push('Development intelligence unavailable — recommendation engine returned no data (honest absence).');
  else if (recs.recommendations.length === 0) {
    notes.push('No recommendations emitted — measured-but-not-triggered rules are not_applicable; unmeasured rules are withheld (never fabricated).');
  }

  const emptySummary: EmployabilityRecommendations['summary'] = {
    total_rules: 0,
    emitted: 0,
    not_applicable: 0,
    withheld: 0,
    coverage_pct: null,
    by_category: { development: 0, certification: 0, project: 0, experience: 0, behavioral: 0 },
    by_priority: { high: 0, medium: 0, low: 0 },
  };

  const axes = axesFromEi(
    recs?.measurable ?? false,
    recs?.summary.coverage_pct ?? null,
    (recs?.ei_profile_summary.confidence ?? defaultConfidence()),
    'development items = emitted recommendations; withheld preserves honest abstention',
  );

  return {
    accounting: recs?.summary ?? emptySummary,
    emitted: recs?.recommendations ?? [],
    not_applicable_count: recs?.not_applicable.length ?? 0,
    withheld_count: recs?.withheld.length ?? 0,
    by_category:
      recs?.by_category ?? { development: [], certification: [], project: [], experience: [], behavioral: [] },
    axes,
    notes,
  };
}

// --- Career Builder (cross-surface summary) ---------------------------------

function buildBuilderSummary(
  profile: EiProfile | null,
  role: RoleReadinessV2 | null,
  recs: EmployabilityRecommendations | null,
): CareerBuilderSummary {
  const measurable = profile?.measurable ?? false;
  return {
    measurable,
    overall_ei: profile?.overall_ei.ei_score ?? null,
    overall_band: profile?.overall_ei.band ?? null,
    role_title: role?.role_title ?? null,
    role_fit_band: role?.role_match.fit_band ?? 'unmeasured',
    emitted_recommendations: recs?.recommendations.length ?? 0,
    growth_potential_level: profile?.growth_potential.level ?? 'Unmeasured',
    surfaces: [
      {
        id: 'career_readiness',
        label: 'Career Readiness',
        measurable: role?.measurable ?? false,
        note: role?.measurable ? 'Role/industry/function readiness measured.' : 'Readiness not yet measurable.',
      },
      {
        id: 'career_pathways',
        label: 'Career Pathways',
        measurable: role?.measurable ?? false,
        note: 'EI readiness overlay on the existing career graph.',
      },
      {
        id: 'career_planning',
        label: 'Career Planning',
        measurable,
        note: 'Gaps + recommendations feed the M5 growth-plan bridge.',
      },
      {
        id: 'career_growth',
        label: 'Career Growth Intelligence',
        measurable,
        note: 'Growth potential (headroom) + EI history.',
      },
      {
        id: 'career_development',
        label: 'Career Development Intelligence',
        measurable: recs?.measurable ?? false,
        note: 'EI recommendations (emitted / not-applicable / withheld).',
      },
    ],
  };
}
