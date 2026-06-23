/**
 * MX-100X PHASE 9 — Enterprise Workforce Intelligence Console (routes).
 *
 * Base: /api/enterprise-workforce/*  (ALL GET — pure read/compose layer; no POST, no DDL)
 *   meta       GET /_meta/status
 *   overview   GET /overview                  (all 7 views' availability + provenance, ONE fold)
 *   skill-gap  GET /skill-gap
 *   succession GET /succession
 *   mobility   GET /mobility                  (internal mobility, derived from succession)
 *   planning   GET /workforce-planning
 *   risk       GET /talent-risk
 *   talent fc  GET /talent-forecasting        (longitudinal trends, >=2 points)
 *   readiness  GET /readiness-forecasting     (per-subject readiness trends + enterprise snapshot)
 *
 * Contract:
 *   - Flag-gated: `enterpriseWorkforceConsole` (FF_ENTERPRISE_WORKFORCE_CONSOLE). OFF => every route 503
 *     BEFORE any auth/DB touch (byte-identical legacy; no new surface, no new tables).
 *   - Super-admin gated (requireAuth -> requireSuperAdmin). NOTE: this base path is NOT under
 *     /api/admin/*, so the global admin gate does NOT apply — inline requireAuth + requireSuperAdmin
 *     are required (and supplied here) for it to be protected.
 *   - COMPOSE-NEVER-RECOMPUTE: composes the existing predictive-workforce (Phase 5) + M5 engines and
 *     read-only snapshot SELECTs. Runs NO DDL and writes NO rows.
 *   - Engines never throw; each view degrades to abstained:true rather than failing the request.
 *   - Optional ?org=<org_id> (default `demo_org`); literal sub-paths registered before any param route
 *     (there are no param routes here).
 *   - Distinct from Phase 5.12 `/api/workforce-intelligence/*` (employer-scoped).
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isEnterpriseWorkforceConsoleEnabled } from '../config/feature-flags';
import {
  ENTERPRISE_WORKFORCE_CONSOLE_VERSION,
  ENTERPRISE_WORKFORCE_DISCLAIMER,
  DEFAULT_ORG_ID,
  consoleOverview,
  skillGapView,
  successionView,
  mobilityView,
  workforcePlanningView,
  talentRiskView,
  talentForecastingView,
  readinessForecastingView,
  type ConsoleView,
} from '../services/enterprise-workforce-console';

type Mw = (req: any, res: any, next: any) => void;

function orgOf(req: Request): string {
  const raw = (req.query.org ?? req.query.org_id) as string | undefined;
  return raw && String(raw).trim() ? String(raw).trim() : DEFAULT_ORG_ID;
}

function sendView(res: Response, view: ConsoleView): void {
  res.json({
    engine: 'enterprise-workforce-console',
    version: ENTERPRISE_WORKFORCE_CONSOLE_VERSION,
    ...view,
    disclaimer: ENTERPRISE_WORKFORCE_DISCLAIMER,
  });
}

export function registerEnterpriseWorkforceConsoleRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const gate: Mw = (_req, res, next) => {
    if (!isEnterpriseWorkforceConsoleEnabled()) {
      return res.status(503).json({
        error: 'Enterprise Workforce Console is not enabled',
        flag: 'enterpriseWorkforceConsole',
        env: 'FF_ENTERPRISE_WORKFORCE_CONSOLE',
      });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];
  const base = '/api/enterprise-workforce';

  app.get(`${base}/_meta/status`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'enterprise-workforce-console', version: ENTERPRISE_WORKFORCE_CONSOLE_VERSION, ok: true });
  });

  app.get(`${base}/overview`, ...guards, async (req: Request, res: Response) => {
    res.json(await consoleOverview(pool, orgOf(req)));
  });

  app.get(`${base}/skill-gap`, ...guards, async (req: Request, res: Response) => {
    sendView(res, await skillGapView(pool, orgOf(req)));
  });
  app.get(`${base}/succession`, ...guards, async (req: Request, res: Response) => {
    sendView(res, await successionView(pool, orgOf(req)));
  });
  app.get(`${base}/mobility`, ...guards, async (req: Request, res: Response) => {
    sendView(res, await mobilityView(pool, orgOf(req)));
  });
  app.get(`${base}/workforce-planning`, ...guards, async (req: Request, res: Response) => {
    sendView(res, await workforcePlanningView(pool, orgOf(req)));
  });
  app.get(`${base}/talent-risk`, ...guards, async (req: Request, res: Response) => {
    sendView(res, await talentRiskView(pool, orgOf(req)));
  });
  app.get(`${base}/talent-forecasting`, ...guards, async (_req: Request, res: Response) => {
    sendView(res, await talentForecastingView(pool));
  });
  app.get(`${base}/readiness-forecasting`, ...guards, async (req: Request, res: Response) => {
    sendView(res, await readinessForecastingView(pool, orgOf(req)));
  });
}
