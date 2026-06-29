/**
 * MX-700 Phase 1.43 — Platform Lifecycle Intelligence Production Certification & Enterprise Integration.
 *
 * READ-ONLY certification surface. It exposes the Phase 1.43 certification composer (which integrates +
 * validates + certifies the existing 1.37–1.42 tiers) over a flag-gated, super-admin-only API. It ships
 * NO write paths, NO new persistence, NO migration and NO business-logic change. Flag OFF → 503 before
 * auth/DDL → byte-identical legacy.
 *
 * Endpoints (all read-only):
 *   GET `/enabled`        — flag probe `{ enabled }`.
 *   GET `/feature-flag`   — super-admin UI gate (res.ok); 503 when OFF, 200 when ON.
 *   GET `/certification`  — full 10-part measured certification.
 *   GET `/summary`        — condensed headline verdict per report.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isPlatformLifecycleCertificationEnabled } from '../config/feature-flags';
import { composeCertification, composeCertificationSummary } from '../services/platform-lifecycle-certification';

export function registerPlatformLifecycleCertificationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/platform-lifecycle-certification';

  // Persona-agnostic flag probe (no auth) so callers can detect availability.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isPlatformLifecycleCertificationEnabled() });
  });

  // Gate the flag FIRST (503 before any auth/DDL touch when OFF → byte-identical legacy).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isPlatformLifecycleCertificationEnabled()) {
      return res.status(503).json({ ok: false, error: 'platform_lifecycle_certification_disabled' });
    }
    next();
  };

  // Super-admin UI tab gate (res.ok). 503 when OFF, 200 when ON.
  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // Full measured certification (read-only; composer never throws).
  app.get(`${BASE}/certification`, gate, requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      const result = await composeCertification(pool);
      res.json({ ok: true, ...result });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // Condensed headline summary (read-only).
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      const result = await composeCertificationSummary(pool);
      res.json({ ok: true, ...result });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });
}
