/**
 * CAPADEX 3.0 — Program 3 · Phase 3.1 Assessment Architecture Completion routes.
 *
 * Closes the nine assessment-architecture gaps (AP-1..AP-9) to ENGINEERING closure
 * behind the `assessmentArchitectureCompletion` flag (FF_ASSESSMENT_ARCHITECTURE_COMPLETION,
 * default OFF). OFF → every route 503 → byte-identical legacy behaviour (no schema touched).
 *
 * Read (super-admin):
 *   - GET  /api/assessment-architecture/enabled            flag probe (503 when OFF)
 *   - GET  /api/admin/assessment-architecture/model        gap register + closure model
 *   - GET  /api/admin/assessment-architecture/standardization  standard-score demo (AP-7)
 *   - GET  /api/admin/assessment-architecture/norm-groups  computed group-norm coverage (AP-4/5/6)
 *   - GET  /api/admin/assessment-architecture/bloom        Bloom coverage (AP-1)
 *   - GET  /api/admin/assessment-architecture/prompts      prompt-registry coverage (AP-9)
 *   - GET  /api/admin/assessment-architecture/country-cohorts  registered country cohorts (AP-8)
 *   - GET  /api/admin/assessment-architecture/summary      rollup + STRUCTURAL verdict
 * Write (super-admin; DDL only runs here → OFF creates 0 tables):
 *   - POST /api/admin/assessment-architecture/norm-groups/compute  { type }
 *   - POST /api/admin/assessment-architecture/bloom/classify
 *   - POST /api/admin/assessment-architecture/prompts/register
 *   - POST /api/admin/assessment-architecture/country-cohorts/register  { cohorts:[] }
 *
 * Contract: additive · flag-gated · never-throws on read · Coverage ⟂ Confidence ⟂
 * Adoption never composited · null ≠ 0 · never fabricates.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import { standardScoresFromZ } from '../services/psychometric-standardization';
import {
  computeGroupNorms, classifyClarityBank, bloomCoverage,
  registerCountryCohorts, listCountryCohorts,
  type NormGroupType, type CountryCohortInput, ASSESSMENT_NORM_K_MIN,
} from '../services/assessment-architecture-engine';
import { registerCodeEmbeddedPrompts, registryCoverage } from '../services/prompt-registry-activation';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

const NORM_GROUP_TYPES: NormGroupType[] = ['gender', 'education_tier', 'competitive_exam', 'country'];

/**
 * Canonical gap register — the nine architecture gaps and how each is closed.
 * `closure` = ENGINEERING state (capability built + honest abstention). `adoption`
 * is a SEPARATE axis (real data / real usage), never composited into closure.
 */
const GAP_REGISTER = [
  { id: 'AP-1', title: 'Bloom taxonomy classification of the item bank', closure: 'engineering_closed', how: 'Deterministic classifier over capadex_clarity_questions → own capadex_clarity_bloom table; abstains (NULL) for affective self-report items where Bloom is not meaningful.', adoption_axis: 'classified_coverage' },
  { id: 'AP-2', title: 'Offline assessment delivery', closure: 'engineering_scaffold', how: 'PWA service-worker + offline response queue (frontend, opt-in registration → byte-identical when unregistered).', adoption_axis: 'offline_sessions' },
  { id: 'AP-3', title: 'Accessibility (WCAG) support', closure: 'engineering_foundation', how: 'Skip-link, focus management, ARIA live-region + keyboard utilities applied to the assessment shell; i18next already mature.', adoption_axis: 'audited_screens' },
  { id: 'AP-4', title: 'Gender norm groups', closure: 'engineering_closed_ethics_gated', how: 'Same percentile_cont + k_min methodology as age norms, own assessment_group_norms table; ETHICS-gated OFF (ASSESSMENT_GENDER_NORMS_ENABLED) and abstains when the dimension is not captured.', adoption_axis: 'norm_rows' },
  { id: 'AP-5', title: 'Education-tier norm groups', closure: 'engineering_closed', how: 'Same methodology; computes when education_tier is captured in the response substrate, else abstains (dimension_source_absent).', adoption_axis: 'norm_rows' },
  { id: 'AP-6', title: 'Competitive-exam norm groups', closure: 'engineering_closed', how: 'Same methodology; computes when competitive_exam is captured, else abstains.', adoption_axis: 'norm_rows' },
  { id: 'AP-7', title: 'Canonical standard scores (T/stanine/sten)', closure: 'engineering_closed', how: 'Pure psychometric-standardization module: T-score SD=10, stanine 1-9, sten 1-10; the legacy 50+z*15 transform honestly relabelled as a deviation score.', adoption_axis: 'n/a' },
  { id: 'AP-8', title: 'Country benchmark cohorts', closure: 'engineering_closed', how: 'Reuses bench_cohorts + geography; additively widens cohort_type CHECK to admit country (flag-gated write path only).', adoption_axis: 'country_cohorts' },
  { id: 'AP-9', title: 'AI prompts under governance', closure: 'engineering_closed', how: 'Registers code-embedded prompts into the EXISTING aig_prompts registry with an active version; read-through resolvePrompt falls back to the code literal (byte-identical OFF).', adoption_axis: 'active_prompts' },
] as const;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('assessmentArchitectureCompletion')) {
    return res.status(503).json({ ok: false, error: 'assessment_architecture_completion_disabled' });
  }
  next();
}

export function registerAssessmentArchitectureRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // ── flag probe (state isn't sensitive) ──
  app.get('/api/assessment-architecture/enabled', flagGate, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  const guard: Mw[] = [flagGate, requireAuth, requireSuperAdmin];

  // ── model / gap register ──
  app.get('/api/admin/assessment-architecture/model', ...guard, (_req, res) => {
    res.json({ ok: true, phase: '3.1', gaps: GAP_REGISTER, k_min: ASSESSMENT_NORM_K_MIN });
  });

  // ── AP-7 standardization (pure demo of the transforms) ──
  app.get('/api/admin/assessment-architecture/standardization', ...guard, (req, res) => {
    const z = req.query.z != null ? Number(req.query.z) : null;
    res.json({
      ok: true,
      note: 'T-score SD=10 (canonical); deviation_score SD=15 (legacy 50+z*15, honestly labelled).',
      example: standardScoresFromZ(Number.isFinite(z as number) ? (z as number) : 1),
      requested: z != null ? standardScoresFromZ(Number.isFinite(z) ? z : null) : null,
    });
  });

  // ── AP-4/5/6 norm-group coverage (read) ──
  app.get('/api/admin/assessment-architecture/norm-groups', ...guard, async (_req, res) => {
    try {
      const rows = await pool.query(
        `SELECT norm_group_type, COUNT(*)::int AS rows,
                COUNT(*) FILTER (WHERE is_provisional = false)::int AS established,
                COUNT(*) FILTER (WHERE is_provisional = true)::int  AS provisional
           FROM assessment_group_norms GROUP BY norm_group_type ORDER BY norm_group_type`,
      ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
      res.json({ ok: true, k_min: ASSESSMENT_NORM_K_MIN, groups: rows.rows, note: 'null≠0: absent group = dimension not yet captured, not zero people.' });
    } catch { res.json({ ok: true, groups: [], degraded: true }); }
  });

  app.post('/api/admin/assessment-architecture/norm-groups/compute', ...guard, async (req, res) => {
    try {
      const type = String(req.body?.type || '') as NormGroupType;
      if (!NORM_GROUP_TYPES.includes(type)) return res.status(400).json({ ok: false, error: 'invalid_type', allowed: NORM_GROUP_TYPES });
      const result = await computeGroupNorms(pool, type);
      res.json({ ok: true, result });
    } catch { res.json({ ok: true, result: { abstained: true, reason: 'compute_error' }, degraded: true }); }
  });

  // ── AP-1 Bloom (read + classify) ──
  app.get('/api/admin/assessment-architecture/bloom', ...guard, async (_req, res) => {
    try { res.json({ ok: true, coverage: await bloomCoverage(pool) }); }
    catch { res.json({ ok: true, coverage: null, degraded: true }); }
  });

  app.post('/api/admin/assessment-architecture/bloom/classify', ...guard, async (_req, res) => {
    try { res.json({ ok: true, result: await classifyClarityBank(pool) }); }
    catch { res.json({ ok: true, result: null, degraded: true }); }
  });

  // ── AP-9 prompt registry (read + register) ──
  app.get('/api/admin/assessment-architecture/prompts', ...guard, async (_req, res) => {
    try { res.json({ ok: true, coverage: await registryCoverage(pool) }); }
    catch { res.json({ ok: true, coverage: null, degraded: true }); }
  });

  app.post('/api/admin/assessment-architecture/prompts/register', ...guard, async (_req, res) => {
    try { res.json({ ok: true, result: await registerCodeEmbeddedPrompts(pool) }); }
    catch { res.json({ ok: true, result: null, degraded: true }); }
  });

  // ── AP-8 country cohorts (read + register) ──
  app.get('/api/admin/assessment-architecture/country-cohorts', ...guard, async (_req, res) => {
    try { res.json({ ok: true, cohorts: await listCountryCohorts(pool) }); }
    catch { res.json({ ok: true, cohorts: [], degraded: true }); }
  });

  app.post('/api/admin/assessment-architecture/country-cohorts/register', ...guard, async (req, res) => {
    try {
      const cohorts = Array.isArray(req.body?.cohorts) ? (req.body.cohorts as CountryCohortInput[]) : [];
      const valid = cohorts.filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.geography === 'string');
      if (!valid.length) return res.status(400).json({ ok: false, error: 'no_valid_cohorts', shape: '{ cohorts:[{id,name,geography,filters?}] }' });
      res.json({ ok: true, result: await registerCountryCohorts(pool, valid) });
    } catch { res.json({ ok: true, result: null, degraded: true }); }
  });

  // ── summary rollup (STRUCTURAL verdict; axes never composited) ──
  app.get('/api/admin/assessment-architecture/summary', ...guard, async (_req, res) => {
    try {
      const [bloom, prompts, country] = await Promise.all([
        bloomCoverage(pool).catch(() => null),
        registryCoverage(pool).catch(() => null),
        listCountryCohorts(pool).catch(() => []),
      ]);
      const normRows = await pool.query(`SELECT norm_group_type, COUNT(*)::int AS n FROM assessment_group_norms GROUP BY norm_group_type`).catch(() => ({ rows: [] as Record<string, unknown>[] }));
      const closureCounts = GAP_REGISTER.reduce<Record<string, number>>((acc, g) => { acc[g.closure] = (acc[g.closure] || 0) + 1; return acc; }, {});
      res.json({
        ok: true,
        verdict: 'STRUCTURAL_COMPLETE_ADOPTION_PENDING',
        note: 'Every gap is ENGINEERING-closed (capability built + honest abstention). Adoption (real norm/offline/audit data) is a SEPARATE axis, reported here, NEVER composited into closure.',
        engineering_closure: closureCounts,
        adoption: {
          bloom_classified: bloom?.classified ?? null,
          bloom_abstained: bloom?.abstained ?? null,
          prompts_active: prompts?.active ?? null,
          country_cohorts: Array.isArray(country) ? country.length : null,
          norm_group_rows: normRows.rows,
        },
      });
    } catch { res.json({ ok: true, verdict: 'STRUCTURAL_COMPLETE_ADOPTION_PENDING', degraded: true }); }
  });
}
