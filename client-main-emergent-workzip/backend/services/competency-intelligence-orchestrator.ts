/**
 * Competency Intelligence Orchestrator V2 — coordinates intelligence
 * lifecycle across all adaptive modules. Pure-orchestration: never
 * modifies source engines; only calls their public APIs and aggregates
 * results into the unified profile + graph.
 */
import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import { ADAPTIVE_EVENTS, emit } from './adaptive-event-bus';
import { buildProfile, persistProfile, type UnifiedProfile } from './competency-intelligence-profile-engine';
import { seedCanonicalCompetencies, snapshotStats, upsertNode, upsertEdge } from './competency-graph-engine-v2';

export const ORCHESTRATOR_VERSION = '4.0.0';

export type StepStatus = 'ok' | 'skipped' | 'failed';
export type StepResult = { step: string; status: StepStatus; duration_ms: number; error?: string; summary?: Record<string, unknown> };
export type OrchestrationOutcome = {
  correlation_id: string;
  operation: string;
  user_id: number;
  status: 'success' | 'partial' | 'failed';
  steps: StepResult[];
  profile?: UnifiedProfile;
  graph_stats?: { nodes: number; edges: number; by_kind: Record<string, number> };
  duration_ms: number;
};

async function runStep<T>(name: string, fn: () => Promise<T>, steps: StepResult[]): Promise<T | null> {
  const start = Date.now();
  try {
    const out = await fn();
    steps.push({ step: name, status: 'ok', duration_ms: Date.now() - start });
    return out;
  } catch (err) {
    steps.push({ step: name, status: 'failed', duration_ms: Date.now() - start, error: (err as Error).message });
    return null;
  }
}

async function runEmitStep(name: string, fn: () => void, steps: StepResult[]): Promise<void> {
  const start = Date.now();
  try { fn(); steps.push({ step: name, status: 'ok', duration_ms: Date.now() - start }); }
  catch (err) { steps.push({ step: name, status: 'failed', duration_ms: Date.now() - start, error: (err as Error).message }); }
}

