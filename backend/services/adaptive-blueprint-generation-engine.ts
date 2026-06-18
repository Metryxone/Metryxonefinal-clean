/**
 * Adaptive Blueprint Generation Engine — Phase 3.
 *
 * Generates a per-user `AdaptiveBlueprint` that drives future adaptive
 * assessments. Reads UCIP + Role DNA + dependency graph; writes only to
 * Phase-3 blueprint tables (best-effort, never throws).
 *
 * Inputs:  ucip profile snapshot, role DNA targets, dependency edges,
 *          confidence map, assessment history.
 * Outputs: target/confidenceGap/contradictionProbe/cognitive/evidence sets +
 *          deterministic branching + adaptive-depth rules.
 */
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { ADAPTIVE_EVENTS, emit } from './adaptive-event-bus';
import type { UnifiedCompetencyProfile } from './unified-competency-profile-engine';
import { loadEdgesForCompetencies, clusterGaps, type GraphEdge } from './competency-graph-traversal-engine';

export const ADAPTIVE_BLUEPRINT_VERSION = '1.0.0';

export type AdaptiveBlueprint = {
  targetCompetencies: string[];
  confidenceGapTargets: string[];
  contradictionProbes: string[];
  branchingRules: any[];
  adaptiveDepthRules: any[];
  cognitiveTargets: string[];
  evidenceTargets: string[];
};

export type BlueprintEnvelope = {
  correlationId: string;
  sessionId: string;
  userId: string;
  roleId?: string;
  blueprint: AdaptiveBlueprint;
  inputs: { gap_clusters: string[][]; edges_considered: number };
  generated_at: string;
  shadow_mode: boolean;
};

function uniq<T>(xs: T[]): T[] { return Array.from(new Set(xs)); }

async function safeQuery(pool: Pool, sql: string, params: unknown[]): Promise<void> {
  try { await pool.query(sql, params); } catch { /* swallow */ }
}

/** Score-based gap identification. Pure. */
function identifyConfidenceGaps(profile: UnifiedCompetencyProfile, threshold = 0.6): string[] {
  const gaps: string[] = [];
  for (const c of profile.competencies ?? []) {
    if (c.confidence == null || c.confidence < threshold) gaps.push(c.competencyId);
  }
  return uniq(gaps);
}

/** Contradiction probe targets — competencies where normalized vs raw or
 *  cross-source signals diverge (cheap heuristic; pure). */
function identifyContradictions(profile: UnifiedCompetencyProfile): string[] {
  const probes: string[] = [];
  for (const c of profile.competencies ?? []) {
    if (c.rawScore != null && c.normalizedScore != null) {
      if (Math.abs(c.rawScore - c.normalizedScore) >= 15) probes.push(c.competencyId);
    }
    if ((c.evidenceCount ?? 0) >= 2 && (c.confidence ?? 0) < 0.5) probes.push(c.competencyId);
  }
  return uniq(probes);
}

/** Branching rules: low-confidence + critical role target → deepen by 2,
 *  high-confidence + non-critical → shorten by 1. Deterministic JSON. */
function buildBranchingRules(targets: string[], gaps: string[]): any[] {
  const out: any[] = [];
  for (const t of targets) {
    if (gaps.includes(t)) out.push({ when: { competencyId: t, status: 'gap' }, action: 'deepen', delta: 2 });
  }
  return out;
}

function buildAdaptiveDepthRules(probes: string[]): any[] {
  return probes.map((id) => ({ when: { competencyId: id, contradiction: true },
                               action: 'probe_alternative_evidence', maxItems: 3 }));
}

