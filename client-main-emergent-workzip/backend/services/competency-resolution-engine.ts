/**
 * Competency Resolution Engine (V2) — central runtime intelligence engine.
 *
 * Pipeline:
 *   1. Persist runtime context (competency_runtime_contexts)
 *   2. Generate Role DNA (role-dna-generator, reads ontology)
 *   3. Upsert into role_dna_profiles_v2 (cached DNA)
 *   4. Apply context modifiers (competency_context_modifiers)
 *   5. Persist runtime weights (competency_runtime_weights)
 *   6. Build explainability (runtime-explainability-engine)
 *   7. Append resolution history (competency_resolution_history)
 *
 * Read-only against ontology (onto_*) and existing competency tables.
 * All writes go to V2-namespaced tables added in 20260630_competency_runtime_v2.sql.
 */
import type { Pool } from 'pg';
import { generateRoleDNA, ROLE_DNA_GENERATOR_VERSION, type RoleDNAEnvelope } from './role-dna-generator';
import {
  buildExplainability,
  RUNTIME_EXPLAINABILITY_VERSION,
  type ExplainabilityOutput,
} from './runtime-explainability-engine';
import { emit as emitAdaptive, ADAPTIVE_EVENTS } from './adaptive-event-bus';
import { DYNAMIC_WEIGHT_VERSION, computeDynamicWeights } from './dynamic-weight-engine';

export const COMPETENCY_RESOLUTION_VERSION = '2.0.0';

export interface RuntimeContextInput {
  user_id: number | string;
  industry_id?: string | null;
  function_id?: string | null;
  sub_function_id?: string | null;
  role_id?: string | null;
  layer_id?: string | null;
  complexity_model_id?: string | null;
  geography?: string | null;
  org_maturity?: string | null;
  team_scale?: string | null;
  seniority_band?: string | null;
  assessment_mode?: string | null;
}

export interface ContextModifier {
  id: string;
  modifier_type: string;
  modifier_name: string;
  modifier_target: string | null;
  modifier_effect: {
    weight_multipliers?: Record<string, number>;
    expected_level_delta?: Record<string, number>;
    intensity_delta?: number;
  };
  adjustment_weight: number;
}

export interface AppliedModifierSummary {
  modifier_type: string;
  modifier_name: string;
  adjustment_weight: number;
  affected_competencies: string[];
}

export interface ResolvedDNAResult {
  runtime_version: string;
  runtime_context_id: string;
  role_dna_id: string;
  role_dna: RoleDNAEnvelope;
  final_weightings: Record<string, number>;
  final_expected_levels: Record<string, number>;
  applied_modifiers: AppliedModifierSummary[];
  assessment_intensity: number;
  explainability: ExplainabilityOutput;
  confidence_score: number;
  methodology_versions: Record<string, string>;
}

const DEFAULT_INTENSITY = 0.50;

function l1Normalise(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return weights;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) {
    out[k] = +(Math.max(0, v) / total).toFixed(4);
  }
  return out;
}

async function safeQuery<T = any>(pool: Pool, text: string, params: unknown[] = []): Promise<T[]> {
  try {
    const r = await pool.query(text, params);
    return (r?.rows ?? []) as T[];
  } catch {
    return [];
  }
}

/**
 * Step 1 — persist runtime context. Returns runtime_context_id.
 */
export async function persistRuntimeContext(pool: Pool, ctx: RuntimeContextInput): Promise<string> {
  // No `::uuid` casts: V2 context columns are TEXT (see migration). Use
  // pool.query directly so write errors surface to the caller instead of
  // being silently swallowed.
  const r = await pool.query<{ id: string }>(
    `
    INSERT INTO competency_runtime_contexts
      (user_id, industry_id, function_id, sub_function_id, role_id, layer_id,
       complexity_model_id, geography, org_maturity, team_scale, seniority_band,
       assessment_mode, runtime_version)
    VALUES
      ($1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10, $11, $12, $13)
    RETURNING id
    `,
    [
      ctx.user_id, ctx.industry_id ?? null, ctx.function_id ?? null, ctx.sub_function_id ?? null,
      ctx.role_id ?? null, ctx.layer_id ?? null, ctx.complexity_model_id ?? null,
      ctx.geography ?? null, ctx.org_maturity ?? null, ctx.team_scale ?? null,
      ctx.seniority_band ?? null, ctx.assessment_mode ?? null, COMPETENCY_RESOLUTION_VERSION,
    ],
  );
  return r.rows[0]?.id ?? '';
}

