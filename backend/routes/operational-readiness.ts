/**
 * CAPADEX 3.0 — Program 2 · Phase 2.5 Observability, Monitoring & Operational Readiness.
 *
 * READ-ONLY routes over `services/operational-readiness-engine.ts`.
 *  - `/api/operational-readiness/enabled` — ungated flag probe (200 {enabled:false} when OFF).
 *  - all data routes — flag-gate 503 BEFORE auth, then super-admin. GET-only + one explicit POST
 *    capture. Flag OFF → 503 before any auth/DB touch → byte-identical legacy (zero tables).
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isOperationalReadinessEnabled } from '../config/feature-flags';
import {
  composeCoverage,
  composeCertification,
  composeAdoption,
  composeGaps,
  composeValidation,
  composeSummary,
  captureOperationalSnapshot,
  getOperationalSnapshots,
  OPERATIONAL_MODEL,
} from '../services/operational-readiness-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => any;

export function registerOperationalReadinessRoutes(app: Express, pool: Pool, requireAuth: Mw, requireSuperAdmin: Mw) {
  // Flag gate — 503 BEFORE auth so OFF is byte-identical (no auth/DB work).
  const gate: Mw = (_req, res, next) => {
    if (!isOperationalReadinessEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'operationalReadiness', note: 'Phase 2.5 Operational Readiness is OFF — byte-identical legacy behaviour.' });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];
  const safe = (fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
    try { await fn(req, res); } catch (e: any) {
      res.status(200).json({ ready: false, error: 'measurement_error', note: 'Read-only composer error — honest unavailable, never a fabricated value.', detail: String(e?.message || e) });
    }
  };

  // Ungated probe (mirrors the CAPADEX 3.0 program convention).
  app.get('/api/operational-readiness/enabled', (_req: Request, res: Response) => {
    res.json({ enabled: isOperationalReadinessEnabled(), phase: OPERATIONAL_MODEL.OPERATIONAL_MODEL_META.phase });
  });

  app.get('/api/operational-readiness/model', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, ...OPERATIONAL_MODEL });
  }));

  app.get('/api/operational-readiness/coverage', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, coverage: await composeCoverage(pool) });
  }));

  app.get('/api/operational-readiness/certification', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, certification: await composeCertification(pool) });
  }));

  app.get('/api/operational-readiness/adoption', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, adoption: await composeAdoption(pool) });
  }));

  app.get('/api/operational-readiness/gaps', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, gaps: composeGaps() });
  }));

  app.get('/api/operational-readiness/validation', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, validation: await composeValidation(pool) });
  }));

  app.get('/api/operational-readiness/summary', ...guards, safe(async (_req, res) => {
    res.json({ ready: true, summary: await composeSummary(pool) });
  }));

  // Snapshot history (literal sub-path BEFORE any :param — no params here, kept explicit).
  app.get('/api/operational-readiness/snapshots', ...guards, safe(async (req, res) => {
    const limit = Number(req.query.limit) || 20;
    res.json(await getOperationalSnapshots(pool, { limit }));
  }));

  // The ONLY write path — explicit snapshot capture (flag-ON; owns its lazy ensure-schema).
  app.post('/api/operational-readiness/audit/capture', ...guards, safe(async (req, res) => {
    const actor = (req as any).user?.email ?? (req as any).user?.id ?? null;
    res.json(await captureOperationalSnapshot(pool, actor == null ? null : String(actor)));
  }));
}
