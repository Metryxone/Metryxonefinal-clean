/**
 * PHASE 8 — Global Competency routes (structural framework; additive, reversible, flag-gated).
 *
 * Read-only admin surface + reversible region-tagging for the global region dimension:
 *   - GET  /api/global-competency/regions          canonical region registry (IN default)
 *   - GET  /api/global-competency/coverage         per-region × per-surface coverage (read-only)
 *   - GET  /api/global-competency/coverage/:region single-region coverage detail
 *   - POST /api/global-competency/assign           region-tag EXISTING entities (additive, idempotent)
 *   - POST /api/global-competency/rollback         delete this phase's overlay rows (reversible)
 *
 * Strictly additive + reversible + flag-gated (`globalCompetency`, FF_GLOBAL_COMPETENCY, default OFF):
 *   - OFF → every route 503; ensure-schema is NEVER reached → the overlay table is never created →
 *     byte-identical legacy behaviour incl. schema (default region == today).
 *   - GET handlers use to_regclass PROBES (never DDL) so a read never writes.
 *   - ensure-schema runs ONLY on the POST paths, behind the flag.
 * Structural framework + coverage reporting ONLY — never authors/fabricates regional content.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  REGIONS,
  DEFAULT_REGION,
  SURFACES,
  isValidRegion,
  isValidSurface,
  computeRegionCoverage,
  computeRegionCoverageFor,
  assignRegionContent,
  rollbackRegionContent,
  GLOBAL_COMPETENCY_VERSION,
  type RegionCode,
  type SurfaceKey,
} from '../services/global-competency-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('globalCompetency')) {
    return res.status(503).json({ ok: false, error: 'global_competency_disabled' });
  }
  next();
}

export function registerGlobalCompetencyRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // ── GET regions — canonical registry (read-only) ─────────────────────────────────────────────
  app.get('/api/global-competency/regions', flagGate, requireAuth, requireSuperAdmin, (_req: Request, res: Response) => {
    return res.json({
      ok: true,
      version: GLOBAL_COMPETENCY_VERSION,
      default_region: DEFAULT_REGION,
      regions: REGIONS,
      surfaces: SURFACES,
      note: 'Default region (IN) == today. Non-default regions are empty until curated content is assigned.',
      read_only: true,
    });
  });

  // ── GET coverage — per-region × per-surface (read-only, to_regclass-probed) ───────────────────
  app.get('/api/global-competency/coverage', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const coverage = await computeRegionCoverage(pool);
      return res.json({ ok: true, ...coverage, read_only: true });
    } catch (err) {
      console.error('[global-competency] coverage error:', err);
      return res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // ── GET coverage/:region — single-region detail (literal /coverage registered first above) ────
  app.get('/api/global-competency/coverage/:region', flagGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const region = String(req.params.region ?? '').toUpperCase();
      if (!isValidRegion(region)) {
        return res.status(400).json({ ok: false, error: 'invalid_region', allowed: REGIONS.map((r) => r.code) });
      }
      const detail = await computeRegionCoverageFor(pool, region as RegionCode);
      return res.json({ ok: true, version: GLOBAL_COMPETENCY_VERSION, region: detail, read_only: true });
    } catch (err) {
      console.error('[global-competency] region coverage error:', err);
      return res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // ── POST assign — region-tag EXISTING entities (additive, idempotent, reversible) ─────────────
  app.post('/api/global-competency/assign', flagGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const b = (req.body ?? {}) as Record<string, any>;
      const surface = String(b.surface ?? '');
      if (!isValidSurface(surface)) {
        return res.status(400).json({ ok: false, error: 'invalid_surface', allowed: SURFACES.map((s) => s.key) });
      }
      const region = String(b.region ?? '').toUpperCase();
      if (!isValidRegion(region)) {
        return res.status(400).json({ ok: false, error: 'invalid_region', allowed: REGIONS.map((r) => r.code) });
      }
      const refs = Array.isArray(b.entity_refs) ? b.entity_refs.map((x: any) => String(x)) : [];
      if (!refs.length) {
        return res.status(400).json({ ok: false, error: 'entity_refs_required' });
      }
      const result = await assignRegionContent(pool, {
        surface: surface as SurfaceKey,
        region: region as RegionCode,
        entityRefs: refs,
        detail: typeof b.detail === 'object' && b.detail ? b.detail : {},
      });
      // Honesty guard: refs must be REAL existing entities. If none were valid, nothing was
      // tagged — return 400 so a caller can't believe coverage changed when it didn't.
      if (result.written === 0 && result.rejected > 0 && result.skipped === 0) {
        return res.status(400).json({ ok: false, error: 'no_valid_entity_refs', ...result });
      }
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[global-competency] assign error:', err);
      return res.status(500).json({ ok: false, error: 'assign_failed' });
    }
  });

  // ── POST rollback — delete this phase's overlay rows (full reversibility) ──────────────────────
  app.post('/api/global-competency/rollback', flagGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const provenance = (req.body ?? {}).provenance ? String((req.body as any).provenance) : undefined;
      const result = await rollbackRegionContent(pool, provenance);
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[global-competency] rollback error:', err);
      return res.status(500).json({ ok: false, error: 'rollback_failed' });
    }
  });

  console.log('[global-competency] Phase 8 routes registered — region registry + coverage + reversible assign');
}
