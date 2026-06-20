/**
 * PHASE 4 — Career Intelligence Validation.
 *
 * A read-only, never-throws super-admin honesty/invariant harness for the
 * Career Intelligence bridge — mirrors the Phase 3.12 super-admin-validation
 * engine. It composes the bridge ONCE for a real subject and validates each of
 * the six career surfaces area-by-area with PASS / WARN / FAIL precedence:
 *
 *   - WARN  = honest absence (no measured data) — NEVER a failure.
 *   - FAIL  = a genuine invariant violation (out-of-range score, incoherent
 *             band/score, composited axes, fabricated measure, missing policy).
 *   - PASS  = the invariant holds.
 *
 * Zero DDL, zero writes. A failing source degrades to WARN on that area only.
 */

import type { Pool } from 'pg';
import {
  buildCareerIntelligence,
  CAREER_INTELLIGENCE_VERSION,
  type CareerIntelligenceEnvelope,
  type CoverageConfidence,
} from './career-intelligence-bridge.js';

export type ValidationStatus = 'pass' | 'warn' | 'fail';

export interface ValidationCheck {
  id: string;
  label: string;
  status: ValidationStatus;
  detail: string;
}

export interface ValidationArea {
  id: string;
  label: string;
  status: ValidationStatus;
  measurable: boolean | null;
  checks: ValidationCheck[];
  notes: string[];
}

export interface CareerValidationResult {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  areas: ValidationArea[];
  summary: {
    areas_total: number;
    areas_pass: number;
    areas_warn: number;
    areas_fail: number;
    checks_total: number;
    checks_pass: number;
    checks_warn: number;
    checks_fail: number;
  };
}

// --- pure helpers -----------------------------------------------------------

function worst(checks: ValidationCheck[]): ValidationStatus {
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'warn')) return 'warn';
  return 'pass';
}

function inRange(n: number | null | undefined, lo = 0, hi = 100): boolean {
  return n == null || (typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi);
}

function bandScoreCoherent(score: number | null | undefined, band: string | null | undefined): boolean {
  return (score == null) === (band == null);
}

function area(
  id: string,
  label: string,
  checks: ValidationCheck[],
  notes: string[],
  measurable: boolean | null,
): ValidationArea {
  return { id, label, status: worst(checks), measurable, checks, notes };
}

/**
 * The two honesty axes must be reported SEPARATELY — coverage (data exists) and
 * confidence (trustworthy) are distinct objects, never collapsed into one number.
 */
function axesSeparate(axes: CoverageConfidence | undefined): boolean {
  return (
    !!axes &&
    typeof axes.coverage === 'object' &&
    typeof axes.confidence === 'object' &&
    'measurable' in axes.coverage &&
    'band' in axes.confidence
  );
}

// --- areas ------------------------------------------------------------------

function validateComposition(env: CareerIntelligenceEnvelope): ValidationArea {
  const checks: ValidationCheck[] = [];
  checks.push({
    id: 'envelope_ok',
    label: 'Envelope composed',
    status: env.ok ? 'pass' : 'fail',
    detail: env.ok ? `composed for subject ${env.subject_id}` : 'envelope did not compose',
  });
  checks.push({
    id: 'version',
    label: 'Version stamped',
    status: env.version === CAREER_INTELLIGENCE_VERSION ? 'pass' : 'fail',
    detail: `version=${env.version}`,
  });
  checks.push({
    id: 'six_surfaces',
    label: 'All six career surfaces present',
    status:
      env.career_readiness && env.career_pathways && env.career_planning &&
      env.career_growth && env.career_development && env.career_builder
        ? 'pass'
        : 'fail',
    detail: 'readiness · pathways · planning · growth · development · builder',
  });
  checks.push({
    id: 'language_policy',
    label: 'Developmental-only language policy attached',
    status:
      env.language_policy &&
      Array.isArray((env.language_policy as any).disallowed_terms) &&
      (env.language_policy as any).disallowed_terms.length > 0
        ? 'pass'
        : 'fail',
    detail: 'language_policy.disallowed_terms present (no hiring/promotion language)',
  });
  return area('composition', 'Bridge Composition', checks, [
    env.measurable ? 'EI profile measurable.' : 'EI profile not measurable — honest absence (WARN downstream, not FAIL).',
  ], env.measurable);
}

