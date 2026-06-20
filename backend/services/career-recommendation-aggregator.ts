/**
 * PHASE 4.7 — Career Recommendation Engine (aggregator).
 *
 * A pure, read-only, never-throws layer that COMPOSES the already-built Career
 * Development chain (Phase 4.6 → 4.5 roadmap → 4.4 gaps → 4.3 readiness) together
 * with the live Career-Graph role CATALOG (`cg_roles`) into SIX kinds of
 * recommendation, each driven by a config-as-data LIBRARY (what to say) and RULES
 * (when it fires + how it ranks):
 *
 *   1. role                 — specific next-target roles (market demand / growth).
 *   2. career               — career-direction guidance from the subject's own
 *                             measured readiness band + most-material dev stream.
 *   3. industry             — industries to consider (catalog industry_tags).
 *   4. function             — functions to consider (catalog function_area).
 *   5. future_role          — automation-resilient, high-growth roles, blended
 *                             with the chain's FRP future_outlook.
 *   6. alternative_career   — pivots into a DIFFERENT function than the anchor.
 *
 * Naming honesty — collision avoidance:
 *   The transformation spec names the deliverables `career_recommendation_engine`,
 *   `recommendation_library` and `recommendation_rules`. Those exact names ALREADY
 *   belong to two unrelated subsystems in this codebase:
 *     · `services/career-recommendation-engine.ts` — the Career-Graph (CGI) ranked
 *        next-role engine that WRITES `cg_user_recommendations`.
 *     · `services/recommendation-library.ts` / `recommendation-rules.ts` — the
 *        Phase-3.9 Employability code-defined catalogs.
 *   Overwriting either would break a live engine, so this Phase-4.7 deliverable is
 *   namespaced into the career-* 4.x chain: engine `career-recommendation-aggregator`,
 *   tables `career_recommendation_library` / `career_recommendation_rules` /
 *   `career_recommendation_history`. The spec's deliverable NAMES are honoured
 *   conceptually; the implementation is collision-free.
 *
 * Honesty contract (non-negotiable, carried from Phase 3/4):
 *   - COMPOSES the already-computed development/roadmap/gaps/readiness chain and
 *     reads `cg_roles` AS-STORED — it NEVER recomputes a competency/readiness score
 *     and NEVER fabricates a role, an industry, a function or a market number.
 *   - The engine RANKS and SELECTS catalog rows; ranking is a fully-disclosed,
 *     deterministic min-max blend over the candidate set (scale-free) weighted by
 *     the RULES — selection, never a fabricated "fit score".
 *   - Coverage and Confidence are TWO SEPARATE axes. Personalized recommendations
 *     (those that consume the subject's measured profile) INHERIT the chain's
 *     confidence band; market-catalog-only recommendations are explicitly
 *     'Provisional' (a market signal, not a personalized verdict) — never composited.
 *   - Read-only & never-throws: the GET/compose path reaches NO schema-creating
 *     DDL — it delegates the competency-runtime DDL-gating to the development chain
 *     and reads library/rules/history behind to_regclass probes; the ONLY write
 *     paths are the explicit POST snapshot and the admin library/rules CRUD.
 *   - Outputs are DEVELOPMENTAL / MARKET SIGNALS ONLY — never hiring/promotion/
 *     suitability predictions (the composed chain's language_policy is surfaced
 *     unchanged).
 *
 * Byte-identical flag-OFF is enforced by the route gate (503 before any call here).
 */

import type { Pool } from 'pg';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';
import type { GapTypeKey, CoverageConfidence, FutureOutlook } from './career-gap-engine.js';
import {
  CAREER_DEVELOPMENT_VERSION,
  buildCareerDevelopment,
  type CareerDevelopmentEnvelope,
} from './career-development-engine.js';
import { listRoles, type CgRole } from './career-graph-engine.js';

export const CAREER_RECOMMENDATION_VERSION = '4.7.0';

/** The six recommendation kinds this engine produces, in display order. */
export type RecommendationType =
  | 'role'
  | 'career'
  | 'industry'
  | 'function'
  | 'future_role'
  | 'alternative_career';

export const RECOMMENDATION_TYPE_ORDER: RecommendationType[] = [
  'role',
  'career',
  'industry',
  'function',
  'future_role',
  'alternative_career',
];

export const RECOMMENDATION_TYPE_LABELS: Record<RecommendationType, string> = {
  role: 'Role Recommendations',
  career: 'Career Recommendations',
  industry: 'Industry Recommendations',
  function: 'Function Recommendations',
  future_role: 'Future Role Recommendations',
  alternative_career: 'Alternative Career Recommendations',
};

/** How many items to surface per recommendation type (also a rule param default). */
export const DEFAULT_TOP_N = 5;

// ---------------------------------------------------------------------------
// Config-as-data: LIBRARY (copy templates) + RULES (firing + ranking weights).
// These inline DEFAULTS are the source of truth flag-ON with NO seed required.
// The matching DB tables (career_recommendation_library / _rules) are OPTIONAL
// admin-editable overrides — when present & non-empty they replace the defaults.
// Templates use {role}/{industry}/{function}/{band}/{stream} placeholders.
// ---------------------------------------------------------------------------

export interface RecommendationLibraryEntry {
  rec_key: string;
  rec_type: RecommendationType;
  title: string;
  description: string;
  action: string;
  is_active: boolean;
  sort_order: number;
}

