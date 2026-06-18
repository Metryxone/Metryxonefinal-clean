/**
 * Role DNA Runtime Engine — Phase 2.
 *
 * Operationalises Role DNA at request time by WRAPPING existing engines:
 *   - `role-dna-generator`        — catalog-time DNA generation (untouched)
 *   - `competency-resolution-engine` — modifier application (untouched)
 *   - `role-fit-engine`           — never replaced
 *   - `ontology-engine`           — never replaced
 *
 * Produces a runtime `RoleDNARuntimeProfile` combining:
 *   - canonical role resolution      (contextual-role-resolution-engine)
 *   - functional competency seeding  (functional-competency-seeding-engine)
 *   - contextual modifier overlays   (role_contextual_weights)
 *   - behavioral / cognitive / leadership / execution expectations
 *
 * Cached in `role-dna-cache-engine`. Best-effort persistence; never throws.
 */
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { ADAPTIVE_EVENTS, emit } from './adaptive-event-bus';
import { resolveRole, type ResolveRoleInput, type ResolvedRole } from './contextual-role-resolution-engine';
import { seedRoleCompetencies, persistSeedResult, type CompetencyTarget, type SeedResult } from './functional-competency-seeding-engine';
import { cacheGet, cacheSet, makeKey } from './role-dna-cache-engine';
import {
  isContextualCompetencyResolutionEnabled,
  isFunctionalCompetencySeedingEnabled,
} from '../config/feature-flags';

export const ROLE_DNA_RUNTIME_VERSION = '1.0.0';

export type AppliedModifier = {
  axis: string;
  value: string | number;
  competencyId: string | null;
  weightModifier: number;
  rationale?: string;
};

export type RoleDNARuntimeProfile = {
  correlationId: string;
  resolvedRole: ResolvedRole;
  competencyTargets: CompetencyTarget[];
  buckets: SeedResult['buckets'];
  behavioral: Array<{ competencyId: string; weight: number; priority?: string }>;
  cognitive: Array<{ abilityId: string; weight: number; expectedLevel?: number }>;
  leadership: Array<{ key: string; weight: number; scope?: string }>;
  execution: Array<{ key: string; weight: number }>;
  appliedModifiers: AppliedModifier[];
  generatedAt: string;
  source_health: SeedResult['source_health'] & { modifiers_ok: boolean; behavioral_ok: boolean; cognitive_ok: boolean; leadership_ok: boolean; execution_ok: boolean };
};

async function safeRows<T = any>(pool: Pool, sql: string, params: unknown[]): Promise<{ ok: boolean; rows: T[] }> {
  try { const r = await pool.query(sql, params); return { ok: true, rows: r.rows as T[] }; }
  catch { return { ok: false, rows: [] }; }
}

function contextKey(input: ResolveRoleInput): string {
  return JSON.stringify({
    i: input.industry ?? '', m: input.orgMaturity ?? '', l: input.orgLayer ?? '',
    s: input.careerStage ?? '', y: input.experienceYears ?? '',
    w: input.workArrangement ?? '', ls: input.leadershipScope ?? '',
  });
}

async function loadContextualWeights(pool: Pool, roleId: string, input: ResolveRoleInput): Promise<{ ok: boolean; rows: any[] }> {
  if (!isContextualCompetencyResolutionEnabled()) return { ok: true, rows: [] };
  const axes: Array<[string, string | number | undefined]> = [
    ['industry', input.industry],
    ['org_maturity', input.orgMaturity],
    ['org_layer', input.orgLayer],
    ['career_stage', input.careerStage],
    ['experience_years', input.experienceYears],
    ['work_arrangement', input.workArrangement],
    ['leadership_scope', input.leadershipScope],
  ];
  const filtered = axes.filter(([, v]) => v != null && v !== '');
  if (filtered.length === 0) return { ok: true, rows: [] };
  const placeholders = filtered.map((_, i) => `($${i * 2 + 2}, $${i * 2 + 3})`).join(', ');
  const params: any[] = [roleId];
  for (const [a, v] of filtered) params.push(a, String(v));
  return safeRows(pool,
    `SELECT context_axis, context_value, competency_id, weight_modifier, rationale
       FROM role_contextual_weights
       WHERE role_id = $1 AND (context_axis, context_value) IN (${placeholders})`,
    params,
  );
}

function applyModifiers(targets: CompetencyTarget[], mods: any[]): { targets: CompetencyTarget[]; applied: AppliedModifier[] } {
  if (mods.length === 0) return { targets, applied: [] };
  const applied: AppliedModifier[] = [];
  const next = targets.map((t) => {
    let w = t.weight;
    for (const m of mods) {
      const mod = Number(m.weight_modifier);
      if (!Number.isFinite(mod)) continue;
      if (m.competency_id == null || m.competency_id === t.competencyId) {
        w *= mod;
        applied.push({ axis: m.context_axis, value: m.context_value, competencyId: m.competency_id, weightModifier: mod, rationale: m.rationale });
      }
    }
    return { ...t, weight: Math.max(0, Math.min(2, w)) };
  });
  return { targets: next, applied };
}

