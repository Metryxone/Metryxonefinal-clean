/**
 * Phase 3.7 — Function Readiness Engine (orchestrator).
 *
 * Extends the competency-anchored readiness framework to the FUNCTION level for
 * one subject (e.g. Engineering, Product, Risk, HR, Finance, Sales, Operations):
 *
 *   - Function Readiness — weighted attainment vs the function's aggregated
 *                          competency demand.
 *   - Function Fit       — fit classification (capped by critical gaps).
 *   - Function Gap       — the gap areas + the single most material (top) gap.
 *
 * PURE COMPOSITION (mirror of the Phase 3.6 industry engine, one fewer taxonomy
 * hop). Two honest inputs, neither fabricated:
 *
 *   1. Function competency requirements are DERIVED by aggregating the EXISTING
 *      role competency profiles (onto_role_competency_profiles) across every role
 *      that belongs to the function via the curated workforce taxonomy
 *      (onto_functions -> subfunction -> role_family -> role):
 *        required_level = MAX required across the function's roles (the bar);
 *        weight         = prevalence-weighted importance
 *                         = Sum(role weight for the competency) / total function roles;
 *        criticality    = the highest criticality any role assigns it.
 *      There is no dedicated function->competency source in this environment, so
 *      requirements are derived from role aggregation and the provenance is
 *      stamped honestly (`requirement_source`).
 *
 *   2. The subject's actual proficiency per competency is the SAME domain-proxy
 *      used by the role/industry gap analysis: competency -> onto_domain -> the
 *      subject's measured domain level. Competencies whose domain was not
 *      measured are unassessed (Coverage gap), never a fabricated score.
 *
 * Never throws — degrades to an honest 'unavailable'/'unmeasured' result with a
 * reason. Coverage (assessed weight share) and the readiness score are reported
 * as SEPARATE axes. Developmental signal only.
 */

import type { Pool } from 'pg';
import {
  readinessBand,
  roleFit,
  type ReadinessResult,
  type ReadinessGap,
} from './role-competency-profile.js';
import { getProfile, MEASURABLE_ONTO_DOMAINS } from './competency-runtime.js';
import { buildEiProfile, type EiProfile } from './ei-profile-engine.js';
import { assessFunctionFit, type FunctionFit } from './function-fit-engine.js';
import { assessFunctionGaps, type FunctionGap } from './function-gap-engine.js';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';

export const FUNCTION_READINESS_ENGINE_VERSION = 'phase-3.7';

