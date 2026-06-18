/**
 * CAPADEX PIL — Phase 6A: Runtime Intelligence Pipeline (read-only resolver).
 *
 *   For one assessed session, walks the full forward intelligence chain and
 *   returns it as a single ordered lineage (8 nodes / 7 hops):
 *
 *     Response → Signal → Concern → Capability → Problem → Behavior
 *              → Archetype → Intervention
 *
 *   This is a COMPOSER, not a new engine. The back half (concern → archetype →
 *   problems → behaviours → interventions / action plan) is already produced,
 *   read-only, by `runtime-guidance-engine.ts buildGuidanceForSession`. Phase 6A
 *   adds the FRONT half — the activated signals captured for the session and the
 *   capability/problem framing of its concern — and stitches every hop into one
 *   explainable lineage.
 *
 * CANON (strict, identical to Phase 6):
 *   - ADDITIVE & READ-ONLY: no writes, no recompute, no AI, no new content. Every
 *     value returned was authored/derived by an existing engine and persisted; this
 *     module only SELECTs, composes, and orders it for one session.
 *   - DETERMINISTIC: same session → same lineage (rows ordered + capped).
 *   - GRACEFUL DEGRADATION: each hop carries its own `resolved` flag; a hop that
 *     cannot be resolved comes back empty (never fabricated, never mis-routed) and
 *     the lineage is marked `degraded`. NEVER throws.
 *
 * The flag gate + HTTP surface live in the route; this module is the engine.
 */
import type { Pool } from 'pg';
import {
  buildGuidanceForSession,
  type GuidanceBundle,
  type ConcernResolution,
  type Stakeholder,
} from './runtime-guidance-engine';
import { classifyTypeSemantic } from './concern-ontology-engine';

// ── Read-only row shapes ─────────────────────────────────────────────────────
export interface PipelineSignal {
  signal_key: string;
  signal_type: string;
  lifecycle_state: string | null;
  severity: string | null;
  strength: number | null;
  confidence: number | null;
  evidence_count: number | null;
  description: string | null;
}

export interface ConcernMeta {
  concern_id: string;
  domain: string | null;
  concern_cluster: string | null;
  display_label: string | null;
}

export interface CapabilityProblem {
  capability_name: string | null;
  problem_name: string | null;
  confidence_score: number | null;
  mapping_reason: string | null;
}

// ── Hop / lineage shapes ─────────────────────────────────────────────────────
export type HopKey =
  | 'response_to_signal'
  | 'signal_to_concern'
  | 'concern_to_capability'
  | 'capability_to_problem'
  | 'problem_to_behavior'
  | 'behavior_to_archetype'
  | 'archetype_to_intervention';

export interface PipelineHop {
  step: number;          // 1..7
  key: HopKey;
  label: string;         // e.g. 'Response → Signal'
  resolved: boolean;     // did this hop produce content?
  summary: string;       // short, honest human note (no fabrication)
  data: unknown;         // hop-specific payload (already-authored values)
}

export interface PipelineResult {
  enabled: boolean;
  degraded: boolean;
  reason: string | null;
  session_id: string;
  generated_at: string;
  stakeholder: Stakeholder;
  resolution: ConcernResolution;
  hops: PipelineHop[];
}

// Caps keep the payload deterministic + bounded (mirrors guidance-engine style).
const SIGNAL_CAP = 8;

// ── Read-only loaders ────────────────────────────────────────────────────────

/** Activated signals captured for the session (Response → Signal output). */
async function loadSessionSignals(pool: Pool, sessionId: string): Promise<PipelineSignal[]> {
  const { rows } = await pool.query(
    `SELECT signal_key, signal_type, lifecycle_state, severity,
            strength, confidence, evidence_count, description
       FROM capadex_session_signals
      WHERE session_id = $1 AND lifecycle_state IS NOT NULL
      ORDER BY (lifecycle_state = 'dominant') DESC,
               strength DESC NULLS LAST,
               confidence DESC NULLS LAST,
               signal_key ASC`,
    [sessionId],
  );
  return rows.map((r) => ({
    signal_key: String(r.signal_key),
    signal_type: String(r.signal_type),
    lifecycle_state: r.lifecycle_state ?? null,
    severity: r.severity ?? null,
    strength: r.strength != null ? Number(r.strength) : null,
    confidence: r.confidence != null ? Number(r.confidence) : null,
    evidence_count: r.evidence_count != null ? Number(r.evidence_count) : null,
    description: r.description ?? null,
  }));
}

