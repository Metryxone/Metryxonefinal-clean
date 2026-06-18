/**
 * Competency Framework Intelligence — Phase 1 FOUNDATION (read-only).
 *
 * Treats the EXISTING competency framework as ONE master "spine" by COMPOSING
 * the two physically-disjoint namespaces that already store it:
 *
 *   - `onto_*`  — the curated 300-competency GENOME + Role DNA (TEXT ids,
 *                 served by services/competency-ontology.ts). This is the
 *                 declared CANONICAL competency library.
 *   - `ont_*`   — the operational / O*NET taxonomy, competency levels/anchors,
 *                 indicators, concerns, assessment questions (INTEGER ids).
 *                 These ATTACH to the canonical genome; they are not a second
 *                 competency master.
 *
 * Nothing here mutates competency content, creates schema, or fabricates rows.
 * Every count is read live; a missing table / failed read returns `null`
 * (reported honestly as "unknown"), never 0 and never invented. Coverage (does
 * data exist) and Confidence (is it trustworthy/curated) are reported as TWO
 * separate axes per the platform honesty contract.
 *
 * Phase 1 is FOUNDATION only — no downstream consumer is rewritten to read from
 * this service yet (that is Phase 2+, one consumer at a time).
 */

import type { Pool } from 'pg';
import { createOntologyService, ONTOLOGY_VERSION } from './competency-ontology.js';
import {
  resolveBestOntRole,
  getRoleCompetencies,
  normalize,
  type RoleMatch,
  type RoleCompetency,
} from './role-crosswalk.js';

export const COMPETENCY_INTELLIGENCE_VERSION = '1.0.0';

/** The declared canonical competency master (documented spine decision). */
export const CANONICAL_SPINE = {
  canonical_library: 'onto_competencies',
  canonical_namespace: 'onto_*',
  canonical_description:
    'The curated 300-competency genome + Role DNA is the canonical competency master.',
  attached_namespace: 'ont_*',
  attached_description:
    'The operational O*NET taxonomy, competency levels/anchors, indicators, concerns and assessment questions attach to the canonical genome; they are not a competing master.',
  unify_strategy:
    'Unified at the SERVICE + CROSSWALK layer only. The two table families are NOT physically merged.',
} as const;

// --------------------------------------------------------------------------
// Honest counting helpers — never throw, distinguish absent (null) from empty.
// --------------------------------------------------------------------------

/** COUNT(*) for a table; returns null on any error (missing table / read fault). */
async function safeCount(pool: Pool, table: string): Promise<number | null> {
  try {
    // table is from a fixed internal allow-list below — never user input.
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    return Number(rows[0]?.n ?? 0);
  } catch {
    return null;
  }
}

async function safeRows<T = any>(pool: Pool, sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    const { rows } = await pool.query(sql, params);
    return rows as T[];
  } catch {
    return [];
  }
}

/** Like safeRows but distinguishes a failed read (unknown) from an empty table. */
async function safeQuery<T = any>(
  pool: Pool,
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: T[]; read_status: 'ok' | 'unknown' }> {
  try {
    const { rows } = await pool.query(sql, params);
    return { rows: rows as T[], read_status: 'ok' };
  } catch {
    return { rows: [], read_status: 'unknown' };
  }
}

/** Wrap an ontology-service list call so a failed read is honestly distinguishable from empty. */
async function safeList<T = unknown>(fn: () => Promise<T[]>): Promise<{ records: T[]; read_status: 'ok' | 'unknown' }> {
  try {
    return { records: await fn(), read_status: 'ok' };
  } catch {
    return { records: [], read_status: 'unknown' };
  }
}

// --------------------------------------------------------------------------
// Master views — compose the canonical genome + attached operational data.
// --------------------------------------------------------------------------

export interface MasterCompetenciesResult {
  canonical_namespace: string;
  canonical_table: string;
  canonical_count: number | null;
  competencies: unknown[];
}

/**
 * The canonical competency library (the 300-genome), optionally filtered.
 * Reads through the existing onto ontology service — never re-derives content.
 */