export const DEFAULT_RECOMMENDATION_LIBRARY: RecommendationLibraryEntry[] = [
  {
    rec_key: 'role_market_demand',
    rec_type: 'role',
    title: 'Target role: {role}',
    description:
      'A strong current market signal (demand and growth) for {role} in the {function} function.',
    action: 'Explore the competency profile for {role} and compare it against your assessed strengths.',
    is_active: true,
    sort_order: 10,
  },
  {
    rec_key: 'career_advance_band',
    rec_type: 'career',
    title: 'Advance from a {band} readiness base',
    description:
      'Your present-state readiness is at the {band} band. Consolidating {stream} is the highest-leverage next move on your current track.',
    action: 'Focus development on {stream}, then re-assess to confirm progression.',
    is_active: true,
    sort_order: 10,
  },
  {
    rec_key: 'industry_market_demand',
    rec_type: 'industry',
    title: 'Consider the {industry} industry',
    description: 'The {industry} industry shows strong aggregate role demand and growth in the catalog.',
    action: 'Review roles tagged {industry} to see where your function transfers.',
    is_active: true,
    sort_order: 10,
  },
  {
    rec_key: 'function_market_demand',
    rec_type: 'function',
    title: 'Consider the {function} function',
    description: 'The {function} function shows strong aggregate demand and growth across catalog roles.',
    action: 'Compare the {function} function competency mix against your assessed profile.',
    is_active: true,
    sort_order: 10,
  },
  {
    rec_key: 'future_role_resilient',
    rec_type: 'future_role',
    title: 'Future-resilient role: {role}',
    description:
      '{role} combines high projected growth with lower automation exposure — a more future-resilient target.',
    action: 'Map the durable, AI-era capabilities {role} relies on and build toward them.',
    is_active: true,
    sort_order: 10,
  },
  {
    rec_key: 'alternative_pivot',
    rec_type: 'alternative_career',
    title: 'Alternative direction: {role}',
    description:
      '{role} sits in the {function} function — a different direction from your current track, with healthy market signal.',
    action: 'Assess which of your transferable strengths most apply to {role} before committing.',
    is_active: true,
    sort_order: 10,
  },
];

/** Which composed signal drives a type's firing + ranking. */
export type RuleSignal =
  | 'catalog_demand_growth'
  | 'readiness_band'
  | 'industry_demand_growth'
  | 'function_demand_growth'
  | 'future_resilience'
  | 'alternative_function';

export interface RecommendationRuleEntry {
  rule_key: string;
  rec_type: RecommendationType;
  signal: RuleSignal;
  /** Disclosed ranking weights / thresholds (scale-free min-max blend). */
  params: Record<string, number>;
  base_priority: 'high' | 'medium' | 'low';
  is_active: boolean;
}

export const DEFAULT_RECOMMENDATION_RULES: RecommendationRuleEntry[] = [
  {
    rule_key: 'rule_role_demand',
    rec_type: 'role',
    signal: 'catalog_demand_growth',
    params: { w_demand: 0.6, w_growth: 0.4, top_n: DEFAULT_TOP_N },
    base_priority: 'medium',
    is_active: true,
  },
  {
    rule_key: 'rule_career_band',
    rec_type: 'career',
    signal: 'readiness_band',
    params: { top_n: 1 },
    base_priority: 'medium',
    is_active: true,
  },
  {
    rule_key: 'rule_industry_demand',
    rec_type: 'industry',
    signal: 'industry_demand_growth',
    params: { w_demand: 0.6, w_growth: 0.4, min_roles: 2, top_n: DEFAULT_TOP_N },
    base_priority: 'low',
    is_active: true,
  },
  {
    rule_key: 'rule_function_demand',
    rec_type: 'function',
    signal: 'function_demand_growth',
    params: { w_demand: 0.6, w_growth: 0.4, min_roles: 2, top_n: DEFAULT_TOP_N },
    base_priority: 'low',
    is_active: true,
  },
  {
    rule_key: 'rule_future_resilience',
    rec_type: 'future_role',
    signal: 'future_resilience',
    params: { w_growth: 0.5, w_resilience: 0.5, top_n: DEFAULT_TOP_N },
    base_priority: 'medium',
    is_active: true,
  },
  {
    rule_key: 'rule_alternative_pivot',
    rec_type: 'alternative_career',
    signal: 'alternative_function',
    params: { w_demand: 0.6, w_growth: 0.4, top_n: DEFAULT_TOP_N },
    base_priority: 'low',
    is_active: true,
  },
];

// ---------------------------------------------------------------------------
// Envelope types
// ---------------------------------------------------------------------------

export type ConfidenceBand = 'High' | 'Moderate' | 'Provisional' | 'Low' | 'None';

export interface RecommendationItem {
  rec_type: RecommendationType;
  rec_key: string;
  rule_key: string;
  /** The concrete subject of the recommendation (role title / industry / function). */
  target: string;
  title: string;
  description: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  /** Disclosed, scale-free rank score over the candidate set (0..1). */
  rank_score: number;
  confidence_band: ConfidenceBand;
  /** Whether the item consumes the subject's measured profile (personalized) or
   *  is a market-catalog-only signal (Provisional). */
  personalized: boolean;
  /** The composed evidence used — never a fabricated number. */
  evidence: Record<string, unknown>;
  basis: string;
}

export interface RecommendationGroup {
  rec_type: RecommendationType;
  label: string;
  measurable: boolean;
  items: RecommendationItem[];
  item_count: number;
  note: string;
}