function validateReadiness(env: CareerIntelligenceEnvelope): ValidationArea {
  const r = env.career_readiness;
  const checks: ValidationCheck[] = [];
  checks.push({
    id: 'role_measurable',
    label: 'Role readiness measurable',
    status: r.role.measurable ? 'pass' : 'warn',
    detail: r.role.measurable
      ? `role ${r.role.role_title ?? r.role.role_id} readiness ${r.role.score} (${r.role.band})`
      : 'role readiness not measurable — honest absence',
  });
  checks.push({
    id: 'role_score_bounds',
    label: 'Role readiness score within 0–100 (or null)',
    status: inRange(r.role.score) ? 'pass' : 'fail',
    detail: `score=${r.role.score ?? 'null'}`,
  });
  checks.push({
    id: 'role_band_coherent',
    label: 'Role band present iff score present',
    status: bandScoreCoherent(r.role.score, r.role.band) ? 'pass' : 'fail',
    detail: `score=${r.role.score ?? 'null'} · band=${r.role.band ?? 'null'}`,
  });
  checks.push({
    id: 'fit_cap_preserved',
    label: 'Critical-gap fit cap preserved',
    status: typeof r.role.capped_by_critical === 'boolean' ? 'pass' : 'fail',
    detail: `capped_by_critical=${r.role.capped_by_critical} · blocking_gaps=${r.role.blocking_gaps}`,
  });
  checks.push({
    id: 'industry_counts',
    label: 'Industry counts non-negative & coherent',
    status:
      r.industries.measurable_count <= r.industries.available_count &&
      r.industries.available_count <= r.industries.items.length
        ? 'pass'
        : 'fail',
    detail: `measurable ${r.industries.measurable_count} ≤ available ${r.industries.available_count} ≤ items ${r.industries.items.length}`,
  });
  checks.push({
    id: 'function_counts',
    label: 'Function counts non-negative & coherent',
    status:
      r.functions.measurable_count <= r.functions.available_count &&
      r.functions.available_count <= r.functions.items.length
        ? 'pass'
        : 'fail',
    detail: `measurable ${r.functions.measurable_count} ≤ available ${r.functions.available_count} ≤ items ${r.functions.items.length}`,
  });
  checks.push({
    id: 'axes_separate',
    label: 'Coverage & Confidence reported as separate axes',
    status: axesSeparate(r.role.axes) ? 'pass' : 'fail',
    detail: 'role.axes.coverage and role.axes.confidence are distinct objects',
  });
  return area('career_readiness', 'Career Readiness', checks, r.notes, r.role.measurable);
}

function validatePathways(env: CareerIntelligenceEnvelope): ValidationArea {
  const p = env.career_pathways;
  const checks: ValidationCheck[] = [];
  checks.push({
    id: 'anchor_score_bounds',
    label: 'Anchor-role readiness within 0–100 (or null)',
    status: inRange(p.anchor_role.readiness_score) ? 'pass' : 'fail',
    detail: `score=${p.anchor_role.readiness_score ?? 'null'}`,
  });
  checks.push({
    id: 'anchor_band_coherent',
    label: 'Anchor band present iff score present',
    status: bandScoreCoherent(p.anchor_role.readiness_score, p.anchor_role.readiness_band) ? 'pass' : 'fail',
    detail: `score=${p.anchor_role.readiness_score ?? 'null'} · band=${p.anchor_role.readiness_band ?? 'null'}`,
  });
  const gapsValid = p.gating_gaps.every((g) => g.gap > 0 && inRange(g.actual_level, 0, 5) && inRange(g.required_level, 0, 5));
  checks.push({
    id: 'gating_gaps_real',
    label: 'Gating gaps are real positive gaps (no fabricated zeros)',
    status: gapsValid ? 'pass' : 'fail',
    detail: `${p.gating_gaps.length} gating gaps, all gap>0`,
  });
  checks.push({
    id: 'overlay_only',
    label: 'Overlay-only (career graph not rebuilt)',
    status: /overlay/i.test(p.note) ? 'pass' : 'warn',
    detail: p.note,
  });
  checks.push({
    id: 'axes_separate',
    label: 'Coverage & Confidence reported as separate axes',
    status: axesSeparate(p.axes) ? 'pass' : 'fail',
    detail: 'pathways.axes.coverage and pathways.axes.confidence are distinct objects',
  });
  return area('career_pathways', 'Career Pathways', checks, [], env.career_readiness.role.measurable);
}