export async function getMasterCompetencies(
  pool: Pool,
  params: { domainId?: string; familyId?: string; search?: string; limit?: number } = {},
): Promise<MasterCompetenciesResult> {
  const svc = createOntologyService(pool);
  let competencies: unknown[] = [];
  try {
    competencies = await svc.listCompetencies({
      domainId: params.domainId,
      familyId: params.familyId,
      search: params.search,
    });
  } catch {
    competencies = [];
  }
  const limit = params.limit && params.limit > 0 ? params.limit : undefined;
  return {
    canonical_namespace: 'onto_*',
    canonical_table: 'onto_competencies',
    canonical_count: await safeCount(pool, 'onto_competencies'),
    competencies: limit ? competencies.slice(0, limit) : competencies,
  };
}

export interface RoleRequirementsResult {
  query: string;
  resolved: boolean;
  match: RoleMatch | null;
  competencies: RoleCompetency[];
  source: string;
  note: string | null;
}

/**
 * A role's required competencies with weights + target levels, resolved through
 * the existing role-crosswalk (the consumable O*NET / ont role library). Honest
 * when nothing resolves (resolved:false, empty list) — never fabricates a role.
 */
export async function getRoleRequirements(pool: Pool, roleInput: string): Promise<RoleRequirementsResult> {
  const query = (roleInput ?? '').toString().trim();
  if (!query) {
    return { query, resolved: false, match: null, competencies: [], source: 'ont_role_library', note: 'empty_query' };
  }
  let match: RoleMatch | null = null;
  try {
    match = await resolveBestOntRole(pool, query);
  } catch {
    match = null;
  }
  if (!match) {
    return { query, resolved: false, match: null, competencies: [], source: 'ont_role_library', note: 'no_role_match' };
  }
  let competencies: RoleCompetency[] = [];
  try {
    competencies = await getRoleCompetencies(pool, match.code);
  } catch {
    competencies = [];
  }
  return {
    query,
    resolved: true,
    match,
    competencies,
    source: 'ont_role_library',
    note: competencies.length === 0 ? 'role_has_no_competency_ratings' : null,
  };
}

/**
 * Competency proficiency levels + level anchors + organizational layers,
 * composed across both namespaces with provenance.
 */
export async function getCompetencyLevels(pool: Pool) {
  const svc = createOntologyService(pool);
  const prof = await safeList(() => svc.listProficiencyLevels());
  const layers = await safeList(() => svc.listLayers());
  // Actual anchor RECORDS (not a count) so downstream systems can read the
  // observable behavioural anchors per competency × proficiency level.
  const anchors = await safeQuery(
    pool,
    `SELECT id, competency_code, competency_name, proficiency_level, level_number,
            score_band_min, score_band_max, behavioural_anchors, sample_evidence, learning_actions
       FROM ont_competency_level_anchors
      WHERE is_active = true
      ORDER BY competency_code, level_number`,
  );
  return {
    proficiency_levels: { namespace: 'onto_*', table: 'onto_proficiency_levels', read_status: prof.read_status, items: prof.records },
    organizational_layers: { namespace: 'onto_*', table: 'onto_layers', read_status: layers.read_status, items: layers.records },
    competency_level_anchors: {
      namespace: 'ont_*',
      table: 'ont_competency_level_anchors',
      read_status: anchors.read_status,
      count: anchors.read_status === 'ok' ? anchors.rows.length : null,
      anchors: anchors.rows,
    },
  };
}

export interface IndicatorsResult {
  namespace: 'ont_*';
  table: string;
  read_status: 'ok' | 'unknown';
  count: number | null;
  indicators: unknown[];
}

/**
 * Behavioural INDICATOR records (the observable signals that measure a
 * competency). Returns actual rows with provenance; absent/failed read →
 * empty + read_status:'unknown' (never fabricated), empty table → count 0.
 */
export async function getIndicators(pool: Pool): Promise<IndicatorsResult> {
  const q = await safeQuery(
    pool,
    `SELECT id, code, label, concern_bridge_tag, signal_type, polarity, weight, status
       FROM ont_indicators
      WHERE is_active = true
      ORDER BY code`,
  );
  return {
    namespace: 'ont_*',
    table: 'ont_indicators',
    read_status: q.read_status,
    count: q.read_status === 'ok' ? q.rows.length : null,
    indicators: q.rows,
  };
}

