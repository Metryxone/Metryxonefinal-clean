/**
 * CAPADEX 3.0 — Persona Model EXPANSION routes (read-only composer).
 *
 * Surfaces deliverable-10 gaps G-F5 (per-persona realized-outcome breakdown) and
 * G-F6 (NON-CLINICAL vertical scaffold registry):
 *   - GET /api/persona-expansion/enabled    flag probe (no auth; flag state isn't sensitive)
 *   - GET /api/persona-expansion/outcomes   per-persona coverage ⟂ outcome ⟂ confidence (honest-null until linked)
 *   - GET /api/persona-expansion/verticals  G-F6 non-clinical scaffold registry + disclaimers
 *
 * Strictly additive + reversible + flag-gated (`personaModelExpansion`,
 * FF_PERSONA_MODEL_EXPANSION, default OFF):
 *   - OFF → every route 503 → byte-identical legacy behaviour (no schema touched).
 *   - GET-only; the composer reads via to_regclass probes / SELECTs and NEVER writes (no DDL anywhere).
 *   - Never throws: any unexpected error degrades to a 200 honest-degraded JSON.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  composePersonaOutcomes,
  composeVerticalScaffolds,
} from '../services/persona-expansion-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('personaModelExpansion')) {
    return res.status(503).json({ ok: false, error: 'persona_model_expansion_disabled' });
  }
  next();
}

export function registerPersonaExpansionRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // Flag probe (flag STATE is not sensitive). flagGate first → 503 when OFF; res.ok=true only when ON.
  app.get('/api/persona-expansion/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // G-F5 — per-persona realized-outcome breakdown (super-admin; composes MX-102X).
  app.get('/api/persona-expansion/outcomes', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json(await composePersonaOutcomes(pool));
    } catch (err) {
      console.error('[persona-expansion] outcomes error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // G-F6 — non-clinical vertical scaffold registry (super-admin; static, no DB read).
  app.get('/api/persona-expansion/verticals', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json(composeVerticalScaffolds());
    } catch (err) {
      console.error('[persona-expansion] verticals error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });
}
