/**
 * MX-106X — Production Readiness & Go-Live Certification routes (read-only TOP-LEVEL composer).
 *
 * A SUPERSET of MX-105X. COMPOSES the existing enterprise-certification + governance + tenant /
 * health / operational + question-certification READ paths into one production-readiness picture:
 *   - GET /api/admin/go-live/enabled                flag probe (behind the global /api/admin auth gate)
 *   - GET /api/admin/go-live/overview               fold the headline of every Go-Live view
 *   - GET /api/admin/go-live/axes                   six separate readiness axes
 *   - GET /api/admin/go-live/scalability            scalability / multi-tenant certification
 *   - GET /api/admin/go-live/security               security & governance certification
 *   - GET /api/admin/go-live/command-center         Super Admin Go-Live Center (domains + launch readiness)
 *   - GET /api/admin/go-live/founder                Founder Go-Live Center (executive %s + risks/gaps)
 *   - GET /api/admin/go-live/certification          final 9 yes/no questions + 5-level certificate
 *
 * Strictly additive + reversible + flag-gated (`goLiveCertification`, FF_GO_LIVE_CERTIFICATION,
 * default OFF):
 *   - The global `app.use('/api/admin', requireAuth→requireSuperAdmin)` gate runs FIRST, so unauthenticated
 *     callers get 401; for an authenticated super-admin, OFF → 503 (no DB touch) → byte-identical legacy
 *     behaviour (no schema touched), ON → 200.
 *   - GET-only; the composer reads via to_regclass probes and NEVER writes (no DDL anywhere).
 *   - Never throws: any unexpected error degrades to a 200 honest-degraded JSON.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  goLiveOverview,
  sixAxisReadiness,
  scalabilityCertification,
  securityGovernanceCertification,
  goLiveCommandCenter,
  founderGoLiveCenter,
  goLiveCertification,
} from '../services/go-live-certification';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('goLiveCertification')) {
    return res.status(503).json({ ok: false, error: 'go_live_certification_disabled' });
  }
  next();
}

const degraded = (res: Response) =>
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });

export function registerGoLiveCertificationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // Persona-agnostic flag probe (flag STATE is not sensitive). flagGate runs first → 503 when OFF;
  // res.ok=true only when the Go-Live console is ON. Lets the SuperAdmin UI hide the tab byte-identically.
  app.get('/api/admin/go-live/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  app.get('/api/admin/go-live/overview', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json(await goLiveOverview(pool)); }
    catch (err) { console.error('[go-live] overview error:', err); degraded(res); }
  });

  app.get('/api/admin/go-live/axes', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await sixAxisReadiness(pool)) }); }
    catch (err) { console.error('[go-live] axes error:', err); degraded(res); }
  });

  app.get('/api/admin/go-live/scalability', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await scalabilityCertification(pool)) }); }
    catch (err) { console.error('[go-live] scalability error:', err); degraded(res); }
  });

  app.get('/api/admin/go-live/security', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await securityGovernanceCertification(pool)) }); }
    catch (err) { console.error('[go-live] security error:', err); degraded(res); }
  });

  app.get('/api/admin/go-live/command-center', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await goLiveCommandCenter(pool)) }); }
    catch (err) { console.error('[go-live] command-center error:', err); degraded(res); }
  });

  app.get('/api/admin/go-live/founder', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await founderGoLiveCenter(pool)) }); }
    catch (err) { console.error('[go-live] founder error:', err); degraded(res); }
  });

  app.get('/api/admin/go-live/certification', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, ...(await goLiveCertification(pool)) }); }
    catch (err) { console.error('[go-live] certification error:', err); degraded(res); }
  });

  console.log('[go-live] MX-106X routes registered — production readiness & go-live certification (read-only composer)');
}
