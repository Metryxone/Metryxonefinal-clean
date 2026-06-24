/**
 * MX-103W Phase 2 — Role DNA Auto-Resolution (unified composing service).
 *
 * ONE pipeline that turns a free-text role title into a fully-grounded role
 * resolution by COMPOSING (never recomputing) three existing, independently-built
 * layers:
 *
 *   1. Title crosswalk   — resolveCuratedRoleByTitle (#99): free text -> curated
 *                          onto_roles match + top alternatives + numeric title
 *                          confidence, or an honest abstain (never fabricated).
 *   2. Role DNA runtime  — resolveRoleDNARuntime: the resolved curated role ->
 *                          its competency targets (behavioral / cognitive /
 *                          leadership / execution). Role DNA is the CANONICAL
 *                          competency authority.
 *   3. Assessment found. — getRoleAssessmentMap: the resolved role -> its
 *                          assessment blueprint(s) (what would actually be asked).
 *
 * O*NET stays the REFERENCE layer (it only ever flows in through the curated
 * crosswalk); Role DNA + the assessment foundation are the CANONICAL layers.
 *
 * Founder contract (honoured):
 *   - Compose, don't recompute   — calls existing engines, adds no parallel math.
 *   - Coverage ⟂ Confidence      — title confidence (how sure of the role) is kept
 *                                  STRICTLY SEPARATE from coverage (how much
 *                                  competency / assessment substance the role
 *                                  carries). Neither is folded into the other.
 *   - Never fabricate            — no curated match => abstain (resolved=null), and
 *                                  the competency/assessment layers degrade to null,
 *                                  never to invented content.
 *   - Never throws               — every compose hop is wrapped; a failing layer
 *                                  degrades that layer only.
 *   - Human override             — an operator can pin a curated role id; a hand
 *                                  pick is treated as confirmed (confidence 100,
 *                                  not "estimated") via resolveCuratedRoleById.
 *   - Audit + reversible         — operator decisions persist to
 *                                  role_resolution_decisions (append-only). Schema
 *                                  is created on the WRITE path only; reads use a
 *                                  to_regclass probe (flag-OFF => byte-identical,
 *                                  no DDL).
 */
import type { Pool } from 'pg';
import {
  resolveCuratedRoleByTitle,
  resolveCuratedRoleById,
  type RoleTitleMatch,
} from './role-title-crosswalk';
import { resolveRoleDNARuntime } from './role-dna-runtime-engine';
import { getRoleAssessmentMap } from './assessment-foundation-mapping';

export const ROLE_AUTO_RESOLUTION_VERSION = '1.0.0';

export interface RoleResolutionContext {
  industry?: string;
  orgMaturity?: string;
  orgLayer?: string;
  careerStage?: string;
  experienceYears?: number;
  workArrangement?: string;
  leadershipScope?: string;
}

export interface RoleResolutionRequest {
  title: string;
  context?: RoleResolutionContext;
  /** Operator-pinned curated role id (human override). When set, the title
   *  heuristic is bypassed and the pick is treated as confirmed. */
  overrideRoleId?: string | null;
}

export interface CompetencyProfileView {
  role_id: string;
  role_title: string;
  seniority_band: string;
  /** Coverage axis — how much competency substance the role carries. */
  competency_count: number;
  behavioral_count: number;
  cognitive_count: number;
  leadership_count: number;
  execution_count: number;
  top_competencies: Array<{ competency_id: string; weight: number; priority?: string }>;
  /** False when the canonical role carries NO competency targets (honest gap,
   *  not a zero score). */
  measurable: boolean;
  source_health: Record<string, unknown> | null;
}

export interface AssessmentReadinessView {
  blueprint_count: number;
  primary_blueprint_id: string | null;
  total_competencies: number;
  blueprints: Array<{ blueprint_id: string; blueprint_name: string | null; is_primary: boolean; competency_count: number; active: boolean }>;
  /** Coverage axis — true when at least one active blueprint with competencies exists. */
  ready: boolean;
}

