/**
 * Competency Propagation Engine — Phase 3.
 *
 * Given a user's evidence/confidence signal change for one competency,
 * propagates derived confidence deltas across the dependency graph using
 * `competency-graph-traversal-engine`. Best-effort persistence; never
 * affects scoring or runtime. Shadow-safe by default.
 */
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { ADAPTIVE_EVENTS, emit } from './adaptive-event-bus';
import {
  loadEdgesForCompetencies, propagateConfidence, type GraphEdge,
} from './competency-graph-traversal-engine';

export const COMPETENCY_PROPAGATION_VERSION = '1.0.0';

export type PropagationInput = {
  userId: string;
  sourceCompetencyId: string;
  confidenceDelta: number;
  evidenceDelta?: number;
};

export type PropagationResult = {
  correlationId: string;
  sourceCompetencyId: string;
  affected: Array<{ competencyId: string; deltaConfidence: number; hops: number }>;
  edgesConsidered: number;
};

async function safeQuery(pool: Pool, sql: string, params: unknown[]): Promise<void> {
  try { await pool.query(sql, params); } catch { /* swallow */ }
}

export async function propagate(
  pool: Pool, input: PropagationInput,
  opts: { shadowMode: boolean; maxHops?: number } = { shadowMode: true },
): Promise<PropagationResult> {
  const corr = randomUUID();
  const start = Date.now();
  const edges: GraphEdge[] = await loadEdgesForCompetencies(pool, [input.sourceCompetencyId]);
  const raw = propagateConfidence(
    { competencyId: input.sourceCompetencyId, delta: input.confidenceDelta },
    edges, { maxHops: opts.maxHops ?? 3 },
  );
  // Normalise pure-function output `{ delta }` to engine-public `{ deltaConfidence }`.
  const affected = raw.map((a) => ({ competencyId: a.competencyId, deltaConfidence: a.delta, hops: a.hops }));

  // Best-effort persist (audit only — never touches user_competency_scores).
  for (const a of affected) {
    await safeQuery(pool,
      `INSERT INTO competency_propagation_logs
         (user_id, source_id, affected_id, delta_confidence, delta_evidence, hops,
          correlation_id, shadow_mode, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [input.userId, input.sourceCompetencyId, a.competencyId, a.deltaConfidence,
       input.evidenceDelta ?? null, a.hops, corr, opts.shadowMode,
       JSON.stringify({ source_delta: input.confidenceDelta })],
    );
  }

  await safeQuery(pool,
    `INSERT INTO competency_graph_execution_logs
       (user_id, operation, status, hops, nodes_visited, duration_ms,
        correlation_id, shadow_mode, metadata)
     VALUES ($1,'propagate','success',$2,$3,$4,$5,$6,$7::jsonb)`,
    [input.userId, opts.maxHops ?? 3, affected.length, Date.now() - start, corr,
     opts.shadowMode, JSON.stringify({ source: input.sourceCompetencyId, edges: edges.length })],
  );

  emit({ event_type: ADAPTIVE_EVENTS.COMPETENCY_PROPAGATION_COMPLETED, correlation_id: corr,
         payload: { user_id: input.userId, source: input.sourceCompetencyId,
                    affected_count: affected.length } });

  return { correlationId: corr, sourceCompetencyId: input.sourceCompetencyId,
           affected, edgesConsidered: edges.length };
}