export interface TaxonomyTierResult {
  tier: string;
  // The canonical hierarchy RECORDS (onto_*), read through the ontology service.
  onto: { namespace: 'onto_*'; table: string; read_status: 'ok' | 'unknown'; count: number | null; records: unknown[] };
  // The attached operational namespace (ont_*), reported as coverage provenance.
  ont: { namespace: 'ont_*'; table: string; count: number | null };
}

/**
 * The Industry → Function → Department → Role-Family → Role taxonomy. Returns
 * the ACTUAL canonical (onto_*) hierarchical records per tier, with the attached
 * ont_* namespace reported alongside as coverage provenance. (`onto_*` calls the
 * Department tier "subfunction"; `ont_*` calls it "department" — the same tier
 * under two names.) Failed reads → empty + read_status:'unknown', never invented.
 */
export async function getTaxonomy(pool: Pool): Promise<{ tiers: TaxonomyTierResult[] }> {
  const svc = createOntologyService(pool);
  const industries = await safeList(() => svc.listIndustries());
  const functions = await safeList(() => svc.listFunctions());
  const subfunctions = await safeList(() => svc.listSubfunctions());
  const roleFamilies = await safeList(() => svc.listRoleFamilies());
  const roles = await safeList(() => svc.listRoles({}));

  const spec: { tier: string; ontoTable: string; ontTable: string; r: { records: unknown[]; read_status: 'ok' | 'unknown' } }[] = [
    { tier: 'industry', ontoTable: 'onto_industries', ontTable: 'ont_industries', r: industries },
    { tier: 'function', ontoTable: 'onto_functions', ontTable: 'ont_functions', r: functions },
    { tier: 'department', ontoTable: 'onto_subfunctions', ontTable: 'ont_departments', r: subfunctions },
    { tier: 'role_family', ontoTable: 'onto_role_families', ontTable: 'ont_role_families', r: roleFamilies },
    { tier: 'role', ontoTable: 'onto_roles', ontTable: 'ont_roles', r: roles },
  ];

  const out: TaxonomyTierResult[] = [];
  for (const t of spec) {
    out.push({
      tier: t.tier,
      onto: {
        namespace: 'onto_*',
        table: t.ontoTable,
        read_status: t.r.read_status,
        count: t.r.read_status === 'ok' ? t.r.records.length : null,
        records: t.r.records,
      },
      ont: { namespace: 'ont_*', table: t.ontTable, count: await safeCount(pool, t.ontTable) },
    });
  }
  return { tiers: out };
}

// --------------------------------------------------------------------------
// Framework readiness / gap report (Coverage vs Confidence as two axes).
// --------------------------------------------------------------------------

type AssetCategory =
  | 'competency_library'
  | 'taxonomy'
  | 'levels'
  | 'indicators'
  | 'assessment'
  | 'role_dna'
  | 'career_pathing'
  | 'benchmarks'
  | 'governance';

interface AssetSpec {
  key: string;
  label: string;
  namespace: 'onto_*' | 'ont_*' | 'shared';
  table: string;
  category: AssetCategory;
  /** Whether this asset is EXPECTED to be populated today (curated/seeded) or is a known gap pending a real import. */
  expectation: 'expected_populated' | 'known_gap_pending_import';
  /** Qualitative provenance / trust note — the Confidence axis, separate from Coverage (rowCount). */
  confidence: string;
}