export interface CareerRecommendationEnvelope {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  measurable: boolean;
  anchor: {
    role_id: string | null;
    role_title: string | null;
    /** cg_roles match for the chain's anchor role (by title) — null if unmatched. */
    catalog_function: string | null;
    catalog_industries: string[];
    matched_in_catalog: boolean;
    readiness_band: string | null;
  };
  groups: RecommendationGroup[];
  summary: {
    total_recommendations: number;
    active_types: number;
    by_type: Record<RecommendationType, number>;
    personalized_count: number;
    market_only_count: number;
  };
  catalog: { roles_considered: number; source: string };
  config: { library_source: 'db' | 'defaults'; rules_source: 'db' | 'defaults' };
  future_outlook: FutureOutlook;
  axes: CoverageConfidence;
  language_policy: typeof LANGUAGE_POLICY;
  source_versions: Record<string, string>;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Min-max normalize a value within [min,max]; flat range => 0.5 (no false spread). */
function minMax(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (max <= min) return 0.5;
  return (value - min) / (max - min);
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k) => (k in vars ? vars[k] : `{${k}}`));
}

function libraryFor(
  library: RecommendationLibraryEntry[],
  type: RecommendationType,
): RecommendationLibraryEntry | null {
  return library.find((l) => l.rec_type === type && l.is_active) ?? null;
}

function rulesFor(
  rules: RecommendationRuleEntry[],
  type: RecommendationType,
): RecommendationRuleEntry | null {
  return rules.find((r) => r.rec_type === type && r.is_active) ?? null;
}

/** Match the chain's anchor role title to a cg_roles row (case-insensitive,
 *  exact-then-token-overlap). Returns the matched role or null — never fabricates. */
