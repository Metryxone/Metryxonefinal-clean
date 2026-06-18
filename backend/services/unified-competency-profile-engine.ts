/**
 * Unified Competency Intelligence Profile (UCIP) Engine — Phase 1.
 *
 * Aggregates existing intelligence into a single read-only profile object.
 * NEVER computes new scores. NEVER alters runtime. NEVER mutates upstream.
 *
 * Persistence is best-effort to `ucip_profiles`; failure to persist must NOT
 * fail the caller — the profile is still returned from memory.
 */
import type { Pool } from 'pg';
import { fetchAllSources, summariseHealth, type UcipSourceMap } from './ucip-orchestration-adapter';
import { dedupeCompetencies, normalizeCompetency, type CompetencyIdentity } from './competency-normalization-engine';
import { resolveRoleDNARuntime, type RoleDNARuntimeProfile } from './role-dna-runtime-engine';
import type { ResolveRoleInput } from './contextual-role-resolution-engine';
import type { CompetencyTarget } from './functional-competency-seeding-engine';
import { loadEdgesForCompetencies, type GraphEdge } from './competency-graph-traversal-engine';
import { getLatestCognitiveProfile, type CognitiveProfile } from './cognitive-runtime-engine';
import { recentContradictions } from './behavioral-contradiction-engine';
import {
  isRoleDNARuntimeEnabled,
  isCompetencyGraphRuntimeEnabled,
  isAdaptiveBlueprintRuntimeEnabled,
  isCognitiveRuntimeEnabled,
  isDynamicQuestionGenerationEnabled,
  isAdaptiveQuestionBranchingEnabled,
  isCompetencyFusionEnabled,
  isContextualScoringAuthorityEnabled,
  isIntelligenceNarrativesEnabled,
  isContinuousCompetencyMemoryEnabled,
} from '../config/feature-flags';

export const UCIP_ENGINE_VERSION = '1.4.0';

export type CompetencyState = CompetencyIdentity & {
  rawScore?: number;
  normalizedScore?: number;
  confidence?: number;
  evidenceCount: number;
};

export type UnifiedCompetencyProfile = {
  userId: string;
  profileVersion: number;
  roleDNA?: any;
  competencyGraph?: any;
  competencies: CompetencyState[];
  cognitiveProfile?: any;
  behavioralProfile?: any;
  confidenceMap?: any;
  benchmarkProfile?: any;
  readinessProfile?: any;
  marketSignals?: any;
  learningVelocity?: any;
  assessmentMemory?: any;
  evidenceSignals?: any[];
  /** Phase 2 — Role DNA Runtime snapshot. Populated only when caller passes
   *  `roleContext` to buildUcip() AND `roleDNARuntimeEnabled` flag is ON. */
  roleDnaSnapshot?: RoleDNARuntimeProfile;
  competencyTargets?: CompetencyTarget[];
  contextualRoleIntelligence?: {
    resolvedRoleId?: string;
    resolvedRoleTitle?: string;
    matchedVia?: string;
    seniorityBand?: string;
    appliedModifierCount?: number;
  };
  /** Phase 3 — Competency Graph state. Populated only when
   *  `competencyGraphRuntime` flag is ON. Read-only mirror of edges
   *  touching the user's competencies; no scoring impact. */
  competencyGraphState?: {
    edges: GraphEdge[];
    nodeCount: number;
    edgeCount: number;
  };
  propagationMetadata?: {
    last_correlation_id?: string;
    last_propagation_at?: string;
    affected_count?: number;
  };
  adaptiveBlueprintMetadata?: {
    last_session_id?: string;
    last_generated_at?: string;
    target_count?: number;
    gap_count?: number;
    probe_count?: number;
  };
  /** Phase 4 — Cognitive runtime snapshot. Populated only when
   *  `cognitiveRuntimeEnabled` flag is ON. Read-only; never feeds scoring. */
  cognitiveRuntimeProfile?: CognitiveProfile;
  /** Phase 4 — Recent contradiction summary. Populated only when
   *  `dynamicQuestionGeneration` flag is ON. Read-only; never feeds scoring. */
  contradictionHistory?: {
    recent: Array<{ type: string; severity: string; competencies: string[]; rationale: string; detected_at: string }>;
    total_recent: number;
    high_severity_count: number;
  };
  /** Phase 4 — Adaptive runtime metadata. Populated only when
   *  `dynamicQuestionGeneration` OR `adaptiveQuestionBranching` flag is ON. */
  adaptiveRuntimeMetadata?: {
    last_session_id?: string;
    last_session_started_at?: string;
    questions_generated?: number;
    branches_executed?: number;
  };
  branchingIntelligence?: {
    last_policy?: string;
    last_reason_code?: string;
    last_branch_at?: string;
  };
  /** Phase 5 — Fusion summary. Populated only when `competencyFusionEnabled` is ON. */
  fusionSummary?: {
    last_correlation_id?: string;
    last_computed_at?: string;
    competencies_fused?: number;
    avg_confidence?: number;
    avg_dispersion?: number;
  };
  /** Phase 5 — Contextual scoring snapshot. Populated only when
   *  `contextualScoringAuthority` is ON. Read-only audit echo. */
  contextualScoringAuthoritySnapshot?: {
    last_correlation_id?: string;
    last_computed_at?: string;
    overall_score?: number;
    overall_confidence?: number;
    authority_stage?: string;
    shadow_mode?: boolean;
  };
  /** Phase 5 — Narrative library summary. Populated only when
   *  `intelligenceNarratives` is ON. */
  narrativeSummary?: {
    total_recent: number;
    kinds: string[];
    last_generated_at?: string;
  };
  /** Phase 5 — Competency memory rollup. Populated only when
   *  `continuousCompetencyMemory` is ON. */
  competencyMemorySummary?: {
    total_observations: number;
    competencies_tracked: number;
    avg_growth_velocity: number | null;
    high_drift_count: number;
    last_observed_at: string | null;
  };
  orchestrationMetadata?: {
    engine_version: string;
    computed_at: string;
    sources: ReturnType<typeof summariseHealth>;
    shadow_mode: boolean;
  };
};

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function asArray(d: unknown): any[] {
  return Array.isArray(d) ? d : [];
}