/** Concern metadata (domain / cluster / display label) for the resolved concern. */
async function loadConcernMeta(pool: Pool, concernId: string): Promise<ConcernMeta | null> {
  const { rows } = await pool.query(
    `SELECT concern_id, domain, concern_cluster, display_label
       FROM capadex_concerns_master
      WHERE concern_id = $1
      ORDER BY id ASC
      LIMIT 1`,
    [concernId],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    concern_id: String(r.concern_id),
    domain: r.domain ?? null,
    concern_cluster: r.concern_cluster ?? null,
    display_label: r.display_label ?? null,
  };
}

/**
 * Capability ↔ Problem framing for the concern. In `capability_problem_map` the
 * capability and problem framings of a single concern live in the SAME row
 * (capability_concern_id == problem_concern_id), so one lookup gives both.
 */
async function loadCapabilityProblem(pool: Pool, concernId: string): Promise<CapabilityProblem | null> {
  const { rows } = await pool.query(
    `SELECT capability_name, problem_name, confidence_score, mapping_reason
       FROM capability_problem_map
      WHERE capability_concern_id = $1 OR problem_concern_id = $1
      ORDER BY confidence_score DESC NULLS LAST, mapping_id ASC
      LIMIT 1`,
    [concernId],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    capability_name: r.capability_name ?? null,
    problem_name: r.problem_name ?? null,
    confidence_score: r.confidence_score != null ? Number(r.confidence_score) : null,
    mapping_reason: r.mapping_reason ?? null,
  };
}

// ── Pure assembler (fully testable, no DB) ───────────────────────────────────

/**
 * Build the ordered 7-hop lineage from already-loaded inputs. PURE & deterministic.
 * Each hop reports `resolved` honestly; nothing is fabricated when an input is empty.
 */