async function recordExecution(pool: Pool, correlationId: string, steps: StepResult[]): Promise<void> {
  // Best-effort bulk insert; do not throw.
  try {
    await Promise.all(steps.map((s) => pool.query(
      `INSERT INTO intelligence_execution_history (correlation_id, step_name, status, duration_ms, error_message, output_summary)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [correlationId, s.step, s.status, s.duration_ms, s.error ?? null, JSON.stringify(s.summary ?? {})],
    )));
  } catch (err) {
    console.warn('[orchestrator] execution history failed:', (err as Error).message);
  }
}

async function recordOrchestrationLog(pool: Pool, op: string, userId: number, corrId: string, status: string, durationMs: number, outputs: object): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO intelligence_orchestration_logs (operation, user_id, correlation_id, status, duration_ms, outputs, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
      [op, userId, corrId, status, durationMs, JSON.stringify(outputs)],
    );
  } catch (err) {
    console.warn('[orchestrator] log failed:', (err as Error).message);
  }
}

async function recordFailure(pool: Pool, corrId: string, userId: number, step: string, err: Error): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO orchestration_failures (correlation_id, user_id, step_name, error_message, stack_trace)
       VALUES ($1, $2, $3, $4, $5)`,
      [corrId, userId, step, err.message, err.stack ?? null],
    );
  } catch { /* ignore */ }
}

/**
 * Master orchestration entry. Called after assessment completion.
 * Synchronizes intelligence layers via the event bus, rebuilds the
 * unified profile, and refreshes the competency graph.
 */
export async function orchestrateAssessmentCompletion(
  pool: Pool, args: { userId: number; assessmentId?: string; tenantId?: number | null },
): Promise<OrchestrationOutcome> {
  const correlationId = randomUUID();
  const startedAt = Date.now();
  const steps: StepResult[] = [];

  // Step 1 — emit upstream event (wrapped for observability parity)
  await runEmitStep('emit_assessment_completed', () => {
    emit({
      event_type: ADAPTIVE_EVENTS.ASSESSMENT_COMPLETED,
      user_id: args.userId, tenant_id: args.tenantId ?? null,
      payload: { assessment_id: args.assessmentId ?? null }, correlation_id: correlationId,
    });
  }, steps);

  // Step 2 — propagate adaptive updates (fan-out events + refresh-state writes)
  await runStep('propagate_adaptive_updates', async () => {
    await propagateAdaptiveUpdates({ userId: args.userId, tenantId: args.tenantId ?? null, correlationId, pool });
  }, steps);

  // Step 3 — synchronize intelligence layers (read existing engines; do not modify)
  await runStep('synchronize_intelligence_layers', async () => {
    await synchronizeIntelligenceLayers(pool, { userId: args.userId, correlationId });
  }, steps);

  // Step 4 — build unified profile
  const profile = await runStep('build_profile', () => buildProfile(pool, args.userId), steps);

  // Step 5 — persist profile + snapshot
  if (profile) {
    await runStep('persist_profile', () => persistProfile(pool, profile), steps);
  }

  // Step 6 — refresh competency graph (seed canonical nodes if empty; idempotent)
  await runStep('update_competency_graph', () => updateCompetencyGraph(pool), steps);

  const graphStats = await runStep('graph_stats', () => snapshotStats(pool), steps);
  const failed = steps.filter((s) => s.status === 'failed');
  const status: OrchestrationOutcome['status'] =
    failed.length === 0 ? 'success' : failed.length === steps.length ? 'failed' : 'partial';

  const outcome: OrchestrationOutcome = {
    correlation_id: correlationId,
    operation: 'orchestrateAssessmentCompletion',
    user_id: args.userId,
    status,
    steps,
    profile: profile ?? undefined,
    graph_stats: graphStats ?? undefined,
    duration_ms: Date.now() - startedAt,
  };

  // Fire-and-forget persistence
  recordExecution(pool, correlationId, steps).catch(() => {});
  recordOrchestrationLog(pool, 'orchestrateAssessmentCompletion', args.userId, correlationId, status, outcome.duration_ms, { graph_stats: graphStats, step_count: steps.length }).catch(() => {});
  for (const f of failed) recordFailure(pool, correlationId, args.userId, f.step, new Error(f.error ?? 'unknown')).catch(() => {});

  return outcome;
}

/**
 * Map ADAPTIVE_EVENTS event_type → intelligence_target stored in
 * intelligence_refresh_state. Keeps the refresh tracker dimensions stable
 * even if event types evolve.
 */
const EVENT_TO_REFRESH_TARGET: Record<string, string> = {
  [ADAPTIVE_EVENTS.SCORE_UPDATED]:      'score',
  [ADAPTIVE_EVENTS.DNA_RESOLVED]:       'dna',
  [ADAPTIVE_EVENTS.BENCHMARK_UPDATED]:  'benchmark',
  [ADAPTIVE_EVENTS.MOBILITY_UPDATED]:   'mobility',
  [ADAPTIVE_EVENTS.TRAJECTORY_UPDATED]: 'trajectory',
  [ADAPTIVE_EVENTS.COACHING_UPDATED]:   'coaching',
  [ADAPTIVE_EVENTS.WORKFORCE_UPDATED]:  'workforce',
  [ADAPTIVE_EVENTS.SIMULATION_UPDATED]: 'simulation',
};

/**
 * Upsert one refresh-state row per (scope='user', scope_id=userId, target).
 * Best-effort: any DB error logged but never breaks cascade emission.
 */
async function touchRefreshState(
  pool: Pool,
  userId: number | string,
  target: string,
  eventType: string,
  eventId: string | null,
  status: 'ok' | 'degraded' | 'failed' = 'ok',
  latencyMs: number | null = null,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO intelligence_refresh_state
         (scope, scope_id, intelligence_target,
          last_event_type, last_event_id, last_refreshed_at,
          refresh_count, last_status, last_latency_ms, methodology_versions)
       VALUES ('user', $1, $2, $3, $4, NOW(), 1, $5, $6, $7::jsonb)
       ON CONFLICT (scope, scope_id, intelligence_target) DO UPDATE
         SET last_event_type    = EXCLUDED.last_event_type,
             last_event_id      = EXCLUDED.last_event_id,
             last_refreshed_at  = NOW(),
             refresh_count      = intelligence_refresh_state.refresh_count + 1,
             last_status        = EXCLUDED.last_status,
             last_latency_ms    = EXCLUDED.last_latency_ms,
             methodology_versions = EXCLUDED.methodology_versions`,
      [String(userId), target, eventType, eventId, status, latencyMs,
       JSON.stringify({ ORCHESTRATOR_VERSION })],
    );
  } catch (err) {
    console.warn('[orchestrator] refresh_state upsert failed:', (err as Error).message);
  }
}

/**
 * Fan-out event emission. Each existing engine's downstream listener is
 * responsible for refreshing its own caches. If no listener is registered
 * (typical at boot), the events still log to adaptive_intelligence_events.
 *
 * Phase 3 gap-fill: each emit also writes intelligence_refresh_state so the
 * platform can answer "when was this user's <target> intelligence last
 * refreshed?" — backs staleness gating and cascade observability.
 */
export async function propagateAdaptiveUpdates(
  args: { userId: number; tenantId?: number | null; correlationId?: string; pool?: Pool },
): Promise<void> {
  const base = { user_id: args.userId, tenant_id: args.tenantId ?? null, correlation_id: args.correlationId };
  const events = [
    ADAPTIVE_EVENTS.SCORE_UPDATED,      ADAPTIVE_EVENTS.DNA_RESOLVED,
    ADAPTIVE_EVENTS.BENCHMARK_UPDATED,  ADAPTIVE_EVENTS.MOBILITY_UPDATED,
    ADAPTIVE_EVENTS.TRAJECTORY_UPDATED, ADAPTIVE_EVENTS.COACHING_UPDATED,
    ADAPTIVE_EVENTS.WORKFORCE_UPDATED,  ADAPTIVE_EVENTS.SIMULATION_UPDATED,
  ];
  for (const ev of events) {
    const eventId = emit({ ...base, event_type: ev, payload: {} });
    if (args.pool) {
      const target = EVENT_TO_REFRESH_TARGET[ev];
      if (target) await touchRefreshState(args.pool, args.userId, target, ev, eventId);
    }
  }
}

/**
 * Career OS cross-module propagation matrix. A write in one module marks the
 * dependent intelligence targets stale via intelligence_refresh_state, so the
 * existing read-time engines (EI / Fitment / Visibility / Readiness / Velocity
 * / Employability) recompute against fresh inputs. This is the single source of
 * truth for "module X affects targets Y" — kept here so the bus stays generic.
 *
 * Assessment already propagates through orchestrateAssessmentCompletion → its
 * own score/dna/benchmark cascade; it is intentionally NOT duplicated here.
 */
export const MODULE_PROPAGATION: Record<string, readonly string[]> = {
  [ADAPTIVE_EVENTS.PROJECT_UPDATED]:     ['fitment', 'visibility', 'employability'],
  [ADAPTIVE_EVENTS.APPLICATION_UPDATED]: ['visibility', 'readiness', 'velocity'],
  [ADAPTIVE_EVENTS.GOAL_UPDATED]:        ['actions', 'progress'],
};

/**
 * Connect a previously-isolated module write to the adaptive bus. Emits the
 * source event (persisted to adaptive_intelligence_events) and stamps each
 * dependent target in intelligence_refresh_state. Best-effort and idempotent —
 * never throws, so it is safe to fire-and-forget from a route handler after the
 * primary write has already succeeded.
 */
export async function propagateModuleUpdate(
  args: {
    source: typeof ADAPTIVE_EVENTS.PROJECT_UPDATED
          | typeof ADAPTIVE_EVENTS.APPLICATION_UPDATED
          | typeof ADAPTIVE_EVENTS.GOAL_UPDATED;
    userId: number | string;
    tenantId?: number | null;
    correlationId?: string;
    pool?: Pool;
    payload?: Record<string, unknown>;
  },
): Promise<string> {
  const targets = MODULE_PROPAGATION[args.source] ?? [];
  // adaptive_intelligence_events.user_id is BIGINT — only attach a numeric id.
  // Career-seeker users are varchar UUIDs, so persist NULL there and carry the
  // raw id in the payload (user_ref) for traceability rather than corrupt the
  // column with NaN.
  const numericUserId =
    typeof args.userId === 'number'
      ? (Number.isFinite(args.userId) ? args.userId : null)
      : String(args.userId).trim() !== '' && Number.isFinite(Number(args.userId))
        ? Number(args.userId)
        : null;
  const eventId = emit({
    event_type: args.source,
    user_id: numericUserId,
    tenant_id: args.tenantId ?? null,
    correlation_id: args.correlationId,
    payload: { targets, user_ref: String(args.userId), ...(args.payload ?? {}) },
  });
  // intelligence_refresh_state.scope_id is TEXT — works for numeric AND UUID ids.
  const hasUser = args.userId != null && String(args.userId).trim() !== '';
  if (args.pool && hasUser) {
    for (const target of targets) {
      await touchRefreshState(args.pool, args.userId, target, args.source, eventId);
    }
  }
  return eventId;
}

/**
 * Touches adaptive_runtime_state with a synchronization stamp. The actual
 * work each engine does in response to events is owned by that engine;
 * the orchestrator does not reach into engine internals.
 */
/**
 * Touches adaptive_runtime_state. Throws on real DB errors so the
 * orchestrator records the failure accurately (status 'partial'/'failed').
 */
export async function synchronizeIntelligenceLayers(
  pool: Pool, args: { userId: number; correlationId?: string },
): Promise<void> {
  await pool.query(
    `INSERT INTO adaptive_runtime_state (user_id, runtime_state, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET runtime_state = adaptive_runtime_state.runtime_state || EXCLUDED.runtime_state, updated_at = NOW()`,
    [args.userId, JSON.stringify({ last_sync_correlation_id: args.correlationId ?? null, last_sync_at: new Date().toISOString() })],
  );
}

/**
 * Ensures the canonical 7-domain competency nodes exist. Returns stats.
 * Additional role/pathway nodes are added lazily as orchestration runs.
 */
export async function updateCompetencyGraph(pool: Pool): Promise<{ seeded: number; stats: Awaited<ReturnType<typeof snapshotStats>> }> {
  const seeded = await seedCanonicalCompetencies(pool);
  const stats = await snapshotStats(pool);
  return { seeded, stats };
}

export { buildProfile as buildIntelligenceProfile, upsertNode as upsertGraphNode, upsertEdge as upsertGraphEdge };