export async function resolveRoleDNARuntime(
  pool: Pool, input: ResolveRoleInput, opts: { shadowMode: boolean } = { shadowMode: true },
): Promise<RoleDNARuntimeProfile> {
  const corr = randomUUID();
  const resolved = await resolveRole(pool, input);
  const ck = contextKey(input);
  const cacheKey = makeKey(resolved.canonicalRoleId, ck);
  const cached = cacheGet<RoleDNARuntimeProfile>(cacheKey);
  if (cached) return cached;

  // Functional seeding (gated)
  let seed: SeedResult;
  if (isFunctionalCompetencySeedingEnabled()) {
    seed = await seedRoleCompetencies(pool, resolved.canonicalRoleId);
    void persistSeedResult(pool, seed, { shadowMode: opts.shadowMode, correlationId: corr });
  } else {
    seed = {
      roleId: resolved.canonicalRoleId,
      buckets: { mandatory: [], supporting: [], adjacent: [], emerging: [] },
      totals: { mandatory: 0, supporting: 0, adjacent: 0, emerging: 0 },
      source_health: { gro_expectations_ok: true, adjacency_ok: true },
    };
  }

  const [mods, beh, cog, lead, exe] = await Promise.all([
    loadContextualWeights(pool, resolved.canonicalRoleId, input),
    safeRows(pool, `SELECT competency_id, weight, priority FROM role_behavioral_competencies WHERE role_id = $1`, [resolved.canonicalRoleId]),
    safeRows(pool, `SELECT ability_id, weight, expected_level FROM role_cognitive_expectations WHERE role_id = $1`, [resolved.canonicalRoleId]),
    safeRows(pool, `SELECT expectation_key, weight, scope FROM role_leadership_expectations WHERE role_id = $1`, [resolved.canonicalRoleId]),
    safeRows(pool, `SELECT expectation_key, weight FROM role_execution_profiles WHERE role_id = $1`, [resolved.canonicalRoleId]),
  ]);

  const flat: CompetencyTarget[] = [
    ...seed.buckets.mandatory, ...seed.buckets.supporting,
    ...seed.buckets.adjacent, ...seed.buckets.emerging,
  ];
  const { targets, applied } = applyModifiers(flat, mods.rows);

  const profile: RoleDNARuntimeProfile = {
    correlationId: corr,
    resolvedRole: resolved,
    competencyTargets: targets,
    buckets: seed.buckets,
    behavioral: beh.rows.map((r: any) => ({ competencyId: String(r.competency_id), weight: Number(r.weight ?? 0), priority: r.priority ?? undefined })),
    cognitive:  cog.rows.map((r: any) => ({ abilityId: String(r.ability_id), weight: Number(r.weight ?? 0), expectedLevel: r.expected_level != null ? Number(r.expected_level) : undefined })),
    leadership: lead.rows.map((r: any) => ({ key: String(r.expectation_key), weight: Number(r.weight ?? 0), scope: r.scope ?? undefined })),
    execution:  exe.rows.map((r: any) => ({ key: String(r.expectation_key), weight: Number(r.weight ?? 0) })),
    appliedModifiers: applied,
    generatedAt: new Date().toISOString(),
    source_health: {
      ...seed.source_health,
      modifiers_ok: mods.ok, behavioral_ok: beh.ok, cognitive_ok: cog.ok, leadership_ok: lead.ok, execution_ok: exe.ok,
    },
  };

  cacheSet(cacheKey, profile);
  void persistDNASnapshot(pool, profile, opts.shadowMode);

  emit({ event_type: ADAPTIVE_EVENTS.ROLE_DNA_RESOLVED, correlation_id: corr,
         payload: { role_id: resolved.canonicalRoleId, matched_via: resolved.matchedVia,
                    seniority: resolved.seniorityBand, target_count: targets.length } });

  return profile;
}

async function persistDNASnapshot(pool: Pool, profile: RoleDNARuntimeProfile, shadow: boolean): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO role_dna_master_profiles
         (role_id, role_title, dna_version, dna, source, generated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, NOW())`,
      [profile.resolvedRole.canonicalRoleId, profile.resolvedRole.canonicalRoleTitle,
       ROLE_DNA_RUNTIME_VERSION,
       JSON.stringify({
         buckets: profile.buckets, behavioral: profile.behavioral, cognitive: profile.cognitive,
         leadership: profile.leadership, execution: profile.execution,
         appliedModifiers: profile.appliedModifiers, resolvedRole: profile.resolvedRole, shadow_mode: shadow,
       }),
       'role-dna-runtime-engine'],
    );
  } catch (err) {
    console.warn('[role-dna-runtime] snapshot persist failed:', (err as Error).message);
  }
}