function matchAnchor(title: string | null, roles: CgRole[]): CgRole | null {
  if (!title) return null;
  const t = title.trim().toLowerCase();
  if (!t) return null;
  const exact = roles.find((r) => r.title.trim().toLowerCase() === t);
  if (exact) return exact;
  const tokens = new Set(t.split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  if (tokens.size === 0) return null;
  let best: CgRole | null = null;
  let bestOverlap = 0;
  for (const r of roles) {
    const rt = r.title.trim().toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const overlap = rt.filter((w) => tokens.has(w)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = r;
    }
  }
  return bestOverlap >= 1 ? best : null;
}

// ---------------------------------------------------------------------------
// Per-type generators (PURE — operate on the already-fetched catalog + chain).
// Each returns the SELECTED, ranked items; introduces NO new score, only a
// disclosed min-max rank over the candidate set.
// ---------------------------------------------------------------------------

function rankRoles(
  roles: CgRole[],
  weights: { w_demand: number; w_growth: number },
): Array<{ role: CgRole; score: number }> {
  if (roles.length === 0) return [];
  const demands = roles.map((r) => r.demand_score ?? 0);
  const growths = roles.map((r) => r.growth_30mo ?? 0);
  const dMin = Math.min(...demands), dMax = Math.max(...demands);
  const gMin = Math.min(...growths), gMax = Math.max(...growths);
  const wsum = weights.w_demand + weights.w_growth || 1;
  return roles
    .map((role) => {
      const d = minMax(role.demand_score ?? 0, dMin, dMax);
      const g = minMax(role.growth_30mo ?? 0, gMin, gMax);
      const score = (weights.w_demand * d + weights.w_growth * g) / wsum;
      return { role, score: round3(score) };
    })
    .sort((a, b) => b.score - a.score || a.role.title.localeCompare(b.role.title));
}

function generateRoleRecs(
  ctx: GenCtx,
  rule: RecommendationRuleEntry,
  lib: RecommendationLibraryEntry,
): RecommendationItem[] {
  // When the anchor is matched, prefer roles in the same function; else market-wide.
  const pool = ctx.anchorFunction
    ? ctx.roles.filter((r) => r.function_area === ctx.anchorFunction && r.title.toLowerCase() !== (ctx.anchorTitle ?? '').toLowerCase())
    : ctx.roles;
  const candidates = pool.length > 0 ? pool : ctx.roles;
  const ranked = rankRoles(candidates, {
    w_demand: rule.params.w_demand ?? 0.6,
    w_growth: rule.params.w_growth ?? 0.4,
  });
  const topN = Math.max(1, Math.round(rule.params.top_n ?? DEFAULT_TOP_N));
  const personalized = !!ctx.anchorFunction;
  return ranked.slice(0, topN).map(({ role, score }) => {
    const vars = { role: role.title, function: role.function_area };
    return {
      rec_type: 'role' as const,
      rec_key: lib.rec_key,
      rule_key: rule.rule_key,
      target: role.title,
      title: fill(lib.title, vars),
      description: fill(lib.description, vars),
      action: fill(lib.action, vars),
      priority: rule.base_priority,
      rank_score: score,
      confidence_band: personalized ? ctx.chainConfidence : 'Provisional',
      personalized,
      evidence: {
        role_key: role.role_key,
        function_area: role.function_area,
        demand_score: role.demand_score,
        growth_30mo: role.growth_30mo,
        same_function_as_anchor: personalized,
      },
      basis: personalized
        ? 'Ranked among roles in your anchor function by a disclosed demand/growth min-max blend (market signal aligned to your track).'
        : 'Ranked market-wide by a disclosed demand/growth min-max blend — a market signal, not personalized (no catalog-matched anchor).',
    };
  });
}

function generateCareerRecs(
  ctx: GenCtx,
  rule: RecommendationRuleEntry,
  lib: RecommendationLibraryEntry,
): RecommendationItem[] {
  // Career direction is PERSONALIZED: it consumes the subject's measured readiness
  // band + most-material development stream. If not measurable => honest empty.
  if (!ctx.dev.measurable || !ctx.readinessBand) return [];
  const stream = ctx.dev.summary.most_material_stream;
  const streamLabel = stream ? stream.label : 'your highest-priority development area';
  const vars = { band: ctx.readinessBand, stream: streamLabel };
  return [
    {
      rec_type: 'career',
      rec_key: lib.rec_key,
      rule_key: rule.rule_key,
      target: streamLabel,
      title: fill(lib.title, vars),
      description: fill(lib.description, vars),
      action: fill(lib.action, vars),
      priority: rule.base_priority,
      rank_score: 1,
      confidence_band: ctx.chainConfidence,
      personalized: true,
      evidence: {
        readiness_band: ctx.readinessBand,
        most_material_stream: stream ? stream.type_key : null,
        total_estimated_weeks: ctx.dev.summary.total_estimated_weeks,
      },
      basis: 'Derived from your measured present-state readiness band and the most-material development stream in your composed plan.',
    },
  ];
}

function rankGroups(
  groups: Map<string, { demand: number[]; growth: number[]; roles: number }>,
  weights: { w_demand: number; w_growth: number },
  minRoles: number,
): Array<{ key: string; score: number; roles: number; meanDemand: number; meanGrowth: number }> {
  const rows = [...groups.entries()]
    .filter(([, v]) => v.roles >= minRoles)
    .map(([key, v]) => ({
      key,
      meanDemand: v.demand.reduce((a, b) => a + b, 0) / (v.demand.length || 1),
      meanGrowth: v.growth.reduce((a, b) => a + b, 0) / (v.growth.length || 1),
      roles: v.roles,
    }));
  if (rows.length === 0) return [];
  const dMin = Math.min(...rows.map((r) => r.meanDemand)), dMax = Math.max(...rows.map((r) => r.meanDemand));
  const gMin = Math.min(...rows.map((r) => r.meanGrowth)), gMax = Math.max(...rows.map((r) => r.meanGrowth));
  const wsum = weights.w_demand + weights.w_growth || 1;
  return rows
    .map((r) => ({
      ...r,
      score: round3((weights.w_demand * minMax(r.meanDemand, dMin, dMax) + weights.w_growth * minMax(r.meanGrowth, gMin, gMax)) / wsum),
    }))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}

function generateIndustryRecs(
  ctx: GenCtx,
  rule: RecommendationRuleEntry,
  lib: RecommendationLibraryEntry,
): RecommendationItem[] {
  const groups = new Map<string, { demand: number[]; growth: number[]; roles: number }>();
  for (const r of ctx.roles) {
    for (const ind of r.industry_tags ?? []) {
      const g = groups.get(ind) ?? { demand: [], growth: [], roles: 0 };
      g.demand.push(r.demand_score ?? 0);
      g.growth.push(r.growth_30mo ?? 0);
      g.roles += 1;
      groups.set(ind, g);
    }
  }
  const ranked = rankGroups(groups, { w_demand: rule.params.w_demand ?? 0.6, w_growth: rule.params.w_growth ?? 0.4 }, Math.max(1, Math.round(rule.params.min_roles ?? 2)));
  const topN = Math.max(1, Math.round(rule.params.top_n ?? DEFAULT_TOP_N));
  return ranked.slice(0, topN).map((row) => {
    const vars = { industry: row.key };
    return {
      rec_type: 'industry' as const,
      rec_key: lib.rec_key,
      rule_key: rule.rule_key,
      target: row.key,
      title: fill(lib.title, vars),
      description: fill(lib.description, vars),
      action: fill(lib.action, vars),
      priority: rule.base_priority,
      rank_score: row.score,
      confidence_band: 'Provisional',
      personalized: false,
      evidence: { roles_in_industry: row.roles, mean_demand: round3(row.meanDemand), mean_growth: round3(row.meanGrowth) },
      basis: 'Industries ranked by mean catalog demand/growth across their roles (a market signal, not personalized).',
    };
  });
}

function generateFunctionRecs(
  ctx: GenCtx,
  rule: RecommendationRuleEntry,
  lib: RecommendationLibraryEntry,
): RecommendationItem[] {
  const groups = new Map<string, { demand: number[]; growth: number[]; roles: number }>();
  for (const r of ctx.roles) {
    const g = groups.get(r.function_area) ?? { demand: [], growth: [], roles: 0 };
    g.demand.push(r.demand_score ?? 0);
    g.growth.push(r.growth_30mo ?? 0);
    g.roles += 1;
    groups.set(r.function_area, g);
  }
  const ranked = rankGroups(groups, { w_demand: rule.params.w_demand ?? 0.6, w_growth: rule.params.w_growth ?? 0.4 }, Math.max(1, Math.round(rule.params.min_roles ?? 2)));
  const topN = Math.max(1, Math.round(rule.params.top_n ?? DEFAULT_TOP_N));
  return ranked.slice(0, topN).map((row) => {
    const vars = { function: row.key };
    return {
      rec_type: 'function' as const,
      rec_key: lib.rec_key,
      rule_key: rule.rule_key,
      target: row.key,
      title: fill(lib.title, vars),
      description: fill(lib.description, vars),
      action: fill(lib.action, vars),
      priority: rule.base_priority,
      rank_score: row.score,
      confidence_band: 'Provisional',
      personalized: false,
      evidence: { roles_in_function: row.roles, mean_demand: round3(row.meanDemand), mean_growth: round3(row.meanGrowth) },
      basis: 'Functions ranked by mean catalog demand/growth across their roles (a market signal, not personalized).',
    };
  });
}

function generateFutureRoleRecs(
  ctx: GenCtx,
  rule: RecommendationRuleEntry,
  lib: RecommendationLibraryEntry,
): RecommendationItem[] {
  if (ctx.roles.length === 0) return [];
  const growths = ctx.roles.map((r) => r.growth_30mo ?? 0);
  const risks = ctx.roles.map((r) => r.automation_risk ?? 0);
  const gMin = Math.min(...growths), gMax = Math.max(...growths);
  const rMin = Math.min(...risks), rMax = Math.max(...risks);
  const wG = rule.params.w_growth ?? 0.5;
  const wR = rule.params.w_resilience ?? 0.5;
  const wsum = wG + wR || 1;
  // future_outlook (FRP) is a chain signal; when measured it lifts confidence.
  const friMeasured = ctx.dev.future_outlook?.measurable === true;
  const ranked = ctx.roles
    .map((role) => {
      const g = minMax(role.growth_30mo ?? 0, gMin, gMax);
      const resilience = 1 - minMax(role.automation_risk ?? 0, rMin, rMax); // lower risk => higher
      return { role, score: round3((wG * g + wR * resilience) / wsum), resilience: round3(resilience) };
    })
    .sort((a, b) => b.score - a.score || a.role.title.localeCompare(b.role.title));
  const topN = Math.max(1, Math.round(rule.params.top_n ?? DEFAULT_TOP_N));
  return ranked.slice(0, topN).map(({ role, score, resilience }) => {
    const vars = { role: role.title, function: role.function_area };
    return {
      rec_type: 'future_role' as const,
      rec_key: lib.rec_key,
      rule_key: rule.rule_key,
      target: role.title,
      title: fill(lib.title, vars),
      description: fill(lib.description, vars),
      action: fill(lib.action, vars),
      priority: rule.base_priority,
      rank_score: score,
      // Market-only: the ranking is a catalog-wide growth/resilience blend identical
      // for every subject — it does NOT consume the subject's FRP outlook, so it is
      // never personalized and never inherits chain confidence (avoid over-claiming).
      // friMeasured is disclosed as context only.
      confidence_band: 'Provisional',
      personalized: false,
      evidence: {
        role_key: role.role_key,
        growth_30mo: role.growth_30mo,
        automation_risk: role.automation_risk,
        resilience_rank: resilience,
        frp_future_outlook_measured: friMeasured,
      },
      basis: friMeasured
        ? 'Future-resilient roles (growth + low automation exposure) ranked by a disclosed catalog min-max blend — a market signal, not personalized; your measured FRP future-outlook is noted as context but does not tailor this ranking.'
        : 'Future-resilient roles ranked by a disclosed growth/automation-resilience min-max blend over the catalog — a market signal, not personalized (your FRP future-outlook is unmeasured).',
    };
  });
}

function generateAlternativeRecs(
  ctx: GenCtx,
  rule: RecommendationRuleEntry,
  lib: RecommendationLibraryEntry,
): RecommendationItem[] {
  // Pivots = roles in a DIFFERENT function than the anchor. Needs a matched anchor
  // function to be meaningful; otherwise honest empty (can't define "alternative").
  if (!ctx.anchorFunction) return [];
  const pool = ctx.roles.filter((r) => r.function_area !== ctx.anchorFunction);
  if (pool.length === 0) return [];
  const ranked = rankRoles(pool, { w_demand: rule.params.w_demand ?? 0.6, w_growth: rule.params.w_growth ?? 0.4 });
  const topN = Math.max(1, Math.round(rule.params.top_n ?? DEFAULT_TOP_N));
  return ranked.slice(0, topN).map(({ role, score }) => {
    const vars = { role: role.title, function: role.function_area };
    return {
      rec_type: 'alternative_career' as const,
      rec_key: lib.rec_key,
      rule_key: rule.rule_key,
      target: role.title,
      title: fill(lib.title, vars),
      description: fill(lib.description, vars),
      action: fill(lib.action, vars),
      priority: rule.base_priority,
      rank_score: score,
      confidence_band: 'Provisional',
      personalized: false,
      evidence: { role_key: role.role_key, function_area: role.function_area, anchor_function: ctx.anchorFunction, demand_score: role.demand_score, growth_30mo: role.growth_30mo },
      basis: 'Roles in a different function than your anchor, ranked by a disclosed demand/growth min-max blend — a directional market signal; transferability is not asserted.',
    };
  });
}

interface GenCtx {
  roles: CgRole[];
  dev: CareerDevelopmentEnvelope;
  anchorFunction: string | null;
  anchorTitle: string | null;
  readinessBand: string | null;
  chainConfidence: ConfidenceBand;
}

const GENERATORS: Record<
  RecommendationType,
  (ctx: GenCtx, rule: RecommendationRuleEntry, lib: RecommendationLibraryEntry) => RecommendationItem[]
> = {
  role: generateRoleRecs,
  career: generateCareerRecs,
  industry: generateIndustryRecs,
  function: generateFunctionRecs,
  future_role: generateFutureRoleRecs,
  alternative_career: generateAlternativeRecs,
};

function noteFor(type: RecommendationType, items: RecommendationItem[], hasCatalog: boolean): string {
  if (items.length > 0) return `${items.length} ${RECOMMENDATION_TYPE_LABELS[type].toLowerCase()} surfaced.`;
  switch (type) {
    case 'career':
      return 'No career recommendation — present-state readiness is not measurable (honest empty, never fabricated).';
    case 'alternative_career':
      return 'No alternative-career recommendation — the anchor role is not matched in the catalog, so "alternative" cannot be defined (honest empty).';
    default:
      return hasCatalog
        ? 'No recommendation surfaced under the active rule.'
        : 'No catalog roles available — recommendation honestly empty (never fabricated).';
  }
}

function bandToConfidence(band: string | null, measurable: boolean): ConfidenceBand {
  if (!measurable || !band) return 'None';
  const b = band.toLowerCase();
  if (b.includes('high') || b.includes('strong')) return 'High';
  if (b.includes('moder') || b.includes('good') || b.includes('developing')) return 'Moderate';
  if (b.includes('low') || b.includes('emerging') || b.includes('partial')) return 'Low';
  return 'Moderate';
}

// ---------------------------------------------------------------------------
// career_recommendation_engine — compose the 4.6 chain + cg_roles catalog into
// the six recommendation groups for one subject. PURE compose, never-throws.
// ---------------------------------------------------------------------------

export async function buildCareerRecommendations(
  pool: Pool,
  subjectId: string,
): Promise<CareerRecommendationEnvelope> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];

  // Compose the 4.6 development chain (never-throws; self-gates competency-runtime
  // DDL and reads readiness behind its own probe — this layer reaches NO DDL).
  const dev = await buildCareerDevelopment(pool, sid).catch((e) => {
    notes.push(`Career development composition unavailable: ${e?.message ?? 'error'} (honest empty).`);
    return null as CareerDevelopmentEnvelope | null;
  });

  // Read the live role catalog (read-only SELECT; listRoles is itself never-throws).
  const catalog = await listRoles(pool, { limit: 200 }).catch(() => ({ roles: [] as CgRole[], total: 0 }));
  const roles = catalog.roles;

  // Read OPTIONAL admin-edited config; fall back to inline defaults (no DDL on read).
  const libCfg = await loadLibrary(pool);
  const ruleCfg = await loadRules(pool);

  if (!dev) {
    return emptyEnvelope(sid, roles.length, libCfg.source, ruleCfg.source, notes);
  }

  const anchorTitle = dev.target_role?.role_title ?? null;
  const anchorMatch = matchAnchor(anchorTitle, roles);
  const readinessBand = dev.progression?.current?.band ?? null;
  const chainConfidence = bandToConfidence(
    dev.axes?.confidence?.band ?? null,
    dev.axes?.confidence?.band != null && dev.axes.confidence.band !== 'None',
  );

  const ctx: GenCtx = {
    roles,
    dev,
    anchorFunction: anchorMatch?.function_area ?? null,
    anchorTitle,
    readinessBand,
    chainConfidence,
  };

  const groups: RecommendationGroup[] = RECOMMENDATION_TYPE_ORDER.map((type) => {
    const lib = libraryFor(libCfg.library, type);
    const rule = rulesFor(ruleCfg.rules, type);
    const items = lib && rule ? GENERATORS[type](ctx, rule, lib) : [];
    return {
      rec_type: type,
      label: RECOMMENDATION_TYPE_LABELS[type],
      measurable: items.length > 0,
      items,
      item_count: items.length,
      note: !lib || !rule
        ? 'No active library entry or rule for this type — recommendation withheld.'
        : noteFor(type, items, roles.length > 0),
    };
  });

  const all = groups.flatMap((g) => g.items);
  const byType = Object.fromEntries(
    RECOMMENDATION_TYPE_ORDER.map((t) => [t, groups.find((g) => g.rec_type === t)?.item_count ?? 0]),
  ) as Record<RecommendationType, number>;
  const personalizedCount = all.filter((i) => i.personalized).length;

  if (roles.length === 0) {
    notes.push('Role catalog (cg_roles) is empty — catalog-derived recommendations are honestly empty.');
  }
  if (!dev.measurable) {
    notes.push('Development chain not measurable for this subject — personalized recommendations limited to market signals.');
  }
  if (anchorTitle && !anchorMatch) {
    notes.push(`Anchor role "${anchorTitle}" did not match any catalog role by title — role/alternative recommendations degrade to market-wide (Provisional).`);
  }

  return {
    ok: true,
    subject_id: sid,
    version: CAREER_RECOMMENDATION_VERSION,
    generated_at: new Date().toISOString(),
    measurable: all.length > 0,
    anchor: {
      role_id: dev.target_role?.role_id ?? null,
      role_title: anchorTitle,
      catalog_function: anchorMatch?.function_area ?? null,
      catalog_industries: anchorMatch?.industry_tags ?? [],
      matched_in_catalog: !!anchorMatch,
      readiness_band: readinessBand,
    },
    groups,
    summary: {
      total_recommendations: all.length,
      active_types: groups.filter((g) => g.item_count > 0).length,
      by_type: byType,
      personalized_count: personalizedCount,
      market_only_count: all.length - personalizedCount,
    },
    catalog: { roles_considered: roles.length, source: 'cg_roles (read-only)' },
    config: { library_source: libCfg.source, rules_source: ruleCfg.source },
    future_outlook: dev.future_outlook,
    axes: dev.axes,
    language_policy: dev.language_policy ?? LANGUAGE_POLICY,
    source_versions: {
      career_recommendation: CAREER_RECOMMENDATION_VERSION,
      career_development: CAREER_DEVELOPMENT_VERSION,
      ...dev.source_versions,
    },
    notes: [...notes, ...dev.notes],
  };
}