const ASSET_SPECS: AssetSpec[] = [
  // Canonical genome (onto_*) — expected populated.
  { key: 'onto_competencies', label: 'Canonical competency genome (300-library)', namespace: 'onto_*', table: 'onto_competencies', category: 'competency_library', expectation: 'expected_populated', confidence: 'curated_seed' },
  { key: 'onto_domains', label: 'Competency domains', namespace: 'onto_*', table: 'onto_domains', category: 'competency_library', expectation: 'expected_populated', confidence: 'curated_seed' },
  { key: 'onto_families', label: 'Competency families', namespace: 'onto_*', table: 'onto_families', category: 'competency_library', expectation: 'expected_populated', confidence: 'curated_seed' },
  { key: 'onto_competency_types', label: 'Competency type master (5-type classification axis · Phase 1.1)', namespace: 'onto_*', table: 'onto_competency_types', category: 'competency_library', expectation: 'expected_populated', confidence: 'derived_classification (additive axis)' },
  { key: 'onto_competency_type_map', label: 'Competency → type mapping (Phase 1.1)', namespace: 'onto_*', table: 'onto_competency_type_map', category: 'competency_library', expectation: 'expected_populated', confidence: 'derived from scientific_type + technical family + lexicon (needs_review flagged)' },
  { key: 'onto_competency_master_ext', label: 'Competency master extension (status + 6 module-eligibility fields · Phase 1.2)', namespace: 'onto_*', table: 'onto_competency_master_ext', category: 'competency_library', expectation: 'expected_populated', confidence: 'status derived from deprecated; eligibility = curated/default governance toggles' },
  { key: 'onto_competency_hierarchy', label: 'Micro competency framework (parent-child structure · Phase 1.4)', namespace: 'onto_*', table: 'onto_competency_hierarchy', category: 'competency_library', expectation: 'expected_populated', confidence: 'linked children reuse existing competencies; named-only micros flagged (genome never mutated)' },
  { key: 'onto_proficiency_levels', label: 'Proficiency levels', namespace: 'onto_*', table: 'onto_proficiency_levels', category: 'levels', expectation: 'expected_populated', confidence: 'curated_seed' },
  { key: 'onto_layers', label: 'Organizational layers', namespace: 'onto_*', table: 'onto_layers', category: 'levels', expectation: 'expected_populated', confidence: 'curated_seed' },
  { key: 'onto_dna_profiles', label: 'Role DNA profiles', namespace: 'onto_*', table: 'onto_dna_profiles', category: 'role_dna', expectation: 'expected_populated', confidence: 'curated_seed' },
  { key: 'onto_role_weights', label: 'Role DNA competency weights', namespace: 'onto_*', table: 'onto_role_weights', category: 'role_dna', expectation: 'expected_populated', confidence: 'curated_seed (some O*NET-derived, flagged at source)' },
  { key: 'onto_industries', label: 'Taxonomy — industries', namespace: 'onto_*', table: 'onto_industries', category: 'taxonomy', expectation: 'expected_populated', confidence: 'curated_seed' },
  { key: 'onto_functions', label: 'Taxonomy — functions', namespace: 'onto_*', table: 'onto_functions', category: 'taxonomy', expectation: 'expected_populated', confidence: 'curated_seed' },
  { key: 'onto_subfunctions', label: 'Taxonomy — departments (subfunctions)', namespace: 'onto_*', table: 'onto_subfunctions', category: 'taxonomy', expectation: 'expected_populated', confidence: 'curated_seed' },
  { key: 'onto_role_families', label: 'Taxonomy — role families', namespace: 'onto_*', table: 'onto_role_families', category: 'taxonomy', expectation: 'expected_populated', confidence: 'curated_seed' },
  { key: 'onto_roles', label: 'Taxonomy — roles', namespace: 'onto_*', table: 'onto_roles', category: 'taxonomy', expectation: 'expected_populated', confidence: 'curated_seed' },

  // Operational attachment (ont_*) — taxonomy + levels expected; O*NET library variable.
  { key: 'ont_competencies', label: 'Operational competencies (O*NET-attached)', namespace: 'ont_*', table: 'ont_competencies', category: 'competency_library', expectation: 'expected_populated', confidence: 'onet_or_seed_derived' },
  { key: 'ont_competency_level_anchors', label: 'Competency level anchors', namespace: 'ont_*', table: 'ont_competency_level_anchors', category: 'levels', expectation: 'expected_populated', confidence: 'curated_seed' },
  { key: 'ont_indicators', label: 'Behavioural indicators', namespace: 'ont_*', table: 'ont_indicators', category: 'indicators', expectation: 'expected_populated', confidence: 'curated_seed' },
  { key: 'ont_concerns', label: 'Competency concerns', namespace: 'ont_*', table: 'ont_concerns', category: 'assessment', expectation: 'expected_populated', confidence: 'curated_seed' },
  { key: 'ont_assessment_questions', label: 'Ontology assessment questions', namespace: 'ont_*', table: 'ont_assessment_questions', category: 'assessment', expectation: 'expected_populated', confidence: 'curated_seed' },
  { key: 'ont_industries', label: 'Operational taxonomy — industries', namespace: 'ont_*', table: 'ont_industries', category: 'taxonomy', expectation: 'expected_populated', confidence: 'curated_seed' },
  { key: 'ont_roles', label: 'Operational taxonomy — roles', namespace: 'ont_*', table: 'ont_roles', category: 'taxonomy', expectation: 'expected_populated', confidence: 'onet_or_seed_derived' },

  // Assessment bank (shared, drives the live competency assessment).
  { key: 'competency_question_templates', label: 'Competency assessment question bank', namespace: 'shared', table: 'competency_question_templates', category: 'assessment', expectation: 'expected_populated', confidence: 'curated + generated drafts (status-gated)' },

  // KNOWN GAPS — pending a real import (never fabricated to look populated).
  { key: 'ont_career_tracks', label: 'Career tracks', namespace: 'ont_*', table: 'ont_career_tracks', category: 'career_pathing', expectation: 'known_gap_pending_import', confidence: 'empty_pending_real_source' },
  { key: 'ont_career_paths', label: 'Career paths', namespace: 'ont_*', table: 'ont_career_paths', category: 'career_pathing', expectation: 'known_gap_pending_import', confidence: 'empty_pending_real_source' },
  { key: 'ont_benchmarks', label: 'Benchmarks', namespace: 'ont_*', table: 'ont_benchmarks', category: 'benchmarks', expectation: 'known_gap_pending_import', confidence: 'empty_pending_real_source' },
  { key: 'ont_ai_rules', label: 'AI governance rules', namespace: 'ont_*', table: 'ont_ai_rules', category: 'governance', expectation: 'known_gap_pending_import', confidence: 'empty_pending_authoring' },
];

