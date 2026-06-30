/**
 * CAPADEX 3.0 — Phase 1.8 · Program-1 Product Certification routes (read-only composer capstone).
 *
 * Serves the read-only certification of everything built in Phases 1.1–1.7 against the frozen
 * Product Blueprint: a Product Traceability Matrix, four INDEPENDENT certification axes (never
 * composited), a gap register, and the verdict (STRUCTURAL_CERTIFIED; Production-Ready WITHHELD).
 *   - GET /api/program1-certification/enabled         flag probe — UNGATED, always 200 {enabled:bool}
 *   - GET /api/admin/program1-certification/feature-flag   flag descriptor (gated)
 *   - GET /api/admin/program1-certification/model     frozen registry (phases/chain/domains/personas/dimensions)
 *   - GET /api/admin/program1-certification/certification  full certification composition
 *   - GET /api/admin/program1-certification/traceability   product traceability matrix only
 *   - GET /api/admin/program1-certification/gaps      gap register + severity rollup
 *   - GET /api/admin/program1-certification/summary   rollup + STRUCTURAL verdict (separate axes)
 *
 * Strictly additive + reversible + flag-gated (`productTraceabilityCertification`,
 * FF_PRODUCT_TRACEABILITY_CERTIFICATION, default OFF):
 *   - OFF → every DATA/admin route 503 → byte-identical legacy (no schema touched, owns 0 tables).
 *   - GET-only; reads via fs existence checks + prior phases' read-only getters (each ONCE); NEVER writes.
 *   - Never throws: any unexpected error degrades to a 200 honest-degraded JSON.
 *   - Detail routes are super-admin (mounted under /api/admin → global auth gate also applies).
 *   - Engines are read by existence / persisted output — NEVER invoked. Human approval mandatory.
 *   - 4 axes + Coverage⟂Confidence⟂Outcome⟂Adoption are NEVER composited; null≠0; never fabricate.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  PROGRAM1_PHASES, PROGRAM1_FREEZE, TRACEABILITY_CHAIN, BUSINESS_DOMAINS, PERSONAS,
  LIFECYCLE_STAGES, CERTIFICATION_DIMENSIONS, GAP_SEVERITIES, PROGRAM1_GAPS, HONESTY_CONTRACT,
  PHASE_META,
} from '../config/program1-certification-model';
import { composeCertification, composeCertificationSummary } from '../services/program1-certification-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('productTraceabilityCertification')) {
    return res.status(503).json({ ok: false, error: 'product_traceability_certification_disabled' });
  }
  next();
}

const degraded = (res: Response) =>
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });

export function registerProgram1CertificationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // Flag probe — UNGATED so the frontend can detect flag state. Always 200; only DATA routes 503 OFF.
  app.get('/api/program1-certification/enabled', async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: isFlagEnabled('productTraceabilityCertification') });
  });

  // Flag descriptor (gated).
  app.get('/api/admin/program1-certification/feature-flag', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true,
        flag: PHASE_META.flag,
        env: 'FF_PRODUCT_TRACEABILITY_CERTIFICATION',
        public_config_key: PHASE_META.publicConfigKey,
        enabled: isFlagEnabled('productTraceabilityCertification'),
        default: false,
        capstone: true,
      });
    } catch (err) { console.error('[program1-cert] feature-flag error:', err); degraded(res); }
  });

  // Frozen registry (static — no DB read).
  app.get('/api/admin/program1-certification/model', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true,
        meta: PHASE_META,
        freeze: PROGRAM1_FREEZE,
        phases: PROGRAM1_PHASES,
        traceability_chain: TRACEABILITY_CHAIN,
        domains: BUSINESS_DOMAINS,
        personas: PERSONAS,
        lifecycle_stages: LIFECYCLE_STAGES,
        dimensions: CERTIFICATION_DIMENSIONS,
        gap_severities: GAP_SEVERITIES,
        gaps: PROGRAM1_GAPS,
        honesty_contract: HONESTY_CONTRACT,
      });
    } catch (err) { console.error('[program1-cert] model error:', err); degraded(res); }
  });

  // Full certification composition.
  app.get('/api/admin/program1-certification/certification', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, certification: await composeCertification(pool) });
    } catch (err) { console.error('[program1-cert] certification error:', err); degraded(res); }
  });

  // Product traceability matrix only.
  app.get('/api/admin/program1-certification/traceability', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const c = await composeCertification(pool);
      res.json({ ok: true, traceability: c.traceability });
    } catch (err) { console.error('[program1-cert] traceability error:', err); degraded(res); }
  });

  // Gap register + severity rollup.
  app.get('/api/admin/program1-certification/gaps', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const c = await composeCertification(pool);
      res.json({ ok: true, gaps: c.gaps, gap_rollup: c.gap_rollup });
    } catch (err) { console.error('[program1-cert] gaps error:', err); degraded(res); }
  });

  // Rollup + STRUCTURAL verdict (axes reported separately, never composited).
  app.get('/api/admin/program1-certification/summary', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, summary: await composeCertificationSummary(pool) });
    } catch (err) { console.error('[program1-cert] summary error:', err); degraded(res); }
  });
}
