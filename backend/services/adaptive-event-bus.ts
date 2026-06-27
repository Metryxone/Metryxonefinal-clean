/**
 * Adaptive Event Bus — in-process event hub with persistence.
 * Listeners are registered once at startup; emit() is fire-and-forget.
 * Persistence to adaptive_intelligence_events is non-blocking.
 */
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { Pool } from 'pg';

export const ADAPTIVE_EVENT_BUS_VERSION = '4.0.0';

export const ADAPTIVE_EVENTS = {
  ASSESSMENT_COMPLETED: 'competency.assessment.completed',
  SCORE_UPDATED:        'competency.score.updated',
  DNA_RESOLVED:         'competency.dna.resolved',
  BENCHMARK_UPDATED:    'benchmark.updated',
  MOBILITY_UPDATED:     'mobility.updated',
  TRAJECTORY_UPDATED:   'trajectory.updated',
  COACHING_UPDATED:     'coaching.updated',
  WORKFORCE_UPDATED:    'workforce.updated',
  SIMULATION_UPDATED:   'simulation.updated',
  // Phase 1 — UCIP foundation. Additive; never affect runtime/scoring/UI.
  UCIP_REBUILD_STARTED:   'ucip.rebuild.started',
  UCIP_REBUILD_COMPLETED: 'ucip.rebuild.completed',
  UCIP_REBUILD_FAILED:    'ucip.rebuild.failed',
  UCIP_PROFILE_UPDATED:   'ucip.profile.updated',
  // Phase 2 — Role DNA Runtime. Additive; never affect runtime/scoring/UI.
  ROLE_DNA_RESOLVED:       'role.dna.resolved',
  ROLE_COMPETENCIES_SEEDED:'role.competencies.seeded',
  ROLE_CONTEXT_UPDATED:    'role.context.updated',
  // Phase 3 — Competency Graph + Adaptive Blueprint. Additive; never affect runtime/scoring/UI.
  COMPETENCY_GRAPH_UPDATED:        'competency.graph.updated',
  COMPETENCY_PROPAGATION_COMPLETED:'competency.propagation.completed',
  ADAPTIVE_BLUEPRINT_GENERATED:    'adaptive.blueprint.generated',
  // Phase 4 — Dynamic Question Generation + Cognitive Runtime. Additive; never affect runtime/scoring/UI.
  QUESTION_GENERATED:        'question.generated',
  BRANCH_EXECUTED:           'branch.executed',
  CONTRADICTION_DETECTED:    'contradiction.detected',
  COGNITIVE_PROFILE_UPDATED: 'cognitive.profile.updated',
  // Phase 5 — Intelligence Fusion + Runtime Authority. Additive; never affect runtime/scoring/UI.
  RUNTIME_AUTHORITY_UPDATED:   'runtime.authority.updated',
  COMPETENCY_FUSED:            'competency.fused',
  CONTEXTUAL_SCORING_COMPLETED:'contextual.scoring.completed',
  NARRATIVE_GENERATED:         'narrative.generated',
  MEMORY_UPDATED:              'memory.updated',
  // Career OS module sync — additive. Emitted by previously-isolated module
  // writes so a single action fans out through this bus to its dependent
  // intelligence targets (see MODULE_PROPAGATION in the orchestrator).
  PROJECT_UPDATED:     'career.project.updated',
  APPLICATION_UPDATED: 'career.application.updated',
  GOAL_UPDATED:        'career.goal.updated',
  // MX-302G — Learning Intelligence ↔ Career Passport loop. Emitted (flag-gated) when a
  // learning/development activity completes, so the passport auto-syncs from platform data.
  LEARNING_ACTIVITY_COMPLETED: 'career.learning.completed',
} as const;

export type AdaptiveEventType = (typeof ADAPTIVE_EVENTS)[keyof typeof ADAPTIVE_EVENTS];

export type AdaptiveEvent = {
  event_type: AdaptiveEventType | string;
  user_id?: number | null;
  tenant_id?: number | null;
  payload?: Record<string, unknown>;
  correlation_id?: string;
};

const emitter = new EventEmitter();
emitter.setMaxListeners(64);

let poolRef: Pool | null = null;

export function initEventBus(pool: Pool): void {
  poolRef = pool;
}

export function on(event: AdaptiveEventType | string, fn: (e: AdaptiveEvent) => void | Promise<void>): void {
  emitter.on(event, (e) => {
    try {
      const result = fn(e);
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch((err) => console.warn(`[event-bus] listener "${event}" failed:`, (err as Error).message));
      }
    } catch (err) {
      console.warn(`[event-bus] listener "${event}" threw:`, (err as Error).message);
    }
  });
}

export function emit(event: AdaptiveEvent): string {
  const corr = event.correlation_id ?? randomUUID();
  const e: AdaptiveEvent = { ...event, correlation_id: corr };
  // Fire listeners synchronously (each listener wraps own errors)
  emitter.emit(event.event_type, e);
  // Persist asynchronously, non-blocking
  if (poolRef) {
    poolRef.query(
      `INSERT INTO adaptive_intelligence_events (event_type, user_id, tenant_id, payload, correlation_id)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [e.event_type, e.user_id ?? null, e.tenant_id ?? null, JSON.stringify(e.payload ?? {}), corr],
    ).catch((err) => console.warn('[event-bus] persist failed:', (err as Error).message));
  }
  return corr;
}

export async function recentEvents(pool: Pool, opts: { userId?: number; limit?: number } = {}) {
  const limit = Math.max(1, Math.min(500, opts.limit ?? 50));
  const params: unknown[] = [limit];
  let where = '';
  if (opts.userId != null) { params.unshift(opts.userId); where = 'WHERE user_id = $1'; }
  const sql = `SELECT id, event_type, user_id, tenant_id, payload, correlation_id, occurred_at
               FROM adaptive_intelligence_events ${where}
               ORDER BY occurred_at DESC LIMIT $${params.length}`;
  const r = await pool.query(sql, params);
  return r.rows;
}