export interface AssetReadiness extends AssetSpec {
  coverage_rows: number | null;
  status: 'consumable' | 'empty_pending_import' | 'unknown';
}

export interface FrameworkReadinessResult {
  generated_at: string;
  spine: typeof CANONICAL_SPINE;
  summary: {
    total_assets: number;
    consumable: number;
    empty_pending_import: number;
    unknown: number;
  };
  assets: AssetReadiness[];
  crosswalk: CrosswalkResult;
}

function deriveStatus(rows: number | null): AssetReadiness['status'] {
  if (rows === null) return 'unknown';
  if (rows === 0) return 'empty_pending_import';
  return 'consumable';
}

export async function getFrameworkReadiness(pool: Pool): Promise<FrameworkReadinessResult> {
  const assets: AssetReadiness[] = [];
  for (const spec of ASSET_SPECS) {
    const coverage_rows = await safeCount(pool, spec.table);
    assets.push({ ...spec, coverage_rows, status: deriveStatus(coverage_rows) });
  }
  const summary = {
    total_assets: assets.length,
    consumable: assets.filter((a) => a.status === 'consumable').length,
    empty_pending_import: assets.filter((a) => a.status === 'empty_pending_import').length,
    unknown: assets.filter((a) => a.status === 'unknown').length,
  };
  const crosswalk = await buildCompetencyCrosswalk(pool);
  return {
    generated_at: new Date().toISOString(),
    spine: CANONICAL_SPINE,
    summary,
    assets,
    crosswalk,
  };
}

// --------------------------------------------------------------------------
// Crosswalk registry — map fragmented competency identifiers → canonical id.
// --------------------------------------------------------------------------

export interface CrosswalkEntry {
  source_space: string;
  source_id: string;
  source_label: string;
  canonical_id: string | null;
  canonical_label: string | null;
  match_type: 'identity' | 'name' | 'domain_name' | 'unmatched';
}

export interface CrosswalkIdSpace {
  space: string;
  description: string;
  // null = source read failed (honest "unknown"), never silently reported as 0.
  total: number | null;
  matched: number | null;
  unmatched: number | null;
  read_status: 'ok' | 'unknown';
  sample_unmatched: { source_id: string; source_label: string }[];
}

export interface ConsumerNamespace {
  consumer: string;
  identifier_space: string;
  status: 'crosswalk_pending_phase_2';
  note: string;
}

export interface CrosswalkResult {
  canonical_table: string;
  canonical_total: number | null;
  id_spaces: CrosswalkIdSpace[];
  consumer_namespaces: ConsumerNamespace[];
  entries: CrosswalkEntry[];
}

