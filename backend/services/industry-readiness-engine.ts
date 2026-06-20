/**
 * Phase 3.6 — Industry Readiness Engine (orchestrator).
 *
 * Extends the competency-anchored readiness framework from the ROLE level to the
 * INDUSTRY level for one subject:
 *
 *   - Industry Readiness — weighted attainment vs the industry's aggregated
 *                          competency demand.
 *   - Industry Fit       — fit classification (capped by critical gaps).
 *   - Industry Gap       — the gap areas + the single most material (top) gap.
 *
 * PURE COMPOSITION. Two honest inputs, neither fabricated:
 *
 *   1. Industry competency requirements are DERIVED by aggregating the EXISTING
 *      role competency profiles (onto_role_competency_profiles) across every role
 *      that belongs to the industry via the curated workforce taxonomy
 *      (onto_industries -> function -> subfunction -> role_family -> role):
 *        required_level = MAX required across the industry's roles (the bar);
 *        weight         = prevalence-weighted importance
 *                         = Sum(role weight for the competency) / total industry roles;
 *        criticality    = the highest criticality any role assigns it.
 *      The dedicated industry->competency weighting (map_industry_competency,
 *      O*NET) is the FUTURE authoritative source; it is not yet populated in this
 *      environment, so requirements are derived from role aggregation and the
 *      provenance is stamped honestly (`requirement_source`).
 *
 *   2. The subject's actual proficiency per competency is the SAME domain-proxy
 *      used by the role gap analysis: competency -> onto_domain -> the subject's
 *      measured domain level (onto_competency_profiles snapshot). Competencies
 *      whose domain was not measured are unassessed (Coverage gap), never a
 *      fabricated score.
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
import { assessIndustryFit, type IndustryFit } from './industry-fit-engine.js';
import { assessIndustryGaps, type IndustryGap } from './industry-gap-engine.js';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';

export const INDUSTRY_READINESS_ENGINE_VERSION = 'phase-3.6';

export interface IndustryReadiness {
  ok: boolean;
  subject_id: string;
  industry_id: string;
  industry_name: string | null;
  version: string;
  available: boolean;          // the industry exists AND has derivable requirements
  measurable: boolean;         // the subject has actual scores against those reqs
  requirement_source: 'role_aggregation' | 'none';
  role_count: number;          // roles in the industry contributing requirements
  competency_count: number;    // distinct competencies in the derived demand
  readiness: {
    measured: boolean;
    score: number | null;
    band: string | null;
    label: string | null;
    coverage_pct: number | null;
  };
  industry_fit: IndustryFit;
  industry_gap: IndustryGap;
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
// Derivation: aggregate role competency profiles across an industry's roles.
// ---------------------------------------------------------------------------

export interface IndustryRequirement {
  competency_id: string;
  competency_name: string | null;
  required_level: number;       // MAX across the industry's roles (1..5)
  weight: number;               // prevalence-weighted importance (NOT normalised)
  criticality: string;          // highest criticality any role assigns
  demanded_by_roles: number;    // how many of the industry's roles require it
}

export interface IndustryRequirementSet {
  industry_id: string;
  industry_name: string | null;
  role_count: number;
  requirements: IndustryRequirement[];
}

const CRIT_RANK: Record<string, number> = { critical: 0, important: 1, desirable: 2, optional: 3 };
function higherCriticality(a: string, b: string): string {
  return (CRIT_RANK[a] ?? 9) <= (CRIT_RANK[b] ?? 9) ? a : b;
}

/**
 * Derive an industry's aggregated competency demand from the role competency
 * profiles of every role that belongs to it. Returns null only when the
 * industry id does not exist; an existing industry with no role requirements
 * yields an empty requirements list (honest, not fabricated).
 */
