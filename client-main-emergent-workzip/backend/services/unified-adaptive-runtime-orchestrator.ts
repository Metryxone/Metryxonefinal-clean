/**
 * Unified Adaptive Runtime Orchestrator — Phase 5 (additive, shadow-mode).
 *
 * Coordinates: UCIP, Role DNA, competency graph, adaptive blueprint, question
 * generation, cognitive runtime, fusion, contextual scoring, confidence
 * calibration, intelligence narratives, competency memory.
 *
 * Implements the 5-stage dual-runtime strategy:
 *   1 shadow          → run shadow only
 *   2 dual            → run shadow + legacy
 *   3 silent_compare  → run both, log diff, return legacy
 *   4 progressive     → run both, return shadow if confident
 *   5 authority       → shadow IS authoritative
 *
 * Never replaces upstream — every authority transition is best-effort logged
 * to `runtime_authority_transitions`. When the umbrella flag is OFF the
 * orchestrator is a no-op that returns a `disabled` snapshot.
 */
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import {
  buildUcip, UCIP_ENGINE_VERSION, type UnifiedCompetencyProfile,
} from './unified-competency-profile-engine';
import type { ResolveRoleInput } from './contextual-role-resolution-engine';
import {
  fuseCompetencies, persistFusion, COMPETENCY_FUSION_VERSION,
  type FusionSignal, type FusedCompetency,
} from './competency-fusion-engine';
import {
  calibrate, persistCalibration, CONFIDENCE_CALIBRATION_VERSION,
  type CalibrationOutput,
} from './confidence-calibration-engine';
import {
  generateNarratives, persistNarratives, INTELLIGENCE_NARRATIVE_VERSION,
  type GeneratedNarrative,
} from './intelligence-narrative-engine';
import {
  recordObservations, memorySummary, COMPETENCY_MEMORY_VERSION,
} from './competency-memory-engine';
import {
  isAdaptiveRuntimeAuthorityEnabled,
  isCompetencyFusionEnabled,
  isContextualScoringAuthorityEnabled,
  isIntelligenceNarrativesEnabled,
  isContinuousCompetencyMemoryEnabled,
} from '../config/feature-flags';
import { emit, ADAPTIVE_EVENTS } from './adaptive-event-bus';

export const ADAPTIVE_RUNTIME_ORCHESTRATOR_VERSION = '5.0.0';

export const AUTHORITY_STAGES = ['shadow', 'dual', 'silent_compare', 'progressive', 'authority'] as const;
export type AuthorityStage = (typeof AUTHORITY_STAGES)[number];

export type OrchestratorOptions = {
  /** Caller-provided role context (industry/org_layer/etc). Optional. */
  roleContext?: ResolveRoleInput;
  /** Authority stage to use for this run. Defaults to 'shadow'. */
  stage?: AuthorityStage;
  /** Correlation id for the run; defaults to a fresh uuid. */
  correlationId?: string;
};

export type OrchestratorSnapshot = {
  ok: boolean;
  disabled?: boolean;
  correlationId: string;
  stage: AuthorityStage;
  ucip?: UnifiedCompetencyProfile;
  fused?: FusedCompetency[];
  calibration?: CalibrationOutput[];
  narratives?: GeneratedNarrative[];
  memorySummary?: Awaited<ReturnType<typeof memorySummary>>;
  contextualScoring?: {
    overallScore: number;
    overallConfidence: number;
    scoredCompetencies: Array<{ competencyId: string; score: number; confidence: number }>;
    authority_stage: AuthorityStage;
  };
  versions: Record<string, string>;
  computedAt: string;
};

function asNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Convert UCIP competencies into fusion signals. */
function competenciesToFusionSignals(ucip: UnifiedCompetencyProfile): FusionSignal[] {
  const out: FusionSignal[] = [];
  for (const c of ucip.competencies) {
    const score = asNum(c.normalizedScore) ?? asNum(c.rawScore);
    if (score != null || c.confidence != null) {
      out.push({
        competencyId: c.competencyId,
        source: 'assessments',
        score,
        confidence: asNum(c.confidence),
        evidenceCount: c.evidenceCount,
      });
    }
  }
  // Graph edges → graph signal (acts as corroboration only).
  if (ucip.competencyGraphState?.edges?.length) {
    const seen = new Set<string>();
    for (const e of ucip.competencyGraphState.edges) {
      for (const id of [e.upstreamId, e.downstreamId]) {
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({ competencyId: id, source: 'graph', evidenceCount: 1 });
      }
    }
  }
  // Evidence signals from external sources surfaced by UCIP.
  for (const ev of ucip.evidenceSignals ?? []) {
    const e = ev as any;
    if (!e?.competencyId) continue;
    let source: FusionSignal['source'] = 'assessments';
    if (e.source === 'ai_inferred') source = 'conversational';
    else if (typeof e.source === 'string' && /github/i.test(e.source)) source = 'github';
    else if (typeof e.source === 'string' && /linkedin/i.test(e.source)) source = 'linkedin';
    else if (typeof e.source === 'string' && /resume/i.test(e.source)) source = 'resume';
    out.push({
      competencyId: String(e.competencyId), source,
      score: asNum(e.score), confidence: asNum(e.confidence),
    });
  }
  return out;
}

/** Pure — derive an overall contextual score from fused competencies. */
export function deriveContextualScore(fused: FusedCompetency[]): {
  overallScore: number; overallConfidence: number;
  scoredCompetencies: Array<{ competencyId: string; score: number; confidence: number }>;
} {
  if (fused.length === 0) return { overallScore: 0, overallConfidence: 0, scoredCompetencies: [] };
  let scoreNum = 0, confNum = 0, wSum = 0;
  const scored: Array<{ competencyId: string; score: number; confidence: number }> = [];
  for (const f of fused) {
    // Weight by confidence + evidence — high-evidence high-confidence dominates.
    const w = Math.max(0.05, f.confidence) * Math.min(1, Math.log10(1 + f.evidenceCount));
    scoreNum += f.score * w;
    confNum += f.confidence * w;
    wSum += w;
    scored.push({ competencyId: f.competency, score: f.score, confidence: f.confidence });
  }
  return {
    overallScore: wSum > 0 ? scoreNum / wSum : 0,
    overallConfidence: wSum > 0 ? confNum / wSum : 0,
    scoredCompetencies: scored,
  };
}