// The live competency-assessment 7-domain codes (mirror competency-questions.ts).
const ASSESSMENT_DOMAINS: { code: string; label: string }[] = [
  { code: 'COG', label: 'Cognitive & Analytical' },
  { code: 'COM', label: 'Communication' },
  { code: 'LEA', label: 'Leadership & Initiative' },
  { code: 'EXE', label: 'Execution & Delivery' },
  { code: 'ADP', label: 'Adaptability & Growth' },
  { code: 'TEC', label: 'Technical & Domain' },
  { code: 'EIQ', label: 'Emotional & Social Intelligence' },
];

// Future Readiness (FRP) FRI signal keys — defined in routes/frp.ts +
// frp_user_readiness columns (NOT the DB competency tables). Enumerated here so
// the crosswalk reports their canonical coverage instead of deferring them.
const FRP_FRI_SIGNALS: { id: string; label: string }[] = [
  { id: 'skill_durability', label: 'Skill Durability' },
  { id: 'market_alignment', label: 'Market Alignment' },
  { id: 'adaptability', label: 'Adaptability' },
  { id: 'learning_velocity', label: 'Learning Velocity' },
  { id: 'role_resilience', label: 'Role Resilience' },
];

// Employability Index (EI) 8-dimension scoring keys — defined in the frontend
// engine (lib/engines/employabilityEngine.ts EIBreakdown). Most are profile
// attributes (experience/education/etc.), NOT competencies, so most honestly do
// not map to a canonical competency — that absence is the finding, not a bug.
const EI_DIMENSIONS: { id: string; label: string }[] = [
  { id: 'assessmentScore', label: 'Assessment (validated competency)' },
  { id: 'experienceScore', label: 'Experience' },
  { id: 'educationScore', label: 'Education' },
  { id: 'technicalScore', label: 'Technical Skills' },
  { id: 'certScore', label: 'Certifications' },
  { id: 'softScore', label: 'Soft Skills' },
  { id: 'projectScore', label: 'Projects' },
  { id: 'completenessScore', label: 'Profile Completeness' },
];

/**
 * Token-overlap match between an assessment-domain label and a canonical onto
 * domain name. Honest: requires a real shared meaningful token, never forces a
 * match. Returns the best canonical domain or null.
 */
function matchDomainByName(
  label: string,
  domains: { id: string; name: string }[],
): { id: string; name: string } | null {
  const STOP = new Set(['and', 'the', 'of', 'a', 'an', '&']);
  const labelTokens = new Set(normalize(label).split(' ').filter((t) => t && !STOP.has(t)));
  let best: { id: string; name: string } | null = null;
  let bestScore = 0;
  for (const d of domains) {
    const domTokens = normalize(d.name).split(' ').filter((t) => t && !STOP.has(t));
    let shared = 0;
    for (const t of domTokens) if (labelTokens.has(t)) shared += 1;
    if (shared > bestScore) { bestScore = shared; best = { id: d.id, name: d.name }; }
  }
  return bestScore > 0 ? best : null;
}

/**
 * Match a code-defined identifier label to the canonical spine: first an exact
 * normalized competency-name hit, else a canonical domain by shared token.
 * Returns null (honest unmatched) when nothing maps — never forces a mapping.
 */
function matchCanonical(
  label: string,
  canonByNorm: Map<string, { id: string; name: string }>,
  domains: { id: string; name: string }[],
): { id: string; name: string; via: 'name' | 'domain_name' } | null {
  const exact = canonByNorm.get(normalize(label));
  if (exact) return { id: exact.id, name: exact.name, via: 'name' };
  const dom = matchDomainByName(label, domains);
  if (dom) return { id: dom.id, name: dom.name, via: 'domain_name' };
  return null;
}

/**
 * Build a crosswalk id-space from a STATIC list of code-defined source ids,
 * matching each to the canonical spine. Pushes per-id entries and returns the
 * id-space summary with honest matched/unmatched counts. When the canonical
 * reference reads failed entirely, reports read_status:'unknown' (counts null).
 */
