/**
 * MX-103W Phase 3 — Employer Production Health (super-admin visibility).
 *
 * A SINGLE read-only aggregator that surfaces the health of the employer
 * production spine across 8 groups, COMPOSING existing read helpers and
 * to_regclass-probed direct reads. It adds NO new nav surface — the existing
 * EmployerEcosystemPanel consumes `/overview` and renders an MX-103W section
 * (probe-gated on `/enabled`).
 *
 * Discipline:
 *   - GET-never-writes  — every read is a to_regclass / column probe or a plain
 *                         SELECT. NO ensure-schema / DDL is reachable from a GET
 *                         (that is why the assessment metrics are probed directly
 *                         rather than via getAssessmentFoundationSummary, which
 *                         ensures schema).
 *   - Never throws       — each group degrades to nulls + a note on error.
 *   - Coverage ⟂ Confidence — title confidence is reported beside, never folded
 *                         into, coverage counts.
 *   - Readiness ≠ Adoption — structural presence (can it run) is separated from
 *                         exercised volume (has it run).
 *   - Flag-gated         — available only when a MX-103W flag is ON; OFF on both
 *                         => 503 (byte-identical legacy). The `/enabled` probe lets
 *                         the (super-admin-only) panel hide itself when OFF. NOTE:
 *                         a global app.use('/api/admin', requireAuth→requireSuperAdmin)
 *                         gate fronts this router, so `/enabled` is reachable only by
 *                         an authenticated super-admin (401 otherwise) — which is fine
 *                         because the panel renders solely inside the super-admin shell.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  isEmployerJobStoreSyncEnabled,
  isRoleAutoResolutionEnabled,
} from '../config/feature-flags';
import { getProjectionHealth } from '../services/job-store-projection';
import { getResolutionCoverage } from '../services/role-auto-resolution';
import { getMatchableCuratedRoles } from '../services/role-title-crosswalk';

type Mw = (req: any, res: any, next: any) => void;

const EMPLOYER_PRODUCTION_HEALTH_VERSION = '1.0.0';

async function relExists(pool: Pool, rel: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${rel}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

async function scalar(pool: Pool, sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const r = await pool.query(sql, params);
    const v = r.rows?.[0]?.n;
    return v == null ? 0 : Number(v);
  } catch {
    return null;
  }
}

// ── Group 1: Job Store Health ───────────────────────────────────────────────
async function jobStoreHealth(pool: Pool) {
  const notes: string[] = [];
  const hasPostings = await relExists(pool, 'job_postings');
  const hasEmployerJobs = await relExists(pool, 'employer_jobs');
  const out: any = {
    job_postings_present: hasPostings,
    employer_jobs_present: hasEmployerJobs,
    postings_total: null,
    postings_published: null,
    employer_jobs_total: null,
    employer_jobs_active: null,
    notes,
  };
  if (hasPostings) {
    out.postings_total = await scalar(pool, `SELECT COUNT(*)::int AS n FROM job_postings`);
    out.postings_published = await scalar(pool, `SELECT COUNT(*)::int AS n FROM job_postings WHERE status = 'published'`);
  } else {
    notes.push('job_postings not provisioned');
  }
  if (hasEmployerJobs) {
    out.employer_jobs_total = await scalar(pool, `SELECT COUNT(*)::int AS n FROM employer_jobs`);
    out.employer_jobs_active = await scalar(pool, `SELECT COUNT(*)::int AS n FROM employer_jobs WHERE status = 'active'`);
  } else {
    notes.push('employer_jobs not provisioned');
  }
  return out;
}

// ── Group 5: Role DNA Utilization ───────────────────────────────────────────
async function roleDnaUtilization(pool: Pool) {
  const notes: string[] = [];
  const hasRoles = await relExists(pool, 'onto_roles');
  const hasProfiles = await relExists(pool, 'onto_role_competency_profiles');
  const out: any = {
    roles_total: null,
    roles_with_profile: null,
    profile_coverage_pct: null,
    notes,
  };
  if (hasRoles) {
    out.roles_total = await scalar(pool, `SELECT COUNT(*)::int AS n FROM onto_roles WHERE deprecated IS NOT TRUE`);
  } else {
    notes.push('onto_roles not provisioned');
  }
  if (hasProfiles) {
    out.roles_with_profile = await scalar(
      pool,
      `SELECT COUNT(DISTINCT role_id)::int AS n FROM onto_role_competency_profiles WHERE active = true`,
    );
  } else {
    notes.push('onto_role_competency_profiles not provisioned');
  }
  if (out.roles_total && out.roles_total > 0 && out.roles_with_profile != null) {
    out.profile_coverage_pct = Math.round((out.roles_with_profile / out.roles_total) * 1000) / 10;
  }
  return out;
}

// ── Group 4: Crosswalk Coverage ─────────────────────────────────────────────
async function crosswalkCoverage(pool: Pool) {
  try {
    const matchable = await getMatchableCuratedRoles(pool);
    return {
      matchable_roles: matchable.length,
      sample_roles: matchable.slice(0, 10).map(r => ({ id: r.id, title: r.title, competency_count: r.competency_count })),
      note:
        matchable.length === 0
          ? 'No curated role carries a competency profile yet — title crosswalk cannot resolve anything (honest, not fabricated).'
          : `${matchable.length} curated roles are matchable (carry an active competency profile).`,
    };
  } catch {
    return { matchable_roles: null, sample_roles: [], note: 'crosswalk coverage unreadable' };
  }
}

// ── Group 7: Assessment Generation (probe-only — NO ensure-schema) ───────────
async function assessmentGeneration(pool: Pool) {
  const notes: string[] = [];
  const out: any = {
    blueprints_total: null,
    blueprint_competencies_total: null,
    roles_mapped: null,
    questions_available: null,
    notes,
  };
  if (await relExists(pool, 'onto_assessment_blueprints')) {
    out.blueprints_total = await scalar(pool, `SELECT COUNT(*)::int AS n FROM onto_assessment_blueprints`);
  } else {
    notes.push('assessment foundation not provisioned (no blueprints table) — not yet seeded');
  }
  if (await relExists(pool, 'onto_blueprint_competency_map')) {
    out.blueprint_competencies_total = await scalar(pool, `SELECT COUNT(*)::int AS n FROM onto_blueprint_competency_map`);
  }
  if (await relExists(pool, 'onto_role_assessment_map')) {
    out.roles_mapped = await scalar(pool, `SELECT COUNT(DISTINCT role_id)::int AS n FROM onto_role_assessment_map WHERE active = true`);
  }
  if (await relExists(pool, 'competency_question_templates')) {
    out.questions_available = await scalar(pool, `SELECT COUNT(*)::int AS n FROM competency_question_templates`);
  }
  return out;
}

// ── Group 8: Hiring Funnel Health ───────────────────────────────────────────
async function hiringFunnelHealth(pool: Pool) {
  const notes: string[] = [];
  const out: any = {
    open_jobs: null,
    candidates: null,
    applications: null,
    notes,
  };
  if (await relExists(pool, 'employer_jobs')) {
    out.open_jobs = await scalar(pool, `SELECT COUNT(*)::int AS n FROM employer_jobs WHERE status = 'active'`);
  }
  if (await relExists(pool, 'employer_candidates')) {
    out.candidates = await scalar(pool, `SELECT COUNT(*)::int AS n FROM employer_candidates`);
  } else {
    notes.push('employer_candidates not provisioned');
  }
  if (await relExists(pool, 'employer_applications')) {
    out.applications = await scalar(pool, `SELECT COUNT(*)::int AS n FROM employer_applications`);
  }
  return out;
}

function deriveReadiness(groups: any): { structural_score: number; band: string; signals: string[] } {
  // Structural readiness = can the production spine RUN end to end (presence of
  // each substrate + a non-empty crosswalk), independent of adoption/volume.
  const signals: string[] = [];
  const checks: Array<[string, boolean]> = [
    ['job_postings present', !!groups.job_store?.job_postings_present],
    ['employer_jobs present', !!groups.job_store?.employer_jobs_present],
    ['projection layer active', !!groups.projection?.projection_active],
    ['curated roles matchable', (groups.crosswalk?.matchable_roles ?? 0) > 0],
    ['role DNA profiles present', (groups.role_dna?.roles_with_profile ?? 0) > 0],
    ['assessment blueprints present', (groups.assessment?.blueprints_total ?? 0) > 0],
    ['role-resolution audit reachable', groups.role_resolution != null],
    ['hiring funnel substrate present', groups.funnel?.candidates != null || groups.funnel?.open_jobs != null],
  ];
  const passed = checks.filter(([, ok]) => ok);
  for (const [name, ok] of checks) signals.push(`${ok ? '✓' : '✗'} ${name}`);
  const structural = Math.round((passed.length / checks.length) * 100);
  const band = structural >= 85 ? 'PASS' : structural >= 60 ? 'PARTIAL' : 'AT_RISK';
  return { structural_score: structural, band, signals };
}

export function registerEmployerProductionHealthRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const enabled = () => isEmployerJobStoreSyncEnabled() || isRoleAutoResolutionEnabled();

  // Unauthenticated probe so the panel can hide itself when the feature is OFF.
  app.get('/api/admin/employer-production-health/enabled', (_req: Request, res: Response) => {
    res.json({
      enabled: enabled(),
      version: EMPLOYER_PRODUCTION_HEALTH_VERSION,
      flags: {
        employerJobStoreSync: isEmployerJobStoreSyncEnabled(),
        roleAutoResolution: isRoleAutoResolutionEnabled(),
      },
    });
  });

  const gate: Mw = (_req, res, next) => {
    if (!enabled()) {
      return res.status(503).json({
        error: 'Employer Production Health is not enabled',
        flags: ['employerJobStoreSync', 'roleAutoResolution'],
      });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];

  app.get('/api/admin/employer-production-health/overview', ...guards, async (_req: Request, res: Response) => {
    const [job_store, projection, role_resolution, crosswalk, role_dna, assessment, funnel] = await Promise.all([
      jobStoreHealth(pool).catch(() => null),
      getProjectionHealth(pool).catch(() => null),
      getResolutionCoverage(pool).catch(() => null),
      crosswalkCoverage(pool).catch(() => null),
      roleDnaUtilization(pool).catch(() => null),
      assessmentGeneration(pool).catch(() => null),
      hiringFunnelHealth(pool).catch(() => null),
    ]);

    const groups = { job_store, projection, role_resolution, crosswalk, role_dna, assessment, funnel };
    const readiness = deriveReadiness(groups);

    res.json({
      success: true,
      version: EMPLOYER_PRODUCTION_HEALTH_VERSION,
      generated_at: new Date().toISOString(),
      readiness,
      groups: {
        job_store_health: job_store,
        projection_health: projection,
        role_resolution_coverage: role_resolution,
        crosswalk_coverage: crosswalk,
        role_dna_utilization: role_dna,
        employer_readiness: readiness,
        assessment_generation: assessment,
        hiring_funnel_health: funnel,
      },
      axis_note:
        'Confidence (title-resolution certainty) and Coverage (substrate/competency/assessment counts) are reported as SEPARATE axes. Structural readiness measures whether the spine CAN run; it is not adoption/volume.',
    });
  });
}