// --- honest-empty envelope (pure) ------------------------------------------

function emptyEnvelope(
  sid: string,
  rolesConsidered: number,
  libSource: 'db' | 'defaults',
  rulesSource: 'db' | 'defaults',
  notes: string[],
): CareerRecommendationEnvelope {
  const groups: RecommendationGroup[] = RECOMMENDATION_TYPE_ORDER.map((type) => ({
    rec_type: type,
    label: RECOMMENDATION_TYPE_LABELS[type],
    measurable: false,
    items: [],
    item_count: 0,
    note: 'No career development composition — recommendation honestly empty.',
  }));
  return {
    ok: true,
    subject_id: sid,
    version: CAREER_RECOMMENDATION_VERSION,
    generated_at: new Date().toISOString(),
    measurable: false,
    anchor: {
      role_id: null,
      role_title: null,
      catalog_function: null,
      catalog_industries: [],
      matched_in_catalog: false,
      readiness_band: null,
    },
    groups,
    summary: {
      total_recommendations: 0,
      active_types: 0,
      by_type: Object.fromEntries(RECOMMENDATION_TYPE_ORDER.map((t) => [t, 0])) as Record<RecommendationType, number>,
      personalized_count: 0,
      market_only_count: 0,
    },
    catalog: { roles_considered: rolesConsidered, source: 'cg_roles (read-only)' },
    config: { library_source: libSource, rules_source: rulesSource },
    future_outlook: {
      measurable: false,
      composite: null,
      band: null,
      axes: null,
      development_areas: [],
      real_signal_count: 0,
      basis: 'no career recommendation composition',
    },
    axes: {
      coverage: { measurable: false, classified_pct: null, detail: 'no measurable career recommendation' },
      confidence: { band: 'None', value: null, basis: 'not measurable', caps: ['not_measurable'] },
    },
    language_policy: LANGUAGE_POLICY,
    source_versions: { career_recommendation: CAREER_RECOMMENDATION_VERSION },
    notes,
  };
}

