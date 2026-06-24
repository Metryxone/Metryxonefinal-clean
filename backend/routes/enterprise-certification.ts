/**
 * MX-105X — Enterprise Certification & Platform Activation routes (read-only composer).
 *
 * Aggregates the existing activation / certification / health / outcome engines into one
 * unified enterprise certification by COMPOSING their READ paths:
 *   - GET /api/admin/enterprise-certification/enabled        persona-agnostic flag probe (no auth)
 *   - GET /api/admin/enterprise-certification/overview       fold the headline of every view
 *   - GET /api/admin/enterprise-certification/journey        unified candidate+employer E2E validation
 *   - GET /api/admin/enterprise-certification/outcomes       outcome readiness (composes MX-102X)
 *   - GET /api/admin/enterprise-certification/command-center Super Admin 12 health categories
 *   - GET /api/admin/enterprise-certification/founder        Founder 12 exec metrics + cert score
 *   - GET /api/admin/enterprise-certification/certification  Enterprise re-cert across 15 subsystems
 *
 * Strictly additive + reversible + flag-gated (`enterpriseCertification`, FF_ENTERPRISE_CERTIFICATION,
 * default OFF):
 *   - OFF → every route 503 before any auth/DB touch → byte-identical legacy behaviour (no schema touched).
 *   - GET-only; the composer reads via to_regclass probes and NEVER writes (no DDL anywhere).
 *   - Never throws: any unexpected error degrades to a 200 honest-degraded JSON.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  overview,
  unifiedJourney,
  outcomeReadiness,
  commandCenter,
  founderCommandCenter,
  recertification,
} from '../services/enterprise-certification';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('enterpriseCertification')) {
    return res.status(503).json({ ok: false, error: 'enterprise_certification_disabled' });
  }
  next();
}

const degraded = (res: Response) =>
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });

export function registerEnterpriseCertificationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // Persona-agnostic flag probe (flag STATE is not sensitive). flagGate runs first → 503 when OFF;
  // res.ok=true only when the certification console is ON. Lets the SuperAdmin UI hide the tab byte-identically.
  app.get('/api/admin/enterprise-certification/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  app.get('/api/admin/enterprise-certification/overview', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json(await overview(pool)); }
    catch (err) { console.error('[enterprise-certification] overview error:', err); degraded(res); }
  });

  app.get('/api/admin/enterprise-certification/journey', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await unifiedJourney(pool)) }); }
    catch (err) { console.error('[enterprise-certification] journey error:', err); degraded(res); }
  });

  app.get('/api/admin/enterprise-certification/outcomes', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await outcomeReadiness(pool)) }); }
    catch (err) { console.error('[enterprise-certification] outcomes error:', err); degraded(res); }
  });

  app.get('/api/admin/enterprise-certification/command-center', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await commandCenter(pool)) }); }
    catch (err) { console.error('[enterprise-certification] command-center error:', err); degraded(res); }
  });

  app.get('/api/admin/enterprise-certification/founder', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await founderCommandCenter(pool)) }); }
    catch (err) { console.error('[enterprise-certification] founder error:', err); degraded(res); }
  });

  app.get('/api/admin/enterprise-certification/certification', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await recertification(pool)) }); }
    catch (err) { console.error('[enterprise-certification] certification error:', err); degraded(res); }
  });

  console.log('[enterprise-certification] MX-105X routes registered — unified enterprise certification (read-only composer)');
}
