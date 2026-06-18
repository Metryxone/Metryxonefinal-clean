/**
 * Adaptive Orchestration V2 routes (additive, feature-flagged).
 *
 * Mount prefix: /api/v2/orchestration
 * Flag: adaptiveOrchestrationV2.
 *
 *   POST /run                       — orchestrateAssessmentCompletion
 *   GET  /profile/:userId           — latest unified profile
 *   POST /profile/:userId/rebuild   — rebuild + persist profile
 *   GET  /graph/stats               — competency graph stats
 *   GET  /graph/neighbors           — neighbors of a node
 *   GET  /events                    — recent events
 *   GET  /feature-flag              — public
 *   GET  /_meta/versions            — public
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  orchestrateAssessmentCompletion, propagateAdaptiveUpdates,
  synchronizeIntelligenceLayers, updateCompetencyGraph, buildIntelligenceProfile,
  ORCHESTRATOR_VERSION,
} from '../services/competency-intelligence-orchestrator';
import {
  buildProfile, persistProfile, getLatestProfile, PROFILE_ENGINE_VERSION,
} from '../services/competency-intelligence-profile-engine';
import { snapshotStats, getNeighbors, COMPETENCY_GRAPH_VERSION, type NodeKind, type EdgeKind } from '../services/competency-graph-engine-v2';
import { initEventBus, recentEvents, ADAPTIVE_EVENT_BUS_VERSION } from '../services/adaptive-event-bus';
import { isAdaptiveOrchestrationV2Enabled } from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = {
  ORCHESTRATOR_VERSION,
  PROFILE_ENGINE_VERSION,
  COMPETENCY_GRAPH_VERSION,
  ADAPTIVE_EVENT_BUS_VERSION,
};

const LANGUAGE_POLICY = {
  allowed: ['intelligence profile', 'orchestration step', 'graph relationship', 'lineage', 'event correlation'],
  disallowed: ['hiring recommendation', 'promotion ranking', 'individual fitness prediction'],
};

function envelope<T extends object>(payload: T) {
  return {
    ok: true, ...payload,
    methodology_versions: VERSIONS,
    language_policy: LANGUAGE_POLICY,
    feature_flag: { adaptiveOrchestrationV2: isAdaptiveOrchestrationV2Enabled() },
  };
}

function errorEnvelope(error: string, extra: Record<string, unknown> = {}) {
  return {
    ok: false, error, ...extra,
    methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY,
    feature_flag: { adaptiveOrchestrationV2: isAdaptiveOrchestrationV2Enabled() },
  };
}

function requireFlag(_req: Request, res: Response, next: NextFunction) {
  if (!isAdaptiveOrchestrationV2Enabled()) return res.status(503).json(errorEnvelope('adaptiveOrchestrationV2 disabled'));
  next();
}

function authUserId(req: Request): number | null {
  const u = (req as Request & { user?: { id?: number | string } }).user;
  if (!u || u.id == null) return null;
  const n = typeof u.id === 'string' ? Number.parseInt(u.id, 10) : u.id;
  return Number.isFinite(n) ? (n as number) : null;
}

function pathUserId(req: Request): number | null {
  const n = Number.parseInt(String(req.params.userId), 10);
  return Number.isFinite(n) ? n : null;
}

export function registerAdaptiveOrchestrationV2(opts: { app: Express; pool: Pool; requireAuth: RequireAuth }) {
  const { app, pool, requireAuth } = opts;

  // Initialize event bus singleton with this pool.
  initEventBus(pool);

  app.get('/api/v2/orchestration/feature-flag', (_req, res) => res.json(envelope({})));
  app.get('/api/v2/orchestration/_meta/versions', (_req, res) => res.json(envelope({})));

  // ── Run orchestration after assessment completion ──────────────────────
  app.post('/api/v2/orchestration/run', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req);
      const reqUid = Number(req.body?.userId);
      const userId = Number.isFinite(reqUid) && reqUid > 0 ? reqUid : auth;
      if (userId == null) return res.status(400).json(errorEnvelope('userId required'));
      // Only allow rebuild for self unless caller is the same user.
      if (auth != null && userId !== auth) return res.status(403).json(errorEnvelope('forbidden'));
      const outcome = await orchestrateAssessmentCompletion(pool, {
        userId,
        assessmentId: req.body?.assessmentId ? String(req.body.assessmentId) : undefined,
        tenantId: req.body?.tenantId != null ? Number(req.body.tenantId) : null,
      });
      res.json(envelope({ outcome }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // ── Latest cached profile ──────────────────────────────────────────────
  app.get('/api/v2/orchestration/profile/:userId', requireAuth, requireFlag, async (req, res) => {
    try {
      const userId = pathUserId(req);
      const auth = authUserId(req);
      if (userId == null) return res.status(400).json(errorEnvelope('userId required'));
      if (auth != null && userId !== auth) return res.status(403).json(errorEnvelope('forbidden'));
      const cached = await getLatestProfile(pool, userId);
      if (!cached) return res.json(envelope({ profile: null, cached: false }));
      res.json(envelope({ profile: cached.profile, version: cached.version, computed_at: cached.computed_at, cached: true }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // ── Rebuild & persist profile ─────────────────────────────────────────
  app.post('/api/v2/orchestration/profile/:userId/rebuild', requireAuth, requireFlag, async (req, res) => {
    try {
      const userId = pathUserId(req);
      const auth = authUserId(req);
      if (userId == null) return res.status(400).json(errorEnvelope('userId required'));
      if (auth != null && userId !== auth) return res.status(403).json(errorEnvelope('forbidden'));
      const profile = await buildIntelligenceProfile(pool, userId);
      persistProfile(pool, profile).catch((err) => console.warn('[orch-v2] profile persist failed:', (err as Error).message));
      res.json(envelope({ profile }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // ── Graph stats ────────────────────────────────────────────────────────
  app.get('/api/v2/orchestration/graph/stats', requireAuth, requireFlag, async (_req, res) => {
    try {
      const stats = await snapshotStats(pool);
      res.json(envelope({ stats }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // ── Graph neighbors ───────────────────────────────────────────────────
  app.get('/api/v2/orchestration/graph/neighbors', requireAuth, requireFlag, async (req, res) => {
    try {
      const nodeKind = String(req.query.nodeKind ?? '').trim() as NodeKind;
      const nodeKey  = String(req.query.nodeKey  ?? '').trim();
      const edgeKindRaw = req.query.edgeKind ? String(req.query.edgeKind) as EdgeKind : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      if (!nodeKind || !nodeKey) return res.status(400).json(errorEnvelope('nodeKind + nodeKey required'));
      const neighbors = await getNeighbors(pool, { nodeKind, nodeKey, edgeKind: edgeKindRaw, limit });
      res.json(envelope({ neighbors, count: neighbors.length }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // ── Recent events (self-only; cross-user query is forbidden) ───────────
  app.get('/api/v2/orchestration/events', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req);
      if (auth == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const reqUid = req.query.userId ? Number(req.query.userId) : null;
      if (reqUid != null && Number.isFinite(reqUid) && reqUid !== auth) {
        return res.status(403).json(errorEnvelope('forbidden'));
      }
      const limit = req.query.limit ? Number(req.query.limit) : 25;
      const events = await recentEvents(pool, { userId: auth, limit });
      res.json(envelope({ events, count: events.length }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // ── Manual sync trigger (admin-style; useful for debug) ────────────────
  app.post('/api/v2/orchestration/graph/refresh', requireAuth, requireFlag, async (_req, res) => {
    try {
      const result = await updateCompetencyGraph(pool);
      res.json(envelope(result));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // Register baseline event listeners (no-op stubs to demonstrate the wiring).
  // Existing engines remain authoritative; future enhancements can subscribe here.
  // Listener errors are caught inside the bus.
  // Note: orchestrator emits these events itself; this is just a sample wiring.
  void synchronizeIntelligenceLayers;
  void propagateAdaptiveUpdates;
}