export interface RoleResolutionResult {
  input: string;
  override_applied: boolean;
  abstained: boolean;
  // ── Confidence axis (title resolution) ──────────────────────────────────
  resolved: RoleTitleMatch | null;
  alternatives: RoleTitleMatch[];
  candidates_considered: number;
  confidence_pct: number | null;
  confidence_label: string | null;
  estimated: boolean | null;
  // ── Coverage axis (substance behind the role) ───────────────────────────
  competency_profile: CompetencyProfileView | null;
  assessment: AssessmentReadinessView | null;
  // ── Transparency ────────────────────────────────────────────────────────
  explainability: string[];
  note: string;
}

async function buildCompetencyProfile(
  pool: Pool,
  roleId: string,
  roleTitle: string,
  ctx: RoleResolutionContext,
): Promise<CompetencyProfileView | null> {
  try {
    const profile = await resolveRoleDNARuntime(
      pool,
      { roleTitle: roleTitle || roleId, ...ctx },
      { shadowMode: true },
    );
    const targets = Array.isArray(profile.competencyTargets) ? profile.competencyTargets : [];
    const top = [...targets]
      .filter((t: any) => t && t.competencyId)
      .sort((a: any, b: any) => (Number(b.weight) || 0) - (Number(a.weight) || 0))
      .slice(0, 8)
      .map((t: any) => ({
        competency_id: String(t.competencyId),
        weight: Number(t.weight) || 0,
        priority: t.priority,
      }));
    return {
      role_id: roleId,
      role_title: roleTitle,
      seniority_band: profile.resolvedRole?.seniorityBand ?? 'unknown',
      competency_count: targets.length,
      behavioral_count: profile.behavioral?.length ?? 0,
      cognitive_count: profile.cognitive?.length ?? 0,
      leadership_count: profile.leadership?.length ?? 0,
      execution_count: profile.execution?.length ?? 0,
      top_competencies: top,
      measurable: targets.length > 0,
      source_health: (profile.source_health as Record<string, unknown>) ?? null,
    };
  } catch {
    return null; // degrade this layer only — never fabricate a profile.
  }
}

async function buildAssessmentReadiness(pool: Pool, roleId: string): Promise<AssessmentReadinessView | null> {
  try {
    const views = await getRoleAssessmentMap(pool, { roleId, activeOnly: true });
    const view = views.find(v => v.role_id === roleId) ?? views[0];
    if (!view) {
      return { blueprint_count: 0, primary_blueprint_id: null, total_competencies: 0, blueprints: [], ready: false };
    }
    const blueprints = view.blueprints.map(b => ({
      blueprint_id: b.blueprint_id,
      blueprint_name: b.blueprint_name,
      is_primary: b.is_primary,
      competency_count: b.competency_count,
      active: b.active,
    }));
    const primary = blueprints.find(b => b.is_primary) ?? blueprints[0] ?? null;
    const total = blueprints.reduce((s, b) => s + (b.competency_count || 0), 0);
    return {
      blueprint_count: blueprints.length,
      primary_blueprint_id: primary ? primary.blueprint_id : null,
      total_competencies: total,
      blueprints,
      ready: blueprints.some(b => b.active && b.competency_count > 0),
    };
  } catch {
    return null;
  }
}

/**
 * End-to-end role resolution. Read-only compose (the only possible write is the
 * Role DNA runtime's own gated seed-persist, an existing behaviour). Never throws.
 */
