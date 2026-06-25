/**
 * MX-107A — Competency Match Intelligence routes (read-only composer).
 *
 * Surfaces the unified competency crosswalk by COMPOSING existing engines:
 *   - GET /api/admin/competency-match-intelligence/enabled        persona-agnostic flag probe (no auth)
 *   - GET /api/admin/competency-match-intelligence/overview       roll-up headline (super-admin)
 *   - GET /api/admin/competency-match-intelligence/coverage       Phase 1 crosswalk coverage report
 *   - GET /api/admin/competency-match-intelligence/super-admin    Phase 5 super-admin coverage console
 *   - GET /api/admin/competency-match-intelligence/founder        Phase 6 founder dashboard
 *   - GET /api/admin/competency-match-intelligence/certification  Phase 8 PASS/PARTIAL/FAIL cert
 *
 * Strictly additive + reversible + flag-gated (`competencyMatchIntelligence`,
 * FF_COMPETENCY_MATCH_INTELLIGENCE, default OFF):
 *   - OFF → every route 503 before any auth/DB touch → byte-identical legacy behaviour (no schema touched).
 *   - GET-only; the composer reads via to_regclass probes and NEVER writes (no DDL anywhere).
 *   - Never throws: any unexpected error degrades to a 200 honest-degraded JSON.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  composeCrosswalkCoverage,
  composeSuperAdmin,
  composeFounder,
  composeCertification,
  composeOverview,
} from '../services/competency-match-intelligence';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('competencyMatchIntelligence')) {
    return res.status(503).json({ ok: false, error: 'competency_match_intelligence_disabled' });
  }
  next();
}

function degraded(tag: string, err: unknown, res: Response) {
  console.error(`[competency-match-intelligence] ${tag} error:`, err);
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
}

export function registerCompetencyMatchIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const base = '/api/admin/competency-match-intelligence';

  // Persona-agnostic flag probe (flag STATE is not sensitive). flagGate runs first → 503 when OFF.
  app.get(`${base}/enabled`, flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  app.get(`${base}/overview`, flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json(await composeOverview(pool)); } catch (err) { degraded('overview', err, res); }
  });

  app.get(`${base}/coverage`, flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json(await composeCrosswalkCoverage(pool)); } catch (err) { degraded('coverage', err, res); }
  });

  app.get(`${base}/super-admin`, flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json(await composeSuperAdmin(pool)); } catch (err) { degraded('super-admin', err, res); }
  });

  app.get(`${base}/founder`, flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json(await composeFounder(pool)); } catch (err) { degraded('founder', err, res); }
  });

  app.get(`${base}/certification`, flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json(await composeCertification(pool)); } catch (err) { degraded('certification', err, res); }
  });

  console.log('[competency-match-intelligence] MX-107A routes registered — unified competency crosswalk surface (read-only, precise⟂operational)');
}