export async function deriveIndustryRequirements(
  pool: Pool,
  industryId: string,
): Promise<IndustryRequirementSet | null> {
  const id = String(industryId ?? '').trim();
  if (!id) return null;

  const ind = await pool.query(
    `SELECT id, name FROM onto_industries WHERE id = $1 AND deprecated = FALSE`,
    [id],
  );
  if (ind.rowCount === 0) return null;
  const industryName: string | null = ind.rows[0].name ?? null;

  // Roles in the industry via the curated taxonomy, joined to their competency
  // requirements. LEFT JOIN so an industry with roles-but-no-profiles still
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
       JOIN onto_industries i     ON i.id  = f.industry_id
       LEFT JOIN onto_role_competency_profiles rcp
              ON rcp.role_id = r.id AND rcp.active = true
       LEFT JOIN onto_competencies c ON c.id = rcp.competency_id
      WHERE i.id = $1 AND r.deprecated = FALSE`,
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
  const requirements: IndustryRequirement[] = [];
  for (const [competency_id, g] of agg.entries()) {
    // Prevalence-weighted importance: total demanded weight spread over ALL
    // industry roles. A competency every role needs keeps its full weight; a
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

  return { industry_id: id, industry_name: industryName, role_count: roleCount, requirements };
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
  industryId: string,
  industryName: string | null,
  reqs: IndustryRequirement[],
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
    notes.push('This industry has no derivable competency requirements yet — no role in it defines a competency profile. Readiness is unmeasured (not assumed).');
  } else if (!measured) {
    notes.push('No actual proficiency scores cover this industry\u2019s competencies — showing the required demand only. Readiness is unmeasured (not assumed).');
  } else {
    notes.push(`Readiness ${score}% reflects weighted attainment across the ${Math.round(coverage ?? 0)}% of industry demand that has actual scores (Coverage and readiness are separate axes).`);
    if (coverage != null && coverage < 100) notes.push(`${Math.round(100 - coverage)}% of industry demand is unassessed — readiness is provisional until those competencies are scored.`);
    if (blocking > 0) notes.push(`${blocking} CRITICAL competenc${blocking === 1 ? 'y is' : 'ies are'} below the required level — these are blocking gaps regardless of the overall score.`);
  }

  return {
    role_id: industryId,
    role_title: industryName,
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
  industryId: string,
  industryName: string | null,
  eiProfile: EiProfile,
  requirementSource: IndustryReadiness['requirement_source'],
  roleCount: number,
  competencyCount: number,
  notes: string[],
): IndustryReadiness {
  return {
    ok: true,
    subject_id: subjectId,
    industry_id: industryId,
    industry_name: industryName,
    version: INDUSTRY_READINESS_ENGINE_VERSION,
    available: false,
    measurable: false,
    requirement_source: requirementSource,
    role_count: roleCount,
    competency_count: competencyCount,
    readiness: { measured: false, score: null, band: null, label: null, coverage_pct: null },
    industry_fit: assessIndustryFit(null),
    industry_gap: assessIndustryGaps(null),
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
 * Compute the industry readiness view for one subject against one industry.
 * Read-only composition; never throws.
 */
export async function computeIndustryReadiness(
  pool: Pool,
  subjectId: string,
  industryId: string,
): Promise<IndustryReadiness> {
  const sid = String(subjectId ?? '').trim();
  const iid = String(industryId ?? '').trim();

  // EI profile is best-effort context (confidence). buildEiProfile never throws.
  const eiProfile = await buildEiProfile(pool, sid);

  let reqSet: IndustryRequirementSet | null;
  try {
    reqSet = await deriveIndustryRequirements(pool, iid);
  } catch (err: any) {
    return unavailable(sid, iid, null, eiProfile, 'none', 0, 0, [
      `Industry requirements could not be derived: ${err?.message ?? 'unknown error'}.`,
    ]);
  }

  if (!reqSet) {
    return unavailable(sid, iid, null, eiProfile, 'none', 0, 0, [
      `Industry "${iid}" is not in the curated taxonomy — readiness is unavailable (not fabricated). Only seeded industries can be assessed.`,
    ]);
  }

  const reqs = reqSet.requirements;
  const provenanceNote =
    'Industry competency demand is DERIVED by aggregating role competency profiles across this industry\u2019s roles (max required level, prevalence-weighted importance). The dedicated industry\u2192competency weighting (map_industry_competency, O*NET) is not yet populated in this environment.';

  if (reqs.length === 0) {
    return unavailable(sid, iid, reqSet.industry_name, eiProfile, 'role_aggregation', reqSet.role_count, 0, [
      provenanceNote,
      `No role in "${reqSet.industry_name ?? iid}" defines a competency profile yet — industry readiness is unavailable (not assumed).`,
    ]);
  }

  // Subject actuals via domain-proxy (mirror computeGapAnalysis).
  const profile = await getProfile(pool, sid);
  const actuals: Record<string, number> = {};
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

  const readiness = buildReadiness(reqSet.industry_id, reqSet.industry_name, reqs, actuals);
  const industry_fit = assessIndustryFit(readiness);
  const industry_gap = assessIndustryGaps(readiness);

  const notes: string[] = [provenanceNote];
  if (!profile.measured) {
    notes.push('No scored profile for this subject yet — generate and score an assessment first. Industry readiness is unmeasured (not assumed).');
  }
  notes.push(...readiness.notes);
  notes.push('Measured levels are a domain-PROXY: a competency inherits its onto-domain score. Precision upgrades automatically when finer-grained scoring is populated.');
  if (industry_gap.top_gap) {
    notes.push(`Most material gap: ${industry_gap.top_gap.competency_name ?? industry_gap.top_gap.competency_id} (gap ${industry_gap.top_gap.gap}${industry_gap.top_gap.blocking ? ', critical/blocking' : ''}).`);
  }

  return {
    ok: true,
    subject_id: sid,
    industry_id: reqSet.industry_id,
    industry_name: reqSet.industry_name,
    version: INDUSTRY_READINESS_ENGINE_VERSION,
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
    industry_fit,
    industry_gap,
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
 * Compute industry readiness for a subject across EVERY seeded industry. Returns
 * one IndustryReadiness per industry in the curated taxonomy (data-driven — an
 * industry that is not seeded is simply absent, never a fabricated row).
 */
export async function listIndustryReadiness(pool: Pool, subjectId: string): Promise<{
  subject_id: string;
  version: string;
  industries: IndustryReadiness[];
  notes: string[];
  generated_at: string;
}> {
  const sid = String(subjectId ?? '').trim();
  let ids: string[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT id FROM onto_industries WHERE deprecated = FALSE ORDER BY display_order, name`,
    );
    ids = (rows as any[]).map((r) => r.id);
  } catch {
    ids = [];
  }

  const industries: IndustryReadiness[] = [];
  for (const id of ids) {
    industries.push(await computeIndustryReadiness(pool, sid, id));
  }

  const notes: string[] = [];
  if (ids.length === 0) {
    notes.push('No industries are seeded in the curated taxonomy — industry readiness is unavailable for every industry (not fabricated).');
  } else {
    notes.push(`Assessed against ${ids.length} seeded industr${ids.length === 1 ? 'y' : 'ies'}. Industries absent from the taxonomy (e.g. not yet seeded) are not listed — never invented.`);
  }

  return { subject_id: sid, version: INDUSTRY_READINESS_ENGINE_VERSION, industries, notes, generated_at: new Date().toISOString() };
}