export function assemblePipeline(args: {
  sessionId: string;
  stakeholder: Stakeholder;
  resolution: ConcernResolution;
  signals: PipelineSignal[];
  concernMeta: ConcernMeta | null;
  concernName: string | null;
  capabilityProblem: CapabilityProblem | null;
  guidance: GuidanceBundle;
  generatedAt?: string;
}): PipelineResult {
  const {
    sessionId, stakeholder, resolution, signals, concernMeta,
    concernName, capabilityProblem, guidance,
  } = args;

  const signalsCapped = signals.slice(0, SIGNAL_CAP);
  const concernId = resolution.concern_id;
  const concernLabel = concernMeta?.display_label || concernName || null;

  // Capability/Problem semantic class of the concern label (read-only classifier).
  const typeResult = concernLabel ? classifyTypeSemantic(concernLabel) : null;

  const behaviours = guidance.behaviours ?? [];
  const archetype = guidance.archetype;
  const interventions = guidance.interventions ?? [];
  const actionPlan = guidance.action_plan ?? null;

  const hops: PipelineHop[] = [];

  // 1. Response → Signal
  hops.push({
    step: 1,
    key: 'response_to_signal',
    label: 'Response → Signal',
    resolved: signalsCapped.length > 0,
    summary: signalsCapped.length
      ? `${signals.length} behavioural signal${signals.length === 1 ? '' : 's'} activated from the responses`
      : 'No signals were activated for this session',
    data: { signals: signalsCapped, total: signals.length },
  });

  // 2. Signal → Concern
  hops.push({
    step: 2,
    key: 'signal_to_concern',
    label: 'Signal → Concern',
    resolved: !!concernId,
    summary: concernId
      ? `Signals point to "${concernLabel ?? concernId}"`
      : 'Could not resolve a concern from the signals',
    data: concernId
      ? {
          concern_id: concernId,
          concern_label: concernLabel,
          domain: concernMeta?.domain ?? null,
          concern_cluster: concernMeta?.concern_cluster ?? null,
          supporting_signal_count: signals.length,
          method: resolution.method,
          confidence: resolution.confidence,
        }
      : null,
  });

  // 3. Concern → Capability
  const capabilityName = capabilityProblem?.capability_name ?? null;
  hops.push({
    step: 3,
    key: 'concern_to_capability',
    label: 'Concern → Capability',
    resolved: !!capabilityName,
    summary: capabilityName
      ? `Underlying capability: "${capabilityName}"`
      : 'No mapped capability for this concern',
    data: capabilityName
      ? {
          capability_name: capabilityName,
          semantic_type: typeResult?.type ?? null,
          confidence: capabilityProblem?.confidence_score ?? null,
        }
      : null,
  });

  // 4. Capability → Problem
  const problemName = capabilityProblem?.problem_name ?? null;
  hops.push({
    step: 4,
    key: 'capability_to_problem',
    label: 'Capability → Problem',
    resolved: !!problemName,
    summary: problemName
      ? `Manifests as: "${problemName}"`
      : 'No mapped problem for this capability',
    data: problemName
      ? {
          problem_name: problemName,
          confidence: capabilityProblem?.confidence_score ?? null,
          mapping_reason: capabilityProblem?.mapping_reason ?? null,
        }
      : null,
  });

  // 5. Problem → Behavior
  hops.push({
    step: 5,
    key: 'problem_to_behavior',
    label: 'Problem → Behavior',
    resolved: behaviours.length > 0,
    summary: behaviours.length
      ? `${behaviours.length} observable behaviour${behaviours.length === 1 ? '' : 's'}`
      : 'No mapped behaviours for this concern',
    data: { behaviours },
  });

  // 6. Behavior → Archetype
  hops.push({
    step: 6,
    key: 'behavior_to_archetype',
    label: 'Behavior → Archetype',
    resolved: !!archetype,
    summary: archetype
      ? `Behavioural archetype: "${archetype.name ?? archetype.key}"`
      : 'Could not resolve a behavioural archetype',
    data: archetype
      ? { archetype_key: archetype.key, archetype_name: archetype.name }
      : null,
  });

  // 7. Archetype → Intervention
  const hasInterventions = interventions.length > 0 || !!actionPlan;
  hops.push({
    step: 7,
    key: 'archetype_to_intervention',
    label: 'Archetype → Intervention',
    resolved: hasInterventions,
    summary: hasInterventions
      ? `${interventions.length} intervention${interventions.length === 1 ? '' : 's'}${actionPlan ? ' + action plan' : ''}`
      : 'No mapped interventions for this archetype',
    data: { interventions, action_plan: actionPlan },
  });

  // The lineage is degraded if ANY hop in the forward chain failed to resolve
  // (a structurally incomplete chain is degraded — including missing middle hops
  // like Concern→Capability), if no concern resolved at all, or if the underlying
  // guidance bundle is itself degraded. We never fabricate to hide a gap.
  const degraded = !concernId || guidance.degraded || hops.some((h) => !h.resolved);
  const reason = !concernId
    ? 'concern_not_resolved'
    : guidance.reason ?? (degraded ? 'partial_chain' : null);

  return {
    enabled: true,
    degraded,
    reason,
    session_id: sessionId,
    generated_at: args.generatedAt ?? new Date().toISOString(),
    stakeholder,
    resolution,
    hops,
  };
}

// ── Orchestrator: session → full pipeline lineage (read-only, never throws) ───

function degradedResult(sessionId: string, reason: string): PipelineResult {
  return {
    enabled: true,
    degraded: true,
    reason,
    session_id: sessionId,
    generated_at: new Date().toISOString(),
    stakeholder: 'student',
    resolution: { concern_id: null, archetype_key: null, archetype_name: null, method: 'none', confidence: 0 },
    hops: [],
  };
}

export async function buildPipelineForSession(pool: Pool, sessionId: string): Promise<PipelineResult> {
  try {
    // Back half (+ resolution + stakeholder) — already read-only and never-throws.
    const guidance = await buildGuidanceForSession(pool, sessionId);
    const concernId = guidance.resolution.concern_id;

    // Pull the session's raw concern_name for labelling when no master row exists.
    const { rows: srows } = await pool.query(
      `SELECT concern_name FROM capadex_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    const concernName = srows.length ? (srows[0].concern_name ?? null) : null;

    const [signals, concernMeta, capabilityProblem] = await Promise.all([
      loadSessionSignals(pool, sessionId),
      concernId ? loadConcernMeta(pool, concernId) : Promise.resolve(null),
      concernId ? loadCapabilityProblem(pool, concernId) : Promise.resolve(null),
    ]);

    return assemblePipeline({
      sessionId,
      stakeholder: guidance.stakeholder,
      resolution: guidance.resolution,
      signals,
      concernMeta,
      concernName,
      capabilityProblem,
      guidance,
    });
  } catch (err) {
    // Honour the never-throw contract at the engine boundary.
    console.warn('[pipeline-resolver] degraded:', err instanceof Error ? err.message : String(err));
    return degradedResult(sessionId, 'engine_error');
  }
}