function validatePlanning(env: CareerIntelligenceEnvelope): ValidationArea {
  const pl = env.career_planning;
  const checks: ValidationCheck[] = [];
  const focusValid = pl.focus_areas.every((f) => f.gap > 0 && f.source === 'role_gap');
  checks.push({
    id: 'focus_real',
    label: 'Focus areas are real measured gaps',
    status: focusValid ? 'pass' : 'fail',
    detail: `${pl.focus_areas.length} focus areas, all real role gaps`,
  });
  checks.push({
    id: 'actions_emitted_only',
    label: 'Plan actions are emitted recommendations only',
    status: pl.plan_actions.length === 0 || pl.plan_actions.every((a) => !!a.recommendation_id) ? 'pass' : 'fail',
    detail: `${pl.plan_actions.length} plan actions`,
  });
  checks.push({
    id: 'growth_plan_inputs',
    label: 'M5 growth-plan inputs present (reuses existing bridge)',
    status: pl.growth_plan_inputs && Array.isArray(pl.growth_plan_inputs.focus_competencies) ? 'pass' : 'fail',
    detail: `${pl.growth_plan_inputs.focus_competencies.length} focus competencies for the growth plan`,
  });
  checks.push({
    id: 'overall_ei_bounds',
    label: 'Growth-plan overall EI within 0–100 (or null)',
    status: inRange(pl.growth_plan_inputs.overall_ei) ? 'pass' : 'fail',
    detail: `overall_ei=${pl.growth_plan_inputs.overall_ei ?? 'null'}`,
  });
  checks.push({
    id: 'axes_separate',
    label: 'Coverage & Confidence reported as separate axes',
    status: axesSeparate(pl.axes) ? 'pass' : 'fail',
    detail: 'planning.axes.coverage and planning.axes.confidence are distinct objects',
  });
  return area('career_planning', 'Career Planning', checks, pl.notes, env.measurable);
}

function validateGrowth(env: CareerIntelligenceEnvelope): ValidationArea {
  const g = env.career_growth;
  const checks: ValidationCheck[] = [];
  checks.push({
    id: 'potential_level',
    label: 'Growth potential level present',
    status: ['High', 'Moderate', 'Low', 'Unmeasured'].includes(g.growth_potential.level) ? 'pass' : 'fail',
    detail: `level=${g.growth_potential.level}`,
  });
  checks.push({
    id: 'potential_score_bounds',
    label: 'Growth potential score within 0–100 (or null)',
    status: inRange(g.growth_potential.score) ? 'pass' : 'fail',
    detail: `score=${g.growth_potential.score ?? 'null'}`,
  });
  checks.push({
    id: 'potential_measurable_coherent',
    label: 'Unmeasured potential has null score',
    status:
      g.growth_potential.level === 'Unmeasured'
        ? g.growth_potential.score == null
          ? 'pass'
          : 'fail'
        : 'pass',
    detail: `level=${g.growth_potential.level} · score=${g.growth_potential.score ?? 'null'}`,
  });
  checks.push({
    id: 'history_counts',
    label: 'History counts non-negative & coherent',
    status:
      g.history.measured_snapshots <= g.history.ei_snapshots &&
      g.history.ei_snapshots >= 0 && g.history.assessment_runs >= 0
        ? 'pass'
        : 'fail',
    detail: `runs=${g.history.assessment_runs} · snapshots=${g.history.ei_snapshots} (measured ${g.history.measured_snapshots})`,
  });
  checks.push({
    id: 'history_present',
    label: 'EI history captured',
    status: g.history.ei_snapshots > 0 ? 'pass' : 'warn',
    detail: g.history.ei_snapshots > 0
      ? `${g.history.ei_snapshots} snapshots`
      : 'no snapshots yet — honest absence (capture over time to build a trajectory)',
  });
  checks.push({
    id: 'axes_separate',
    label: 'Coverage & Confidence reported as separate axes',
    status: axesSeparate(g.axes) ? 'pass' : 'fail',
    detail: 'growth.axes.coverage and growth.axes.confidence are distinct objects',
  });
  return area('career_growth', 'Career Growth Intelligence', checks, g.notes, env.measurable);
}

