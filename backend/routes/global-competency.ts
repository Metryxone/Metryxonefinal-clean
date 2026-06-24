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
  resolveRegionContent,
  assignRegionContent,
  rollbackRegionContent,
  untagRegionContent,
  recordRegionAudit,
  listRegionAudit,
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

/** Resolve the acting super-admin from the authenticated session for the audit trail. */
function auditActor(req: Request): { id?: string | null; email?: string | null } {
  const u = (req as any).user ?? {};
  return { id: u.id != null ? String(u.id) : null, email: u.email ?? u.username ?? null };
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

  // ── GET content/:region — region-aware LOCALIZED content read (read-only) ─────────────────────
  // Default region serves base content; non-default regions serve ONLY their curated overlay
  // (never silently falling back to the base/un-localized set).
  app.get('/api/global-competency/content/:region', flagGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const region = String(req.params.region ?? '').toUpperCase();
      if (!isValidRegion(region)) {
        return res.status(400).json({ ok: false, error: 'invalid_region', allowed: REGIONS.map((r) => r.code) });
      }
      const rawLimit = Number(req.query.limit);
      const limit = Number.isFinite(rawLimit) ? rawLimit : undefined;
      const content = await resolveRegionContent(pool, region as RegionCode, { limit });
      return res.json({ ok: true, ...content, read_only: true });
    } catch (err) {
      console.error('[global-competency] region content error:', err);
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
        // Record the rejected attempt: nothing applied, every ref rejected (honesty preserved).
        await recordRegionAudit(pool, {
          action: 'assign',
          surface,
          region,
          actor: auditActor(req),
          requestedRefs: refs,
          appliedRefs: [],
          rejectedRefs: result.rejected_refs,
          detail: { outcome: 'rejected', written: 0, skipped: 0, note: typeof b.detail?.note === 'string' ? b.detail.note : undefined },
        });
        return res.status(400).json({ ok: false, error: 'no_valid_entity_refs', ...result });
      }
      // Record the applied attempt: applied_refs are the real tagged entities; rejected_refs stay
      // recorded as rejected, never as applied.
      await recordRegionAudit(pool, {
        action: 'assign',
        surface,
        region,
        actor: auditActor(req),
        requestedRefs: refs,
        appliedRefs: result.applied_refs,
        rejectedRefs: result.rejected_refs,
        detail: { outcome: 'applied', written: result.written, skipped: result.skipped, note: typeof b.detail?.note === 'string' ? b.detail.note : undefined },
      });
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[global-competency] assign error:', err);
      return res.status(500).json({ ok: false, error: 'assign_failed' });
    }
  });

  // ── POST rollback — remove overlay rows (full reversibility) ──────────────────────────────────
  // Two modes (both reversible, both delete ONLY overlay rows — never the backing entity):
  //   • TARGETED untag: body has surface + region + entity_refs → drop just those overlay rows
  //     (the granular inverse of /assign, so a single curated entity can be un-tagged).
  //   • BULK rollback: no surface/refs → delete every overlay row for the provenance (default phase8).
  app.post('/api/global-competency/rollback', flagGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const b = (req.body ?? {}) as Record<string, any>;
      const refs = Array.isArray(b.entity_refs) ? b.entity_refs.map((x: any) => String(x)) : [];
      const hasSurface = b.surface != null && String(b.surface) !== '';

      // Targeted untag path — requires a valid surface, region, and at least one ref.
      if (hasSurface || refs.length) {
        const surface = String(b.surface ?? '');
        if (!isValidSurface(surface)) {
          return res.status(400).json({ ok: false, error: 'invalid_surface', allowed: SURFACES.map((s) => s.key) });
        }
        const region = String(b.region ?? '').toUpperCase();
        if (!isValidRegion(region)) {
          return res.status(400).json({ ok: false, error: 'invalid_region', allowed: REGIONS.map((r) => r.code) });
        }
        if (!refs.length) {
          return res.status(400).json({ ok: false, error: 'entity_refs_required' });
        }
        const result = await untagRegionContent(pool, {
          surface: surface as SurfaceKey,
          region: region as RegionCode,
          entityRefs: refs,
        });
        // Audit: applied = refs actually deleted; requested-but-absent refs are NOT counted applied.
        const notDeleted = result.requested_refs.filter((r) => !result.deleted_refs.includes(r));
        await recordRegionAudit(pool, {
          action: 'untag',
          surface,
          region,
          actor: auditActor(req),
          requestedRefs: result.requested_refs,
          appliedRefs: result.deleted_refs,
          rejectedRefs: notDeleted,
          detail: { outcome: 'untagged', deleted: result.deleted, not_present: notDeleted.length },
        });
        return res.json({ ok: true, mode: 'targeted', surface, region, ...result });
      }

      // Bulk rollback path (legacy behaviour) — delete all overlay rows for the provenance.
      const provenance = b.provenance ? String(b.provenance) : undefined;
      const result = await rollbackRegionContent(pool, provenance);
      await recordRegionAudit(pool, {
        action: 'rollback',
        surface: null,
        region: null,
        actor: auditActor(req),
        requestedRefs: [],
        appliedRefs: [],
        rejectedRefs: [],
        detail: { outcome: 'bulk_rollback', provenance: provenance ?? 'phase8_global_competency', deleted: result.deleted },
      });
      return res.json({ ok: true, mode: 'bulk', ...result });
    } catch (err) {
      console.error('[global-competency] rollback error:', err);
      return res.status(500).json({ ok: false, error: 'rollback_failed' });
    }
  });

  // ── GET audit — read-only history of region-content changes (who/what/when) ───────────────────
  // Records every assign / untag / bulk rollback with actor + applied vs rejected refs. Read-only:
  // to_regclass-probed (never DDL on a read). `present:false` = no audit table yet (distinct empty).
  app.get('/api/global-competency/audit', flagGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const region = String(req.query.region ?? '').toUpperCase();
      const surface = String(req.query.surface ?? '');
      if (region && !isValidRegion(region)) {
        return res.status(400).json({ ok: false, error: 'invalid_region', allowed: REGIONS.map((r) => r.code) });
      }
      if (surface && !isValidSurface(surface)) {
        return res.status(400).json({ ok: false, error: 'invalid_surface', allowed: SURFACES.map((s) => s.key) });
      }
      const rawLimit = Number(req.query.limit);
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined;
      const log = await listRegionAudit(pool, {
        region: region || undefined,
        surface: surface || undefined,
        limit,
      });
      return res.json({ ok: true, version: GLOBAL_COMPETENCY_VERSION, ...log, read_only: true });
    } catch (err) {
      console.error('[global-competency] audit list error:', err);
      return res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  console.log('[global-competency] Phase 8 routes registered — region registry + coverage + reversible assign + audit trail');
}
