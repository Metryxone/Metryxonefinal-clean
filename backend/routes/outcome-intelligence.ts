/**
 * MX-102X — Outcome Intelligence Activation routes (read-only composer).
 *
 * Unifies the SIX realized-outcome types into one honest surface by COMPOSING existing engines:
 *   - GET /api/outcome-intelligence/enabled        persona-agnostic flag probe (no auth; flag state isn't sensitive)
 *   - GET /api/outcome-intelligence/overview       founder dashboard — all 6 types × Coverage/Confidence + platform rollup
 *   - GET /api/outcome-intelligence/type/:type     one type's detail
 *   - GET /api/outcome-intelligence/ledger         unified realized-outcome ledger (subjects pseudonymised)
 *   - GET /api/outcome-intelligence/certification  honest PARTIAL/CERTIFIED success-criteria report
 *
 * Strictly additive + reversible + flag-gated (`outcomeIntelligenceActivation`,
 * FF_OUTCOME_INTELLIGENCE_ACTIVATION, default OFF):
 *   - OFF → every route 503 → byte-identical legacy behaviour (no schema touched).
 *   - GET-only; the composer reads via to_regclass probes and NEVER writes (no DDL anywhere).
 *   - Never throws: any unexpected error degrades to a 200 honest-degraded JSON.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  composeOverview,
  composeType,
  composeLedger,
  composeCertification,
  composeProgressionOutcomes,
  isOutcomeIntelType,
  OUTCOME_INTEL_TYPES,
} from '../services/outcome-intelligence-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('outcomeIntelligenceActivation')) {
    return res.status(503).json({ ok: false, error: 'outcome_intelligence_disabled' });
  }
  next();
}

export function registerOutcomeIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // Persona-agnostic flag probe (flag STATE is not sensitive). flagGate runs first → 503 when OFF;
  // res.ok=true only when the activation is ON. Lets the SuperAdmin UI hide the tab byte-identically.
  app.get('/api/outcome-intelligence/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  app.get('/api/outcome-intelligence/overview', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json(await composeOverview(pool));
    } catch (err) {
      console.error('[outcome-intelligence] overview error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Literal sub-paths registered BEFORE the /type/:type param so they aren't swallowed.
  app.get('/api/outcome-intelligence/ledger', flagGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const t = String(req.query.type ?? '').toLowerCase();
      const type = isOutcomeIntelType(t) ? t : undefined;
      const limit = req.query.limit != null ? Number(req.query.limit) : 100;
      res.json(await composeLedger(pool, type, limit));
    } catch (err) {
      console.error('[outcome-intelligence] ledger error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  app.get('/api/outcome-intelligence/certification', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json(await composeCertification(pool));
    } catch (err) {
      console.error('[outcome-intelligence] certification error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Task #308 — validated progression-outcome view (k-min-gated, demo-excluded, abstains honestly).
  app.get('/api/outcome-intelligence/progression', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json(await composeProgressionOutcomes(pool));
    } catch (err) {
      console.error('[outcome-intelligence] progression error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  app.get('/api/outcome-intelligence/type/:type', flagGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const t = String(req.params.type ?? '').toLowerCase();
      if (!isOutcomeIntelType(t)) {
        return res.status(400).json({ ok: false, error: 'invalid_outcome_type', allowed: OUTCOME_INTEL_TYPES });
      }
      res.json(await composeType(pool, t));
    } catch (err) {
      console.error('[outcome-intelligence] type error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  console.log('[outcome-intelligence] MX-102X routes registered — unified six-type outcome surface (read-only, abstains < k_min)');
}
