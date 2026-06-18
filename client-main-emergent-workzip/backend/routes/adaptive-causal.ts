/**
 * Phase 4 — Adaptive Causal Intelligence routes.
 *
 * Endpoints under `/api/adaptive/*`:
 *   GET  /methodology
 *   POST /interventions/event             (auth) — record action/outcome event
 *   POST /interventions/outcome           (auth) — record observed outcome
 *   GET  /interventions/effectiveness     — query effectiveness rollup
 *   POST /interventions/refresh           (auth) — rebuild effectiveness rollup
 *   GET  /transfer/from/:competency_id    — cascade outwards
 *   GET  /transfer/to/:competency_id      — precursors
 *   GET  /transfer/edges                  — raw edges (paginated)
 *   POST /sequence                        — sequence a set of candidate competencies
 *   GET  /recommendations                 — causal-ranked recommendations
 *   GET  /guidance                        (auth) — adaptive guidance snapshot
 *
 * Envelope contract: every response includes `language_policy` and
 * `methodology_versions`. Never throws — handlers wrapped.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import {
  recordEvent, recordOutcome, getEffectiveness, refreshEffectivenessRollup,
  INTERVENTION_LEARNING_VERSION,
} from '../services/intervention-learning-engine.js';
import {
  loadGraph, cascadeFrom, precursorsOf, listEdges, TRANSFER_GRAPH_VERSION,
} from '../services/competency-transfer-graph.js';
import {
  loadDependencies, sequenceCompetencies, DEPENDENCY_SEQUENCER_VERSION, scoreToLevel,
} from '../services/dependency-sequencer.js';
import {
  generateCausalRecommendations, persistRecommendations, buildAdaptiveGuidance,
  CAUSAL_RECOMMENDATION_VERSION,
} from '../services/causal-recommendation-engine.js';
import { demoUserScores } from '../services/adaptive-benchmark.js';

const LANGUAGE_POLICY = Object.freeze({
  allowed: [
    'developmental readiness', 'capability proximity', 'expected lift',
    'confidence band', 'observed delta', 'ROI signal', 'sequenced step',
    'transfer cascade', 'adaptive guidance',
  ],
  disallowed: [
    'hiring prediction', 'guaranteed outcome', 'promotion likelihood',
    'suitable candidate', 'will get hired', 'guaranteed lift',
  ],
});

const METHODOLOGY_VERSIONS = Object.freeze({
  intervention_learning: INTERVENTION_LEARNING_VERSION,
  transfer_graph: TRANSFER_GRAPH_VERSION,
  dependency_sequencer: DEPENDENCY_SEQUENCER_VERSION,
  causal_recommendation: CAUSAL_RECOMMENDATION_VERSION,
});

function withEnvelope<T extends Record<string, unknown>>(payload: T, requestId?: string) {
  return {
    ...payload,
    language_policy: LANGUAGE_POLICY,
    methodology_versions: METHODOLOGY_VERSIONS,
    request_id: requestId ?? randomUUID(),
  };
}

function sessionUserId(req: Request): string | null {
  const u = (req as any).user;
  if (u?.id) return String(u.id);
  if (u?.user_id) return String(u.user_id);
  return null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const isAuthed = (req as any).isAuthenticated?.() === true;
  if (isAuthed && sessionUserId(req)) return next();
  return res.status(401).json(withEnvelope({
    ok: false, error: 'authentication_required',
    detail: 'Session-bound endpoints require an authenticated user.',
  }));
}

function safeAsync(handler: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try { await handler(req, res); }
    catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[adaptive-causal] handler error:', e?.message, e?.stack?.split('\n')[1]);
      if (!res.headersSent) {
        res.status(500).json(withEnvelope({
          ok: false, error: 'adaptive_handler_failed', detail: e?.message ?? 'unknown',
        }));
      }
    }
  };
}

async function auditLog(pool: Pool, args: {
  user_id?: string | null; endpoint: string; status: 'ok' | 'fallback' | 'error';
  request_id?: string; detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO learn_audit_logs (user_id, endpoint, status, request_id, detail)
       VALUES ($1,$2,$3,$4,$5)`,
      [args.user_id ?? null, args.endpoint, args.status,
       args.request_id ?? null, JSON.stringify(args.detail ?? {})],
    );
  } catch { /* never break the response */ }
}