export interface FunctionReadiness {
  ok: boolean;
  subject_id: string;
  function_id: string;
  function_name: string | null;
  industry_id: string | null;
  version: string;
  available: boolean;          // the function exists AND has derivable requirements
  measurable: boolean;         // the subject has actual scores against those reqs
  requirement_source: 'role_aggregation' | 'none';
  role_count: number;          // roles in the function contributing requirements
  competency_count: number;    // distinct competencies in the derived demand
  readiness: {
    measured: boolean;
    score: number | null;
    band: string | null;
    label: string | null;
    coverage_pct: number | null;
  };
  function_fit: FunctionFit;
  function_gap: FunctionGap;
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

// ---------------------------------------------------------------------------
// Derivation: aggregate role competency profiles across a function's roles.
// ---------------------------------------------------------------------------

export interface FunctionRequirement {
  competency_id: string;
  competency_name: string | null;
  required_level: number;       // MAX across the function's roles (1..5)
  weight: number;               // prevalence-weighted importance (NOT normalised)
  criticality: string;          // highest criticality any role assigns
  demanded_by_roles: number;    // how many of the function's roles require it
}

export interface FunctionRequirementSet {
  function_id: string;
  function_name: string | null;
  industry_id: string | null;
  role_count: number;
  requirements: FunctionRequirement[];
}

const CRIT_RANK: Record<string, number> = { critical: 0, important: 1, desirable: 2, optional: 3 };
function higherCriticality(a: string, b: string): string {
  return (CRIT_RANK[a] ?? 9) <= (CRIT_RANK[b] ?? 9) ? a : b;
}

/**
 * Derive a function's aggregated competency demand from the role competency
 * profiles of every role that belongs to it. Returns null only when the
 * function id does not exist; an existing function with no role requirements
 * yields an empty requirements list (honest, not fabricated).
 */
export async function deriveFunctionRequirements(
  pool: Pool,
  functionId: string,
): Promise<FunctionRequirementSet | null> {
  const id = String(functionId ?? '').trim();
  if (!id) return null;

  const fn = await pool.query(
    `SELECT id, name, industry_id FROM onto_functions WHERE id = $1 AND deprecated = FALSE`,
    [id],
  );
  if (fn.rowCount === 0) return null;
  const functionName: string | null = fn.rows[0].name ?? null;
  const industryId: string | null = fn.rows[0].industry_id ?? null;

  // Roles in the function via the curated taxonomy, joined to their competency
  // requirements. LEFT JOIN so a function with roles-but-no-profiles still
  // reports its role_count honestly.
  const { rows } = await pool.query(
    `SELECT r.id AS role_id,
            rcp.competency_id,
            c.canonical_name AS competency_name,
            rcp.required_level,
            rcp.weight::float AS weight,
            rcp.criticality
       FROM onto_roles r
       JOIN onto_role_families rf ON rf.id = r.role_family_id
       JOIN onto_subfunctions sf  ON sf.id = rf.subfunction_id
       JOIN onto_functions f      ON f.id  = sf.function_id
       LEFT JOIN onto_role_competency_profiles rcp
              ON rcp.role_id = r.id AND rcp.active = true
       LEFT JOIN onto_competencies c ON c.id = rcp.competency_id
      WHERE f.id = $1 AND r.deprecated = FALSE`,
    [id],
  );

  const roleSet = new Set<string>();
  const agg = new Map<string, {
    competency_name: string | null;
    required_level: number;
    weight_sum: number;
    criticality: string;
    roles: Set<string>;
  }>();

  for (const row of rows as any[]) {
    roleSet.add(row.role_id);
    if (!row.competency_id) continue; // role with no active requirements
    const lvl = Number(row.required_level);
    const w = Number(row.weight) || 0;
    const crit = String(row.criticality ?? 'important');
    let g = agg.get(row.competency_id);
    if (!g) {
      g = { competency_name: row.competency_name ?? null, required_level: lvl, weight_sum: 0, criticality: crit, roles: new Set() };
      agg.set(row.competency_id, g);
    }
    g.required_level = Math.max(g.required_level, lvl);
    g.weight_sum += w;
    g.criticality = higherCriticality(g.criticality, crit);
    g.roles.add(row.role_id);
  }

  const roleCount = roleSet.size;
  const requirements: FunctionRequirement[] = [];
  for (const [competency_id, g] of agg.entries()) {
    // Prevalence-weighted importance: total demanded weight spread over ALL
    // function roles. A competency every role needs keeps its full weight; a
    // niche one is proportionally lighter. Never auto-normalised to 100.
    const weight = roleCount > 0 ? Math.round((g.weight_sum / roleCount) * 100) / 100 : 0;
    requirements.push({
      competency_id,
      competency_name: g.competency_name,
      required_level: g.required_level,
      weight,
      criticality: g.criticality,
      demanded_by_roles: g.roles.size,
    });
  }
  // Order: criticality first, then weight desc, then name.
  requirements.sort((a, b) =>
    (CRIT_RANK[a.criticality] ?? 9) - (CRIT_RANK[b.criticality] ?? 9) ||
    b.weight - a.weight ||
    (a.competency_name ?? '').localeCompare(b.competency_name ?? ''));

  return { function_id: id, function_name: functionName, industry_id: industryId, role_count: roleCount, requirements };
}

// ---------------------------------------------------------------------------
// Subject actuals (domain-proxy) — mirror computeGapAnalysis.
// ---------------------------------------------------------------------------

/** Map competency_id -> onto_domain for a set of competencies. */
async function competencyDomains(pool: Pool, competencyIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (competencyIds.length === 0) return out;
  const { rows } = await pool.query(
    `SELECT id, domain_id FROM onto_competencies WHERE id = ANY($1::text[])`,
    [competencyIds],
  );
  for (const r of rows as any[]) out.set(r.id, r.domain_id);
  return out;
}

// ---------------------------------------------------------------------------
// Readiness math over derived requirements — mirrors getRoleReadiness exactly.
// ---------------------------------------------------------------------------

function buildReadiness(
  functionId: string,
  functionName: string | null,
  reqs: FunctionRequirement[],
  actuals: Record<string, number>,
): ReadinessResult {
  const weightTotal = Math.round(reqs.reduce((s, c) => s + c.weight, 0) * 100) / 100;

  let weightAssessed = 0;
  let weightedAttainment = 0;
  let blocking = 0;
  const gaps: ReadinessGap[] = [];

  for (const c of reqs) {
    const rawActual = actuals[c.competency_id];
    const hasActual = Number.isFinite(rawActual);
    const actual = hasActual ? Math.max(0, Math.min(5, Number(rawActual))) : null;
    const attainment = actual != null && c.required_level > 0 ? Math.min(actual / c.required_level, 1) : null;
    const gap = actual != null ? c.required_level - actual : null;
    const isBlocking = c.criticality === 'critical' && gap != null && gap > 0;
    if (isBlocking) blocking += 1;
    if (attainment != null) {
      weightAssessed += c.weight;
      weightedAttainment += c.weight * attainment;
    }
    gaps.push({
      competency_id: c.competency_id,
      competency_name: c.competency_name,
      required_level: c.required_level,
      actual_level: actual,
      weight: c.weight,
      criticality: c.criticality,
      attainment: attainment != null ? Math.round(attainment * 1000) / 10 : null,
      gap,
      blocking: isBlocking,
    });
  }

  const measured = weightAssessed > 0;
  const score = measured ? Math.round((weightedAttainment / weightAssessed) * 1000) / 10 : null;
  const band = score != null ? readinessBand(score) : null;
  const coverage = weightTotal > 0 ? Math.round((weightAssessed / weightTotal) * 1000) / 10 : null;

  const notes: string[] = [];
  if (reqs.length === 0) {
    notes.push('This function has no derivable competency requirements yet — no role in it defines a competency profile. Readiness is unmeasured (not assumed).');
  } else if (!measured) {
    notes.push('No actual proficiency scores cover this function\u2019s competencies — showing the required demand only. Readiness is unmeasured (not assumed).');
  } else {
    notes.push(`Readiness ${score}% reflects weighted attainment across the ${Math.round(coverage ?? 0)}% of function demand that has actual scores (Coverage and readiness are separate axes).`);
    if (coverage != null && coverage < 100) notes.push(`${Math.round(100 - coverage)}% of function demand is unassessed — readiness is provisional until those competencies are scored.`);
    if (blocking > 0) notes.push(`${blocking} CRITICAL competenc${blocking === 1 ? 'y is' : 'ies are'} below the required level — these are blocking gaps regardless of the overall score.`);
  }

  return {
    role_id: functionId,
    role_title: functionName,
    measured,
    readiness_score: score,
    readiness_band: band?.band ?? null,
    readiness_label: band?.label ?? null,
    coverage_pct: coverage,
    weight_total: weightTotal,
    weight_assessed: Math.round(weightAssessed * 100) / 100,
    blocking_gaps: blocking,
    gaps,
    strengths: gaps.filter((g) => g.gap != null && g.gap <= 0).sort((a, b) => (a.gap ?? 0) - (b.gap ?? 0)),
    gap_areas: gaps.filter((g) => g.gap != null && g.gap > 0).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0)),
    critical_gaps: gaps.filter((g) => g.blocking),
    role_fit: roleFit(score, blocking),
    notes,
  };
}

