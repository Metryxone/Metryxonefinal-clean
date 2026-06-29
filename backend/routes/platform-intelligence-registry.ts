/**
 * MX-800 Phase 2.1 — Platform Intelligence Operating System (PIOS): Constitution & Foundation.
 * Admin routes for the canonical Platform Intelligence REGISTRY + GOVERNANCE foundation.
 *
 * Flag-gated by `platformIntelligenceRegistry` (default OFF). With the flag OFF every route returns
 * 503 BEFORE any auth/DB touch and the lazy ensure-schema is never reached → byte-identical legacy
 * behaviour incl. schema. `/enabled` is a persona-agnostic probe; `/feature-flag` is the super-admin
 * UI gate (res.ok).
 *
 * Reads are GET-never-writes (compose the file-verified catalog + overlay persisted rows). The ONLY
 * write paths are POST /discover, POST /register, POST /audit/capture (ensure-schema inside service).
 * Literal sub-paths are registered BEFORE the `:uid` param handlers.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isPlatformIntelligenceRegistryEnabled } from '../config/feature-flags';
import {
  getRegistry, getRegistryEntry, discoverRegistry, registerIntelligence,
  getMetadata, getOrchestration, routeIntelligence, explainIntelligence,
  getGovernance, getValidation, getSummary,
  captureAuditSnapshot, getAuditSnapshots, getAuditDrift,
} from '../services/platform-intelligence-registry';

export function registerPlatformIntelligenceRegistryRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/platform-intelligence-registry';
  const actorOf = (req: Request) =>
    (req as any).user?.id ?? (req as any).session?.userId ?? null;
  const str = (v: unknown) => (v == null ? null : String(v));

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isPlatformIntelligenceRegistryEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isPlatformIntelligenceRegistryEnabled()) {
      return res.status(503).json({ ok: false, error: 'platform_intelligence_registry_disabled' });
    }
    next();
  };

  // Super-admin UI tab gate (res.ok).
  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- Part 3 registry + Parts 5/6/7 + summary (GET-never-writes) ----
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getSummary(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRegistry(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/orchestration`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getOrchestration(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/orchestration/route`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      res.json(await routeIntelligence(pool, {
        id: req.query.id ? String(req.query.id) : undefined,
        type: req.query.type ? String(req.query.type) : undefined,
      }));
    } catch (e) { next(e); }
  });
  app.get(`${BASE}/governance`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getGovernance(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/validation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getValidation(pool)); } catch (e) { next(e); }
  });

  // ---- audit (drift) ----
  app.get(`${BASE}/audit/drift`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getAuditDrift(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/audit/snapshots`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      res.json(await getAuditSnapshots(pool, { limit: Number.isFinite(limit as number) ? limit : undefined }));
    } catch (e) { next(e); }
  });

  // ---- write paths (lazy ensure-schema lives inside the service) ----
  app.post(`${BASE}/discover`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await discoverRegistry(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/register`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await registerIntelligence(pool, req.body ?? {}, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/audit/capture`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await captureAuditSnapshot(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });

  // ---- Part 4 metadata + per-entity reads (literal segment + param; registered LAST) ----
  app.get(`${BASE}/metadata/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getMetadata(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
  app.get(`${BASE}/explain/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await explainIntelligence(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getRegistryEntry(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
}
