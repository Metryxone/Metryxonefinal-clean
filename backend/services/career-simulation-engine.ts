/**
 * PHASE 4.8 — Career Simulation Engine ("What-If Analysis").
 *
 * A pure, read-only, never-throws layer that COMPOSES the already-built role
 * readiness scorer (role-competency-profile → getRoleReadiness, the canonical
 * Phase-2 weighted-attainment engine) and the competency runtime profile
 * (competency-runtime → getProfile, domain-proxy measured levels) into a
 * "what-if" simulation: given a hypothetical change to one or more competency
 * domains ("if Communication improves to level 4…"), it re-scores EVERY role in
 * the catalog and reports which roles become available (fit/band threshold
 * crossings) — WITHOUT ever recomputing a readiness score itself.
 *
 * Honesty contract (non-negotiable, carried from Phase 3/4):
 *   - COMPOSES already-computed readiness — every baseline AND simulated score
 *     comes from the canonical getRoleReadiness engine. This layer only re-shapes
 *     and DIFFS those results; it never invents a score or a level.
 *   - The measurement granularity of the platform IS the onto-DOMAIN (domain-
 *     proxy): a measured competency profile yields a level per onto-domain, and a
 *     role competency inherits its domain's level (mirrors computeGapAnalysis).
 *     A what-if change is therefore applied at the onto-DOMAIN level and this is
 *     disclosed — raising a domain lifts every competency that inherits it.
 *   - Simulated levels are HYPOTHETICAL (operator-supplied), never measured —
 *     the envelope flags them as such and never presents them as real attainment.
 *   - Coverage (how much of the profile is measured) and Confidence (how
 *     trustworthy the underlying measurement is) are reported as TWO SEPARATE
 *     axes, never composited into one number.
 *   - Read-only & never-throws: every source call is guarded; one failing source
 *     degrades its part to an honest empty/unmeasured, never the whole envelope.
 *     ZERO DDL in the compose path — persistence is an explicit POST.
 *   - Outputs are DEVELOPMENTAL SIGNALS ONLY — never hiring/promotion/suitability
 *     predictions ("roles become available" = a readiness/fit threshold crossing
 *     on a developmental scale, not a hiring claim). The composed engines'
 *     language_policy is surfaced unchanged.
 *
 * Byte-identical flag-OFF is enforced by the route gate (503 before any call here).
 */

import type { Pool } from 'pg';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';
import { competencyRuntimeReady } from './career-gap-engine.js';
import {
  getProfile,
  MEASURABLE_ONTO_DOMAINS,
  ONTO_DOMAIN_LABEL,
  type DomainScore,
} from './competency-runtime.js';
import {
  getRoleProfiles,
  getRoleReadiness,
  type RoleProfile,
  type ReadinessResult,
} from './role-competency-profile.js';

export const CAREER_SIMULATION_VERSION = '4.8.0';

/**
 * EVERY relation (table AND explicit index) created by the lazy
 * `ensureRoleCompetencyProfileSchema` in role-competency-profile.ts. The role
 * scan (getRoleProfiles / getRoleReadiness) calls that ensure UNCONDITIONALLY,
 * so a GET is only safe to enter when ALL of these already exist — otherwise the
 * transitive ensure would CREATE the missing one(s). Kept in lockstep with that
 * engine's DDL so NO schema object can ever be created on a read. (Primary-key
 * indexes are created atomically inside CREATE TABLE IF NOT EXISTS and need no
 * separate probe.)
 */
export const ROLE_PROFILE_RELATIONS = [
  'onto_role_competency_profiles',
  'uq_rcp_role_comp',
  'idx_rcp_role',
  'idx_rcp_comp',
  'idx_rcp_source',
] as const;

/** Read-only probe for the role-competency-profile schema. Returns true ONLY
 *  when EVERY relation already exists, so the transitive ensure is a complete
 *  no-op (every IF NOT EXISTS finds its object). Uses to_regclass so a missing
 *  relation degrades to `false` instead of throwing — never DDLs. */