/**
 * Step 2 — generate (or fetch cached) Role DNA, then upsert into role_dna_profiles_v2.
 */
export async function resolveRoleDNA(
  pool: Pool,
  ctx: RuntimeContextInput,
): Promise<{ dnaId: string; dna: RoleDNAEnvelope }> {
  const dna = await generateRoleDNA(pool, {
    roleId: ctx.role_id ?? null,
    layerId: ctx.layer_id ?? null,
    industryId: ctx.industry_id ?? null,
    complexityModelId: ctx.complexity_model_id ?? null,
    orgMaturity: ctx.org_maturity ?? null,
  });

  // Cache lookup — all context columns are TEXT in V2.
  const cacheKeyRole = ctx.role_id ?? '__generic__';
  const cached = await safeQuery<{ id: string }>(
    pool,
    `
    SELECT id FROM role_dna_profiles_v2
    WHERE role_id = $1
      AND COALESCE(layer_id, '')             = COALESCE($2, '')
      AND COALESCE(industry_id, '')          = COALESCE($3, '')
      AND COALESCE(complexity_model_id, '')  = COALESCE($4, '')
      AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [cacheKeyRole, ctx.layer_id ?? null, ctx.industry_id ?? null, ctx.complexity_model_id ?? null],
  );

  if (cached.length) return { dnaId: cached[0].id, dna };

  // Surface errors on insert — silent failure here would orphan resolutions.
  const ins = await pool.query<{ id: string }>(
    `
    INSERT INTO role_dna_profiles_v2
      (role_id, industry_id, layer_id, complexity_model_id,
       dna_name, dna_description, dna_version,
       readiness_model, behavioral_model, technical_model,
       leadership_model, strategic_model, execution_model,
       default_weightings, expected_levels, confidence_model, metadata)
    VALUES
      ($1, $2, $3, $4,
       $5, $6, $7,
       $8::jsonb, $9::jsonb, $10::jsonb,
       $11::jsonb, $12::jsonb, $13::jsonb,
       $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb)
    RETURNING id
    `,
    [
      cacheKeyRole, ctx.industry_id ?? null, ctx.layer_id ?? null, ctx.complexity_model_id ?? null,
      dna.dna_name, dna.dna_description, dna.dna_version,
      JSON.stringify(dna.readiness_model), JSON.stringify(dna.behavioral_model), JSON.stringify(dna.technical_model),
      JSON.stringify(dna.leadership_model), JSON.stringify(dna.strategic_model), JSON.stringify(dna.execution_model),
      JSON.stringify(dna.default_weightings), JSON.stringify(dna.expected_levels),
      JSON.stringify(dna.confidence_model), JSON.stringify(dna.metadata),
    ],
  );
  return { dnaId: ins.rows[0]?.id ?? '', dna };
}

/**
 * Step 3 — pull active modifiers matching the runtime context.
 */
export async function loadApplicableModifiers(
  pool: Pool,
  ctx: RuntimeContextInput,
): Promise<ContextModifier[]> {
  const all = await safeQuery<ContextModifier>(
    pool,
    `SELECT id, modifier_type, modifier_name, modifier_target, modifier_effect, adjustment_weight
     FROM competency_context_modifiers
     WHERE active = TRUE`,
  );

  // Heuristic matching: targets carry "<type>:<name>" tags that the context can opt in to.
  const wanted = new Set<string>();
  if (ctx.org_maturity) wanted.add(`org_maturity:${ctx.org_maturity.toLowerCase()}`);
  if (ctx.industry_id) wanted.add(`industry:${ctx.industry_id.toLowerCase()}`);
  if (ctx.layer_id) wanted.add(`layer:${ctx.layer_id.toLowerCase()}`);
  if (ctx.seniority_band) wanted.add(`seniority:${ctx.seniority_band.toLowerCase()}`);
  // Industry token shortcuts so callers can pass "regulated"/"healthcare"/"ai_ml" directly:
  if (ctx.industry_id) wanted.add(`industry:${ctx.industry_id}`);

  return all.filter((m) =>
    m.modifier_target ? wanted.has(m.modifier_target.toLowerCase()) : false,
  );
}

/**
 * Step 4 — apply modifiers to DNA weights + levels. Returns final values + summary.
 *
 * Thin adapter that delegates the canonical math to `computeDynamicWeights`
 * (dynamic-weight-engine), so the resolver and any downstream consumer
 * (benchmark, mobility, coaching, workforce) share ONE derivation engine.
 * Shape kept identical for backward compat with `generateRuntimeWeights`.
 */
export function applyContextModifiers(
  dna: RoleDNAEnvelope,
  modifiers: ContextModifier[],
): {
  finalWeights: Record<string, number>;
  finalLevels: Record<string, number>;
  appliedSummary: AppliedModifierSummary[];
  intensity: number;
} {
  const env = computeDynamicWeights(dna, modifiers);
  const finalWeights: Record<string, number> = {};
  const finalLevels: Record<string, number> = {};
  for (const e of env.entries) {
    finalWeights[e.competency_code] = e.importance_weight;
    finalLevels[e.competency_code] = e.expected_level;
  }
  // Re-derive applied-summary in the legacy shape (modifier-keyed, not competency-keyed).
  const appliedSummary: AppliedModifierSummary[] = [];
  for (const m of modifiers) {
    const eff = m.modifier_effect ?? {};
    const affected = new Set<string>([
      ...Object.keys(eff.weight_multipliers ?? {}),
      ...Object.keys(eff.expected_level_delta ?? {}),
    ]);
    appliedSummary.push({
      modifier_type: m.modifier_type,
      modifier_name: m.modifier_name,
      adjustment_weight: Number(m.adjustment_weight ?? 1),
      affected_competencies: Array.from(affected),
    });
  }
  return { finalWeights, finalLevels, appliedSummary, intensity: env.intensity };
}

/**
 * Step 5 — persist per-competency runtime weights (append). Returns count.
 */
export async function generateRuntimeWeights(
  pool: Pool,
  dnaId: string,
  finalWeights: Record<string, number>,
  finalLevels: Record<string, number>,
  appliedSummary: AppliedModifierSummary[],
): Promise<number> {
  let inserted = 0;
  for (const [code, w] of Object.entries(finalWeights)) {
    const lvl = finalLevels[code] ?? 0;
    const criticality = w >= 0.20 ? 'critical' : w >= 0.12 ? 'high' : w >= 0.07 ? 'medium' : 'low';
    const reasons = appliedSummary
      .filter((m) => m.affected_competencies.includes(code))
      .map((m) => `${m.modifier_type}:${m.modifier_name}`);
    const reasonText = reasons.length ? `Modifiers: ${reasons.join(', ')}` : 'Base DNA only';
    const ok = await pool.query(
      `
      INSERT INTO competency_runtime_weights
        (role_dna_id, competency_code, importance_weight, expected_level,
         minimum_threshold, growth_priority, criticality, weighting_reason, weighting_context)
      VALUES
        ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      RETURNING id
      `,
      [
        dnaId, code,
        +(w * 100).toFixed(2),
        +lvl.toFixed(2),
        +(lvl * 0.70).toFixed(2),                            // minimum_threshold = 70% of expected
        +Math.min(100, Math.max(0, (lvl * 0.20) + (w * 50))).toFixed(2),  // crude growth priority
        criticality,
        reasonText,
        JSON.stringify({ modifiers: reasons }),
      ],
    );
    if (ok.rowCount && ok.rowCount > 0) inserted++;
  }
  return inserted;
}

export function computeExpectedLevels(
  dna: RoleDNAEnvelope,
  modifiers: ContextModifier[],
): Record<string, number> {
  const levels = { ...dna.expected_levels };
  for (const m of modifiers) {
    for (const [code, delta] of Object.entries(m.modifier_effect?.expected_level_delta ?? {})) {
      levels[code] = Math.max(0, Math.min(100, (levels[code] ?? 0) + Number(delta)));
    }
  }
  return levels;
}

/**
 * Top-level resolver — orchestrates the full pipeline and returns a UI-ready envelope.
 */
export async function resolveCompetencyDNA(pool: Pool, ctx: RuntimeContextInput): Promise<ResolvedDNAResult> {
  const runtime_context_id = await persistRuntimeContext(pool, ctx);
  const { dnaId, dna } = await resolveRoleDNA(pool, ctx);
  const modifiers = await loadApplicableModifiers(pool, ctx);
  const { finalWeights, finalLevels, appliedSummary, intensity } = applyContextModifiers(dna, modifiers);
  await generateRuntimeWeights(pool, dnaId, finalWeights, finalLevels, appliedSummary);

  const explainability = buildExplainability({
    context: ctx,
    dna,
    appliedModifiers: appliedSummary,
    finalWeights,
    finalLevels,
  });

  // Audit row — surface errors so missing history is loud, not silent.
  const histRow = await pool.query(
    `
    INSERT INTO competency_resolution_history
      (user_id, runtime_context_id, resolved_role_dna_id, resolution_inputs,
       resolution_outputs, confidence_score, explainability)
    VALUES ($1, $2::uuid, $3::uuid, $4::jsonb, $5::jsonb, $6, $7::jsonb)
    RETURNING id
    `,
    [
      ctx.user_id, runtime_context_id || null, dnaId || null,
      JSON.stringify(ctx),
      JSON.stringify({ finalWeights, finalLevels, intensity }),
      explainability.confidence.score * 100,
      JSON.stringify(explainability),
    ],
  );
  const resolutionHistoryId: string | null = histRow.rows[0]?.id ?? null;

  // Best-effort append-only explainability log (new in 20260825 migration)
  pool.query(
    `INSERT INTO runtime_explainability_logs
       (user_id, resolution_history_id, role_dna_id, runtime_context_id,
        explainability, inputs_snapshot, engine_versions, confidence_score)
     VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::jsonb, $6::jsonb, $7::jsonb, $8)`,
    [
      String(ctx.user_id),
      resolutionHistoryId,
      dnaId || null,
      runtime_context_id || null,
      JSON.stringify(explainability),
      JSON.stringify(ctx),
      JSON.stringify({
        COMPETENCY_RESOLUTION_VERSION,
        ROLE_DNA_GENERATOR_VERSION,
        RUNTIME_EXPLAINABILITY_VERSION,
        DYNAMIC_WEIGHT_VERSION,
      }),
      +(explainability.confidence.score * 100).toFixed(2),
    ],
  ).catch((err) => console.warn('[resolution] explainability log failed:', (err as Error).message));

  // Best-effort append-only profile version snapshot.
  // Reads current max version for this user, bumps by 1, snapshots resolution outputs.
  // Wrapped so resolution NEVER fails on versioning issues.
  pool.query(
    `INSERT INTO competency_profile_versions
       (user_id, version_number, profile_snapshot, triggered_by,
        resolution_history_id, engine_versions)
     VALUES (
       $1,
       COALESCE((SELECT MAX(version_number) FROM competency_profile_versions WHERE user_id = $1), 0) + 1,
       $2::jsonb, $3, $4::uuid, $5::jsonb
     )`,
    [
      String(ctx.user_id),
      JSON.stringify({
        role_dna_id: dnaId,
        runtime_context_id,
        final_weightings: finalWeights,
        final_expected_levels: finalLevels,
        applied_modifiers: appliedSummary,
        intensity,
        confidence: explainability.confidence.score,
      }),
      'dna.resolved',
      resolutionHistoryId,
      JSON.stringify({
        COMPETENCY_RESOLUTION_VERSION,
        ROLE_DNA_GENERATOR_VERSION,
        RUNTIME_EXPLAINABILITY_VERSION,
        DYNAMIC_WEIGHT_VERSION,
      }),
    ],
  ).catch((err) => console.warn('[resolution] profile version snapshot failed:', (err as Error).message));

  // Fire-and-forget adaptive event so downstream listeners (benchmark, mobility,
  // coaching, workforce) can react without resolution being slowed down.
  try {
    const uidNum = typeof ctx.user_id === 'string' ? Number.parseInt(ctx.user_id, 10) : ctx.user_id;
    emitAdaptive({
      event_type: ADAPTIVE_EVENTS.DNA_RESOLVED,
      user_id: Number.isFinite(uidNum as number) ? (uidNum as number) : null,
      payload: {
        role_dna_id: dnaId,
        runtime_context_id,
        resolution_history_id: resolutionHistoryId,
        confidence: explainability.confidence.score,
        intensity,
      },
    });
  } catch (err) {
    console.warn('[resolution] event emit failed:', (err as Error).message);
  }

  return {
    runtime_version: COMPETENCY_RESOLUTION_VERSION,
    runtime_context_id,
    role_dna_id: dnaId,
    role_dna: dna,
    final_weightings: finalWeights,
    final_expected_levels: finalLevels,
    applied_modifiers: appliedSummary,
    assessment_intensity: intensity,
    explainability,
    confidence_score: explainability.confidence.score,
    methodology_versions: {
      COMPETENCY_RESOLUTION_VERSION,
      ROLE_DNA_GENERATOR_VERSION,
      RUNTIME_EXPLAINABILITY_VERSION,
      DYNAMIC_WEIGHT_VERSION,
    },
  };
}

export function buildResolutionExplainability(input: Parameters<typeof buildExplainability>[0]) {
  return buildExplainability(input);
}
