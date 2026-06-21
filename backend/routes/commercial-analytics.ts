/**
 * Phase 6.6 — Revenue Intelligence routes (flag `commercialRevenueIntelligence`, default OFF →
 * every route 503s → byte-identical legacy). READ-ONLY, super-admin only.
 *
 *   GET /api/admin/commercial/revenue/ping      — lightweight probe for FE tab gating (200/503)
 *   GET /api/admin/commercial/revenue/analytics — composite revenue analytics (MRR/ARR + by-dimension)
 *
 * GET-NEVER-WRITES: these are read-only analytics. No ensure-schema is run on the read path; the
 * engine probes table existence with to_regclass and degrades to honest empties.
 */
import type { Express } from 'express';
import pg from 'pg';
import { buildRevenueAnalytics } from '../services/commercial/revenue-engine';
import { isCommercialRevenueIntelligenceEnabled } from '../config/feature-flags';

type GuardMW = (req: any, res: any, next: any) => void;

export function registerCommercialAnalyticsRoutes(
  app: Express,
  pool: pg.Pool,
  requireAuth: GuardMW,
  requireSuperAdmin: GuardMW,
): void {
  const requireRevenueFlag: GuardMW = (_req, res, next) => {
    if (!isCommercialRevenueIntelligenceEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'commercialRevenueIntelligence' });
    }
    next();
  };
  const adminReadChain = [requireAuth, requireSuperAdmin, requireRevenueFlag];

  // Lightweight gate probe (FE hides the Revenue tab when this is not 200).
  app.get('/api/admin/commercial/revenue/ping', ...adminReadChain, (_req: any, res) => {
    res.json({ enabled: true });
  });

  app.get('/api/admin/commercial/revenue/analytics', ...adminReadChain, async (_req: any, res) => {
    try {
      const analytics = await buildRevenueAnalytics(pool);
      res.json(analytics);
    } catch (err) {
      console.error('[revenue analytics]', err);
      res.status(500).json({ error: 'analytics failed' });
    }
  });
}