function buildCodeIdSpace(
  space: string,
  description: string,
  items: { id: string; label: string }[],
  canonByNorm: Map<string, { id: string; name: string }>,
  domains: { id: string; name: string }[],
  refOk: boolean,
  entries: CrosswalkEntry[],
): CrosswalkIdSpace {
  let matched = 0;
  const unmatchedSamples: { source_id: string; source_label: string }[] = [];
  for (const it of items) {
    const hit = refOk ? matchCanonical(it.label, canonByNorm, domains) : null;
    if (hit) matched += 1;
    else if (unmatchedSamples.length < 10) unmatchedSamples.push({ source_id: it.id, source_label: it.label });
    entries.push({
      source_space: space,
      source_id: it.id,
      source_label: it.label,
      canonical_id: hit ? hit.id : null,
      canonical_label: hit ? hit.name : null,
      match_type: hit ? hit.via : 'unmatched',
    });
  }
  return {
    space,
    description,
    total: refOk ? items.length : null,
    matched: refOk ? matched : null,
    unmatched: refOk ? items.length - matched : null,
    read_status: refOk ? 'ok' : 'unknown',
    sample_unmatched: refOk ? unmatchedSamples : [],
  };
}

/**
 * Build the crosswalk registry from the fragmented competency identifiers that
 * already exist in the DB to the canonical `onto_competencies` id. Unmatched
 * ids are reported as honest gaps — no canonical id is invented. Consumer
 * systems whose identifiers live in CODE (EI 8-dim, FRP skill keys, etc.) are
 * declared as registered namespaces whose crosswalk is Phase 2 work — they are
 * NOT given fabricated mappings here.
 */
