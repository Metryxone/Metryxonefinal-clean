/**
 * MX-302B — Career Explorer (backend, compose-only)
 * ----------------------------------------------------------------------------
 * The "explore careers" surface of Career Discovery. It COMPOSES the existing
 * career-match and career-simulation engines (which themselves already compose
 * the career-graph / occupation / role-DNA substrate) into two read-only views:
 *   • explore  — ranked role matches with the headline fit signals,
 *   • simulate — a "what-if" projection given hypothetical competency gains.
 *
 * never-throws + honest empty states: a failure in any composed engine degrades
 * to an empty list with a measurable=false flag rather than a 500. No new
 * tables, no writes.
 */
import type { Pool } from 'pg';
import { buildCareerMatch, buildCareerMatchForRole } from './career-match-engine';
import { buildCareerSimulation, type SimChange } from './career-simulation-engine';
import { buildCareerIntelligence } from './career-intelligence-bridge';
import { listMarketDemands } from './market-intelligence';

export interface ExplorerRole {
  role_id: string;
  role_name: string;
  family: string | null;
  match_percentage: number | null;
  confidence: string | null;
  explanation: string | null;
}

export interface ExplorerView {
  ok: boolean;
  measurable: boolean;
  roles: ExplorerRole[];
  anchor: ExplorerRole | null;
  note?: string;
  generated_at: string;
}

function normRole(m: any): ExplorerRole {
  return {
    role_id: String(m?.role_id ?? m?.id ?? ''),
    role_name: String(m?.role_name ?? m?.name ?? m?.role_id ?? 'Role'),
    family: m?.family ?? m?.role_family ?? null,
    match_percentage: m?.match_percentage == null ? null : Number(m.match_percentage),
    confidence: m?.match_confidence ?? m?.confidence ?? null,
    explanation: m?.match_explanation ?? m?.explanation ?? null,
  };
}

/** Compose the role-match engine into the Explorer "explore" view. */
export async function buildExplorerView(pool: Pool, userId: string, limit = 12): Promise<ExplorerView> {
  let env: any = null;
  try {
    env = await buildCareerMatch(pool, userId);
  } catch {
    env = null;
  }
  const matches: any[] = Array.isArray(env?.matches) ? env.matches : [];
  const roles = matches.slice(0, Math.max(1, limit)).map(normRole);
  const anchor = env?.anchor ? normRole(env.anchor) : null;
  return {
    ok: true,
    measurable: roles.length > 0,
    roles,
    anchor,
    note: roles.length === 0 ? 'No measurable role matches yet — complete the competency assessment to unlock matches.' : undefined,
    generated_at: new Date().toISOString(),
  };
}

/** Single-role deep-dive (composes the match engine for one role). */
export async function buildExplorerRole(pool: Pool, userId: string, roleId: string): Promise<{ ok: boolean; role: ExplorerRole | null; detail: any }> {
  const numericId = Number(roleId);
  if (!Number.isFinite(numericId)) {
    return { ok: true, role: null, detail: null };
  }
  try {
    const env: any = await buildCareerMatchForRole(pool, userId, numericId);
    const fit = env?.role_fit ?? null;
    return { ok: true, role: fit ? normRole(fit) : null, detail: env ?? null };
  } catch {
    return { ok: true, role: null, detail: null };
  }
}

export interface ExplorerSimulation {
  ok: boolean;
  measurable: boolean;
  summary: any;
  unlocked_roles: any[];
  improved_roles: any[];
  regressed_roles: any[];
  note?: string;
  generated_at: string;
}

/**
 * Compose the simulation engine: project role-fit changes given hypothetical
 * competency improvements. Degrades to an empty (measurable=false) projection.
 */
export async function buildExplorerSimulation(
  pool: Pool,
  userId: string,
  changes: SimChange[],
  scenarioKey?: string,
): Promise<ExplorerSimulation> {
  if (!Array.isArray(changes) || changes.length === 0) {
    return {
      ok: true, measurable: false, summary: null,
      unlocked_roles: [], improved_roles: [], regressed_roles: [],
      note: 'No simulation changes supplied.', generated_at: new Date().toISOString(),
    };
  }
  let env: any = null;
  try {
    env = await buildCareerSimulation(pool, userId, changes, scenarioKey);
  } catch {
    env = null;
  }
  if (!env) {
    return {
      ok: true, measurable: false, summary: null,
      unlocked_roles: [], improved_roles: [], regressed_roles: [],
      note: 'Simulation could not be computed from your current data.', generated_at: new Date().toISOString(),
    };
  }
  return {
    ok: true,
    measurable: true,
    summary: env.summary ?? null,
    unlocked_roles: Array.isArray(env.unlocked_roles) ? env.unlocked_roles : [],
    improved_roles: Array.isArray(env.improved_roles) ? env.improved_roles : [],
    regressed_roles: Array.isArray(env.regressed_roles) ? env.regressed_roles : [],
    generated_at: new Date().toISOString(),
  };
}