// ---------------------------------------------------------------------------
// Orchestrator.
// ---------------------------------------------------------------------------

function unavailable(
  subjectId: string,
  functionId: string,
  functionName: string | null,
  industryId: string | null,
  eiProfile: EiProfile,
  requirementSource: FunctionReadiness['requirement_source'],
  roleCount: number,
  competencyCount: number,
  notes: string[],
): FunctionReadiness {
  return {
    ok: true,
    subject_id: subjectId,
    function_id: functionId,
    function_name: functionName,
    industry_id: industryId,
    version: FUNCTION_READINESS_ENGINE_VERSION,
    available: false,
    measurable: false,
    requirement_source: requirementSource,
    role_count: roleCount,
    competency_count: competencyCount,
    readiness: { measured: false, score: null, band: null, label: null, coverage_pct: null },
    function_fit: assessFunctionFit(null),
    function_gap: assessFunctionGaps(null),
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
 * Compute the function readiness view for one subject against one function.
 * Read-only composition; never throws.
 */
export async function computeFunctionReadiness(
  pool: Pool,
  subjectId: string,
  functionId: string,
): Promise<FunctionReadiness> {
  const sid = String(subjectId ?? '').trim();
  const fid = String(functionId ?? '').trim();

  // EI profile is best-effort context (confidence). buildEiProfile never throws.
  const eiProfile = await buildEiProfile(pool, sid);

  let reqSet: FunctionRequirementSet | null;
  try {
    reqSet = await deriveFunctionRequirements(pool, fid);
  } catch (err: any) {
    return unavailable(sid, fid, null, null, eiProfile, 'none', 0, 0, [
      `Function requirements could not be derived: ${err?.message ?? 'unknown error'}.`,
    ]);
  }

  if (!reqSet) {
    return unavailable(sid, fid, null, null, eiProfile, 'none', 0, 0, [
      `Function "${fid}" is not in the curated taxonomy — readiness is unavailable (not fabricated). Only seeded functions can be assessed.`,
    ]);
  }

  const reqs = reqSet.requirements;
  const provenanceNote =
    'Function competency demand is DERIVED by aggregating role competency profiles across this function\u2019s roles (max required level, prevalence-weighted importance). There is no dedicated function\u2192competency source in this environment.';

  if (reqs.length === 0) {
    return unavailable(sid, fid, reqSet.function_name, reqSet.industry_id, eiProfile, 'role_aggregation', reqSet.role_count, 0, [
      provenanceNote,
      `No role in "${reqSet.function_name ?? fid}" defines a competency profile yet — function readiness is unavailable (not assumed).`,
    ]);
  }

  // Subject actuals via domain-proxy (mirror computeGapAnalysis). Guarded so a
  // profile/domain lookup failure degrades to an honest unmeasured result rather
  // than throwing a 500 (never-throws contract).
  const actuals: Record<string, number> = {};
  let profileMeasured = false;
  try {
    const profile = await getProfile(pool, sid);
    profileMeasured = profile.measured;
    if (profile.measured) {
      const domLevel = new Map<string, number>();
      for (const d of profile.domain_scores) domLevel.set(d.onto_domain, d.level);
      const domByComp = await competencyDomains(pool, reqs.map((r) => r.competency_id));
      for (const r of reqs) {
        const dom = domByComp.get(r.competency_id) ?? null;
        if (dom && MEASURABLE_ONTO_DOMAINS.has(dom) && domLevel.has(dom)) {
          actuals[r.competency_id] = domLevel.get(dom) as number;
        }
      }
    }
  } catch (err: any) {
    return unavailable(sid, fid, reqSet.function_name, reqSet.industry_id, eiProfile, 'role_aggregation', reqSet.role_count, reqs.length, [
      provenanceNote,
      `Subject proficiency could not be resolved: ${err?.message ?? 'unknown error'}. Function readiness is unavailable (not assumed).`,
    ]);
  }
  const profile = { measured: profileMeasured };

  const readiness = buildReadiness(reqSet.function_id, reqSet.function_name, reqs, actuals);
  const function_fit = assessFunctionFit(readiness);
  const function_gap = assessFunctionGaps(readiness);

  const notes: string[] = [provenanceNote];
  if (!profile.measured) {
    notes.push('No scored profile for this subject yet — generate and score an assessment first. Function readiness is unmeasured (not assumed).');
  }
  notes.push(...readiness.notes);
  notes.push('Measured levels are a domain-PROXY: a competency inherits its onto-domain score. Precision upgrades automatically when finer-grained scoring is populated.');
  if (function_gap.top_gap) {
    notes.push(`Most material gap: ${function_gap.top_gap.competency_name ?? function_gap.top_gap.competency_id} (gap ${function_gap.top_gap.gap}${function_gap.top_gap.blocking ? ', critical/blocking' : ''}).`);
  }

  return {
    ok: true,
    subject_id: sid,
    function_id: reqSet.function_id,
    function_name: reqSet.function_name,
    industry_id: reqSet.industry_id,
    version: FUNCTION_READINESS_ENGINE_VERSION,
    available: true,
    measurable: readiness.measured,
    requirement_source: 'role_aggregation',
    role_count: reqSet.role_count,
    competency_count: reqs.length,
    readiness: {
      measured: readiness.measured,
      score: readiness.readiness_score,
      band: readiness.readiness_band,
      label: readiness.readiness_label,
      coverage_pct: readiness.coverage_pct,
    },
    function_fit,
    function_gap,
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
 * Compute function readiness for a subject across EVERY seeded function. Returns
 * one FunctionReadiness per function in the curated taxonomy (data-driven — a
 * function that is not seeded is simply absent, never a fabricated row).
 */
export async function listFunctionReadiness(pool: Pool, subjectId: string): Promise<{
  subject_id: string;
  version: string;
  functions: FunctionReadiness[];
  notes: string[];
  generated_at: string;
}> {
  const sid = String(subjectId ?? '').trim();
  let ids: string[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT id FROM onto_functions WHERE deprecated = FALSE ORDER BY display_order, name`,
    );
    ids = (rows as any[]).map((r) => r.id);
  } catch {
    ids = [];
  }

  const functions: FunctionReadiness[] = [];
  for (const id of ids) {
    try {
      functions.push(await computeFunctionReadiness(pool, sid, id));
    } catch (err: any) {
      // Isolate per-function failures so one bad function never fails the whole
      // list endpoint (never-throws contract).
      functions.push({
        ok: true,
        subject_id: sid,
        function_id: id,
        function_name: null,
        industry_id: null,
        version: FUNCTION_READINESS_ENGINE_VERSION,
        available: false,
        measurable: false,
        requirement_source: 'none',
        role_count: 0,
        competency_count: 0,
        readiness: { measured: false, score: null, band: null, label: null, coverage_pct: null },
        function_fit: assessFunctionFit(null),
        function_gap: assessFunctionGaps(null),
        ei_profile_summary: { measurable: false, ei_score: null, band: null, coverage_pct: 0, confidence: { band: 'low', score: 0, reasons: [] } as any },
        language_policy: LANGUAGE_POLICY,
        notes: [`Function "${id}" readiness could not be computed: ${err?.message ?? 'unknown error'}. Reported as unavailable (not fabricated).`],
        generated_at: new Date().toISOString(),
      });
    }
  }

  const notes: string[] = [];
  if (ids.length === 0) {
    notes.push('No functions are seeded in the curated taxonomy — function readiness is unavailable for every function (not fabricated).');
  } else {
    notes.push(`Assessed against ${ids.length} seeded function${ids.length === 1 ? '' : 's'}. Functions absent from the taxonomy (e.g. not yet seeded) are not listed — never invented.`);
  }

  return { subject_id: sid, version: FUNCTION_READINESS_ENGINE_VERSION, functions, notes, generated_at: new Date().toISOString() };
}