async function resolveScores(pool: Pool, req: Request, userId: string | null): Promise<Record<string, number>> {
  const inline = (req.query.scores ?? req.body?.scores) as unknown;
  if (typeof inline === 'string' && inline.trim().startsWith('{')) {
    try { return JSON.parse(inline); } catch { /* fall through */ }
  }
  if (inline && typeof inline === 'object') return inline as Record<string, number>;
  if (String(req.query.demo) === 'true' || req.body?.demo === true) {
    const { rows } = await pool.query<{ id: string }>(`SELECT id FROM onto_competencies`);
    return demoUserScores(userId ?? 'demo', rows.map(r => r.id));
  }
  return {};
}

// ═══════════════════════════════════════════════════════════════════════════
// Router registration
// ═══════════════════════════════════════════════════════════════════════════

export function registerAdaptiveCausalRoutes(opts: { app: Express; pool: Pool }) {
  const { app, pool } = opts;

  // 1. Methodology
  app.get('/api/adaptive/methodology', safeAsync(async (_req, res) => {
    res.json(withEnvelope({
      ok: true,
      versions: METHODOLOGY_VERSIONS,
      description: 'Adaptive causal intelligence: intervention-learning + transfer-graph + dependency-sequencer + causal ranking',
    }));
  }));

  // 2. Record event (auth)
  app.post('/api/adaptive/interventions/event', requireAuth, safeAsync(async (req, res) => {
    const userId = sessionUserId(req)!;
    const b = req.body ?? {};
    if (!b.intervention_id || !b.event_type) {
      return res.status(400).json(withEnvelope({ ok: false, error: 'invalid_request',
        detail: 'intervention_id and event_type are required' }));
    }
    const row = await recordEvent(pool, {
      user_id: userId, intervention_id: String(b.intervention_id),
      event_type: b.event_type, recommendation_id: b.recommendation_id ?? null,
      profile_segment: b.profile_segment ?? 'global', context: b.context ?? {},
    });
    auditLog(pool, { user_id: userId, endpoint: 'interventions/event', status: 'ok',
      detail: { intervention_id: b.intervention_id, event_type: b.event_type } });
    res.json(withEnvelope({ ok: true, event_id: Number(row.id) }));
  }));

  // 3. Record outcome (auth)
  app.post('/api/adaptive/interventions/outcome', requireAuth, safeAsync(async (req, res) => {
    const userId = sessionUserId(req)!;
    const b = req.body ?? {};
    if (!b.intervention_id) {
      return res.status(400).json(withEnvelope({ ok: false, error: 'invalid_request',
        detail: 'intervention_id is required' }));
    }
    const row = await recordOutcome(pool, {
      user_id: userId, intervention_id: String(b.intervention_id),
      competency_id: b.competency_id ?? null,
      baseline_score: b.baseline_score ?? null, followup_score: b.followup_score ?? null,
      competency_delta: b.competency_delta ?? null, ei_delta: b.ei_delta ?? null,
      trajectory_shift: b.trajectory_shift, effort_hours_observed: b.effort_hours_observed ?? null,
      baseline_at: b.baseline_at ?? null, measured_at: b.measured_at ?? null,
      evidence_source: b.evidence_source ?? 'self_report',
      profile_segment: b.profile_segment ?? 'global',
      context: b.context ?? {},
    });
    auditLog(pool, { user_id: userId, endpoint: 'interventions/outcome', status: 'ok',
      detail: { intervention_id: b.intervention_id, delta: b.competency_delta } });
    res.json(withEnvelope({ ok: true, outcome_id: Number(row.id) }));
  }));

  // 4. Effectiveness query (public read)
  app.get('/api/adaptive/interventions/effectiveness', safeAsync(async (req, res) => {
    const rows = await getEffectiveness(pool, {
      intervention_id: req.query.intervention_id as string | undefined,
      competency_id: req.query.competency_id as string | undefined,
      profile_segment: (req.query.profile_segment as string | undefined) ?? 'global',
    });
    res.json(withEnvelope({ ok: true, rows, count: rows.length }));
  }));

  // 5. Refresh rollup (auth)
  app.post('/api/adaptive/interventions/refresh', requireAuth, safeAsync(async (_req, res) => {
    const r = await refreshEffectivenessRollup(pool);
    res.json(withEnvelope({ ok: true, ...r }));
  }));

  // 6. Transfer cascade (forward)
  app.get('/api/adaptive/transfer/from/:competency_id', safeAsync(async (req, res) => {
    const graph = await loadGraph(pool);
    const depth = Math.min(parseInt(String(req.query.max_depth ?? '3'), 10), 5);
    const minStrength = Math.max(0, Math.min(1, parseFloat(String(req.query.min_strength ?? '0.2'))));
    const cascade = cascadeFrom(graph, req.params.competency_id,
      { maxDepth: depth, minStrength });
    res.json(withEnvelope({ ok: true, source: req.params.competency_id, cascade, count: cascade.length }));
  }));

  // 7. Precursors (reverse)
  app.get('/api/adaptive/transfer/to/:competency_id', safeAsync(async (req, res) => {
    const graph = await loadGraph(pool);
    const depth = Math.min(parseInt(String(req.query.max_depth ?? '3'), 10), 5);
    const minStrength = Math.max(0, Math.min(1, parseFloat(String(req.query.min_strength ?? '0.2'))));
    const precursors = precursorsOf(graph, req.params.competency_id,
      { maxDepth: depth, minStrength });
    res.json(withEnvelope({ ok: true, target: req.params.competency_id, precursors, count: precursors.length }));
  }));

  // 8. Edges (raw)
  app.get('/api/adaptive/transfer/edges', safeAsync(async (req, res) => {
    const edges = await listEdges(pool, {
      source: req.query.source as string | undefined,
      target: req.query.target as string | undefined,
      limit: parseInt(String(req.query.limit ?? '200'), 10),
    });
    res.json(withEnvelope({ ok: true, edges, count: edges.length }));
  }));

  // 9. Sequence
  app.post('/api/adaptive/sequence', safeAsync(async (req, res) => {
    const b = req.body ?? {};
    const ids: string[] = Array.isArray(b.competency_ids) ? b.competency_ids : [];
    if (!ids.length) {
      return res.status(400).json(withEnvelope({ ok: false, error: 'invalid_request',
        detail: 'competency_ids must be a non-empty array' }));
    }
    const userScores: Record<string, number> = b.user_scores ?? {};
    const userLevels: Record<string, number> = {};
    for (const [c, s] of Object.entries(userScores)) userLevels[c] = scoreToLevel(s as number);
    const edges = await loadDependencies(pool, ids);
    const result = sequenceCompetencies(ids, edges, userLevels);
    res.json(withEnvelope({ ok: true, ...result }));
  }));

  // 10. Causal recommendations
  app.get('/api/adaptive/recommendations', safeAsync(async (req, res) => {
    const userId = sessionUserId(req) ?? (req.query.user_id as string | undefined) ?? null;
    const scores = await resolveScores(pool, req, userId);
    const targetRoleId = (req.query.target_role_id as string | undefined) ?? null;
    let velocity: Record<string, string> | undefined;
    const vRaw = req.query.velocity;
    if (typeof vRaw === 'string' && vRaw.trim().startsWith('{')) {
      try { velocity = JSON.parse(vRaw); } catch { /* ignore */ }
    }
    const result = await generateCausalRecommendations(pool, {
      user_id: userId ?? 'anonymous', target_role_id: targetRoleId,
      user_scores: scores, velocity,
      profile_segment: (req.query.profile_segment as string | undefined) ?? 'global',
      limit: parseInt(String(req.query.limit ?? '8'), 10),
    });
    // Persist when authed
    let persisted = 0;
    if (sessionUserId(req) && result.recommendations.length) {
      try { ({ persisted } = await persistRecommendations(pool, userId!, targetRoleId, result.recommendations)); }
      catch (e) { /* eslint-disable-next-line no-console */ console.warn('[adaptive-causal] persist skipped:', (e as Error).message); }
    }
    auditLog(pool, { user_id: userId, endpoint: 'recommendations', status: 'ok',
      detail: { count: result.recommendations.length, persisted, target_role_id: targetRoleId } });
    res.json(withEnvelope({ ok: true, ...result, persisted }));
  }));

  // 11. Adaptive guidance snapshot (auth)
  app.get('/api/adaptive/guidance', requireAuth, safeAsync(async (req, res) => {
    const userId = sessionUserId(req)!;
    const scores = await resolveScores(pool, req, userId);
    let velocity: Record<string, string> | undefined;
    const vRaw = req.query.velocity;
    if (typeof vRaw === 'string' && vRaw.trim().startsWith('{')) {
      try { velocity = JSON.parse(vRaw); } catch { /* ignore */ }
    }
    const snapshot = await buildAdaptiveGuidance(pool, {
      user_id: userId,
      target_role_id: (req.query.target_role_id as string | undefined) ?? null,
      user_scores: scores, velocity,
      limit: parseInt(String(req.query.limit ?? '5'), 10),
    });
    auditLog(pool, { user_id: userId, endpoint: 'guidance', status: 'ok',
      detail: { actions: snapshot.next_actions.length } });
    res.json(withEnvelope({ ok: true, snapshot }));
  }));
}
