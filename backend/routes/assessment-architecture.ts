/**
 * CAPADEX 3.0 — Program 3 · Phase 3.1 Assessment Architecture CERTIFICATION routes (read-only composer).
 *
 * Serves the ONE canonical Assessment Architecture model + measured, live-verified certification of
 * FIVE INDEPENDENT axes (architecture · lifecycle · governance · metadata · repository-alignment):
 *   - GET /api/assessment-architecture/enabled            flag probe (flag state isn't sensitive; 503 when OFF)
 *   - GET /api/admin/assessment-architecture/model        canonical registry (layers/taxonomy/categories/lifecycle/governance/metadata/mapping)
 *   - GET /api/admin/assessment-architecture/architecture axis 1 — 13-layer coverage, evidence VERIFIED vs live FS+DB
 *   - GET /api/admin/assessment-architecture/lifecycle    axis 2 — 10-state model + per-artifact mapping verified
 *   - GET /api/admin/assessment-architecture/governance   axis 3 — control-plane model verified
 *   - GET /api/admin/assessment-architecture/metadata     axis 4 — 18-field standard + per-source coverage crosswalk
 *   - GET /api/admin/assessment-architecture/repository-alignment  axis 5 — evidence rollup vs live FS+DB
 *   - GET /api/admin/assessment-architecture/gaps         classified additive gaps (0 Launch-Critical/0 High)
 *   - GET /api/admin/assessment-architecture/summary      5 axes reported SEPARATELY + certification verdict
 *
 * Strictly additive + reversible + flag-gated (`assessmentArchitectureCompletion`,
 * FF_ASSESSMENT_ARCHITECTURE_COMPLETION, default OFF):
 *   - OFF → every route 503 (503-before-auth) → byte-identical legacy behaviour (no schema touched).
 *   - GET-only; reads via to_regclass probes / fs existence checks and NEVER writes (no DDL anywhere).
 *   - Never throws: any unexpected error degrades to a 200 honest-degraded JSON.
 *   - Detail routes are super-admin (mounted under /api/admin → global auth gate also applies).
 *   - The FIVE axes are reported SEPARATELY and NEVER composited; Coverage⟂Confidence⟂Adoption; null≠0.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  ARCHITECTURE_AXES,
  ARCHITECTURE_LAYERS,
  ASSESSMENT_FAMILIES,
  CANONICAL_TYPES,
  TYPE_CROSSWALK,
  ASSESSMENT_CATEGORIES,
  LIFECYCLE_STATES,
  LIFECYCLE_MAPPING,
  GOVERNANCE_CONTROLS,
  METADATA_STANDARD,
  METADATA_SOURCE_COVERAGE,
  MAPPING_MODEL,
  ARCHITECTURE_DECISIONS,
  OVERLAP_DECISIONS,
} from '../config/assessment-architecture';
import {
  composeArchitecture,
  composeLifecycle,
  composeGovernance,
  composeMetadata,
  composeRepositoryAlignment,
  composeSummary,
  classifiedGaps,
} from '../services/assessment-architecture-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('assessmentArchitectureCompletion')) {
    return res.status(503).json({ ok: false, error: 'assessment_architecture_completion_disabled' });
  }
  next();
}

function degraded(res: Response, tag: string, err: unknown) {
  console.error(`[assessment-architecture] ${tag} error:`, err);
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
}

export function registerAssessmentArchitectureRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // Flag probe (flag STATE is not sensitive). flagGate first → 503 when OFF; res.ok=true only when ON.
  app.get('/api/assessment-architecture/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // Canonical architecture model (static registry — no DB read).
  app.get('/api/admin/assessment-architecture/model', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true,
        architecture_frozen: true,
        axes: ARCHITECTURE_AXES,
        layers: ARCHITECTURE_LAYERS,
        families: ASSESSMENT_FAMILIES,
        taxonomy: CANONICAL_TYPES,
        type_crosswalk: TYPE_CROSSWALK,
        categories: ASSESSMENT_CATEGORIES,
        lifecycle_states: LIFECYCLE_STATES,
        lifecycle_mapping: LIFECYCLE_MAPPING,
        governance_controls: GOVERNANCE_CONTROLS,
        metadata_standard: METADATA_STANDARD,
        metadata_source_coverage: METADATA_SOURCE_COVERAGE,
        mapping_model: MAPPING_MODEL,
        decisions: ARCHITECTURE_DECISIONS,
        overlaps: OVERLAP_DECISIONS,
      });
    } catch (err) { degraded(res, 'model', err); }
  });

  // Axis 1 — architecture: 13-layer coverage, evidence VERIFIED vs live FS+DB (SSoT for present/absent).
  app.get('/api/admin/assessment-architecture/architecture', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, architecture: await composeArchitecture(pool) });
    } catch (err) { degraded(res, 'architecture', err); }
  });

  // Axis 2 — lifecycle: ONE 10-state model + per-artifact mapping verified vs live DB/FS.
  app.get('/api/admin/assessment-architecture/lifecycle', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, lifecycle: await composeLifecycle(pool) });
    } catch (err) { degraded(res, 'lifecycle', err); }
  });

  // Axis 3 — governance: control-plane model, evidence verified.
  app.get('/api/admin/assessment-architecture/governance', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, governance: await composeGovernance(pool) });
    } catch (err) { degraded(res, 'governance', err); }
  });

  // Axis 4 — metadata: 18-field standard + per-source coverage crosswalk.
  app.get('/api/admin/assessment-architecture/metadata', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, metadata: await composeMetadata(pool) });
    } catch (err) { degraded(res, 'metadata', err); }
  });

  // Axis 5 — repository-alignment: evidence rollup verified vs live FS+DB.
  app.get('/api/admin/assessment-architecture/repository-alignment', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, repository_alignment: await composeRepositoryAlignment(pool) });
    } catch (err) { degraded(res, 'repository-alignment', err); }
  });

  // Classified remaining ARCHITECTURE gaps (additive; 0 Launch-Critical / 0 High). Honest OPEN work.
  app.get('/api/admin/assessment-architecture/gaps', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const { gaps, gap_counts } = classifiedGaps();
      res.json({ ok: true, gaps, gap_counts, gap_total: gaps.length });
    } catch (err) { degraded(res, 'gaps', err); }
  });

  // Summary — the FIVE axes reported SEPARATELY + certification verdict (never composited).
  app.get('/api/admin/assessment-architecture/summary', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, summary: await composeSummary(pool) });
    } catch (err) { degraded(res, 'summary', err); }
  });
}