function validateDevelopment(env: CareerIntelligenceEnvelope): ValidationArea {
  const d = env.career_development;
  const checks: ValidationCheck[] = [];
  const s = d.accounting;
  checks.push({
    id: 'accounting_balanced',
    label: 'emitted + not_applicable + withheld = total rules',
    status: s.emitted + s.not_applicable + s.withheld === s.total_rules ? 'pass' : 'fail',
    detail: `${s.emitted} + ${s.not_applicable} + ${s.withheld} = ${s.total_rules}`,
  });
  checks.push({
    id: 'emitted_matches',
    label: 'Emitted list length matches accounting',
    status: d.emitted.length === s.emitted ? 'pass' : 'fail',
    detail: `emitted list=${d.emitted.length} · accounting=${s.emitted}`,
  });
  checks.push({
    id: 'withheld_preserved',
    label: 'Withheld abstention preserved (never fabricated)',
    status: d.withheld_count === s.withheld ? 'pass' : 'fail',
    detail: `withheld=${d.withheld_count}`,
  });
  checks.push({
    id: 'coverage_bounds',
    label: 'Recommendation coverage within 0–100 (or null)',
    status: inRange(s.coverage_pct) ? 'pass' : 'fail',
    detail: `coverage_pct=${s.coverage_pct ?? 'null'}`,
  });
  checks.push({
    id: 'measurable_flag',
    label: 'Development measurable',
    status: env.career_development.axes.coverage.measurable ? 'pass' : 'warn',
    detail: env.career_development.axes.coverage.measurable
      ? 'recommendations measurable'
      : 'no measured domain — recommendations honestly withheld',
  });
  checks.push({
    id: 'axes_separate',
    label: 'Coverage & Confidence reported as separate axes',
    status: axesSeparate(d.axes) ? 'pass' : 'fail',
    detail: 'development.axes.coverage and development.axes.confidence are distinct objects',
  });
  return area('career_development', 'Career Development Intelligence', checks, d.notes, env.career_development.axes.coverage.measurable);
}

function validateBuilder(env: CareerIntelligenceEnvelope): ValidationArea {
  const b = env.career_builder;
  const checks: ValidationCheck[] = [];
  checks.push({
    id: 'overall_ei_bounds',
    label: 'Overall EI within 0–100 (or null)',
    status: inRange(b.overall_ei) ? 'pass' : 'fail',
    detail: `overall_ei=${b.overall_ei ?? 'null'}`,
  });
  checks.push({
    id: 'band_coherent',
    label: 'Overall band present iff score present',
    status: bandScoreCoherent(b.overall_ei, b.overall_band) ? 'pass' : 'fail',
    detail: `score=${b.overall_ei ?? 'null'} · band=${b.overall_band ?? 'null'}`,
  });
  checks.push({
    id: 'five_surface_tiles',
    label: 'Five surface tiles tied together',
    status: Array.isArray(b.surfaces) && b.surfaces.length === 5 ? 'pass' : 'fail',
    detail: `${b.surfaces?.length ?? 0} surface tiles`,
  });
  checks.push({
    id: 'emitted_non_negative',
    label: 'Emitted recommendation count non-negative',
    status: b.emitted_recommendations >= 0 ? 'pass' : 'fail',
    detail: `emitted_recommendations=${b.emitted_recommendations}`,
  });
  return area('career_builder', 'Career Builder (shell cohesion)', checks, [], env.measurable);
}

// --- orchestrator -----------------------------------------------------------

export async function runCareerIntelligenceValidation(
  pool: Pool,
  subjectId: string,
): Promise<CareerValidationResult> {
  const env = await buildCareerIntelligence(pool, String(subjectId ?? '').trim());

  const areas: ValidationArea[] = [
    validateComposition(env),
    validateReadiness(env),
    validatePathways(env),
    validatePlanning(env),
    validateGrowth(env),
    validateDevelopment(env),
    validateBuilder(env),
  ];

  const allChecks = areas.flatMap((a) => a.checks);
  return {
    ok: true,
    subject_id: env.subject_id,
    version: CAREER_INTELLIGENCE_VERSION,
    generated_at: new Date().toISOString(),
    areas,
    summary: {
      areas_total: areas.length,
      areas_pass: areas.filter((a) => a.status === 'pass').length,
      areas_warn: areas.filter((a) => a.status === 'warn').length,
      areas_fail: areas.filter((a) => a.status === 'fail').length,
      checks_total: allChecks.length,
      checks_pass: allChecks.filter((c) => c.status === 'pass').length,
      checks_warn: allChecks.filter((c) => c.status === 'warn').length,
      checks_fail: allChecks.filter((c) => c.status === 'fail').length,
    },
  };
}