export async function resolveRoleEndToEnd(
  pool: Pool,
  req: RoleResolutionRequest,
): Promise<RoleResolutionResult> {
  const input = (req?.title ?? '').toString().trim();
  const ctx = req?.context ?? {};
  const overrideRoleId = (req?.overrideRoleId ?? '').toString().trim();
  const explain: string[] = [];

  // 1. Title crosswalk (or human override).
  let resolution;
  if (overrideRoleId) {
    resolution = await resolveCuratedRoleByTitle(pool, input).catch(() => null);
    const overridden = await resolveCuratedRoleById(pool, overrideRoleId, input).catch(() => null);
    if (overridden && overridden.resolved) {
      resolution = overridden;
      explain.push(`Operator override: pinned curated role "${overrideRoleId}" (treated as confirmed, confidence 100, not estimated).`);
    } else {
      explain.push(`Operator override "${overrideRoleId}" did not resolve to a profiled curated role — fell back to title resolution.`);
      resolution = resolution ?? (await resolveCuratedRoleByTitle(pool, input).catch(() => null));
    }
  } else {
    resolution = await resolveCuratedRoleByTitle(pool, input).catch(() => null);
  }

  const base: RoleResolutionResult = {
    input,
    override_applied: false,
    abstained: true,
    resolved: null,
    alternatives: [],
    candidates_considered: resolution?.candidates_considered ?? 0,
    confidence_pct: null,
    confidence_label: null,
    estimated: null,
    competency_profile: null,
    assessment: null,
    explainability: explain,
    note: '',
  };

  if (!resolution || !resolution.resolved) {
    base.note =
      resolution?.note ??
      'No curated role could be resolved from the supplied title — abstaining (no fabrication). Set the role explicitly or extend the curated role library.';
    explain.push('Abstained: the title did not crosswalk to any curated role carrying a competency profile.');
    explain.push('Coverage and Confidence are reported separately and are both null on an abstain (never inferred).');
    return base;
  }

  const r = resolution.resolved;
  base.override_applied = !!overrideRoleId && r.confidence_pct === 100 && r.estimated === false;
  base.abstained = false;
  base.resolved = r;
  base.alternatives = resolution.alternatives ?? [];
  base.candidates_considered = resolution.candidates_considered ?? 0;
  base.confidence_pct = r.confidence_pct;
  base.confidence_label = r.confidence_label;
  base.estimated = r.estimated;

  explain.push(
    `Title "${input}" → curated role ${r.role_title} (${r.role_id}) via ${r.match_type} at ${r.confidence_pct}% title confidence` +
      `${r.estimated ? ' (Estimated)' : ''}.`,
  );

  // 2 + 3. Canonical competency profile + assessment readiness (Coverage axis).
  const [competency_profile, assessment] = await Promise.all([
    buildCompetencyProfile(pool, r.role_id, r.role_title, ctx),
    buildAssessmentReadiness(pool, r.role_id),
  ]);
  base.competency_profile = competency_profile;
  base.assessment = assessment;

  if (competency_profile) {
    explain.push(
      competency_profile.measurable
        ? `Role DNA (canonical): ${competency_profile.competency_count} competency targets resolved (Coverage axis — independent of title confidence).`
        : 'Role DNA resolved the role but it carries no competency targets yet — Coverage is an honest gap, not a zero score.',
    );
  } else {
    explain.push('Role DNA layer unavailable — competency coverage not measurable (degraded, not fabricated).');
  }
  if (assessment) {
    explain.push(
      assessment.ready
        ? `Assessment foundation: ${assessment.blueprint_count} blueprint(s), ${assessment.total_competencies} competencies — ready to generate.`
        : 'Assessment foundation: no active blueprint with competencies for this role yet — Coverage gap (not fabricated).',
    );
  }

  base.note =
    `Resolved "${input}" → ${r.role_title} at ${r.confidence_pct}% title confidence. ` +
    `Confidence (title resolution) and Coverage (${competency_profile?.competency_count ?? 0} competencies / ` +
    `${assessment?.blueprint_count ?? 0} blueprint(s)) are SEPARATE axes.`;
  return base;
}

// ── Audit / persistence (WRITE-PATH ONLY) ───────────────────────────────────

