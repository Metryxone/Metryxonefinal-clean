/**
 * Phase 6.8 — Customer Success Intelligence routes (flag `commercialCustomerSuccess`, default OFF →
 * every route 503s → byte-identical legacy). READ-ONLY, super-admin only.
 *
 *   GET /api/admin/commercial/success/ping       — lightweight probe for FE tab gating (200/503)
 *   GET /api/admin/commercial/success/analytics  — composite (headline + health + engagement + retention)
 *   GET /api/admin/commercial/success/engagement  — engagement engine only
 *   GET /api/admin/commercial/success/retention   — retention engine only
 *
 * GET-NEVER-WRITES: read-only analytics. No ensure-schema on the read path; engines probe table
 * existence with to_regclass and degrade to honest empties.
 */
import type { Express } from 'express';
import pg from 'pg';
import { buildCustomerSuccess } from '../services/commercial/customer-success-engine';
import { buildEngagementAnalytics } from '../services/commercial/engagement-engine';
import { buildRetentionAnalytics } from '../services/commercial/retention-engine';
import { isCommercialCustomerSuccessEnabled } from '../config/feature-flags';

type GuardMW = (req: any, res: any, next: any) => void;

export function registerCustomerSuccessRoutes(
  app: Express,
  pool: pg.Pool,
  requireAuth: GuardMW,
  requireSuperAdmin: GuardMW,
): void {
  const requireSuccessFlag: GuardMW = (_req, res, next) => {
    if (!isCommercialCustomerSuccessEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'commercialCustomerSuccess' });
    }
    next();
  };
  const adminReadChain = [requireAuth, requireSuperAdmin, requireSuccessFlag];

  // Lightweight gate probe (FE hides the Customer Success tab when this is not 200).
  app.get('/api/admin/commercial/success/ping', ...adminReadChain, (_req: any, res) => {
    res.json({ enabled: true });
  });

  app.get('/api/admin/commercial/success/analytics', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildCustomerSuccess(pool));
    } catch (err) {
      console.error('[customer success analytics]', err);
      res.status(500).json({ error: 'analytics failed' });
    }
  });

  app.get('/api/admin/commercial/success/engagement', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildEngagementAnalytics(pool));
    } catch (err) {
      console.error('[customer success engagement]', err);
      res.status(500).json({ error: 'engagement failed' });
    }
  });

  app.get('/api/admin/commercial/success/retention', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildRetentionAnalytics(pool));
    } catch (err) {
      console.error('[customer success retention]', err);
      res.status(500).json({ error: 'retention failed' });
    }
  });
}
