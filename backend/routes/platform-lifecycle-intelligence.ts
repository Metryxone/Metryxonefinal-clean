/**
 * MX-700 Phase 1.39 — Platform Lifecycle Intelligence Engine admin routes.
 *
 * Flag-gated by `platformLifecycleIntelligence` (default OFF). With the flag OFF every
 * route returns 503 BEFORE any auth/DB touch and the lazy ensure-schema is never reached
 * -> byte-identical legacy behaviour incl. schema. `/enabled` is a persona-agnostic probe;
 * `/feature-flag` is the super-admin UI gate (res.ok).
 *
 * This is the INTELLIGENCE tier over the 1.37 Foundation + 1.38 Management: it COMPOSES
 * their registry/catalog/relationships + getters (no parallel registry/engine, no
 * business-logic change). All reads are GET-never-writes (services probe via to_regclass
 * and degrade to `ready:false`). The ONLY write op is POST /audit/capture (ensure-schema
 * lives inside that service path).
 *
 * Literal sub-paths are registered BEFORE the `:uid` param handler.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isPlatformLifecycleIntelligenceEnabled } from '../config/feature-flags';
import {
  getLifecycleEvidence, getLifecycleConfidence, getLifecycleHealth,
  getRepositoryHealthIntel, getCompatibilityIntelligence, getLifecycleValidation,
  getLifecycleMetrics, getIntelligenceSummary,
  captureAuditSnapshot, getAuditSnapshots, getAuditDrift,
  explainLifecycle,
} from '../services/platform-lifecycle-intelligence';

export function registerPlatformLifecycleIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/platform-lifecycle-intelligence';
  const actorOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;
  const str = (v: unknown) => (v == null ? undefined : String(v));
  const intOf = (v: unknown) => {
    if (v == null) return undefined;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : undefined;
  };

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isPlatformLifecycleIntelligenceEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isPlatformLifecycleIntelligenceEnabled()) {
      return res.status(503).json({ ok: false, error: 'platform_lifecycle_intelligence_disabled' });
    }
    next();
  };

  // Super-admin UI tab gate (res.ok). 503 when OFF (tab hidden), 200 when ON.
  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- reads (GET-never-writes) ----
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getIntelligenceSummary(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/evidence`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getLifecycleEvidence(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/confidence`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getLifecycleConfidence(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/health`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getLifecycleHealth(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/repository-health`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getRepositoryHealthIntel(pool, { largeFileLines: intOf(req.query.large_file_lines) })); } catch (e) { next(e); }
  });

  app.get(`${BASE}/compatibility`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getCompatibilityIntelligence(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/validation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getLifecycleValidation(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/metrics`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getLifecycleMetrics(pool)); } catch (e) { next(e); }
  });

  // ---- audit (drift) ----
  app.get(`${BASE}/audit/drift`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getAuditDrift(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/audit/snapshots`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getAuditSnapshots(pool, { limit: intOf(req.query.limit) })); } catch (e) { next(e); }
  });

  // ONLY write path: capture an immutable intelligence snapshot (ensure-schema inside the service).
  app.post(`${BASE}/audit/capture`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await captureAuditSnapshot(pool, str(actorOf(req)) ?? null)); } catch (e) { next(e); }
  });

  // ---- per-entity explainability (literal segment + param; registered LAST) ----
  app.get(`${BASE}/explain/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await explainLifecycle(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
}