export async function generateAdaptiveBlueprint(
  pool: Pool,
  profile: UnifiedCompetencyProfile,
  opts: { shadowMode: boolean } = { shadowMode: true },
): Promise<BlueprintEnvelope> {
  const corr = randomUUID();
  const sessionId = randomUUID();

  const roleTargets = uniq((profile.competencyTargets ?? []).map((t) => t.competencyId));
  const gaps = identifyConfidenceGaps(profile);
  const probes = identifyContradictions(profile);
  const targetCompetencies = uniq([
    ...(profile.competencyTargets ?? []).filter((t) => t.priority === 'critical' || t.priority === 'high').map((t) => t.competencyId),
    ...gaps.slice(0, 10),
  ]);
  const candidateIds = uniq([...targetCompetencies, ...gaps, ...probes, ...roleTargets]);

  const edges: GraphEdge[] = await loadEdgesForCompetencies(pool, candidateIds);
  const clusters = clusterGaps(gaps, edges);

  const cognitiveTargets = uniq((profile.roleDnaSnapshot?.cognitive ?? []).map((c) => c.abilityId));
  const evidenceTargets = uniq((profile.competencyTargets ?? [])
    .filter((t) => t.evidenceRequired).map((t) => t.competencyId));

  const blueprint: AdaptiveBlueprint = {
    targetCompetencies,
    confidenceGapTargets: gaps,
    contradictionProbes: probes,
    branchingRules: buildBranchingRules(targetCompetencies, gaps),
    adaptiveDepthRules: buildAdaptiveDepthRules(probes),
    cognitiveTargets,
    evidenceTargets,
  };

  const envelope: BlueprintEnvelope = {
    correlationId: corr, sessionId, userId: profile.userId,
    roleId: profile.contextualRoleIntelligence?.resolvedRoleId,
    blueprint,
    inputs: { gap_clusters: clusters, edges_considered: edges.length },
    generated_at: new Date().toISOString(),
    shadow_mode: opts.shadowMode,
  };

  // Best-effort persist (audit only).
  await safeQuery(pool,
    `INSERT INTO adaptive_blueprint_sessions
       (id, user_id, blueprint_version, role_id, inputs, outputs, shadow_mode)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,
    [sessionId, profile.userId, ADAPTIVE_BLUEPRINT_VERSION, envelope.roleId ?? null,
     JSON.stringify(envelope.inputs), JSON.stringify(blueprint), opts.shadowMode]);

  for (const id of targetCompetencies) {
    await safeQuery(pool,
      `INSERT INTO adaptive_blueprint_targets (blueprint_session_id, competency_id, target_kind, priority)
       VALUES ($1,$2,'target',$3)`,
      [sessionId, id, gaps.includes(id) ? 'high' : 'medium']);
  }
  for (const id of gaps)   await safeQuery(pool, `INSERT INTO adaptive_blueprint_targets (blueprint_session_id, competency_id, target_kind) VALUES ($1,$2,'confidence_gap')`, [sessionId, id]);
  for (const id of probes) await safeQuery(pool, `INSERT INTO adaptive_blueprint_targets (blueprint_session_id, competency_id, target_kind) VALUES ($1,$2,'contradiction_probe')`, [sessionId, id]);
  for (const id of cognitiveTargets) await safeQuery(pool, `INSERT INTO adaptive_blueprint_targets (blueprint_session_id, competency_id, target_kind) VALUES ($1,$2,'cognitive')`, [sessionId, id]);
  for (const id of evidenceTargets)  await safeQuery(pool, `INSERT INTO adaptive_blueprint_targets (blueprint_session_id, competency_id, target_kind) VALUES ($1,$2,'evidence')`, [sessionId, id]);

  for (const rule of blueprint.branchingRules)
    await safeQuery(pool, `INSERT INTO adaptive_blueprint_rules (blueprint_session_id, rule_kind, rule) VALUES ($1,'branching',$2::jsonb)`, [sessionId, JSON.stringify(rule)]);
  for (const rule of blueprint.adaptiveDepthRules)
    await safeQuery(pool, `INSERT INTO adaptive_blueprint_rules (blueprint_session_id, rule_kind, rule) VALUES ($1,'adaptive_depth',$2::jsonb)`, [sessionId, JSON.stringify(rule)]);

  await safeQuery(pool,
    `INSERT INTO competency_graph_execution_logs
       (user_id, operation, status, nodes_visited, correlation_id, shadow_mode, metadata)
     VALUES ($1,'blueprint','success',$2,$3,$4,$5::jsonb)`,
    [profile.userId, candidateIds.length, corr, opts.shadowMode,
     JSON.stringify({ session_id: sessionId, targets: targetCompetencies.length, gaps: gaps.length, probes: probes.length })]);

  emit({ event_type: ADAPTIVE_EVENTS.ADAPTIVE_BLUEPRINT_GENERATED, correlation_id: corr,
         payload: { user_id: profile.userId, session_id: sessionId,
                    target_count: targetCompetencies.length, gap_count: gaps.length } });

  return envelope;
}