/** Pull competencies from every source that mentions them, then dedupe. */
function collectCompetencies(sources: UcipSourceMap): CompetencyState[] {
  const evidenceCount = new Map<string, number>();
  const bump = (cid: string) => evidenceCount.set(cid, (evidenceCount.get(cid) ?? 0) + 1);

  const raw: CompetencyIdentity[] = [];

  // cra_scores: keyed by competency_code
  for (const row of asArray(sources.craScores?.data)) {
    const id = normalizeCompetency({ id: row.competency_code, name: row.competency_code, source: 'cra_scores' });
    raw.push(id); bump(id.competencyId);
  }
  // ai_inferred_competencies: keyed by competency_key
  for (const row of asArray(sources.aiInferred?.data)) {
    const id = normalizeCompetency({ id: row.competency_key, name: row.competency_key, source: 'ai_inferred' });
    raw.push(id); bump(id.competencyId);
  }
  // user_competency_scores: keyed by competency_id
  for (const row of asArray(sources.userCompetencyScores?.data)) {
    const id = normalizeCompetency({ id: row.competency_id, name: row.competency_id, source: 'user_competency_scores' });
    raw.push(id); bump(id.competencyId);
  }
  // p4_competency_history: keyed by competency_id
  for (const row of asArray(sources.trajectory?.data)) {
    const id = normalizeCompetency({ id: row.competency_id, name: row.competency_id, source: 'trajectory' });
    raw.push(id); bump(id.competencyId);
  }

  const deduped = dedupeCompetencies(raw);

  // Most-recent raw score from cra_scores (raw_score is integer 0-100ish).
  const rawScoreByComp = new Map<string, number>();
  for (const row of asArray(sources.craScores?.data)) {
    const cid = normalizeCompetency({ id: row.competency_code, name: row.competency_code }).competencyId;
    if (!rawScoreByComp.has(cid)) {
      const v = num(row.raw_score);
      if (v != null) rawScoreByComp.set(cid, v);
    }
  }
  // Normalised score from user_competency_scores (the bridge layer).
  const normByComp = new Map<string, number>();
  for (const row of asArray(sources.userCompetencyScores?.data)) {
    const cid = normalizeCompetency({ id: row.competency_id, name: row.competency_id }).competencyId;
    if (!normByComp.has(cid)) {
      const v = num(row.score);
      if (v != null) normByComp.set(cid, v);
    }
  }
  // Confidence: prefer ai_inferred.confidence; fall back to user_competency_scores.reliability.
  const confByComp = new Map<string, number>();
  for (const row of asArray(sources.aiInferred?.data)) {
    const cid = normalizeCompetency({ id: row.competency_key, name: row.competency_key }).competencyId;
    if (!confByComp.has(cid)) {
      const c = num(row.confidence);
      if (c != null) confByComp.set(cid, c);
    }
  }
  for (const row of asArray(sources.userCompetencyScores?.data)) {
    const cid = normalizeCompetency({ id: row.competency_id, name: row.competency_id }).competencyId;
    if (!confByComp.has(cid)) {
      const c = num(row.reliability);
      if (c != null) confByComp.set(cid, c);
    }
  }

  return deduped.map<CompetencyState>((c) => ({
    ...c,
    rawScore: rawScoreByComp.get(c.competencyId),
    normalizedScore: normByComp.get(c.competencyId),
    confidence: confByComp.get(c.competencyId),
    evidenceCount: evidenceCount.get(c.competencyId) ?? 0,
  }));
}

