/**
 * PHASE 6 — Career Intelligence Activation (read-only frontend-facing endpoint).
 *
 * Surfaces the FOUR named, competency-driven Career Builder scores (career
 * readiness / career growth / role progression / skill-gap pressure) plus the
 * gap-derived plan slice, all COMPOSED by the existing Phase-4 career-intelligence
 * bridge (`buildCareerIntelligence`) from the MEASURED competency profile. It does
 * NOT rebuild any engine — it only projects the already-composed envelope.
 *
 * Honesty-first / additive contract:
 *   - Flag OFF (`FF_CAREER_INTELLIGENCE_ACTIVATION` default OFF) => synchronous 503
 *     BEFORE any DB touch; the existing Career Builder stays byte-identical legacy.
 *   - GET never writes. The bridge's `computeRoleReadinessV2` runs an UNGUARDED
 *     `ensureCompetencyRuntimeSchema` (DDL), so we gate behind `competencyRuntimeReady`
 *     FIRST: schema absent => honest not-measurable response with ZERO DDL.
 *   - IDOR guard via `resolveEffectiveUserId` (super-admin may target another user;
 *     everyone else is pinned to their own id; explicit cross-user => 403).
 *   - null = missing, never a fabricated 0. Coverage (measurable) and the value are
 *     separate axes. Outputs are DEVELOPMENTAL SIGNALS ONLY (language_policy surfaced).
 */

import type { Express, Request, RequestHandler, Response } from 'express';
import type { Pool } from 'pg';
import { isCareerIntelligenceActivationEnabled } from '../config/feature-flags.js';
import { resolveEffectiveUserId } from './behavioural-memory.js';
import { competencyRuntimeReady } from '../services/career-gap-engine.js';
import { LANGUAGE_POLICY } from '../services/competency-ei-scoring-shared.js';
import {
  buildCareerIntelligence,
  buildActivationScores,
  CAREER_INTELLIGENCE_VERSION,
} from '../services/career-intelligence-bridge.js';

export function registerCareerCompetencyActivationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCareerIntelligenceActivationEnabled()) {
      res
        .status(503)
        .json({ ok: false, error: 'feature_disabled', flag: 'careerIntelligenceActivation' });
      return;
    }
    next();
  };

  app.get(
    '/api/career/competency-activation/:userId',
    gate,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        // IDOR guard — pin to own id unless super-admin.
        const resolved = resolveEffectiveUserId(req, req.params.userId);
        if (resolved.forbidden) {
          res.status(403).json({ ok: false, error: 'forbidden' });
          return;
        }
        if (!resolved.userId) {
          res.status(400).json({ ok: false, error: 'invalid_user' });
          return;
        }
        const subjectId = resolved.userId;

        // GET-never-writes: gate the bridge (which runs ensure-schema DDL) behind a
        // read-only readiness probe. Schema absent => honest not-measurable, ZERO DDL.
        const ready = await competencyRuntimeReady(pool).catch(() => false);
        if (!ready) {
          res.json({
            ok: true,
            version: CAREER_INTELLIGENCE_VERSION,
            subject_id: subjectId,
            measurable: false,
            scores: buildActivationScores(null, null, null),
            plan: { focus_areas: [], plan_actions: [], growth_plan_inputs: null, development: [] },
            language_policy: LANGUAGE_POLICY,
            provenance: {
              source: 'career-intelligence-bridge (Phase 4) composing the measured competency profile',
              note: 'Competency runtime schema not provisioned — no measured profile to compose (honest empty, no DDL run).',
              source_versions: {},
            },
            notes: ['Competency runtime not ready — scores are not yet measurable (honest absence).'],
          });
          return;
        }

        const env = await buildCareerIntelligence(pool, subjectId);
        res.json({
          ok: true,
          version: env.version,
          subject_id: env.subject_id,
          measurable: env.activation_scores.measurable,
          scores: env.activation_scores,
          plan: {
            focus_areas: env.career_planning.focus_areas,
            plan_actions: env.career_planning.plan_actions,
            growth_plan_inputs: env.career_planning.growth_plan_inputs,
            development: env.career_development.emitted,
          },
          language_policy: env.language_policy,
          provenance: {
            source: 'career-intelligence-bridge (Phase 4) composing the measured competency profile',
            note: 'Compose-only: readiness=role_readiness_v2, growth=ei growth_potential, progression=ei history, skill-gap=role_gap pressure. No score recomputed or fabricated.',
            source_versions: env.source_versions,
          },
          notes: env.notes,
        });
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[career-competency-activation]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    },
  );
}