export async function roleProfileReady(pool: Pool): Promise<boolean> {
  const probe = await pool
    .query(
      `SELECT count(*)::int AS n
         FROM unnest($1::text[]) AS rel
        WHERE to_regclass('public.' || rel) IS NOT NULL`,
      [ROLE_PROFILE_RELATIONS as unknown as string[]],
    )
    .catch(() => ({ rows: [{ n: 0 }] }));
  return Number(probe.rows[0]?.n ?? 0) === ROLE_PROFILE_RELATIONS.length;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single hypothetical change. `target` is an onto-domain key (`dom_*`) OR a
 *  competency_id (resolved to its onto-domain). Exactly one of to_level / delta
 *  should be supplied (to_level wins if both are present). */
export interface SimChange {
  target: string;
  to_level?: number;
  delta?: number;
}

export interface ChangeApplied {
  onto_domain: string;
  label: string;
  from_level: number | null;
  to_level: number;
  resolved_from: string; // 'domain' | 'competency:<id>' | 'unresolved'
  note?: string;
}

export interface DomainLevelView {
  onto_domain: string;
  label: string;
  baseline_level: number | null;
  simulated_level: number | null;
  changed: boolean;
  measured: boolean;
}

interface RoleSide {
  measured: boolean;
  readiness_score: number | null;
  readiness_band: string | null;
  fit_band: string;
  fit_label: string;
  blocking_gaps: number;
  coverage_pct: number | null;
}

export interface RoleSimResult {
  role_id: string;
  role_title: string | null;
  role_family: string | null;
  baseline: RoleSide;
  simulated: RoleSide;
  readiness_delta: number | null;
  fit_delta: number; // ordinal change (simulated − baseline)
  unlocked: boolean;
  regressed: boolean;
  transition: string; // e.g. "Partial Fit → Good Fit"
}

export interface CoverageConfidence {
  coverage: {
    measurable: boolean;
    measured_domains: number;
    measurable_domains: number;
    measured_pct: number | null;
    detail: string;
  };
  confidence: {
    band: string;
    basis: string;
    caps: string[];
  };
}

export interface CareerSimulationEnvelope {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  scenario_key: string;
  measurable: boolean;
  domains: DomainLevelView[];
  changes_applied: ChangeApplied[];
  roles_evaluated: number;
  unlocked_roles: RoleSimResult[];
  improved_roles: RoleSimResult[];
  regressed_roles: RoleSimResult[];
  unchanged_roles: number;
  all_roles: RoleSimResult[];
  summary: {
    unlocked_count: number;
    improved_count: number;
    regressed_count: number;
    mean_readiness_delta: number | null;
    max_readiness_delta: number | null;
  };
  axes: CoverageConfidence;
  language_policy: typeof LANGUAGE_POLICY;
  source_versions: Record<string, string>;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Constants / pure helpers
// ---------------------------------------------------------------------------

/** Fit band ordinal — a role becomes "available" when its fit crosses into the
 *  Good Fit band (>= GOOD) having previously been below it. */
const FIT_ORDINAL: Record<string, number> = {
  unmeasured: -1,
  low: 0,
  partial: 1,
  good: 2,
  strong: 3,
};
const UNLOCK_MIN_ORDINAL = FIT_ORDINAL.good; // 2

function clampLevel(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function fitOrdinal(band: string | null | undefined): number {
  return FIT_ORDINAL[String(band ?? 'unmeasured')] ?? -1;
}

function readinessSide(r: ReadinessResult | null): RoleSide {
  if (!r) {
    return {
      measured: false,
      readiness_score: null,
      readiness_band: null,
      fit_band: 'unmeasured',
      fit_label: 'Unmeasured',
      blocking_gaps: 0,
      coverage_pct: null,
    };
  }
  return {
    measured: r.measured,
    readiness_score: r.readiness_score,
    readiness_band: r.readiness_band,
    fit_band: r.role_fit.band,
    fit_label: r.role_fit.label,
    blocking_gaps: r.blocking_gaps,
    coverage_pct: r.coverage_pct,
  };
}

/** Build the domain-proxy actuals map a role needs: each active role competency
 *  inherits the level of its onto-domain (null/absent => unassessed, never 0). */
function buildActuals(
  role: RoleProfile,
  domByComp: Map<string, string>,
  levels: Map<string, number | null>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of role.competencies) {
    if (!c.active) continue;
    const dom = domByComp.get(c.competency_id);
    if (!dom) continue;
    const lvl = levels.get(dom);
    if (lvl != null && Number.isFinite(lvl)) out[c.competency_id] = lvl;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Simulation context — loaded ONCE (so the scenario engine can run many
// what-ifs against a single baseline without redundant DB work).
// ---------------------------------------------------------------------------

export interface SimContext {
  subject_id: string;
  runtimeReady: boolean;
  roleProfileReady: boolean;
  ready: boolean;
  baselineLevels: Map<string, number | null>;
  domainScores: DomainScore[];
  roleProfiles: RoleProfile[];
  domByComp: Map<string, string>;
  baselineReadiness: Map<string, ReadinessResult>;
  measuredDomains: number;
  notes: string[];
}

export async function loadSimulationContext(pool: Pool, subjectId: string): Promise<SimContext> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];

  // GET-never-writes: getProfile -> ensureCompetencyRuntimeSchema and
  // getRoleProfiles/getRoleReadiness -> ensureRoleCompetencyProfileSchema both
  // CREATE schema unconditionally. Probe BOTH first; only enter the composed
  // paths when their schema already exists so a read can NEVER create anything.
  const [runtimeReady, rpReady] = await Promise.all([
    competencyRuntimeReady(pool).catch(() => false),
    roleProfileReady(pool).catch(() => false),
  ]);

  const baselineLevels = new Map<string, number | null>();
  let domainScores: DomainScore[] = [];
  if (runtimeReady) {
    const profile = await getProfile(pool, sid).catch((e) => {
      notes.push(`Competency profile unavailable: ${e?.message ?? 'error'} (honest empty).`);
      return null;
    });
    if (profile) {
      domainScores = profile.domain_scores ?? [];
      for (const ds of domainScores) {
        baselineLevels.set(ds.onto_domain, ds.level == null ? null : Number(ds.level));
      }
    }
  } else {
    notes.push(
      'Baseline not measurable — competency runtime schema is not initialized (read-only; no schema created).',
    );
  }

  let roleProfiles: RoleProfile[] = [];
  if (rpReady) {
    roleProfiles = await getRoleProfiles(pool, { activeOnly: true }).catch((e) => {
      notes.push(`Role catalog unavailable: ${e?.message ?? 'error'} (honest empty).`);
      return [] as RoleProfile[];
    });
  } else {
    notes.push(
      'Role catalog not available — role-competency-profile schema is not initialized (read-only; no schema created).',
    );
  }

  // Resolve every role competency -> its onto-domain (read-only; degrades empty).
  const domByComp = new Map<string, string>();
  const compIds = Array.from(
    new Set(roleProfiles.flatMap((r) => r.competencies.map((c) => c.competency_id)).filter(Boolean)),
  );
  if (compIds.length > 0) {
    const r = await pool
      .query(`SELECT id, domain_id FROM onto_competencies WHERE id = ANY($1::text[])`, [compIds])
      .catch(() => ({ rows: [] as any[] }));
    for (const row of r.rows as any[]) if (row.domain_id) domByComp.set(String(row.id), String(row.domain_id));
  }

  // Baseline readiness per role (computed ONCE — the canonical scorer).
  const baselineReadiness = new Map<string, ReadinessResult>();
  for (const role of roleProfiles) {
    const actuals = buildActuals(role, domByComp, baselineLevels);
    const res = await getRoleReadiness(pool, role.role_id, actuals).catch(() => null);
    if (res) baselineReadiness.set(role.role_id, res);
  }

  const measuredDomains = Array.from(baselineLevels.entries()).filter(
    ([, v]) => v != null && Number.isFinite(v),
  ).length;

  return {
    subject_id: sid,
    runtimeReady,
    roleProfileReady: rpReady,
    ready: runtimeReady && rpReady,
    baselineLevels,
    domainScores,
    roleProfiles,
    domByComp,
    baselineReadiness,
    measuredDomains,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Apply hypothetical changes -> simulated domain levels (pure).
// ---------------------------------------------------------------------------

export function applyChanges(
  ctx: SimContext,
  changes: SimChange[],
): { simulatedLevels: Map<string, number | null>; changesApplied: ChangeApplied[]; notes: string[] } {
  const simulatedLevels = new Map<string, number | null>(ctx.baselineLevels);
  const changesApplied: ChangeApplied[] = [];
  const notes: string[] = [];

  for (const ch of changes ?? []) {
    const target = String(ch?.target ?? '').trim();
    if (!target) continue;

    // Resolve target -> onto-domain.
    let domain: string | null = null;
    let resolvedFrom = 'domain';
    if (target.startsWith('dom_')) {
      domain = target;
    } else {
      const dom = ctx.domByComp.get(target);
      if (dom) {
        domain = dom;
        resolvedFrom = `competency:${target}`;
      }
    }

    if (!domain) {
      changesApplied.push({
        onto_domain: target,
        label: ONTO_DOMAIN_LABEL[target] ?? target,
        from_level: null,
        to_level: 0,
        resolved_from: 'unresolved',
        note: 'target is neither a known onto-domain nor a competency in any role profile — change ignored (no fabrication).',
      });
      notes.push(`Change target '${target}' could not be resolved to an onto-domain — ignored.`);
      continue;
    }

    if (!MEASURABLE_ONTO_DOMAINS.has(domain)) {
      changesApplied.push({
        onto_domain: domain,
        label: ONTO_DOMAIN_LABEL[domain] ?? domain,
        from_level: ctx.baselineLevels.get(domain) ?? null,
        to_level: 0,
        resolved_from: resolvedFrom,
        note: `onto-domain '${domain}' is not measurable by the competency question bank — change ignored (no proxy level to set).`,
      });
      notes.push(`Domain '${domain}' is UNMEASURABLE — change ignored.`);
      continue;
    }

    const fromLevel = simulatedLevels.get(domain) ?? null;
    let toLevel: number | null = null;
    if (ch.to_level != null && Number.isFinite(ch.to_level)) {
      toLevel = clampLevel(Number(ch.to_level));
    } else if (ch.delta != null && Number.isFinite(ch.delta)) {
      toLevel = clampLevel((fromLevel ?? 0) + Number(ch.delta));
    }
    if (toLevel == null) {
      notes.push(`Change for '${domain}' had no to_level/delta — ignored.`);
      continue;
    }

    simulatedLevels.set(domain, toLevel);
    changesApplied.push({
      onto_domain: domain,
      label: ONTO_DOMAIN_LABEL[domain] ?? domain,
      from_level: ctx.baselineLevels.get(domain) ?? null,
      to_level: toLevel,
      resolved_from: resolvedFrom,
      note:
        resolvedFrom.startsWith('competency:')
          ? 'applied at onto-DOMAIN granularity (domain-proxy) — lifts every competency that inherits this domain.'
          : undefined,
    });
  }

  return { simulatedLevels, changesApplied, notes };
}

// ---------------------------------------------------------------------------
// Run the simulation across all roles (diff simulated vs the pre-computed
// baseline). Compose-only: simulated readiness comes from getRoleReadiness.
// ---------------------------------------------------------------------------

export async function runSimulation(
  pool: Pool,
  ctx: SimContext,
  simulatedLevels: Map<string, number | null>,
): Promise<RoleSimResult[]> {
  const results: RoleSimResult[] = [];
  for (const role of ctx.roleProfiles) {
    const baseRes = ctx.baselineReadiness.get(role.role_id) ?? null;
    const simActuals = buildActuals(role, ctx.domByComp, simulatedLevels);
    const simRes = await getRoleReadiness(pool, role.role_id, simActuals).catch(() => null);

    const baseline = readinessSide(baseRes);
    const simulated = readinessSide(simRes);

    const readinessDelta =
      baseline.readiness_score != null && simulated.readiness_score != null
        ? round1(simulated.readiness_score - baseline.readiness_score)
        : null;
    const baseOrd = fitOrdinal(baseline.fit_band);
    const simOrd = fitOrdinal(simulated.fit_band);
    const fitDelta = simOrd - baseOrd;
    const unlocked = simOrd >= UNLOCK_MIN_ORDINAL && baseOrd < UNLOCK_MIN_ORDINAL;
    const regressed =
      (readinessDelta != null && readinessDelta < 0) || (simOrd < baseOrd && simOrd >= 0 && baseOrd >= 0);

    results.push({
      role_id: role.role_id,
      role_title: role.role_title,
      role_family: role.role_family,
      baseline,
      simulated,
      readiness_delta: readinessDelta,
      fit_delta: fitDelta,
      unlocked,
      regressed,
      transition: `${baseline.fit_label} → ${simulated.fit_label}`,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Assemble a full what-if envelope.
// ---------------------------------------------------------------------------

export function assembleEnvelope(
  ctx: SimContext,
  scenarioKey: string,
  changesApplied: ChangeApplied[],
  simulatedLevels: Map<string, number | null>,
  roleResults: RoleSimResult[],
  extraNotes: string[],
): CareerSimulationEnvelope {
  const domains: DomainLevelView[] = Array.from(MEASURABLE_ONTO_DOMAINS).sort().map((dom) => {
    const baseline = ctx.baselineLevels.get(dom) ?? null;
    const simulated = simulatedLevels.get(dom) ?? null;
    return {
      onto_domain: dom,
      label: ONTO_DOMAIN_LABEL[dom] ?? dom,
      baseline_level: baseline,
      simulated_level: simulated,
      changed: (baseline ?? null) !== (simulated ?? null),
      measured: baseline != null,
    };
  });

  const unlocked = roleResults.filter((r) => r.unlocked);
  const improved = roleResults.filter((r) => !r.unlocked && (r.readiness_delta ?? 0) > 0);
  const regressed = roleResults.filter((r) => r.regressed);
  const unchanged = roleResults.length - unlocked.length - improved.length - regressed.length;

  const measuredDeltas = roleResults
    .map((r) => r.readiness_delta)
    .filter((d): d is number => d != null);
  const meanDelta = measuredDeltas.length
    ? round1(measuredDeltas.reduce((a, c) => a + c, 0) / measuredDeltas.length)
    : null;
  const maxDelta = measuredDeltas.length ? round1(Math.max(...measuredDeltas)) : null;

  const measurableDomains = MEASURABLE_ONTO_DOMAINS.size;
  const measuredPct =
    measurableDomains > 0 ? Math.round((ctx.measuredDomains / measurableDomains) * 100) : null;
  const measurable = ctx.ready && ctx.measuredDomains > 0;

  // Sort the surfaced lists: biggest readiness lift first, then by role id.
  const byImpact = (a: RoleSimResult, b: RoleSimResult) =>
    (b.readiness_delta ?? -Infinity) - (a.readiness_delta ?? -Infinity) ||
    a.role_id.localeCompare(b.role_id);
  unlocked.sort(byImpact);
  improved.sort(byImpact);

  const notes: string[] = [...ctx.notes, ...extraNotes];
  if (ctx.ready && ctx.measuredDomains === 0) {
    notes.push(
      'No measured competency profile for this subject — baseline readiness is unmeasured; simulated results reflect the hypothetical change alone (Coverage 0%).',
    );
  }
  if (changesApplied.length === 0) {
    notes.push('No hypothetical change supplied — simulated state equals baseline (no roles unlock).');
  }

  const confidenceCaps: string[] = ['domain_proxy', 'hypothetical_simulation'];
  if (!measurable) confidenceCaps.push('not_measurable');
  const confidenceBand = !measurable
    ? 'None'
    : measuredPct != null && measuredPct >= 80
      ? 'Provisional-High'
      : measuredPct != null && measuredPct >= 40
        ? 'Provisional'
        : 'Provisional-Low';

  return {
    ok: true,
    subject_id: ctx.subject_id,
    version: CAREER_SIMULATION_VERSION,
    generated_at: new Date().toISOString(),
    scenario_key: scenarioKey,
    measurable,
    domains,
    changes_applied: changesApplied,
    roles_evaluated: roleResults.length,
    unlocked_roles: unlocked,
    improved_roles: improved,
    regressed_roles: regressed,
    unchanged_roles: unchanged,
    all_roles: roleResults.slice().sort(byImpact),
    summary: {
      unlocked_count: unlocked.length,
      improved_count: improved.length,
      regressed_count: regressed.length,
      mean_readiness_delta: meanDelta,
      max_readiness_delta: maxDelta,
    },
    axes: {
      coverage: {
        measurable,
        measured_domains: ctx.measuredDomains,
        measurable_domains: measurableDomains,
        measured_pct: measuredPct,
        detail: `${ctx.measuredDomains}/${measurableDomains} measurable onto-domains have a measured baseline level`,
      },
      confidence: {
        band: confidenceBand,
        basis:
          'domain-proxy measured levels (competency profile); simulated levels are operator-supplied hypotheticals, not measured attainment',
        caps: confidenceCaps,
      },
    },
    language_policy: LANGUAGE_POLICY,
    source_versions: {
      career_simulation: CAREER_SIMULATION_VERSION,
      role_readiness: 'role-competency-profile/getRoleReadiness',
      competency_profile: 'competency-runtime/getProfile',
    },
    notes,
  };
}

/** Top-level: run one what-if for a subject. Read-only & never-throws. */
export async function buildCareerSimulation(
  pool: Pool,
  subjectId: string,
  changes: SimChange[] = [],
  scenarioKey = 'custom_what_if',
): Promise<CareerSimulationEnvelope> {
  const ctx = await loadSimulationContext(pool, subjectId);
  const { simulatedLevels, changesApplied, notes } = applyChanges(ctx, changes);
  const roleResults = await runSimulation(pool, ctx, simulatedLevels);
  return assembleEnvelope(ctx, scenarioKey, changesApplied, simulatedLevels, roleResults, notes);
}
