/**
 * Dynamic Assessment Runtime routes — Phase 4 (additive, flagged).
 *
 * Mount prefix: /api/v2/dynamic-assessment
 *
 *   GET  /feature-flag                  — public flag readback
 *   GET  /_meta/versions                — public version stamp
 *   POST /session/start                 — owner-or-admin; opens shadow session
 *   POST /session/:sessionId/generate   — owner-or-admin; emits a contextual question
 *   POST /session/:sessionId/branch     — owner-or-admin; records a branching decision
 *   POST /cognitive/:userId/compute     — owner-or-admin; computes cognitive profile from observations
 *   GET  /cognitive/:userId/latest      — owner-or-admin; reads latest cognitive profile
 *   POST /contradictions/:userId/detect — owner-or-admin; detects + persists contradictions
 *   GET  /contradictions/:userId/recent — owner-or-admin; recent contradiction log
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  CONTEXTUAL_QUESTION_GENERATION_VERSION, generateQuestion, nextQuestionType,
  persistQuestion, startSession, type QuestionType, QUESTION_TYPES,
} from '../services/contextual-question-generation-engine';
import {
  ADAPTIVE_BRANCHING_VERSION, chooseBranch, recordBranch,
} from '../services/adaptive-branching-engine';
import {
  COGNITIVE_RUNTIME_VERSION, computeCognitiveProfile, getLatestCognitiveProfile,
  persistCognitiveProfile,
} from '../services/cognitive-runtime-engine';
import {
  CONTRADICTION_ENGINE_VERSION, detectContradictions, persistContradictions,
  recentContradictions,
} from '../services/behavioral-contradiction-engine';
import {
  isAdaptiveIntelligenceFoundationEnabled,
  isDynamicQuestionGenerationEnabled,
  isAdaptiveQuestionBranchingEnabled,
  isCognitiveRuntimeEnabled,
} from '../config/feature-flags';
import { emit, ADAPTIVE_EVENTS } from '../services/adaptive-event-bus';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = {
  CONTEXTUAL_QUESTION_GENERATION_VERSION,
  ADAPTIVE_BRANCHING_VERSION,
  COGNITIVE_RUNTIME_VERSION,
  CONTRADICTION_ENGINE_VERSION,
};

const LANGUAGE_POLICY = {
  allowed: [
    'contextual question', 'depth level', 'branching policy', 'cognitive signal',
    'contradiction probe', 'evidence validation', 'response observation',
  ],
  disallowed: [
    'hiring recommendation', 'promotion verdict', 'pass/fail', 'suitability score',
    'mastery certification', 'IQ score', 'cognitive ranking',
  ],
};

const ADMIN_ROLES = new Set(['admin', 'super-admin', 'superadmin', 'super_admin']);

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    dynamicQuestionGeneration: isDynamicQuestionGenerationEnabled(),
    adaptiveQuestionBranching: isAdaptiveQuestionBranchingEnabled(),
    cognitiveRuntimeEnabled: isCognitiveRuntimeEnabled(),
  };
}
function envelope<T extends object>(payload: T) {
  return { ok: true, ...payload, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: flagState() };
}
function errorEnvelope(error: string, extra: Record<string, unknown> = {}, code = 503) {
  return { status: code, body: { ok: false, error, ...extra, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: flagState() } };
}

function requireFoundation(_req: Request, res: Response, next: NextFunction) {
  if (!isAdaptiveIntelligenceFoundationEnabled()) {
    const e = errorEnvelope('adaptiveIntelligenceFoundation disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireDQG(_req: Request, res: Response, next: NextFunction) {
  if (!isDynamicQuestionGenerationEnabled()) {
    const e = errorEnvelope('dynamicQuestionGeneration disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireBranching(_req: Request, res: Response, next: NextFunction) {
  if (!isAdaptiveQuestionBranchingEnabled()) {
    const e = errorEnvelope('adaptiveQuestionBranching disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireCognitive(_req: Request, res: Response, next: NextFunction) {
  if (!isCognitiveRuntimeEnabled()) {
    const e = errorEnvelope('cognitiveRuntimeEnabled disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireOwnerOrAdmin(paramKey = 'userId') {
  return (req: Request, res: Response, next: NextFunction) => {
    const u = (req as any).user as { id?: unknown; role?: unknown } | undefined;
    if (!u || u.id == null) {
      const e = errorEnvelope('unauthenticated', {}, 401);
      return res.status(e.status).json(e.body);
    }
    const selfId = String(u.id);
    const targetId = String(req.params[paramKey] ?? '');
    const isAdmin = typeof u.role === 'string' && ADMIN_ROLES.has(u.role);
    if (selfId !== targetId && !isAdmin) {
      const e = errorEnvelope('forbidden', { reason: 'cross_user_access_denied' }, 403);
      return res.status(e.status).json(e.body);
    }
    next();
  };
}

// Owner-or-admin guard for session-scoped routes. Always reads the session row
// (even for admins) so non-existent sessions consistently return 404 and
// downstream handlers can rely on a real session existing.
function requireSessionOwnerOrAdmin(pool: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const u = (req as any).user as { id?: unknown; role?: unknown } | undefined;
    if (!u || u.id == null) {
      const e = errorEnvelope('unauthenticated', {}, 401);
      return res.status(e.status).json(e.body);
    }
    const isAdmin = typeof u.role === 'string' && ADMIN_ROLES.has(u.role);
    const sessionId = String(req.params.sessionId ?? '');
    try {
      const r = await pool.query(
        `SELECT user_id FROM dynamic_question_sessions WHERE id = $1 LIMIT 1`, [sessionId]);
      const row: any = r.rows[0];
      if (!row) {
        const e = errorEnvelope('session_not_found', {}, 404);
        return res.status(e.status).json(e.body);
      }
      if (!isAdmin && String(row.user_id) !== String(u.id)) {
        const e = errorEnvelope('forbidden', { reason: 'cross_user_access_denied' }, 403);
        return res.status(e.status).json(e.body);
      }
      // Stash the resolved owner so downstream handlers don't need to re-query.
      (req as any).sessionOwnerId = String(row.user_id);
      next();
    } catch (err) {
      const e = errorEnvelope('session_lookup_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  };
}

function asNumber(v: unknown, def = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : def;
}
function asString(v: unknown, def = ''): string {
  return typeof v === 'string' && v.length ? v : def;
}

export function registerDynamicAssessmentRuntimeRoutes(opts: {
  app: Express; pool: Pool; requireAuth: RequireAuth;
}): void {
  const { app, pool, requireAuth } = opts;

  app.get('/api/v2/dynamic-assessment/feature-flag', (_req, res) =>
    res.json({ ok: true, feature_flag: flagState() }));
  app.get('/api/v2/dynamic-assessment/_meta/versions', (_req, res) =>
    res.json({ ok: true, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY }));

  // POST /session/start — opens a shadow session for the authenticated user (or any user when admin).
  app.post('/api/v2/dynamic-assessment/session/start',
    requireFoundation, requireDQG, requireAuth, async (req, res) => {
      const u = (req as any).user as { id?: unknown; role?: unknown } | undefined;
      if (!u || u.id == null) {
        const e = errorEnvelope('unauthenticated', {}, 401);
        return res.status(e.status).json(e.body);
      }
      const isAdmin = typeof u.role === 'string' && ADMIN_ROLES.has(u.role);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const requestedUserId = asString(body.userId);
      if (requestedUserId && requestedUserId !== String(u.id) && !isAdmin) {
        const e = errorEnvelope('forbidden', { reason: 'cross_user_access_denied' }, 403);
        return res.status(e.status).json(e.body);
      }
      const userId = requestedUserId || String(u.id);
      try {
        const id = await startSession(pool, {
          userId,
          blueprintId: asString(body.blueprintId) || undefined,
          roleContext: (body.roleContext && typeof body.roleContext === 'object') ? body.roleContext as Record<string, unknown> : {},
          cognitiveSeed: (body.cognitiveSeed && typeof body.cognitiveSeed === 'object') ? body.cognitiveSeed as Record<string, unknown> : {},
          // Phase 4 is shadow-runtime by spec — independent of UCIP shadow mode.
          shadowMode: true,
        });
        return res.json(envelope({ sessionId: id, shadowMode: true }));
      } catch (err) {
        const e = errorEnvelope('session_start_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    });

  // POST /session/:sessionId/generate — emit a contextual question for the session.
  app.post('/api/v2/dynamic-assessment/session/:sessionId/generate',
    requireFoundation, requireDQG, requireAuth, requireSessionOwnerOrAdmin(pool), async (req, res) => {
      const sessionId = String(req.params.sessionId);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const competencyId = asString(body.competencyId);
      if (!competencyId) {
        const e = errorEnvelope('competencyId required', {}, 400);
        return res.status(e.status).json(e.body);
      }
      const requestedType = asString(body.questionType) as QuestionType;
      const coverage = (body.coverage && typeof body.coverage === 'object')
        ? body.coverage as Partial<Record<QuestionType, number>> : {};
      const questionType: QuestionType = QUESTION_TYPES.includes(requestedType)
        ? requestedType : nextQuestionType(coverage);
      const depthLevel = Math.max(1, Math.min(5, asNumber(body.depthLevel, 1)));
      const questionIndex = Math.max(0, asNumber(body.questionIndex, 0));
      try {
        // Resolve the session's owner so we always emit events with the correct user id,
        // regardless of who is making the request (admin vs. owner).
        const sessRow = await pool.query(
          `SELECT user_id FROM dynamic_question_sessions WHERE id = $1 LIMIT 1`, [sessionId]);
        const ownerId: string = sessRow.rows[0]?.user_id ?? '';
        const q = generateQuestion({
          userId: ownerId,
          competencyId,
          competencyLabel: asString(body.competencyLabel) || undefined,
          depthLevel, questionType,
          roleTitle: asString(body.roleTitle) || undefined,
          seniorityBand: asString(body.seniorityBand) || undefined,
          industry: asString(body.industry) || undefined,
          orgMaturity: asString(body.orgMaturity) || undefined,
          orgLayer: asString(body.orgLayer) || undefined,
          experienceYears: typeof body.experienceYears === 'number' ? body.experienceYears : undefined,
          competencyGapDelta: typeof body.competencyGapDelta === 'number' ? body.competencyGapDelta : undefined,
          recentContradictionCount: typeof body.recentContradictionCount === 'number' ? body.recentContradictionCount : undefined,
          leadershipExpectation: asString(body.leadershipExpectation) || undefined,
          assessmentMemoryHash: asString(body.assessmentMemoryHash) || undefined,
          cognitiveProfile: (body.cognitiveProfile && typeof body.cognitiveProfile === 'object')
            ? body.cognitiveProfile as any : undefined,
        });
        const qid = await persistQuestion(pool, {
          sessionId, questionIndex, question: q,
          contextSnapshot: { source: 'dynamic-assessment', body },
          signals: Array.isArray(body.signals)
            ? (body.signals as any[]).filter((s) => s && typeof s.signalType === 'string')
                .map((s) => ({ signalType: String(s.signalType), payload: s.payload ?? {} }))
            : [],
        });
        emit({ event_type: ADAPTIVE_EVENTS.QUESTION_GENERATED, payload: { sessionId, questionId: qid, competencyId, questionType, depthLevel } });
        return res.json(envelope({ question: q, persistedId: qid }));
      } catch (err) {
        const e = errorEnvelope('question_generation_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    });

  // POST /session/:sessionId/branch — record a branching decision for the session.
  app.post('/api/v2/dynamic-assessment/session/:sessionId/branch',
    requireFoundation, requireBranching, requireAuth, requireSessionOwnerOrAdmin(pool), async (req, res) => {
      const sessionId = String(req.params.sessionId);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const currentCompetencyId = asString(body.currentCompetencyId);
      if (!currentCompetencyId) {
        const e = errorEnvelope('currentCompetencyId required', {}, 400);
        return res.status(e.status).json(e.body);
      }
      const decision = chooseBranch({
        currentCompetencyId,
        currentDepthLevel: Math.max(1, Math.min(5, asNumber(body.currentDepthLevel, 1))),
        lastQualityScore: typeof body.lastQualityScore === 'number' ? body.lastQualityScore : undefined,
        pendingContradictions: Math.max(0, asNumber(body.pendingContradictions, 0)),
        cognitiveSignalsCovered: Math.max(0, Math.min(7, asNumber(body.cognitiveSignalsCovered, 0))),
        competencyCoverage: (body.competencyCoverage && typeof body.competencyCoverage === 'object')
          ? body.competencyCoverage as Record<string, number> : {},
        competencyPriority: Array.isArray(body.competencyPriority)
          ? (body.competencyPriority as unknown[]).map((c) => String(c)) : [],
        minCoveragePerCompetency: typeof body.minCoveragePerCompetency === 'number' ? body.minCoveragePerCompetency : undefined,
      });
      const id = await recordBranch(pool, {
        sessionId, fromQuestionId: asString(body.fromQuestionId) || undefined, decision,
      });
      emit({ event_type: ADAPTIVE_EVENTS.BRANCH_EXECUTED, payload: { sessionId, branchId: id, policy: decision.policy, reason: decision.reasonCode } });
      return res.json(envelope({ decision, persistedId: id }));
    });

  // POST /cognitive/:userId/compute — compute + persist cognitive profile.
  app.post('/api/v2/dynamic-assessment/cognitive/:userId/compute',
    requireFoundation, requireCognitive, requireAuth, requireOwnerOrAdmin('userId'), async (req, res) => {
      const userId = String(req.params.userId);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const obs = Array.isArray(body.observations) ? body.observations as any[] : [];
      const profile = computeCognitiveProfile(obs);
      const id = await persistCognitiveProfile(pool, {
        userId, sessionId: asString(body.sessionId) || undefined, profile,
      });
      emit({ event_type: ADAPTIVE_EVENTS.COGNITIVE_PROFILE_UPDATED, payload: { userId, profileId: id, confidence: profile.confidence, sampleSize: profile.sampleSize } });
      return res.json(envelope({ profile, persistedId: id }));
    });

  // GET /cognitive/:userId/latest — read latest cognitive profile.
  app.get('/api/v2/dynamic-assessment/cognitive/:userId/latest',
    requireFoundation, requireCognitive, requireAuth, requireOwnerOrAdmin('userId'), async (req, res) => {
      const userId = String(req.params.userId);
      const profile = await getLatestCognitiveProfile(pool, userId);
      return res.json(envelope({ profile }));
    });

  // POST /contradictions/:userId/detect — detect + persist contradictions from responses.
  app.post('/api/v2/dynamic-assessment/contradictions/:userId/detect',
    requireFoundation, requireDQG, requireAuth, requireOwnerOrAdmin('userId'), async (req, res) => {
      const userId = String(req.params.userId);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const responses = Array.isArray(body.responses) ? body.responses as any[] : [];
      const detected = detectContradictions(responses);
      const written = await persistContradictions(pool, {
        userId, sessionId: asString(body.sessionId) || undefined, contradictions: detected,
      });
      if (detected.length > 0) {
        emit({ event_type: ADAPTIVE_EVENTS.CONTRADICTION_DETECTED, payload: { userId, count: detected.length, persisted: written } });
      }
      return res.json(envelope({ contradictions: detected, persisted: written }));
    });

  // GET /contradictions/:userId/recent — recent contradiction log.
  app.get('/api/v2/dynamic-assessment/contradictions/:userId/recent',
    requireFoundation, requireDQG, requireAuth, requireOwnerOrAdmin('userId'), async (req, res) => {
      const userId = String(req.params.userId);
      const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 20));
      const items = await recentContradictions(pool, userId, limit);
      return res.json(envelope({ contradictions: items }));
    });
}