export async function buildCompetencyCrosswalk(pool: Pool): Promise<CrosswalkResult> {
  const svc = createOntologyService(pool);

  let canonical: any[] = [];
  let domains: { id: string; name: string }[] = [];
  let canonicalOk = true;
  let domainsOk = true;
  try { canonical = await svc.listCompetencies({}); } catch { canonical = []; canonicalOk = false; }
  try { domains = (await svc.listDomains()).map((d: any) => ({ id: d.id, name: d.name })); } catch { domains = []; domainsOk = false; }

  const canonByNorm = new Map<string, { id: string; name: string }>();
  for (const c of canonical) {
    const key = normalize(c.canonical_name ?? '');
    if (key && !canonByNorm.has(key)) canonByNorm.set(key, { id: c.id, name: c.canonical_name });
  }

  const entries: CrosswalkEntry[] = [];
  const idSpaces: CrosswalkIdSpace[] = [];

  // --- ID space 1: assessment 7-domain codes → canonical onto domain ---------
  {
    let matched = 0;
    const unmatchedSamples: { source_id: string; source_label: string }[] = [];
    for (const d of ASSESSMENT_DOMAINS) {
      const hit = matchDomainByName(d.label, domains);
      if (hit) matched += 1; else unmatchedSamples.push({ source_id: d.code, source_label: d.label });
      entries.push({
        source_space: 'assessment_domain_code',
        source_id: d.code,
        source_label: d.label,
        canonical_id: hit ? hit.id : null,
        canonical_label: hit ? hit.name : null,
        match_type: hit ? 'domain_name' : 'unmatched',
      });
    }
    idSpaces.push({
      space: 'assessment_domain_code',
      description: 'Live competency-assessment 7-domain codes (COG/COM/LEA/EXE/ADP/TEC/EIQ) → canonical onto domain.',
      // Match resolution depends on the canonical domains read; if it failed, report unknown not 0.
      total: domainsOk ? ASSESSMENT_DOMAINS.length : null,
      matched: domainsOk ? matched : null,
      unmatched: domainsOk ? ASSESSMENT_DOMAINS.length - matched : null,
      read_status: domainsOk ? 'ok' : 'unknown',
      sample_unmatched: domainsOk ? unmatchedSamples.slice(0, 10) : [],
    });
  }

  // --- ID space 2: canonical onto competencies → identity (the master) -------
  {
    idSpaces.push({
      space: 'onto_competency_id',
      description: 'Canonical onto_competencies — the master genome (identity mapping).',
      total: canonicalOk ? canonical.length : null,
      matched: canonicalOk ? canonical.length : null,
      unmatched: canonicalOk ? 0 : null,
      read_status: canonicalOk ? 'ok' : 'unknown',
      sample_unmatched: [],
    });
    // Identity entries are implicit (1:1); we do not duplicate all 300 rows in
    // `entries`, but the id space is reported as fully matched above.
  }

  // --- ID space 3: operational ont_competencies → canonical by name ----------
  {
    let ontOk = true;
    let ontComps: { id: number; code: string | null; name: string }[] = [];
    try {
      const { rows } = await pool.query(`SELECT id, code, name FROM ont_competencies`);
      ontComps = rows as { id: number; code: string | null; name: string }[];
    } catch { ontComps = []; ontOk = false; }
    let matched = 0;
    const unmatchedSamples: { source_id: string; source_label: string }[] = [];
    for (const oc of ontComps) {
      const hit = canonByNorm.get(normalize(oc.name ?? ''));
      if (hit) matched += 1; else if (unmatchedSamples.length < 10) unmatchedSamples.push({ source_id: String(oc.id), source_label: oc.name });
      entries.push({
        source_space: 'ont_competency_id',
        source_id: String(oc.id),
        source_label: oc.name,
        canonical_id: hit ? hit.id : null,
        canonical_label: hit ? hit.name : null,
        match_type: hit ? 'name' : 'unmatched',
      });
    }
    idSpaces.push({
      space: 'ont_competency_id',
      description: 'Operational ont_competencies (O*NET-attached) → canonical onto competency by normalized name.',
      total: ontOk ? ontComps.length : null,
      matched: ontOk ? matched : null,
      unmatched: ontOk ? ontComps.length - matched : null,
      read_status: ontOk ? 'ok' : 'unknown',
      sample_unmatched: ontOk ? unmatchedSamples : [],
    });
  }

  // --- ID space 4: FRP FRI signal keys (code-defined) → canonical ------------
  // Matching depends on the canonical reference reads (competencies + domains).
  const refOk = canonicalOk || domainsOk;
  idSpaces.push(
    buildCodeIdSpace(
      'frp_fri_signal',
      'Future Readiness FRI signal keys (skill_durability/market_alignment/adaptability/learning_velocity/role_resilience), defined in routes/frp.ts → canonical onto competency/domain by name.',
      FRP_FRI_SIGNALS,
      canonByNorm,
      domains,
      refOk,
      entries,
    ),
  );

  // --- ID space 5: EI 8-dimension scoring keys (code-defined) → canonical ----
  idSpaces.push(
    buildCodeIdSpace(
      'ei_dimension',
      'Employability Index 8-dimension scoring keys (frontend employabilityEngine EIBreakdown) → canonical onto competency/domain by name. Most dimensions are profile attributes, not competencies, so unmatched is expected and honest.',
      EI_DIMENSIONS,
      canonByNorm,
      domains,
      refOk,
      entries,
    ),
  );

  // --- Consumer namespaces (identifiers NOT a discrete enumerable id list) ----
  // These consume competency data through multi-source aggregation rather than a
  // fixed key set, so they are declared as Phase-2 consumer migrations (no
  // fabricated mapping). The enumerable code-defined spaces (EI, FRP) are above.
  const consumer_namespaces: ConsumerNamespace[] = [
    { consumer: 'Career Builder', identifier_space: 'useCareerBrain competency aggregation', status: 'crosswalk_pending_phase_2', note: 'Consumes multiple sources; canonical adoption is a Phase 2 consumer migration.' },
    { consumer: 'Career Passport', identifier_space: 'passport competency snapshot', status: 'crosswalk_pending_phase_2', note: 'Snapshot keys are derived per-platform; canonical adoption is Phase 2.' },
    { consumer: 'Employer / Talent Intelligence (TIG)', identifier_space: 'cra_scores / lbi_scores competency codes', status: 'crosswalk_pending_phase_2', note: 'Scores keyed on the assessment domain codes; bridged via the assessment_domain_code id space, full migration Phase 2.' },
    { consumer: 'Learning & Development (L&D)', identifier_space: 'lde-pipeline competency keys', status: 'crosswalk_pending_phase_2', note: 'Pipeline keys are derived in code; canonical adoption is Phase 2.' },
  ];

  return {
    canonical_table: 'onto_competencies',
    canonical_total: canonicalOk ? canonical.length : null,
    id_spaces: idSpaces,
    consumer_namespaces,
    entries,
  };
}
