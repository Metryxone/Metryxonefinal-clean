/**
 * Candidate Competency Hiring Readiness — 98X Gap Closure §9 (additive, feature-flagged).
 *
 * Mount prefix: /api/v2/candidate/competency-readiness
 * Gating order: foundation -> employerCompetencyHiring -> auth -> self-scope IDOR.
 *
 * SELF-SCOPED candidate view of the SAME competency-driven match engine the employer uses,
 * but projected to a DEVELOPMENTAL surface for the seeker's OWN profile against a target role:
 *   - role match + requirement coverage (separate axes)
 *   - candidate readiness + calibration state (confidence)
 *   - a development plan = measured priority gaps + unassessed requirements (evidence to build)
 *
 * Honesty-first / additive contract:
 *   - Flag OFF (employerCompetencyHiring, env FF_EMPLOYER_COMPETENCY_HIRING) => 503 BEFORE
 *     any auth/DB touch (also requires adaptiveIntelligenceFoundation). Byte-identical legacy.
 *   - GET never writes / no DDL. Composes computeEmployerCompetencyIntelligence (read-only).
 *   - IDOR: subject is the caller's OWN email (session), never client-supplied. The :userId
 *     param is IDOR-guarded via resolveEffectiveUserId (super-admin may target another user).
 *   - Language policy: NO hire/no-hire verdict surfaced to the candidate. Outputs are
 *     DEVELOPMENTAL signals only. null = missing, never a fabricated 0.
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  computeEmployerCompetencyIntelligence,
  EMPLOYER_COMPETENCY_INTELLIGENCE_VERSION,
} from '../services/employer-competency-intelligence';
import {
  isAdaptiveIntelligenceFoundationEnabled,
  isEmployerCompetencyHiringEnabled,
} from '../config/feature-flags';
import { resolveEffectiveUserId } from './behavioural-memory';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const LANGUAGE_POLICY = {
  allowed: ['competency match', 'requirement coverage', 'development focus area', 'gap band', 'calibration state', 'readiness'],
  disallowed: ['validated hiring prediction', 'guaranteed offer', 'pass/fail verdict', 'suitability score'],
};
const DISCLAIMER =
  'This is a DEVELOPMENTAL self-assessment of your competency profile against a target role. ' +
  'It is NOT a hiring decision, an offer prediction, or a guarantee. Coverage (how much of the ' +
  'role is assessed) and confidence (calibration) are reported as independent axes.';

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    employerCompetencyHiring: isEmployerCompetencyHiringEnabled(),
  };
}

function requireFoundation(_req: Request, res: Response, next: NextFunction) {
  if (!isAdaptiveIntelligenceFoundationEnabled()) {
    res.status(503).json({ ok: false, error: 'adaptiveIntelligenceFoundation disabled', feature_flag: flagState() });
    return;
  }
  next();
}
function requireEmployerCompetency(_req: Request, res: Response, next: NextFunction) {
  if (!isEmployerCompetencyHiringEnabled()) {
    res.status(503).json({ ok: false, error: 'employerCompetencyHiring disabled', feature_flag: flagState() });
    return;
  }
  next();
}

/** Resolve the competency SUBJECT email for the effective user (never client-supplied body). */
async function resolveSubjectEmail(pool: Pool, req: Request, effectiveUserId: string): Promise<string | null> {
  const sessionUser = (req as any).user;
  const sessionId = sessionUser?.id != null ? String(sessionUser.id) : null;
  // Self → trust the session email directly.
  if (sessionId && sessionId === effectiveUserId) {
    const email = sessionUser?.email ?? (req as any).session?.email ?? null;
    if (email) return String(email);
  }
  // Super-admin targeting another user → look up that user's email by id.
  try {
    const { rows } = await pool.query(`SELECT email, username FROM users WHERE id::text = $1 LIMIT 1`, [effectiveUserId]);
    const r = rows[0];
    if (r) return String(r.email ?? r.username ?? '') || null;
  } catch { /* read-only probe; degrade */ }
  // Fall back to career_seeker_profiles JSONB email.
  try {
    const { rows } = await pool.query(
      `SELECT data->>'email' AS email FROM career_seeker_profiles WHERE user_id::text = $1 LIMIT 1`,
      [effectiveUserId],
    );
    if (rows[0]?.email) return String(rows[0].email);
  } catch { /* degrade */ }
  return null;
}

