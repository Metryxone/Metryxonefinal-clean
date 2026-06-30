/**
 * CAPADEX 3.0 — Program 1 · Phase 1.4 Customer Journey Completion routes (read-only composer).
 *
 * Serves the ONE canonical Customer Journey Model + measured coverage + classified gaps:
 *   - GET /api/customer-journey/enabled    flag probe (flag state isn't sensitive; 503 when OFF)
 *   - GET /api/admin/customer-journey/model        canonical spine + templates + per-persona journeys + axes
 *   - GET /api/admin/customer-journey/coverage     per-journey status + evidence VERIFIED vs live FS+DB
 *   - GET /api/admin/customer-journey/gaps         classified remaining journey gaps
 *   - GET /api/admin/customer-journey/summary      rollup + enterprise-ready verdict
 *   - GET /api/admin/customer-journey/outcome-tail ADOPTION of the reuse-instrumented outcome tail (Adoption⟂Coverage)
 *   - GET /api/admin/customer-journey/outcomes/persona  persona⟂outcome read-time-join linkage (k-anon suppressed)
 *
 * Strictly additive + reversible + flag-gated (`customerJourneyCompletion`,
 * FF_CUSTOMER_JOURNEY_COMPLETION, default OFF):
 *   - OFF → every route 503 → byte-identical legacy behaviour (no schema touched).
 *   - GET-only; reads via to_regclass probes / fs existence checks and NEVER writes (no DDL anywhere).
 *   - Never throws: any unexpected error degrades to a 200 honest-degraded JSON.
 *   - Detail routes are super-admin (mounted under /api/admin → global auth gate also applies).
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  CUSTOMER_JOURNEY_MODEL,
  CANONICAL_SPINE,
  JOURNEY_TEMPLATES,
  JOURNEY_AXES,
  DUPLICATE_ENTRANCES,
} from '../config/customer-journey';
import {
  composeCoverage,
  composeSummary,
  composeOutcomeTailAdoption,
  composePersonaOutcomeLinkage,
  JOURNEY_GAPS,
} from '../services/customer-journey-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('customerJourneyCompletion')) {
    return res.status(503).json({ ok: false, error: 'customer_journey_completion_disabled' });
  }
  next();
}

export function registerCustomerJourneyRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // Flag probe (flag STATE is not sensitive). flagGate first → 503 when OFF; res.ok=true only when ON.
  app.get('/api/customer-journey/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // Canonical journey model (static registry — no DB read).
  app.get('/api/admin/customer-journey/model', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true,
        spine_frozen: true,
        axes: JOURNEY_AXES,
        spine: CANONICAL_SPINE,
        templates: JOURNEY_TEMPLATES,
        journeys: CUSTOMER_JOURNEY_MODEL,
        duplicate_entrances: DUPLICATE_ENTRANCES,
      });
    } catch (err) {
      console.error('[customer-journey] model error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Per-journey coverage — evidence VERIFIED against the live filesystem + DB (SSoT for present/absent).
  app.get('/api/admin/customer-journey/coverage', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, coverage: await composeCoverage(pool) });
    } catch (err) {
      console.error('[customer-journey] coverage error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Classified remaining gaps.
  app.get('/api/admin/customer-journey/gaps', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, gaps: JOURNEY_GAPS });
    } catch (err) {
      console.error('[customer-journey] gaps error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Rollup + enterprise-ready verdict.
  app.get('/api/admin/customer-journey/summary', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, summary: await composeSummary(pool) });
    } catch (err) {
      console.error('[customer-journey] summary error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Outcome-tail ADOPTION — how much the reuse-instrumented universal close-the-loop tail is exercised.
  app.get('/api/admin/customer-journey/outcome-tail', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, outcome_tail: await composeOutcomeTailAdoption(pool) });
    } catch (err) {
      console.error('[customer-journey] outcome-tail error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Persona⟂Outcome linkage — read-time join validation (k-anon suppressed), Coverage⟂Outcome kept separate.
  app.get('/api/admin/customer-journey/outcomes/persona', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, persona_linkage: await composePersonaOutcomeLinkage(pool) });
    } catch (err) {
      console.error('[customer-journey] persona-linkage error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });
}