// ── Market explorer: industries / functions / salaries / emerging careers ────
export interface ExplorerIndustry { industry_id: string; industry_name: string; measurable: boolean; readiness_score: number | null; readiness_band: string | null; }
export interface ExplorerFunction { function_id: string; function_name: string; measurable: boolean; readiness_score: number | null; readiness_band: string | null; }
export interface ExplorerSalary { occupation_id: string; title: string | null; role_family: string | null; salary_min: number | null; salary_max: number | null; currency: string | null; demand_score: number | null; hiring_trend: string | null; }
export interface ExplorerEmerging { occupation_id: string; title: string | null; role_family: string | null; future_relevance_score: number | null; hiring_trend: string | null; automation_risk_score: number | null; }

export interface ExplorerMarket {
  ok: boolean;
  measurable: boolean;
  industries: ExplorerIndustry[];
  functions: ExplorerFunction[];
  salaries: ExplorerSalary[];
  emerging_careers: ExplorerEmerging[];
  notes: string[];
  generated_at: string;
}

/**
 * Compose the "browse the market" surface:
 *   • industries / functions — per-user readiness from the career-intelligence
 *     bridge (occupation + role-DNA substrate),
 *   • salaries / emerging careers — from the seeded labor-market intelligence
 *     (market_demand_models); emerging = highest future-relevance.
 * Honest empty states: each list degrades to [] with an explanatory note rather
 * than fabricating market data. No writes.
 */
export async function buildExplorerMarket(pool: Pool, userId: string, region = 'IN'): Promise<ExplorerMarket> {
  const notes: string[] = [];

  let industries: ExplorerIndustry[] = [];
  let functions: ExplorerFunction[] = [];
  try {
    const intel: any = await buildCareerIntelligence(pool, userId);
    const cr = intel?.career_readiness ?? null;
    industries = (cr?.industries?.items ?? []).map((i: any) => ({
      industry_id: String(i.industry_id ?? ''),
      industry_name: String(i.industry_name ?? 'Industry'),
      measurable: !!i.measurable,
      readiness_score: i.score == null ? null : Number(i.score),
      readiness_band: i.band ?? null,
    }));
    functions = (cr?.functions?.items ?? []).map((f: any) => ({
      function_id: String(f.function_id ?? ''),
      function_name: String(f.function_name ?? 'Function'),
      measurable: !!f.measurable,
      readiness_score: f.score == null ? null : Number(f.score),
      readiness_band: f.band ?? null,
    }));
  } catch {
    notes.push('Industry/function readiness unavailable — composed from your competency profile when present (honest absence).');
  }

  let salaries: ExplorerSalary[] = [];
  let emerging_careers: ExplorerEmerging[] = [];
  try {
    const rows: any[] = await listMarketDemands(pool, region, 100);
    salaries = rows.map((r) => ({
      occupation_id: String(r.occupation_id ?? ''),
      title: r.canonical_title ?? null,
      role_family: r.role_family ?? null,
      salary_min: r.salary_min == null ? null : Number(r.salary_min),
      salary_max: r.salary_max == null ? null : Number(r.salary_max),
      currency: r.salary_currency ?? null,
      demand_score: r.demand_score == null ? null : Number(r.demand_score),
      hiring_trend: r.hiring_trend ?? null,
    }));
    emerging_careers = rows
      .filter((r) => r.future_relevance_score != null)
      .sort((a, b) => Number(b.future_relevance_score) - Number(a.future_relevance_score))
      .slice(0, 12)
      .map((r) => ({
        occupation_id: String(r.occupation_id ?? ''),
        title: r.canonical_title ?? null,
        role_family: r.role_family ?? null,
        future_relevance_score: r.future_relevance_score == null ? null : Number(r.future_relevance_score),
        hiring_trend: r.hiring_trend ?? null,
        automation_risk_score: r.automation_risk_score == null ? null : Number(r.automation_risk_score),
      }));
  } catch {
    notes.push('Labor-market data unavailable for this region (honest empty, not zero).');
  }
  if (salaries.length === 0 && !notes.length) notes.push('No seeded labor-market rows for this region yet.');

  const measurable = industries.length > 0 || functions.length > 0 || salaries.length > 0;
  return { ok: true, measurable, industries, functions, salaries, emerging_careers, notes, generated_at: new Date().toISOString() };
}
