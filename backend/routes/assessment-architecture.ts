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
 *   - GET /api/admin/assessment-architecture/gaps         0 OPEN gaps + 9 RESOLVED (engineering-closed)
 *   - GET /api/admin/assessment-architecture/summary      5 axes reported SEPARATELY + certification verdict
 *
 * ENGINEERING-CLOSURE MECHANISMS (AP-1..AP-9, reuse-before-build; DDL runs ONLY on the POST paths):
 *   - GET  /api/admin/assessment-architecture/standardization      AP-7 canonical T/stanine/sten transforms
 *   - GET  /api/admin/assessment-architecture/norm-groups          AP-4/5/6 group-norm coverage
 *   - POST /api/admin/assessment-architecture/norm-groups/compute  AP-4/5/6 compute { type } (k_min, abstains)
 *   - GET  /api/admin/assessment-architecture/bloom                AP-1 Bloom coverage
 *   - POST /api/admin/assessment-architecture/bloom/classify       AP-1 classify clarity bank
 *   - GET  /api/admin/assessment-architecture/prompts              AP-9 prompt-registry coverage
 *   - POST /api/admin/assessment-architecture/prompts/register     AP-9 register code-embedded prompts
 *   - GET  /api/admin/assessment-architecture/country-cohorts      AP-8 registered country cohorts
 *   - POST /api/admin/assessment-architecture/country-cohorts/register  AP-8 register { cohorts:[] }
 *
 * Strictly additive + reversible + flag-gated (`assessmentArchitectureCompletion`,
 * FF_ASSESSMENT_ARCHITECTURE_COMPLETION, default OFF):
 *   - OFF → every route 503 (503-before-auth) → byte-identical legacy behaviour incl. schema (no table touched).
 *   - GET certification routes are read-only (to_regclass probes / fs existence). The mechanism POSTs are the
 *     ONLY DDL sites — they run behind the flag + super-admin, so OFF creates 0 tables.
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
import { standardScoresFromZ } from '../services/psychometric-standardization';
import {
  computeGroupNorms, classifyClarityBank, bloomCoverage,
  registerCountryCohorts, listCountryCohorts,
  type NormGroupType, type CountryCohortInput, ASSESSMENT_NORM_K_MIN,
} from '../services/assessment-architecture-mechanisms';
import { registerCodeEmbeddedPrompts, registryCoverage } from '../services/prompt-registry-activation';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

const NORM_GROUP_TYPES: NormGroupType[] = ['gender', 'education_tier', 'competitive_exam', 'country'];

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

  // Classified gaps — 0 OPEN (all nine AP-1..AP-9 engineering-closed) + 9 RESOLVED via reuse.
  app.get('/api/admin/assessment-architecture/gaps', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();
      res.json({ ok: true, gaps, gap_counts, gap_total: gaps.length, resolved_gaps, resolved_gap_counts, resolved_gap_count });
    } catch (err) { degraded(res, 'gaps', err); }
  });

  // ── AP-7 standardization (pure canonical T/stanine/sten transforms — no DB, no write) ──
  app.get('/api/admin/assessment-architecture/standardization', flagGate, requireAuth, requireSuperAdmin, (req: Request, res: Response) => {
    try {
      const z = req.query.z != null ? Number(req.query.z) : null;
      res.json({
        ok: true,
        note: 'T-score SD=10 (canonical); deviation_score SD=15 (legacy 50+z*15, honestly labelled — never "T").',
        example: standardScoresFromZ(Number.isFinite(z as number) ? (z as number) : 1),
        requested: z != null ? standardScoresFromZ(Number.isFinite(z) ? z : null) : null,
      });
    } catch (err) { degraded(res, 'standardization', err); }
  });

  // ── AP-4/5/6 norm-group coverage (read) ──
  app.get('/api/admin/assessment-architecture/norm-groups', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const rows = await pool.query(
        `SELECT norm_group_type, COUNT(*)::int AS rows,
                COUNT(*) FILTER (WHERE is_provisional = false)::int AS established,
                COUNT(*) FILTER (WHERE is_provisional = true)::int  AS provisional
           FROM assessment_group_norms GROUP BY norm_group_type ORDER BY norm_group_type`,
      ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
      res.json({ ok: true, k_min: ASSESSMENT_NORM_K_MIN, groups: rows.rows, note: 'null≠0: absent group = dimension not yet captured, not zero people.' });
    } catch (err) { degraded(res, 'norm-groups', err); }
  });

  // ── AP-4/5/6 compute a group norm (DDL site — flag-gated + super-admin; abstains when insufficient) ──
  app.post('/api/admin/assessment-architecture/norm-groups/compute', flagGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const type = String(req.body?.type || '') as NormGroupType;
      if (!NORM_GROUP_TYPES.includes(type)) return res.status(400).json({ ok: false, error: 'invalid_type', allowed: NORM_GROUP_TYPES });
      res.json({ ok: true, result: await computeGroupNorms(pool, type) });
    } catch (err) { degraded(res, 'norm-groups-compute', err); }
  });

  // ── AP-1 Bloom (read + classify) ──
  app.get('/api/admin/assessment-architecture/bloom', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, coverage: await bloomCoverage(pool) }); }
    catch (err) { degraded(res, 'bloom', err); }
  });

  app.post('/api/admin/assessment-architecture/bloom/classify', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, result: await classifyClarityBank(pool) }); }
    catch (err) { degraded(res, 'bloom-classify', err); }
  });

  // ── AP-9 prompt registry (read + register) ──
  app.get('/api/admin/assessment-architecture/prompts', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, coverage: await registryCoverage(pool) }); }
    catch (err) { degraded(res, 'prompts', err); }
  });

  app.post('/api/admin/assessment-architecture/prompts/register', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, result: await registerCodeEmbeddedPrompts(pool) }); }
    catch (err) { degraded(res, 'prompts-register', err); }
  });

  // ── AP-8 country cohorts (read + register) ──
  app.get('/api/admin/assessment-architecture/country-cohorts', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, cohorts: await listCountryCohorts(pool) }); }
    catch (err) { degraded(res, 'country-cohorts', err); }
  });

  app.post('/api/admin/assessment-architecture/country-cohorts/register', flagGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const cohorts = Array.isArray(req.body?.cohorts) ? (req.body.cohorts as CountryCohortInput[]) : [];
      const valid = cohorts.filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.geography === 'string');
      if (!valid.length) return res.status(400).json({ ok: false, error: 'no_valid_cohorts', shape: '{ cohorts:[{id,name,geography,filters?}] }' });
      res.json({ ok: true, result: await registerCountryCohorts(pool, valid) });
    } catch (err) { degraded(res, 'country-cohorts-register', err); }
  });

  // Summary — the FIVE axes reported SEPARATELY + certification verdict (never composited).
  app.get('/api/admin/assessment-architecture/summary', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, summary: await composeSummary(pool) });
    } catch (err) { degraded(res, 'summary', err); }
  });
}
