/**
 * MX-700 Phase 1.37 — Platform Lifecycle Foundation admin routes.
 *
 * Flag-gated by `platformLifecycleFoundation` (default OFF). With the flag OFF
 * every route returns 503 BEFORE any auth/DB touch and the ensure-schema is
 * never reached -> byte-identical legacy behaviour incl. schema. `/enabled` is a
 * persona-agnostic probe; `/feature-flag` is the super-admin UI gate (res.ok).
 *
 * Reads are GET-never-writes (the service probes via to_regclass and degrades to
 * `ready:false` when discovery has not yet run). Only POST /discover and
 * POST /registry/:uid/transition create/modify rows (ensure-schema there).
 *
 * Literal sub-paths are registered BEFORE the `:uid` param handlers.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isPlatformLifecycleFoundationEnabled } from '../config/feature-flags';
import {
  runDiscovery, transitionState, getCapabilities, getCapabilityDetail, getRegistry,
  getOwnership, getRelationships, getValidation, getRepositoryHealth, getSummary, getStateHistory,
  schemaReady,
} from '../services/platform-lifecycle';

export function registerPlatformLifecycleRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/platform-lifecycle';
  const actorOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isPlatformLifecycleFoundationEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isPlatformLifecycleFoundationEnabled()) {
      return res.status(503).json({ ok: false, error: 'platform_lifecycle_disabled' });
    }
    next();
  };

  // Super-admin UI tab gate (res.ok). 503 when OFF (tab hidden), 200 when ON.
  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- reads (GET-never-writes) ----
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getSummary(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/validation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getValidation(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/health`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRepositoryHealth(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/ownership`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      res.json(await getOwnership(pool, {
        missingOnly: req.query.missing === '1' || req.query.missing === 'true',
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
      }));
    } catch (e) { next(e); }
  });

  app.get(`${BASE}/relationships`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      res.json(await getRelationships(pool, {
        uid: req.query.uid ? String(req.query.uid) : undefined,
        type: req.query.type ? String(req.query.type) : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
      }));
    } catch (e) { next(e); }
  });

  app.get(`${BASE}/registry`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      res.json(await getRegistry(pool, {
        entityType: req.query.entity_type ? String(req.query.entity_type) : undefined,
        state: req.query.state ? String(req.query.state) : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
      }));
    } catch (e) { next(e); }
  });

  // capabilities collection (literal) BEFORE the :key param handler
  app.get(`${BASE}/capabilities`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      res.json(await getCapabilities(pool, {
        domain: req.query.domain ? String(req.query.domain) : undefined,
        source: req.query.source ? String(req.query.source) : undefined,
        activation: req.query.activation ? String(req.query.activation) : undefined,
        state: req.query.state ? String(req.query.state) : undefined,
        search: req.query.q ? String(req.query.q) : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
      }));
    } catch (e) { next(e); }
  });

  app.get(`${BASE}/capabilities/:key`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getCapabilityDetail(pool, String(req.params.key))); } catch (e) { next(e); }
  });

  app.get(`${BASE}/registry/:uid/history`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const ready = await schemaReady(pool); // honest: ready=false before discovery has created the schema
      res.json({ ready, history: ready ? await getStateHistory(pool, String(req.params.uid)) : [] });
    } catch (e) { next(e); }
  });

  // ---- writes (ensure-schema inside the service) ----
  app.post(`${BASE}/discover`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await runDiscovery(pool, actorOf(req) ? String(actorOf(req)) : null)); } catch (e) { next(e); }
  });

  app.post(`${BASE}/registry/:uid/transition`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const b = req.body || {};
      if (!b.to_state) return res.status(400).json({ ok: false, error: 'to_state required' });
      const out = await transitionState(pool, String(req.params.uid), String(b.to_state), {
        reason: b.reason ? String(b.reason) : undefined,
        evidence: b.evidence ? String(b.evidence) : undefined,
        actor: actorOf(req) ? String(actorOf(req)) : null,
      });
      res.status(out.ok ? 200 : (out.error === 'unknown_entity' ? 404 : 400)).json(out);
    } catch (e) { next(e); }
  });
}