async function relExists(pool: Pool, rel: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${rel}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

/** Create the decision-audit substrate. WRITE-PATH ONLY (never from a GET). */
export async function ensureRoleResolutionSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_resolution_decisions (
      id                BIGSERIAL PRIMARY KEY,
      input_title       TEXT NOT NULL,
      resolved_role_id  TEXT,
      resolved_title    TEXT,
      confidence_pct    INTEGER,
      estimated         BOOLEAN,
      override_role_id  TEXT,
      override_applied  BOOLEAN DEFAULT false,
      decision          TEXT NOT NULL DEFAULT 'accepted',
      actor_id          TEXT,
      context           JSONB DEFAULT '{}'::jsonb,
      result_snapshot   JSONB DEFAULT '{}'::jsonb,
      created_at        TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_role_resolution_decisions_role
      ON role_resolution_decisions (resolved_role_id);
  `);
}

export interface RecordDecisionInput {
  actorId: string | null;
  decision?: 'accepted' | 'overridden' | 'rejected';
  request: RoleResolutionRequest;
  result: RoleResolutionResult;
}

/** Persist an operator decision (append-only). Never throws. */
export async function recordResolutionDecision(
  pool: Pool,
  input: RecordDecisionInput,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  try {
    await ensureRoleResolutionSchema(pool);
    const { result, request } = input;
    const r = await pool.query(
      `INSERT INTO role_resolution_decisions
         (input_title, resolved_role_id, resolved_title, confidence_pct, estimated,
          override_role_id, override_applied, decision, actor_id, context, result_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        result.input,
        result.resolved?.role_id ?? null,
        result.resolved?.role_title ?? null,
        result.confidence_pct,
        result.estimated,
        request.overrideRoleId ?? null,
        result.override_applied,
        input.decision ?? 'accepted',
        input.actorId,
        JSON.stringify(request.context ?? {}),
        JSON.stringify({
          abstained: result.abstained,
          confidence_pct: result.confidence_pct,
          competency_count: result.competency_profile?.competency_count ?? null,
          blueprint_count: result.assessment?.blueprint_count ?? null,
        }),
      ],
    );
    return { ok: true, id: r.rows[0]?.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'db error' };
  }
}

export interface ResolutionCoverage {
  audit_present: boolean;
  total_decisions: number | null;
  accepted: number | null;
  overridden: number | null;
  abstained_persisted: number | null;
  distinct_roles: number | null;
  avg_confidence_pct: number | null; // confidence axis — reported, never folded into coverage
  last_decision_at: string | null;
  notes: string[];
}

/** Read-only coverage for the super-admin console (Phase 3). to_regclass probe;
 *  never DDL, never throws. Values are null (not 0) when no audit substrate. */
export async function getResolutionCoverage(pool: Pool): Promise<ResolutionCoverage> {
  const notes: string[] = [];
  const out: ResolutionCoverage = {
    audit_present: false,
    total_decisions: null,
    accepted: null,
    overridden: null,
    abstained_persisted: null,
    distinct_roles: null,
    avg_confidence_pct: null,
    last_decision_at: null,
    notes,
  };
  if (!(await relExists(pool, 'role_resolution_decisions'))) {
    notes.push('no role-resolution decisions recorded yet (feature not yet exercised) — coverage not measurable, not zero');
    return out;
  }
  out.audit_present = true;
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE decision = 'accepted')::int AS accepted,
        COUNT(*) FILTER (WHERE override_applied = true)::int AS overridden,
        COUNT(*) FILTER (WHERE resolved_role_id IS NULL)::int AS abstained,
        COUNT(DISTINCT resolved_role_id)::int AS roles,
        AVG(confidence_pct) FILTER (WHERE confidence_pct IS NOT NULL) AS avg_conf,
        MAX(created_at) AS last_at
      FROM role_resolution_decisions`);
    const row = r.rows[0] ?? {};
    out.total_decisions = row.total ?? 0;
    out.accepted = row.accepted ?? 0;
    out.overridden = row.overridden ?? 0;
    out.abstained_persisted = row.abstained ?? 0;
    out.distinct_roles = row.roles ?? 0;
    out.avg_confidence_pct = row.avg_conf != null ? Math.round(Number(row.avg_conf)) : null;
    out.last_decision_at = row.last_at ? new Date(row.last_at).toISOString() : null;
  } catch {
    notes.push('decision counts unreadable');
  }
  return out;
}
