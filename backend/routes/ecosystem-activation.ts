/**
 * MX-104X — Candidate & Career Ecosystem Activation (routes).
 *
 * Base: /api/admin/ecosystem-activation/*  (ALL GET — pure read/compose layer; no POST, no DDL)
 *   enabled       GET /enabled               (flag probe for the SuperAdmin nav)
 *   overview      GET /overview              (founder headline + every view's availability)
 *   funnel        GET /journey-funnel        (Phase 1 funnel + Phase 5 founder counts)
 *   career bld    GET /career-builder        (Phase 2)
 *   passport      GET /passport              (Phase 3)
 *   employability GET /employability
 *   analytics     GET /journey-analytics     (per-step conversion + drop-off)
 *   cert          GET /certification         (Phase 6 — 8 questions + structural verdict)
 *
 * Contract:
 *   - Flag-gated: `ecosystemActivation` (FF_ECOSYSTEM_ACTIVATION). OFF => every route 503 before
 *     any DB touch (byte-identical legacy; no new surface, no new tables).
 *   - Under /api/admin/* so the GLOBAL admin gate (requireAuth → requireSuperAdmin) applies;
 *     defensive inline guards are added too (idempotent).
 *   - COMPOSE-NEVER-RECOMPUTE: composes existing journey tables only. Runs NO DDL, writes NO rows.
 *   - Views never throw; each degrades (null fields) rather than failing the request.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isEcosystemActivationEnabled } from '../config/feature-flags';
import {
  ECOSYSTEM_ACTIVATION_VERSION,
  ECOSYSTEM_ACTIVATION_DISCLAIMER,
  ecosystemOverview,
  journeyFunnel,
  careerBuilderActivation,
  passportActivation,
  employabilityActivation,
  journeyAnalytics,
  certification,
  type ActivationView,
} from '../services/ecosystem-activation';

type Mw = (req: any, res: any, next: any) => void;

function send(res: Response, view: ActivationView): void {
  res.json({
    engine: 'ecosystem-activation',
    version: ECOSYSTEM_ACTIVATION_VERSION,
    ...view,
    disclaimer: ECOSYSTEM_ACTIVATION_DISCLAIMER,
  });
}

export function registerEcosystemActivationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const gate: Mw = (_req, res, next) => {
    if (!isEcosystemActivationEnabled()) {
      return res.status(503).json({
        error: 'Ecosystem Activation is not enabled',
        flag: 'ecosystemActivation',
        env: 'FF_ECOSYSTEM_ACTIVATION',
      });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];
  const base = '/api/admin/ecosystem-activation';

  app.get(`${base}/enabled`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'ecosystem-activation', version: ECOSYSTEM_ACTIVATION_VERSION, enabled: true });
  });

  app.get(`${base}/overview`, ...guards, async (_req: Request, res: Response) => {
    send(res, await ecosystemOverview(pool));
  });
  app.get(`${base}/journey-funnel`, ...guards, async (_req: Request, res: Response) => {
    send(res, await journeyFunnel(pool));
  });
  app.get(`${base}/career-builder`, ...guards, async (_req: Request, res: Response) => {
    send(res, await careerBuilderActivation(pool));
  });
  app.get(`${base}/passport`, ...guards, async (_req: Request, res: Response) => {
    send(res, await passportActivation(pool));
  });
  app.get(`${base}/employability`, ...guards, async (_req: Request, res: Response) => {
    send(res, await employabilityActivation(pool));
  });
  app.get(`${base}/journey-analytics`, ...guards, async (_req: Request, res: Response) => {
    send(res, await journeyAnalytics(pool));
  });
  app.get(`${base}/certification`, ...guards, async (_req: Request, res: Response) => {
    send(res, await certification(pool));
  });
}