// ---------------------------------------------------------------------------
// Config-as-data tables (library + rules) — admin-editable overrides of the
// inline defaults. The ensure-schema DDL is reached ONLY behind the
// careerRecommendation flag gate (admin CRUD / seed / snapshot POST paths).
// Read paths use to_regclass probes so a GET NEVER triggers DDL.
// ---------------------------------------------------------------------------

export async function ensureCareerRecommendationSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_recommendation_library (
      id          BIGSERIAL PRIMARY KEY,
      rec_key     TEXT NOT NULL UNIQUE,
      rec_type    TEXT NOT NULL,
      title       TEXT NOT NULL,
      description TEXT NOT NULL,
      action      TEXT NOT NULL DEFAULT '',
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_recommendation_rules (
      id            BIGSERIAL PRIMARY KEY,
      rule_key      TEXT NOT NULL UNIQUE,
      rec_type      TEXT NOT NULL,
      signal        TEXT NOT NULL,
      params        JSONB NOT NULL DEFAULT '{}'::jsonb,
      base_priority TEXT NOT NULL DEFAULT 'medium',
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_recommendation_history (
      id                    BIGSERIAL PRIMARY KEY,
      subject_id            TEXT NOT NULL,
      role_id               TEXT,
      role_title            TEXT,
      measurable            BOOLEAN NOT NULL DEFAULT FALSE,
      total_recommendations INTEGER NOT NULL DEFAULT 0,
      by_type               JSONB NOT NULL DEFAULT '{}'::jsonb,
      snapshot              JSONB NOT NULL,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_career_recommendation_history_subject
       ON career_recommendation_history (subject_id, created_at DESC)`,
  );
}

/** Read library overrides if the table exists AND has active rows; else defaults. */
export async function loadLibrary(
  pool: Pool,
): Promise<{ source: 'db' | 'defaults'; library: RecommendationLibraryEntry[] }> {
  const probe = await pool
    .query(`SELECT to_regclass('public.career_recommendation_library') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { source: 'defaults', library: DEFAULT_RECOMMENDATION_LIBRARY };
  const r = await pool
    .query(
      `SELECT rec_key, rec_type, title, description, action, is_active, sort_order
       FROM career_recommendation_library WHERE is_active = TRUE ORDER BY rec_type, sort_order, rec_key`,
    )
    .catch(() => ({ rows: [] as RecommendationLibraryEntry[] }));
  if (r.rows.length === 0) return { source: 'defaults', library: DEFAULT_RECOMMENDATION_LIBRARY };
  return { source: 'db', library: r.rows as RecommendationLibraryEntry[] };
}

/** Read rule overrides if the table exists AND has active rows; else defaults. */
export async function loadRules(
  pool: Pool,
): Promise<{ source: 'db' | 'defaults'; rules: RecommendationRuleEntry[] }> {
  const probe = await pool
    .query(`SELECT to_regclass('public.career_recommendation_rules') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { source: 'defaults', rules: DEFAULT_RECOMMENDATION_RULES };
  const r = await pool
    .query(
      `SELECT rule_key, rec_type, signal, params, base_priority, is_active
       FROM career_recommendation_rules WHERE is_active = TRUE ORDER BY rec_type, rule_key`,
    )
    .catch(() => ({ rows: [] as RecommendationRuleEntry[] }));
  if (r.rows.length === 0) return { source: 'defaults', rules: DEFAULT_RECOMMENDATION_RULES };
  return { source: 'db', rules: r.rows as RecommendationRuleEntry[] };
}

/** Idempotent seed of the inline defaults into the editable tables (admin POST). */
export async function seedCareerRecommendationConfig(
  pool: Pool,
): Promise<{ library: number; rules: number }> {
  await ensureCareerRecommendationSchema(pool);
  let lib = 0;
  for (const l of DEFAULT_RECOMMENDATION_LIBRARY) {
    const r = await pool.query(
      `INSERT INTO career_recommendation_library (rec_key, rec_type, title, description, action, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (rec_key) DO NOTHING`,
      [l.rec_key, l.rec_type, l.title, l.description, l.action, l.is_active, l.sort_order],
    );
    lib += r.rowCount ?? 0;
  }
  let rules = 0;
  for (const rr of DEFAULT_RECOMMENDATION_RULES) {
    const r = await pool.query(
      `INSERT INTO career_recommendation_rules (rule_key, rec_type, signal, params, base_priority, is_active)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (rule_key) DO NOTHING`,
      [rr.rule_key, rr.rec_type, rr.signal, JSON.stringify(rr.params), rr.base_priority, rr.is_active],
    );
    rules += r.rowCount ?? 0;
  }
  return { library: lib, rules };
}

// --- Admin CRUD (library) ---------------------------------------------------

export async function upsertLibraryEntry(
  pool: Pool,
  e: RecommendationLibraryEntry,
): Promise<RecommendationLibraryEntry> {
  await ensureCareerRecommendationSchema(pool);
  const r = await pool.query(
    `INSERT INTO career_recommendation_library (rec_key, rec_type, title, description, action, is_active, sort_order, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
     ON CONFLICT (rec_key) DO UPDATE SET
       rec_type=$2, title=$3, description=$4, action=$5, is_active=$6, sort_order=$7, updated_at=NOW()
     RETURNING rec_key, rec_type, title, description, action, is_active, sort_order`,
    [e.rec_key, e.rec_type, e.title, e.description, e.action ?? '', e.is_active ?? true, e.sort_order ?? 0],
  );
  return r.rows[0] as RecommendationLibraryEntry;
}

export async function deleteLibraryEntry(pool: Pool, recKey: string): Promise<boolean> {
  await ensureCareerRecommendationSchema(pool);
  const r = await pool.query(`DELETE FROM career_recommendation_library WHERE rec_key = $1`, [recKey]);
  return (r.rowCount ?? 0) > 0;
}

// --- Admin CRUD (rules) -----------------------------------------------------

export async function upsertRuleEntry(
  pool: Pool,
  e: RecommendationRuleEntry,
): Promise<RecommendationRuleEntry> {
  await ensureCareerRecommendationSchema(pool);
  const r = await pool.query(
    `INSERT INTO career_recommendation_rules (rule_key, rec_type, signal, params, base_priority, is_active, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW())
     ON CONFLICT (rule_key) DO UPDATE SET
       rec_type=$2, signal=$3, params=$4, base_priority=$5, is_active=$6, updated_at=NOW()
     RETURNING rule_key, rec_type, signal, params, base_priority, is_active`,
    [e.rule_key, e.rec_type, e.signal, JSON.stringify(e.params ?? {}), e.base_priority ?? 'medium', e.is_active ?? true],
  );
  return r.rows[0] as RecommendationRuleEntry;
}

export async function deleteRuleEntry(pool: Pool, ruleKey: string): Promise<boolean> {
  await ensureCareerRecommendationSchema(pool);
  const r = await pool.query(`DELETE FROM career_recommendation_rules WHERE rule_key = $1`, [ruleKey]);
  return (r.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Append-only history (explicit POST path only — NEVER on a GET).
// ---------------------------------------------------------------------------

export interface CareerRecommendationHistoryRow {
  id: number;
  subject_id: string;
  role_id: string | null;
  role_title: string | null;
  measurable: boolean;
  total_recommendations: number;
  by_type: Record<string, number>;
  created_at: string;
}

export async function persistCareerRecommendationSnapshot(
  pool: Pool,
  env: CareerRecommendationEnvelope,
): Promise<CareerRecommendationHistoryRow> {
  await ensureCareerRecommendationSchema(pool);
  const r = await pool.query(
    `INSERT INTO career_recommendation_history
       (subject_id, role_id, role_title, measurable, total_recommendations, by_type, snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, subject_id, role_id, role_title, measurable, total_recommendations, by_type, created_at`,
    [
      env.subject_id,
      env.anchor.role_id,
      env.anchor.role_title,
      env.measurable,
      env.summary.total_recommendations,
      JSON.stringify(env.summary.by_type),
      JSON.stringify(env),
    ],
  );
  return r.rows[0] as CareerRecommendationHistoryRow;
}

export async function listCareerRecommendationHistory(
  pool: Pool,
  subjectId: string,
  limit = 50,
): Promise<{ exists: boolean; count: number; items: CareerRecommendationHistoryRow[] }> {
  const sid = String(subjectId ?? '').trim();
  const probe = await pool
    .query(`SELECT to_regclass('public.career_recommendation_history') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { exists: false, count: 0, items: [] };
  const r = await pool
    .query(
      `SELECT id, subject_id, role_id, role_title, measurable, total_recommendations, by_type, created_at
       FROM career_recommendation_history WHERE subject_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [sid, Math.max(1, Math.min(200, limit))],
    )
    .catch(() => ({ rows: [] as CareerRecommendationHistoryRow[] }));
  return { exists: true, count: r.rows.length, items: r.rows as CareerRecommendationHistoryRow[] };
}