/** Resolve the target role title (query > profile.targetRole > sensible default). */
async function resolveTargetRole(pool: Pool, effectiveUserId: string, q: unknown): Promise<string> {
  const fromQuery = typeof q === 'string' ? q.trim() : '';
  if (fromQuery) return fromQuery;
  try {
    const { rows } = await pool.query(
      `SELECT data->>'targetRole' AS role FROM career_seeker_profiles WHERE user_id::text = $1 LIMIT 1`,
      [effectiveUserId],
    );
    if (rows[0]?.role) return String(rows[0].role);
  } catch { /* degrade */ }
  return 'Software Engineer';
}

export function registerCandidateCompetencyReadinessRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequireAuth,
): void {
  app.get(
    '/api/v2/candidate/competency-readiness/:userId',
    requireFoundation,
    requireEmployerCompetency,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const resolved = resolveEffectiveUserId(req, req.params.userId);
        if (resolved.forbidden || !resolved.userId) {
          res.status(403).json({ ok: false, error: 'forbidden' });
          return;
        }
        const effectiveUserId = String(resolved.userId);

        const subjectEmail = await resolveSubjectEmail(pool, req, effectiveUserId);
        const targetRole = await resolveTargetRole(pool, effectiveUserId, req.query.role);

        if (!subjectEmail) {
          res.json({
            ok: true,
            available: false,
            targetRole,
            note: 'No competency subject (email) resolved for your account — complete a competency assessment to see role readiness.',
            language_policy: LANGUAGE_POLICY,
            disclaimer: DISCLAIMER,
            version: EMPLOYER_COMPETENCY_INTELLIGENCE_VERSION,
            feature_flag: flagState(),
            generatedAt: new Date().toISOString(),
          });
          return;
        }

        // Self EI score (developmental context for readiness) from the seeker profile JSONB.
        let eiScore: number | null = null;
        try {
          const { rows } = await pool.query(
            `SELECT (data->>'assessmentScore')::numeric AS ei FROM career_seeker_profiles WHERE user_id::text = $1 LIMIT 1`,
            [effectiveUserId],
          );
          const v = Number(rows[0]?.ei);
          eiScore = Number.isFinite(v) ? v : null;
        } catch { /* degrade */ }

        // Compose the REAL competency intelligence over the candidate's OWN subject + target role.
        const intel = await computeEmployerCompetencyIntelligence(pool, {
          candidate: { email: subjectEmail, ei_score: eiScore },
          job: { id: null, title: targetRole },
        });
        const m = intel.match;

        // Candidate-facing projection — developmental, NO hire/no-hire verdict.
        res.json({
          ok: true,
          available: m.competencyProfileAvailable,
          subjectId: m.subjectId,
          targetRole: m.jobTitle ?? targetRole,
          roleResolved: m.roleDna.resolved,
          requirementSource: m.roleDna.requirementSource,
          // Role match (quality axis) + coverage (independent axis).
          competencyMatch: m.competencyMatch,
          fitBand: m.fitSignal.band,            // developmental band (null when coverage-thin)
          assessedBand: m.fitSignal.assessedBand,
          coverage: {
            pct: m.requirementCoveragePct,
            matched: m.matchedRequirementCount,
            total: m.totalRequirementCount,
            sufficient: m.fitSignal.coverageSufficient,
            note: m.coverageNote,
          },
          readiness: m.candidateReadiness,
          confidence: { ...m.calibration, note: m.confidenceNote },
          requirements: m.requirements,
          // Development plan — measured priority gaps + requirements still to evidence.
          developmentPlan: {
            priorityGaps: m.gaps,                       // assessed, below target (real, measured)
            evidenceToBuild: m.unassessedRequirements,  // unassessed (coverage gaps, never fabricated)
            focusAreas: intel.interviewRecommendation.focusAreas,
          },
          languagePolicy: LANGUAGE_POLICY,
          disclaimer: DISCLAIMER,
          provenance: m.provenance,
          version: EMPLOYER_COMPETENCY_INTELLIGENCE_VERSION,
          feature_flag: flagState(),
          generatedAt: new Date().toISOString(),
        });
      } catch (err: any) {
        // Never 500 the candidate surface — degrade honestly.
        res.json({
          ok: false,
          available: false,
          error: 'readiness_unavailable',
          note: 'Competency readiness is temporarily unavailable.',
          language_policy: LANGUAGE_POLICY,
          feature_flag: flagState(),
          generatedAt: new Date().toISOString(),
        });
      }
    },
  );
}
