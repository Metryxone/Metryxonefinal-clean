/**
 * Employer Competency Match routes — 98X Gap Closure, Phase 3 (additive, feature-flagged).
 *
 * Mount prefix: /api/v2/employer/competency-match
 * Gating order: foundation -> employerCompetencyHiring -> auth -> org-scope IDOR.
 * Flag OFF (`employerCompetencyHiring`, env FF_EMPLOYER_COMPETENCY_HIRING) → every route
 * 503 BEFORE any auth/DB touch → byte-identical legacy behaviour (the existing
 * employer-hiring-intelligence routes are UNTOUCHED and keep their heuristic path).
 *
 *   GET /:candidateId/:jobId  — competency-driven candidate↔job match (onto_* genome)
 *   GET /feature-flag         — flag readback (also gated → 503 OFF)
 *   GET /_meta/versions       — version stamp (also gated → 503 OFF)
 *
 * READ-ONLY: no writes, no DDL. Composes Phase-1 Role DNA + Phase-2 unified competency
 * profile + Role-Readiness-V2. Fails CLOSED (no competency profile → competencyMatch:null,
 * heuristic fallback), never fabricates a score. IDOR: candidate + job must belong to the
 * caller's employer org (session scope), else 404 (no cross-org existence leak).
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  EMPLOYER_COMPETENCY_HIRING_VERSION,
  computeCompetencyDrivenMatch,
} from '../services/employer-competency-hiring';
import {
  isAdaptiveIntelligenceFoundationEnabled,
  isEmployerCompetencyHiringEnabled,
} from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = { EMPLOYER_COMPETENCY_HIRING_VERSION };
const LANGUAGE_POLICY = {
  allowed: ['competency match', 'requirement coverage', 'developmental focus area', 'gap band', 'calibration state'],
  disallowed: ['validated hiring prediction', 'guaranteed performance', 'pass/fail verdict', 'suitability score'],
};

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    employerCompetencyHiring: isEmployerCompetencyHiringEnabled(),
  };
}
function envelope<T extends object>(payload: T) {
  return { ok: true, ...payload, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: flagState() };
}
function errorEnvelope(error: string, extra: Record<string, unknown> = {}, code = 503) {
  return {
    status: code,
    body: { ok: false, error, ...extra, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: flagState() },
  };
}

function requireFoundation(_req: Request, res: Response, next: NextFunction) {
  if (!isAdaptiveIntelligenceFoundationEnabled()) {
    const e = errorEnvelope('adaptiveIntelligenceFoundation disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireEmployerCompetency(_req: Request, res: Response, next: NextFunction) {
  if (!isEmployerCompetencyHiringEnabled()) {
    const e = errorEnvelope('employerCompetencyHiring disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}

/** Employer org scope — mirrors employer-hiring-intelligence `eid()`. The org owns its
 *  candidates + jobs; a read outside that scope must not even confirm existence. */
function employerOrgId(req: Request): string {
  return (req as any).orgId ?? (req.user as any)?.id ?? '';
}

export function registerEmployerCompetencyMatchRoutes(opts: {
  app: Express;
  pool: Pool;
  requireAuth: RequireAuth;
}): void {
  const { app, pool, requireAuth } = opts;

  // Flag-OFF contract: EVERY route 503s before any work when the flag is OFF,
  // including readback/meta — so flag-OFF is byte-identical legacy.
  app.get('/api/v2/employer/competency-match/feature-flag', requireFoundation, requireEmployerCompetency, (_req, res) =>
    res.json({ ok: true, feature_flag: flagState() }));
  app.get('/api/v2/employer/competency-match/_meta/versions', requireFoundation, requireEmployerCompetency, (_req, res) =>
    res.json({ ok: true, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY }));

  // GET /:candidateId/:jobId — read-only competency-driven match.
  app.get(
    '/api/v2/employer/competency-match/:candidateId/:jobId',
    requireFoundation,
    requireEmployerCompetency,
    requireAuth,
    async (req, res) => {
      const orgId = employerOrgId(req);
      if (!orgId) {
        const e = errorEnvelope('unauthenticated', {}, 401);
        return res.status(e.status).json(e.body);
      }
      const candidateId = String(req.params.candidateId ?? '').trim();
      const jobId = String(req.params.jobId ?? '').trim();
      if (!jobId || !candidateId) {
        const e = errorEnvelope('jobId and candidateId are required', {}, 400);
        return res.status(e.status).json(e.body);
      }
      try {
        // Org-scoped lookups: candidate + job MUST belong to the caller's org.
        const [candRes, jobRes] = await Promise.all([
          pool.query(
            'SELECT * FROM employer_candidates WHERE id = $1 AND employer_id = $2 LIMIT 1',
            [candidateId, orgId],
          ),
          pool.query(
            'SELECT * FROM employer_jobs WHERE id = $1 AND employer_id = $2 LIMIT 1',
            [jobId, orgId],
          ),
        ]);
        const candidate = candRes.rows[0];
        const job = jobRes.rows[0];
        if (!candidate || !job) {
          // No cross-org existence leak: a missing OR out-of-scope row is a 404.
          const e = errorEnvelope('candidate or job not found in your organization', {}, 404);
          return res.status(e.status).json(e.body);
        }
        const match = await computeCompetencyDrivenMatch(pool, { candidate, job });
        return res.json(envelope({ match }));
      } catch (err) {
        const e = errorEnvelope('match_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );
}
