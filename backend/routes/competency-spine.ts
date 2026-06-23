/**
 * Competency Intelligence Spine routes — 98X Gap Closure, Phase 2 (additive, feature-flagged).
 *
 * Mount prefix: /api/v2/competency-spine
 * Gating order: foundation -> competencySpineContracts -> auth.
 * Flag OFF (`competencySpineContracts`, env FF_COMPETENCY_SPINE_CONTRACTS) → every route
 * 503 BEFORE any auth/DB touch → byte-identical legacy behaviour.
 *
 *   GET /profile/:subjectId   — unified competency profile (UNION of both scoring ledgers)
 *   GET /feature-flag         — flag readback (also gated → 503 OFF)
 *   GET /_meta/versions       — version stamp (also gated → 503 OFF)
 *
 * READ-ONLY: no writes, no DDL. The resolver SELECTs the two existing ledgers and
 * re-shapes them; a missing table degrades to `available:false`, never an error.
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  COMPETENCY_SPINE_CONTRACTS_VERSION,
  resolveUnifiedCompetencyProfile,
} from '../services/competency-intelligence-contracts';
import {
  isAdaptiveIntelligenceFoundationEnabled,
  isCompetencySpineContractsEnabled,
} from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = { COMPETENCY_SPINE_CONTRACTS_VERSION };
const LANGUAGE_POLICY = {
  allowed: ['competency score', 'proficiency level', 'developmental focus area', 'coverage', 'gap band'],
  disallowed: ['hiring recommendation', 'promotion verdict', 'pass/fail', 'suitability score'],
};

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    competencySpineContracts: isCompetencySpineContractsEnabled(),
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
function requireSpine(_req: Request, res: Response, next: NextFunction) {
  if (!isCompetencySpineContractsEnabled()) {
    const e = errorEnvelope('competencySpineContracts disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}

/**
 * Competency `subject_id` is operator-supplied (NOT necessarily the caller's own id), so a
 * requireAuth-only read is an IDOR. A super admin may read any subject (admin tooling);
 * everyone else is pinned to their own authenticated id, and an explicit cross-subject
 * request is rejected (403, no silent cross-subject leak). Mirrors the behavioural-memory
 * resolveEffectiveUserId pattern; kept local so the module stays self-contained.
 */
export function authorizeSubject(req: Request, subjectId: string): { allowed: boolean; reason?: string } {
  const u = (req as any).user as { id?: unknown; role?: unknown } | undefined;
  const authId = u?.id != null ? String(u.id) : '';
  if (!authId) return { allowed: false, reason: 'unauthenticated' };
  if (u?.role === 'super_admin') return { allowed: true };
  if (subjectId === authId) return { allowed: true };
  return { allowed: false, reason: 'cross_subject_forbidden' };
}

export function registerCompetencySpineRoutes(opts: {
  app: Express;
  pool: Pool;
  requireAuth: RequireAuth;
}): void {
  const { app, pool, requireAuth } = opts;

  // Flag-OFF contract: EVERY route in this family 503s before any work when the flag is
  // OFF, including the readback/meta endpoints — so flag-OFF is byte-identical legacy.
  app.get('/api/v2/competency-spine/feature-flag', requireFoundation, requireSpine, (_req, res) =>
    res.json({ ok: true, feature_flag: flagState() }));
  app.get('/api/v2/competency-spine/_meta/versions', requireFoundation, requireSpine, (_req, res) =>
    res.json({ ok: true, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY }));

  // GET /profile/:subjectId — read-only unified competency profile.
  app.get('/api/v2/competency-spine/profile/:subjectId', requireFoundation, requireSpine, requireAuth, async (req, res) => {
    const subjectId = String(req.params.subjectId ?? '').trim();
    if (!subjectId) {
      const e = errorEnvelope('subjectId is required', {}, 400);
      return res.status(e.status).json(e.body);
    }
    const authz = authorizeSubject(req, subjectId);
    if (!authz.allowed) {
      const code = authz.reason === 'unauthenticated' ? 401 : 403;
      const e = errorEnvelope(authz.reason ?? 'forbidden', {}, code);
      return res.status(e.status).json(e.body);
    }
    try {
      const profile = await resolveUnifiedCompetencyProfile(pool, subjectId);
      return res.json(envelope({ profile }));
    } catch (err) {
      const e = errorEnvelope('profile_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });
}