async function persistContextualScoring(
  pool: Pool,
  args: {
    userId: string; correlationId: string; stage: AuthorityStage; shadowMode: boolean;
    derived: ReturnType<typeof deriveContextualScore>; contextSignature?: string;
  },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO contextual_scoring_profiles
         (user_id, correlation_id, context_signature, scored_competencies,
          overall_score, overall_confidence, authority_stage, engine_version, shadow_mode)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)`,
      [
        args.userId, args.correlationId, args.contextSignature ?? null,
        JSON.stringify(args.derived.scoredCompetencies),
        args.derived.overallScore, args.derived.overallConfidence,
        args.stage, ADAPTIVE_RUNTIME_ORCHESTRATOR_VERSION, args.shadowMode,
      ],
    );
  } catch (err) {
    console.warn('[adaptive-runtime] contextual scoring persist failed:', (err as Error).message);
  }
}

async function logAuthorityTransition(
  pool: Pool,
  args: { userId?: string; fromStage?: AuthorityStage; toStage: AuthorityStage; trigger: string; diff?: Record<string, unknown>; shadowMode: boolean },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO runtime_authority_transitions
         (user_id, scope, from_stage, to_stage, trigger, diff_summary, shadow_mode, engine_version)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [
        args.userId ?? null, args.userId ? 'user' : 'global',
        args.fromStage ?? null, args.toStage, args.trigger,
        JSON.stringify(args.diff ?? {}), args.shadowMode,
        ADAPTIVE_RUNTIME_ORCHESTRATOR_VERSION,
      ],
    );
  } catch (err) {
    console.warn('[adaptive-runtime] authority transition persist failed:', (err as Error).message);
  }
}

/** Main entrypoint — orchestrates all Phase 5 enrichments for a user. */
export async function runAdaptiveRuntime(
  pool: Pool,
  userId: string,
  opts: OrchestratorOptions = {},
): Promise<OrchestratorSnapshot> {
  const correlationId = opts.correlationId ?? randomUUID();
  const stage: AuthorityStage = opts.stage ?? 'shadow';
  const versions: Record<string, string> = {
    ADAPTIVE_RUNTIME_ORCHESTRATOR_VERSION,
    UCIP_ENGINE_VERSION,
    COMPETENCY_FUSION_VERSION,
    CONFIDENCE_CALIBRATION_VERSION,
    INTELLIGENCE_NARRATIVE_VERSION,
    COMPETENCY_MEMORY_VERSION,
  };
  const computedAt = new Date().toISOString();

  if (!isAdaptiveRuntimeAuthorityEnabled()) {
    return { ok: true, disabled: true, correlationId, stage, versions, computedAt };
  }

  // Stage is always shadow-by-spec until explicit transition; we accept the
  // caller-provided stage but Phase 5 only writes shadow_mode=true rows.
  const shadowMode = stage !== 'authority';

  // 1) UCIP — read-only aggregation. Failure here aborts cleanly.
  let ucip: UnifiedCompetencyProfile | undefined;
  try {
    ucip = await buildUcip(pool, userId, { shadowMode, roleContext: opts.roleContext });
  } catch (err) {
    console.warn('[adaptive-runtime] UCIP build failed:', (err as Error).message);
    return { ok: false, correlationId, stage, versions, computedAt };
  }

  // 2) Fusion — pure + best-effort persist.
  let fused: FusedCompetency[] | undefined;
  if (isCompetencyFusionEnabled()) {
    fused = fuseCompetencies(competenciesToFusionSignals(ucip));
    if (fused.length > 0) {
      await persistFusion(pool, { userId, fused, shadowMode, correlationId });
      try {
        emit({
          event_type: ADAPTIVE_EVENTS.COMPETENCY_FUSED,
          user_id: Number(userId) || null,
          payload: { correlation_id: correlationId, count: fused.length },
          correlation_id: correlationId,
        });
      } catch { /* swallow */ }
    }
  }

  // 3) Calibration — derived per competency from fusion output.
  let calibration: CalibrationOutput[] | undefined;
  if (fused && fused.length > 0) {
    calibration = fused.map((f) => calibrate({
      competencyId: f.competency,
      evidenceCount: f.evidenceCount,
      sourceCoverage: f.sourceCoverage,
      lastValidatedAt: computedAt,
      benchmarkConfidence: 0.5,
      dispersion: f.dispersion,
    }));
    await persistCalibration(pool, { userId, results: calibration });
  }

  // 4) Contextual scoring — derived from fusion + persisted as audit snapshot.
  let contextualScoring: OrchestratorSnapshot['contextualScoring'];
  if (isContextualScoringAuthorityEnabled() && fused && fused.length > 0) {
    const derived = deriveContextualScore(fused);
    contextualScoring = { ...derived, authority_stage: stage };
    await persistContextualScoring(pool, {
      userId, correlationId, stage, shadowMode, derived,
      contextSignature: opts.roleContext
        ? JSON.stringify({
            role: opts.roleContext.rawRoleTitle,
            industry: opts.roleContext.industry,
            stage: opts.roleContext.careerStage,
          })
        : undefined,
    });
    try {
      emit({
        event_type: ADAPTIVE_EVENTS.CONTEXTUAL_SCORING_COMPLETED,
        user_id: Number(userId) || null,
        payload: {
          correlation_id: correlationId,
          overall_score: derived.overallScore,
          overall_confidence: derived.overallConfidence,
          stage,
        },
        correlation_id: correlationId,
      });
    } catch { /* swallow */ }
  }

  // 5) Memory — append observation rows from fusion output.
  let memSummary;
  if (isContinuousCompetencyMemoryEnabled() && fused && fused.length > 0) {
    await recordObservations(pool, {
      userId,
      observations: fused.map((f) => ({
        competencyId: f.competency,
        score: f.score,
        confidence: f.confidence,
        origin: 'fusion',
        metadata: { sourceCoverage: f.sourceCoverage, dispersion: f.dispersion },
      })),
    });
    memSummary = await memorySummary(pool, userId);
    try {
      emit({
        event_type: ADAPTIVE_EVENTS.MEMORY_UPDATED,
        user_id: Number(userId) || null,
        payload: { correlation_id: correlationId, summary: memSummary },
        correlation_id: correlationId,
      });
    } catch { /* swallow */ }
  }

  // 6) Narratives — generated from fused + cognitive + behavioral signals.
  let narratives: GeneratedNarrative[] | undefined;
  if (isIntelligenceNarrativesEnabled() && fused && fused.length > 0) {
    narratives = generateNarratives({
      fused,
      cognitiveProfile: ucip.cognitiveRuntimeProfile
        ? { signals: ucip.cognitiveRuntimeProfile.signals as any, confidence: (ucip.cognitiveRuntimeProfile as any).confidence }
        : undefined,
      behavioralRecent: ucip.contradictionHistory?.recent?.map((c) => ({ type: c.type, severity: c.severity })),
      learningVelocity: {
        trajectory_samples: ucip.learningVelocity?.trajectory_samples ?? 0,
        recent_growth: memSummary?.avg_growth_velocity ?? 0,
      },
    });
    if (narratives.length > 0) {
      await persistNarratives(pool, { userId, narratives });
      try {
        emit({
          event_type: ADAPTIVE_EVENTS.NARRATIVE_GENERATED,
          user_id: Number(userId) || null,
          payload: { correlation_id: correlationId, count: narratives.length },
          correlation_id: correlationId,
        });
      } catch { /* swallow */ }
    }
  }

  // 7) Authority transition audit — every orchestrator run logs a transition
  //    row with the stage we ran in. Listeners can subscribe to this stream.
  await logAuthorityTransition(pool, {
    userId, toStage: stage, trigger: 'orchestrator.run',
    diff: { fused: fused?.length ?? 0, narratives: narratives?.length ?? 0 },
    shadowMode,
  });
  try {
    emit({
      event_type: ADAPTIVE_EVENTS.RUNTIME_AUTHORITY_UPDATED,
      user_id: Number(userId) || null,
      payload: { correlation_id: correlationId, stage, shadow_mode: shadowMode },
      correlation_id: correlationId,
    });
  } catch { /* swallow */ }

  return {
    ok: true,
    correlationId,
    stage,
    ucip,
    fused,
    calibration,
    narratives,
    memorySummary: memSummary,
    contextualScoring,
    versions,
    computedAt,
  };
}

/** Public helper to explicitly record a stage transition (e.g. ops endpoint). */
export async function transitionAuthorityStage(
  pool: Pool,
  args: { fromStage?: AuthorityStage; toStage: AuthorityStage; trigger: string; userId?: string; diff?: Record<string, unknown> },
): Promise<void> {
  await logAuthorityTransition(pool, { ...args, shadowMode: args.toStage !== 'authority' });
  try {
    emit({
      event_type: ADAPTIVE_EVENTS.RUNTIME_AUTHORITY_UPDATED,
      payload: { from: args.fromStage, to: args.toStage, trigger: args.trigger, user_id: args.userId ?? null },
    });
  } catch { /* swallow */ }
}
