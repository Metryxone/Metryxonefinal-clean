/**
 * MX-103X — Live Employer Ecosystem routes (read-only audit + certification console).
 *
 * COMPOSES the already-built employer hiring funnel into one honest certification surface:
 *   - GET /api/admin/employer-ecosystem/enabled        flag probe (super-admin console nav gating)
 *   - GET /api/admin/employer-ecosystem/audit          full per-stage funnel audit (Coverage ⟂ Confidence)
 *   - GET /api/admin/employer-ecosystem/certification  honest PARTIAL/OPERATIONAL verdict + reasons
 *
 * Strictly additive + reversible + flag-gated (`liveEmployerEcosystem`, FF_LIVE_EMPLOYER_ECOSYSTEM, default OFF):
 *   - OFF → every route 503 before any DB touch → byte-identical legacy behaviour (no schema touched).
 *   - GET-only; the engine reads via to_regclass probes and NEVER writes (no DDL anywhere).
 *   - Never throws: any unexpected error degrades to a 200 honest-degraded JSON.
 *
 * These routes live under /api/admin/* (already auth+super-admin gated globally); requireAuth /
 * requireSuperAdmin are also passed explicitly for defense-in-depth.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import { runEmployerEcosystemAudit } from '../services/employer-ecosystem-audit-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('liveEmployerEcosystem')) {
    return res.status(503).json({ ok: false, error: 'live_employer_ecosystem_disabled' });
  }
  next();
}

export function registerEmployerEcosystemRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // Flag probe — flagGate runs first so res.ok=true only when activation is ON.
  // Lets the SuperAdmin UI hide the tab byte-identically when OFF.
  app.get('/api/admin/employer-ecosystem/enabled', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  app.get('/api/admin/employer-ecosystem/audit', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json(await runEmployerEcosystemAudit(pool));
    } catch (err) {
      console.error('[employer-ecosystem] audit error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  app.get('/api/admin/employer-ecosystem/certification', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const audit = await runEmployerEcosystemAudit(pool);
      res.json({
        ok: true,
        version: audit.version,
        generatedAt: audit.generatedAt,
        kMin: audit.kMin,
        verdict: audit.verdict,
        verdictReasons: audit.verdictReasons,
        summary: audit.summary,
        stages: audit.stages.map((s) => ({
          id: s.id,
          name: s.name,
          criterion: s.criterion,
          status: s.status,
          coverage: s.coverage,
          confidence: s.confidence,
          flagEnabled: s.flagEnabled,
          realRows: s.realRows,
          demoRows: s.demoRows,
          note: s.note,
        })),
        demoTransparency: audit.demoTransparency,
        generatedNote: audit.generatedNote,
      });
    } catch (err) {
      console.error('[employer-ecosystem] certification error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });
}