export async function buildUcip(
  pool: Pool,
  userId: string,
  opts: { shadowMode: boolean; roleContext?: ResolveRoleInput } = { shadowMode: true },
): Promise<UnifiedCompetencyProfile> {
  const sources = await fetchAllSources(pool, userId);
  const competencies = collectCompetencies(sources);

  const trajectory = asArray(sources.trajectory?.data);
  const snapshots = asArray(sources.assessmentSnapshots?.data);
  const craProfile = sources.craProfile?.data as any;

  const confidenceMap: Record<string, number> = {};
  for (const c of competencies) if (c.confidence != null) confidenceMap[c.competencyId] = c.confidence;

  // Phase 2 — optional Role DNA enrichment. Only runs when caller passes a
  // roleContext AND the runtime flag is ON. Failures degrade silently.
  let roleDnaSnapshot: RoleDNARuntimeProfile | undefined;
  let competencyTargets: CompetencyTarget[] | undefined;
  let contextualRoleIntelligence: UnifiedCompetencyProfile['contextualRoleIntelligence'];
  if (opts.roleContext && isRoleDNARuntimeEnabled()) {
    try {
      roleDnaSnapshot = await resolveRoleDNARuntime(pool, opts.roleContext, { shadowMode: opts.shadowMode });
      competencyTargets = roleDnaSnapshot.competencyTargets;
      contextualRoleIntelligence = {
        resolvedRoleId: roleDnaSnapshot.resolvedRole.canonicalRoleId,
        resolvedRoleTitle: roleDnaSnapshot.resolvedRole.canonicalRoleTitle,
        matchedVia: roleDnaSnapshot.resolvedRole.matchedVia,
        seniorityBand: roleDnaSnapshot.resolvedRole.seniorityBand,
        appliedModifierCount: roleDnaSnapshot.appliedModifiers.length,
      };
    } catch (err) {
      console.warn('[ucip] role DNA enrichment failed:', (err as Error).message);
    }
  }

  // Phase 3 — optional graph state enrichment. Flag-gated; failure silent.
  let competencyGraphState: UnifiedCompetencyProfile['competencyGraphState'];
  if (isCompetencyGraphRuntimeEnabled() && competencies.length > 0) {
    try {
      const ids = competencies.slice(0, 64).map((c) => c.competencyId);
      const edges = await loadEdgesForCompetencies(pool, ids);
      const nodeSet = new Set<string>(ids);
      for (const e of edges) { nodeSet.add(e.upstreamId); nodeSet.add(e.downstreamId); }
      competencyGraphState = { edges, nodeCount: nodeSet.size, edgeCount: edges.length };
    } catch (err) {
      console.warn('[ucip] graph state enrichment failed:', (err as Error).message);
    }
  }

  // Phase 3 — propagation + blueprint metadata are best-effort reads from
  // audit tables. We surface only the latest summary; no recomputation.
  let propagationMetadata: UnifiedCompetencyProfile['propagationMetadata'];
  let adaptiveBlueprintMetadata: UnifiedCompetencyProfile['adaptiveBlueprintMetadata'];
  if (isCompetencyGraphRuntimeEnabled()) {
    try {
      const pr = await pool.query(
        `SELECT correlation_id,
                MAX(occurred_at) AS occurred_at,
                COUNT(*)::int AS affected_count
           FROM competency_propagation_logs
           WHERE user_id = $1
           GROUP BY correlation_id
           ORDER BY MAX(occurred_at) DESC LIMIT 1`, [userId]);
      const row: any = pr.rows[0];
      if (row) propagationMetadata = {
        last_correlation_id: row.correlation_id, last_propagation_at: row.occurred_at?.toISOString?.() ?? String(row.occurred_at),
        affected_count: Number(row.affected_count ?? 0),
      };
    } catch { /* swallow */ }
  }
  if (isAdaptiveBlueprintRuntimeEnabled()) {
    try {
      const br = await pool.query(
        `SELECT id, generated_at, outputs
           FROM adaptive_blueprint_sessions
           WHERE user_id = $1
           ORDER BY generated_at DESC LIMIT 1`, [userId]);
      const row: any = br.rows[0];
      if (row) {
        const out = row.outputs ?? {};
        adaptiveBlueprintMetadata = {
          last_session_id: row.id, last_generated_at: row.generated_at?.toISOString?.() ?? String(row.generated_at),
          target_count: asArray(out.targetCompetencies).length,
          gap_count: asArray(out.confidenceGapTargets).length,
          probe_count: asArray(out.contradictionProbes).length,
        };
      }
    } catch { /* swallow */ }
  }

  // Phase 4 — cognitive runtime snapshot + contradiction history + adaptive runtime metadata.
  let cognitiveRuntimeProfile: CognitiveProfile | undefined;
  if (isCognitiveRuntimeEnabled()) {
    try {
      const cp = await getLatestCognitiveProfile(pool, userId);
      if (cp) cognitiveRuntimeProfile = cp;
    } catch { /* swallow */ }
  }
  let contradictionHistory: UnifiedCompetencyProfile['contradictionHistory'];
  if (isDynamicQuestionGenerationEnabled()) {
    try {
      const recent = await recentContradictions(pool, userId, 10);
      contradictionHistory = {
        recent, total_recent: recent.length,
        high_severity_count: recent.filter((c) => c.severity === 'high').length,
      };
    } catch { /* swallow */ }
  }
  let adaptiveRuntimeMetadata: UnifiedCompetencyProfile['adaptiveRuntimeMetadata'];
  let branchingIntelligence: UnifiedCompetencyProfile['branchingIntelligence'];
  if (isDynamicQuestionGenerationEnabled() || isAdaptiveQuestionBranchingEnabled()) {
    try {
      const sr = await pool.query(
        `SELECT s.id, s.started_at,
                (SELECT COUNT(*)::int FROM dynamic_question_generations g WHERE g.session_id = s.id) AS questions_generated,
                (SELECT COUNT(*)::int FROM adaptive_question_branches  b WHERE b.session_id = s.id) AS branches_executed
           FROM dynamic_question_sessions s
           WHERE s.user_id = $1
           ORDER BY s.started_at DESC LIMIT 1`, [userId]);
      const row: any = sr.rows[0];
      if (row) {
        adaptiveRuntimeMetadata = {
          last_session_id: row.id,
          last_session_started_at: row.started_at?.toISOString?.() ?? String(row.started_at),
          questions_generated: Number(row.questions_generated ?? 0),
          branches_executed: Number(row.branches_executed ?? 0),
        };
        const br = await pool.query(
          `SELECT policy, reason_code, occurred_at
             FROM adaptive_question_branches WHERE session_id = $1
             ORDER BY occurred_at DESC LIMIT 1`, [row.id]);
        const b: any = br.rows[0];
        if (b) branchingIntelligence = {
          last_policy: String(b.policy), last_reason_code: String(b.reason_code),
          last_branch_at: b.occurred_at?.toISOString?.() ?? String(b.occurred_at),
        };
      }
    } catch { /* swallow */ }
  }

  // Phase 5 — fusion / scoring / narrative / memory summaries (read-only).
  let fusionSummary: UnifiedCompetencyProfile['fusionSummary'];
  if (isCompetencyFusionEnabled()) {
    try {
      const r = await pool.query(
        `SELECT correlation_id,
                MAX(computed_at) AS computed_at,
                COUNT(*)::int AS competencies_fused,
                AVG(fused_confidence)::float AS avg_confidence,
                AVG(dispersion)::float AS avg_dispersion
           FROM competency_fusion_logs
          WHERE user_id = $1
          GROUP BY correlation_id
          ORDER BY MAX(computed_at) DESC LIMIT 1`, [userId]);
      const row: any = r.rows[0];
      if (row) fusionSummary = {
        last_correlation_id: row.correlation_id,
        last_computed_at: row.computed_at?.toISOString?.() ?? String(row.computed_at),
        competencies_fused: Number(row.competencies_fused ?? 0),
        avg_confidence: row.avg_confidence == null ? undefined : Number(row.avg_confidence),
        avg_dispersion: row.avg_dispersion == null ? undefined : Number(row.avg_dispersion),
      };
    } catch { /* swallow */ }
  }
  let contextualScoringAuthoritySnapshot: UnifiedCompetencyProfile['contextualScoringAuthoritySnapshot'];
  if (isContextualScoringAuthorityEnabled()) {
    try {
      const r = await pool.query(
        `SELECT correlation_id, computed_at, overall_score, overall_confidence,
                authority_stage, shadow_mode
           FROM contextual_scoring_profiles
          WHERE user_id = $1
          ORDER BY computed_at DESC LIMIT 1`, [userId]);
      const row: any = r.rows[0];
      if (row) contextualScoringAuthoritySnapshot = {
        last_correlation_id: row.correlation_id,
        last_computed_at: row.computed_at?.toISOString?.() ?? String(row.computed_at),
        overall_score: row.overall_score == null ? undefined : Number(row.overall_score),
        overall_confidence: row.overall_confidence == null ? undefined : Number(row.overall_confidence),
        authority_stage: row.authority_stage ?? undefined,
        shadow_mode: row.shadow_mode ?? undefined,
      };
    } catch { /* swallow */ }
  }
  let narrativeSummary: UnifiedCompetencyProfile['narrativeSummary'];
  if (isIntelligenceNarrativesEnabled()) {
    try {
      const r = await pool.query(
        `SELECT narrative_kind, MAX(generated_at) AS last_generated_at, COUNT(*)::int AS cnt
           FROM intelligence_narratives
          WHERE user_id = $1
          GROUP BY narrative_kind
          ORDER BY MAX(generated_at) DESC LIMIT 20`, [userId]);
      const rows: any[] = r.rows;
      if (rows.length > 0) {
        const last = rows.reduce((acc, x) => (x.last_generated_at > acc ? x.last_generated_at : acc), rows[0].last_generated_at);
        narrativeSummary = {
          total_recent: rows.reduce((a, x) => a + Number(x.cnt ?? 0), 0),
          kinds: rows.map((x) => String(x.narrative_kind)),
          last_generated_at: last?.toISOString?.() ?? String(last),
        };
      }
    } catch { /* swallow */ }
  }
  let competencyMemorySummary: UnifiedCompetencyProfile['competencyMemorySummary'];
  if (isContinuousCompetencyMemoryEnabled()) {
    try {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS total_observations,
                COUNT(DISTINCT competency_id)::int AS competencies_tracked,
                AVG(NULLIF(growth_velocity, 0))::float AS avg_growth_velocity,
                SUM(CASE WHEN drift_severity = 'high' THEN 1 ELSE 0 END)::int AS high_drift_count,
                MAX(observed_at) AS last_observed_at
           FROM competency_memory_history WHERE user_id = $1`, [userId]);
      const row: any = r.rows[0] ?? {};
      competencyMemorySummary = {
        total_observations: Number(row.total_observations ?? 0),
        competencies_tracked: Number(row.competencies_tracked ?? 0),
        avg_growth_velocity: row.avg_growth_velocity == null ? null : Number(row.avg_growth_velocity),
        high_drift_count: Number(row.high_drift_count ?? 0),
        last_observed_at: row.last_observed_at ? (row.last_observed_at.toISOString?.() ?? String(row.last_observed_at)) : null,
      };
    } catch { /* swallow */ }
  }

  const hasPhase5 = !!(fusionSummary || contextualScoringAuthoritySnapshot || narrativeSummary || competencyMemorySummary);
  const profileVersion = hasPhase5
    ? 5
    : (cognitiveRuntimeProfile || contradictionHistory || adaptiveRuntimeMetadata)
      ? 4
      : (competencyGraphState ? 3 : (roleDnaSnapshot ? 2 : 1));

  return {
    userId,
    profileVersion,
    competencyGraphState,
    propagationMetadata,
    adaptiveBlueprintMetadata,
    cognitiveRuntimeProfile,
    contradictionHistory,
    adaptiveRuntimeMetadata,
    branchingIntelligence,
    fusionSummary,
    contextualScoringAuthoritySnapshot,
    narrativeSummary,
    competencyMemorySummary,
    roleDnaSnapshot,
    competencyTargets,
    contextualRoleIntelligence,
    roleDNA: craProfile ?? undefined,
    competencyGraph: undefined,
    competencies,
    cognitiveProfile: undefined,
    behavioralProfile: undefined,
    confidenceMap,
    benchmarkProfile: undefined,
    readinessProfile: undefined,
    marketSignals: undefined,
    learningVelocity: { trajectory_samples: trajectory.length, recent: trajectory.slice(0, 20) },
    assessmentMemory: { snapshots_count: snapshots.length, latest_at: snapshots[0]?.taken_at ?? null },
    evidenceSignals: [
      ...asArray(sources.craScores?.data).slice(0, 20).map((r: any) => ({ source: 'cra_scores', competencyId: r.competency_code, score: num(r.raw_score), confidence: num(r.confidence) })),
      ...asArray(sources.aiInferred?.data).slice(0, 10).map((r: any) => ({ source: 'ai_inferred', competencyId: r.competency_key, level: num(r.inferred_level), confidence: num(r.confidence) })),
    ],
    orchestrationMetadata: {
      engine_version: UCIP_ENGINE_VERSION,
      computed_at: new Date().toISOString(),
      sources: summariseHealth(sources),
      shadow_mode: opts.shadowMode,
    },
  };
}

/** Best-effort persist. Never throws. */
export async function persistUcip(pool: Pool, profile: UnifiedCompetencyProfile): Promise<{ ok: boolean; error?: string }> {
  try {
    await pool.query(
      `INSERT INTO ucip_profiles
         (user_id, profile_version, role_dna, competency_graph, confidence_map,
          benchmark_profile, readiness_profile, market_signals, learning_velocity,
          assessment_memory, orchestration_metadata, source_health, computed_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb,
               $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, NOW(), NOW())`,
      [
        profile.userId, profile.profileVersion,
        JSON.stringify(profile.roleDNA ?? {}),
        JSON.stringify(profile.competencyGraph ?? {}),
        JSON.stringify(profile.confidenceMap ?? {}),
        JSON.stringify(profile.benchmarkProfile ?? {}),
        JSON.stringify(profile.readinessProfile ?? {}),
        JSON.stringify(profile.marketSignals ?? {}),
        JSON.stringify(profile.learningVelocity ?? {}),
        JSON.stringify(profile.assessmentMemory ?? {}),
        JSON.stringify(profile.orchestrationMetadata ?? {}),
        JSON.stringify(profile.orchestrationMetadata?.sources ?? {}),
      ],
    );

    // Append per-competency rows (best-effort, no throw).
    for (const c of profile.competencies) {
      await pool.query(
        `INSERT INTO ucip_competencies
           (user_id, competency_id, canonical_name, family, domain, source,
            raw_score, normalized_score, confidence, evidence_count, computed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [profile.userId, c.competencyId, c.canonicalName, c.family ?? null, c.domain ?? null,
         c.source ?? null, c.rawScore ?? null, c.normalizedScore ?? null, c.confidence ?? null, c.evidenceCount],
      ).catch(() => { /* swallow */ });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
